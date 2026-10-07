import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app.js';
import { insertPlace, resetData } from './helpers/fixtures.js';
import { pool } from '../src/db/pool.js';

let app: FastifyInstance;

const CENTER = { lng: 105.7487, lat: 20.9626 };

interface PlaceBody {
  id: string;
  code: string | null;
  name_vi: string;
  category_code: string | null;
  floor: number | null;
  geom_point: { type: 'Point'; coordinates: [number, number] } | null;
  geom_polygon: { type: 'Polygon'; coordinates: number[][][] } | null;
}
interface ListBody {
  data: PlaceBody[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

async function list(query: Record<string, string | number | boolean> = {}) {
  const res = await app.inject({ method: 'GET', url: '/api/places', query: query as Record<string, string> });
  return { status: res.statusCode, body: res.json() as ListBody };
}

async function categoryId(code: string): Promise<number> {
  const { rows } = await pool.query('SELECT id FROM categories WHERE code = $1', [code]);
  return rows[0].id;
}

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/places', () => {
  beforeEach(async () => {
    await resetData();
    await insertPlace({ code: 'P-01', name_vi: 'Alpha', category: 'building', floor: 1, ...CENTER });
    await insertPlace({ code: 'P-02', name_vi: 'Bravo', category: 'building', floor: 2, ...CENTER });
    await insertPlace({ code: 'P-03', name_vi: 'Charlie', category: 'lab', floor: 2, lng: 105.76, lat: 20.97 });
    await insertPlace({ code: 'P-04', name_vi: 'Delta', category: 'lab' });
    await insertPlace({ code: 'P-05', name_vi: 'Echo', category: 'library', ...CENTER });
  });

  it('lists places sorted by name with pagination meta', async () => {
    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body.data.map((p) => p.name_vi)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    expect(body.meta).toEqual({ page: 1, limit: 20, total: 5, totalPages: 1 });
  });

  it('paginates', async () => {
    const page1 = await list({ limit: 2, page: 1 });
    const page3 = await list({ limit: 2, page: 3 });
    expect(page1.body.data.map((p) => p.code)).toEqual(['P-01', 'P-02']);
    expect(page1.body.meta.totalPages).toBe(3);
    expect(page3.body.data.map((p) => p.code)).toEqual(['P-05']);
  });

  it('sorts descending', async () => {
    const { body } = await list({ sort: 'name_vi', order: 'desc', limit: 2 });
    expect(body.data.map((p) => p.code)).toEqual(['P-05', 'P-04']);
  });

  it('filters by category', async () => {
    const { body } = await list({ category: 'lab' });
    expect(body.data.map((p) => p.code)).toEqual(['P-03', 'P-04']);
    expect(body.data.every((p) => p.category_code === 'lab')).toBe(true);
  });

  it('filters by floor', async () => {
    const { body } = await list({ floor: 2 });
    expect(body.data.map((p) => p.code)).toEqual(['P-02', 'P-03']);
  });

  it('filters by bounding box', async () => {
    const { body } = await list({ bbox: '105.74,20.96,105.75,20.965' });
    expect(body.data.map((p) => p.code)).toEqual(['P-01', 'P-02', 'P-05']);
  });

  it('rejects a malformed bbox', async () => {
    expect((await list({ bbox: '1,2,3' })).status).toBe(400);
    expect((await list({ bbox: 'a,b,c,d' })).status).toBe(400);
  });

  it('rejects invalid pagination values', async () => {
    expect((await list({ limit: 0 })).status).toBe(400);
    expect((await list({ limit: 1000 })).status).toBe(400);
    expect((await list({ page: 0 })).status).toBe(400);
  });

  it('returns an empty page beyond the last page', async () => {
    const { body } = await list({ page: 9 });
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(5);
  });
});

describe('GET /api/places/:id, /nearby, /geojson', () => {
  let alphaId: string;

  beforeAll(async () => {
    await resetData();
    alphaId = await insertPlace({ code: 'N-01', name_vi: 'Gần', category: 'building', ...CENTER });
    await insertPlace({ code: 'N-02', name_vi: 'Xa', category: 'lab', lng: 105.76, lat: 20.98 });
  });

  it('returns one place by id', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/places/${alphaId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as PlaceBody;
    expect(body.code).toBe('N-01');
    expect(body.geom_point?.coordinates).toEqual([CENTER.lng, CENTER.lat]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/places/00000000-0000-4000-8000-000000000000' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/places/not-a-uuid' });
    expect(res.statusCode).toBe(400);
  });

  it('finds nearby places within the radius, closest first', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/places/nearby',
      query: { lat: String(CENTER.lat), lng: String(CENTER.lng), radius: '500' },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as PlaceBody[]).map((p) => p.code)).toEqual(['N-01']);

    const wide = await app.inject({
      method: 'GET',
      url: '/api/places/nearby',
      query: { lat: String(CENTER.lat), lng: String(CENTER.lng), radius: '5000' },
    });
    expect((wide.json() as PlaceBody[]).map((p) => p.code)).toEqual(['N-01', 'N-02']);
  });

  it('requires lat and lng for nearby', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/places/nearby' });
    expect(res.statusCode).toBe(400);
  });

  it('exports a GeoJSON FeatureCollection, optionally by category', async () => {
    const all = await app.inject({ method: 'GET', url: '/api/places/geojson' });
    const allBody = all.json() as { type: string; features: unknown[] };
    expect(allBody.type).toBe('FeatureCollection');
    expect(allBody.features).toHaveLength(2);

    const labs = await app.inject({ method: 'GET', url: '/api/places/geojson', query: { category: 'lab' } });
    expect((labs.json() as { features: unknown[] }).features).toHaveLength(1);
  });
});

