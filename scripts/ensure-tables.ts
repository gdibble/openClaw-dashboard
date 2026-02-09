import { Client } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL || '';
const MIGRATIONS_DIR = join(__dirname, 'migrations');

// Track which migrations have been applied
const TRACKING_TABLE = `
CREATE TABLE IF NOT EXISTS _migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);`;

export async function ensureTables(client: Client): Promise<void> {
  if (!DATABASE_URL && !client) {
    console.log('No DATABASE_URL — skipping table setup');
    return;
  }

  // Create tracking table
  await client.query(TRACKING_TABLE);

  // Get already-applied migrations
  const applied = await client.query<{ name: string }>(
    'SELECT name FROM _migrations ORDER BY name'
  );
  const appliedSet = new Set(applied.rows.map(r => r.name));

  // Read migration files in order
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`Applying migration: ${file}`);

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations (name) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`  Applied: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`  Failed: ${file} — ${msg}`);
      throw err;
    }
  }
}

// Run standalone
if (require.main === module) {
  (async () => {
    if (!DATABASE_URL) {
      console.error('DATABASE_URL not set');
      process.exit(1);
    }
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      await ensureTables(client);
      console.log('All migrations applied');
    } finally {
      await client.end();
    }
  })().catch(err => {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
