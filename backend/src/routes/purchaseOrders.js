// routes/purchaseOrders.js
import {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrderLine,
} from '../queries/purchaseOrders.js';

export default async function poRoutes(app) {
  // GET /purchase-orders?status=DRAFT
  app.get('/', async (req) => getAllPurchaseOrders(req.db, { status: req.query.status }));

  app.get('/:id', async (req, rep) => {
    const po = await getPurchaseOrderById(req.db, req.params.id);
    return po ?? rep.code(404).send({ error: 'Purchase order not found' });
  });

  app.post('/', async (req, rep) => rep.code(201).send(await createPurchaseOrder(req.db, req.body)));

  // PATCH /purchase-orders/:id/status  { "status": "SENT" }
  app.patch('/:id/status', async (req, rep) => {
    const po = await updatePurchaseOrderStatus(req.db, req.params.id, req.body.status);
    return po ?? rep.code(404).send({ error: 'Purchase order not found' });
  });

  // POST /purchase-orders/:id/receive  { line_id, quantity_received, warehouse_id }
  app.post('/:id/receive', async (req, rep) => {
    try {
      return rep.code(201).send(await receivePurchaseOrderLine(req.db, {
        po_id: req.params.id,
        ...req.body,
      }));
    } catch (err) {
      return rep.code(400).send({ error: err.message });
    }
  });
}
