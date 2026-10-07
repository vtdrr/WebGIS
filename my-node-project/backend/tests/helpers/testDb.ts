// Connection settings for the dedicated test database.
// Override with TEST_DATABASE_URL (e.g. in CI).
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/phenikaa_gis_test';

/** Same server, but the maintenance database (used to create/drop the test DB). */
export function adminDatabaseUrl(url = TEST_DATABASE_URL): string {
  const u = new URL(url);
  u.pathname = '/postgres';
  return u.toString();
}

export function databaseName(url = TEST_DATABASE_URL): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}
