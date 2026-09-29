import { FastifyInstance } from 'fastify';
import { categoriesService } from './categories.service.js';

// Plain JSON schemas to avoid zodTypeProvider issues
const idParamSchema = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};

const createCategoryBodySchema = {
  type: 'object',
  required: ['code', 'name_vi'],
  properties: {
    code: { type: 'string', enum: ['building', 'classroom', 'lab', 'library', 'canteen', 'dormitory', 'parking', 'sports', 'gate', 'admin', 'medical', 'other'] },
    name_vi: { type: 'string', minLength: 1, maxLength: 100 },
    name_en: { type: 'string', maxLength: 100 },
    icon: { type: 'string', maxLength: 100 },
    color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    sort_order: { type: 'integer' },
    is_active: { type: 'boolean' },
  },
};

const updateCategoryBodySchema = {
  type: 'object',
  properties: {
    code: { type: 'string', enum: ['building', 'classroom', 'lab', 'library', 'canteen', 'dormitory', 'parking', 'sports', 'gate', 'admin', 'medical', 'other'] },
    name_vi: { type: 'string', minLength: 1, maxLength: 100 },
    name_en: { type: 'string', maxLength: 100 },
    icon: { type: 'string', maxLength: 100 },
    color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    sort_order: { type: 'integer' },
    is_active: { type: 'boolean' },
  },
};

export async function categoriesRoutes(app: FastifyInstance) {
  // GET /api/categories - List all categories
  app.get('/', {
    schema: { tags: ['Categories'], summary: 'Get all categories' },
  }, async () => categoriesService.findAll());

  // GET /api/categories/with-counts - Categories with place counts
  app.get('/with-counts', {
    schema: { tags: ['Categories'], summary: 'Get categories with place counts' },
  }, async () => categoriesService.getWithPlaceCounts());

  // GET /api/categories/:id - Get single category
  app.get('/:id', {
    schema: { tags: ['Categories'], summary: 'Get category by ID', params: idParamSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const category = await categoriesService.findById(id);
    if (!category) return reply.code(404).send({ message: 'Category not found' });
    return category;
  });

  // POST /api/categories - Create category (admin)
  app.post('/', {
    schema: { tags: ['Categories'], summary: 'Create category', body: createCategoryBodySchema },
  }, async (request, reply) => {
    try {
      const category = await categoriesService.create(request.body as any);
      return reply.code(201).send(category);
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ message: 'Category code already exists' });
      throw err;
    }
  });

  // PATCH /api/categories/:id - Update category (admin)
  app.patch('/:id', {
    schema: { tags: ['Categories'], summary: 'Update category', params: idParamSchema, body: updateCategoryBodySchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const category = await categoriesService.update(id, request.body as any);
    if (!category) return reply.code(404).send({ message: 'Category not found' });
    return category;
  });

  // DELETE /api/categories/:id - Delete category (admin)
  app.delete('/:id', {
    schema: { tags: ['Categories'], summary: 'Delete category', params: idParamSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const deleted = await categoriesService.delete(id);
    if (!deleted) return reply.code(404).send({ message: 'Category not found' });
    return reply.code(204).send();
  });
}