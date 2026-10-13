import { pathToFileURL } from 'node:url';
import { getClient, pool } from './pool.js';

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];
const BBOX = [20.958, 105.744, 20.966, 105.753] as const;
const SAMPLE_CODES = ['A1-MAIN', 'A1-101', 'LIB-MAIN', 'CAN-MAIN', 'ADM-MAIN', 'DOR-A', 'PK-MAIN', 'SPT-MAIN', 'GATE-S', 'GATE-N'];

/** Only campus features explicitly requested by the user; OSM identities remain the source of truth. */
const CAMPUS_FEATURES: Record<string, { category: string; function: string; floors?: number; libraryFloors?: number[]; point?: { lat: number; lng: number } }> = {
  'way/1113215768': { category: 'classroom', function: 'lecture_hall', floors: 7 }, // A1
  'way/1183713531': { category: 'classroom', function: 'lecture_hall', floors: 7 }, // A2
  'way/1183713520': { category: 'classroom', function: 'lecture_hall', floors: 7 }, // A3
  'way/1183713532': { category: 'classroom', function: 'lecture_hall', floors: 7 }, // A4
  'way/1183713521': { category: 'classroom', function: 'lecture_hall', floors: 7 }, // A5
  'way/1183713533': { category: 'classroom', function: 'lecture_hall', floors: 7 }, // A6
  'way/1183713522': { category: 'classroom', function: 'lecture_hall', floors: 7 }, // A7
  'way/1183713534': { category: 'classroom', function: 'lecture_hall', floors: 7 }, // A8
  'way/1179878047': { category: 'building', function: 'main_building', floors: 30 }, // A9
  'way/1179878048': { category: 'building', function: 'main_building', floors: 30, libraryFloors: [4, 5, 6] }, // A10
  'way/892574229': { category: 'lab', function: 'engineering_practice' }, // B1
  'way/1183713526': { category: 'lab', function: 'engineering_practice' }, // B2
  'way/1183713525': { category: 'lab', function: 'engineering_practice' }, // B3
  'way/1113215769': { category: 'lab', function: 'engineering_practice' }, // B4
  'way/892574245': { category: 'dormitory', function: 'dormitory' },
  'way/892560474': { category: 'dormitory', function: 'dormitory' },
  'way/892560472': { category: 'dormitory', function: 'dormitory' },
  'way/892560481': { category: 'canteen', function: 'canteen_3_sao' },
  'way/1183713524': { category: 'canteen', function: 'canteen_d6' },
  'way/892560469': { category: 'sports', function: 'football_field', point: { lat: 20.96138714621549, lng: 105.74899148501748 } },
  'way/892574249': { category: 'sports', function: 'sports_hall' },
  'way/1183713535': { category: 'medical', function: 'school_health_center' },
};

const MANUAL_CAMPUS_PLACES: Array<{ code: string; nameVi: string; category: string; lat: number; lng: number; attributes?: Record<string, unknown> }> = [
  { code: 'CAMPUS-GATE-SECONDARY', nameVi: 'Cổng phụ', category: 'gate', lat: 20.95945202465268, lng: 105.74797430560722 },
  { code: 'CAMPUS-GATE-MAIN', nameVi: 'Cổng chính', category: 'gate', lat: 20.9628055556, lng: 105.7482777778 },
  { code: 'CAMPUS-TENNIS', nameVi: 'Sân tennis', category: 'sports', lat: 20.962, lng: 105.7493055556 },
  { code: 'CAMPUS-PARKING-1', nameVi: 'Bãi giữ xe 1', category: 'parking', lat: 20.96075, lng: 105.74866666666667 },
  { code: 'CAMPUS-PARKING-2', nameVi: 'Bãi giữ xe 2', category: 'parking', lat: 20.95961111111111, lng: 105.74705555555556 },
  { code: 'CAMPUS-PARKING-3', nameVi: 'Bãi giữ xe 3', category: 'parking', lat: 20.961113536353764, lng: 105.74934929596601 },
  { code: 'CAMPUS-PARKING-4', nameVi: 'Bãi giữ xe 4', category: 'parking', lat: 20.962017512314315, lng: 105.7476238927968 },
  { code: 'CAMPUS-LIBRARY-A10', nameVi: 'Thư viện A10', category: 'library', lat: 20.96002295, lng: 105.746726151, attributes: { floors: [4, 5, 6] } },
];

export interface OsmElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

interface OsmResponse {
  elements: OsmElement[];
  osm3s?: { timestamp_osm_base?: string };
}

