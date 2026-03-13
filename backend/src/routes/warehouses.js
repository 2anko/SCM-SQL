// routes/warehouses.js
export default async function warehouseRoutes(app) {
  app.get('/',    async (req) => (await req.db.query('SELECT * FROM warehouses ORDER BY name')).rows);
  app.get('/:id', async (req, rep) => {
    const { rows } = await req.db.query('SELECT * FROM warehouses WHERE id = $1', [req.params.id]);
    return rows[0] ?? rep.code(404).send({ error: 'Warehouse not found' });
  });
  app.post('/', async (req, rep) => {
    const { name, address, country } = req.body;
    const { rows } = await req.db.query(
      'INSERT INTO warehouses (name, address, country) VALUES ($1,$2,$3) RETURNING *',
      [name, address, country]
    );
    return rep.code(201).send(rows[0]);
  });
}
