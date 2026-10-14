import { describe, expect, it } from 'vitest';
import {
  GeometryValidationError,
  normalizePointCoordinates,
  normalizePolygonCoordinates,
  polygonCoordinatesToWkt,
} from '../src/modules/common/geometry.js';

describe('shared geometry validation', () => {
  it('accepts valid coordinates and rejects out-of-range coordinates', () => {
    expect(normalizePointCoordinates([105.75, 20.96])).toEqual([105.75, 20.96]);
    expect(() => normalizePointCoordinates([181, 20])).toThrow(GeometryValidationError);
    expect(() => normalizePointCoordinates([105, Number.NaN])).toThrow(/finite numbers/);
  });

  it('closes valid polygon rings and builds WKT in GeoJSON coordinate order', () => {
    const coordinates = [[105.74, 20.96], [105.741, 20.96], [105.741, 20.961]];
    expect(normalizePolygonCoordinates([coordinates])[0]).toHaveLength(4);
    expect(polygonCoordinatesToWkt([coordinates])).toBe(
      'POLYGON((105.74 20.96,105.741 20.96,105.741 20.961,105.74 20.96))',
    );
  });

  it('rejects rings with too few distinct vertices, zero area, or invalid positions', () => {
    expect(() => normalizePolygonCoordinates([[[1, 1], [1, 1], [1, 1]]])).toThrow(/distinct vertices/);
    expect(() => normalizePolygonCoordinates([[[0, 0], [1, 1], [2, 2]]])).toThrow(/zero area/);
    expect(() => normalizePolygonCoordinates([[[0, 0], [1, 0], [1, 91]]])).toThrow(/bounds/);
  });
});
