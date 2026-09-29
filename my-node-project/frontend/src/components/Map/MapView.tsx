// =============================================
// Phenikaa WebGIS - Map Components
// =============================================

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON as GeoJSONComponent, LayersControl, Marker, Circle } from 'react-leaflet';
import 'leaflet.markercluster';
import L from 'leaflet';
import type { Place, Category } from '../../types';
import { PHENIKAA_CENTER, PHENIKAA_ZOOM, PHENIKAA_BOUNDS } from '../../types';
import { useMapSync, useMarkerIcon } from '../../hooks/useMap';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={20}
        crossOrigin=""
      />
      <LayersControl position="topright" />
      {children}
      <MapSync />
    </MapContainer>
  );
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
  const categoryMap = useRef(new Map<string, Category>());

  // Update category map when categories change
  useEffect(() => {
    categoryMap.current.clear();
    categories.forEach(c => categoryMap.current.set(c.code, c));
  }, [categories]);

  // Initialize/update marker cluster group
  useEffect(() => {
    if (!clusterRef.current) {
      clusterRef.current = L.markerClusterGroup({
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
      clusterRef.current.addTo(map);
    }

    // Clear existing markers
    clusterRef.current.clearLayers();

    // Add new markers
    places
      .filter(p => p.geom_point?.coordinates)
      .forEach(place => {
        const category = place.category_code ? categoryMap.current.get(place.category_code) : null;
        const color = category?.color || '#3388ff';
        const iconName = category?.icon || 'map-pin';
        const MarkerIcon = useMarkerIcon(color, iconName);
        const isSelected = place.id === selectedPlaceId;

        const marker = L.marker(
          [place.geom_point!.coordinates[1], place.geom_point!.coordinates[0]],
          { icon: MarkerIcon, zIndexOffset: isSelected ? 1000 : 0 }
        );

        const popupContent = `
          <div style="min-width: 200;">
            <div style="display: flex; align-items: center; gap: 8; margin-bottom: 8;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></div>
              <strong style="font-size: 14px; color: #1f2937;">${place.name_vi}</strong>
            </div>
            ${place.code ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4;">Mã: ${place.code}</div>` : ''}
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8;">${place.category_name_vi || place.category_code || 'Unknown'}</div>
            ${place.floor !== null ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 8;">Tầng ${place.floor}</div>` : ''}
            <button class="popup-detail-btn" data-place-id="${place.id}" style="width: 100%; padding: 6px 12px; background: ${color}; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer;">
              Xem chi tiết
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, { autoClose: false, closeOnClick: false, className: 'custom-popup' });
        clusterRef.current!.addLayer(marker);
      });

    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }
    };
  }, [map, places, selectedPlaceId]);

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
  const categoryMap = useRef(new Map<string, Category>());

  useEffect(() => {
    categoryMap.current.clear();
    categories.forEach(c => categoryMap.current.set(c.code, c));
  }, [categories]);

  const buildings = places
    .filter(p => p.geom_polygon?.coordinates)
    .map(place => {
      const category = place.category_code ? categoryMap.current.get(place.category_code) : null;
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