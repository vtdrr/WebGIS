import { query } from '../../db/pool.js';

// =============================================
// Types
// =============================================

export type RoutingMode = 'walk' | 'bike' | 'wheelchair';

interface GraphNode {
  code: string;
  name: string;
  lng: number;
  lat: number;
}

interface GraphEdge {
  from: string;
  to: string;
  distanceM: number;
  pathName: string;
  // GeoJSON coordinates [[lng, lat], ...] from source to target
  coords: Array<[number, number]>;
}

interface RouteStep {
  name: string;
  distance: number; // meters
  duration: number; // seconds
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
  maneuver: {
    type: 'depart' | 'turn' | 'arrive';
    location: [number, number]; // [lng, lat]
    modifier?: string;
  };
  instruction: string;
}

export interface RouteResult {
  routes: Array<{
    geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
    distance: number;
    duration: number;
    weight: number;
    weight_name: string;
    legs: Array<{
      distance: number;
      duration: number;
      summary: string;
      steps: RouteStep[];
    }>;
  }>;
  waypoints: Array<{
    location: [number, number]; // [lng, lat]
    name: string;
    distance: number;
  }>;
  meta: {
    mode: string;
    took_ms: number;
    fallback: boolean;
    nodes: number;
  };
}

// Walking / biking / wheelchair speeds (m/s)
const MODE_SPEED: Record<RoutingMode, number> = {
  walk: 1.39,      // ~5 km/h
  bike: 4.17,      // ~15 km/h
  wheelchair: 1.11, // ~4 km/h
};

const MAX_SNAP_DISTANCE_M = 500;
const GRAPH_CACHE_TTL_MS = 60_000;

// =============================================
// Graph cache
// =============================================

let graphCache: {
  nodes: Map<string, GraphNode>;
  adjacency: Map<string, GraphEdge[]>;
  loadedAt: number;
} | null = null;

async function loadGraph(): Promise<{
  nodes: Map<string, GraphNode>;
  adjacency: Map<string, GraphEdge[]>;
}> {
  const now = Date.now();
  if (graphCache && now - graphCache.loadedAt < GRAPH_CACHE_TTL_MS) {
    return graphCache;
  }

  const result = await query<{
    source_code: string;
    source_name: string;
    source_lng: number;
    source_lat: number;
    target_code: string;
    target_name: string;
    target_lng: number;
    target_lat: number;
    distance_m: number;
    path_name: string;
    geom: { type: string; coordinates: Array<[number, number]> };
  }>(`
    SELECT
      p1.code AS source_code,
      p1.name_vi AS source_name,
      ST_X(p1.geom_point) AS source_lng,
      ST_Y(p1.geom_point) AS source_lat,
      p2.code AS target_code,
      p2.name_vi AS target_name,
      ST_X(p2.geom_point) AS target_lng,
      ST_Y(p2.geom_point) AS target_lat,
      cp.distance_m,
      COALESCE(cp.path_name, 'Đường nội bộ') AS path_name,
      ST_AsGeoJSON(cp.geom)::jsonb AS geom
    FROM campus_paths cp
    JOIN places p1 ON p1.code = cp.source_code
    JOIN places p2 ON p2.code = cp.target_code
    WHERE p1.geom_point IS NOT NULL AND p2.geom_point IS NOT NULL
  `);

  const nodes = new Map<string, GraphNode>();
  const adjacency = new Map<string, GraphEdge[]>();

  const ensureNode = (code: string, name: string, lng: number, lat: number) => {
    if (!nodes.has(code)) {
      nodes.set(code, { code, name, lng, lat });
      adjacency.set(code, []);
    }
  };

  for (const row of result.rows) {
    ensureNode(row.source_code, row.source_name, row.source_lng, row.source_lat);
    ensureNode(row.target_code, row.target_name, row.target_lng, row.target_lat);

    const coords = row.geom.coordinates;
    const edge: GraphEdge = {
      from: row.source_code,
      to: row.target_code,
      distanceM: Number(row.distance_m),
      pathName: row.path_name,
      coords,
    };
    // Undirected graph: both directions
    adjacency.get(row.source_code)!.push(edge);
    adjacency.get(row.target_code)!.push({ ...edge, from: row.target_code, to: row.source_code, coords: [...coords].reverse() });
  }

  graphCache = { nodes, adjacency, loadedAt: now };
  return graphCache;
}

export function invalidateGraphCache(): void {
  graphCache = null;
}

