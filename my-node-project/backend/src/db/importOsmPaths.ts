import { pathToFileURL } from 'node:url';
import { getClient, pool } from './pool.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DEFAULT_BBOX = [20.956, 105.742, 20.970, 105.756] as const; // south, west, north, east
const WALKABLE_HIGHWAYS = ['footway', 'path', 'pedestrian', 'steps', 'living_street', 'residential', 'service', 'unclassified'];

interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry: Array<{ lat: number; lon: number }>;
  tags: Record<string, string>;
}

interface OsmResponse {
  elements: OsmWay[];
  osm3s?: { timestamp_osm_base?: string };
}

interface RoutingSegment {
  wayId: string;
  index: number;
  fromNodeId: string;
  toNodeId: string;
  distanceM: number;
  name: string;
  highway: string;
  coordinates: Array<[number, number]>;
}

function parseBbox(args: string[]): [number, number, number, number] {
  const raw = args.find((arg) => arg.startsWith('--bbox='))?.slice('--bbox='.length);
  if (!raw) return [...DEFAULT_BBOX];
  const values = raw.split(',').map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error('Expected --bbox=south,west,north,east');
  }
  const [south, west, north, east] = values;
  if (south < -90 || north > 90 || south >= north || west < -180 || east > 180 || west >= east) {
    throw new Error('Bounding box coordinates are invalid');
  }
  return [south, west, north, east];
}

async function fetchOsmWays(bbox: [number, number, number, number]): Promise<OsmResponse> {
  const highwayPattern = WALKABLE_HIGHWAYS.join('|');
  const query = `[out:json][timeout:60];way["highway"~"^(${highwayPattern})$"]["access"!="no"]["foot"!="no"](${bbox.join(',')});out geom;`;
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'Phenikaa-WebGIS/1.0 (campus walking directions)',
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const details = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`Overpass API returned HTTP ${response.status}${details ? `: ${details}` : ''}`);
  }
  return (await response.json()) as OsmResponse;
}

function distanceM(a: [number, number], b: [number, number]): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function defaultWayName(highway: string): string {
  const names: Record<string, string> = {
    footway: 'Lối đi bộ',
    path: 'Lối đi bộ',
    pedestrian: 'Đường dành cho người đi bộ',
    steps: 'Cầu thang',
    living_street: 'Đường nội bộ',
    residential: 'Đường nội bộ',
    service: 'Đường nội bộ',
    unclassified: 'Đường đi bộ',
  };
  return names[highway] ?? 'Đường đi bộ';
}

function buildNetwork(ways: OsmWay[]): { nodes: Map<string, [number, number]>; segments: RoutingSegment[] } {
  const useCount = new Map<string, number>();
  const pointById = new Map<string, [number, number]>();

  for (const way of ways) {
    if (!Array.isArray(way.nodes) || way.nodes.length < 2 || way.nodes.length !== way.geometry?.length) continue;
    way.nodes.forEach((id, index) => {
      const key = String(id);
      const point = way.geometry[index];
      if (!Number.isFinite(point.lon) || !Number.isFinite(point.lat)) return;
      useCount.set(key, (useCount.get(key) ?? 0) + 1);
      pointById.set(key, [point.lon, point.lat]);
    });
  }

  const nodes = new Map<string, [number, number]>();
  const segments: RoutingSegment[] = [];
  for (const way of ways) {
    if (!Array.isArray(way.nodes) || way.nodes.length < 2 || way.nodes.length !== way.geometry?.length) continue;
    const highway = way.tags?.highway;
    if (!highway) continue;
    const wayNodes = way.nodes.map(String);
    const points = way.geometry.map(({ lon, lat }) => [lon, lat] as [number, number]);
    let segmentStart = 0;
    let segmentIndex = 0;

    for (let i = 1; i < wayNodes.length; i++) {
      const isJunction = i === wayNodes.length - 1 || (useCount.get(wayNodes[i]) ?? 0) > 1;
      if (!isJunction) continue;

      const fromNodeId = wayNodes[segmentStart];
      const toNodeId = wayNodes[i];
      const coordinates = points.slice(segmentStart, i + 1);
      if (fromNodeId !== toNodeId && coordinates.length >= 2) {
        let length = 0;
        for (let j = 1; j < coordinates.length; j++) length += distanceM(coordinates[j - 1], coordinates[j]);
        if (length > 0) {
          nodes.set(fromNodeId, pointById.get(fromNodeId)!);
          nodes.set(toNodeId, pointById.get(toNodeId)!);
          segments.push({
            wayId: String(way.id),
            index: segmentIndex++,
            fromNodeId,
            toNodeId,
            distanceM: length,
            name: way.tags.name || defaultWayName(highway),
            highway,
            coordinates,
          });
        }
      }
      segmentStart = i;
    }
  }
  return { nodes, segments };
}

async function importOsmPaths(): Promise<void> {
  const bbox = parseBbox(process.argv.slice(2));
  console.log(`Fetching walkable OSM ways in bbox ${bbox.join(',')}...`);
  const osm = await fetchOsmWays(bbox);
  const ways = osm.elements.filter((element): element is OsmWay => element.type === 'way');
  const network = buildNetwork(ways);
  if (network.nodes.size === 0 || network.segments.length === 0) {
    throw new Error('No usable pedestrian network returned; existing routing data was not changed');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE campus_routing_edges, campus_routing_nodes');
    for (const [id, [lng, lat]] of network.nodes) {
      await client.query(
        'INSERT INTO campus_routing_nodes (osm_node_id, geom) VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326))',
        [id, lng, lat],
      );
    }
    for (const segment of network.segments) {
      await client.query(
        `INSERT INTO campus_routing_edges
          (source_way_id, segment_index, from_node_id, to_node_id, distance_m, name, highway, geom)
         VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_GeomFromGeoJSON($8), 4326))`,
        [
          segment.wayId,
          segment.index,
          segment.fromNodeId,
          segment.toNodeId,
          segment.distanceM,
          segment.name,
          segment.highway,
          JSON.stringify({ type: 'LineString', coordinates: segment.coordinates }),
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  console.log(`Imported ${network.nodes.size} network junctions and ${network.segments.length} path segments.`);
  console.log(`OSM data timestamp: ${osm.osm3s?.timestamp_osm_base ?? 'unknown'} (© OpenStreetMap contributors, ODbL)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importOsmPaths()
    .then(() => pool.end())
    .catch(async (error: unknown) => {
      console.error('❌ OSM path import failed:', error);
      await pool.end();
      process.exitCode = 1;
    });
}
