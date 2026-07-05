// routes/suppliers.js
import { authorize } from '../middleware/authorize.js';
import { parsePagination, paginatedResult } from '../helpers/pagination.js';

const createSchema = {
  body: {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
      name:    { type: 'string', minLength: 1 },
      email:   { type: 'string', format: 'email' },
      phone:   { type: 'string' },
      fax:     { type: 'string' },
      address: { type: 'string' },
    },
  },
};

const updateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name:    { type: 'string', minLength: 1 },
      email:   { type: 'string', format: 'email' },
      phone:   { type: 'string' },
      fax:     { type: 'string' },
      address: { type: 'string' },
    },
  },
};

export default async function supplierRoutes(app) {
  app.get('/', { preHandler: authorize('read') },
    async (req) => {
      const pg = parsePagination(req.query);
      if (!pg.paginated) {
        return (await req.db.query(`
          SELECT s.*, json_agg(sf.*) FILTER (WHERE sf.id IS NOT NULL) AS factories
          FROM suppliers s
          LEFT JOIN supplier_factories sf ON sf.supplier_id = s.id AND sf.is_active = true
          WHERE s.is_active = true
          GROUP BY s.id ORDER BY s.name
        `)).rows;
      }
      const { rows } = await req.db.query(`
        SELECT s.*, json_agg(sf.*) FILTER (WHERE sf.id IS NOT NULL) AS factories,
               COUNT(*) OVER() AS total_count
        FROM suppliers s
        LEFT JOIN supplier_factories sf ON sf.supplier_id = s.id AND sf.is_active = true
        WHERE s.is_active = true
        GROUP BY s.id ORDER BY s.name
        LIMIT $1 OFFSET $2
      `, [pg.limit, pg.offset]);
      return paginatedResult(rows, pg);
    }
  );
  app.get('/:id', { preHandler: authorize('read') },
    async (req, rep) => {
      const { rows } = await req.db.query(`
        SELECT s.*, json_agg(sf.*) FILTER (WHERE sf.id IS NOT NULL) AS factories
        FROM suppliers s
        LEFT JOIN supplier_factories sf ON sf.supplier_id = s.id AND sf.is_active = true
        WHERE s.id = $1 AND s.is_active = true
        GROUP BY s.id
      `, [req.params.id]);
      return rows[0] ?? rep.code(404).send({ error: 'Supplier not found' });
    }
  );
  app.post('/', { preHandler: authorize('create'), schema: createSchema },
    async (req, rep) => {
      const { name, email, phone, fax, address } = req.body;
      const { rows } = await req.db.query(
        'INSERT INTO suppliers (name, email, phone, fax, address) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [name, email, phone, fax, address]
      );
      return rep.code(201).send(rows[0]);
    }
  );
  app.patch('/:id', { preHandler: authorize('write'), schema: updateSchema },
    async (req, rep) => {
      const allowed = ['name', 'email', 'phone', 'fax', 'address'];
      const updates = [];
      const values  = [];
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          values.push(req.body[key]);
          updates.push(`${key} = $${values.length}`);
        }
      }
      if (updates.length === 0) return rep.code(400).send({ error: 'No valid fields provided' });
      values.push(req.params.id);
      const { rows } = await req.db.query(
        `UPDATE suppliers SET ${updates.join(', ')} WHERE id = $${values.length} AND is_active = true RETURNING *`,
        values
      );
      return rows[0] ?? rep.code(404).send({ error: 'Supplier not found' });
    }
  );
  app.delete('/:id', { preHandler: authorize('delete') },
    async (req, rep) => {
      const { rows: [{ count }] } = await req.db.query(
        `SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = $1 AND status NOT IN ('RECEIVED', 'CANCELLED')`,
        [req.params.id]
      );
      if (parseInt(count) > 0) {
        return rep.code(409).send({ error: 'Cannot deactivate supplier with open purchase orders' });
      }
      const { rows } = await req.db.query(
        'UPDATE suppliers SET is_active = false WHERE id = $1 AND is_active = true RETURNING id',
        [req.params.id]
      );
      return rows[0] ? { success: true } : rep.code(404).send({ error: 'Supplier not found' });
    }
  );
}
