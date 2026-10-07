import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

const uploadDir = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? '/tmp'}/webgis-uploads-${process.pid}`;
  process.env.UPLOAD_DIR = dir;
  process.env.UPLOAD_MAX_MB = '1';
  return dir;
});

import { createTestApp } from './helpers/app.js';
import { pool } from '../src/db/pool.js';
import { sniffImageType } from '../src/modules/uploads/uploads.routes.js';

let app: FastifyInstance;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);

function multipart(filename: string, mimetype: string, content: Buffer) {
  const boundary = '----webgistest';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, content, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await pool.end();
  rmSync(uploadDir, { recursive: true, force: true });
});

describe('sniffImageType', () => {
  it('recognises png, jpeg and webp, rejects others', () => {
    expect(sniffImageType(PNG)).toBe('image/png');
    expect(sniffImageType(JPEG)).toBe('image/jpeg');
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
    expect(sniffImageType(webp)).toBe('image/webp');
    expect(sniffImageType(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('POST /api/uploads', () => {
  it('stores an image and serves it back', async () => {
    const { payload, headers } = multipart('photo.png', 'image/png', PNG);
    const res = await app.inject({ method: 'POST', url: '/api/uploads', payload, headers });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { url: string; filename: string };
    expect(body.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(existsSync(join(uploadDir, body.filename))).toBe(true);

    const served = await app.inject({ method: 'GET', url: body.url });
    expect(served.statusCode).toBe(200);
    expect(served.rawPayload.equals(PNG)).toBe(true);
  });

  it('ignores the client filename', async () => {
    const { payload, headers } = multipart('../../evil.png', 'image/png', PNG);
    const res = await app.inject({ method: 'POST', url: '/api/uploads', payload, headers });
    expect(res.statusCode).toBe(201);
    expect((res.json() as { url: string }).url).not.toContain('evil');
  });

  it('rejects a disallowed mime type', async () => {
    const { payload, headers } = multipart('x.svg', 'image/svg+xml', Buffer.from('<svg/>'));
    const res = await app.inject({ method: 'POST', url: '/api/uploads', payload, headers });
    expect(res.statusCode).toBe(415);
  });

  it('rejects content that does not match the declared type', async () => {
    const { payload, headers } = multipart('fake.png', 'image/png', Buffer.from('<?php system($_GET[1]); ?>'));
    const res = await app.inject({ method: 'POST', url: '/api/uploads', payload, headers });
    expect(res.statusCode).toBe(415);
  });

  it('rejects mismatched jpeg/png declarations', async () => {
    const { payload, headers } = multipart('x.jpg', 'image/jpeg', PNG);
    const res = await app.inject({ method: 'POST', url: '/api/uploads', payload, headers });
    expect(res.statusCode).toBe(415);
  });

  it('rejects files over the size limit', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(1.5 * 1024 * 1024, 3)]);
    const { payload, headers } = multipart('big.png', 'image/png', big);
    const res = await app.inject({ method: 'POST', url: '/api/uploads', payload, headers });
    expect(res.statusCode).toBe(413);
  });

  it('rejects requests without a file', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/uploads', payload: '--b--\r\n',
      headers: { 'content-type': 'multipart/form-data; boundary=b' },
    });
    expect(res.statusCode).toBe(400);
  });
});
