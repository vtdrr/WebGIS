import { z } from 'zod';

// =============================================
// Common schemas
// =============================================

export const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const bboxSchema = z.object({
  minLng: z.coerce.number().min(-180).max(180),
  minLat: z.coerce.number().min(-90).max(90),
  maxLng: z.coerce.number().min(-180).max(180),
  maxLat: z.coerce.number().min(-90).max(90),
});

export const pointSchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(5000).default(500), // meters, max 5km
  limit: z.coerce.number().int().positive().max(50).default(10),
  category: z.string().optional(),
});

// =============================================
// Category schemas
// =============================================

export const categoryCodeSchema = z.enum([
  'building',
  'classroom',
  'lab',
  'library',
  'canteen',
  'dormitory',
  'parking',
  'sports',
  'gate',
  'admin',
  'medical',
  'other',
]);

export const createCategorySchema = z.object({
  code: z.enum([
    'building',
    'classroom',
    'lab',
    'library',
    'canteen',
    'dormitory',
    'parking',
    'sports',
    'gate',
    'admin',
    'medical',
    'other',
  ]),
  name_vi: z.string().min(1).max(100),
  name_en: z.string().max(100).optional(),
  icon: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});

export const updateCategorySchema = createCategorySchema.partial();

export interface CategoryResponse {
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
}

export const categoryListResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'code', 'name_vi', 'name_en', 'icon', 'color', 'sort_order', 'is_active', 'created_at', 'updated_at'],
    properties: {
      id: { type: 'integer' },
      code: { type: 'string' },
      name_vi: { type: 'string' },
      name_en: { type: ['string', 'null'] },
      icon: { type: ['string', 'null'] },
      color: { type: 'string' },
      sort_order: { type: 'integer' },
      is_active: { type: 'boolean' },
      created_at: { type: 'string' },
      updated_at: { type: 'string' },
    },
  },
};

// =============================================
// Place schemas
// =============================================

export const openingHoursSchema = z.record(
  z.union([z.string(), z.null()])
).optional();

export const imagesSchema = z.array(
  z.object({
    url: z.string().url(),
    caption: z.string().optional(),
    is_primary: z.boolean().optional(),
  })
).optional();

export const attributesSchema = z.record(z.unknown()).optional();

export const createPlaceSchema = z.object({
  category_id: z.coerce.number().int().positive(),
  code: z.string().max(50).optional(),
  name_vi: z.string().min(1).max(200),
  name_en: z.string().max(200).optional(),
  description_vi: z.string().optional(),
  description_en: z.string().optional(),
  // GeoJSON Point or [lng, lat]
  geom_point: z.union([
    z.tuple([z.number(), z.number()]),
    z.object({
      type: z.literal('Point'),
      coordinates: z.tuple([z.number(), z.number()]),
    }),
  ]).optional(),
  // GeoJSON Polygon
  geom_polygon: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
  }).optional(),
  floor: z.coerce.number().int().optional(),
  opening_hours: openingHoursSchema,
  contact_phone: z.string().max(20).optional(),
  contact_email: z.string().email().optional(),
  images: imagesSchema,
  attributes: attributesSchema,
});

export const updatePlaceSchema = createPlaceSchema.partial();

export const placeQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  q: z.string().optional(), // full-text search
  bbox: z.string().optional(), // "minLng,minLat,maxLng,maxLat"
  floor: z.coerce.number().int().optional(),
  has_polygon: z.coerce.boolean().optional(),
  sort: z.enum(['name_vi', 'code', 'created_at', 'updated_at']).default('name_vi'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const placeResponseSchema = z.object({
  id: z.string().uuid(),
  category_id: z.number().nullable(),
  code: z.string().nullable(),
  name_vi: z.string(),
  name_en: z.string().nullable(),
  description_vi: z.string().nullable(),
  description_en: z.string().nullable(),
  geom_point: z.unknown().nullable(), // PostGIS geometry
  geom_polygon: z.unknown().nullable(),
  floor: z.number().nullable(),
  opening_hours: z.unknown().nullable(),
  contact_phone: z.string().nullable(),
  contact_email: z.string().nullable(),
  images: z.unknown(),
  attributes: z.unknown(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Joined category fields
  category_code: z.string().nullable(),
  category_name_vi: z.string().nullable(),
  category_name_en: z.string().nullable(),
  category_icon: z.string().nullable(),
  category_color: z.string().nullable(),
});

export const placeListResponseSchema = z.object({
  data: z.array(placeResponseSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
  links: z.object({
    self: z.string(),
    next: z.string().nullable(),
    prev: z.string().nullable(),
  }),
});

// =============================================
// Search schemas
// =============================================

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().positive().max(50).default(10),
  category: z.string().optional(),
});

export const searchResultSchema = z.object({
  id: z.string().uuid(),
  code: z.string().nullable(),
  name_vi: z.string(),
  name_en: z.string().nullable(),
  category_code: z.string().nullable(),
  category_name_vi: z.string().nullable(),
  category_color: z.string().nullable(),
  geom_point: z.unknown().nullable(),
  similarity: z.number().optional(),
  rank: z.number().optional(),
});

export const searchResponseSchema = z.object({
  data: z.array(searchResultSchema),
  meta: z.object({
    query: z.string(),
    took_ms: z.number(),
  }),
});

// =============================================
// Routing schemas
// =============================================

export const routingQuerySchema = z.object({
  from: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/), // "lat,lng"
  to: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),
  mode: z.enum(['walk', 'bike', 'wheelchair']).default('walk'),
  alternatives: z.coerce.boolean().default(false),
  steps: z.coerce.boolean().default(true),
  geometries: z.enum(['geojson', 'polyline', 'polyline6']).default('geojson'),
});

export const routingResponseSchema = z.object({
  routes: z.array(z.object({
    geometry: z.unknown(),
    distance: z.number(), // meters
    duration: z.number(), // seconds
    weight: z.number(),
    weight_name: z.string(),
    legs: z.array(z.object({
      distance: z.number(),
      duration: z.number(),
      steps: z.array(z.unknown()).optional(),
      summary: z.string(),
    })),
  })),
  waypoints: z.array(z.object({
    location: z.tuple([z.number(), z.number()]),
    name: z.string(),
    distance: z.number(),
  })),
  meta: z.object({
    mode: z.string(),
    took_ms: z.number(),
    fallback: z.boolean().optional(),
    nodes: z.number().optional(),
  }),
});

// =============================================
// Type exports
// =============================================

export type PaginationParams = z.infer<typeof paginationSchema>;
export type BBox = z.infer<typeof bboxSchema>;
export type Point = z.infer<typeof pointSchema>;
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

export type CreateCategory = z.infer<typeof createCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;

export type CreatePlace = z.infer<typeof createPlaceSchema>;
export type UpdatePlace = z.infer<typeof updatePlaceSchema>;
export type PlaceQuery = z.infer<typeof placeQuerySchema>;
export type PlaceResponse = z.infer<typeof placeResponseSchema>;
export type PlaceListResponse = z.infer<typeof placeListResponseSchema>;

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export type RoutingQuery = z.infer<typeof routingQuerySchema>;
export type RoutingResponse = z.infer<typeof routingResponseSchema>;