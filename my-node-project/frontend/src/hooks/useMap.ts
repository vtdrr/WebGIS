// =============================================
// Phenikaa WebGIS - Custom Hooks
// =============================================

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { Place, Point } from '../types';
import { useStore } from '../store/useStore';
import { PHENIKAA_CENTER, PHENIKAA_ZOOM, PHENIKAA_BOUNDS } from '../types';

// Default map center and zoom
export function useMapInit() {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      map.setView(PHENIKAA_CENTER, PHENIKAA_ZOOM);
      map.setMaxBounds(PHENIKAA_BOUNDS);
      map.setMinZoom(15);
      map.setMaxZoom(20);
      initialized.current = true;
    }
  }, [map]);

  return map;
}

// Fit bounds to places
export function useFitBounds(places: Place[], padding = [20, 20]) {
  const map = useMap();

  useEffect(() => {
    if (places.length === 0) return;

    const validPlaces = places.filter(p => p.geom_point?.coordinates);
    if (validPlaces.length === 0) return;

    const bounds = L.latLngBounds(
      validPlaces.map(p => [p.geom_point!.coordinates[1], p.geom_point!.coordinates[0]] as [number, number])
    );
    map.fitBounds(bounds, { padding: L.point(padding[0], padding[1]), maxZoom: 18 });
  }, [map, places, padding]);
}

// Handle map move events and update store
export function useMapSync() {
  const setMapCenter = useStore(s => s.setMapCenter);
  const setMapZoom = useStore(s => s.setMapZoom);
  const setMapBounds = useStore(s => s.setMapBounds);

  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      setMapCenter([map.getCenter().lat, map.getCenter().lng]);
      setMapZoom(map.getZoom());
      setMapBounds(map.getBounds().toArray() as [[number, number], [number, number]]);
    },
  });
}

// Custom marker icon factory (plain function - safe to call in loops)
export function createMarkerIcon(categoryColor: string, categoryIcon?: string) {
  const iconHtml = `
    <div style="
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      background: ${categoryColor};
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      border: 3px solid white;
    ">
      <div style="
        transform: rotate(45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: white;
        font-size: 14px;
      ">
        ${categoryIcon || '📍'}
      </div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// Cluster icon factory
export function useClusterIcon() {
  return useMemo(() => {
    return L.divIcon({
      html: '',
      className: 'marker-cluster',
      iconSize: [40, 40],
    });
  }, []);
}

// Geolocation hook
export function useGeolocation() {
  const [position, setPosition] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  return { position, error, loading, requestLocation };
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Local storage hook
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
}