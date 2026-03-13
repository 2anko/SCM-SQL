// routes/customers.js
export default async function customerRoutes(app) {
  app.get('/', async (req) => (await req.db.query('SELECT * FROM customers ORDER BY name')).rows);
  app.get('/:id', async (req, rep) => {
    const { rows } = await req.db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    return rows[0] ?? rep.code(404).send({ error: 'Customer not found' });
  });
  app.post('/', async (req, rep) => {
    const { name, email, phone, address } = req.body;
    const { rows } = await req.db.query(
      'INSERT INTO customers (name, email, phone, address) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, email, phone, address]
    );
    return rep.code(201).send(rows[0]);
  });
}
