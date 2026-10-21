import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCategory, makePlace } from '../test/fixtures';

const api = vi.hoisted(() => ({
  getDirections: vi.fn(),
  list: vi.fn(),
  search: vi.fn(),
  categories: vi.fn(),
}));

vi.mock('../services/api', () => ({
  routingApi: { getDirections: api.getDirections },
  placesApi: { list: api.list, search: api.search },
  categoriesApi: { list: api.categories },
}));

import { useStore } from './useStore';

const initial = useStore.getState();
const route = { routes: [{ distance: 100, duration: 70, geometry: { type: 'LineString', coordinates: [] }, legs: [] }], meta: {} };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  useStore.setState(initial, true);
  vi.resetAllMocks();
  useStore.setState({ lang: 'vi' });
});

describe('routing', () => {
  it('startRoutingTo with GPS fetches a route right away, in the right order (lat,lng)', async () => {
    api.getDirections.mockResolvedValue(route);
    await useStore.getState().startRoutingTo(makePlace(), { lat: 20.95, lng: 105.74 });
    const state = useStore.getState();
    expect(api.getDirections).toHaveBeenCalledWith({ from: '20.95,105.74', to: '20.9626,105.7487', mode: 'walk' });
    expect(state.routingResult).toEqual(route);
    expect(state.routingFrom).toMatchObject({ source: 'gps', name: 'Vị trí của tôi' });
    expect(state.routePicking).toBe(false);
  });

  it('names the GPS origin in Vietnamese', async () => {
    api.getDirections.mockResolvedValue(route);
    await useStore.getState().startRoutingTo(makePlace(), { lat: 20.95, lng: 105.74 });
    expect(useStore.getState().routingFrom?.name).toBe('Vị trí của tôi');
  });

  it('without GPS it asks the user to pick the origin on the map', async () => {
    await useStore.getState().startRoutingTo(makePlace(), null);
    const state = useStore.getState();
    expect(api.getDirections).not.toHaveBeenCalled();
    expect(state.routePicking).toBe(true);
    expect(state.routingFrom).toBeNull();
    expect(state.routingTo?.id).toBe('p-1');
  });

  it('picking an origin fetches the route and stops picking', async () => {
    api.getDirections.mockResolvedValue(route);
    await useStore.getState().startRoutingTo(makePlace(), null);
    await useStore.getState().setRoutingOrigin({ lat: 20.9, lng: 105.7, name: 'x', source: 'map' });
    expect(useStore.getState().routePicking).toBe(false);
    expect(api.getDirections).toHaveBeenCalledOnce();
    expect(useStore.getState().routingResult).toEqual(route);
  });

  it('keeps the server message when routing fails and clears the stale route', async () => {
    api.getDirections.mockResolvedValueOnce(route).mockRejectedValueOnce(new Error('Điểm đến quá xa'));
    await useStore.getState().startRoutingTo(makePlace(), { lat: 20.95, lng: 105.74 });
    await useStore.getState().setRoutingOrigin({ lat: 20.95, lng: 105.74, name: 'Vị trí của tôi', source: 'gps' });
    await vi.waitFor(() => expect(useStore.getState().routingError).toBe('Điểm đến quá xa'));
    expect(useStore.getState().routingResult).toBeNull();
    expect(useStore.getState().routingLoading).toBe(false);
  });

  it('swap exchanges origin and destination when the origin is a known place', async () => {
    api.getDirections.mockResolvedValue(route);
    const a = makePlace({ id: 'a', name_vi: 'A' });
    const b = makePlace({ id: 'b', name_vi: 'B', geom_point: { type: 'Point', coordinates: [105.75, 20.97] } });
    useStore.setState({ routePlaces: [a, b] });
    await useStore.getState().startRoutingTo(b, null);
    await useStore.getState().setRoutingOrigin(a);
    await useStore.getState().swapRouting();
    const state = useStore.getState();
    expect(state.routingTo?.id).toBe('a');
    expect(state.routingFrom?.placeId).toBe('b');
  });

  it('clearRouting resets everything', async () => {
    api.getDirections.mockResolvedValue(route);
    await useStore.getState().startRoutingTo(makePlace(), { lat: 20.95, lng: 105.74 });
    useStore.getState().clearRouting();
    expect(useStore.getState()).toMatchObject({ routingFrom: null, routingTo: null, routingResult: null, routePicking: false });
  });

  it('keeps the latest route when an older route resolves later', async () => {
    const older = deferred<typeof route>();
    const newer = deferred<typeof route>();
    api.getDirections.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const oldRequest = useStore.getState().fetchRoute(
      { lat: 20.9, lng: 105.7, name: 'old origin' },
      { lat: 20.91, lng: 105.71, name: 'old destination' },
    );
    const newRequest = useStore.getState().fetchRoute(
      { lat: 20.92, lng: 105.72, name: 'new origin' },
      { lat: 20.93, lng: 105.73, name: 'new destination' },
    );
    const newRoute = { ...route, routes: [{ ...route.routes[0], distance: 222 }] };
    newer.resolve(newRoute);
    await newRequest;
    older.resolve({ ...route, routes: [{ ...route.routes[0], distance: 111 }] });
    await oldRequest;

    expect(useStore.getState().routingResult?.routes[0].distance).toBe(222);
    expect(useStore.getState().routingLoading).toBe(false);
  });

  it('ignores an older route failure after a newer route succeeds', async () => {
    const older = deferred<typeof route>();
    const newer = deferred<typeof route>();
    api.getDirections.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const oldRequest = useStore.getState().fetchRoute(
      { lat: 20.9, lng: 105.7, name: 'old origin' },
      { lat: 20.91, lng: 105.71, name: 'old destination' },
    );
    const newRequest = useStore.getState().fetchRoute(
      { lat: 20.92, lng: 105.72, name: 'new origin' },
      { lat: 20.93, lng: 105.73, name: 'new destination' },
    );
    const newRoute = { ...route, routes: [{ ...route.routes[0], distance: 222 }] };
    newer.resolve(newRoute);
    await newRequest;
    older.reject(new Error('old route failed'));
    await oldRequest;

    expect(useStore.getState()).toMatchObject({ routingError: null, routingLoading: false });
    expect(useStore.getState().routingResult?.routes[0].distance).toBe(222);
  });

  it('does not restore a pending route after routing is cleared', async () => {
    const pending = deferred<typeof route>();
    api.getDirections.mockReturnValueOnce(pending.promise);
    const request = useStore.getState().fetchRoute(
      { lat: 20.9, lng: 105.7, name: 'origin' },
      { lat: 20.91, lng: 105.71, name: 'destination' },
    );
    useStore.getState().clearRouting();
    pending.resolve(route);
    await request;

    expect(useStore.getState()).toMatchObject({ routingResult: null, routingLoading: false, routingError: null });
  });

  it('does not restore the previous route when a new destination needs an origin', async () => {
    const pending = deferred<typeof route>();
    api.getDirections.mockReturnValueOnce(pending.promise);
    const request = useStore.getState().fetchRoute(
      { lat: 20.9, lng: 105.7, name: 'origin' },
      { lat: 20.91, lng: 105.71, name: 'old destination' },
    );
    await useStore.getState().startRoutingTo(makePlace({ id: 'new-destination' }), null);
    pending.resolve(route);
    await request;

    expect(useStore.getState()).toMatchObject({
      routingTo: { id: 'new-destination' },
      routingResult: null,
      routingLoading: false,
      routePicking: true,
    });
  });
});

