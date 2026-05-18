// routes/inventory.js
import { getStockLevels, recordTransaction, transferStock, getTransactionHistory, getInventorySummary } from '../queries/inventory.js';
import { authorize } from '../middleware/authorize.js';

const TXN_TYPES = ['RECEIPT', 'SHIPMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'RETURN_IN', 'RETURN_OUT'];

const transactionSchema = {
  body: {
    type: 'object',
    required: ['txn_type', 'item_id', 'warehouse_id', 'quantity'],
    additionalProperties: false,
    properties: {
      txn_type:             { type: 'string', enum: TXN_TYPES },
      item_id:              { type: 'integer' },
      warehouse_id:         { type: 'integer' },
      related_warehouse_id: { type: 'integer' },
      quantity:             { type: 'number', exclusiveMinimum: 0 },
      purchase_order_id:    { type: 'integer' },
      sales_order_id:       { type: 'integer' },
      notes:                { type: 'string' },
    },
  },
};

const transferSchema = {
  body: {
    type: 'object',
    required: ['item_id', 'from_warehouse_id', 'to_warehouse_id', 'quantity'],
    additionalProperties: false,
    properties: {
      item_id:           { type: 'integer' },
      from_warehouse_id: { type: 'integer' },
      to_warehouse_id:   { type: 'integer' },
      quantity:          { type: 'number', exclusiveMinimum: 0 },
      notes:             { type: 'string' },
    },
  },
};

export default async function inventoryRoutes(app) {
  app.get('/', { preHandler: authorize('read') },
    async (req) => {
      const { warehouseId, itemId } = req.query;
      return getStockLevels(req.db, { warehouseId, itemId });
    }
  );
  app.get('/summary', { preHandler: authorize('read') },
    async (req) => getInventorySummary(req.db)
  );
  app.get('/history', { preHandler: authorize('read') },
    async (req) => {
      const { itemId, warehouseId, limit } = req.query;
      return getTransactionHistory(req.db, { itemId, warehouseId, limit });
    }
  );
  app.post('/transaction', { preHandler: authorize('create'), schema: transactionSchema },
    async (req, rep) => {
      try {
        const txn = await recordTransaction(req.db, { ...req.body, created_by: req.user.userId });
        return rep.code(201).send(txn);
      } catch (err) {
        return rep.code(400).send({ error: err.message });
      }
    }
  );
  app.post('/transfer', { preHandler: authorize('create'), schema: transferSchema },
    async (req, rep) => {
      try {
        return rep.code(201).send(await transferStock(req.db, { ...req.body, created_by: req.user.userId }));
      } catch (err) {
        return rep.code(400).send({ error: err.message });
      }
    }
  );
}
