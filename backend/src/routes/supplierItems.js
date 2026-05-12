// routes/supplierItems.js — nested under /suppliers/:supplierId/items
import {
  getItemsBySupplier,
  upsertSupplierItem,
  deleteSupplierItem,
} from '../queries/supplierItems.js';
import { authorize } from '../middleware/authorize.js';

const upsertSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      unit_cost:      { type: 'number',  minimum: 0 },
      supplier_sku:   { type: ['string', 'null'] },
      lead_time_days: { type: ['integer', 'null'], minimum: 0 },
      is_preferred:   { type: 'boolean' },
      notes:          { type: ['string', 'null'] },
    },
  },
};

export default async function supplierItemRoutes(app) {
  app.get('/:supplierId/items', { preHandler: authorize('read') },
    async (req) => getItemsBySupplier(req.db, req.params.supplierId)
  );

  // Upsert: PUT replaces or creates; partial fields only update what's provided.
  // Requires 'create' permission since it may create rows; the route is open
  // to both employee (add) and section_manager (edit) flows.
  app.put('/:supplierId/items/:itemId', { preHandler: authorize('create'), schema: upsertSchema },
    async (req, rep) => {
      try {
        return await upsertSupplierItem(
          req.db,
          req.params.supplierId,
          req.params.itemId,
          req.body,
        );
      } catch (err) {
        return rep.code(400).send({ error: err.message });
      }
    }
  );

  app.delete('/:supplierId/items/:itemId', { preHandler: authorize('delete') },
    async (req, rep) => {
      const ok = await deleteSupplierItem(req.db, req.params.supplierId, req.params.itemId);
      return ok ? { success: true } : rep.code(404).send({ error: 'Not found' });
    }
  );
}
