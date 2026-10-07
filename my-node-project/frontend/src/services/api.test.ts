import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, categoriesApi, placesApi, routingApi, toQuery } from './api';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('toQuery', () => {
  it('skips undefined and null, keeps falsy values', () => {
    expect(toQuery({ a: 1, b: undefined, c: null, d: 0, e: false, f: '' })).toBe('a=1&d=0&e=false&f=');
  });

  it('encodes values', () => {
    expect(toQuery({ q: 'thư viện & sách' })).toBe('q=th%C6%B0+vi%E1%BB%87n+%26+s%C3%A1ch');
  });
});

describe('api client', () => {
  it('requests the right URLs', async () => {
    const fetchMock = mockFetch(200, []);
    await categoriesApi.list();
    await placesApi.list({ page: 2, limit: 50, category: 'lab', q: undefined });
    await placesApi.search({ q: 'thu vien', limit: 5 });
    await placesApi.getGeoJSON('gate');
    await routingApi.getDirections({ from: '1,2', to: '3,4', mode: 'bike' });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/categories',
      '/api/places?page=2&limit=50&category=lab',
      '/api/places/search?q=thu+vien&limit=5',
      '/api/places/geojson?category=gate',
      '/api/routing?from=1%2C2&to=3%2C4&mode=bike',
    ]);
  });

  it('returns the parsed body on success', async () => {
    mockFetch(200, [{ id: 1 }]);
    expect(await categoriesApi.list()).toEqual([{ id: 1 }]);
  });

  it('throws ApiError with status and server message on failure', async () => {
    mockFetch(422, { message: 'Điểm quá xa' });
    await expect(routingApi.getDirections({ from: '1,2', to: '3,4' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'Điểm quá xa',
    });
  });

  it('survives a non-JSON error body', async () => {
    mockFetch(502, undefined);
    const err = await categoriesApi.list().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).toBe('API Error');
  });
});
