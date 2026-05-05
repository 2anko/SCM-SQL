// routes/purchaseOrders.js
import {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrderLine,
} from '../queries/purchaseOrders.js';
import { authorize } from '../middleware/authorize.js';

const PO_STATUSES = ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

const createSchema = {
  body: {
    type: 'object',
    required: ['supplier_id', 'lines'],
    additionalProperties: false,
    properties: {
      supplier_id:   { type: 'integer' },
      factory_id:    { type: 'integer' },
      expected_date: { type: 'string', format: 'date' },
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['item_id', 'quantity_ordered', 'unit_cost'],
          additionalProperties: false,
          properties: {
            item_id:                 { type: 'integer' },
            quantity_ordered:        { type: 'number', exclusiveMinimum: 0 },
            unit_cost:               { type: 'number', minimum: 0 },
            destination_warehouse_id: { type: 'integer' },
          },
        },
      },
    },
  },
};

const updateStatusSchema = {
  body: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: PO_STATUSES },
    },
  },
};

const receiveSchema = {
  body: {
    type: 'object',
    required: ['line_id', 'quantity_received', 'warehouse_id'],
    additionalProperties: false,
    properties: {
      line_id:           { type: 'integer' },
      quantity_received: { type: 'number', exclusiveMinimum: 0 },
      warehouse_id:      { type: 'integer' },
    },
  },
};

const listQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: PO_STATUSES },
    },
  },
};

export default async function poRoutes(app) {
  app.get('/', { preHandler: authorize('read'), schema: listQuerySchema },
    async (req) => getAllPurchaseOrders(req.db, { status: req.query.status })
  );
  app.get('/:id', { preHandler: authorize('read') },
    async (req, rep) => {
      const po = await getPurchaseOrderById(req.db, req.params.id);
      return po ?? rep.code(404).send({ error: 'Purchase order not found' });
    }
  );
  app.post('/', { preHandler: authorize('create'), schema: createSchema },
    async (req, rep) => rep.code(201).send(await createPurchaseOrder(req.db, req.body))
  );
  app.patch('/:id/status', { preHandler: authorize('write'), schema: updateStatusSchema },
    async (req, rep) => {
      const po = await updatePurchaseOrderStatus(req.db, req.params.id, req.body.status);
      return po ?? rep.code(404).send({ error: 'Purchase order not found' });
    }
  );
  app.post('/:id/receive', { preHandler: authorize('write'), schema: receiveSchema },
    async (req, rep) => {
      try {
        return rep.code(201).send(await receivePurchaseOrderLine(req.db, {
          po_id: req.params.id,
          created_by: req.user.userId,
          ...req.body,
        }));
      } catch (err) {
        return rep.code(400).send({ error: err.message });
      }
    }
  );
}