interface OSMPlace {
  osmType: 'node' | 'way';
  osmId: string;
  code: string;
  category: string;
  floor: number | null;
  nameVi: string;
  nameEn: string | null;
  lng: number;
  lat: number;
  polygon: { type: 'Polygon'; coordinates: number[][][] } | null;
  tags: Record<string, string>;
}

function categoryFor(tags: Record<string, string>): string | null {
  if (tags.building && tags.building !== 'no') return 'building';
  if (tags.amenity === 'library') return 'library';
  if (['cafe', 'restaurant', 'fast_food', 'food_court'].includes(tags.amenity ?? '') || tags.shop === 'convenience') return 'canteen';
  if (tags.amenity === 'parking' || tags.amenity === 'bicycle_parking') return 'parking';
  if (['clinic', 'doctors', 'hospital', 'pharmacy'].includes(tags.amenity ?? '')) return 'medical';
  if (tags.amenity === 'sports_centre' || ['pitch', 'sports_centre'].includes(tags.leisure ?? '')) return 'sports';
  if (['university', 'college', 'school'].includes(tags.amenity ?? '') || tags.office) return 'admin';
  if (tags.barrier === 'gate' || tags.entrance === 'main') return 'gate';
  if (tags.amenity || tags.leisure || tags.tourism || tags.historic || tags.shop || tags.place) return 'other';
  return null;
}

export function toPlace(element: OsmElement): OSMPlace | null {
  const tags = element.tags ?? {};
  const identity = `${element.type}/${element.id}`;
  const campusFeature = CAMPUS_FEATURES[identity];
  if (!campusFeature) return null;
  const category = campusFeature.category || categoryFor(tags);
  const nameVi = tags['name:vi']?.trim() || tags.name?.trim() || tags['name:en']?.trim();
  if (!category || !nameVi) return null;

  const geometry = element.geometry;
  const geometryCenter = geometry?.length
    ? {
        lon: geometry.reduce((sum, point) => sum + point.lon, 0) / geometry.length,
        lat: geometry.reduce((sum, point) => sum + point.lat, 0) / geometry.length,
      }
    : undefined;
  let lng = campusFeature.point?.lng ?? element.lon ?? element.center?.lon ?? geometryCenter?.lon;
  let lat = campusFeature.point?.lat ?? element.lat ?? element.center?.lat ?? geometryCenter?.lat;
  let polygon: OSMPlace['polygon'] = null;

  // Named building/area ways become footprints; point features and non-area ways remain searchable places.
  if (element.type === 'way' && geometry && geometry.length >= 4 &&
      (tags.building !== undefined || tags.area === 'yes') &&
      geometry[0].lat === geometry[geometry.length - 1].lat && geometry[0].lon === geometry[geometry.length - 1].lon) {
    const ring = geometry.map(({ lon: x, lat: y }) => [x, y]);
    polygon = { type: 'Polygon', coordinates: [ring] };
    const center = element.center;
    if (center) { lng = center.lon; lat = center.lat; }
  }

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return {
    osmType: element.type,
    osmId: String(element.id),
    code: `OSM-${element.type === 'node' ? 'N' : 'W'}-${element.id}`,
    category,
    floor: campusFeature.floors ?? null,
    nameVi,
    nameEn: tags['name:en']?.trim() || null,
    lng: lng!,
    lat: lat!,
    polygon,
    tags: {
      ...tags,
      campus_function: campusFeature.function,
      ...(campusFeature.floors ? { floors: String(campusFeature.floors) } : {}),
      ...(campusFeature.libraryFloors ? { library_floors: campusFeature.libraryFloors.join(';') } : {}),
    },
  };
}

