import { FastifyInstance } from 'fastify';
import { placesService } from './places.service.js';
import type { PlaceQuery, CreatePlace, UpdatePlace } from '../common/schemas.js';

// Plain JSON schemas for querystring
const placeQuerySchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    category: { type: 'string' },
    q: { type: 'string' },
    bbox: { type: 'string' },
    floor: { type: 'integer' },
    has_polygon: { type: 'boolean' },
    sort: { type: 'string', enum: ['name_vi', 'code', 'created_at', 'updated_at'], default: 'name_vi' },
    order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
  },
};

const nearbyQuerySchema = {
  type: 'object',
  required: ['lat', 'lng'],
  properties: {
    lat: { type: 'number', minimum: -90, maximum: 90 },
    lng: { type: 'number', minimum: -180, maximum: 180 },
    radius: { type: 'number', minimum: 1, maximum: 5000, default: 500 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
    category: { type: 'string' },
  },
};

const searchQuerySchema = {
  type: 'object',
  required: ['q'],
  properties: {
    q: { type: 'string', minLength: 1, maxLength: 200 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
    category: { type: 'string' },
  },
};

const idParamSchema = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id'],
};

// Body schema for create/update (GeoJSON Point | [lng, lat])
const pointBody = {
  oneOf: [
    { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    {
      type: 'object',
      required: ['type', 'coordinates'],
      properties: {
        type: { const: 'Point' },
        coordinates: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      },
    },
  ],
};

const polygonBody = {
  type: 'object',
  required: ['type', 'coordinates'],
  properties: {
    type: { const: 'Polygon' },
    // array of rings, each ring is an array of [lng, lat] positions
    coordinates: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'array',
        minItems: 4,
        items: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
        },
      },
    },
  },
};

const placeBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['category_id', 'name_vi'],
  properties: {
    category_id: { type: 'integer', minimum: 1 },
    code: { type: 'string', maxLength: 50 },
    name_vi: { type: 'string', minLength: 1, maxLength: 200 },
    name_en: { type: 'string', maxLength: 200 },
    description_vi: { type: 'string' },
    description_en: { type: 'string' },
    geom_point: pointBody,
    geom_polygon: polygonBody,
    floor: { type: 'integer' },
    opening_hours: { type: 'object' },
    contact_phone: { type: 'string', maxLength: 20 },
    contact_email: { type: 'string', format: 'email' },
    images: { type: 'array' },
    attributes: { type: 'object' },
  },
};

// Update body: all fields optional
const updatePlaceBodySchema = {
  type: 'object',
  properties: placeBodySchema.properties,
};

export async function placesRoutes(app: FastifyInstance) {
  // GET /api/places - List places with filters
  app.get('/', {
    schema: { tags: ['Places'], summary: 'List places with pagination and filters', querystring: placeQuerySchema },
  }, async (request) => placesService.findAll(request.query as PlaceQuery));

  // GET /api/places/geojson - Export as GeoJSON
  app.get('/geojson', {
    schema: { tags: ['Places'], summary: 'Export places as GeoJSON FeatureCollection', querystring: { type: 'object', properties: { category: { type: 'string' } } } },
  }, async (request) => placesService.getGeoJSON((request.query as { category?: string }).category));

  // GET /api/places/search - Full-text + fuzzy search
  app.get('/search', {
    schema: { tags: ['Places'], summary: 'Search places by keyword', querystring: searchQuerySchema },
  }, async (request) => {
    const { q, limit, category } = request.query as { q: string; limit: number; category?: string };
    const start = Date.now();
    const results = await placesService.search(q, limit, category);
    return { data: results, meta: { query: q, took_ms: Date.now() - start } };
  });

  // GET /api/places/nearby - Find nearby places
  app.get('/nearby', {
    schema: { tags: ['Places'], summary: 'Find places near a coordinate', querystring: nearbyQuerySchema },
  }, async (request) => {
    const { lat, lng, radius, limit, category } = request.query as { lat: number; lng: number; radius: number; limit: number; category?: string };
    return placesService.findNearby(lat, lng, radius, limit, category);
  });

  // GET /api/places/:id - Get single place
  app.get('/:id', {
    schema: { tags: ['Places'], summary: 'Get place by ID', params: idParamSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const place = await placesService.findById(id);
    if (!place) return reply.code(404).send({ message: 'Place not found' });
    return place;
  });

  // POST /api/places - Create place (admin)
  app.post('/', {
    schema: { tags: ['Places'], summary: 'Create new place', body: placeBodySchema },
  }, async (request, reply) => {
    try {
      const place = await placesService.create(request.body as CreatePlace);
      return reply.code(201).send(place);
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ message: 'Place code already exists' });
      throw err;
    }
  });

  // PATCH /api/places/:id - Update place (admin)
  app.patch('/:id', {
    schema: { tags: ['Places'], summary: 'Update place', params: idParamSchema, body: updatePlaceBodySchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const place = await placesService.update(id, request.body as UpdatePlace);
    if (!place) return reply.code(404).send({ message: 'Place not found' });
    return place;
  });

  // DELETE /api/places/:id - Delete place (admin)
  app.delete('/:id', {
    schema: { tags: ['Places'], summary: 'Delete place', params: idParamSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await placesService.delete(id);
    if (!deleted) return reply.code(404).send({ message: 'Place not found' });
    return reply.code(204).send();
  });
}