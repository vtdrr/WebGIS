import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app.js';
import { insertPlace, resetData } from './helpers/fixtures.js';
import { pool } from '../src/db/pool.js';
import { dijkstra, getRoutingNetwork, nearestNodes } from '../src/modules/routing/routing.service.js';

const require = createRequire(import.meta.url);
const gateNetwork = require('../src/modules/routing/campus-gate-routes.json') as {
  features: Array<{
    properties: { node_id?: string; place_code?: string; name_vi?: string; kind?: string; route_id?: string; from_node?: string; to_node?: string };
    geometry: { type: 'Point' | 'LineString'; coordinates: [number, number] | Array<[number, number]> };
  }>;
};
const transferNetwork = require('../src/modules/routing/campus-transfer-routes.json') as {
  routes: Array<{ route_id: string; from_node: string; to_node: string; coordinates: Array<[number, number]> }>;
};

let app: FastifyInstance;
const places = new Map<string, { name: string; coordinates: [number, number] }>();

beforeAll(async () => {
  app = await createTestApp();
  await resetData();

  for (const feature of gateNetwork.features) {
    if (feature.geometry.type !== 'Point' || !feature.properties.place_code || !feature.properties.name_vi) continue;
    if (places.has(feature.properties.place_code)) continue;
    const coordinates = feature.geometry.coordinates as [number, number];
    places.set(feature.properties.place_code, { name: feature.properties.name_vi, coordinates });
  }

  // The library shares the A10 campus entrance for this trial; floor-level
  // indoor navigation can be added later if separate stair/elevator data exists.
  const a10 = places.get('OSM-W-1179878048')!;
  places.set('CAMPUS-LIBRARY-A10', { name: 'Thư viện A10', coordinates: a10.coordinates });

  for (const [code, place] of places) {
    await insertPlace({ code, name_vi: place.name, lng: place.coordinates[0], lat: place.coordinates[1] });
  }
  await invalidateGraph();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

async function route(fromCode: string, toCode: string) {
  const from = places.get(fromCode)!;
  const to = places.get(toCode)!;
  const response = await app.inject({
    method: 'GET',
    url: '/api/routing',
    query: {
      from: `${from.coordinates[1]},${from.coordinates[0]}`,
      to: `${to.coordinates[1]},${to.coordinates[0]}`,
    },
  });
  return { status: response.statusCode, body: response.json() as {
    routes: Array<{ distance: number; geometry: { coordinates: Array<[number, number]> }; legs: Array<{ steps: Array<{ name: string; instruction: string }> }> }>;
    meta: { fallback: boolean };
  } };
}

describe('campus transfer routing', () => {
  it('uses the declared route from the main gate to an access point', async () => {
    const gateRoute = gateNetwork.features.find((feature) =>
      feature.geometry.type === 'LineString' &&
      feature.properties.from_node === 'campus-main-gate' &&
      feature.properties.to_node === 'building-a2-access',
    );
    expect(gateRoute).toBeDefined();

    const { status, body } = await route('CAMPUS-GATE-MAIN', 'OSM-W-1183713531');
    expect(status).toBe(200);
    expect(body.meta.fallback).toBe(false);
    expect(body.routes[0].geometry.coordinates).toEqual(gateRoute!.geometry.coordinates);
  });

  it('uses a user-drawn direct route before considering transfers', async () => {
    const direct = transferNetwork.routes.find((candidate) =>
      candidate.from_node === 'building-a2-access' && candidate.to_node === 'building-a6-access',
    )!;
    const { status, body } = await route('OSM-W-1183713531', 'OSM-W-1183713533');

    expect(status).toBe(200);
    expect(body.meta.fallback).toBe(false);
    expect(body.routes[0].geometry.coordinates).toEqual(direct.coordinates);
  });

  it('connects a pair without a direct line through the declared hubs', async () => {
    const { status, body } = await route('OSM-W-1183713520', 'OSM-W-1183713533');
    const instructions = body.routes[0].legs[0].steps.map((step) => step.instruction).join(' | ');

    expect(status).toBe(200);
    expect(body.meta.fallback).toBe(false);
    expect(instructions).toContain('A1');
    expect(instructions).toContain('A2');
    expect(instructions).toContain('A6');
  });

  it('uses drawn transfer routes in both directions', async () => {
    const forward = (await route('OSM-W-1183713531', 'OSM-W-1183713533')).body.routes[0];
    const backward = (await route('OSM-W-1183713533', 'OSM-W-1183713531')).body.routes[0];

    expect(backward.geometry.coordinates).toEqual([...forward.geometry.coordinates].reverse());
    expect(backward.distance).toBe(forward.distance);
  });

  it('connects every defined place pair through direct routes or transfer points', async () => {
    const { nodes, adjacency } = await getRoutingNetwork();
    const accessPoints = gateNetwork.features.filter(
      (feature) => feature.geometry.type === 'Point' && feature.properties.place_code && feature.properties.node_id &&
        nodes.has(feature.properties.node_id),
    );
    const routeNodesByPlace = new Map<string, Set<string>>();
    for (const feature of accessPoints) {
      const code = feature.properties.place_code!;
      const id = feature.properties.node_id!;
      if (!routeNodesByPlace.has(code)) routeNodesByPlace.set(code, new Set());
      routeNodesByPlace.get(code)!.add(id);
    }
    const allCodes = [...routeNodesByPlace.keys()];
    const unreachable: string[] = [];

    for (const fromCode of allCodes) {
      for (const toCode of allCodes) {
        if (fromCode === toCode) continue;
        const reachable = [...routeNodesByPlace.get(fromCode)!].some((from) =>
          [...routeNodesByPlace.get(toCode)!].some((to) => dijkstra(adjacency, from, to) !== null),
        );
        if (!reachable) unreachable.push(`${fromCode} -> ${toCode}`);
      }
    }

    expect(allCodes.length).toBe(29);
    expect(unreachable).toEqual([]);
    expect(nearestNodes(nodes, places.get('CAMPUS-LIBRARY-A10')!.coordinates[1], places.get('CAMPUS-LIBRARY-A10')!.coordinates[0]).length).toBeGreaterThan(0);
  }, 60_000);
});

async function invalidateGraph(): Promise<void> {
  const { invalidateGraphCache } = await import('../src/modules/routing/routing.service.js');
  invalidateGraphCache();
}
