import 'dotenv/config';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';

import { getTenantDb, closeTenantDb } from './config/db.js';

// Routes
import itemRoutes       from './routes/items.js';
import warehouseRoutes  from './routes/warehouses.js';
import supplierRoutes   from './routes/suppliers.js';
import customerRoutes   from './routes/customers.js';
import inventoryRoutes  from './routes/inventory.js';
import poRoutes         from './routes/purchaseOrders.js';
import soRoutes         from './routes/salesOrders.js';

const app = Fastify({ logger: true });

// ── Auth ──────────────────────────────────────────────────────────────────────
app.register(jwt, { secret: process.env.JWT_SECRET });

// Decorate every request with a .db pool scoped to the authenticated company.
// Routes call `await request.db.query(...)` directly — no tenant ID juggling.
app.addHook('onRequest', async (request, reply) => {
  // Skip auth for the login route
  if (request.url === '/auth/login') return;

  try {
    await request.jwtVerify();
    request.db = await getTenantDb(request.user.companyId);
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// ── Auth route (login returns a JWT) ─────────────────────────────────────────
// In production you'd validate against your master DB here.
app.post('/auth/login', async (request, reply) => {
  const { companyId, apiKey } = request.body;

  // TODO: look up companyId in master DB, verify apiKey (hashed)
  // For now, a placeholder:
  if (!companyId || !apiKey) {
    return reply.code(400).send({ error: 'companyId and apiKey are required' });
  }

  const token = app.jwt.sign({ companyId }, { expiresIn: '8h' });
  return { token };
});

// ── Domain routes ─────────────────────────────────────────────────────────────
app.register(itemRoutes,      { prefix: '/items' });
app.register(warehouseRoutes, { prefix: '/warehouses' });
app.register(supplierRoutes,  { prefix: '/suppliers' });
app.register(customerRoutes,  { prefix: '/customers' });
app.register(inventoryRoutes, { prefix: '/inventory' });
app.register(poRoutes,        { prefix: '/purchase-orders' });
app.register(soRoutes,        { prefix: '/sales-orders' });

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async () => {
  await closeTenantDb();
  await app.close();
  process.exit(0);
};
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

// ── Start ─────────────────────────────────────────────────────────────────────
try {
  await app.listen({ port: process.env.PORT ?? 3000, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
