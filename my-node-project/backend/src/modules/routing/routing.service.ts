import { query } from '../../db/pool.js';
import { createRequire } from 'node:module';

// =============================================
// Types
// =============================================

interface GraphNode {
  code: string;
  name: string;
  lng: number;
  lat: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  distanceM: number;
  pathName: string;
  // GeoJSON coordinates [[lng, lat], ...] from source to target
  coords: Array<[number, number]>;
}

type Coordinate = [number, number];
type ManualWalkwayFeature = {
  properties?: { name?: string; kind?: string; from?: string; to?: string };
  geometry:
    | { type: 'LineString'; coordinates: Coordinate[] }
    | { type: 'Polygon'; coordinates: Coordinate[][] }
    | { type: string; coordinates: unknown };
};

const walkwayGeoJSON = createRequire(import.meta.url)('./campus-walkways.json') as { features: ManualWalkwayFeature[] };
const WALKWAY_FEATURES = walkwayGeoJSON.features;
type GateRouteFeature = {
  properties?: {
    node_id?: string;
    name_vi?: string;
    kind?: string;
    place_code?: string;
    route_id?: string;
    from_node?: string;
    to_node?: string;
    bidirectional?: boolean;
    access?: string;
  };
  geometry:
    | { type: 'Point'; coordinates: Coordinate }
    | { type: 'LineString'; coordinates: Coordinate[] };
};
const gateRoutesGeoJSON = createRequire(import.meta.url)('./campus-gate-routes.json') as { features: GateRouteFeature[] };
const GATE_ROUTE_FEATURES = gateRoutesGeoJSON.features;
type CampusTransferNetwork = {
  transfer_points: Array<{ node_id: string; name_vi: string; place_code: string; level?: number }>;
  routes: Array<{
    route_id: string;
    name_vi: string;
    hub_node: string;
    from_node: string;
    to_node: string;
    coordinates: Coordinate[];
  }>;
};
const TRANSFER_NETWORK = createRequire(import.meta.url)('./campus-transfer-routes.json') as CampusTransferNetwork;
const MANUAL_PLACE_CODES: Record<string, string> = {
  A1: 'OSM-W-1113215768',
  A2: 'OSM-W-1183713531',
  A3: 'OSM-W-1183713520',
  A5: 'OSM-W-1183713521',
  A7: 'OSM-W-1183713522',
  A9: 'OSM-W-1179878047',
  A10: 'OSM-W-1179878048',
};

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
  /** True for straight connector legs that are not on mapped campus paths */
  off_network?: boolean;
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
    mode: 'walk';
    took_ms: number;
    fallback: boolean;
    nodes: number;
    /** Straight-line distance (m) walked outside the mapped path network */
    off_network_m?: number;
  };
}

/** Error with an HTTP status, so routes can return it to the client */
export class RoutingError extends Error {
  constructor(message: string, public statusCode = 422) {
    super(message);
    this.name = 'RoutingError';
  }
}

// Walking speed in metres per second (~5 km/h).
const WALK_SPEED = 1.39;

/** Endpoints farther than this from every path node are rejected */
export const MAX_ORIGIN_DISTANCE_M = 3000;
/** How many nearest path nodes are tried as entry/exit points */
const CANDIDATE_NODES = 3;
/**
 * Straight legs outside the mapped network count this many times when comparing entry
 * points, so routes prefer following known paths over cutting across unmapped terrain.
 */
