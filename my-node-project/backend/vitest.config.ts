import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/helpers/testDb.js';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // All tests share one database, so run test files one at a time
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      DB_SSL: 'false',
      SWAGGER_ENABLED: 'false',
      RATE_LIMIT_MAX: '1000000',
    },
  },
});
