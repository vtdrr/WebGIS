import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { TEST_DATABASE_URL, adminDatabaseUrl, databaseName } from './helpers/testDb.js';

/**
 * Recreates the test database from sql/init.sql before the test run.
 * The sample places/paths from init.sql are removed so every test controls its own data.
 */
export default async function setup(): Promise<void> {
  const dbName = databaseName();
  if (!/^[\w]+$/.test(dbName) || !dbName.includes('test')) {
    throw new Error(`Refusing to reset database "${dbName}": the test database name must contain "test"`);
  }

  const admin = new pg.Client({ connectionString: adminDatabaseUrl() });
  try {
    await admin.connect();
  } catch (err) {
    throw new Error(
      `Cannot connect to PostgreSQL for tests (${(err as Error).message}). ` +
        'Start it with "docker compose up -d db" or set TEST_DATABASE_URL.',
    );
  }
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${dbName}`);
  } finally {
    await admin.end();
  }

  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    const initSql = readFileSync(fileURLToPath(new URL('../sql/init.sql', import.meta.url)), 'utf-8');
    await client.query(initSql);
    await client.query('TRUNCATE places, campus_paths RESTART IDENTITY CASCADE');
  } finally {
    await client.end();
  }
}