const OFF_NETWORK_PENALTY = 2;
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

  type GraphRow = {
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
  };

  // Prefer the detailed OSM walking graph when one has been imported.
  const osmResult = await query<GraphRow>(`
    SELECT
      e.from_node_id::text AS source_code,
      'Giao lối đi bộ'::text AS source_name,
      ST_X(n1.geom) AS source_lng,
      ST_Y(n1.geom) AS source_lat,
      e.to_node_id::text AS target_code,
      'Giao lối đi bộ'::text AS target_name,
      ST_X(n2.geom) AS target_lng,
      ST_Y(n2.geom) AS target_lat,
      e.distance_m,
      e.name AS path_name,
      ST_AsGeoJSON(e.geom)::jsonb AS geom
    FROM campus_routing_edges e
    JOIN campus_routing_nodes n1 ON n1.osm_node_id = e.from_node_id
    JOIN campus_routing_nodes n2 ON n2.osm_node_id = e.to_node_id
  `);

  // Keep the original hand-entered graph as a compatibility fallback until OSM is imported.
  const legacyResult = osmResult.rows.length > 0 ? null : await query<GraphRow>(`
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
  const rows = osmResult.rows.length > 0 ? osmResult.rows : (legacyResult?.rows ?? []);

  const nodes = new Map<string, GraphNode>();
  const adjacency = new Map<string, GraphEdge[]>();

  const ensureNode = (code: string, name: string, lng: number, lat: number) => {
    if (!nodes.has(code)) {
      nodes.set(code, { code, name, lng, lat });
      adjacency.set(code, []);
    }
  };

  for (const row of rows) {
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

  // Add user-confirmed first-floor corridors and open space as a separate,
  // bidirectional pedestrian subgraph. The arrow-shaped polygons are marked
  // `ignore` in the accompanying GeoJSON and are intentionally not routable.
  const placeRows = await query<{ code: string; name_vi: string; lng: number; lat: number }>(
    `SELECT code, name_vi, ST_X(geom_point) AS lng, ST_Y(geom_point) AS lat
     FROM places WHERE code = ANY($1::varchar[]) AND geom_point IS NOT NULL`,
    [Object.values(MANUAL_PLACE_CODES)],
  );
  const manualPlaces = new Map(placeRows.rows.map((place) => [place.code, place]));
  const baseNodes = [...nodes.values()];
  const ensureManualNode = (code: string, name: string, lng: number, lat: number) => {
    if (!nodes.has(code)) {
      nodes.set(code, { code, name, lng, lat });
      adjacency.set(code, []);
    }
  };
  const addManualEdge = (
    fromCode: string,
    toCode: string,
    pathName: string,
    coords: Coordinate[],
    reversePathName = pathName,
  ) => {
    const from = nodes.get(fromCode);
    const to = nodes.get(toCode);
    if (!from || !to || fromCode === toCode || coords.length < 2) return;
    let distanceM = 0;
    for (let index = 1; index < coords.length; index++) {
      distanceM += haversineM(coords[index - 1][1], coords[index - 1][0], coords[index][1], coords[index][0]);
    }
    if (distanceM <= 0) return;
    const edge: GraphEdge = { from: fromCode, to: toCode, distanceM, pathName, coords };
    adjacency.get(fromCode)!.push(edge);
    adjacency.get(toCode)!.push({
      ...edge,
      from: toCode,
      to: fromCode,
      pathName: reversePathName,
      coords: [...coords].reverse(),
    });
  };

  if (manualPlaces.size > 0) {
  const accessPointById = new Map(
    GATE_ROUTE_FEATURES
      .filter((feature): feature is GateRouteFeature & { geometry: { type: 'Point'; coordinates: Coordinate } } =>
        feature.geometry.type === 'Point' && Boolean(feature.properties?.node_id),
      )
      .map((feature) => [feature.properties!.node_id!, feature]),
  );
  const ensureAccessPointNode = (nodeId: string) => {
    const feature = accessPointById.get(nodeId);
    if (!feature || feature.geometry.type !== 'Point') return;
    const [lng, lat] = feature.geometry.coordinates;
    ensureManualNode(nodeId, feature.properties?.name_vi ?? nodeId, lng, lat);
  };

  const savedRoutes = [
    ...GATE_ROUTE_FEATURES.filter(
      (feature): feature is GateRouteFeature & { geometry: { type: 'LineString'; coordinates: Coordinate[] } } =>
        feature.geometry.type === 'LineString' && Boolean(feature.properties?.from_node && feature.properties?.to_node),
    ).map((feature) => ({
      from: feature.properties!.from_node!,
      to: feature.properties!.to_node!,
      name: feature.properties!.name_vi ?? 'Lối đi đã khai báo',
      coordinates: feature.geometry.coordinates,
    })),
    ...TRANSFER_NETWORK.routes.map((route) => ({
      from: route.from_node,
      to: route.to_node,
      name: route.name_vi,
      coordinates: route.coordinates,
    })),
  ];
  for (const route of savedRoutes) {
    ensureAccessPointNode(route.from);
    ensureAccessPointNode(route.to);
  }
  for (const transferPoint of TRANSFER_NETWORK.transfer_points) ensureAccessPointNode(transferPoint.node_id);
  for (const route of savedRoutes) {
    const fromName = nodes.get(route.from)?.name ?? route.from;
    const toName = nodes.get(route.to)?.name ?? route.to;
    addManualEdge(
      route.from,
      route.to,
      route.name,
      route.coordinates,
      `Lối đi từ ${toName} đến ${fromName}`,
    );
  }

  for (const code of Object.values(MANUAL_PLACE_CODES)) {
    const place = manualPlaces.get(code);
    if (place) ensureManualNode(code, place.name_vi, place.lng, place.lat);
  }

  // Join explicitly mapped building/access points to indoor corridor nodes.
  for (const code of Object.values(MANUAL_PLACE_CODES)) {
    const place = manualPlaces.get(code);
    if (!place || !nodes.has(code)) continue;
    const accessPoints = GATE_ROUTE_FEATURES.filter(
      (feature) => feature.geometry.type === 'Point' && feature.properties?.place_code === code &&
        feature.properties.node_id && nodes.has(feature.properties.node_id),
    );
    for (const feature of accessPoints) {
      if (feature.geometry.type !== 'Point' || !feature.properties?.node_id) continue;
      addManualEdge(code, feature.properties.node_id, `Lối tiếp cận ${feature.properties.name_vi ?? place.name_vi}`, [
        [place.lng, place.lat],
        feature.geometry.coordinates,
      ]);
    }
  }
  }

  const corridorFeatures = WALKWAY_FEATURES.filter(
    (feature) => feature.properties?.kind === 'corridor' && feature.geometry.type === 'LineString',
  );
  const corridorByPair = new Map<string, { type: 'LineString'; coordinates: Coordinate[] }>(
    corridorFeatures.map((feature) => [
      `${feature.properties!.from}-${feature.properties!.to}`,
      feature.geometry as { type: 'LineString'; coordinates: Coordinate[] },
    ]),
  );
  const corridorA1A9 = corridorByPair.get('A1-A9');
  const corridorA2A10 = corridorByPair.get('A2-A10');
  const placePoint = (label: string): Coordinate | null => {
    const place = manualPlaces.get(MANUAL_PLACE_CODES[label]);
    return place ? [place.lng, place.lat] : null;
  };

  const a1 = placePoint('A1');
  const a2 = placePoint('A2');
  const a9 = placePoint('A9');
  const a10 = placePoint('A10');
  if (a1 && a9 && corridorA1A9) {
    addManualEdge(MANUAL_PLACE_CODES.A1, MANUAL_PLACE_CODES.A9, 'Hành lang tầng 1 A1–A9', [a1, ...corridorA1A9.coordinates, a9]);
  }
  if (a2 && a10 && corridorA2A10) {
    addManualEdge(MANUAL_PLACE_CODES.A2, MANUAL_PLACE_CODES.A10, 'Hành lang tầng 1 A2–A10', [a2, ...corridorA2A10.coordinates, a10]);
  }
  if (a9 && a10 && corridorA1A9 && corridorA2A10) {
    addManualEdge(
      MANUAL_PLACE_CODES.A9,
      MANUAL_PLACE_CODES.A10,
      'Lối thông tầng 1 A9–A10',
      [a9, corridorA1A9.coordinates.at(-1)!, corridorA2A10.coordinates.at(-1)!, a10],
    );
  }

  const openArea = WALKWAY_FEATURES.find(
    (feature) => feature.properties?.kind === 'walkable_area' && feature.geometry.type === 'Polygon',
  );
  if (openArea && openArea.geometry.type === 'Polygon') {
    const polygon = openArea.geometry as { type: 'Polygon'; coordinates: Coordinate[][] };
    const ring = polygon.coordinates[0] ?? [];
    const openRing = ring.length > 1 ? ring.slice(0, -1) : ring;
    if (openRing.length >= 3) {
      const center: Coordinate = [
        openRing.reduce((sum, point) => sum + point[0], 0) / openRing.length,
        openRing.reduce((sum, point) => sum + point[1], 0) / openRing.length,
      ];
      const areaNode = 'manual:open-area-A';
      ensureManualNode(areaNode, 'Không gian mở tầng 1 khu A', center[0], center[1]);
      for (const label of ['A2', 'A3', 'A5', 'A7']) {
        const point = placePoint(label);
        if (!point) continue;
        const boundary = pointInRing(point, openRing) ? point : closestPointOnRing(point, openRing);
        const path = sameCoordinate(point, boundary) ? [point, center] : [point, boundary, center];
        addManualEdge(MANUAL_PLACE_CODES[label], areaNode, `Lối đi qua không gian mở tầng 1 (${label})`, path);
      }
    }
  }

  // Connect the user-defined gates and transfer points to the outdoor OSM graph.
  if (osmResult.rows.length > 0 && manualPlaces.size > 0) {
    const connectorNodeIds = new Set([
      ...TRANSFER_NETWORK.transfer_points.map((point) => point.node_id),
      ...GATE_ROUTE_FEATURES
        .filter((feature) => feature.geometry.type === 'Point' && feature.properties?.kind === 'gate')
        .map((feature) => feature.properties?.node_id)
        .filter((nodeId): nodeId is string => Boolean(nodeId)),
    ]);
    for (const nodeId of connectorNodeIds) {
      const node = nodes.get(nodeId);
      if (!node || baseNodes.length === 0) continue;
      const nearest = baseNodes
        .map((candidate) => ({ node: candidate, distanceM: haversineM(node.lat, node.lng, candidate.lat, candidate.lng) }))
        .sort((left, right) => left.distanceM - right.distanceM)[0];
      if (!nearest || nearest.distanceM > 100) continue;
      addManualEdge(nodeId, nearest.node.code, `Lối nối từ ${node.name} tới mạng đường đi bộ`, [
        [node.lng, node.lat],
        [nearest.node.lng, nearest.node.lat],
      ]);
    }
  }

  graphCache = { nodes, adjacency, loadedAt: now };
  return graphCache;
}

/** Expose the assembled campus network for deterministic route-coverage tests. */
export async function getRoutingNetwork(): Promise<{
  nodes: Map<string, GraphNode>;
  adjacency: Map<string, GraphEdge[]>;
}> {
  return loadGraph();
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

function sameCoordinate(a: Coordinate, b: Coordinate): boolean {
  return Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10;
}

function pointInRing(point: Coordinate, ring: Coordinate[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = (yi > point[1]) !== (yj > point[1]) &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Closest point on a walkable area's ring, using a local lon/lat projection. */
function closestPointOnRing(point: Coordinate, ring: Coordinate[]): Coordinate {
  let best: Coordinate = ring[0];
  let bestDistance = Infinity;
  for (let index = 0; index < ring.length; index++) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const denominator = dx * dx + dy * dy;
    const t = denominator === 0
      ? 0
      : Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / denominator));
    const candidate: Coordinate = [start[0] + t * dx, start[1] + t * dy];
    const distance = haversineM(point[1], point[0], candidate[1], candidate[0]);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

interface NodeSnap {
  node: GraphNode;
  distanceM: number;
  endpoint?: Coordinate;
  endpointName?: string;
}

/** The k path-network nodes nearest to a point (straight-line distance), closest first. */
export function nearestNodes(nodes: Map<string, GraphNode>, lat: number, lng: number, k = CANDIDATE_NODES): NodeSnap[] {
  return [...nodes.values()]
    .map((node) => ({ node, distanceM: haversineM(lat, lng, node.lat, node.lng) }))
    .sort((x, y) => x.distanceM - y.distanceM)
    .slice(0, k);
}

/** Resolve a place coordinate to its explicitly defined access point(s), when available. */
async function routeNodeCandidates(
  nodes: Map<string, GraphNode>,
  lat: number,
  lng: number,
  fallbackName: string,
): Promise<NodeSnap[]> {
  const placeResult = await query<{ code: string; distance_m: number }>(
    `SELECT code,
            ST_Distance(geom_point::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
     FROM places WHERE geom_point IS NOT NULL
     ORDER BY geom_point <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
     LIMIT 1`,
    [lng, lat],
  );
  const place = placeResult.rows[0];
  const accessPoints = place && Number(place.distance_m) <= 5
    ? GATE_ROUTE_FEATURES.filter((feature) =>
        feature.geometry.type === 'Point' && feature.properties?.access === 'pedestrian' &&
        feature.properties.place_code === place.code,
      )
    : [];

  if (accessPoints.length === 0) {
    return nearestNodes(nodes, lat, lng).map((snap) => ({
      ...snap,
      endpoint: [lng, lat],
      endpointName: fallbackName,
    }));
  }

  const connectedAccessPoints = accessPoints.filter(
    (feature) => feature.properties?.node_id && nodes.has(feature.properties.node_id),
  );
  const usableAccessPoints = connectedAccessPoints.length > 0 ? connectedAccessPoints : accessPoints;
  const candidates = usableAccessPoints.flatMap((feature) => {
    if (feature.geometry.type !== 'Point') return [];
    const endpoint = feature.geometry.coordinates;
    const endpointName = feature.properties?.name_vi ?? fallbackName;
    const accessNode = feature.properties?.node_id ? nodes.get(feature.properties.node_id) : undefined;
    if (accessNode) {
      return [{ node: accessNode, distanceM: 0, endpoint, endpointName }];
    }
    const placeNode = nodes.get(place.code);
    if (placeNode) {
      return [{
        node: placeNode,
        distanceM: haversineM(endpoint[1], endpoint[0], placeNode.lat, placeNode.lng),
        endpoint,
        endpointName,
      }];
    }
    return nearestNodes(nodes, endpoint[1], endpoint[0]).map((snap) => ({ ...snap, endpoint, endpointName }));
  });

  // Different entrances can snap to the same graph node; keep the cheapest
  // access path to that node while preserving distinct graph alternatives.
  const bestByNode = new Map<string, NodeSnap>();
  for (const candidate of candidates) {
    const previous = bestByNode.get(candidate.node.code);
    if (!previous || candidate.distanceM < previous.distanceM) bestByNode.set(candidate.node.code, candidate);
  }
  return [...bestByNode.values()].sort((left, right) => left.distanceM - right.distanceM).slice(0, CANDIDATE_NODES * 3);
}

// Min-heap based Dijkstra
export function dijkstra(
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
  /**
   * Route between two coordinates.
   *
   * Both endpoints are connected by a straight leg to a node of the campus path
   * network (one of the nearest few, chosen to minimise the total length), and the
   * route between those nodes follows the mapped paths. This lets people start
   * outside the campus, e.g. at a bus stop: the leg to the entrance is flagged
   * `off_network` because there is no path data outside the campus.
   */
  async findRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ): Promise<RouteResult> {
    const start = Date.now();
    const preferredGateRoute = await this.findPreferredMainGateRoute(fromLat, fromLng, toLat, toLng, start);
    if (preferredGateRoute) return preferredGateRoute;
    const preferredDirectRoute = await this.findPreferredDeclaredRoute(fromLat, fromLng, toLat, toLng, start);
    if (preferredDirectRoute) return preferredDirectRoute;

    const speed = WALK_SPEED;

    const { nodes, adjacency } = await loadGraph();

    if (nodes.size === 0) {
      return this.fallbackRoute(fromLat, fromLng, toLat, toLng, speed, start, 'Điểm xuất phát', 'Điểm đến');
    }

    const [fromCandidates, toCandidates] = await Promise.all([
      routeNodeCandidates(nodes, fromLat, fromLng, 'Điểm xuất phát'),
      routeNodeCandidates(nodes, toLat, toLng, 'Điểm đến'),
    ]);

    if (fromCandidates.length === 0 || toCandidates.length === 0) {
      return this.fallbackRoute(fromLat, fromLng, toLat, toLng, speed, start, 'Điểm xuất phát', 'Điểm đến');
    }

    if (fromCandidates[0].distanceM > MAX_ORIGIN_DISTANCE_M) {
      throw new RoutingError(
        `Điểm xuất phát quá xa khuôn viên (${(fromCandidates[0].distanceM / 1000).toFixed(1)} km). Hãy chọn điểm gần trường hơn.`,
      );
    }
    if (toCandidates[0].distanceM > MAX_ORIGIN_DISTANCE_M) {
      throw new RoutingError(
        `Điểm đến quá xa khuôn viên (${(toCandidates[0].distanceM / 1000).toFixed(1)} km).`,
      );
    }

    // Pick the entry/exit pair with the lowest cost (off-network legs are penalised)
    let best: { fromSnap: NodeSnap; toSnap: NodeSnap; path: { distanceM: number; pathEdges: GraphEdge[] }; total: number } | null = null;
    for (const fromSnap of fromCandidates) {
      for (const toSnap of toCandidates) {
        const path = dijkstra(adjacency, fromSnap.node.code, toSnap.node.code);
        if (!path) continue;
        const total = OFF_NETWORK_PENALTY * (fromSnap.distanceM + toSnap.distanceM) + path.distanceM;
        if (!best || total < best.total) best = { fromSnap, toSnap, path, total };
      }
    }

    // Not connected, or both ends belong to the same node (no mapped path to follow)
    if (!best || best.path.pathEdges.length === 0) {
      const fromEndpoint = fromCandidates[0].endpoint ?? [fromLng, fromLat];
      const toEndpoint = toCandidates[0].endpoint ?? [toLng, toLat];
      return this.fallbackRoute(
        fromEndpoint[1], fromEndpoint[0], toEndpoint[1], toEndpoint[0], speed, start,
        fromCandidates[0].endpointName ?? fromCandidates[0].node.name,
        toCandidates[0].endpointName ?? toCandidates[0].node.name,
      );
    }

    const { fromSnap, toSnap, path: route } = best;
    const coordinates: Array<[number, number]> = [];
    const steps: RouteStep[] = [];
    let offNetworkM = 0;

    // Leg from the origin to the first path node
    const firstNode = fromSnap.node;
    if (fromSnap.distanceM > 1) {
      offNetworkM += fromSnap.distanceM;
      const fromEndpoint = fromSnap.endpoint ?? [fromLng, fromLat];
      coordinates.push(fromEndpoint);
      steps.push({
        name: 'Đường đến điểm bắt đầu',
        distance: fromSnap.distanceM,
        duration: fromSnap.distanceM / speed,
        geometry: { type: 'LineString', coordinates: [fromEndpoint, [firstNode.lng, firstNode.lat]] },
        maneuver: { type: 'depart', location: fromEndpoint },
        instruction: `Đi ${Math.round(fromSnap.distanceM)} m từ ${fromSnap.endpointName ?? 'điểm xuất phát'} đến ${firstNode.name} (chưa có dữ liệu đường cho đoạn này)`,
        off_network: true,
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
      const action = i === 0 ? 'Xuất phát' : 'Tiếp tục';
      const instruction = /^(?:từ |đường đi từ |lối đi từ )/i.test(edge.pathName)
        ? `${action} ${edge.pathName}`
        : `${action} theo ${edge.pathName} đến ${toNode?.name ?? edge.to} (${Math.round(segDistance)} m)`;

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
        instruction,
      });
    }

    // Leg from the last path node to the destination
    const lastNode = toSnap.node;
    if (toSnap.distanceM > 1) {
      offNetworkM += toSnap.distanceM;
      const toEndpoint = toSnap.endpoint ?? [toLng, toLat];
      coordinates.push(toEndpoint);
      totalDistance += toSnap.distanceM;
      steps.push({
        name: 'Đến điểm đích',
        distance: toSnap.distanceM,
        duration: toSnap.distanceM / speed,
        geometry: { type: 'LineString', coordinates: [[lastNode.lng, lastNode.lat], toEndpoint] },
        maneuver: { type: 'arrive', location: toEndpoint },
        instruction: `Đến ${lastNode.name}, còn ${Math.round(toSnap.distanceM)} m đến ${toSnap.endpointName ?? 'điểm đích'}`,
        off_network: true,
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
          weight_name: 'duration',
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
        {
          location: fromSnap.endpoint ?? [fromLng, fromLat],
          name: fromSnap.endpointName ?? fromSnap.node.name,
          distance: Math.round(fromSnap.distanceM),
        },
        {
          location: toSnap.endpoint ?? [toLng, toLat],
          name: toSnap.endpointName ?? toSnap.node.name,
          distance: Math.round(toSnap.distanceM),
        },
      ],
      meta: {
        mode: 'walk',
        took_ms: Date.now() - start,
        fallback: false,
        nodes: route.pathEdges.length + 1,
        off_network_m: Math.round(offNetworkM),
      },
    };
  }

  /** Use the user's drawn route from either campus gate in both directions. */
  private async findPreferredMainGateRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    startMs: number,
  ): Promise<RouteResult | null> {
    const gateAccessPoints = GATE_ROUTE_FEATURES.filter(
      (feature) => feature.geometry.type === 'Point' && feature.properties?.kind === 'gate' && feature.properties.place_code,
    );
    if (gateAccessPoints.length === 0) return null;
    const gateResult = await query<{ code: string; name_vi: string; lng: number; lat: number }>(
      `SELECT code, name_vi, ST_X(geom_point) AS lng, ST_Y(geom_point) AS lat
       FROM places WHERE code = ANY($1::varchar[]) AND geom_point IS NOT NULL`,
      [gateAccessPoints.map((feature) => feature.properties!.place_code!)],
    );
    const gatePlaces = new Map(gateResult.rows.map((place) => [place.code, place]));
    const findMatchingGate = (lat: number, lng: number) => gateAccessPoints.find((feature) => {
      if (feature.geometry.type !== 'Point' || !feature.properties?.place_code) return false;
      const place = gatePlaces.get(feature.properties.place_code);
      return place && haversineM(lat, lng, place.lat, place.lng) <= 35;
    });
    const fromGate = findMatchingGate(fromLat, fromLng);
    const toGate = findMatchingGate(toLat, toLng);
    const fromIsGate = Boolean(fromGate);
    const toIsGate = Boolean(toGate);
    if (fromIsGate === toIsGate) return null;
    const gateAccess = (fromGate ?? toGate)!;
    if (gateAccess.geometry.type !== 'Point' || !gateAccess.properties?.node_id || !gateAccess.properties.place_code) return null;
    const gatePlace = gatePlaces.get(gateAccess.properties.place_code);
    if (!gatePlace) return null;

    const nearestPlace = async (lat: number, lng: number) => {
      const result = await query<{
      code: string;
      name_vi: string;
      lng: number;
      lat: number;
      distance_m: number;
      }>(
        `SELECT code, name_vi, ST_X(geom_point) AS lng, ST_Y(geom_point) AS lat,
                ST_Distance(geom_point::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
         FROM places WHERE geom_point IS NOT NULL
         ORDER BY geom_point <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
         LIMIT 1`,
        [lng, lat],
      );
      const place = result.rows[0];
      return place && Number(place.distance_m) <= 5 ? place : null;
    };

    const otherPlace = fromIsGate ? await nearestPlace(toLat, toLng) : await nearestPlace(fromLat, fromLng);
    if (!otherPlace) return null;

    const preferred = GATE_ROUTE_FEATURES.find((route) => {
      if (route.geometry.type !== 'LineString' || route.properties?.from_node !== gateAccess.properties?.node_id) return false;
      const endNode = GATE_ROUTE_FEATURES.find(
        (point) => point.geometry.type === 'Point' && point.properties?.node_id === route.properties?.to_node,
      );
      return endNode?.properties?.place_code === otherPlace.code;
    });
    if (!preferred || preferred.geometry.type !== 'LineString' || preferred.geometry.coordinates.length < 2) return null;
    const otherAccess = GATE_ROUTE_FEATURES.find(
      (feature) => feature.geometry.type === 'Point' && feature.properties?.node_id === preferred.properties?.to_node &&
        feature.properties?.place_code === otherPlace.code,
    );
    if (!otherAccess || otherAccess.geometry.type !== 'Point') return null;

    const routeCoordinates = preferred.geometry.coordinates;
    if (haversineM(routeCoordinates[0][1], routeCoordinates[0][0], gateAccess.geometry.coordinates[1], gateAccess.geometry.coordinates[0]) > 2 ||
        haversineM(routeCoordinates.at(-1)![1], routeCoordinates.at(-1)![0], otherAccess.geometry.coordinates[1], otherAccess.geometry.coordinates[0]) > 2) return null;
    const fromAccess = fromIsGate ? gateAccess : otherAccess;
    const toAccess = fromIsGate ? otherAccess : gateAccess;
    const coordinates = fromIsGate ? routeCoordinates : [...routeCoordinates].reverse();
    const name = fromIsGate
      ? preferred.properties?.name_vi ?? `Lối đi từ ${gateAccess.properties.name_vi} đến ${otherPlace.name_vi}`
      : `Lối đi từ ${otherAccess.properties?.name_vi ?? otherPlace.name_vi} đến ${gateAccess.properties.name_vi}`;

    let distance = 0;
    for (let index = 1; index < coordinates.length; index++) {
      distance += haversineM(coordinates[index - 1][1], coordinates[index - 1][0], coordinates[index][1], coordinates[index][0]);
    }
    const duration = distance / WALK_SPEED + 2;
    const fromLocation = fromAccess.geometry.type === 'Point' ? fromAccess.geometry.coordinates : coordinates[0];
    const toLocation = toAccess.geometry.type === 'Point' ? toAccess.geometry.coordinates : coordinates.at(-1)!;
    const fromPlace = fromIsGate ? gatePlace : otherPlace;
    const toPlace = fromIsGate ? otherPlace : gatePlace;

    return {
      routes: [{
        geometry: { type: 'LineString', coordinates },
        distance: Math.round(distance),
        duration: Math.round(duration),
        weight: Math.round(duration),
        weight_name: 'duration',
        legs: [{
          distance: Math.round(distance),
          duration: Math.round(duration),
          summary: name,
          steps: [{
            name,
            distance,
            duration,
            geometry: { type: 'LineString', coordinates },
            maneuver: { type: 'depart', location: fromLocation },
            instruction: name,
          }],
        }],
      }],
      waypoints: [
        {
          location: fromLocation,
          name: fromAccess.properties?.name_vi ?? fromPlace.name_vi,
          distance: Math.round(haversineM(fromLat, fromLng, fromLocation[1], fromLocation[0])),
        },
        {
          location: toLocation,
          name: toAccess.properties?.name_vi ?? toPlace.name_vi,
          distance: Math.round(haversineM(toLat, toLng, toLocation[1], toLocation[0])),
        },
      ],
      meta: { mode: 'walk', took_ms: Date.now() - startMs, fallback: false, nodes: coordinates.length, off_network_m: 0 },
    };
  }

  /** Use an explicitly drawn direct path before searching for a transfer-point route. */
  private async findPreferredDeclaredRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    startMs: number,
  ): Promise<RouteResult | null> {
    const nearestPlace = async (lat: number, lng: number) => {
      const result = await query<{ code: string; name_vi: string; distance_m: number }>(
        `SELECT code, name_vi,
                ST_Distance(geom_point::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
         FROM places WHERE geom_point IS NOT NULL
         ORDER BY geom_point <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
         LIMIT 1`,
        [lng, lat],
      );
      const place = result.rows[0];
      return place && Number(place.distance_m) <= 5 ? place : null;
    };

    const [fromPlace, toPlace] = await Promise.all([
      nearestPlace(fromLat, fromLng),
      nearestPlace(toLat, toLng),
    ]);
    if (!fromPlace || !toPlace || fromPlace.code === toPlace.code) return null;

    const accessPoints = new Map(
      GATE_ROUTE_FEATURES
        .filter((feature) => feature.geometry.type === 'Point' && feature.properties?.place_code && feature.properties.node_id)
        .map((feature) => [feature.properties!.node_id!, feature]),
    );
    const fromNodeIds = new Set(
      [...accessPoints.values()]
        .filter((feature) => feature.properties?.place_code === fromPlace.code)
        .map((feature) => feature.properties!.node_id!),
    );
    const toNodeIds = new Set(
      [...accessPoints.values()]
        .filter((feature) => feature.properties?.place_code === toPlace.code)
        .map((feature) => feature.properties!.node_id!),
    );
    if (fromNodeIds.size === 0 || toNodeIds.size === 0) return null;

    const declaredRoutes = [
      ...GATE_ROUTE_FEATURES.filter(
        (feature) => feature.geometry.type === 'LineString' && feature.properties?.from_node && feature.properties?.to_node,
      ).map((feature) => ({
        from: feature.properties!.from_node!,
        to: feature.properties!.to_node!,
        name: feature.properties!.name_vi ?? 'Lối đi đã khai báo',
        coordinates: (feature.geometry as { type: 'LineString'; coordinates: Coordinate[] }).coordinates,
      })),
      ...TRANSFER_NETWORK.routes.map((route) => ({
        from: route.from_node,
        to: route.to_node,
        name: route.name_vi,
        coordinates: route.coordinates,
      })),
    ];

    let best: { route: (typeof declaredRoutes)[number]; reversed: boolean; distance: number } | null = null;
    for (const route of declaredRoutes) {
      const forward = fromNodeIds.has(route.from) && toNodeIds.has(route.to);
      const reverse = toNodeIds.has(route.from) && fromNodeIds.has(route.to);
      if (!forward && !reverse) continue;
      const coordinates = forward ? route.coordinates : [...route.coordinates].reverse();
      let distance = 0;
      for (let index = 1; index < coordinates.length; index++) {
        distance += haversineM(coordinates[index - 1][1], coordinates[index - 1][0], coordinates[index][1], coordinates[index][0]);
      }
      if (!best || distance < best.distance) best = { route, reversed: !forward, distance };
    }
    if (!best) return null;

    const coordinates = best.reversed ? [...best.route.coordinates].reverse() : best.route.coordinates;
    const fromAccess = accessPoints.get(best.reversed ? best.route.to : best.route.from);
    const toAccess = accessPoints.get(best.reversed ? best.route.from : best.route.to);
    if (!fromAccess || !toAccess || fromAccess.geometry.type !== 'Point' || toAccess.geometry.type !== 'Point') return null;
    const name = best.reversed
      ? `Lối đi từ ${fromAccess.properties?.name_vi ?? fromPlace.name_vi} đến ${toAccess.properties?.name_vi ?? toPlace.name_vi}`
      : best.route.name;
    const duration = best.distance / WALK_SPEED + 2;
    const fromLocation = fromAccess.geometry.coordinates;
    const toLocation = toAccess.geometry.coordinates;

    return {
      routes: [{
        geometry: { type: 'LineString', coordinates },
        distance: Math.round(best.distance),
        duration: Math.round(duration),
        weight: Math.round(duration),
        weight_name: 'duration',
        legs: [{
          distance: Math.round(best.distance),
          duration: Math.round(duration),
          summary: name,
          steps: [{
            name,
            distance: best.distance,
            duration,
            geometry: { type: 'LineString', coordinates },
            maneuver: { type: 'depart', location: fromLocation },
            instruction: name,
          }],
        }],
      }],
      waypoints: [
        { location: fromLocation, name: fromAccess.properties?.name_vi ?? fromPlace.name_vi, distance: 0 },
        { location: toLocation, name: toAccess.properties?.name_vi ?? toPlace.name_vi, distance: 0 },
      ],
      meta: { mode: 'walk', took_ms: Date.now() - startMs, fallback: false, nodes: coordinates.length, off_network_m: 0 },
    };
  }

  private fallbackRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    speed: number,
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
        mode: 'walk',
        took_ms: Date.now() - startMs,
        fallback: true,
        nodes: 0,
      },
    };
  }
}

export const routingService = new RoutingService();
