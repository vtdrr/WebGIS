import type pg from 'pg';

export class GeometryValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'GeometryValidationError';
  }
}

/** Normalize and validate a GeoJSON position, returning [longitude, latitude]. */
export function normalizePointCoordinates(value: unknown): [number, number] {
  const coordinates = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'coordinates' in value
      ? (value as { coordinates: unknown }).coordinates
      : null;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new GeometryValidationError('A point must contain longitude and latitude coordinates');
  }
  const [lng, lat] = coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new GeometryValidationError('Point coordinates must be finite numbers');
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    throw new GeometryValidationError('Point coordinates are outside longitude/latitude bounds');
  }
  return [lng, lat];
}

/** Validate polygon structure and return closed rings in GeoJSON [lng, lat] order. */
export function normalizePolygonCoordinates(value: unknown): number[][][] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new GeometryValidationError('A polygon must contain at least one ring');
  }

  return value.map((rawRing, ringIndex) => {
    if (!Array.isArray(rawRing)) {
      throw new GeometryValidationError(`Polygon ring ${ringIndex + 1} must be an array`);
    }
    const ring = rawRing.map((position) => normalizePointCoordinates(position));
    if (ring.length < 3) {
      throw new GeometryValidationError(`Polygon ring ${ringIndex + 1} needs at least three vertices`);
    }

    const first = ring[0];
    const last = ring[ring.length - 1];
    const closed = first[0] === last[0] && first[1] === last[1];
    const openRing = closed ? ring.slice(0, -1) : ring;
    const unique = new Set(openRing.map(([lng, lat]) => `${lng},${lat}`));
    if (unique.size < 3) {
      throw new GeometryValidationError(`Polygon ring ${ringIndex + 1} needs three distinct vertices`);
    }

    const closedRing = closed ? ring : [...ring, first];
    let twiceArea = 0;
    for (let i = 1; i < closedRing.length; i++) {
      twiceArea += closedRing[i - 1][0] * closedRing[i][1] - closedRing[i][0] * closedRing[i - 1][1];
    }
    if (Math.abs(twiceArea) < 1e-14) {
      throw new GeometryValidationError(`Polygon ring ${ringIndex + 1} has zero area`);
    }
    return closedRing;
  });
}

export function polygonCoordinatesToWkt(value: unknown): string {
  const rings = normalizePolygonCoordinates(value);
  return `POLYGON(${rings.map((ring) => `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(',')})`).join(',')})`;
}

/** Use PostGIS as the final authority for topology (self-intersections, holes, etc.). */
export async function assertValidPolygonWkt(client: Pick<pg.PoolClient, 'query'>, wkt: string): Promise<void> {
  const result = await client.query<{ valid: boolean; reason: string }>(`
    SELECT ST_IsValid(shape) AS valid, ST_IsValidReason(shape) AS reason
    FROM (SELECT ST_GeomFromText($1, 4326) AS shape) AS polygon
  `, [wkt]);
  if (!result.rows[0]?.valid) {
    throw new GeometryValidationError(`Invalid polygon: ${result.rows[0]?.reason ?? 'unknown reason'}`);
  }
}