async function fetchPlaces(): Promise<OsmResponse> {
  const [south, west, north, east] = BBOX;
  const box = `(${south},${west},${north},${east})`;
  const query = `[out:json][timeout:35];(way["building"]["name"]${box};node["amenity"]["name"]${box};way["amenity"]["name"]${box};node["leisure"]["name"]${box};way["leisure"]["name"]${box};node["shop"]["name"]${box};way["shop"]["name"]${box};node["tourism"]["name"]${box};way["tourism"]["name"]${box};node["historic"]["name"]${box};way["historic"]["name"]${box};);out center geom;`;
  const errors: string[] = [];
  for (const url of OVERPASS_URLS) {
    try {
      const requestUrl = new URL(url);
      requestUrl.searchParams.set('data', query);
      const response = await fetch(requestUrl, {
        headers: {
          accept: 'application/json',
          'user-agent': 'Phenikaa-WebGIS/1.0 (campus place sync)',
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        const details = (await response.text()).replace(/\s+/g, ' ').slice(0, 180);
        errors.push(`${new URL(url).host}: HTTP ${response.status}${details ? ` (${details})` : ''}`);
        continue;
      }
      return (await response.json()) as OsmResponse;
    } catch (error) {
      errors.push(`${new URL(url).host}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`All Overpass endpoints failed. ${errors.join(' | ')}`);
}

async function importOsmPlaces(): Promise<void> {
  console.log(`Fetching named OSM places in bbox ${BBOX.join(',')}...`);
  const osm = await fetchPlaces();
  const wayCount = osm.elements.filter((element) => element.type === 'way').length;
  const nodeCount = osm.elements.length - wayCount;
  const places = osm.elements.map(toPlace).filter((place): place is OSMPlace => place !== null);
  const missing = Object.keys(CAMPUS_FEATURES).filter((key) => !places.some((place) => `${place.osmType}/${place.osmId}` === key));
  if (missing.length) throw new Error(`OSM is missing requested named features (${missing.join(', ')}); database was not changed`);
  console.log(`Received ${nodeCount} nodes and ${wayCount} ways; matched ${places.length} requested campus features.`);

  const client = await getClient();
  try {
    await client.query('BEGIN');
    // The synthetic campus graph references sample place codes; remove those edges before replacing samples.
    await client.query(
      `DELETE FROM campus_paths
       WHERE source_code = ANY($1::varchar[]) OR target_code = ANY($1::varchar[])`,
      [SAMPLE_CODES],
    );
    await client.query("DELETE FROM places WHERE source = 'sample'");

    for (const place of places) {
      const polygon = place.polygon ? JSON.stringify(place.polygon) : null;
      await client.query(
        `INSERT INTO places
          (category_id, code, name_vi, name_en, geom_point, geom_polygon, floor, attributes, source, osm_type, osm_id)
         VALUES (
          (SELECT id FROM categories WHERE code = $1), $2, $3, $4,
          CASE WHEN $9::text IS NOT NULL
            THEN ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON($9), 4326))
            ELSE ST_SetSRID(ST_MakePoint($5, $6), 4326) END,
          CASE WHEN $9::text IS NOT NULL
            THEN ST_SetSRID(ST_GeomFromGeoJSON($9), 4326)::geometry(Polygon, 4326) END,
          $11, $7::jsonb, 'osm', $8, $10
         )
         ON CONFLICT (osm_type, osm_id) DO UPDATE SET
          code = EXCLUDED.code,
          category_id = EXCLUDED.category_id,
          name_vi = EXCLUDED.name_vi,
          name_en = EXCLUDED.name_en,
          geom_point = EXCLUDED.geom_point,
          geom_polygon = EXCLUDED.geom_polygon,
          attributes = EXCLUDED.attributes,
          floor = EXCLUDED.floor,
          source = 'osm',
          updated_at = now()`,
        [place.category, place.code, place.nameVi, place.nameEn, place.lng, place.lat,
          JSON.stringify({ osm_tags: place.tags }), place.osmType, polygon, place.osmId, place.floor],
      );
    }
    for (const place of MANUAL_CAMPUS_PLACES) {
      await client.query(
        `INSERT INTO places (category_id, code, name_vi, geom_point, attributes, source)
         VALUES (
           (SELECT id FROM categories WHERE code = $1), $2, $3,
           ST_SetSRID(ST_MakePoint($4, $5), 4326),
           jsonb_build_object('managed_by', 'campus_setup') || $6::jsonb, 'manual'
         )
         ON CONFLICT (code) DO UPDATE SET
           category_id = EXCLUDED.category_id,
           name_vi = EXCLUDED.name_vi,
           geom_point = EXCLUDED.geom_point,
           attributes = EXCLUDED.attributes,
           updated_at = now()
         WHERE places.source = 'manual'
           AND places.attributes->>'managed_by' = 'campus_setup'`,
        [place.category, place.code, place.nameVi, place.lng, place.lat, JSON.stringify(place.attributes ?? {})],
      );
    }
    await client.query(
      `DELETE FROM places
       WHERE source = 'osm'
         AND (osm_type, osm_id) NOT IN (
           SELECT * FROM unnest($1::varchar[], $2::bigint[])
         )`,
      [places.map((place) => place.osmType), places.map((place) => place.osmId)],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  console.log(`Replaced sample places with ${places.length} named OSM features.`);
  console.log(`OSM data timestamp: ${osm.osm3s?.timestamp_osm_base ?? 'unknown'} (© OpenStreetMap contributors, ODbL)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importOsmPlaces()
    .then(() => pool.end())
    .catch(async (error: unknown) => {
      console.error('❌ OSM place import failed:', error);
      await pool.end();
      process.exitCode = 1;
    });
}
