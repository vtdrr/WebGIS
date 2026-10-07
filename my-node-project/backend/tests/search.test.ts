import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app.js';
import { insertPlace, resetData } from './helpers/fixtures.js';
import { pool } from '../src/db/pool.js';

let app: FastifyInstance;

const CENTER = { lng: 105.7487, lat: 20.9626 };

async function search(q: string, extra: Record<string, string | number> = {}) {
  const res = await app.inject({ method: 'GET', url: '/api/places/search', query: { q, ...extra } });
  return { status: res.statusCode, body: res.json() as { data: Array<{ code: string | null; name_vi: string }> } };
}

async function codes(q: string, extra: Record<string, string | number> = {}): Promise<Array<string | null>> {
  const { status, body } = await search(q, extra);
  expect(status).toBe(200);
  return body.data.map((p) => p.code);
}

beforeAll(async () => {
  app = await createTestApp();
  await resetData();
  await insertPlace({ code: 'A1', name_vi: 'Tòa nhà A1', name_en: 'Building A1', category: 'building', ...CENTER });
  await insertPlace({
    code: 'A1-101', name_vi: 'Phòng học A1-101', category: 'classroom',
    description_vi: 'Phòng học lý thuyết tại tòa A1', ...CENTER,
  });
  await insertPlace({
    code: 'LIB-MAIN', name_vi: 'Thư viện chính', name_en: 'Main Library', category: 'library',
    description_vi: 'Thư viện phục vụ sinh viên, có phòng đọc', ...CENTER,
  });
  await insertPlace({
    code: 'CAN-1', name_vi: 'Căng tin trường', category: 'canteen',
    description_vi: 'Bán đồ ăn và đồ uống', ...CENTER,
  });
  await insertPlace({
    code: 'LAB-1', name_vi: 'Phòng thí nghiệm Hóa', category: 'lab',
    description_vi: 'Nằm gần thư viện', ...CENTER,
  });
  await insertPlace({ code: 'DOR-A', name_vi: 'Ký túc xá A', name_en: 'Dormitory A', category: 'dormitory', ...CENTER });
  await insertPlace({ code: 'ST-1', name_vi: 'Sân thể thao Đa năng', category: 'sports', ...CENTER });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('search: accent-insensitive', () => {
  it('matches without diacritics', async () => {
    expect((await codes('thu vien'))[0]).toBe('LIB-MAIN');
  });

  it('matches with diacritics', async () => {
    expect((await codes('thư viện'))[0]).toBe('LIB-MAIN');
  });

  it('is case-insensitive', async () => {
    expect((await codes('THƯ VIỆN'))[0]).toBe('LIB-MAIN');
  });

  it('treats đ like d', async () => {
    expect(await codes('da nang')).toContain('ST-1');
    expect(await codes('đa nang')).toContain('ST-1');
  });
});

describe('search: prefix matching', () => {
  it('matches a partial word', async () => {
    expect(await codes('thu vi')).toContain('LIB-MAIN');
  });

  it('matches partial words in every token', async () => {
    expect((await codes('phon hoc a1'))[0]).toBe('A1-101');
  });

  it('matches a single-letter prefix', async () => {
    expect(await codes('can t')).toContain('CAN-1');
  });
});

describe('search: fields', () => {
  it('searches the English name', async () => {
    expect(await codes('library')).toContain('LIB-MAIN');
    expect(await codes('dorm')).toContain('DOR-A');
  });

  it('searches the description', async () => {
    expect(await codes('do uong')).toContain('CAN-1');
  });
});

describe('search: ranking', () => {
  it('ranks an exact code match first', async () => {
    const result = await codes('A1');
    expect(result[0]).toBe('A1');
    expect(result).toContain('A1-101');
  });

  it('matches a hyphenated code', async () => {
    expect((await codes('a1-101'))[0]).toBe('A1-101');
    expect((await codes('lib-main'))[0]).toBe('LIB-MAIN');
  });

  it('ranks a name match above a description match', async () => {
    const result = await codes('thu vien');
    expect(result).toContain('LAB-1'); // mentions "thư viện" in its description
    expect(result.indexOf('LIB-MAIN')).toBeLessThan(result.indexOf('LAB-1'));
  });
});

describe('search: typo tolerance', () => {
  it('finds a place despite a typo', async () => {
    expect(await codes('thu vyen')).toContain('LIB-MAIN');
  });
});

describe('search: filters and limits', () => {
  it('filters by category', async () => {
    const result = await codes('phong', { category: 'lab' });
    expect(result).toEqual(['LAB-1']);
  });

  it('applies the category filter to fuzzy matches too', async () => {
    const result = await codes('thu vyen', { category: 'lab' });
    expect(result).not.toContain('LIB-MAIN');
  });

  it('respects the limit', async () => {
    expect((await codes('phong', { limit: 1 })).length).toBe(1);
  });

  it('returns no results for unknown terms', async () => {
    expect(await codes('zzzzzzzz')).toEqual([]);
  });
});

describe('search: unusual input', () => {
  const inputs = ['&', "'", ':*', '\\', '!!!', '| ! ( ) <->', 'a & | b', '   ', '%', '_', "'; DROP TABLE places; --"];

  it.each(inputs)('does not fail on %j', async (q) => {
    const { status, body } = await search(q);
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns nothing for input without letters or digits', async () => {
    expect(await codes('&&& !!!')).toEqual([]);
  });

  it('keeps the data intact after an injection attempt', async () => {
    await search("'; DROP TABLE places; --");
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM places');
    expect(rows[0].n).toBe(7);
  });

  it('rejects a missing or empty query', async () => {
    const empty = await app.inject({ method: 'GET', url: '/api/places/search', query: { q: '' } });
    expect(empty.statusCode).toBe(400);
    const missing = await app.inject({ method: 'GET', url: '/api/places/search' });
    expect(missing.statusCode).toBe(400);
  });

  it('handles decomposed (NFD) unicode input', async () => {
    expect((await codes('thư viện'.normalize('NFD')))[0]).toBe('LIB-MAIN');
  });
});

describe('list endpoint q parameter', () => {
  async function listCodes(q: string): Promise<Array<string | null>> {
    const res = await app.inject({ method: 'GET', url: '/api/places', query: { q } });
    expect(res.statusCode).toBe(200);
    return (res.json() as { data: Array<{ code: string | null }> }).data.map((p) => p.code);
  }

  it('supports accent-insensitive prefix search', async () => {
    expect(await listCodes('thu vi')).toContain('LIB-MAIN');
  });

  it('returns an empty list for input without letters or digits', async () => {
    expect(await listCodes('&&&')).toEqual([]);
  });
});
