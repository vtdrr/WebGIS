// =============================================
// Phenikaa WebGIS - Zustand Store
// =============================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Category, Place, PlaceQueryParams, MapState, RoutingResponse, RoutingParams } from '../types';
import { PHENIKAA_CENTER, PHENIKAA_ZOOM } from '../types';

export interface RoutePoint {
  lat: number;
  lng: number;
  name: string;
  /** Set when the point comes from a place (enables swapping origin/destination) */
  placeId?: string;
  /** Where the point came from: GPS fix, a click on the map, or a known place */
  source?: 'gps' | 'map' | 'place';
}

interface AppState {
  // Categories
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  fetchCategories: () => Promise<void>;

  // Places
  places: Place[];
  placesLoading: boolean;
  placesError: string | null;
  placesMeta: { page: number; limit: number; total: number; totalPages: number } | null;
  placesQuery: PlaceQueryParams;
  setPlacesQuery: (query: Partial<PlaceQueryParams>) => void;
  fetchPlaces: () => Promise<void>;
  loadMorePlaces: () => Promise<void>;

  // All places for the map layer (independent from the paginated sidebar list)
  mapPlaces: Place[];
  mapPlacesLoading: boolean;
  fetchMapPlaces: () => Promise<void>;

  // Selected place
  selectedPlace: Place | null;
  setSelectedPlace: (place: Place | null) => void;

  // Search
  searchResults: Place[];
  searchLoading: boolean;
  searchError: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchPlaces: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Map
  mapState: MapState;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setMapBounds: (bounds: [[number, number], [number, number]] | null) => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Map reset
  resetToken: number;
  resetMapView: () => void;

  // Filters
  activeCategoryFilter: string | null;
  setActiveCategoryFilter: (code: string | null) => void;

  // Routing
  routingFrom: RoutePoint | null;
  routingTo: Place | null;
  routingResult: RoutingResponse | null;
  routingLoading: boolean;
  routingError: string | null;
  routingMode: RoutingParams['mode'];
  setRoutingFrom: (point: RoutePoint | null) => void;
  setRoutingOrigin: (origin: Place | { lat: number; lng: number; name: string; source?: RoutePoint['source'] } | null) => Promise<void>;
  /** True while the user is choosing the route origin by clicking on the map */
  routePicking: boolean;
  setRoutePicking: (picking: boolean) => void;
  swapRouting: () => Promise<void>;
  setRoutingTo: (place: Place | null) => void;
  setRoutingMode: (mode: RoutingParams['mode']) => void;
  fetchRoute: (
    from: { lat: number; lng: number; name: string },
    to: { lat: number; lng: number; name: string },
    mode: RoutingParams['mode'],
  ) => Promise<void>;
  startRoutingTo: (place: Place, userPosition?: { lat: number; lng: number } | null) => Promise<void>;
  clearRouting: () => void;
}

