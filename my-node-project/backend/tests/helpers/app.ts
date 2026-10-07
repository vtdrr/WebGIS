import type { FastifyInstance } from 'fastify';

/** Build a fresh Fastify app (config is read from the environment set in vitest.config.ts). */
export async function createTestApp(): Promise<FastifyInstance> {
  const { buildApp } = await import('../../src/app.js');
  const app = await buildApp();
  await app.ready();
  return app;
}
