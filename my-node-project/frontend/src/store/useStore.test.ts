import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePlace } from '../test/fixtures';

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

beforeEach(() => {
  useStore.setState(initial, true);
  vi.resetAllMocks();
  useStore.setState({ lang: 'vi' });
});

describe('language', () => {
  it('switches and persists the language', () => {
    useStore.getState().setLang('en');
    expect(useStore.getState().lang).toBe('en');
    expect(localStorage.getItem('webgis.lang')).toBe('en');
  });
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

  it('names the GPS origin in the current language', async () => {
    api.getDirections.mockResolvedValue(route);
    useStore.getState().setLang('en');
    await useStore.getState().startRoutingTo(makePlace(), { lat: 20.95, lng: 105.74 });
    expect(useStore.getState().routingFrom?.name).toBe('My location');
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

  it('changing the mode re-fetches with that mode', async () => {
    api.getDirections.mockResolvedValue(route);
    await useStore.getState().startRoutingTo(makePlace(), { lat: 20.95, lng: 105.74 });
    useStore.getState().setRoutingMode('wheelchair');
    await vi.waitFor(() => expect(api.getDirections).toHaveBeenCalledTimes(2));
    expect(api.getDirections).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'wheelchair' }));
  });

  it('keeps the server message when routing fails and clears the stale route', async () => {
    api.getDirections.mockResolvedValueOnce(route).mockRejectedValueOnce(new Error('Điểm đến quá xa'));
    await useStore.getState().startRoutingTo(makePlace(), { lat: 20.95, lng: 105.74 });
    useStore.getState().setRoutingMode('bike');
    await vi.waitFor(() => expect(useStore.getState().routingError).toBe('Điểm đến quá xa'));
    expect(useStore.getState().routingResult).toBeNull();
    expect(useStore.getState().routingLoading).toBe(false);
  });

  it('swap exchanges origin and destination when the origin is a known place', async () => {
    api.getDirections.mockResolvedValue(route);
    const a = makePlace({ id: 'a', name_vi: 'A' });
    const b = makePlace({ id: 'b', name_vi: 'B', geom_point: { type: 'Point', coordinates: [105.75, 20.97] } });
    useStore.setState({ mapPlaces: [a, b] });
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
});
