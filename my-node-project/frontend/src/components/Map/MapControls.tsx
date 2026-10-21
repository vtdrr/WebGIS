import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';
import { Icon } from '../UI';

interface MapControlsProps {
  onOpenSchematic: () => void;
}

/** Render app controls as a real Leaflet control so Leaflet stacks them beside ZoomControl. */
export function MapControls({ onOpenSchematic }: MapControlsProps) {
  const map = useMap();
  const { t } = useT();
  const resetMapView = useStore((state) => state.resetMapView);
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const setSidebarOpen = useStore((state) => state.setSidebarOpen);
  const container = useMemo(() => L.DomUtil.create('div', 'map-control-group'), []);

  useEffect(() => {
    const control = new L.Control({ position: 'topleft' });
    control.onAdd = () => {
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      return container;
    };
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [container, map]);

  return createPortal(
    <div className="map-control-group__buttons">
      {!sidebarOpen && (
        <button
          type="button"
          className="fab map-control-group__list"
          onClick={() => setSidebarOpen(true)}
          aria-label={t('sidebar.open')}
        >
          <Icon name="list" size={20} />
        </button>
      )}
      <button type="button" className="fab" onClick={resetMapView} title={t('map.resetView')} aria-label={t('map.resetView')}>
        <Icon name="home" size={20} />
      </button>
      <button
        type="button"
        className="fab schematic-trigger"
        onClick={onOpenSchematic}
        title="Xem sơ đồ trường tham khảo"
        aria-label="Xem sơ đồ trường tham khảo"
      >
        <span aria-hidden="true">▧</span>
      </button>
    </div>,
    container,
  );
}
