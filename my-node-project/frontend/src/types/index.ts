// =============================================
// Phenikaa WebGIS - TypeScript Types
// =============================================

// Base types
export interface Point {
  lng: number;
  lat: number;
}

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  links: {
    self: string;
    next: string | null;
    prev: string | null;
  };
}

// Category
export interface Category {
  id: number;
  code: string;
  name_vi: string;
  name_en: string | null;
  icon: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  place_count?: number;
}

// Place
export interface OpeningHours {
  'mon-fri'?: string;
  sat?: string;
  sun?: string;
  [key: string]: string | undefined;
}

export interface PlaceImage {
  url: string;
  caption?: string;
  is_primary?: boolean;
}

export interface PlaceAttributes {
  capacity?: number;
  has_projector?: boolean;
  has_ac?: boolean;
  has_wifi?: boolean;
  wheelchair_access?: boolean;
  floors?: number;
  has_elevator?: boolean;
  [key: string]: unknown;
}

export interface Place {
  id: string;
  category_id: number | null;
  code: string | null;
  name_vi: string;
  name_en: string | null;
  description_vi: string | null;
  description_en: string | null;
  geom_point: GeoJSON.Point | null;
  geom_polygon: GeoJSON.Polygon | null;
  floor: number | null;
  opening_hours: OpeningHours | null;
  contact_phone: string | null;
  contact_email: string | null;
  images: PlaceImage[];
  attributes: PlaceAttributes;
  created_at: string;
  updated_at: string;
  // Joined category fields
  category_code: string | null;
  category_name_vi: string | null;
  category_name_en: string | null;
  category_icon: string | null;
  category_color: string | null;
  // Computed
  distance_m?: number;
}

export interface PlaceQueryParams extends PaginationParams {
  category?: string;
  q?: string;
  bbox?: string;
  floor?: number;
  has_polygon?: boolean;
  sort?: 'name_vi' | 'code' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
}

// Search
export interface SearchParams {
  q: string;
  limit?: number;
  category?: string;
}

export interface SearchResult extends Place {
  similarity?: number;
  rank?: number;
}

// Nearby
export interface NearbyParams {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
  category?: string;
}

// Routing
export interface RoutingParams {
  from: string; // "lat,lng"
  to: string;
  mode?: 'walk' | 'bike' | 'wheelchair';
  alternatives?: boolean;
  steps?: boolean;
  geometries?: 'geojson' | 'polyline' | 'polyline6';
}

export interface RoutingStep {
  name: string;
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString | string;
  maneuver: {
    type: string;
    location: [number, number];
    modifier?: string;
  };
  instruction?: string;
}

export interface RoutingResponse {
  routes: Array<{
    geometry: GeoJSON.LineString | string;
    distance: number;
    duration: number;
    weight: number;
    weight_name: string;
    legs: Array<{
      distance: number;
      duration: number;
      steps?: RoutingStep[];
      summary: string;
    }>;
  }>;
  waypoints: Array<{
    location: [number, number];
    name: string;
    distance: number;
  }>;
  meta: {
    mode: string;
    took_ms: number;
    fallback?: boolean;
    nodes?: number;
  };
}

// Map state
export interface MapState {
  center: [number, number];
  zoom: number;
  bounds: [[number, number], [number, number]] | null;
}

export const PHENIKAA_BOUNDS: [[number, number], [number, number]] = [
  [21.285, 105.780], // Southwest
  [21.290, 105.786]  // Northeast
];

export const PHENIKAA_CENTER: [number, number] = [21.2872, 105.7825];
export const PHENIKAA_ZOOM = 17;