// routes/warehouses.js
import { authorize } from '../middleware/authorize.js';

export default async function warehouseRoutes(app) {
  app.get('/', { preHandler: authorize('read') },
    async (req) => (await req.db.query(
      'SELECT * FROM warehouses WHERE is_active = true ORDER BY name'
    )).rows
  );

  app.get('/:id', { preHandler: authorize('read') },
    async (req, rep) => {
      const { rows } = await req.db.query(
        'SELECT * FROM warehouses WHERE id = $1 AND is_active = true',
        [req.params.id]
      );
      return rows[0] ?? rep.code(404).send({ error: 'Warehouse not found' });
    }
  );

  app.post('/', { preHandler: authorize('create') },
    async (req, rep) => {
      const { name, address, country } = req.body;
      const { rows } = await req.db.query(
        'INSERT INTO warehouses (name, address, country) VALUES ($1,$2,$3) RETURNING *',
        [name, address, country]
      );
      return rep.code(201).send(rows[0]);
    }
  );

  app.patch('/:id', { preHandler: authorize('write') },
    async (req, rep) => {
      const allowed = ['name', 'address', 'country'];
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
        `UPDATE warehouses SET ${updates.join(', ')} WHERE id = $${values.length} AND is_active = true RETURNING *`,
        values
      );
      return rows[0] ?? rep.code(404).send({ error: 'Warehouse not found' });
    }
  );

  app.delete('/:id', { preHandler: authorize('delete') },
    async (req, rep) => {
      const { rows: [{ count }] } = await req.db.query(
        'SELECT COUNT(*) FROM inventory WHERE warehouse_id = $1 AND quantity > 0',
        [req.params.id]
      );
      if (parseInt(count) > 0) {
        return rep.code(409).send({ error: 'Cannot deactivate warehouse with stock on hand. Transfer all inventory out first.' });
      }
      const { rows } = await req.db.query(
        'UPDATE warehouses SET is_active = false WHERE id = $1 AND is_active = true RETURNING id',
        [req.params.id]
      );
      return rows[0] ? { success: true } : rep.code(404).send({ error: 'Warehouse not found' });
    }
  );
}
