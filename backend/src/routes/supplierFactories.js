// routes/supplierFactories.js — nested under /suppliers/:supplierId/factories
import {
  getFactoriesBySupplier,
  getFactoryById,
  createFactory,
  updateFactory,
  deactivateFactory,
  upsertFactoryRep,
  deleteFactoryRep,
} from '../queries/supplierFactories.js';
import { authorize } from '../middleware/authorize.js';

export default async function supplierFactoryRoutes(app) {
  // GET /suppliers/:supplierId/factories
  app.get('/:supplierId/factories', { preHandler: authorize('read') },
    async (req) => getFactoriesBySupplier(req.db, req.params.supplierId)
  );

  // GET /suppliers/:supplierId/factories/:factoryId
  app.get('/:supplierId/factories/:factoryId', { preHandler: authorize('read') },
    async (req, rep) => {
      const factory = await getFactoryById(req.db, req.params.factoryId);
      return factory ?? rep.code(404).send({ error: 'Factory not found' });
    }
  );

  // POST /suppliers/:supplierId/factories
  // Body: { name, address, country, rep?: { name, email, phone } }
  app.post('/:supplierId/factories', { preHandler: authorize('create') },
    async (req, rep) => {
      const factory = await createFactory(req.db, req.params.supplierId, req.body);
      return rep.code(201).send(factory);
    }
  );

  // PATCH /suppliers/:supplierId/factories/:factoryId
  app.patch('/:supplierId/factories/:factoryId', { preHandler: authorize('write') },
    async (req, rep) => {
      const factory = await updateFactory(req.db, req.params.factoryId, req.body);
      return factory ?? rep.code(404).send({ error: 'Factory not found' });
    }
  );

  // DELETE /suppliers/:supplierId/factories/:factoryId
  app.delete('/:supplierId/factories/:factoryId', { preHandler: authorize('delete') },
    async (req, rep) => {
      try {
        const result = await deactivateFactory(req.db, req.params.factoryId);
        return result ? { success: true } : rep.code(404).send({ error: 'Factory not found' });
      } catch (err) {
        return rep.code(409).send({ error: err.message });
      }
    }
  );

  // PUT /suppliers/:supplierId/factories/:factoryId/rep
  app.put('/:supplierId/factories/:factoryId/rep', { preHandler: authorize('write') },
    async (req, rep) => {
      const factory = await getFactoryById(req.db, req.params.factoryId);
      if (!factory) return rep.code(404).send({ error: 'Factory not found' });
      const repRow = await upsertFactoryRep(req.db, req.params.factoryId, req.body);
      return repRow;
    }
  );

  // DELETE /suppliers/:supplierId/factories/:factoryId/rep
  app.delete('/:supplierId/factories/:factoryId/rep', { preHandler: authorize('delete') },
    async (req, rep) => {
      const result = await deleteFactoryRep(req.db, req.params.factoryId);
      return result ? { success: true } : rep.code(404).send({ error: 'Rep not found' });
    }
  );
}
