// queries/items.js

export async function getAllItems(db) {
  const { rows } = await db.query(`
    SELECT id, sku, name, description, unit_of_measure, unit_cost, unit_price, created_at
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

export async function createItem(db, { sku, name, description, unit_of_measure, unit_cost, unit_price }) {
  const { rows } = await db.query(`
    INSERT INTO items (sku, name, description, unit_of_measure, unit_cost, unit_price)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [sku, name, description, unit_of_measure ?? 'each', unit_cost, unit_price]);
  return rows[0];
}

export async function updateItem(db, id, fields) {
  const allowed = ['name', 'description', 'unit_of_measure', 'unit_cost', 'unit_price'];
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

export async function deleteItem(db, id) {
  const { rows: [{ total }] } = await db.query(`
    SELECT (
      (SELECT COUNT(*) FROM inventory_transactions WHERE item_id = $1) +
      (SELECT COUNT(*) FROM purchase_order_lines  WHERE item_id = $1) +
      (SELECT COUNT(*) FROM sales_order_lines     WHERE item_id = $1) +
      (SELECT COUNT(*) FROM inventory             WHERE item_id = $1)
    ) AS total
  `, [id]);

  if (parseInt(total) > 0) {
    throw new Error('Cannot delete item that is referenced by existing orders or inventory records');
  }

  const { rowCount } = await db.query(`DELETE FROM items WHERE id = $1`, [id]);
  return rowCount > 0;
}
