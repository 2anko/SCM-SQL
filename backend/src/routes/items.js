// routes/items.js
import { getAllItems, getItemById, createItem, updateItem, deleteItem } from '../queries/items.js';
import { getSuppliersByItem } from '../queries/supplierItems.js';
import { getCustomersByItem } from '../queries/customerItems.js';
import { authorize } from '../middleware/authorize.js';
import { parsePagination } from '../helpers/pagination.js';

const createSchema = {
  body: {
    type: 'object',
    required: ['sku', 'name'],
    additionalProperties: false,
    properties: {
      sku:             { type: 'string', minLength: 1 },
      name:            { type: 'string', minLength: 1 },
      description:     { type: 'string' },
      unit_of_measure: { type: 'string' },
      value:           { type: 'number', minimum: 0 },
    },
  },
};

const updateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name:            { type: 'string', minLength: 1 },
      description:     { type: 'string' },
      unit_of_measure: { type: 'string' },
      value:           { type: 'number', minimum: 0 },
    },
  },
};

export default async function itemRoutes(app) {
  app.get('/',      { preHandler: authorize('read') },
    async (req) => getAllItems(req.db, parsePagination(req.query))
  );
  app.get('/:id',   { preHandler: authorize('read') },
    async (req, rep) => {
      const item = await getItemById(req.db, req.params.id);
      return item ?? rep.code(404).send({ error: 'Item not found' });
    }
  );
  app.post('/',     { preHandler: authorize('create'), schema: createSchema },
    async (req, rep) => rep.code(201).send(await createItem(req.db, req.body))
  );
  app.patch('/:id', { preHandler: authorize('write'), schema: updateSchema },
    async (req, rep) => {
      const item = await updateItem(req.db, req.params.id, req.body);
      return item ?? rep.code(404).send({ error: 'Item not found' });
    }
  );
  app.get('/:id/suppliers', { preHandler: authorize('read') },
    async (req) => getSuppliersByItem(req.db, req.params.id)
  );
  app.get('/:id/customers', { preHandler: authorize('read') },
    async (req) => getCustomersByItem(req.db, req.params.id)
  );
  app.delete('/:id', { preHandler: authorize('delete') },
    async (req, rep) => {
      try {
        const ok = await deleteItem(req.db, req.params.id);
        return ok ? { success: true } : rep.code(404).send({ error: 'Item not found' });
      } catch (err) {
        return rep.code(409).send({ error: err.message });
      }
    }
  );
}
