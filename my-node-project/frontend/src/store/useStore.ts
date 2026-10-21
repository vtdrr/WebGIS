// =============================================
// Phenikaa WebGIS - Zustand Store
// =============================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Category, Place, PlaceQueryParams, MapState, RoutingResponse } from '../types';
import { PHENIKAA_CENTER, PHENIKAA_ZOOM } from '../types';
import { detectLang, translate, type Lang } from '../i18n';
import { categoriesApi, placesApi, routingApi } from '../services/api';

/** Narrow screens start with the place list closed so the map is visible. */
const isNarrowScreen = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches === true;

export interface RoutePoint {
  lat: number;
  lng: number;
  name: string;
  /** Set when the point comes from a place (enables swapping origin/destination) */
  placeId?: string;
}

interface AppState {
  // Language
  lang: Lang;

  // Categories
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  categoriesLoaded: boolean;
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
  mapPlacesError: string | null;
  fetchMapPlaces: () => Promise<void>;

  // Unfiltered places for choosing a route origin, regardless of sidebar filters
  routePlaces: Place[];
  routePlacesLoading: boolean;
  routePlacesError: string | null;
  fetchRoutePlaces: () => Promise<void>;

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
  satelliteMode: boolean;
  setSatelliteMode: (enabled: boolean) => void;
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
  setRoutingOrigin: (origin: Place | null) => Promise<void>;
  swapRouting: () => Promise<void>;
  setRoutingTo: (place: Place | null) => void;
  fetchRoute: (
    from: { lat: number; lng: number; name: string },
    to: { lat: number; lng: number; name: string },
  ) => Promise<void>;
  startRoutingTo: (place: Place) => Promise<void>;
  clearRouting: () => void;
}

