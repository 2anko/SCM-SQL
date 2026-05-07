import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to your .env file.');
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Set search_path so all queries find the scm schema without prefixing
db.on('connect', (client) => {
  client.query('SET search_path TO scm, public');
});

export async function closeDb() {
  await db.end();
}