describe('places write operations', () => {
  beforeEach(resetData);

  async function create(body: Record<string, unknown>) {
    return app.inject({ method: 'POST', url: '/api/places', payload: body });
  }

  it('creates a place with a point and polygon', async () => {
    const res = await create({
      category_id: await categoryId('building'),
      code: 'W-01',
      name_vi: 'Tòa mới',
      geom_point: [CENTER.lng, CENTER.lat],
      geom_polygon: {
        type: 'Polygon',
        coordinates: [[[105.748, 20.962], [105.749, 20.962], [105.749, 20.963], [105.748, 20.963]]], // open ring is auto-closed
      },
      floor: 3,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as PlaceBody;
    expect(body.category_code).toBe('building');
    expect(body.geom_point?.coordinates).toEqual([CENTER.lng, CENTER.lat]);
    expect(body.geom_polygon?.coordinates[0]).toHaveLength(5);
    expect(body.floor).toBe(3);
  });

  it('makes a new place searchable straight away', async () => {
    await create({ category_id: await categoryId('library'), code: 'W-02', name_vi: 'Thư viện số' });
    const res = await app.inject({ method: 'GET', url: '/api/places/search', query: { q: 'thu vien so' } });
    expect((res.json() as { data: PlaceBody[] }).data.map((p) => p.code)).toContain('W-02');
  });

  it('rejects a missing name or category', async () => {
    expect((await create({ category_id: await categoryId('building') })).statusCode).toBe(400);
    expect((await create({ name_vi: 'Thiếu danh mục' })).statusCode).toBe(400);
  });

  it('rejects an invalid email', async () => {
    const category_id = await categoryId('building');
    expect((await create({ category_id, name_vi: 'X', contact_email: 'nope' })).statusCode).toBe(400);
  });

  it('ignores unknown fields instead of storing them', async () => {
    const res = await create({ category_id: await categoryId('building'), name_vi: 'X', unknown_field: 1 });
    expect(res.statusCode).toBe(201);
    expect(res.json()).not.toHaveProperty('unknown_field');
  });

  it('rejects an invalid point', async () => {
    const res = await create({
      category_id: await categoryId('building'),
      name_vi: 'X',
      geom_point: [105.7],
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 for a duplicate code', async () => {
    const category_id = await categoryId('building');
    expect((await create({ category_id, code: 'DUP', name_vi: 'Một' })).statusCode).toBe(201);
    expect((await create({ category_id, code: 'DUP', name_vi: 'Hai' })).statusCode).toBe(409);
  });

  it('updates a place', async () => {
    const id = await insertPlace({ code: 'U-01', name_vi: 'Cũ', ...CENTER });
    const res = await app.inject({ method: 'PATCH', url: `/api/places/${id}`, payload: { name_vi: 'Mới', floor: 5 } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as PlaceBody;
    expect(body.name_vi).toBe('Mới');
    expect(body.floor).toBe(5);
    expect(body.code).toBe('U-01');
  });

  it('returns 404 when updating or deleting an unknown place', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    expect((await app.inject({ method: 'PATCH', url: `/api/places/${id}`, payload: { name_vi: 'X' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/places/${id}` })).statusCode).toBe(404);
  });

  it('deletes a place', async () => {
    const id = await insertPlace({ code: 'D-01', name_vi: 'Xóa tôi', ...CENTER });
    expect((await app.inject({ method: 'DELETE', url: `/api/places/${id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/api/places/${id}` })).statusCode).toBe(404);
  });
});

describe('categories', () => {
  it('lists active categories', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ code: string }>;
    expect(body.map((c) => c.code)).toContain('building');
  });

  it('lists categories with place counts', async () => {
    await resetData();
    await insertPlace({ code: 'C-01', name_vi: 'Một', category: 'lab', ...CENTER });
    await insertPlace({ code: 'C-02', name_vi: 'Hai', category: 'lab', ...CENTER });
    const res = await app.inject({ method: 'GET', url: '/api/categories/with-counts' });
    expect(res.statusCode).toBe(200);
    const lab = (res.json() as Array<{ code: string; place_count: number | string }>).find((c) => c.code === 'lab');
    expect(Number(lab?.place_count)).toBe(2);
  });
});

describe('health', () => {
  it('responds ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { status: string }).status).toBe('ok');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect((res.json() as { message: string }).message).toBe('Route not found');
  });
});
