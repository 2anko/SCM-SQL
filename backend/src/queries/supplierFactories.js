// queries/supplierFactories.js

export async function getFactoriesBySupplier(db, supplierId) {
  const { rows } = await db.query(`
    SELECT sf.*, row_to_json(fr.*) AS rep
    FROM supplier_factories sf
    LEFT JOIN factory_rep fr ON fr.factory_id = sf.id
    WHERE sf.supplier_id = $1 AND sf.is_active = true
    ORDER BY sf.name
  `, [supplierId]);
  return rows;
}

export async function getFactoryById(db, factoryId) {
  const { rows } = await db.query(`
    SELECT sf.*, row_to_json(fr.*) AS rep
    FROM supplier_factories sf
    LEFT JOIN factory_rep fr ON fr.factory_id = sf.id
    WHERE sf.id = $1 AND sf.is_active = true
  `, [factoryId]);
  return rows[0] ?? null;
}

export async function createFactory(db, supplierId, { name, address, country, rep }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [factory] } = await client.query(`
      INSERT INTO supplier_factories (supplier_id, name, address, country)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [supplierId, name, address, country]);

    let repRow = null;
    if (rep) {
      const { rows: [r] } = await client.query(`
        INSERT INTO factory_rep (factory_id, name, email, phone)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [factory.id, rep.name, rep.email ?? null, rep.phone ?? null]);
      repRow = r;
    }

    await client.query('COMMIT');
    return { ...factory, rep: repRow };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateFactory(db, factoryId, fields) {
  const allowed = ['name', 'address', 'country'];
  const updates = [];
  const values  = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      updates.push(`${key} = $${values.length}`);
    }
  }

  if (updates.length === 0) return getFactoryById(db, factoryId);

  values.push(factoryId);
  const { rows } = await db.query(`
    UPDATE supplier_factories SET ${updates.join(', ')}
    WHERE id = $${values.length} AND is_active = true
    RETURNING *
  `, values);
  return rows[0] ?? null;
}

export async function deactivateFactory(db, factoryId) {
  const { rows: [{ count }] } = await db.query(`
    SELECT COUNT(*) FROM purchase_orders
    WHERE factory_id = $1 AND status NOT IN ('RECEIVED', 'CANCELLED')
  `, [factoryId]);

  if (parseInt(count) > 0) {
    throw new Error('Cannot deactivate a factory with open purchase orders');
  }

  const { rows } = await db.query(`
    UPDATE supplier_factories SET is_active = false WHERE id = $1 RETURNING id
  `, [factoryId]);
  return rows[0] ?? null;
}

export async function upsertFactoryRep(db, factoryId, { name, email, phone }) {
  const { rows } = await db.query(`
    INSERT INTO factory_rep (factory_id, name, email, phone)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (factory_id) DO UPDATE SET name = $2, email = $3, phone = $4
    RETURNING *
  `, [factoryId, name, email ?? null, phone ?? null]);
  return rows[0];
}

export async function deleteFactoryRep(db, factoryId) {
  const { rows } = await db.query(`
    DELETE FROM factory_rep WHERE factory_id = $1 RETURNING id
  `, [factoryId]);
  return rows[0] ?? null;
}
