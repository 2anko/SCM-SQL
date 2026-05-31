// queries/inventory.js
import { paginatedResult } from '../helpers/pagination.js';

/**
 * Get current stock levels, optionally filtered by warehouse or item.
 * When { limit, offset } are passed, returns { rows, total, page, pageSize };
 * otherwise returns a plain array (back-compat for Dashboard aggregation).
 */
export async function getStockLevels(db, { warehouseId, itemId, paginated, page, pageSize, limit, offset } = {}) {
  const conditions = [];
  const values = [];

  if (warehouseId) { values.push(warehouseId); conditions.push(`inv.warehouse_id = $${values.length}`); }
  if (itemId)      { values.push(itemId);      conditions.push(`inv.item_id = $${values.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const totalCol = paginated ? ', COUNT(*) OVER() AS total_count' : '';
  let limitClause = '';
  if (paginated) {
    values.push(limit);  const limitIdx  = values.length;
    values.push(offset); const offsetIdx = values.length;
    limitClause = `LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
  }

  const { rows } = await db.query(`
    SELECT
      inv.id,
      inv.warehouse_id,
      inv.item_id,
      w.name   AS warehouse,
      i.sku,
      i.name   AS item,
      i.unit_of_measure,
      inv.quantity,
      inv.updated_at
      ${totalCol}
    FROM inventory inv
    JOIN warehouses w ON w.id = inv.warehouse_id
    JOIN items i      ON i.id = inv.item_id
    ${where}
    ORDER BY w.name, i.name
    ${limitClause}
  `, values);

  return paginated ? paginatedResult(rows, { page, pageSize }) : rows;
}

/**
 * Record an inventory transaction and update the running balance.
 * This is the single function all stock movements go through.
 *
 * Positive txn_types  (add stock):  RECEIPT, TRANSFER_IN, ADJUSTMENT(+), RETURN_IN
 * Negative txn_types  (remove stock): SHIPMENT, TRANSFER_OUT, ADJUSTMENT(-), RETURN_OUT
 *
 * Pass a negative `quantity` for removal types — the DB column is always positive
 * but we apply the sign here before updating the balance.
 */
export async function recordTransaction(db, {
  txn_type,
  item_id,
  warehouse_id,
  related_warehouse_id = null,
  quantity,             // always pass as a positive number
  purchase_order_id = null,
  sales_order_id = null,
  notes = null,
  created_by = null,
}) {
  const OUTBOUND = new Set(['SHIPMENT', 'TRANSFER_OUT', 'RETURN_OUT']);
  const isOutbound = OUTBOUND.has(txn_type);
  const delta = isOutbound ? -Math.abs(quantity) : Math.abs(quantity);

  // Run inside a transaction so the log + balance update are atomic
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. For outbound moves, lock the inventory row and verify there's enough stock.
    //    Without this, manual RETURN_OUT / TRANSFER_OUT could push the balance
    //    negative (the upsert below blindly adds the delta).
    if (isOutbound) {
      const { rows: [row] } = await client.query(
        `SELECT quantity FROM inventory
          WHERE warehouse_id = $1 AND item_id = $2
          FOR UPDATE`,
        [warehouse_id, item_id]
      );
      const available = Number(row?.quantity ?? 0);
      if (available < Math.abs(quantity)) {
        throw new Error(`Insufficient stock. Available: ${available}, Requested: ${Math.abs(quantity)}`);
      }
    }

    // 2. Write the transaction log
    const { rows } = await client.query(`
      INSERT INTO inventory_transactions
        (txn_type, item_id, warehouse_id, related_warehouse_id,
         quantity, purchase_order_id, sales_order_id, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [txn_type, item_id, warehouse_id, related_warehouse_id,
        Math.abs(quantity), purchase_order_id, sales_order_id, notes, created_by]);

    // 3. Upsert the inventory balance
    await client.query(`
      INSERT INTO inventory (warehouse_id, item_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (warehouse_id, item_id)
      DO UPDATE SET
        quantity   = inventory.quantity + EXCLUDED.quantity,
        updated_at = now()
    `, [warehouse_id, item_id, delta]);

    await client.query('COMMIT');
    return rows[0];

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transfer stock between two warehouses.
 * Creates a TRANSFER_OUT + TRANSFER_IN pair atomically.
 */
export async function transferStock(db, { item_id, from_warehouse_id, to_warehouse_id, quantity, notes, created_by }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Check there's enough stock
    const { rows } = await client.query(
      `SELECT quantity FROM inventory WHERE warehouse_id = $1 AND item_id = $2`,
      [from_warehouse_id, item_id]
    );
    const current = rows[0]?.quantity ?? 0;
    if (current < quantity) {
      throw new Error(`Insufficient stock. Available: ${current}, Requested: ${quantity}`);
    }

    // TRANSFER_OUT from source
    await client.query(`
      INSERT INTO inventory_transactions
        (txn_type, item_id, warehouse_id, related_warehouse_id, quantity, notes, created_by)
      VALUES ('TRANSFER_OUT', $1, $2, $3, $4, $5, $6)
    `, [item_id, from_warehouse_id, to_warehouse_id, quantity, notes, created_by]);

    await client.query(`
      UPDATE inventory SET quantity = quantity - $1, updated_at = now()
      WHERE warehouse_id = $2 AND item_id = $3
    `, [quantity, from_warehouse_id, item_id]);

    // TRANSFER_IN to destination
    await client.query(`
      INSERT INTO inventory_transactions
        (txn_type, item_id, warehouse_id, related_warehouse_id, quantity, notes, created_by)
      VALUES ('TRANSFER_IN', $1, $2, $3, $4, $5, $6)
    `, [item_id, to_warehouse_id, from_warehouse_id, quantity, notes, created_by]);

    await client.query(`
      INSERT INTO inventory (warehouse_id, item_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (warehouse_id, item_id)
      DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now()
    `, [to_warehouse_id, item_id, quantity]);

    await client.query('COMMIT');
    return { success: true, transferred: quantity };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Aggregate the entire current inventory by item, by warehouse, and overall.
 * "value" of an inventory row = quantity * items.value. items.value is updated
 * automatically to the weighted-average cost across all RECEIVED PO lines.
 */
export async function getInventorySummary(db) {
  const { rows: byItem } = await db.query(`
    SELECT
      i.id                              AS item_id,
      i.sku,
      i.name                            AS item,
      i.unit_of_measure,
      SUM(inv.quantity)                 AS total_quantity,
      i.value                           AS unit_value,
      SUM(inv.quantity * i.value)       AS total_value
    FROM inventory inv
    JOIN items i ON i.id = inv.item_id
    WHERE inv.quantity > 0
    GROUP BY i.id, i.sku, i.name, i.unit_of_measure, i.value
    ORDER BY total_value DESC NULLS LAST
  `);

  const { rows: byWarehouse } = await db.query(`
    SELECT
      w.id                              AS warehouse_id,
      w.name                            AS warehouse,
      COUNT(DISTINCT inv.item_id)       AS item_count,
      SUM(inv.quantity)                 AS total_quantity,
      SUM(inv.quantity * i.value)       AS total_value
    FROM inventory inv
    JOIN items      i ON i.id = inv.item_id
    JOIN warehouses w ON w.id = inv.warehouse_id
    WHERE inv.quantity > 0
    GROUP BY w.id, w.name
    ORDER BY total_value DESC NULLS LAST
  `);

  const { rows: stock } = await db.query(`
    SELECT
      inv.warehouse_id,
      inv.item_id,
      w.name                       AS warehouse,
      i.sku,
      i.name                       AS item,
      i.unit_of_measure,
      inv.quantity,
      i.value                      AS unit_value,
      inv.quantity * i.value       AS line_value
    FROM inventory inv
    JOIN warehouses w ON w.id = inv.warehouse_id
    JOIN items      i ON i.id = inv.item_id
    WHERE inv.quantity > 0
    ORDER BY w.name, i.name
  `);

  const totalValue = byItem.reduce((sum, r) => sum + Number(r.total_value || 0), 0);

  return {
    totals: {
      total_value:     totalValue,
      item_count:      byItem.length,
      warehouse_count: byWarehouse.length,
    },
    by_item:      byItem,
    by_warehouse: byWarehouse,
    stock,
  };
}

/**
 * Get transaction history for an item or warehouse.
 * Paginated when { limit, offset } supplied (returns { rows, total, … }).
 * Without pagination, falls back to a capped 100-row list (legacy behaviour).
 */
export async function getTransactionHistory(db, { itemId, warehouseId, paginated, page, pageSize, limit, offset } = {}) {
  const conditions = [];
  const values = [];

  if (itemId)      { values.push(itemId);      conditions.push(`t.item_id = $${values.length}`); }
  if (warehouseId) { values.push(warehouseId); conditions.push(`t.warehouse_id = $${values.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalCol = paginated ? ', COUNT(*) OVER() AS total_count' : '';
  let limitClause;
  if (paginated) {
    values.push(limit);  const limitIdx  = values.length;
    values.push(offset); const offsetIdx = values.length;
    limitClause = `LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
  } else {
    values.push(100);    // legacy default cap
    limitClause = `LIMIT $${values.length}`;
  }

  const { rows } = await db.query(`
    SELECT
      t.id,
      t.txn_type,
      i.sku,
      i.name   AS item,
      w.name   AS warehouse,
      t.quantity,
      t.notes,
      t.created_at,
      po.id    AS purchase_order_id,
      so.id    AS sales_order_id
      ${totalCol}
    FROM inventory_transactions t
    JOIN items      i  ON i.id = t.item_id
    JOIN warehouses w  ON w.id = t.warehouse_id
    LEFT JOIN purchase_orders po ON po.id = t.purchase_order_id
    LEFT JOIN sales_orders    so ON so.id = t.sales_order_id
    ${where}
    ORDER BY t.created_at DESC
    ${limitClause}
  `, values);

  return paginated ? paginatedResult(rows, { page, pageSize }) : rows;
}
