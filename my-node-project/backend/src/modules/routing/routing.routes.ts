import { FastifyInstance } from 'fastify';
import { routingService, RoutingError } from './routing.service.js';

// Plain JSON schema for routing query
const routingQuerySchema = {
  type: 'object',
  required: ['from', 'to'],
  properties: {
    from: { type: 'string', pattern: '^-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?$' },
    to: { type: 'string', pattern: '^-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?$' },
    mode: { type: 'string', enum: ['walk'], default: 'walk' },
  },
};

export async function routingRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['Routing'], summary: 'Get walking directions between two points', querystring: routingQuerySchema },
  }, async (request, reply) => {
    const { from, to } = request.query as {
      from: string;
      to: string;
    };

    const [fromLat, fromLng] = from.split(',').map(Number);
    const [toLat, toLng] = to.split(',').map(Number);

    if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng) ||
        !Number.isFinite(toLat) || !Number.isFinite(toLng)) {
      return reply.code(400).send({ message: 'Invalid coordinates. Use format "lat,lng"' });
    }

    if (fromLat < -90 || fromLat > 90 || toLat < -90 || toLat > 90 ||
        fromLng < -180 || fromLng > 180 || toLng < -180 || toLng > 180) {
      return reply.code(400).send({ message: 'Coordinates out of range' });
    }

    try {
      return await routingService.findRoute(fromLat, fromLng, toLat, toLng);
    } catch (err) {
      if (err instanceof RoutingError) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      request.log.error(err, 'Routing failed');
      return reply.code(500).send({ message: 'Routing failed' });
    }
  });
}
