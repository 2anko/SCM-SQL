// routes/inventory.js
import { getStockLevels, recordTransaction, transferStock, getTransactionHistory } from '../queries/inventory.js';

export default async function inventoryRoutes(app) {
  // GET /inventory?warehouseId=1&itemId=2
  app.get('/', async (req) => {
    const { warehouseId, itemId } = req.query;
    return getStockLevels(req.db, { warehouseId, itemId });
  });

  // GET /inventory/history?itemId=1&warehouseId=2&limit=50
  app.get('/history', async (req) => {
    const { itemId, warehouseId, limit } = req.query;
    return getTransactionHistory(req.db, { itemId, warehouseId, limit });
  });

  // POST /inventory/transaction  — general purpose (adjustments, returns, etc.)
  app.post('/transaction', async (req, rep) => {
    const txn = await recordTransaction(req.db, req.body);
    return rep.code(201).send(txn);
  });

  // POST /inventory/transfer
  app.post('/transfer', async (req, rep) => {
    try {
      return rep.code(201).send(await transferStock(req.db, req.body));
    } catch (err) {
      return rep.code(400).send({ error: err.message });
    }
  });
}