const MAP_PLACES_PAGE_SIZE = 100; // backend max page size
const MAP_PLACES_MAX_PAGES = 50;   // safety cap: 5000 places
let mapPlacesRequestId = 0;

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // Categories
    categories: [],
    categoriesLoading: false,
    categoriesError: null,
    fetchCategories: async () => {
      set({ categoriesLoading: true, categoriesError: null });
      try {
        const { categoriesApi } = await import('../services/api');
        const categories = await categoriesApi.list();
        set({ categories, categoriesLoading: false });
      } catch (err) {
        set({ categoriesError: err instanceof Error ? err.message : 'Failed to load categories', categoriesLoading: false });
      }
    },

    // Places
    places: [],
    placesLoading: false,
    placesError: null,
    placesMeta: null,
    placesQuery: { page: 1, limit: 20, sort: 'name_vi', order: 'asc' },
    setPlacesQuery: (query) => set((state) => ({ placesQuery: { ...state.placesQuery, ...query, page: 1 } })),
    fetchPlaces: async () => {
      const { placesQuery } = get();
      set({ placesLoading: true, placesError: null });
      try {
        const { placesApi } = await import('../services/api');
        const response = await placesApi.list(placesQuery);
        set({
          places: response.data,
          placesMeta: response.meta,
          placesLoading: false,
        });
      } catch (err) {
        set({ placesError: err instanceof Error ? err.message : 'Failed to load places', placesLoading: false });
      }
    },
    loadMorePlaces: async () => {
      const { placesQuery, placesMeta, places } = get();
      if (!placesMeta || placesQuery.page >= placesMeta.totalPages) return;
      set({ placesLoading: true });
      try {
        const { placesApi } = await import('../services/api');
        const response = await placesApi.list({ ...placesQuery, page: placesQuery.page + 1 });
        set({
          places: [...places, ...response.data],
          placesMeta: response.meta,
          placesLoading: false,
        });
      } catch (err) {
        set({ placesError: err instanceof Error ? err.message : 'Failed to load more places', placesLoading: false });
      }
    },

    // All places for the map layer
    mapPlaces: [],
    mapPlacesLoading: false,
    fetchMapPlaces: async () => {
      const requestId = ++mapPlacesRequestId;
      set({ mapPlacesLoading: true });
      try {
        const { placesApi } = await import('../services/api');
        const { category } = get().placesQuery;
        const all: Place[] = [];
        for (let page = 1; page <= MAP_PLACES_MAX_PAGES; page++) {
          const response = await placesApi.list({
            page,
            limit: MAP_PLACES_PAGE_SIZE,
            sort: 'name_vi',
            order: 'asc',
            category,
          });
          // A newer request started (e.g. category changed): drop this one
          if (requestId !== mapPlacesRequestId) return;
          all.push(...response.data);
          if (page >= response.meta.totalPages) break;
        }
        set({ mapPlaces: all, mapPlacesLoading: false });
      } catch {
        if (requestId === mapPlacesRequestId) set({ mapPlacesLoading: false });
      }
    },

    // Selected place
    selectedPlace: null,
    setSelectedPlace: (place) => set({ selectedPlace: place }),

    // Search
    searchResults: [],
    searchLoading: false,
    searchError: null,
    searchQuery: '',
    setSearchQuery: (query) => set({ searchQuery: query }),
    searchPlaces: async (query) => {
      if (!query.trim()) { set({ searchResults: [], searchQuery: '' }); return; }
      set({ searchLoading: true, searchError: null, searchQuery: query });
      try {
        const { placesApi } = await import('../services/api');
        const response = await placesApi.search({ q: query, limit: 10 });
        set({ searchResults: response.data, searchLoading: false });
      } catch (err) {
        set({ searchError: err instanceof Error ? err.message : 'Search failed', searchLoading: false });
      }
    },
    clearSearch: () => set({ searchResults: [], searchQuery: '', searchError: null }),

    // Map
    mapState: {
      center: [PHENIKAA_CENTER[0], PHENIKAA_CENTER[1]],
      zoom: PHENIKAA_ZOOM,
      bounds: null,
    },
    setMapCenter: (center) => set((state) => ({ mapState: { ...state.mapState, center } })),
    setMapZoom: (zoom) => set((state) => ({ mapState: { ...state.mapState, zoom } })),
    setMapBounds: (bounds) => set((state) => ({ mapState: { ...state.mapState, bounds } })),

    // UI
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    // Map reset
    resetToken: 0,
    resetMapView: () => set((state) => ({ resetToken: state.resetToken + 1 })),

    // Filters
    activeCategoryFilter: null,
    setActiveCategoryFilter: (code) => {
      set({ activeCategoryFilter: code, placesQuery: { ...get().placesQuery, category: code || undefined, page: 1 } });
      get().fetchPlaces();
      get().fetchMapPlaces();
    },

    // Routing
    routingFrom: null,
    routingTo: null,
    routingResult: null,
    routingLoading: false,
    routingError: null,
    routingMode: 'walk',
    setRoutingFrom: (point) => set({ routingFrom: point }),
    routePicking: false,
    setRoutePicking: (picking) => set({ routePicking: picking }),
    setRoutingTo: (place) => set({ routingTo: place }),
    setRoutingMode: (mode) => {
      set({ routingMode: mode });
      const { routingFrom, routingTo } = get();
      if (routingFrom && routingTo) {
        get().fetchRoute(routingFrom, placeToRoutePoint(routingTo), mode);
      }
    },
    setRoutingOrigin: async (origin) => {
      if (!origin) {
        set({ routingFrom: null, routingResult: null, routingError: null });
        return;
      }
      const from: RoutePoint = 'name_vi' in origin ? placeToRoutePoint(origin) : origin;
      set({ routingFrom: from, routingError: null, routePicking: false });
      const { routingTo, routingMode } = get();
      if (routingTo) await get().fetchRoute(from, placeToRoutePoint(routingTo), routingMode);
    },
    swapRouting: async () => {
      const { routingFrom, routingTo, mapPlaces, places, routingMode } = get();
      if (!routingFrom?.placeId || !routingTo) return;
      const newTo = [...mapPlaces, ...places].find((p) => p.id === routingFrom.placeId);
      if (!newTo) return;
      const newFrom = placeToRoutePoint(routingTo);
      set({ routingFrom: newFrom, routingTo: newTo, routingError: null });
      await get().fetchRoute(newFrom, placeToRoutePoint(newTo), routingMode);
    },
    fetchRoute: async (from, to, mode) => {
      await fetchRouteImpl(set, from, to, mode);
    },
    startRoutingTo: async (place, userPosition) => {
      // Without a GPS fix the user must pick an origin explicitly
      const from: RoutePoint | null = userPosition
        ? { lat: userPosition.lat, lng: userPosition.lng, name: 'Vị trí của tôi', source: 'gps' }
        : null;
      set({
        routingFrom: from,
        routingTo: place,
        routingResult: null,
        routingError: null,
        // No GPS: let the user click their position on the map right away
        routePicking: !from,
      });
      if (from) await get().fetchRoute(from, placeToRoutePoint(place), get().routingMode);
    },
    clearRouting: () => set({ routingFrom: null, routingTo: null, routingResult: null, routingLoading: false, routingError: null, routePicking: false }),
  }))
);

