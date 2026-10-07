import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Place, Category } from '../../types';
import { createMarkerIcon } from '../../hooks/useMap';
import { useT } from '../../i18n/useT';
import { escapeHtml } from '../../utils/format';

interface PlacesLayerProps {
  places: Place[];
  categories: Category[];
  selectedPlaceId: string | null;
  onPlaceClick: (place: Place) => void;
}

/** Place markers, clustered with the native leaflet.markercluster plugin. */
export function PlacesLayer({ places, categories, selectedPlaceId, onPlaceClick }: PlacesLayerProps) {
  const map = useMap();
  const { t, placeName, placeCategory } = useT();
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
      iconCreateFunction: (cluster: L.MarkerCluster) => {
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
      .filter((p) => p.geom_point?.coordinates)
      .forEach((place) => {
        const category = place.category_code ? categoryMap.get(place.category_code) : null;
        const color = category?.color || '#3388ff';
        const iconName = category?.icon || 'map-pin';
        const isSelected = place.id === selectedPlaceId;

        const marker = L.marker(
          [place.geom_point!.coordinates[1], place.geom_point!.coordinates[0]],
          { icon: createMarkerIcon(color, iconName), zIndexOffset: isSelected ? 1000 : 0 },
        );

        const popupContent = `
          <div style="min-width: 200px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></div>
              <strong style="font-size: 14px; color: #1f2937;">${escapeHtml(placeName(place))}</strong>
            </div>
            ${place.code ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${escapeHtml(t('search.code', { code: place.code }))}</div>` : ''}
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${escapeHtml(placeCategory(place) || t('place.unknownCategory'))}</div>
            ${place.floor !== null ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${escapeHtml(t('place.floor', { floor: place.floor }))}</div>` : ''}
            <button class="popup-detail-btn" data-place-id="${escapeHtml(place.id)}" style="width: 100%; padding: 6px 12px; background: ${color}; color: white; border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer;">
              ${escapeHtml(t('place.viewDetail'))}
            </button>
          </div>
        `;

        marker.bindPopup(popupContent, { autoClose: false, closeOnClick: false, className: 'custom-popup' });
        group.addLayer(marker);
      });
    // placeName/placeCategory are recreated each render but only depend on `lang` (via t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, selectedPlaceId, categoryMap, t]);

  // Handle popup button clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.popup-detail-btn');
      if (btn) {
        const placeId = btn.getAttribute('data-place-id');
        if (placeId) {
          const place = places.find((p) => p.id === placeId);
          if (place) onPlaceClick(place);
        }
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [places, onPlaceClick]);

  return null;
}
