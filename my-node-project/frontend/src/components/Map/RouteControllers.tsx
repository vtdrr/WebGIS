import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../../store/useStore';

/** Zooms to the route when a new one arrives. */
export function RouteFit() {
  const map = useMap();
  const route = useStore((s) => s.routingResult?.routes?.[0]);

  useEffect(() => {
    if (!route || typeof route.geometry === 'string') return;
    const coords = route.geometry.coordinates;
    if (!coords || coords.length < 2) return;
    const bounds = L.latLngBounds(coords.map(([lng, lat]) => [lat, lng] as [number, number]));
    // Leave room for the route panel and the controls (less room on narrow screens)
    const narrow = window.matchMedia?.('(max-width: 768px)').matches;
    map.fitBounds(
      bounds,
      narrow
        ? { paddingTopLeft: [20, 80], paddingBottomRight: [20, 320], maxZoom: 18 }
        : { paddingTopLeft: [40, 80], paddingBottomRight: [380, 40], maxZoom: 18 },
    );
  }, [map, route]);

  return null;
}
