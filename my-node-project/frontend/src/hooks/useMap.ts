// =============================================
// Phenikaa WebGIS - Map hooks & helpers
// =============================================

import { useMapEvents } from 'react-leaflet';
import { useStore } from '../store/useStore';

/** Keeps the store's map center/zoom/bounds in sync with the map (react-leaflet context required). */
export function useMapSync() {
  const setMapCenter = useStore((s) => s.setMapCenter);
  const setMapZoom = useStore((s) => s.setMapZoom);
  const setMapBounds = useStore((s) => s.setMapBounds);

  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      setMapCenter([map.getCenter().lat, map.getCenter().lng]);
      setMapZoom(map.getZoom());
      const b = map.getBounds();
      setMapBounds([
        [b.getSouth(), b.getWest()],
        [b.getNorth(), b.getEast()],
      ]);
    },
  });
}
