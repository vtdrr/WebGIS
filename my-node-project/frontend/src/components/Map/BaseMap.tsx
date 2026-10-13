import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, LayersControl, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import './leafletSetup';
import { PHENIKAA_CENTER, PHENIKAA_ZOOM, MAP_BOUNDS, MAP_MIN_ZOOM } from '../../types';
import { useMapSync } from '../../hooks/useMap';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';

export function BaseMap({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <MapContainer
      center={PHENIKAA_CENTER}
      zoom={PHENIKAA_ZOOM}
      maxBounds={MAP_BOUNDS}
      maxBoundsViscosity={1}
      minZoom={MAP_MIN_ZOOM}
      maxZoom={20}
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
      doubleClickZoom={true}
      touchZoom={true}
      boxZoom={true}
      keyboard={true}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name={t('map.layerStreet')}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
            maxNativeZoom={18}
            maxZoom={20}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name={t('map.layerSatellite')}>
          <TileLayer
            attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={19}
            maxZoom={20}
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      <ZoomControl position="topleft" />
      {children}
      <MapGeometrySync />
      <MapSync />
      <MapFlyTo />
      <MapResetController />
    </MapContainer>
  );
}

/** Re-sync Leaflet's vector renderer after a pan or a map-container resize. */
function MapGeometrySync() {
  const map = useMap();
  const selectedPlace = useStore((state) => state.selectedPlace);

  useEffect(() => {
    const redrawGeoJson = () => {
      map.eachLayer((layer) => {
        if (!(layer instanceof L.GeoJSON)) return;
        layer.eachLayer((feature) => {
          if (feature instanceof L.Path) feature.redraw();
        });
      });
    };

    map.on('moveend', redrawGeoJson);

    let frame: number | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const container = map.getContainer();
    let observedWidth = container.clientWidth;
    let observedHeight = container.clientHeight;
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          if (resizeTimer !== null) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            resizeTimer = null;
            frame = requestAnimationFrame(() => {
              frame = null;
              const width = container.clientWidth;
              const height = container.clientHeight;
              if (width === observedWidth && height === observedHeight) return;
              observedWidth = width;
              observedHeight = height;

              map.invalidateSize({ pan: false });
              redrawGeoJson();

              const coordinates = selectedPlace?.geom_point?.coordinates;
              if (coordinates && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])) {
                const zoom = map.getZoom();
                const center = centerForVisiblePlace(map, [coordinates[1], coordinates[0]], zoom);
                map.flyTo(center, zoom, { duration: 0.35 });
              }
            });
          }, 100);
        });
    observer?.observe(container);

    return () => {
      map.off('moveend', redrawGeoJson);
      observer?.disconnect();
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [map, selectedPlace]);

  return null;
}

/** Return the pixel offset from the map center to the unobstructed map center. */
function visibleAreaOffset(map: L.Map): L.Point {
  const panel = document.querySelector<HTMLElement>('.detail');
  if (!panel) return L.point(0, 0);

  const mapRect = map.getContainer().getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  if (window.matchMedia('(max-width: 768px)').matches) {
    const panelTop = viewportHeight - panel.offsetHeight;
    const coveredHeight = Math.max(0, Math.min(mapRect.bottom, viewportHeight) - Math.max(mapRect.top, panelTop));
    return L.point(0, coveredHeight / 2);
  }

  const panelLeft = viewportWidth - panel.offsetWidth;
  const coveredWidth = Math.max(0, Math.min(mapRect.right, viewportWidth) - Math.max(mapRect.left, panelLeft));
  return L.point(coveredWidth / 2, 0);
}

/** Calculate the map center that places a place at the visible area's center. */
function centerForVisiblePlace(map: L.Map, place: L.LatLngExpression, zoom: number): L.LatLng {
  const offset = visibleAreaOffset(map);
  return map.unproject(map.project(place, zoom).add(offset), zoom);
}

/** Fly to the selected place when it changes. */
function MapFlyTo() {
  const map = useMap();
  const selectedPlace = useStore((s) => s.selectedPlace);

  useEffect(() => {
    if (selectedPlace?.geom_point?.coordinates) {
      const [lng, lat] = selectedPlace.geom_point.coordinates;
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        const zoom = 18;
        const center = centerForVisiblePlace(map, [lat, lng], zoom);
        map.flyTo(center, zoom, { duration: 0.8 });
      }
    }
  }, [selectedPlace, map]);

  return null;
}

/** Reset the view when resetToken changes. */
function MapResetController() {
  const map = useMap();
  const resetToken = useStore((s) => s.resetToken);

  useEffect(() => {
    if (resetToken > 0) {
      map.flyTo(PHENIKAA_CENTER, PHENIKAA_ZOOM, { duration: 0.6 });
    }
  }, [resetToken, map]);

  return null;
}

/** Keeps the store's map center/zoom/bounds in sync with the map. */
function MapSync() {
  useMapSync();
  return null;
}
