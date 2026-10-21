// The test DB must use the dedicated local PostGIS test service, never the dev port.
const configuredTestUrl = process.env.TEST_DATABASE_URL;
if (!configuredTestUrl) {
  throw new Error('TEST_DATABASE_URL is required. Configure it for the isolated PostGIS test service on 127.0.0.1:5433.');
}

let parsedTestUrl: URL;
try {
  parsedTestUrl = new URL(configuredTestUrl);
} catch {
  throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL for the isolated test service.');
}

if (
  parsedTestUrl.protocol !== 'postgres:' && parsedTestUrl.protocol !== 'postgresql:' ||
  parsedTestUrl.hostname !== '127.0.0.1' ||
  parsedTestUrl.port !== '5433' ||
  decodeURIComponent(parsedTestUrl.pathname.slice(1)) !== 'phenikaa_gis_test'
) {
  throw new Error('Refusing TEST_DATABASE_URL: expected 127.0.0.1:5433/phenikaa_gis_test on the isolated test service.');
}

export const TEST_DATABASE_URL = parsedTestUrl.toString();

/** Same server, but the maintenance database (used to create/drop the test DB). */
export function adminDatabaseUrl(url = TEST_DATABASE_URL): string {
  const u = new URL(url);
  u.pathname = '/postgres';
  return u.toString();
}

export function databaseName(url = TEST_DATABASE_URL): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}