// Convert a Place to a route endpoint (uses its geometry when available)
function placeToRoutePoint(place: Place): RoutePoint {
  const coords = place.geom_point?.coordinates;
  if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
    return { lat: coords[1], lng: coords[0], name: place.name_vi, placeId: place.id, source: 'place' };
  }
  return { lat: PHENIKAA_CENTER[0], lng: PHENIKAA_CENTER[1], name: place.name_vi, placeId: place.id, source: 'place' };
}

// Route fetching helper
async function fetchRouteImpl(
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  from: { lat: number; lng: number; name: string },
  to: { lat: number; lng: number; name: string },
  mode: RoutingParams['mode'],
): Promise<void> {
  set({ routingLoading: true, routingError: null });
  try {
    const { routingApi } = await import('../services/api');
    const result = await routingApi.getDirections({
      from: `${from.lat},${from.lng}`,
      to: `${to.lat},${to.lng}`,
      mode,
    });
    set({ routingResult: result, routingLoading: false });
  } catch (err) {
    set({
      routingError: err instanceof Error ? err.message : 'Không thể tính tuyến đường',
      routingLoading: false,
      routingResult: null,
    });
  }
}

// Selectors for performance
export const selectCategories = (state: AppState) => state.categories;
export const selectPlaces = (state: AppState) => state.places;
export const selectSelectedPlace = (state: AppState) => state.selectedPlace;
export const selectSearchResults = (state: AppState) => state.searchResults;
export const selectMapState = (state: AppState) => state.mapState;
export const selectSidebarOpen = (state: AppState) => state.sidebarOpen;
export const selectActiveCategoryFilter = (state: AppState) => state.activeCategoryFilter;
export const selectRoutingFrom = (state: AppState) => state.routingFrom;
export const selectRoutingTo = (state: AppState) => state.routingTo;