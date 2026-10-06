// =============================================
// Phenikaa WebGIS - Zustand Store
// =============================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Category, Place, PlaceQueryParams, MapState, RoutingResponse, RoutingParams } from '../types';
import { PHENIKAA_CENTER, PHENIKAA_ZOOM } from '../types';

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
  routingFrom: { lat: number; lng: number; name: string } | null;
  routingTo: Place | null;
  routingResult: RoutingResponse | null;
  routingLoading: boolean;
  routingError: string | null;
  routingMode: RoutingParams['mode'];
  setRoutingFrom: (point: { lat: number; lng: number; name: string } | null) => void;
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
    },

    // Routing
    routingFrom: null,
    routingTo: null,
    routingResult: null,
    routingLoading: false,
    routingError: null,
    routingMode: 'walk',
    setRoutingFrom: (point) => set({ routingFrom: point }),
    setRoutingTo: (place) => set({ routingTo: place }),
    setRoutingMode: (mode) => {
      set({ routingMode: mode });
      const { routingFrom, routingTo } = get();
      if (routingFrom && routingTo) {
        get().fetchRoute(routingFrom, placeToRoutePoint(routingTo), mode);
      }
    },
    fetchRoute: async (from, to, mode) => {
      await fetchRouteImpl(set, from, to, mode);
    },
    startRoutingTo: async (place, userPosition) => {
      const from = userPosition
        ? { lat: userPosition.lat, lng: userPosition.lng, name: 'Vị trí của tôi' }
        : { lat: PHENIKAA_CENTER[0], lng: PHENIKAA_CENTER[1], name: 'Tâm khuôn viên' };
      const to = placeToRoutePoint(place);
      set({
        routingFrom: from,
        routingTo: place,
        routingError: null,
      });
      await get().fetchRoute(from, to, get().routingMode);
    },
    clearRouting: () => set({ routingFrom: null, routingTo: null, routingResult: null, routingLoading: false, routingError: null }),
  }))
);

// Convert a Place to a route endpoint (uses its geometry when available)
function placeToRoutePoint(place: Place): { lat: number; lng: number; name: string } {
  const coords = place.geom_point?.coordinates;
  if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
    return { lat: coords[1], lng: coords[0], name: place.name_vi };
  }
  return { lat: PHENIKAA_CENTER[0], lng: PHENIKAA_CENTER[1], name: place.name_vi };
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