// =============================================
// Helpers
// =============================================

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function snapToNode(lat: number, lng: number): Promise<{ node: GraphNode; distanceM: number } | null> {
  const result = await query<{
    code: string;
    name_vi: string;
    lng: number;
    lat: number;
    dist_m: number;
  }>(`
    SELECT
      code,
      name_vi,
      ST_X(geom_point) AS lng,
      ST_Y(geom_point) AS lat,
      ST_Distance(geom_point::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS dist_m
    FROM places
    WHERE geom_point IS NOT NULL
    ORDER BY geom_point <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
    LIMIT 1
  `, [lng, lat]);

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    node: { code: row.code, name: row.name_vi, lng: row.lng, lat: row.lat },
    distanceM: Number(row.dist_m),
  };
}

// Min-heap based Dijkstra
function dijkstra(
  adjacency: Map<string, GraphEdge[]>,
  start: string,
  goal: string,
): { distanceM: number; pathEdges: GraphEdge[] } | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; edge: GraphEdge }>();
  dist.set(start, 0);

  // Simple binary min-heap of [distance, node]
  const heap: Array<[number, string]> = [[0, start]];
  const push = (item: [number, string]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = (): [number, string] | undefined => {
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < heap.length && heap[l][0] < heap[smallest][0]) smallest = l;
        if (r < heap.length && heap[r][0] < heap[smallest][0]) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  };

  while (heap.length > 0) {
    const current = pop();
    if (!current) break;
    const [d, u] = current;

    if (u === goal) break;
    if (d > (dist.get(u) ?? Infinity)) continue;

    for (const edge of adjacency.get(u) ?? []) {
      const alt = d + edge.distanceM;
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, { node: u, edge });
        push([alt, edge.to]);
      }
    }
  }

  if (!prev.has(goal) && start !== goal) return null;

  // Reconstruct path
  const pathEdges: GraphEdge[] = [];
  let current = goal;
  while (current !== start) {
    const p = prev.get(current);
    if (!p) return null;
    pathEdges.unshift(p.edge);
    current = p.node;
  }

  return { distanceM: dist.get(goal) ?? 0, pathEdges };
}

// =============================================
// Routing service
// =============================================

