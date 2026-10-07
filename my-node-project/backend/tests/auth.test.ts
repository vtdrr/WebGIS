import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Must be set before the app (and its config) is imported
vi.hoisted(() => {
  process.env.ADMIN_API_KEY = 'test-secret';
});

import { createTestApp } from './helpers/app.js';
import { pool } from '../src/db/pool.js';

let app: FastifyInstance;
let categoryId: number;

beforeAll(async () => {
  app = await createTestApp();
  const { rows } = await pool.query("SELECT id FROM categories WHERE code = 'building'");
  categoryId = rows[0].id;
  await pool.query('TRUNCATE places, campus_paths RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

const body = () => ({ category_id: categoryId, code: `AUTH-${Math.random().toString(36).slice(2, 8)}`, name_vi: 'Test' });

describe('admin API key', () => {
  it('leaves read endpoints public', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/places' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/categories' })).statusCode).toBe(200);
  });

  it('rejects writes without a key', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/places', payload: body() });
    expect(res.statusCode).toBe(401);
  });

  it('rejects writes with a wrong key', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/places', payload: body(), headers: { 'x-admin-key': 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts the key in x-admin-key', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/places', payload: body(), headers: { 'x-admin-key': 'test-secret' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('accepts the key as a bearer token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/places', payload: body(), headers: { authorization: 'Bearer test-secret' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('verifies a key through POST /api/auth/verify', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/auth/verify' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { 'x-admin-key': 'nope' } })).statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: '/api/auth/verify', headers: { 'x-admin-key': 'test-secret' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ ok: true });
  });

  it('protects uploads', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/uploads', payload: '--b--\r\n',
      headers: { 'content-type': 'multipart/form-data; boundary=b' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('compares keys of different lengths without throwing', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/places', payload: body(), headers: { 'x-admin-key': 'x'.repeat(5000) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('protects PATCH and DELETE too', async () => {
    const created = await app.inject({
      method: 'POST', url: '/api/places', payload: body(), headers: { 'x-admin-key': 'test-secret' },
    });
    const { id } = created.json() as { id: string };

    expect((await app.inject({ method: 'PATCH', url: `/api/places/${id}`, payload: { name_vi: 'X' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: `/api/places/${id}` })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/places/${id}`, headers: { 'x-admin-key': 'test-secret' } })).statusCode,
    ).toBe(204);
  });
});
