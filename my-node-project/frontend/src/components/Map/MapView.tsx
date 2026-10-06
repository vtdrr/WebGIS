// =============================================
// Phenikaa WebGIS - Map Components
// =============================================

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON as GeoJSONComponent, LayersControl, Marker, Circle, Popup } from 'react-leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import type { Place, Category } from '../../types';
import { PHENIKAA_CENTER, PHENIKAA_ZOOM, PHENIKAA_BOUNDS } from '../../types';
import { useMapSync, createMarkerIcon } from '../../hooks/useMap';
import { useStore } from '../../store/useStore';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Escape user content inserted into popup HTML
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =============================================
// Base Map Component
// =============================================
export function BaseMap({ children }: { children: React.ReactNode }) {
  return (
    <MapContainer
      center={PHENIKAA_CENTER}
      zoom={PHENIKAA_ZOOM}
      maxBounds={PHENIKAA_BOUNDS}
      minZoom={15}
      maxZoom={20}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
      doubleClickZoom={true}
      touchZoom={true}
      boxZoom={true}
      keyboard={true}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Bản đồ">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
            maxNativeZoom={18}
            maxZoom={20}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Vệ tinh">
          <TileLayer
            attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={19}
            maxZoom={20}
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      {/* Campus center marker */}
      <Marker
        position={PHENIKAA_CENTER}
        icon={L.divIcon({
          html: `<div style="width: 14px; height: 14px; border-radius: 50%; background: #1e3a8a; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);"></div>`,
          className: 'campus-marker',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })}
      >
        <Popup>
          <strong>Trường Đại học Phenikaa</strong>
        </Popup>
      </Marker>
      {children}
      <MapSync />
      <MapFlyTo />
      <MapResetController />
    </MapContainer>
  );
}

// =============================================
// Fly to selected place when it changes
// =============================================
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

// =============================================
// Reset map view when resetToken changes
// =============================================
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

// =============================================
// Map Sync Component (handles map events)
// =============================================
function MapSync() {
  useMapSync();
  return null;
}

// =============================================
// Places Layer with Marker Clustering (using native leaflet.markercluster)
// =============================================
interface PlacesLayerProps {
  places: Place[];
  categories: Category[];
  selectedPlaceId: string | null;
  onPlaceClick: (place: Place) => void;
}

export function PlacesLayer({ places, categories, selectedPlaceId, onPlaceClick }: PlacesLayerProps) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  // Category lookup — memoized so markers can depend on it safely
  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.code, c));
    return m;
  }, [categories]);

  // Initialize marker cluster group once per map
  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let className = 'marker-cluster';
        if (count < 10) className += ' marker-cluster-small';
        else if (count < 100) className += ' marker-cluster-medium';
        else className += ' marker-cluster-large';
        return L.divIcon({
          html: `<span>${count}</span>`,
          className,
          iconSize: [40, 40],
        });
      },
    });
    clusterRef.current = group;
    group.addTo(map);
    return () => {
      map.removeLayer(group);
      clusterRef.current = null;
    };
  }, [map]);

  // Sync markers with the places list (does NOT recreate the cluster group)
  useEffect(() => {
    const group = clusterRef.current;
    if (!group) return;

    group.clearLayers();

    places
      .filter(p => p.geom_point?.coordinates)
      .forEach(place => {
        const category = place.category_code ? categoryMap.get(place.category_code) : null;
        const color = category?.color || '#3388ff';
        const iconName = category?.icon || 'map-pin';
        const MarkerIcon = createMarkerIcon(color, iconName);
        const isSelected = place.id === selectedPlaceId;

        const marker = L.marker(
          [place.geom_point!.coordinates[1], place.geom_point!.coordinates[0]],
          { icon: MarkerIcon, zIndexOffset: isSelected ? 1000 : 0 }
        );

        const popupContent = `
          <div style="min-width: 200;">
            <div style="display: flex; align-items: center; gap: 8; margin-bottom: 8;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></div>
              <strong style="font-size: 14px; color: #1f2937;">${escapeHtml(place.name_vi)}</strong>
            </div>
            ${place.code ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4;">Mã: ${escapeHtml(place.code)}</div>` : ''}
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8;">${escapeHtml(place.category_name_vi || place.category_code || 'Unknown')}</div>
            ${place.floor !== null ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 8;">Tầng ${place.floor}</div>` : ''}
            <button class="popup-detail-btn" data-place-id="${place.id}" style="width: 100%; padding: 6px 12px; background: ${color}; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer;">
              Xem chi tiết
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, { autoClose: false, closeOnClick: false, className: 'custom-popup' });
        group.addLayer(marker);
      });
  }, [places, selectedPlaceId, categoryMap]);

  // Handle popup button clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.popup-detail-btn');
      if (btn) {
        const placeId = btn.getAttribute('data-place-id');
        if (placeId) {
          const place = places.find(p => p.id === placeId);
          if (place) onPlaceClick(place);
        }
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [places, onPlaceClick]);

  return null;
}

// =============================================
// Buildings Layer (Polygons)
// =============================================
interface BuildingsLayerProps {
  places: Place[];
  categories: Category[];
}

export function BuildingsLayer({ places, categories }: BuildingsLayerProps) {
  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.code, c));
    return m;
  }, [categories]);

  const buildings = places
    .filter(p => p.geom_polygon?.coordinates)
    .map(place => {
      const category = place.category_code ? categoryMap.get(place.category_code) : null;
      const color = category?.color || '#3388ff';
      const isBuilding = place.category_code === 'building';

      return (
        <GeoJSONComponent
          key={place.id}
          data={place.geom_polygon!}
          style={() => ({
            fillColor: color,
            fillOpacity: isBuilding ? 0.15 : 0.1,
            color: color,
            weight: isBuilding ? 2 : 1,
            dashArray: isBuilding ? undefined : '5,5',
          })}
          onEachFeature={(_feature, layer) => {
            layer.bindTooltip(place.name_vi, {
              permanent: false,
              direction: 'center',
              className: 'building-tooltip',
            });
          }}
        />
      );
    });

  return <>{buildings}</>;
}

// =============================================
// User Location Marker
// =============================================
interface UserLocationProps {
  position: { lat: number; lng: number } | null;
  accuracy?: number;
}

export function UserLocation({ position, accuracy }: UserLocationProps) {
  if (!position) return null;

  return (
    <>
      <Marker
        position={[position.lat, position.lng]}
        icon={L.divIcon({
          html: `<div style="width: 20px; height: 20px; border-radius: 50%; background: #3b82f6; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>`,
          className: 'user-location-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })}
      />
      {accuracy && (
        <Circle
          center={[position.lat, position.lng]}
          radius={accuracy}
          pathOptions={{
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            color: '#3b82f6',
            weight: 1,
          }}
        />
      )}
    </>
  );
}

// =============================================
// Routing Layer
// =============================================
interface RoutingLayerProps {
  route: GeoJSON.LineString | null;
}

export function RoutingLayer({ route }: RoutingLayerProps) {
  if (!route) return null;

  return (
    <GeoJSONComponent
      data={route}
      style={() => ({
        color: '#3b82f6',
        weight: 5,
        opacity: 0.8,
        dashArray: '10,10',
        lineCap: 'round',
        lineJoin: 'round',
      })}
    />
  );
}

// =============================================
// Scale Control
// =============================================
export function ScaleControl() {
  const map = useMap();

  useEffect(() => {
    const control = L.control.scale({ metric: true, imperial: false, position: 'bottomleft' });
    control.addTo(map);
    return () => { control.remove(); };
  }, [map]);

  return null;
}