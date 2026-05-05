// routes/items.js
import { getAllItems, getItemById, createItem, updateItem, deleteItem } from '../queries/items.js';
import { authorize } from '../middleware/authorize.js';

export default async function itemRoutes(app) {
  app.get('/',      { preHandler: authorize('read') },
    async (req) => getAllItems(req.db)
  );
  app.get('/:id',   { preHandler: authorize('read') },
    async (req, rep) => {
      const item = await getItemById(req.db, req.params.id);
      return item ?? rep.code(404).send({ error: 'Item not found' });
    }
  );
  app.post('/',     { preHandler: authorize('create') },
    async (req, rep) => rep.code(201).send(await createItem(req.db, req.body))
  );
  app.patch('/:id', { preHandler: authorize('write') },
    async (req, rep) => {
      const item = await updateItem(req.db, req.params.id, req.body);
      return item ?? rep.code(404).send({ error: 'Item not found' });
    }
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
