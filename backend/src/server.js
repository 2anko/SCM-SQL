// Dev/CLI entry point. Reads DATABASE_URL + JWT_SECRET from .env, runs any
// pending migrations, then starts the Fastify server. The packaged Electron
// app does NOT use this file — it imports createApp/startServer directly.

import 'dotenv/config';
import { startServer, closeDb } from './app.js';
import { db } from './config/db.js';
import { runPendingMigrations } from './migrations/runner.js';
import { fileURLToPath } from 'url';
import path from 'path';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add one to backend/.env (any long random string).');
  process.exit(1);
}

const config = {
  db:        { connectionString: process.env.DATABASE_URL },
  jwtSecret: process.env.JWT_SECRET,
};

const port = Number(process.env.PORT) || 3000;

// Resolve sql/migrations relative to this file so it works regardless of cwd.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../sql/migrations');

try {
  const app = await startServer(config, { port });

  // Run migrations using the same pool the app uses.
  const applied = await runPendingMigrations(db, migrationsDir);
  if (applied.length > 0) {
    app.log.info(`Applied ${applied.length} migration${applied.length === 1 ? '' : 's'}: ${applied.join(', ')}`);
  }

  const shutdown = async () => {
    await closeDb();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
} catch (err) {
  console.error(err);
  process.exit(1);
}
