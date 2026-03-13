// queries/purchaseOrders.js

export async function getAllPurchaseOrders(db, { status } = {}) {
  const values = [];
  const where  = status ? (values.push(status), `WHERE po.status = $1`) : '';

  const { rows } = await db.query(`
    SELECT
      po.id,
      s.name        AS supplier,
      sf.name       AS factory,
      po.status,
      po.expected_date,
      po.created_at,
      COUNT(pol.id)           AS line_count,
      SUM(pol.quantity_ordered * pol.unit_cost) AS total_value
    FROM purchase_orders po
    JOIN suppliers         s  ON s.id  = po.supplier_id
    LEFT JOIN supplier_factories sf ON sf.id = po.factory_id
    LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
    ${where}
    GROUP BY po.id, s.name, sf.name
    ORDER BY po.created_at DESC
  `, values);
  return rows;
}

export async function getPurchaseOrderById(db, id) {
  // Header
  const { rows: [po] } = await db.query(`
    SELECT
      po.*,
      s.name  AS supplier_name,
      sf.name AS factory_name
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN supplier_factories sf ON sf.id = po.factory_id
    WHERE po.id = $1
  `, [id]);
  if (!po) return null;

  // Lines
  const { rows: lines } = await db.query(`
    SELECT
      pol.*,
      i.sku,
      i.name AS item_name,
      w.name AS destination_warehouse
    FROM purchase_order_lines pol
    JOIN items i ON i.id = pol.item_id
    LEFT JOIN warehouses w ON w.id = pol.destination_warehouse_id
    WHERE pol.po_id = $1
    ORDER BY pol.id
  `, [id]);

  return { ...po, lines };
}

export async function createPurchaseOrder(db, { supplier_id, factory_id, expected_date, lines }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [po] } = await client.query(`
      INSERT INTO purchase_orders (supplier_id, factory_id, expected_date)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [supplier_id, factory_id ?? null, expected_date ?? null]);

    for (const line of lines) {
      await client.query(`
        INSERT INTO purchase_order_lines
          (po_id, item_id, quantity_ordered, unit_cost, destination_warehouse_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [po.id, line.item_id, line.quantity_ordered, line.unit_cost, line.destination_warehouse_id ?? null]);
    }

    await client.query('COMMIT');
    return getPurchaseOrderById(client, po.id);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePurchaseOrderStatus(db, id, status) {
  const { rows } = await db.query(`
    UPDATE purchase_orders
    SET status = $1, updated_at = now()
    WHERE id = $2
    RETURNING *
  `, [status, id]);
  return rows[0] ?? null;
}

/**
 * Receive goods against a PO line.
 * Updates quantity_received, auto-advances PO status, and triggers an inventory RECEIPT.
 */
export async function receivePurchaseOrderLine(db, { po_id, line_id, quantity_received, warehouse_id }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Update the line
    const { rows: [line] } = await client.query(`
      UPDATE purchase_order_lines
      SET quantity_received = quantity_received + $1
      WHERE id = $2 AND po_id = $3
      RETURNING *
    `, [quantity_received, line_id, po_id]);

    if (!line) throw new Error(`PO line ${line_id} not found on PO ${po_id}`);

    // Record inventory receipt
    await client.query(`
      INSERT INTO inventory_transactions
        (txn_type, item_id, warehouse_id, quantity, purchase_order_id)
      VALUES ('RECEIPT', $1, $2, $3, $4)
    `, [line.item_id, warehouse_id, quantity_received, po_id]);

    await client.query(`
      INSERT INTO inventory (warehouse_id, item_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (warehouse_id, item_id)
      DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now()
    `, [warehouse_id, line.item_id, quantity_received]);

    // Auto-update PO status based on all lines
    const { rows: allLines } = await client.query(
      `SELECT quantity_ordered, quantity_received FROM purchase_order_lines WHERE po_id = $1`,
      [po_id]
    );

    const allReceived     = allLines.every(l => l.quantity_received >= l.quantity_ordered);
    const anyReceived     = allLines.some(l => l.quantity_received > 0);
    const newStatus       = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'CONFIRMED';

    await client.query(
      `UPDATE purchase_orders SET status = $1, updated_at = now() WHERE id = $2`,
      [newStatus, po_id]
    );

    await client.query('COMMIT');
    return { line, new_po_status: newStatus };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
