import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, LayersControl, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import './leafletSetup';
import { PHENIKAA_CENTER, PHENIKAA_ZOOM, MAP_BOUNDS, MAP_MIN_ZOOM } from '../../types';
import { useMapSync } from '../../hooks/useMap';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';

const CAMPUS_ICON = L.divIcon({
  html: `<div style="width: 14px; height: 14px; border-radius: 50%; background: #1e3a8a; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);"></div>`,
  className: 'campus-marker',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

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
      <Marker position={PHENIKAA_CENTER} icon={CAMPUS_ICON}>
        <Popup>
          <strong>{t('app.campus')}</strong>
        </Popup>
      </Marker>
      {children}
      <MapSync />
      <MapFlyTo />
      <MapResetController />
    </MapContainer>
  );
}

/** Fly to the selected place when it changes. */
function MapFlyTo() {
  const map = useMap();
  const selectedPlace = useStore((s) => s.selectedPlace);

  useEffect(() => {
    if (selectedPlace?.geom_point?.coordinates) {
      const [lng, lat] = selectedPlace.geom_point.coordinates;
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        map.flyTo([lat, lng], 18, { duration: 0.8 });
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
