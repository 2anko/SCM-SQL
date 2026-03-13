// routes/salesOrders.js
import {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  shipSalesOrderLine,
} from '../queries/salesOrders.js';

export default async function soRoutes(app) {
  app.get('/',    async (req)      => getAllSalesOrders(req.db, { status: req.query.status }));
  app.get('/:id', async (req, rep) => {
    const so = await getSalesOrderById(req.db, req.params.id);
    return so ?? rep.code(404).send({ error: 'Sales order not found' });
  });

  app.post('/', async (req, rep) => rep.code(201).send(await createSalesOrder(req.db, req.body)));

  // POST /sales-orders/:id/ship  { line_id, quantity_shipped, warehouse_id }
  app.post('/:id/ship', async (req, rep) => {
    try {
      return rep.code(201).send(await shipSalesOrderLine(req.db, {
        so_id: req.params.id,
        ...req.body,
      }));
    } catch (err) {
      return rep.code(400).send({ error: err.message });
    }
  });
}
