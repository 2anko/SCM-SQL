// routes/suppliers.js
export default async function supplierRoutes(app) {
  app.get('/', async (req) => (await req.db.query(
    `SELECT s.*, json_agg(sf.*) AS factories
     FROM suppliers s
     LEFT JOIN supplier_factories sf ON sf.supplier_id = s.id
     GROUP BY s.id ORDER BY s.name`
  )).rows);

  app.post('/', async (req, rep) => {
    const { name, email, phone, address } = req.body;
    const { rows } = await req.db.query(
      'INSERT INTO suppliers (name, email, phone, address) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, email, phone, address]
    );
    return rep.code(201).send(rows[0]);
  });
}
