import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';

/** Lets the user pick the route origin by clicking on the map. */
export function RoutePicker() {
  const map = useMap();
  const { t } = useT();
  const routePicking = useStore((s) => s.routePicking);
  const setRoutePicking = useStore((s) => s.setRoutePicking);
  const setRoutingOrigin = useStore((s) => s.setRoutingOrigin);

  useMapEvents({
    click: (e) => {
      if (!useStore.getState().routePicking) return;
      setRoutingOrigin({ lat: e.latlng.lat, lng: e.latlng.lng, name: t('map.pickedPoint'), source: 'map' });
    },
  });

  // Crosshair cursor while picking
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = routePicking ? 'crosshair' : '';
    return () => {
      container.style.cursor = '';
    };
  }, [map, routePicking]);

  // Escape cancels picking
  useEffect(() => {
    if (!routePicking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRoutePicking(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [routePicking, setRoutePicking]);

  return null;
}

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
