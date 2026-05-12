// routes/salesOrders.js
import {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrder,
  updateSalesOrderStatus,
  shipSalesOrder,
} from '../queries/salesOrders.js';
import { authorize } from '../middleware/authorize.js';

const SO_STATUSES = ['DRAFT', 'CONFIRMED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const createSchema = {
  body: {
    type: 'object',
    required: ['customer_id', 'lines'],
    additionalProperties: false,
    properties: {
      customer_id:      { type: 'integer' },
      shipping_address: { type: 'string' },
      expected_date:    { type: 'string', format: 'date' },
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['item_id', 'quantity_ordered', 'unit_price'],
          additionalProperties: false,
          properties: {
            item_id:            { type: 'integer' },
            quantity_ordered:   { type: 'number', exclusiveMinimum: 0 },
            unit_price:         { type: 'number', minimum: 0 },
            source_warehouse_id: { type: 'integer' },
          },
        },
      },
    },
  },
};

const editSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      customer_id:      { type: 'integer' },
      shipping_address: { type: ['string', 'null'] },
      expected_date:    { type: ['string', 'null'], format: 'date' },
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['item_id', 'quantity_ordered', 'unit_price'],
          additionalProperties: false,
          properties: {
            item_id:             { type: 'integer' },
            quantity_ordered:    { type: 'number', exclusiveMinimum: 0 },
            unit_price:          { type: 'number', minimum: 0 },
            source_warehouse_id: { type: 'integer' },
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
      status: { type: 'string', enum: SO_STATUSES },
    },
  },
};

const listQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: SO_STATUSES },
    },
  },
};

export default async function soRoutes(app) {
  app.get('/', { preHandler: authorize('read'), schema: listQuerySchema },
    async (req) => getAllSalesOrders(req.db, { status: req.query.status })
  );
  app.get('/:id', { preHandler: authorize('read') },
    async (req, rep) => {
      const so = await getSalesOrderById(req.db, req.params.id);
      return so ?? rep.code(404).send({ error: 'Sales order not found' });
    }
  );
  app.post('/', { preHandler: authorize('create'), schema: createSchema },
    async (req, rep) => rep.code(201).send(await createSalesOrder(req.db, req.body))
  );
  app.patch('/:id', { preHandler: authorize('write'), schema: editSchema },
    async (req, rep) => {
      try {
        const so = await updateSalesOrder(req.db, req.params.id, req.body);
        return so ?? rep.code(404).send({ error: 'Sales order not found' });
      } catch (err) {
        return rep.code(400).send({ error: err.message });
      }
    }
  );
  app.patch('/:id/status', { preHandler: authorize('write'), schema: updateStatusSchema },
    async (req, rep) => {
      try {
        const so = await updateSalesOrderStatus(req.db, req.params.id, req.body.status);
        return so ?? rep.code(404).send({ error: 'Sales order not found' });
      } catch (err) {
        return rep.code(400).send({ error: err.message });
      }
    }
  );
  app.post('/:id/ship', { preHandler: authorize('write') },
    async (req, rep) => {
      try {
        const so = await shipSalesOrder(req.db, {
          id:         req.params.id,
          created_by: req.user.userId,
        });
        return so ?? rep.code(404).send({ error: 'Sales order not found' });
      } catch (err) {
        return rep.code(400).send({ error: err.message });
      }
    }
  );
}
