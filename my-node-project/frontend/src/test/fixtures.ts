import type { Category, Place } from '../types';

export function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'p-1',
    category_id: 1,
    code: 'A1',
    name_vi: 'Tòa A1',
    name_en: 'Building A1',
    description_vi: 'Mô tả tiếng Việt',
    description_en: 'English description',
    geom_point: { type: 'Point', coordinates: [105.7487, 20.9626] },
    geom_polygon: null,
    floor: null,
    opening_hours: null,
    contact_phone: null,
    contact_email: null,
    images: [],
    attributes: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    category_code: 'building',
    category_name_vi: 'Tòa nhà chính',
    category_name_en: 'Main Building',
    category_icon: 'building',
    category_color: '#1e3a8a',
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    code: 'building',
    name_vi: 'Tòa nhà chính',
    name_en: 'Main Building',
    icon: 'building',
    color: '#1e3a8a',
    sort_order: 10,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
