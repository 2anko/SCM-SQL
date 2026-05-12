// queries/supplierItems.js

export async function getItemsBySupplier(db, supplierId) {
  const { rows } = await db.query(`
    SELECT
      si.*,
      i.sku,
      i.name AS item_name,
      i.unit_of_measure
    FROM supplier_items si
    JOIN items i ON i.id = si.item_id
    WHERE si.supplier_id = $1
    ORDER BY si.is_preferred DESC, i.name
  `, [supplierId]);
  return rows;
}

export async function getSuppliersByItem(db, itemId) {
  const { rows } = await db.query(`
    SELECT
      si.*,
      s.name AS supplier_name
    FROM supplier_items si
    JOIN suppliers s ON s.id = si.supplier_id
    WHERE si.item_id = $1 AND s.is_active = true
    ORDER BY si.is_preferred DESC, si.unit_cost ASC
  `, [itemId]);
  return rows;
}

export async function getSupplierItem(db, supplierId, itemId) {
  const { rows } = await db.query(
    `SELECT * FROM supplier_items WHERE supplier_id = $1 AND item_id = $2`,
    [supplierId, itemId]
  );
  return rows[0] ?? null;
}

/**
 * Upsert a supplier-item link.
 * If the row exists, only fields present in `fields` are updated.
 * If the row doesn't exist, `unit_cost` is required.
 */
export async function upsertSupplierItem(db, supplierId, itemId, fields) {
  const { rows: existing } = await db.query(
    `SELECT * FROM supplier_items WHERE supplier_id = $1 AND item_id = $2`,
    [supplierId, itemId]
  );

  if (existing.length > 0) {
    const allowed = ['unit_cost', 'supplier_sku', 'lead_time_days', 'is_preferred', 'notes'];
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
    values.push(supplierId, itemId);
    const { rows } = await db.query(`
      UPDATE supplier_items SET ${updates.join(', ')}
      WHERE supplier_id = $${values.length - 1} AND item_id = $${values.length}
      RETURNING *
    `, values);
    return rows[0];
  }

  if (fields.unit_cost === undefined) {
    throw new Error('unit_cost is required when creating a supplier-item link.');
  }
  const { rows } = await db.query(`
    INSERT INTO supplier_items
      (supplier_id, item_id, unit_cost, supplier_sku, lead_time_days, is_preferred, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    supplierId, itemId,
    fields.unit_cost,
    fields.supplier_sku    ?? null,
    fields.lead_time_days  ?? null,
    fields.is_preferred    ?? false,
    fields.notes           ?? null,
  ]);
  return rows[0];
}

export async function deleteSupplierItem(db, supplierId, itemId) {
  const { rowCount } = await db.query(
    `DELETE FROM supplier_items WHERE supplier_id = $1 AND item_id = $2`,
    [supplierId, itemId]
  );
  return rowCount > 0;
}
