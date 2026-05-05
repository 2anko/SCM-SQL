// routes/inventory.js
import { getStockLevels, recordTransaction, transferStock, getTransactionHistory } from '../queries/inventory.js';
import { authorize } from '../middleware/authorize.js';

export default async function inventoryRoutes(app) {
  // GET /inventory?warehouseId=1&itemId=2
  app.get('/',        { preHandler: authorize('read') },
    async (req) => {
      const { warehouseId, itemId } = req.query;
      return getStockLevels(req.db, { warehouseId, itemId });
    }
  );

  // GET /inventory/history?itemId=1&warehouseId=2&limit=50
  app.get('/history', { preHandler: authorize('read') },
    async (req) => {
      const { itemId, warehouseId, limit } = req.query;
      return getTransactionHistory(req.db, { itemId, warehouseId, limit });
    }
  );

  // POST /inventory/transaction — adjustments, returns, etc. (create new record)
  app.post('/transaction', { preHandler: authorize('create') },
    async (req, rep) => {
      const txn = await recordTransaction(req.db, req.body);
      return rep.code(201).send(txn);
    }
  );

  // POST /inventory/transfer — moves stock between warehouses (create new record)
  app.post('/transfer',    { preHandler: authorize('create') },
    async (req, rep) => {
      try {
        return rep.code(201).send(await transferStock(req.db, req.body));
      } catch (err) {
        return rep.code(400).send({ error: err.message });
      }
    }
  );
}
