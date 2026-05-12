// queries/customerItems.js

export async function getItemsByCustomer(db, customerId) {
  const { rows } = await db.query(`
    SELECT
      ci.*,
      i.sku,
      i.name AS item_name,
      i.unit_of_measure
    FROM customer_items ci
    JOIN items i ON i.id = ci.item_id
    WHERE ci.customer_id = $1
    ORDER BY i.name
  `, [customerId]);
  return rows;
}

export async function getCustomersByItem(db, itemId) {
  const { rows } = await db.query(`
    SELECT
      ci.*,
      c.name AS customer_name
    FROM customer_items ci
    JOIN customers c ON c.id = ci.customer_id
    WHERE ci.item_id = $1 AND c.is_active = true
    ORDER BY ci.unit_price DESC
  `, [itemId]);
  return rows;
}

export async function getCustomerItem(db, customerId, itemId) {
  const { rows } = await db.query(
    `SELECT * FROM customer_items WHERE customer_id = $1 AND item_id = $2`,
    [customerId, itemId]
  );
  return rows[0] ?? null;
}

export async function upsertCustomerItem(db, customerId, itemId, fields) {
  const { rows: existing } = await db.query(
    `SELECT * FROM customer_items WHERE customer_id = $1 AND item_id = $2`,
    [customerId, itemId]
  );

  if (existing.length > 0) {
    const allowed = ['unit_price', 'customer_sku', 'notes'];
    const updates = [];
    const values  = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        values.push(fields[key]);
        updates.push(`${key} = $${values.length}`);
      }
    }
    if (updates.length === 0) return existing[0];
    updates.push(`updated_at = now()`);
    values.push(customerId, itemId);
    const { rows } = await db.query(`
      UPDATE customer_items SET ${updates.join(', ')}
      WHERE customer_id = $${values.length - 1} AND item_id = $${values.length}
      RETURNING *
    `, values);
    return rows[0];
  }

  if (fields.unit_price === undefined) {
    throw new Error('unit_price is required when creating a customer-item link.');
  }
  const { rows } = await db.query(`
    INSERT INTO customer_items (customer_id, item_id, unit_price, customer_sku, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    customerId, itemId,
    fields.unit_price,
    fields.customer_sku ?? null,
    fields.notes        ?? null,
  ]);
  return rows[0];
}

export async function deleteCustomerItem(db, customerId, itemId) {
  const { rowCount } = await db.query(
    `DELETE FROM customer_items WHERE customer_id = $1 AND item_id = $2`,
    [customerId, itemId]
  );
  return rowCount > 0;
}
