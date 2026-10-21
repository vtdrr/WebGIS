import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

type Coordinate = [number, number];
type PointFeature = {
  type: 'Feature';
  id?: string;
  properties: { node_id?: string; place_code?: string };
  geometry: { type: 'Point'; coordinates: Coordinate };
};
type LineFeature = {
  type: 'Feature';
  id?: string;
  properties: { route_id?: string; from_node?: string; to_node?: string; name_vi?: string };
  geometry: { type: 'LineString'; coordinates: Coordinate[] };
};

const require = createRequire(import.meta.url);
const gateNetwork = require('../src/modules/routing/campus-gate-routes.json') as {
  type: string;
  features: Array<PointFeature | LineFeature | { type: 'Feature'; id?: string; properties?: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }>;
};
const transferNetwork = require('../src/modules/routing/campus-transfer-routes.json') as {
  transfer_points: Array<{ node_id: string; name_vi: string; place_code: string }>;
  routes: Array<{
    route_id: string;
    name_vi: string;
    hub_node: string;
    from_node: string;
    to_node: string;
    coordinates: Coordinate[];
  }>;
};
const walkwayNetwork = require('../src/modules/routing/campus-walkways.json') as {
  type: string;
  features: Array<{
    type: 'Feature';
    properties?: { kind?: string; from?: string; to?: string };
    geometry: { type: string; coordinates: Coordinate[] | Coordinate[][] };
  }>;
};

function isCoordinate(value: unknown): value is Coordinate {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [longitude, latitude] = value;
  return Number.isFinite(longitude) && Number.isFinite(latitude) &&
    longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}

function distanceMeters(a: Coordinate, b: Coordinate): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (b[1] - a[1]) * radians;
  const longitudeDelta = (b[0] - a[0]) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function expectUnique(values: string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

describe('static routing data contracts', () => {
  it('defines unique gate/access nodes with valid point coordinates', () => {
    expect(gateNetwork.type).toBe('FeatureCollection');
    const points = gateNetwork.features.filter(
      (feature): feature is PointFeature => feature.geometry.type === 'Point',
    );
    const featureIds = gateNetwork.features.map((feature) => feature.id).filter((id): id is string => Boolean(id));
    const nodeIds = points.map((feature) => feature.properties.node_id).filter((id): id is string => Boolean(id));

    expectUnique(featureIds);
    expect(nodeIds).toHaveLength(points.length);
    expectUnique(nodeIds);
    for (const feature of points) {
      expect(feature.type).toBe('Feature');
      expect(feature.properties.node_id).toBeTruthy();
      expect(isCoordinate(feature.geometry.coordinates)).toBe(true);
    }
  });

  it('connects each declared gate line to existing nodes at its geometry endpoints', () => {
    const points = new Map(
      gateNetwork.features
        .filter((feature): feature is PointFeature => feature.geometry.type === 'Point')
        .map((feature) => [feature.properties.node_id, feature.geometry.coordinates]),
    );
    const routes = gateNetwork.features.filter(
      (feature): feature is LineFeature => feature.geometry.type === 'LineString',
    );

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.properties.from_node).toBeTruthy();
      expect(route.properties.to_node).toBeTruthy();
      expect(route.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(route.geometry.coordinates.every(isCoordinate)).toBe(true);

      const start = points.get(route.properties.from_node!);
      const end = points.get(route.properties.to_node!);
      expect(start, `${route.id ?? 'gate route'} start node`).toBeDefined();
      expect(end, `${route.id ?? 'gate route'} end node`).toBeDefined();
      expect(distanceMeters(route.geometry.coordinates[0], start!)).toBeLessThanOrEqual(2);
      expect(distanceMeters(route.geometry.coordinates.at(-1)!, end!)).toBeLessThanOrEqual(2);
    }
  });

  it('uses unique transfer IDs and references existing access nodes', () => {
    const pointIds = transferNetwork.transfer_points.map((point) => point.node_id);
    const routeIds = transferNetwork.routes.map((route) => route.route_id);
    const accessPoints = new Map(
      gateNetwork.features
        .filter((feature): feature is PointFeature => feature.geometry.type === 'Point')
        .map((feature) => [feature.properties.node_id, feature.geometry.coordinates]),
    );

    expectUnique(pointIds);
    expectUnique(routeIds);
    for (const point of transferNetwork.transfer_points) {
      expect(point.name_vi).toBeTruthy();
      expect(point.place_code).toBeTruthy();
      expect(accessPoints.has(point.node_id)).toBe(true);
    }
    for (const route of transferNetwork.routes) {
      expect(route.name_vi).toBeTruthy();
      expect(pointIds).toContain(route.hub_node);
      expect(route.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(route.coordinates.every(isCoordinate)).toBe(true);
      const start = accessPoints.get(route.from_node);
      const end = accessPoints.get(route.to_node);
      expect(start, `${route.route_id} start node`).toBeDefined();
      expect(end, `${route.route_id} end node`).toBeDefined();
      expect(distanceMeters(route.coordinates[0], start!)).toBeLessThanOrEqual(2);
      expect(distanceMeters(route.coordinates.at(-1)!, end!)).toBeLessThanOrEqual(2);
    }
  });

  it('contains valid walkway lines and closed walkable polygon rings', () => {
    expect(walkwayNetwork.type).toBe('FeatureCollection');
    const corridorPairs: string[] = [];
    let walkableAreas = 0;

    for (const feature of walkwayNetwork.features) {
      if (feature.geometry.type === 'LineString') {
        const coordinates = feature.geometry.coordinates as Coordinate[];
        expect(coordinates.length).toBeGreaterThanOrEqual(2);
        expect(coordinates.every(isCoordinate)).toBe(true);
      }
      if (feature.properties?.kind === 'corridor') {
        expect(feature.properties.from).toBeTruthy();
        expect(feature.properties.to).toBeTruthy();
        corridorPairs.push(`${feature.properties.from}-${feature.properties.to}`);
      }
      if (feature.properties?.kind === 'walkable_area' && feature.geometry.type === 'Polygon') {
        walkableAreas++;
        const rings = feature.geometry.coordinates as Coordinate[][];
        expect(rings.length).toBeGreaterThan(0);
        for (const ring of rings) {
          expect(ring.length).toBeGreaterThanOrEqual(4);
          expect(ring.every(isCoordinate)).toBe(true);
          expect(ring[0]).toEqual(ring.at(-1));
        }
      }
    }

    expectUnique(corridorPairs);
    expect(walkableAreas).toBeGreaterThan(0);
  });
});
