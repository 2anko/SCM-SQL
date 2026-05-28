// Applies pending SQL migrations on app startup.
//
// Behaviour:
//   1. Ensure `schema_migrations` exists.
//   2. List sql/migrations/*.sql sorted by filename.
//   3. ADOPTION: if schema_migrations is empty BUT the DB already has
//      `scm.users` (the canonical SCM table created in migration 005),
//      assume this DB was populated by a prior install that pre-dates the
//      tracking table. Record every known migration as already-applied
//      without re-running it — otherwise we'd hit "relation already
//      exists" errors trying to re-create populated tables.
//   4. Apply any migrations not yet recorded, each in its own transaction.
//
// The adoption step makes the runner safe for "new client, existing
// database" deployments — e.g. installing SCM on a fresh laptop and
// pointing it at the company's long-running Postgres.

import fs from 'fs/promises';
import path from 'path';

const TRACKING_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/**
 * @param {import('pg').Pool} db   pg Pool (must support .connect() + .query())
 * @param {string}            dir  absolute path to sql/migrations/
 * @returns {Promise<{ applied: string[], adopted: string[] }>}
 *   applied — files actually executed against the DB this run
 *   adopted — files recorded as already-done (existing-DB adoption path)
 */
export async function runPendingMigrations(db, dir) {
  await db.query(TRACKING_TABLE_SQL);

  const { rows: appliedRows } = await db.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(appliedRows.map(r => r.filename));

  let files;
  try {
    files = (await fs.readdir(dir)).filter(f => f.endsWith('.sql')).sort();
  } catch (err) {
    throw new Error(`Migrations directory not found: ${dir} (${err.message})`);
  }

  // Adoption path: empty tracking table + populated SCM schema.
  if (appliedSet.size === 0 && files.length > 0) {
    const { rows: [check] } = await db.query(
      `SELECT to_regclass('scm.users') AS reg`
    );
    if (check?.reg) {
      for (const file of files) {
        await db.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
          [file]
        );
      }
      return { applied: [], adopted: files };
    }
  }

  // Normal path: run each unapplied migration in its own transaction.
  const newlyApplied = [];
  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = await fs.readFile(path.join(dir, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      newlyApplied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
  return { applied: newlyApplied, adopted: [] };
}
