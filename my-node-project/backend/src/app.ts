import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { mkdirSync } from 'node:fs';
import { config } from './config/index.js';
import { adminAuth } from './plugins/adminAuth.js';
import { etag } from './plugins/etag.js';
import { uploadsRoutes, uploadDir } from './modules/uploads/uploads.routes.js';
import { categoriesRoutes } from './modules/categories/categories.routes.js';
import { placesRoutes } from './modules/places/places.routes.js';
import { routingRoutes } from './modules/routing/routing.routes.js';
import { closePool, isDatabaseReachable } from './db/pool.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'silent' : config.NODE_ENV === 'development' ? 'debug' : 'info',
      transport: config.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      } : undefined,
    },
    ajv: {
      customOptions: { coerceTypes: 'array' },
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Core plugins
  await app.register(sensible);
  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
  });
  await app.register(multipart, {
    limits: { fileSize: config.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
  });

  // Uploaded images are served as static files
  mkdirSync(uploadDir(), { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadDir(),
    prefix: '/uploads/',
    decorateReply: false,
    maxAge: '7d',
    immutable: true,
    index: false,
    list: false,
  });

  // Swagger/OpenAPI documentation
  if (config.SWAGGER_ENABLED) {
    await app.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'Phenikaa WebGIS API',
          description: 'API quản lý và tra cứu thông tin địa điểm trong khuôn viên Trường Đại học Phenikaa',
          version: '1.0.0',
        },
        servers: [{ url: `http://localhost:${config.PORT}` }],
      },
    });
    await app.register(swaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
      },
    });
  }

  // Liveness: the process is up
  app.get('/health', {
    schema: { hide: true },
  }, async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Readiness: the database answers too (503 otherwise)
  app.get('/health/ready', {
    schema: { hide: true },
  }, async (_request, reply) => {
    const database = await isDatabaseReachable();
    return reply.code(database ? 200 : 503).send({
      status: database ? 'ok' : 'unavailable',
      database: database ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  await app.register(async function (api) {
    // Protect write operations with an admin API key (mandatory in production)
    await adminAuth(api, { apiKey: config.ADMIN_API_KEY });
    await etag(api);

    // Lets the admin UI verify a key without touching data
    // (a POST, so it goes through the same key check as every other write)
    api.post('/auth/verify', { schema: { hide: true } }, async () => ({ ok: true }));

    await api.register(categoriesRoutes, { prefix: '/categories' });
    await api.register(placesRoutes, { prefix: '/places' });
    await api.register(routingRoutes, { prefix: '/routing' });
    await api.register(uploadsRoutes, { prefix: '/uploads' });
  }, { prefix: '/api' });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send({
      message: 'Route not found',
      path: request.url,
      method: request.method,
    });
  });

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    app.log.error(error, 'Unhandled error');

    if (error.validation) {
      return reply.code(400).send({
        message: 'Validation error',
        errors: error.validation,
      });
    }

    const statusCode = error.statusCode || 500;
    return reply.code(statusCode).send({
      message: statusCode === 500 ? 'Internal server error' : error.message,
      ...(config.NODE_ENV === 'development' && { stack: error.stack }),
    });
  });

  return app;
}

// Graceful shutdown (only for the real server process, not for tests)
function registerShutdown(app: FastifyInstance): void {
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down...');
    await closePool();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildApp()
    .then((app) => {
      registerShutdown(app);
      return app.listen({ port: config.PORT, host: config.HOST });
    })
    .then((address) => {
      console.log(`🚀 Server listening at ${address}`);
      console.log(`📚 Swagger UI: ${address}/docs`);
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

export { buildApp as createApp };