describe('search', () => {
  it('ignores blank queries without calling the API', async () => {
    await useStore.getState().searchPlaces('   ');
    expect(api.search).not.toHaveBeenCalled();
    expect(useStore.getState().searchResults).toEqual([]);
  });

  it('stores the results', async () => {
    api.search.mockResolvedValue({ data: [makePlace()], meta: { query: 'a1', took_ms: 1 } });
    await useStore.getState().searchPlaces('a1');
    expect(api.search).toHaveBeenCalledWith({ q: 'a1', limit: 10 });
    expect(useStore.getState().searchResults).toHaveLength(1);
  });

  it('reports errors', async () => {
    api.search.mockRejectedValue(new Error('boom'));
    await useStore.getState().searchPlaces('a1');
    expect(useStore.getState().searchError).toBe('boom');
    expect(useStore.getState().searchLoading).toBe(false);
  });

  it('keeps the latest results when older searches resolve later', async () => {
    const older = deferred<{ data: ReturnType<typeof makePlace>[]; meta: { query: string; took_ms: number } }>();
    const newer = deferred<{ data: ReturnType<typeof makePlace>[]; meta: { query: string; took_ms: number } }>();
    api.search.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const oldRequest = useStore.getState().searchPlaces('old');
    const newRequest = useStore.getState().searchPlaces('new');
    newer.resolve({ data: [makePlace({ id: 'new-result' })], meta: { query: 'new', took_ms: 1 } });
    await newRequest;
    older.resolve({ data: [makePlace({ id: 'old-result' })], meta: { query: 'old', took_ms: 1 } });
    await oldRequest;

    expect(useStore.getState().searchResults.map((place) => place.id)).toEqual(['new-result']);
    expect(useStore.getState().searchLoading).toBe(false);
  });

  it('ignores an older search failure after a newer search succeeds', async () => {
    const older = deferred<{ data: ReturnType<typeof makePlace>[]; meta: { query: string; took_ms: number } }>();
    const newer = deferred<{ data: ReturnType<typeof makePlace>[]; meta: { query: string; took_ms: number } }>();
    api.search.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const oldRequest = useStore.getState().searchPlaces('old');
    const newRequest = useStore.getState().searchPlaces('new');
    newer.resolve({ data: [makePlace({ id: 'new-result' })], meta: { query: 'new', took_ms: 1 } });
    await newRequest;
    older.reject(new Error('old request failed'));
    await oldRequest;

    expect(useStore.getState()).toMatchObject({ searchError: null, searchLoading: false });
    expect(useStore.getState().searchResults.map((place) => place.id)).toEqual(['new-result']);
  });

  it('does not restore results when a pending search is cleared', async () => {
    const pending = deferred<{ data: ReturnType<typeof makePlace>[]; meta: { query: string; took_ms: number } }>();
    api.search.mockReturnValueOnce(pending.promise);
    const request = useStore.getState().searchPlaces('old');
    useStore.getState().clearSearch();
    pending.resolve({ data: [makePlace({ id: 'stale-result' })], meta: { query: 'old', took_ms: 1 } });
    await request;

    expect(useStore.getState()).toMatchObject({ searchQuery: '', searchResults: [], searchError: null, searchLoading: false });
  });
});