export class RoutingService {
  async findRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    mode: RoutingMode = 'walk',
    _alternatives = false,
  ): Promise<RouteResult> {
    const start = Date.now();
    const speed = MODE_SPEED[mode];

    const { nodes, adjacency } = await loadGraph();

    if (nodes.size === 0) {
      return this.fallbackRoute(fromLat, fromLng, toLat, toLng, speed, mode, start, 'Điểm xuất phát', 'Điểm đến');
    }

    const fromSnap = await snapToNode(fromLat, fromLng);
    const toSnap = await snapToNode(toLat, toLng);

    // If either endpoint is too far from the road network, return straight-line route
    if (
      !fromSnap || !toSnap ||
      fromSnap.distanceM > MAX_SNAP_DISTANCE_M ||
      toSnap.distanceM > MAX_SNAP_DISTANCE_M
    ) {
      return this.fallbackRoute(
        fromLat, fromLng, toLat, toLng, speed, mode, start,
        fromSnap?.node.name ?? 'Điểm xuất phát',
        toSnap?.node.name ?? 'Điểm đến',
      );
    }

    const route = dijkstra(adjacency, fromSnap.node.code, toSnap.node.code);

    if (!route || route.pathEdges.length === 0) {
      return this.fallbackRoute(fromLat, fromLng, toLat, toLng, speed, mode, start, fromSnap.node.name, toSnap.node.name);
    }

    // Stitch geometry from edge coordinates
    const coordinates: Array<[number, number]> = [];
    const steps: RouteStep[] = [];

    // Add leg from user position to first node
    const firstNode = fromSnap.node;
    if (fromSnap.distanceM > 1) {
      coordinates.push([fromLng, fromLat]);
      steps.push({
        name: 'Đường đến điểm bắt đầu',
        distance: fromSnap.distanceM,
        duration: fromSnap.distanceM / speed,
        geometry: { type: 'LineString', coordinates: [[fromLng, fromLat], [firstNode.lng, firstNode.lat]] },
        maneuver: { type: 'depart', location: [fromLng, fromLat] },
        instruction: `Đi bộ đến ${firstNode.name} (${Math.round(fromSnap.distanceM)} m)`,
      });
    }
    coordinates.push([firstNode.lng, firstNode.lat]);

    let totalDistance = fromSnap.distanceM;
    for (let i = 0; i < route.pathEdges.length; i++) {
      const edge = route.pathEdges[i];
      const segCoords: Array<[number, number]> =
        edge.coords.length > 0 ? edge.coords : ([[firstNode.lng, firstNode.lat]] as Array<[number, number]>);

      // Skip the first coordinate if it duplicates the last appended one
      const last = coordinates[coordinates.length - 1];
      const startIndex =
        last && Math.abs(segCoords[0][0] - last[0]) < 1e-9 && Math.abs(segCoords[0][1] - last[1]) < 1e-9 ? 1 : 0;
      for (let j = startIndex; j < segCoords.length; j++) {
        coordinates.push(segCoords[j]);
      }

      const segDistance = edge.distanceM;
      totalDistance += segDistance;
      const segDuration = segDistance / speed;
      const toNode = nodes.get(edge.to);

      steps.push({
        name: edge.pathName,
        distance: segDistance,
        duration: segDuration,
        geometry: { type: 'LineString', coordinates: segCoords },
        maneuver: {
          type: i === route.pathEdges.length - 1 ? 'arrive' : 'turn',
          location: segCoords[segCoords.length - 1],
          modifier: 'straight',
        },
        instruction: `${i === 0 ? 'Xuất phát' : 'Tiếp tục'} theo ${edge.pathName} đến ${toNode?.name ?? edge.to} (${Math.round(segDistance)} m)`,
      });
    }

    // Add leg from last node to user destination
    const lastNode = toSnap.node;
    if (toSnap.distanceM > 1) {
      coordinates.push([toLng, toLat]);
      totalDistance += toSnap.distanceM;
      steps.push({
        name: 'Đến điểm đích',
        distance: toSnap.distanceM,
        duration: toSnap.distanceM / speed,
        geometry: { type: 'LineString', coordinates: [[lastNode.lng, lastNode.lat], [toLng, toLat]] },
        maneuver: { type: 'arrive', location: [toLng, toLat] },
        instruction: `Đến ${lastNode.name}, còn ${Math.round(toSnap.distanceM)} m đến điểm đích`,
      });
    }

    const totalDuration = totalDistance / speed + steps.length * 2; // small transfer penalty

    return {
      routes: [
        {
          geometry: { type: 'LineString', coordinates },
          distance: Math.round(totalDistance),
          duration: Math.round(totalDuration),
          weight: Math.round(totalDuration),
          weight_name: mode === 'bike' ? 'routability' : 'duration',
          legs: [
            {
              distance: Math.round(totalDistance),
              duration: Math.round(totalDuration),
              summary: `${fromSnap.node.name} → ${toSnap.node.name}`,
              steps,
            },
          ],
        },
      ],
      waypoints: [
        { location: [fromLng, fromLat], name: fromSnap.node.name, distance: Math.round(fromSnap.distanceM) },
        { location: [toLng, toLat], name: toSnap.node.name, distance: Math.round(toSnap.distanceM) },
      ],
      meta: {
        mode,
        took_ms: Date.now() - start,
        fallback: false,
        nodes: route.pathEdges.length + 1,
      },
    };
  }

  private fallbackRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    speed: number,
    mode: RoutingMode,
    startMs: number,
    fromName: string,
    toName: string,
  ): RouteResult {
    const distance = haversineM(fromLat, fromLng, toLat, toLng);
    const duration = distance / speed;

    return {
      routes: [
        {
          geometry: {
            type: 'LineString',
            coordinates: [
              [fromLng, fromLat],
              [toLng, toLat],
            ],
          },
          distance: Math.round(distance),
          duration: Math.round(duration),
          weight: Math.round(duration),
          weight_name: 'duration',
          legs: [
            {
              distance: Math.round(distance),
              duration: Math.round(duration),
              summary: `${fromName} → ${toName} (đường chim bay)`,
              steps: [
                {
                  name: 'Đường trực tiếp',
                  distance: Math.round(distance),
                  duration: Math.round(duration),
                  geometry: {
                    type: 'LineString',
                    coordinates: [
                      [fromLng, fromLat],
                      [toLng, toLat],
                    ],
                  },
                  maneuver: { type: 'depart', location: [fromLng, fromLat] },
                  instruction: `Đi thẳng đến ${toName} (không có dữ liệu đường đi chi tiết)`,
                },
              ],
            },
          ],
        },
      ],
      waypoints: [
        { location: [fromLng, fromLat], name: fromName, distance: 0 },
        { location: [toLng, toLat], name: toName, distance: 0 },
      ],
      meta: {
        mode,
        took_ms: Date.now() - startMs,
        fallback: true,
        nodes: 0,
      },
    };
  }
}

export const routingService = new RoutingService();
