// routes/customerItems.js — nested under /customers/:customerId/items
import {
  getItemsByCustomer,
  upsertCustomerItem,
  deleteCustomerItem,
} from '../queries/customerItems.js';
import { authorize } from '../middleware/authorize.js';

const upsertSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      unit_price:   { type: 'number', minimum: 0 },
      customer_sku: { type: ['string', 'null'] },
      notes:        { type: ['string', 'null'] },
    },
  },
};

export default async function customerItemRoutes(app) {
  app.get('/:customerId/items', { preHandler: authorize('read') },
    async (req) => getItemsByCustomer(req.db, req.params.customerId)
  );

  app.put('/:customerId/items/:itemId', { preHandler: authorize('create'), schema: upsertSchema },
    async (req, rep) => {
      try {
        return await upsertCustomerItem(
          req.db,
          req.params.customerId,
          req.params.itemId,
          req.body,
        );
      } catch (err) {
        return rep.code(400).send({ error: err.message });
      }
    }
  );

  app.delete('/:customerId/items/:itemId', { preHandler: authorize('delete') },
    async (req, rep) => {
      const ok = await deleteCustomerItem(req.db, req.params.customerId, req.params.itemId);
      return ok ? { success: true } : rep.code(404).send({ error: 'Not found' });
    }
  );
}
