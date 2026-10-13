import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../../config/index.js';

const IMAGE_TYPES = {
  'image/png': { extension: 'png', signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  'image/jpeg': { extension: 'jpg', signature: Buffer.from([0xff, 0xd8, 0xff]) },
  'image/webp': { extension: 'webp', signature: null },
} as const;

export function uploadDir(): string {
  return resolve(config.UPLOAD_DIR);
}

/** Detect supported image formats from their bytes, not the client filename. */
export function sniffImageType(buffer: Buffer): keyof typeof IMAGE_TYPES | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(IMAGE_TYPES['image/png'].signature)) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(IMAGE_TYPES['image/jpeg'].signature)) {
    return 'image/jpeg';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export async function uploadsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', async (request, reply) => {
    let file;
    try {
      file = await request.file();
    } catch (error) {
      if (isPayloadTooLarge(error)) return reply.code(413).send({ message: 'Uploaded file is too large' });
      throw error;
    }

    if (!file) return reply.code(400).send({ message: 'An image file is required' });

    let contents: Buffer;
    try {
      contents = await file.toBuffer();
    } catch (error) {
      if (isPayloadTooLarge(error)) return reply.code(413).send({ message: 'Uploaded file is too large' });
      throw error;
    }

    if (file.file.truncated) return reply.code(413).send({ message: 'Uploaded file is too large' });

    const detectedType = sniffImageType(contents);
    if (!detectedType || detectedType !== file.mimetype) {
      return reply.code(415).send({ message: 'Only valid PNG, JPEG, and WebP images are supported' });
    }

    const extension = IMAGE_TYPES[detectedType].extension;
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(resolve(uploadDir(), filename), contents, { flag: 'wx' });

    return reply.code(201).send({ url: `/uploads/${filename}`, filename });
  });
}

function isPayloadTooLarge(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return 'statusCode' in error && error.statusCode === 413;
}