describe('categories', () => {
  it('ignores an older category failure after a newer load succeeds', async () => {
    const older = deferred<ReturnType<typeof makeCategory>[]>();
    const newer = deferred<ReturnType<typeof makeCategory>[]>();
    api.categories.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const oldRequest = useStore.getState().fetchCategories();
    const newRequest = useStore.getState().fetchCategories();
    const category = makeCategory({ code: 'library' });
    newer.resolve([category]);
    await newRequest;
    older.reject(new Error('old categories request failed'));
    await oldRequest;

    expect(useStore.getState()).toMatchObject({ categories: [category], categoriesError: null, categoriesLoading: false });
  });
});

describe('category filter', () => {
  it('filters both the list and the map layer by category and resets paging', async () => {
    api.list.mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } });
    useStore.getState().setActiveCategoryFilter('lab');
    expect(useStore.getState().placesQuery).toMatchObject({ category: 'lab', page: 1 });
    await vi.waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(api.list.mock.calls.every(([params]) => params.category === 'lab')).toBe(true);

    useStore.getState().setActiveCategoryFilter(null);
    expect(useStore.getState().placesQuery.category).toBeUndefined();
  });
});

describe('place list requests', () => {
  it('does not let an older filter response replace the newest place list', async () => {
    const older = deferred<{ data: ReturnType<typeof makePlace>[]; meta: { page: number; limit: number; total: number; totalPages: number } }>();
    const newer = deferred<{ data: ReturnType<typeof makePlace>[]; meta: { page: number; limit: number; total: number; totalPages: number } }>();
    api.list.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    useStore.setState({ placesQuery: { ...useStore.getState().placesQuery, category: 'old' } });
    const oldRequest = useStore.getState().fetchPlaces();
    useStore.setState({ placesQuery: { ...useStore.getState().placesQuery, category: 'new' } });
    const newRequest = useStore.getState().fetchPlaces();
    newer.resolve({ data: [makePlace({ id: 'new-list-result' })], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    await newRequest;
    older.resolve({ data: [makePlace({ id: 'old-list-result' })], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    await oldRequest;

    expect(useStore.getState().places.map((place) => place.id)).toEqual(['new-list-result']);
    expect(useStore.getState().placesLoading).toBe(false);
  });
});

describe('map places', () => {
  it('loads every page', async () => {
    const page = (n: number) => ({ data: [makePlace({ id: `p${n}` })], meta: { page: n, limit: 100, total: 2, totalPages: 2 } });
    api.list.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2));
    await useStore.getState().fetchMapPlaces();
    expect(useStore.getState().mapPlaces.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('drops the response of a superseded request', async () => {
    let release: (v: unknown) => void = () => undefined;
    api.list
      .mockReturnValueOnce(new Promise((r) => (release = r)))
      .mockResolvedValueOnce({ data: [makePlace({ id: 'new' })], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } });
    const stale = useStore.getState().fetchMapPlaces();
    await useStore.getState().fetchMapPlaces();
    release({ data: [makePlace({ id: 'old' })], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } });
    await stale;
    expect(useStore.getState().mapPlaces.map((p) => p.id)).toEqual(['new']);
  });

  it('exposes map-place load failures and clears them on retry', async () => {
    api.list.mockRejectedValueOnce(new Error('network unavailable'));
    await useStore.getState().fetchMapPlaces();
    expect(useStore.getState()).toMatchObject({ mapPlacesError: 'network unavailable', mapPlacesLoading: false });

    api.list.mockResolvedValueOnce({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } });
    await useStore.getState().fetchMapPlaces();
    expect(useStore.getState()).toMatchObject({ mapPlacesError: null, mapPlacesLoading: false, mapPlaces: [] });
  });
});

describe('route origin places', () => {
  it('loads all pages without applying the active category filter', async () => {
    const page = (n: number) => ({
      data: [makePlace({ id: `route-p${n}` })],
      meta: { page: n, limit: 100, total: 2, totalPages: 2 },
    });
    api.list.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2));
    useStore.setState({ placesQuery: { ...useStore.getState().placesQuery, category: 'parking' } });

    await useStore.getState().fetchRoutePlaces();

    expect(useStore.getState().routePlaces.map((place) => place.id)).toEqual(['route-p1', 'route-p2']);
    expect(api.list).toHaveBeenNthCalledWith(1, { page: 1, limit: 100, sort: 'name_vi', order: 'asc' });
    expect(api.list).toHaveBeenNthCalledWith(2, { page: 2, limit: 100, sort: 'name_vi', order: 'asc' });
    expect(api.list.mock.calls.every(([params]) => params.category === undefined)).toBe(true);
  });

  it('exposes a route-origin list failure for the panel to report', async () => {
    api.list.mockRejectedValueOnce(new Error('network unavailable'));
    await useStore.getState().fetchRoutePlaces();
    expect(useStore.getState()).toMatchObject({ routePlacesError: 'network unavailable', routePlacesLoading: false });
  });
});