const MAP_PLACES_PAGE_SIZE = 100; // backend max page size
const MAP_PLACES_MAX_PAGES = 50;   // safety cap: 5000 places
let mapPlacesRequestId = 0;
let routePlacesRequestId = 0;
let placesRequestId = 0;
let categoriesRequestId = 0;
let searchRequestId = 0;
let routingRequestId = 0;

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // Language
    lang: detectLang(),

    // Categories
    categories: [],
    categoriesLoading: false,
    categoriesError: null,
    categoriesLoaded: false,
    fetchCategories: async () => {
      const requestId = ++categoriesRequestId;
      set({ categoriesLoading: true, categoriesError: null });
      try {
        const categories = await categoriesApi.list();
        if (requestId === categoriesRequestId) set({ categories, categoriesLoading: false, categoriesLoaded: true });
      } catch (err) {
        if (requestId !== categoriesRequestId) return;
          set({ categoriesError: err instanceof Error ? err.message : 'Không tải được danh mục', categoriesLoading: false });
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
      const requestId = ++placesRequestId;
      const { placesQuery } = get();
      set({ placesLoading: true, placesError: null });
      try {
        const response = await placesApi.list(placesQuery);
        if (requestId !== placesRequestId) return;
        set({
          places: response.data,
          placesMeta: response.meta,
          placesLoading: false,
        });
      } catch (err) {
        if (requestId !== placesRequestId) return;
          set({ placesError: err instanceof Error ? err.message : 'Không tải được địa điểm', placesLoading: false });
      }
    },
    loadMorePlaces: async () => {
      const { placesQuery, placesMeta, places } = get();
      if (!placesMeta || placesQuery.page >= placesMeta.totalPages) return;
      const requestId = placesRequestId;
      set({ placesLoading: true });
      try {
        const response = await placesApi.list({ ...placesQuery, page: placesQuery.page + 1 });
        if (requestId !== placesRequestId) return;
        set({
          places: [...places, ...response.data],
          placesMeta: response.meta,
          placesLoading: false,
        });
      } catch (err) {
        if (requestId !== placesRequestId) return;
          set({ placesError: err instanceof Error ? err.message : 'Không tải thêm được địa điểm', placesLoading: false });
      }
    },

    // All places for the map layer
    mapPlaces: [],
    mapPlacesLoading: false,
    mapPlacesError: null,
    fetchMapPlaces: async () => {
      const requestId = ++mapPlacesRequestId;
      set({ mapPlacesLoading: true, mapPlacesError: null });
      try {
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
        set({ mapPlaces: all, mapPlacesLoading: false, mapPlacesError: null });
      } catch (err) {
        if (requestId === mapPlacesRequestId) {
          set({
            mapPlacesLoading: false,
            mapPlacesError: err instanceof Error ? err.message : 'Không tải được địa điểm trên bản đồ',
          });
        }
      }
    },

    routePlaces: [],
    routePlacesLoading: false,
    routePlacesError: null,
    fetchRoutePlaces: async () => {
      const requestId = ++routePlacesRequestId;
      set({ routePlacesLoading: true, routePlacesError: null });
      try {
        const all: Place[] = [];
        for (let page = 1; page <= MAP_PLACES_MAX_PAGES; page++) {
          const response = await placesApi.list({
            page,
            limit: MAP_PLACES_PAGE_SIZE,
            sort: 'name_vi',
            order: 'asc',
          });
          if (requestId !== routePlacesRequestId) return;
          all.push(...response.data);
          if (page >= response.meta.totalPages) break;
        }
        set({ routePlaces: all, routePlacesLoading: false, routePlacesError: null });
      } catch (err) {
        if (requestId === routePlacesRequestId) {
          set({
            routePlacesLoading: false,
            routePlacesError: err instanceof Error ? err.message : 'Không tải được địa điểm cho điểm xuất phát',
          });
        }
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
      const requestId = ++searchRequestId;
      if (!query.trim()) {
        set({ searchResults: [], searchQuery: '', searchError: null, searchLoading: false });
        return;
      }
      set({ searchLoading: true, searchError: null, searchQuery: query });
      try {
        const response = await placesApi.search({ q: query, limit: 10 });
        if (requestId === searchRequestId) set({ searchResults: response.data, searchLoading: false });
      } catch (err) {
        if (requestId !== searchRequestId) return;
          set({ searchError: err instanceof Error ? err.message : 'Tìm kiếm không thành công', searchLoading: false });
      }
    },
    clearSearch: () => {
      searchRequestId++;
      set({ searchResults: [], searchQuery: '', searchError: null, searchLoading: false });
    },

    // Map
    mapState: {
      center: [PHENIKAA_CENTER[0], PHENIKAA_CENTER[1]],
      zoom: PHENIKAA_ZOOM,
      bounds: null,
    },
    satelliteMode: false,
    setSatelliteMode: (satelliteMode) => set({ satelliteMode }),
    setMapCenter: (center) => set((state) => ({ mapState: { ...state.mapState, center } })),
    setMapZoom: (zoom) => set((state) => ({ mapState: { ...state.mapState, zoom } })),
    setMapBounds: (bounds) => set((state) => ({ mapState: { ...state.mapState, bounds } })),

    // UI
    sidebarOpen: !isNarrowScreen(),
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
    setRoutingTo: (place) => {
      routingRequestId++;
      set({ routingTo: place, routingResult: null, routingError: null, routingLoading: false });
    },
    setRoutingOrigin: async (origin) => {
      if (!origin) {
        routingRequestId++;
        set({ routingFrom: null, routingResult: null, routingError: null, routingLoading: false });
        return;
      }
      const from = placeToRoutePoint(origin);
      set({ routingFrom: from, routingError: null });
      const { routingTo } = get();
      if (routingTo) await get().fetchRoute(from, placeToRoutePoint(routingTo));
    },
    swapRouting: async () => {
      const { routingFrom, routingTo, routePlaces } = get();
      if (!routingFrom?.placeId || !routingTo) return;
      const newTo = routePlaces.find((p) => p.id === routingFrom.placeId);
      if (!newTo) return;
      const newFrom = placeToRoutePoint(routingTo);
      set({ routingFrom: newFrom, routingTo: newTo, routingError: null });
      await get().fetchRoute(newFrom, placeToRoutePoint(newTo));
    },
    fetchRoute: async (from, to) => {
      await fetchRouteImpl(set, get, from, to);
    },
    startRoutingTo: async (place) => {
      routingRequestId++;
      set({
        routingFrom: null,
        routingTo: place,
        routingResult: null,
        routingError: null,
        routingLoading: false,
      });
    },
    clearRouting: () => {
      routingRequestId++;
      set({ routingFrom: null, routingTo: null, routingResult: null, routingLoading: false, routingError: null });
    },
  }))
);

// Convert a Place to a route endpoint (uses its geometry when available)
function placeToRoutePoint(place: Place): RoutePoint {
  const coords = place.geom_point?.coordinates;
  if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
    return { lat: coords[1], lng: coords[0], name: place.name_vi, placeId: place.id };
  }
  return { lat: PHENIKAA_CENTER[0], lng: PHENIKAA_CENTER[1], name: place.name_vi, placeId: place.id };
}

// Route fetching helper
async function fetchRouteImpl(
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
  from: { lat: number; lng: number; name: string },
  to: { lat: number; lng: number; name: string },
): Promise<void> {
  const requestId = ++routingRequestId;
  set({ routingLoading: true, routingError: null });
  try {
    const result = await routingApi.getDirections({
      from: `${from.lat},${from.lng}`,
      to: `${to.lat},${to.lng}`,
      mode: 'walk',
    });
    if (requestId === routingRequestId) set({ routingResult: result, routingLoading: false });
  } catch (err) {
    if (requestId !== routingRequestId) return;
    set({
      routingError: err instanceof Error ? err.message : translate(get().lang, 'route.failed'),
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
