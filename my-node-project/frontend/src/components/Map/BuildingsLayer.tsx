import { useMemo } from 'react';
import { CircleMarker, GeoJSON as GeoJSONComponent, Tooltip } from 'react-leaflet';
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
  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.code, c));
    return m;
  }, [categories]);

  return (
    <>
      {places
        .filter((p) => p.geom_polygon?.coordinates)
        .map((place) => {
          const category = place.category_code ? categoryMap.get(place.category_code) : null;
          const color = category?.color || '#3388ff';
          const isBuilding = place.category_code === 'building';

          return (
            <GeoJSONComponent
              // lang in the key re-binds the tooltip when the language changes
              key={`${place.id}-${lang}`}
              data={place.geom_polygon!}
              style={() => ({
                fillColor: color,
                fillOpacity: isBuilding ? 0.15 : 0.1,
                color,
                weight: isBuilding ? 2 : 1,
                dashArray: '5,5',
              })}
              onEachFeature={(_feature, layer) => {
                const path = layer as Path;
                layer.bindTooltip(placeName(place), {
                  permanent: false,
                  direction: 'center',
                  className: 'building-tooltip',
                });
                layer.on('click', () => onPlaceClick?.(place));
                layer.on('mouseover', () => path.setStyle({ weight: 3, fillOpacity: 0.22 }));
                layer.on('mouseout', () => path.setStyle({
                  fillColor: color,
                  fillOpacity: isBuilding ? 0.15 : 0.1,
                  color,
                  weight: isBuilding ? 2 : 1,
                  dashArray: '5,5',
                }));
              }}
            />
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
