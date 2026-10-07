// =============================================
// Admin API client: write operations authenticated with the admin key
// =============================================

import type { Place, PlaceImage } from '../types';
import { ApiError } from './api';

const STORAGE_KEY = 'webgis.adminKey';

export const adminKey = {
  get(): string | null {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set(key: string): void {
    sessionStorage.setItem(STORAGE_KEY, key);
  },
  clear(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  },
};

/** Body accepted by POST/PATCH /api/places (see backend placeBodySchema). */
export interface PlacePayload {
  category_id?: number;
  code?: string | null;
  name_vi?: string;
  name_en?: string | null;
  description_vi?: string | null;
  description_en?: string | null;
  geom_point?: [number, number];
  geom_polygon?: { type: 'Polygon'; coordinates: number[][][] } | null;
  floor?: number | null;
  opening_hours?: Record<string, string> | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  images?: PlaceImage[];
  attributes?: Record<string, unknown>;
}

async function request<T>(method: string, url: string, key: string, body?: BodyInit | object): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetch(url, {
    method,
    headers: {
      'x-admin-key': key,
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export const adminApi = {
  /** Resolves when the key is accepted; throws ApiError(401) otherwise. */
  async verify(key: string): Promise<void> {
    await request('POST', '/api/auth/verify', key);
  },
  createPlace: (key: string, payload: PlacePayload) => request<Place>('POST', '/api/places', key, payload),
  updatePlace: (key: string, id: string, payload: PlacePayload) => request<Place>('PATCH', `/api/places/${id}`, key, payload),
  deletePlace: (key: string, id: string) => request<void>('DELETE', `/api/places/${id}`, key),
  async uploadImage(key: string, file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/api/uploads', key, form);
  },
};
