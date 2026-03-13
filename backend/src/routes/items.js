// routes/items.js
import { getAllItems, getItemById, createItem, updateItem, deleteItem } from '../queries/items.js';

export default async function itemRoutes(app) {
  app.get('/',       async (req)       => getAllItems(req.db));
  app.get('/:id',    async (req, rep)  => {
    const item = await getItemById(req.db, req.params.id);
    return item ?? rep.code(404).send({ error: 'Item not found' });
  });
  app.post('/',      async (req, rep)  => { return rep.code(201).send(await createItem(req.db, req.body)); });
  app.patch('/:id',  async (req, rep)  => {
    const item = await updateItem(req.db, req.params.id, req.body);
    return item ?? rep.code(404).send({ error: 'Item not found' });
  });
  app.delete('/:id', async (req, rep)  => {
    const ok = await deleteItem(req.db, req.params.id);
    return ok ? { success: true } : rep.code(404).send({ error: 'Item not found' });
  });
}
