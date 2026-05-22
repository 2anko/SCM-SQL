// Unauthenticated setup endpoints — used by the first-run wizard.
//
// The auth onRequest hook in app.js explicitly skips `/setup/*` so these are
// reachable without a token. They're safe because:
//   - test-connection takes a config but neither stores nor uses the user table
//   - needs-first-user is a count, no PII
//   - first-user only succeeds when the users table is empty; on a second
//     attempt it returns 409. Pair with not exposing /setup once configured.

import bcrypt from 'bcryptjs';
import { db, testConnection } from '../config/db.js';

const dbConfigSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    host:             { type: 'string', minLength: 1 },
    port:             { type: 'integer', minimum: 1, maximum: 65535 },
    database:         { type: 'string', minLength: 1 },
    user:             { type: 'string', minLength: 1 },
    password:         { type: 'string' },
    connectionString: { type: 'string', minLength: 1 },
  },
};

const firstUserSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
      email:    { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
    },
  },
};

export default async function setupRoutes(app) {
  app.post('/test-connection', { schema: { body: dbConfigSchema } },
    async (req, rep) => {
      try {
        await testConnection(req.body);
        return { ok: true };
      } catch (err) {
        return rep.code(400).send({ ok: false, error: err.message });
      }
    }
  );

  app.get('/needs-first-user', async () => {
    const { rows: [{ count }] } = await db.query('SELECT COUNT(*)::int AS count FROM users');
    return { needed: count === 0 };
  });

  app.post('/first-user', { schema: firstUserSchema },
    async (req, rep) => {
      const { rows: [{ count }] } = await db.query('SELECT COUNT(*)::int AS count FROM users');
      if (count > 0) {
        return rep.code(409).send({ error: 'Setup already complete — a user account exists.' });
      }
      const { email, password } = req.body;
      const password_hash = await bcrypt.hash(password, 12);
      const { rows: [user] } = await db.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'it_service')
         RETURNING id, email, role`,
        [email, password_hash]
      );
      return rep.code(201).send(user);
    }
  );
}
