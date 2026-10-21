// =============================================
// Phenikaa WebGIS - Main App Component
// =============================================

import { useCallback, useEffect, useState } from 'react';
import {
  BaseMap,
  BuildingsLayer,
  RoutingLayer,
  RouteFit,
  MapControls,
} from './components/Map';
import { MapOverlays } from './components/Map/MapOverlays';
import { Sidebar } from './components/Layout/Sidebar';
import { RoutePanel } from './components/Routing/RoutePanel';
import { PlaceDetailPanel } from './components/UI';
import { useStore } from './store/useStore';
import type { Place } from './types';

const isNarrowScreen = () => window.matchMedia?.('(max-width: 768px)').matches === true;

function App() {
  const [schematicOpen, setSchematicOpen] = useState(false);
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
  const fetchRoutePlaces = useStore((s) => s.fetchRoutePlaces);
  const fetchCategories = useStore((s) => s.fetchCategories);
  const lang = useStore((s) => s.lang);

  useEffect(() => {
    fetchPlaces();
    fetchMapPlaces();
    fetchRoutePlaces();
    fetchCategories();
  }, [fetchPlaces, fetchMapPlaces, fetchRoutePlaces, fetchCategories]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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
    startRoutingTo(selectedPlace);
    // The detail panel would cover the route panel, so close it
    setSelectedPlace(null);
  };

  return (
    <div className="app">
      <Sidebar onPlaceSelect={handlePlaceSelect} />

      <main className="app__map">
        <BaseMap>
          <BuildingsLayer places={places} categories={categories} onPlaceClick={handlePlaceSelect} />
          <RoutingLayer route={routingResult?.routes?.[0] ?? null} fallback={routingResult?.meta?.fallback} />
          <RouteFit />
          <MapControls
            onOpenSchematic={() => setSchematicOpen(true)}
          />
        </BaseMap>

        <MapOverlays schematicOpen={schematicOpen} onCloseSchematic={() => setSchematicOpen(false)} />
        <RoutePanel />
      </main>

      {selectedPlace && (
        <PlaceDetailPanel place={selectedPlace} onClose={() => setSelectedPlace(null)} onDirections={handleDirections} />
      )}
    </div>
  );
}

export default App;
