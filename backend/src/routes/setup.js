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

// Roles that can administer the system (manage users). If at least one ACTIVE
// account with one of these roles exists, the database is considered "already
// administered" — a new client connecting to it should go straight to login
// rather than bootstrap another admin.
const ADMIN_ROLES = ['dev', 'it_service'];

async function activeAdminCount(database) {
  const { rows: [{ count }] } = await database.query(
    `SELECT COUNT(*)::int AS count FROM users
      WHERE role = ANY($1) AND is_active = true`,
    [ADMIN_ROLES]
  );
  return count;
}

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

  // "needed" means: no active admin-capable account exists, so the setup
  // wizard should prompt to create one. If the DB already has a dev/it_service
  // account (e.g. an existing company database), this returns false and the
  // app routes straight to login.
  app.get('/needs-first-user', async () => {
    return { needed: (await activeAdminCount(db)) === 0 };
  });

  app.post('/first-user', { schema: firstUserSchema },
    async (req, rep) => {
      if ((await activeAdminCount(db)) > 0) {
        return rep.code(409).send({ error: 'An administrator account already exists. Sign in instead.' });
      }
      const { email, password } = req.body;
      const password_hash = await bcrypt.hash(password, 12);
      try {
        const { rows: [user] } = await db.query(
          `INSERT INTO users (email, password_hash, role)
           VALUES ($1, $2, 'dev')
           RETURNING id, email, role`,
          [email, password_hash]
        );
        return rep.code(201).send(user);
      } catch (err) {
        if (err.code === '23505') {
          return rep.code(409).send({ error: 'A user with that email already exists.' });
        }
        throw err;
      }
    }
  );
}
