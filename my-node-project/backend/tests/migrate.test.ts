import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { BASELINE, listMigrationFiles, runMigrations } from '../src/db/migrate.js';
import { TEST_DATABASE_URL, adminDatabaseUrl, databaseName } from './helpers/testDb.js';

const dbName = `${databaseName()}_migrate`;
const url = new URL(TEST_DATABASE_URL);
url.pathname = `/${dbName}`;

let admin: pg.Client;
let pool: pg.Pool;
const quiet = () => undefined;

beforeAll(async () => {
  admin = new pg.Client({ connectionString: adminDatabaseUrl() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  pool = new pg.Pool({ connectionString: url.toString() });
});

afterAll(async () => {
  await pool.end();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.end();
});

describe('migrations', () => {
  it('applies the baseline on an empty database', async () => {
    const result = await runMigrations(pool, quiet);
    expect(result.baseline).toBe('applied');

    const { rows } = await pool.query("SELECT to_regclass('public.places') AS t, to_regclass('public.campus_paths') AS c");
    expect(rows[0].t).not.toBeNull();
    expect(rows[0].c).not.toBeNull();
    const versions = (await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map((r) => r.version);
    expect(versions).toContain(BASELINE);
    expect(versions).toEqual([BASELINE, ...listMigrationFiles().map((f) => f.replace(/\.sql$/, ''))]);
  });

  it('is idempotent', async () => {
    const result = await runMigrations(pool, quiet);
    expect(result).toEqual({ baseline: 'present', applied: [] });
  });

  it('adopts a database that already has the schema but no history', async () => {
    await pool.query('DROP TABLE schema_migrations');
    const result = await runMigrations(pool, quiet);
    expect(result.baseline).toBe('adopted');
  });
});
