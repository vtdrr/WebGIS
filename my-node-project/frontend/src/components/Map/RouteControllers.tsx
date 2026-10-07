import { useEffect } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';

function endpointIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="width: 26px; height: 26px; border-radius: 50%; background: ${color}; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); color: white; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center;">${label}</div>`,
    className: 'route-endpoint-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const ORIGIN_ICON = endpointIcon('#16a34a', 'A');
const DESTINATION_ICON = endpointIcon('#dc2626', 'B');

/** Origin (A) and destination (B) markers. A picked origin can be dragged. */
export function RouteEndpoints() {
  const { t } = useT();
  const routingFrom = useStore((s) => s.routingFrom);
  const routingTo = useStore((s) => s.routingTo);
  const setRoutingOrigin = useStore((s) => s.setRoutingOrigin);

  const destination = routingTo?.geom_point?.coordinates;
  // GPS already has its own marker; only mark picked points and places
  const showOrigin = routingFrom && routingFrom.source !== 'gps';
  const draggable = routingFrom?.source === 'map';

  return (
    <>
      {showOrigin && (
        <Marker
          key={`from-${routingFrom.lat}-${routingFrom.lng}`}
          position={[routingFrom.lat, routingFrom.lng]}
          icon={ORIGIN_ICON}
          draggable={draggable}
          zIndexOffset={900}
          eventHandlers={
            draggable
              ? {
                  dragend: (e) => {
                    const { lat, lng } = (e.target as L.Marker).getLatLng();
                    setRoutingOrigin({ lat, lng, name: t('map.pickedPoint'), source: 'map' });
                  },
                }
              : undefined
          }
        >
          {draggable && <Popup>{t('map.dragToChange')}</Popup>}
        </Marker>
      )}
      {destination && Number.isFinite(destination[0]) && Number.isFinite(destination[1]) && (
        <Marker position={[destination[1], destination[0]]} icon={DESTINATION_ICON} zIndexOffset={900} />
      )}
    </>
  );
}

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
