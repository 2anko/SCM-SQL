import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';

import { db, closeDb } from './config/db.js';
import { getUserByEmail } from './queries/users.js';

// Routes
import itemRoutes              from './routes/items.js';
import warehouseRoutes         from './routes/warehouses.js';
import supplierRoutes          from './routes/suppliers.js';
import customerRoutes          from './routes/customers.js';
import inventoryRoutes         from './routes/inventory.js';
import poRoutes                from './routes/purchaseOrders.js';
import soRoutes                from './routes/salesOrders.js';
import userRoutes              from './routes/users.js';
import supplierFactoryRoutes   from './routes/supplierFactories.js';

const app = Fastify({ logger: true });

// ── CORS ──────────────────────────────────────────────────────────────────────
await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ── Auth ──────────────────────────────────────────────────────────────────────
app.register(jwt, { secret: process.env.JWT_SECRET });

app.addHook('onRequest', async (request, reply) => {
  if (request.url === '/auth/login') return;

  try {
    await request.jwtVerify();
    request.db = db;
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// ── Auth route ────────────────────────────────────────────────────────────────
// Body: { email, password }
app.post('/auth/login', {
  schema: {
    body: {
      type: 'object',
      required: ['email', 'password'],
      additionalProperties: false,
      properties: {
        email:    { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 1 },
      },
    },
  },
}, async (request, reply) => {
  const { email, password } = request.body;

  const user = await getUserByEmail(db, email);
  if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return reply.code(401).send({ error: 'Invalid credentials' });

  const token = app.jwt.sign(
    { userId: user.id, role: user.role },
    { expiresIn: '8h' }
  );
  return { token, role: user.role };
});

// ── Domain routes ─────────────────────────────────────────────────────────────
app.register(itemRoutes,            { prefix: '/items' });
app.register(warehouseRoutes,       { prefix: '/warehouses' });
app.register(supplierRoutes,        { prefix: '/suppliers' });
app.register(supplierFactoryRoutes, { prefix: '/suppliers' });
app.register(customerRoutes,        { prefix: '/customers' });
app.register(inventoryRoutes,       { prefix: '/inventory' });
app.register(poRoutes,              { prefix: '/purchase-orders' });
app.register(soRoutes,              { prefix: '/sales-orders' });
app.register(userRoutes,            { prefix: '/users' });

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async () => {
  await closeDb();
  await app.close();
  process.exit(0);
};
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

// ── Start ─────────────────────────────────────────────────────────────────────
try {
  await app.listen({ port: process.env.PORT ?? 3000, host: '127.0.0.1' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
