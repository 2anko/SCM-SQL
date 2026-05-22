// Fastify application factory. Used both by the dev entry (server.js) and the
// Electron main process when bootstrapping the packaged app. NO side effects
// at import time — config arrives via createApp(config).

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';

import { db, initDb, closeDb } from './config/db.js';
import { getUserByEmail } from './queries/users.js';

// Routes
import itemRoutes            from './routes/items.js';
import warehouseRoutes       from './routes/warehouses.js';
import supplierRoutes        from './routes/suppliers.js';
import customerRoutes        from './routes/customers.js';
import inventoryRoutes       from './routes/inventory.js';
import poRoutes              from './routes/purchaseOrders.js';
import soRoutes              from './routes/salesOrders.js';
import userRoutes            from './routes/users.js';
import supplierFactoryRoutes from './routes/supplierFactories.js';
import supplierItemRoutes    from './routes/supplierItems.js';
import customerItemRoutes    from './routes/customerItems.js';
import setupRoutes           from './routes/setup.js';

/**
 * Build a configured Fastify app. Does NOT start listening.
 *
 * @param {{
 *   db: { host, port, database, user, password } | { connectionString },
 *   jwtSecret: string,
 *   logger?: boolean,
 * }} config
 */
export function createApp(config) {
  if (!config?.db)         throw new Error('createApp: config.db is required');
  if (!config?.jwtSecret)  throw new Error('createApp: config.jwtSecret is required');

  initDb(config.db);

  const app = Fastify({ logger: config.logger ?? true });

  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.register(jwt, { secret: config.jwtSecret });

  // Auth gate — bypass for login and the unauthenticated setup endpoints.
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/auth/login')        return;
    if (request.url.startsWith('/setup/'))    return;

    try {
      await request.jwtVerify();
      request.db = db;
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

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
    const token = app.jwt.sign({ userId: user.id, role: user.role }, { expiresIn: '8h' });
    return { token, role: user.role };
  });

  app.register(setupRoutes,           { prefix: '/setup' });
  app.register(itemRoutes,            { prefix: '/items' });
  app.register(warehouseRoutes,       { prefix: '/warehouses' });
  app.register(supplierRoutes,        { prefix: '/suppliers' });
  app.register(supplierFactoryRoutes, { prefix: '/suppliers' });
  app.register(supplierItemRoutes,    { prefix: '/suppliers' });
  app.register(customerRoutes,        { prefix: '/customers' });
  app.register(customerItemRoutes,    { prefix: '/customers' });
  app.register(inventoryRoutes,       { prefix: '/inventory' });
  app.register(poRoutes,              { prefix: '/purchase-orders' });
  app.register(soRoutes,              { prefix: '/sales-orders' });
  app.register(userRoutes,            { prefix: '/users' });

  return app;
}

/**
 * Build, start, and return the listening Fastify app.
 * @param {object} config see createApp
 * @param {{ port?: number, host?: string }} listen
 */
export async function startServer(config, { port = 3000, host = '127.0.0.1' } = {}) {
  const app = createApp(config);
  await app.listen({ port, host });
  return app;
}

export { closeDb };
