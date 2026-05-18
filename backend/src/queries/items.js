// queries/items.js

/**
 * Recompute and persist items.value as the weighted-average cost across all
 * RECEIVED PO lines for this item.
 *   value = SUM(quantity_received * unit_cost) / SUM(quantity_received)
 * If no RECEIVED lines exist (yet), the value is left alone.
 * Call this inside the PO-receive transaction (pass the same client) so the
 * update is atomic with the rest of the receipt.
 */
export async function recomputeItemValue(client, itemId) {
  await client.query(`
    UPDATE items i
    SET value = sub.avg_cost
    FROM (
      SELECT
        pol.item_id,
        SUM(pol.quantity_received * pol.unit_cost) /
          NULLIF(SUM(pol.quantity_received), 0) AS avg_cost
      FROM purchase_order_lines pol
      JOIN purchase_orders     po  ON po.id = pol.po_id
      WHERE pol.item_id = $1
        AND po.status   = 'RECEIVED'
        AND pol.quantity_received > 0
      GROUP BY pol.item_id
    ) AS sub
    WHERE i.id = sub.item_id
  `, [itemId]);
}

export async function getAllItems(db) {
  const { rows } = await db.query(`
    SELECT id, sku, name, description, unit_of_measure, value, created_at
    FROM items
    ORDER BY name
  `);
  return rows;
}

export async function getItemById(db, id) {
  const { rows } = await db.query(
    `SELECT * FROM items WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createItem(db, { sku, name, description, unit_of_measure, value }) {
  const { rows } = await db.query(`
    INSERT INTO items (sku, name, description, unit_of_measure, value)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [sku, name, description, unit_of_measure ?? 'each', value]);
  return rows[0];
}

export async function updateItem(db, id, fields) {
  const allowed = ['name', 'description', 'unit_of_measure', 'value'];
  const updates = [];
  const values  = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      updates.push(`${key} = $${values.length}`);
    }
  }

  if (updates.length === 0) return getItemById(db, id);

  values.push(id);
  const { rows } = await db.query(`
    UPDATE items SET ${updates.join(', ')}
    WHERE id = $${values.length}
    RETURNING *
  `, values);
  return rows[0] ?? null;
}

/**
 * Delete an item.
 *
 * Hard blockers (real history that must never be lost):
 *   - any inventory_transactions row
 *   - any inventory row with quantity > 0
 *   - any PO line whose PO is NOT cancelled
 *   - any SO line whose SO is NOT cancelled
 *
 * If only cancelled-order lines and zero-stock inventory rows reference the item,
 * we sweep those out inside a transaction and then delete the item.
 */
export async function deleteItem(db, id) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Hard blockers
    const { rows: [counts] } = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM inventory_transactions WHERE item_id = $1)                          AS txn_count,
        (SELECT COUNT(*) FROM inventory              WHERE item_id = $1 AND quantity > 0)         AS stock_count,
        (SELECT COUNT(*) FROM purchase_order_lines pol
           JOIN purchase_orders po ON po.id = pol.po_id
          WHERE pol.item_id = $1 AND po.status <> 'CANCELLED')                                    AS open_po_count,
        (SELECT COUNT(*) FROM sales_order_lines sol
           JOIN sales_orders so ON so.id = sol.so_id
          WHERE sol.item_id = $1 AND so.status <> 'CANCELLED')                                    AS open_so_count
    `, [id]);

    if (parseInt(counts.txn_count) > 0) {
      throw new Error('Cannot delete: this item has inventory transaction history.');
    }
    if (parseInt(counts.stock_count) > 0) {
      throw new Error('Cannot delete: this item still has stock on hand.');
    }
    if (parseInt(counts.open_po_count) > 0) {
      throw new Error('Cannot delete: this item is on a non-cancelled purchase order.');
    }
    if (parseInt(counts.open_so_count) > 0) {
      throw new Error('Cannot delete: this item is on a non-cancelled sales order.');
    }

    // Sweep out the soft references — lines on cancelled orders + empty inventory rows
    await client.query(`
      DELETE FROM purchase_order_lines
       WHERE item_id = $1
         AND po_id IN (SELECT id FROM purchase_orders WHERE status = 'CANCELLED')
    `, [id]);

    await client.query(`
      DELETE FROM sales_order_lines
       WHERE item_id = $1
         AND so_id IN (SELECT id FROM sales_orders WHERE status = 'CANCELLED')
    `, [id]);

    await client.query(
      `DELETE FROM inventory WHERE item_id = $1 AND quantity = 0`,
      [id]
    );

    const { rowCount } = await client.query(`DELETE FROM items WHERE id = $1`, [id]);

    await client.query('COMMIT');
    return rowCount > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
