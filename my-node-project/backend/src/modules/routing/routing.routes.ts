import { FastifyInstance } from 'fastify';

// Plain JSON schema for routing query
const routingQuerySchema = {
  type: 'object',
  required: ['from', 'to'],
  properties: {
    from: { type: 'string', pattern: '^-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?$' },
    to: { type: 'string', pattern: '^-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?$' },
    mode: { type: 'string', enum: ['walk', 'bike', 'wheelchair'], default: 'walk' },
    alternatives: { type: 'boolean', default: false },
    steps: { type: 'boolean', default: true },
    geometries: { type: 'string', enum: ['geojson', 'polyline', 'polyline6'], default: 'geojson' },
  },
};

export async function routingRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['Routing'], summary: 'Get walking/biking directions between two points', querystring: routingQuerySchema },
  }, async (request, reply) => {
    const [fromLat, fromLng] = request.query.from.split(',').map(Number);
    const [toLat, toLng] = request.query.to.split(',').map(Number);
    return reply.code(501).send({
      message: 'Routing not yet implemented',
      hint: 'Phase 4: Integrate OSRM (Docker) or pgRouting. See docker-compose.yml for OSRM service.',
    });
  });
}