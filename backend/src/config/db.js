// Database pool — lazily initialised so the connection config can come from
// either dotenv (dev) or the Electron-saved user config (packaged app).
//
// Call initDb(config) once before any query runs. `db` is a Proxy that
// forwards to the active pool, so existing imports keep working.

import pg from 'pg';
const { Pool } = pg;

let pool = null;

/**
 * Initialise (or replace) the global pool from a connection config.
 * Accepts either `{ connectionString }` or the discrete form
 * `{ host, port, database, user, password }`.
 *
 * Returns the pool so callers that want a direct reference can take one.
 */
export function initDb(config) {
  if (pool) {
    // Safety net for hot-reload during dev — drop the old pool before swapping.
    pool.end().catch(() => {});
  }
  pool = new Pool({
    ...config,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('connect', client => {
    client.query('SET search_path TO scm, public');
  });
  return pool;
}

/** True if initDb has been called. */
export function isDbReady() {
  return pool !== null;
}

/**
 * Probe a connection config without persisting it. Used by the setup wizard.
 * Resolves to true if a SELECT 1 succeeds, otherwise throws.
 */
export async function testConnection(config) {
  const probe = new Pool({ ...config, max: 1, connectionTimeoutMillis: 5000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } finally {
    await probe.end();
  }
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Proxy that forwards every call to the current pool. Lets existing route
 * code keep `import { db } from '../config/db.js'` without caring about
 * lifecycle timing.
 */
export const db = new Proxy({}, {
  get(_target, prop) {
    if (!pool) throw new Error('Database not initialised. Call initDb(config) first.');
    const value = pool[prop];
    return typeof value === 'function' ? value.bind(pool) : value;
  },
});
