/**
 * db.js — Multi-tenant Postgres connection manager
 *
 * Each company has their own Postgres database.
 * We keep one Pool per company in memory so we're not
 * opening a new connection on every request.
 *
 * In production, store connection strings encrypted in
 * your master DB and decrypt them here at login time.
 */

import pg from 'pg';
const { Pool } = pg;

// companyId -> Pool
const pools = new Map();

/**
 * Returns (or creates) a connection pool for the given company.
 * `connectionString` only needs to be passed the first time (at login).
 * After that, the pool is cached and reused.
 */
export async function getTenantDb(companyId, connectionString) {
  if (pools.has(companyId)) {
    return pools.get(companyId);
  }

  if (!connectionString) {
    throw new Error(`No DB pool found for company ${companyId}. Login first.`);
  }

  const pool = new Pool({
    connectionString,
    max: 10,                  // max connections per company
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Verify the connection works before caching
  await pool.query('SELECT 1');

  pools.set(companyId, pool);
  return pool;
}

/**
 * Close all pools — called on server shutdown.
 */
export async function closeTenantDb() {
  for (const [id, pool] of pools) {
    await pool.end();
    pools.delete(id);
  }
}
