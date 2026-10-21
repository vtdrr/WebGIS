import pg from 'pg';

const configuredUrl = process.env.E2E_DATABASE_URL;
if (!configuredUrl) {
  throw new Error('E2E_DATABASE_URL is required for the isolated E2E database on 127.0.0.1:5433.');
}

let target: URL;
try {
  target = new URL(configuredUrl);
} catch {
  throw new Error('E2E_DATABASE_URL must be a valid PostgreSQL URL.');
}

if (
  (target.protocol !== 'postgres:' && target.protocol !== 'postgresql:') ||
  target.hostname !== '127.0.0.1' ||
  target.port !== '5433' ||
  decodeURIComponent(target.pathname.slice(1)) !== 'phenikaa_gis_e2e'
) {
  throw new Error('Refusing E2E database setup: expected 127.0.0.1:5433/phenikaa_gis_e2e on the isolated test service.');
}

const maintenanceUrl = new URL(target);
maintenanceUrl.pathname = '/postgres';
const client = new pg.Client({ connectionString: maintenanceUrl.toString(), ssl: false });

try {
  await client.connect();
  const current = await client.query<{ database: string }>('SELECT current_database() AS database');
  if (current.rows[0]?.database !== 'postgres') {
    throw new Error('Refusing E2E database setup: maintenance connection is not the postgres database.');
  }

  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', ['phenikaa_gis_e2e']);
  if (existing.rowCount === 0) {
    await client.query('CREATE DATABASE phenikaa_gis_e2e');
    console.log('Created isolated E2E database phenikaa_gis_e2e.');
  } else {
    console.log('Isolated E2E database phenikaa_gis_e2e already exists.');
  }
} catch (error) {
  if (error instanceof Error && 'code' in error) {
    throw new Error(`Could not verify/create the isolated E2E database (PostgreSQL code ${(error as { code: string }).code}).`);
  }
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
