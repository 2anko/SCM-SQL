// Applies pending SQL migrations on app startup.
//
// Behaviour:
//   1. Ensure `schema_migrations` exists (creates it on first run).
//   2. List sql/migrations/*.sql sorted by filename.
//   3. For each file not yet recorded, run it inside a transaction
//      and insert a row into schema_migrations.
//
// Migrations are pure SQL — anything node-pg can execute. Each file is one
// transaction; if it fails, NOTHING from that file is applied and the runner
// stops (don't try to skip past a broken migration).

import fs from 'fs/promises';
import path from 'path';

const TRACKING_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/**
 * @param {import('pg').Pool} db   pg Pool or compatible (must support .connect() + .query())
 * @param {string}            dir  absolute path to the directory containing .sql files
 * @returns {Promise<string[]>}    filenames of migrations applied in this run
 */
export async function runPendingMigrations(db, dir) {
  // The tracking table lives in the default search_path (scm). That's fine —
  // it's created once and never touched by user code.
  await db.query(TRACKING_TABLE_SQL);

  const { rows: applied } = await db.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.filename));

  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    throw new Error(`Migrations directory not found: ${dir} (${err.message})`);
  }
  const files = entries.filter(f => f.endsWith('.sql')).sort();

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
  return newlyApplied;
}
