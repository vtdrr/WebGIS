import { defineConfig, devices } from '@playwright/test';

const backendPort = process.env.PORT ?? '3000';
const e2eDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const e2eAdminKey = process.env.E2E_ADMIN_KEY;

function requireIsolatedE2EConfiguration(): void {
  const validateDatabaseUrl = (value: string | undefined, database: string, label: string) => {
    if (!value) throw new Error(`${label} is required; E2E must use the isolated PostGIS service.`);
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${label} must be a valid PostgreSQL URL for the isolated E2E service.`);
    }
    if (url.hostname !== '127.0.0.1' || url.port !== '5433' || decodeURIComponent(url.pathname.slice(1)) !== database) {
      throw new Error(`Refusing E2E: ${label} must target 127.0.0.1:5433/${database}.`);
    }
  };

  validateDatabaseUrl(e2eDatabaseUrl, 'phenikaa_gis_e2e', 'DATABASE_URL');
  validateDatabaseUrl(testDatabaseUrl, 'phenikaa_gis_test', 'TEST_DATABASE_URL');
  if (!e2eAdminKey || process.env.ADMIN_API_KEY !== e2eAdminKey) {
    throw new Error('E2E_ADMIN_KEY and ADMIN_API_KEY must both be set to the same test-only key.');
  }
  if (process.env.WEBGIS_API_PROXY_TARGET !== `http://127.0.0.1:${backendPort}`) {
    throw new Error(`WEBGIS_API_PROXY_TARGET must target the E2E backend at 127.0.0.1:${backendPort}.`);
  }
}

requireIsolatedE2EConfiguration();

// End-to-end tests run against the real backend and database:
//   docker compose up -d db && (cd ../backend && npm run db:migrate) && npm run e2e
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'vi-VN',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], locale: 'vi-VN' } }],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      url: `http://127.0.0.1:${backendPort}/health/ready`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
