import { useMemo } from 'react';
import { CircleMarker, GeoJSON as GeoJSONComponent, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Path } from 'leaflet';
import type { Place, Category } from '../../types';
import { useT } from '../../i18n/useT';
import { useStore } from '../../store/useStore';

interface BuildingsLayerProps {
  places: Place[];
  categories: Category[];
  onPlaceClick?: (place: Place) => void;
}

/** Building/area footprints (polygons). */
export function BuildingsLayer({ places, categories, onPlaceClick }: BuildingsLayerProps) {
  const { lang, placeName } = useT();
  const selectedPlaceId = useStore((state) => state.selectedPlace?.id ?? null);
  const satelliteMode = useStore((state) => state.satelliteMode);
  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.code, c));
    return m;
  }, [categories]);

  return (
    <>
      {!satelliteMode && places
        .filter((p) => p.geom_polygon?.coordinates)
        .map((place) => {
          const category = place.category_code ? categoryMap.get(place.category_code) : null;
          const color = category?.color || '#3388ff';
          const isBuilding = place.category_code === 'building';
          const isSelected = place.id === selectedPlaceId;
          const normalStyle = {
            fillColor: color,
            fillOpacity: isBuilding ? 0.15 : 0.1,
            color,
            weight: isBuilding ? 2 : 1,
            dashArray: '5,5',
          };
          // Use the same persistent emphasis as hover, so selection remains
          // visible after the pointer leaves the footprint.
          const highlightedStyle = {
            fillColor: color,
            fillOpacity: 0.32,
            color,
            weight: 4,
            dashArray: '5,5',
          };

          return (
            <GeoJSONComponent
              // lang in the key re-binds the tooltip when the language changes
              key={`${place.id}-${lang}`}
              data={place.geom_polygon!}
              style={() => (isSelected ? highlightedStyle : normalStyle)}
              onEachFeature={(_feature, layer) => {
                const path = layer as Path;
                layer.bindTooltip(placeName(place), {
                  permanent: false,
                  direction: 'center',
                  className: 'building-tooltip',
                });
                layer.on('click', () => onPlaceClick?.(place));
                layer.on('mouseover', () => path.setStyle(highlightedStyle));
                layer.on('mouseout', () => {
                  const stillSelected = useStore.getState().selectedPlace?.id === place.id;
                  path.setStyle(stillSelected ? highlightedStyle : normalStyle);
                });
              }}
            />
          );
        })}
      {satelliteMode && places
        .filter((place) => place.geom_polygon?.coordinates && place.geom_point?.coordinates)
        .map((place) => {
          const [lng, lat] = place.geom_point!.coordinates;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const selected = place.id === selectedPlaceId;
          const rawColor = place.category_color || '#3388ff';
          const color = /^#[\da-f]{3,8}$/i.test(rawColor) ? rawColor : '#3388ff';
          const size = selected ? 42 : 32;
          const icon = L.divIcon({
            className: 'satellite-place-marker',
            html: `<svg viewBox="0 0 32 42" width="${size}" height="${Math.round(size * 1.31)}" aria-hidden="true"><path d="M16 1C7.7 1 1 7.7 1 16c0 10 15 25 15 25s15-15 15-25C31 7.7 24.3 1 16 1Z" fill="${color}" stroke="white" stroke-width="2.5"/><circle cx="16" cy="16" r="5.5" fill="white"/></svg>`,
            iconSize: [size, Math.round(size * 1.31)],
            iconAnchor: [size / 2, Math.round(size * 1.31)],
            tooltipAnchor: [0, -Math.round(size * 1.31)],
          });
          return (
            <Marker
              key={`satellite-marker-${place.id}`}
              position={[lat, lng]}
              icon={icon}
              zIndexOffset={selected ? 1000 : 0}
              eventHandlers={{ click: () => onPlaceClick?.(place) }}
            >
              <Tooltip direction="top">{placeName(place)}</Tooltip>
            </Marker>
          );
        })}
      {places
        .filter((place) => place.id === selectedPlaceId && !place.geom_polygon?.coordinates && place.geom_point?.coordinates)
        .map((place) => {
          const [lng, lat] = place.geom_point!.coordinates;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

          return (
            <CircleMarker
              key={`point-${place.id}`}
              center={[lat, lng]}
              radius={6}
              pathOptions={{ color: '#fff', weight: 2, fillColor: '#dc2626', fillOpacity: 1 }}
              eventHandlers={{ click: () => onPlaceClick?.(place) }}
            >
              <Tooltip direction="top" offset={[0, -5]}>
                {placeName(place)}
              </Tooltip>
            </CircleMarker>
          );
        })}
    </>
  );
}
