import { useMemo } from 'react';
import { GeoJSON as GeoJSONComponent } from 'react-leaflet';
import type { Place, Category } from '../../types';
import { useT } from '../../i18n/useT';

interface BuildingsLayerProps {
  places: Place[];
  categories: Category[];
}

/** Building/area footprints (polygons). */
export function BuildingsLayer({ places, categories }: BuildingsLayerProps) {
  const { lang, placeName } = useT();
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
                dashArray: isBuilding ? undefined : '5,5',
              })}
              onEachFeature={(_feature, layer) => {
                layer.bindTooltip(placeName(place), {
                  permanent: false,
                  direction: 'center',
                  className: 'building-tooltip',
                });
              }}
            />
          );
        })}
    </>
  );
}
