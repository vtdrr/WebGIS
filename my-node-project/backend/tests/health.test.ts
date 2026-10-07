import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app.js';
import { pool } from '../src/db/pool.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('health', () => {
  it('liveness answers without touching the database', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('readiness reports the database as up', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', database: 'up' });
  });
});

describe('conditional requests (ETag)', () => {
  it('adds an ETag and revalidation header to JSON GETs', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/places/geojson' });
    expect(res.statusCode).toBe(200);
    expect(res.headers.etag).toMatch(/^W\/"/);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('answers 304 when If-None-Match matches', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/categories' });
    const second = await app.inject({
      method: 'GET', url: '/api/categories', headers: { 'if-none-match': first.headers.etag as string },
    });
    expect(second.statusCode).toBe(304);
    expect(second.body).toBe('');
  });

  it('returns the full body when the tag no longer matches', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories', headers: { 'if-none-match': 'W/"stale"' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThan(0);
  });
});
