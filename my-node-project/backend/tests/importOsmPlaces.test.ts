import { describe, expect, it } from 'vitest';
import { toPlace, type OsmElement } from '../src/db/importOsmPlaces.js';

describe('toPlace', () => {
  it('maps a named OSM building to a stable place with its footprint and English name', () => {
    const element: OsmElement = {
      type: 'way',
      id: 1183713531,
      tags: { building: 'school', name: 'Toà A2', 'name:en': 'A2 Building', 'building:levels': '7' },
      geometry: [
        { lon: 105.74, lat: 20.96 },
        { lon: 105.741, lat: 20.96 },
        { lon: 105.741, lat: 20.961 },
        { lon: 105.74, lat: 20.961 },
        { lon: 105.74, lat: 20.96 },
      ],
    };

    expect(toPlace(element)).toMatchObject({
      osmType: 'way',
      osmId: '1183713531',
      code: 'OSM-W-1183713531',
      category: 'classroom',
      floor: 7,
      nameVi: 'Toà A2',
      nameEn: 'A2 Building',
      polygon: { type: 'Polygon', coordinates: [[ [105.74, 20.96], [105.741, 20.96], [105.741, 20.961], [105.74, 20.961], [105.74, 20.96] ]] },
    });
  });

  it('applies requested campus functions and rejects all other or unnamed OSM features', () => {
    expect(toPlace({ type: 'way', id: 1179878048, tags: { building: 'office', name: 'Toà A10' }, center: { lat: 20.96, lon: 105.74 } }))
      .toMatchObject({ category: 'building', tags: { campus_function: 'main_building', library_floors: '4;5;6' } });
    expect(toPlace({ type: 'way', id: 1113215768, tags: { building: 'school', name: 'Toà A1' }, center: { lat: 20.96, lon: 105.74 } }))
      .toMatchObject({ category: 'classroom', floor: 7 });
    expect(toPlace({ type: 'node', id: 456, lat: 20.96, lon: 105.74, tags: { amenity: 'library', name: 'Thư viện' } })).toBeNull();
    expect(toPlace({ type: 'way', id: 1183713529, tags: { amenity: 'parking' }, center: { lat: 20.96, lon: 105.74 } })).toBeNull();
  });
});
