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

const createSchema = {
  body: {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
      name:    { type: 'string', minLength: 1 },
      address: { type: 'string' },
      country: { type: 'string' },
      rep: {
        type: 'object',
        required: ['name'],
        additionalProperties: false,
        properties: {
          name:  { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
        },
      },
    },
  },
};

const updateSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name:    { type: 'string', minLength: 1 },
      address: { type: 'string' },
      country: { type: 'string' },
    },
  },
};

const repSchema = {
  body: {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
      name:  { type: 'string', minLength: 1 },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
    },
  },
};

export default async function supplierFactoryRoutes(app) {
  app.get('/:supplierId/factories', { preHandler: authorize('read') },
    async (req) => getFactoriesBySupplier(req.db, req.params.supplierId)
  );
  app.get('/:supplierId/factories/:factoryId', { preHandler: authorize('read') },
    async (req, rep) => {
      const factory = await getFactoryById(req.db, req.params.factoryId);
      return factory ?? rep.code(404).send({ error: 'Factory not found' });
    }
  );
  app.post('/:supplierId/factories', { preHandler: authorize('create'), schema: createSchema },
    async (req, rep) => {
      const factory = await createFactory(req.db, req.params.supplierId, req.body);
      return rep.code(201).send(factory);
    }
  );
  app.patch('/:supplierId/factories/:factoryId', { preHandler: authorize('write'), schema: updateSchema },
    async (req, rep) => {
      const factory = await updateFactory(req.db, req.params.factoryId, req.body);
      return factory ?? rep.code(404).send({ error: 'Factory not found' });
    }
  );
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
  app.put('/:supplierId/factories/:factoryId/rep', { preHandler: authorize('write'), schema: repSchema },
    async (req, rep) => {
      const factory = await getFactoryById(req.db, req.params.factoryId);
      if (!factory) return rep.code(404).send({ error: 'Factory not found' });
      return upsertFactoryRep(req.db, req.params.factoryId, req.body);
    }
  );
  app.delete('/:supplierId/factories/:factoryId/rep', { preHandler: authorize('delete') },
    async (req, rep) => {
      const result = await deleteFactoryRep(req.db, req.params.factoryId);
      return result ? { success: true } : rep.code(404).send({ error: 'Rep not found' });
    }
  );
}
