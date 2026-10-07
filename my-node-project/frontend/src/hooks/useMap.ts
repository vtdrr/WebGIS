// =============================================
// Phenikaa WebGIS - Map hooks & helpers
// =============================================

import { useMapEvents } from 'react-leaflet';
import L from 'leaflet';
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

/** Category `icon` names (see sql/init.sql) → emoji shown inside the map marker. */
const ICON_EMOJI: Record<string, string> = {
  building: '🏢',
  'graduation-cap': '🎓',
  'flask-conical': '🧪',
  'book-open': '📖',
  utensils: '🍴',
  home: '🏠',
  'parking-circle': '🅿️',
  dumbbell: '🏋️',
  'door-open': '🚪',
  briefcase: '💼',
  cross: '🏥',
  'map-pin': '📍',
};

export function iconEmoji(iconName?: string | null): string {
  if (!iconName) return ICON_EMOJI['map-pin'];
  return ICON_EMOJI[iconName] ?? ICON_EMOJI['map-pin'];
}

/** Custom marker icon factory (plain function - safe to call in loops). */
export function createMarkerIcon(categoryColor: string, categoryIcon?: string | null) {
  const iconHtml = `
    <div style="
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      background: ${categoryColor};
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      border: 3px solid white;
    ">
      <div style="
        transform: rotate(45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: white;
        font-size: 14px;
      ">
        ${iconEmoji(categoryIcon)}
      </div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}
