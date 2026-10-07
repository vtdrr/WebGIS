import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

/**
 * Adds a weak ETag to JSON GET responses and answers conditional requests
 * with 304. Combined with `Cache-Control: no-cache` the browser always
 * revalidates, so edits show up immediately but unchanged payloads
 * (e.g. the GeoJSON export) are not re-downloaded.
 */
export async function etag(app: FastifyInstance): Promise<void> {
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.method !== 'GET' || reply.statusCode !== 200) return payload;
    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return payload;
    const type = reply.getHeader('content-type');
    if (typeof type !== 'string' || !type.includes('application/json')) return payload;

    const tag = `W/"${createHash('sha1').update(payload).digest('base64url')}"`;
    reply.header('etag', tag);
    reply.header('cache-control', 'no-cache');

    if (request.headers['if-none-match'] === tag) {
      reply.code(304);
      return '';
    }
    return payload;
  });
}
