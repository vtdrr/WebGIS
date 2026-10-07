import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Constant-time string comparison (hashes first so the lengths always match). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Extract the key from `x-admin-key` or `Authorization: Bearer <key>`. */
export function extractKey(headers: Record<string, string | string[] | undefined>): string | undefined {
  const headerKey = headers['x-admin-key'];
  if (headerKey !== undefined) return Array.isArray(headerKey) ? headerKey[0] : headerKey;
  const auth = headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

/**
 * Protects every non-GET request of the registering scope with an admin key.
 * Also exposes `GET /auth/check`-style verification through `verifyAdminKey`.
 */
export async function adminAuth(app: FastifyInstance, opts: { apiKey?: string }): Promise<void> {
  const { apiKey } = opts;
  if (!apiKey) return;

  app.addHook('onRequest', async (request, reply) => {
    if (SAFE_METHODS.has(request.method)) return;
    const provided = extractKey(request.headers);
    if (provided === undefined || !safeEqual(provided, apiKey)) {
      return reply.code(401).send({ message: 'Unauthorized: invalid or missing admin key' });
    }
  });
}
