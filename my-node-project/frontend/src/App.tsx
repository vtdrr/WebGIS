// =============================================
// Phenikaa WebGIS - Main App Component
// =============================================

import { useCallback, useEffect } from 'react';
import {
  BaseMap,
  PlacesLayer,
  BuildingsLayer,
  UserLocation,
  RoutingLayer,
  RouteEndpoints,
  RoutePicker,
  RouteFit,
} from './components/Map';
import { MapOverlays } from './components/Map/MapOverlays';
import { Sidebar } from './components/Layout/Sidebar';
import { RoutePanel } from './components/Routing/RoutePanel';
import { PlaceDetailPanel } from './components/UI';
import { useGeolocation } from './hooks/useGeolocation';
import { useStore } from './store/useStore';
import type { Place } from './types';

const isNarrowScreen = () => window.matchMedia?.('(max-width: 768px)').matches === true;

function App() {
  const places = useStore((s) => s.mapPlaces);
  const categories = useStore((s) => s.categories);
  const selectedPlace = useStore((s) => s.selectedPlace);
  const setSelectedPlace = useStore((s) => s.setSelectedPlace);
  const clearSearch = useStore((s) => s.clearSearch);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const routingResult = useStore((s) => s.routingResult);
  const startRoutingTo = useStore((s) => s.startRoutingTo);
  const fetchPlaces = useStore((s) => s.fetchPlaces);
  const fetchMapPlaces = useStore((s) => s.fetchMapPlaces);
  const fetchCategories = useStore((s) => s.fetchCategories);
  const lang = useStore((s) => s.lang);

  useEffect(() => {
    fetchPlaces();
    fetchMapPlaces();
    fetchCategories();
  }, [fetchPlaces, fetchMapPlaces, fetchCategories]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const { position, error: geoError, loading: geoLoading, requestLocation } = useGeolocation();

  const handlePlaceSelect = useCallback(
    (place: Place) => {
      setSelectedPlace(place);
      clearSearch();
      // On a phone the list drawer would hide the map and the detail panel
      if (isNarrowScreen()) setSidebarOpen(false);
    },
    [setSelectedPlace, clearSearch, setSidebarOpen],
  );

  const handleDirections = () => {
    if (!selectedPlace) return;
    startRoutingTo(selectedPlace, position);
    // The detail panel would cover the route panel, so close it
    setSelectedPlace(null);
  };

  return (
    <div className="app">
      <Sidebar onPlaceSelect={handlePlaceSelect} />

      <main className="app__map">
        <BaseMap>
          <PlacesLayer
            places={places}
            categories={categories}
            selectedPlaceId={selectedPlace?.id ?? null}
            onPlaceClick={handlePlaceSelect}
          />
          <BuildingsLayer places={places} categories={categories} />
          {position && <UserLocation position={position} />}
          <RoutingLayer route={routingResult?.routes?.[0] ?? null} fallback={routingResult?.meta?.fallback} />
          <RouteEndpoints />
          <RoutePicker />
          <RouteFit />
        </BaseMap>

        <MapOverlays geoError={geoError} geoLoading={geoLoading} onLocate={requestLocation} />
        <RoutePanel gpsPosition={position} />
      </main>

      {selectedPlace && (
        <PlaceDetailPanel place={selectedPlace} onClose={() => setSelectedPlace(null)} onDirections={handleDirections} />
      )}
    </div>
  );
}

export default App;
