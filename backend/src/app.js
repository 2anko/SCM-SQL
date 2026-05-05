import 'dotenv/config';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';

import { getTenantDb, closeTenantDb } from './config/db.js';
import { getUserByEmail } from './queries/users.js';

// Routes
import itemRoutes       from './routes/items.js';
import warehouseRoutes  from './routes/warehouses.js';
import supplierRoutes   from './routes/suppliers.js';
import customerRoutes   from './routes/customers.js';
import inventoryRoutes  from './routes/inventory.js';
import poRoutes         from './routes/purchaseOrders.js';
import soRoutes         from './routes/salesOrders.js';
import userRoutes             from './routes/users.js';
import supplierFactoryRoutes  from './routes/supplierFactories.js';

const app = Fastify({ logger: true });

// ── Auth ──────────────────────────────────────────────────────────────────────
app.register(jwt, { secret: process.env.JWT_SECRET });

app.addHook('onRequest', async (request, reply) => {
  if (request.url === '/auth/login') return;

  try {
    await request.jwtVerify();
    request.db = await getTenantDb(request.user.companyId);
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// ── Auth route ────────────────────────────────────────────────────────────────
// Body: { companyId, connectionString, email, password }
// connectionString only required on first login (used to init the DB pool).
app.post('/auth/login', async (request, reply) => {
  const { companyId, connectionString, email, password } = request.body ?? {};

  if (!companyId || !email || !password) {
    return reply.code(400).send({ error: 'companyId, email and password are required' });
  }

  let db;
  try {
    db = await getTenantDb(companyId, connectionString);
  } catch {
    return reply.code(400).send({ error: 'Could not connect to company database. Provide a valid connectionString.' });
  }

  const user = await getUserByEmail(db, email);
  if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) return reply.code(401).send({ error: 'Invalid credentials' });

  const token = app.jwt.sign(
    { companyId, userId: user.id, role: user.role },
    { expiresIn: '8h' }
  );
  return { token, role: user.role };
});

// ── Domain routes ─────────────────────────────────────────────────────────────
app.register(itemRoutes,      { prefix: '/items' });
app.register(warehouseRoutes, { prefix: '/warehouses' });
app.register(supplierRoutes,  { prefix: '/suppliers' });
app.register(customerRoutes,  { prefix: '/customers' });
app.register(inventoryRoutes, { prefix: '/inventory' });
app.register(poRoutes,        { prefix: '/purchase-orders' });
app.register(soRoutes,        { prefix: '/sales-orders' });
app.register(userRoutes,             { prefix: '/users' });
app.register(supplierFactoryRoutes,  { prefix: '/suppliers' });

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
