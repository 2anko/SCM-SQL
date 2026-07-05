// routes/customers.js
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

export default async function customerRoutes(app) {
  app.get('/', { preHandler: authorize('read') },
    async (req) => {
      const pg = parsePagination(req.query);
      if (!pg.paginated) {
        return (await req.db.query(
          'SELECT * FROM customers WHERE is_active = true ORDER BY name'
        )).rows;
      }
      const { rows } = await req.db.query(
        `SELECT *, COUNT(*) OVER() AS total_count
           FROM customers WHERE is_active = true
          ORDER BY name LIMIT $1 OFFSET $2`,
        [pg.limit, pg.offset]
      );
      return paginatedResult(rows, pg);
    }
  );
  app.get('/:id', { preHandler: authorize('read') },
    async (req, rep) => {
      const { rows } = await req.db.query(
        'SELECT * FROM customers WHERE id = $1 AND is_active = true',
        [req.params.id]
      );
      return rows[0] ?? rep.code(404).send({ error: 'Customer not found' });
    }
  );
  app.post('/', { preHandler: authorize('create'), schema: createSchema },
    async (req, rep) => {
      const { name, email, phone, fax, address } = req.body;
      const { rows } = await req.db.query(
        'INSERT INTO customers (name, email, phone, fax, address) VALUES ($1,$2,$3,$4,$5) RETURNING *',
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
        `UPDATE customers SET ${updates.join(', ')} WHERE id = $${values.length} AND is_active = true RETURNING *`,
        values
      );
      return rows[0] ?? rep.code(404).send({ error: 'Customer not found' });
    }
  );
  app.delete('/:id', { preHandler: authorize('delete') },
    async (req, rep) => {
      const { rows: [{ count }] } = await req.db.query(
        `SELECT COUNT(*) FROM sales_orders WHERE customer_id = $1 AND status NOT IN ('SHIPPED', 'DELIVERED', 'CANCELLED')`,
        [req.params.id]
      );
      if (parseInt(count) > 0) {
        return rep.code(409).send({ error: 'Cannot deactivate customer with open sales orders' });
      }
      const { rows } = await req.db.query(
        'UPDATE customers SET is_active = false WHERE id = $1 AND is_active = true RETURNING id',
        [req.params.id]
      );
      return rows[0] ? { success: true } : rep.code(404).send({ error: 'Customer not found' });
    }
  );
}
