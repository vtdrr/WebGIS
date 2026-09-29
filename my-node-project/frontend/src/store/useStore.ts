// =============================================
// Phenikaa WebGIS - Zustand Store
// =============================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Category, Place, PlaceQueryParams, MapState } from '../types';

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

  // Filters
  activeCategoryFilter: string | null;
  setActiveCategoryFilter: (code: string | null) => void;

  // Routing
  routingFrom: Place | null;
  routingTo: Place | null;
  routingResult: unknown | null;
  routingLoading: boolean;
  setRoutingFrom: (place: Place | null) => void;
  setRoutingTo: (place: Place | null) => void;
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
      center: [21.2872, 105.7825],
      zoom: 17,
      bounds: null,
    },
    setMapCenter: (center) => set((state) => ({ mapState: { ...state.mapState, center } })),
    setMapZoom: (zoom) => set((state) => ({ mapState: { ...state.mapState, zoom } })),
    setMapBounds: (bounds) => set((state) => ({ mapState: { ...state.mapState, bounds } })),

    // UI
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),

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
    setRoutingFrom: (place) => set({ routingFrom: place }),
    setRoutingTo: (place) => set({ routingTo: place }),
    clearRouting: () => set({ routingFrom: null, routingTo: null, routingResult: null }),
  }))
);

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