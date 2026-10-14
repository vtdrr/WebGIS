// =============================================
// Phenikaa WebGIS - API Service
// =============================================

import type {
  Category,
  Place,
  PlaceQueryParams,
  PaginatedResponse,
  SearchParams,
  SearchResult,
  RoutingParams,
  RoutingResponse,
} from '../types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(public status: number, public data: unknown) {
    super(data instanceof Object && 'message' in data ? String(data.message) : 'API Error');
    this.name = 'ApiError';
  }
}

/** Build a query string, skipping undefined/null values. */
export function toQuery(params: object): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}

// Categories
export const categoriesApi = {
  list(): Promise<Category[]> {
    return fetchJson<Category[]>(`${API_BASE}/categories`);
  },

};

// Places
export const placesApi = {
  list(params: PlaceQueryParams = { page: 1, limit: 20, sort: 'name_vi', order: 'asc' }): Promise<PaginatedResponse<Place>> {
    return fetchJson(`${API_BASE}/places?${toQuery(params)}`);
  },

  search(params: SearchParams): Promise<{ data: SearchResult[]; meta: { query: string; took_ms: number } }> {
    return fetchJson(`${API_BASE}/places/search?${toQuery(params)}`);
  },

};

// Routing
export const routingApi = {
  getDirections(params: RoutingParams): Promise<RoutingResponse> {
    return fetchJson(`${API_BASE}/routing?${toQuery(params)}`);
  },
};

export { ApiError };
