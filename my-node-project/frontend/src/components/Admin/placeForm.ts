// Pure helpers: place ↔ form state ↔ API payload (no React, easy to test).

import type { Place, PlaceImage } from '../../types';
import type { PlacePayload } from '../../services/adminApi';
import type { MessageKey } from '../../i18n';

export const AMENITY_KEYS = ['has_wifi', 'has_ac', 'has_projector', 'wheelchair_access', 'has_elevator'] as const;

export interface HoursRow {
  day: string;
  time: string;
}

export interface PlaceFormState {
  id?: string;
  code: string;
  category_id: string;
  name_vi: string;
  name_en: string;
  description_vi: string;
  description_en: string;
  floor: string;
  contact_phone: string;
  contact_email: string;
  /** Marker position, as typed (empty = none) */
  lat: string;
  lng: string;
  /** Polygon vertices [lng, lat], ring not closed */
  polygon: Array<[number, number]>;
  hours: HoursRow[];
  amenities: Record<string, boolean>;
  capacity: string;
  images: PlaceImage[];
  /** Attributes the form has no field for; kept untouched on save */
  extraAttributes: Record<string, unknown>;
}

export function emptyForm(): PlaceFormState {
  return {
    code: '', category_id: '', name_vi: '', name_en: '', description_vi: '', description_en: '',
    floor: '', contact_phone: '', contact_email: '', lat: '', lng: '', polygon: [],
    hours: [], amenities: {}, capacity: '', images: [], extraAttributes: {},
  };
}

/** Drop the closing vertex of a GeoJSON ring (first === last). */
function openRing(ring: number[][]): Array<[number, number]> {
  const points = ring.map(([lng, lat]) => [lng, lat] as [number, number]);
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 1 && first[0] === last[0] && first[1] === last[1]) points.pop();
  return points;
}

/** Average of the vertices: good enough for a marker inside a small, roughly convex footprint. */
export function polygonCentroid(vertices: Array<[number, number]>): [number, number] {
  const sum = vertices.reduce((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0]);
  return [sum[0] / vertices.length, sum[1] / vertices.length];
}

export function placeToForm(place: Place): PlaceFormState {
  const attributes = place.attributes ?? {};
  const amenities: Record<string, boolean> = {};
  const extraAttributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if ((AMENITY_KEYS as readonly string[]).includes(key)) amenities[key] = value === true;
    else if (key !== 'capacity') extraAttributes[key] = value;
  }
  const point = place.geom_point?.coordinates;
  return {
    id: place.id,
    code: place.code ?? '',
    category_id: place.category_id ? String(place.category_id) : '',
    name_vi: place.name_vi,
    name_en: place.name_en ?? '',
    description_vi: place.description_vi ?? '',
    description_en: place.description_en ?? '',
    floor: place.floor !== null && place.floor !== undefined ? String(place.floor) : '',
    contact_phone: place.contact_phone ?? '',
    contact_email: place.contact_email ?? '',
    lat: point ? String(point[1]) : '',
    lng: point ? String(point[0]) : '',
    polygon: place.geom_polygon?.coordinates?.[0] ? openRing(place.geom_polygon.coordinates[0]) : [],
    hours: Object.entries(place.opening_hours ?? {}).map(([day, time]) => ({ day, time: time ?? '' })),
    amenities,
    capacity: attributes.capacity ? String(attributes.capacity) : '',
    images: place.images ?? [],
    extraAttributes,
  };
}

export const hasValidPoint = (f: Pick<PlaceFormState, 'lat' | 'lng'>): boolean => {
  if (f.lat.trim() === '' || f.lng.trim() === '') return false;
  const lat = Number(f.lat);
  const lng = Number(f.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
};

/** Validation problems as message keys (empty when the form is valid). */
export function validateForm(f: PlaceFormState): MessageKey[] {
  const problems: MessageKey[] = [];
  if (!f.name_vi.trim()) problems.push('admin.validation.name');
  if (!f.category_id) problems.push('admin.validation.category');
  const typedCoordinates = f.lat.trim() !== '' || f.lng.trim() !== '';
  if (typedCoordinates && !hasValidPoint(f)) problems.push('admin.validation.coordinates');
  if (!typedCoordinates && f.polygon.length < 3) problems.push('admin.validation.geometry');
  if (f.polygon.length > 0 && f.polygon.length < 3) problems.push('admin.validation.geometry');
  if (f.floor.trim() !== '' && !Number.isInteger(Number(f.floor))) problems.push('admin.validation.floor');
  if (f.capacity.trim() !== '' && !(Number.isInteger(Number(f.capacity)) && Number(f.capacity) > 0)) {
    problems.push('admin.validation.capacity');
  }
  return [...new Set(problems)];
}

/**
 * Build the API body. `mode: 'update'` sends explicit nulls/empties for cleared
 * fields so they are actually removed; `create` simply omits them.
 */
export function formToPayload(f: PlaceFormState, mode: 'create' | 'update'): PlacePayload {
  const update = mode === 'update';
  const text = (v: string): string | null | undefined => {
    const trimmed = v.trim();
    return trimmed !== '' ? trimmed : update ? null : undefined;
  };

  const hours: Record<string, string> = {};
  for (const row of f.hours) {
    if (row.day.trim() && row.time.trim()) hours[row.day.trim()] = row.time.trim();
  }

  const attributes: Record<string, unknown> = { ...f.extraAttributes };
  for (const key of AMENITY_KEYS) if (f.amenities[key]) attributes[key] = true;
  if (f.capacity.trim() !== '') attributes.capacity = Number(f.capacity);

  const payload: PlacePayload = {
    category_id: Number(f.category_id),
    name_vi: f.name_vi.trim(),
    code: text(f.code),
    name_en: text(f.name_en),
    description_vi: text(f.description_vi),
    description_en: text(f.description_en),
    contact_phone: text(f.contact_phone),
    contact_email: text(f.contact_email),
    floor: f.floor.trim() !== '' ? Number(f.floor) : update ? null : undefined,
    opening_hours: Object.keys(hours).length > 0 ? hours : update ? null : undefined,
    images: f.images,
    attributes,
  };

  if (hasValidPoint(f)) payload.geom_point = [Number(f.lng), Number(f.lat)];
  else if (f.polygon.length >= 3) payload.geom_point = polygonCentroid(f.polygon);

  if (f.polygon.length >= 3) {
    payload.geom_polygon = { type: 'Polygon', coordinates: [[...f.polygon, f.polygon[0]]] };
  } else if (update) {
    payload.geom_polygon = null;
  }

  // Drop undefined keys so JSON stays minimal
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined)) as PlacePayload;
}
