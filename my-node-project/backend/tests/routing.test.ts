import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app.js';
import { insertPath, insertPlace, resetData } from './helpers/fixtures.js';
import { pool } from '../src/db/pool.js';

let app: FastifyInstance;

// Three buildings roughly 90-100 m apart, connected A - B - C
const A = { lat: 20.962, lng: 105.748 };
const B = { lat: 20.9626, lng: 105.7487 };
const C = { lat: 20.9632, lng: 105.7494 };

interface RouteBody {
  routes: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: Array<[number, number]> };
    legs: Array<{ steps: Array<{ instruction: string; off_network?: boolean }> }>;
  }>;
  meta: { mode: string; fallback: boolean; nodes: number; off_network_m?: number };
}

async function route(from: { lat: number; lng: number }, to: { lat: number; lng: number }, mode = 'walk') {
  const res = await app.inject({
    method: 'GET',
    url: '/api/routing',
    query: { from: `${from.lat},${from.lng}`, to: `${to.lat},${to.lng}`, mode },
  });
  return { status: res.statusCode, body: res.json() as RouteBody };
}

beforeAll(async () => {
  app = await createTestApp();
  await resetData();
  await insertPlace({ code: 'R-A', name_vi: 'Điểm A', lng: A.lng, lat: A.lat });
  await insertPlace({ code: 'R-B', name_vi: 'Điểm B', lng: B.lng, lat: B.lat });
  await insertPlace({ code: 'R-C', name_vi: 'Điểm C', lng: C.lng, lat: C.lat });
  await insertPath('R-A', 'R-B');
  await insertPath('R-B', 'R-C');
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/routing', () => {
  it('routes along the path network', async () => {
    const { status, body } = await route(A, C);
    expect(status).toBe(200);
    expect(body.meta.fallback).toBe(false);
    expect(body.meta.nodes).toBe(3); // A -> B -> C
    expect(body.routes[0].distance).toBeGreaterThan(150);
    expect(body.routes[0].legs[0].steps.length).toBeGreaterThanOrEqual(2);
  });

  it('starts and ends at the requested coordinates', async () => {
    const { body } = await route(A, C);
    const coords = body.routes[0].geometry.coordinates;
    expect(coords[0]).toEqual([A.lng, A.lat]);
    expect(coords[coords.length - 1]).toEqual([C.lng, C.lat]);
  });

  it('routes in both directions with the same distance', async () => {
    const forward = await route(A, C);
    const backward = await route(C, A);
    expect(backward.body.routes[0].distance).toBe(forward.body.routes[0].distance);
  });

  it('takes longer on foot than by bike, and longest by wheelchair', async () => {
    const walk = (await route(A, C, 'walk')).body.routes[0];
    const bike = (await route(A, C, 'bike')).body.routes[0];
    const wheelchair = (await route(A, C, 'wheelchair')).body.routes[0];
    expect(bike.duration).toBeLessThan(walk.duration);
    expect(walk.duration).toBeLessThan(wheelchair.duration);
    expect(bike.distance).toBe(walk.distance);
  });

  it('rejects an origin too far from the campus', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/routing',
      query: { from: '21.5,106.5', to: `${C.lat},${C.lng}` },
    });
    expect(res.statusCode).toBe(422);
    expect((res.json() as { message: string }).message).toMatch(/quá xa/);
  });

  it('rejects a destination too far from the campus', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/routing',
      query: { from: `${A.lat},${A.lng}`, to: '21.5,106.5' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('falls back when there is no path network at all', async () => {
    await pool.query('TRUNCATE campus_paths');
    const { invalidateGraphCache } = await import('../src/modules/routing/routing.service.js');
    invalidateGraphCache();
    const { body } = await route(A, C);
    expect(body.meta.fallback).toBe(true);
    await insertPath('R-A', 'R-B');
    await insertPath('R-B', 'R-C');
  });
});

describe('routing from outside the campus', () => {
  // ~290 m west of A, e.g. a bus stop
  const BUS_STOP = { lat: 20.962, lng: 105.7452 };

  it('walks to the nearest path node, then follows the paths', async () => {
    const { status, body } = await route(BUS_STOP, C);
    expect(status).toBe(200);
    expect(body.meta.fallback).toBe(false);
    expect(body.meta.nodes).toBe(3); // A -> B -> C
    expect(body.meta.off_network_m).toBeGreaterThan(250);
    expect(body.meta.off_network_m).toBeLessThan(350);
    const coords = body.routes[0].geometry.coordinates;
    expect(coords[0]).toEqual([BUS_STOP.lng, BUS_STOP.lat]);
    expect(coords[coords.length - 1]).toEqual([C.lng, C.lat]);
  });

  it('flags the connector leg as off-network', async () => {
    const { body } = await route(BUS_STOP, C);
    const steps = body.routes[0].legs[0].steps;
    expect(steps[0].off_network).toBe(true);
    expect(steps.slice(1).every((s) => !s.off_network)).toBe(true);
  });

  it('adds the off-network distance to the total', async () => {
    const inside = (await route(A, C)).body.routes[0].distance;
    const outside = (await route(BUS_STOP, C)).body.routes[0].distance;
    expect(outside).toBeGreaterThan(inside + 250);
  });

  it('works when the destination is the one outside the paths', async () => {
    const { status, body } = await route(C, BUS_STOP);
    expect(status).toBe(200);
    expect(body.meta.fallback).toBe(false);
    const steps = body.routes[0].legs[0].steps;
    expect(steps[steps.length - 1].off_network).toBe(true);
  });

  it('allows an origin up to the distance limit', async () => {
    const farBusStop = { lat: 20.962, lng: 105.748 - 0.024 }; // ~2.5 km west
    const { status, body } = await route(farBusStop, C);
    expect(status).toBe(200);
    expect(body.meta.off_network_m).toBeGreaterThan(2000);
  });

  it('ignores places that are not part of the path network', async () => {
    // A place right next to the bus stop that has no paths must not be used as the entry point
    await insertPlace({ code: 'R-LONER', name_vi: 'Quán gần trạm', lng: BUS_STOP.lng, lat: BUS_STOP.lat });
    const { body } = await route(BUS_STOP, C);
    expect(body.meta.fallback).toBe(false);
    expect(body.meta.nodes).toBe(3);
  });
});

describe('GET /api/routing validation', () => {
  const get = (query: Record<string, string>) => app.inject({ method: 'GET', url: '/api/routing', query });

  it('requires from and to', async () => {
    expect((await get({})).statusCode).toBe(400);
    expect((await get({ from: '20.96,105.74' })).statusCode).toBe(400);
  });

  it('rejects malformed coordinates', async () => {
    expect((await get({ from: 'abc', to: '20.96,105.74' })).statusCode).toBe(400);
    expect((await get({ from: '20.96;105.74', to: '20.96,105.74' })).statusCode).toBe(400);
  });

  it('rejects out-of-range coordinates', async () => {
    expect((await get({ from: '100,105.74', to: '20.96,105.74' })).statusCode).toBe(400);
    expect((await get({ from: '20.96,200', to: '20.96,105.74' })).statusCode).toBe(400);
  });

  it('rejects an unknown mode', async () => {
    expect((await get({ from: '20.96,105.74', to: '20.97,105.75', mode: 'flying' })).statusCode).toBe(400);
  });
});
