import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { pool } from './pool.js';

const sqlDir = join(dirname(fileURLToPath(import.meta.url)), '../../sql');

/** Name under which the baseline schema (sql/init.sql) is recorded. */
export const BASELINE = '0000_baseline';

/** Arbitrary constant: serialises concurrent migration runs (e.g. several containers starting). */
const LOCK_ID = 727_001;

export interface MigrationResult {
  baseline: 'applied' | 'adopted' | 'present';
  applied: string[];
}

/** Versioned migration files: sql/migrations/NNNN_description.sql, applied in name order. */
export function listMigrationFiles(dir = join(sqlDir, 'migrations')): string[] {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
}

/**
 * Brings the database schema up to date.
 *
 *  1. `sql/init.sql` is the baseline. It is executed only on an empty database;
 *     a database that already has the schema (e.g. created by the Docker
 *     entrypoint) simply has the baseline recorded.
 *  2. Every file in `sql/migrations/` that has not been applied yet is run in its
 *     own transaction and recorded in `schema_migrations`.
 *
 * Safe to run repeatedly. A failing migration is rolled back and aborts the run.
 */
export async function runMigrations(
  db: Pick<pg.Pool, 'connect'> = pool,
  log: (message: string) => void = console.log,
): Promise<MigrationResult> {
  const client = await db.connect();
  const result: MigrationResult = { baseline: 'present', applied: [] };
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const done = new Set(
      (await client.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version),
    );

    if (!done.has(BASELINE)) {
      const { rows } = await client.query<{ present: boolean }>("SELECT to_regclass('public.places') IS NOT NULL AS present");
      if (rows[0].present) {
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [BASELINE]);
        result.baseline = 'adopted';
        log('Baseline: schema already present, recorded');
      } else {
        await applyFile(client, join(sqlDir, 'init.sql'), BASELINE);
        result.baseline = 'applied';
        log('Baseline: applied sql/init.sql');
      }
    }

    for (const file of listMigrationFiles()) {
      const version = file.replace(/\.sql$/, '');
      if (done.has(version)) continue;
      await applyFile(client, join(sqlDir, 'migrations', file), version);
      result.applied.push(version);
      log(`Migration applied: ${version}`);
    }

    if (result.applied.length === 0 && result.baseline === 'present') log('Database is up to date');
    return result;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

async function applyFile(client: pg.PoolClient, path: string, version: string): Promise<void> {
  const sql = readFileSync(path, 'utf-8');
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw new Error(`Migration ${version} failed: ${(err as Error).message}`);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
