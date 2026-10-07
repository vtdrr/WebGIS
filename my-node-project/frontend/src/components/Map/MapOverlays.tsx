import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';
import { Icon } from '../UI';

interface MapOverlaysProps {
  geoError: string | null;
  geoLoading: boolean;
  onLocate: () => void;
}

/**
 * Floating controls and hints on top of the map. They live outside <BaseMap>,
 * above Leaflet's panes, otherwise the map would swallow their clicks.
 */
export function MapOverlays({ geoError, geoLoading, onLocate }: MapOverlaysProps) {
  const { t } = useT();
  const routePicking = useStore((s) => s.routePicking);
  const setRoutePicking = useStore((s) => s.setRoutePicking);
  const resetMapView = useStore((s) => s.resetMapView);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Mobile only: the place list is a drawer, so it needs an opener */}
      {!sidebarOpen && (
        <button type="button" className="fab fab--list" onClick={() => setSidebarOpen(true)} aria-label={t('sidebar.open')}>
          <Icon name="list" size={20} />
        </button>
      )}

      <div className="map-buttons">
        <button type="button" className="fab" onClick={onLocate} disabled={geoLoading} title={t('map.myLocation')} aria-label={t('map.myLocation')}>
          <Icon name="locate" size={20} />
        </button>
        <button type="button" className="fab" onClick={resetMapView} title={t('map.resetView')} aria-label={t('map.resetView')}>
          <Icon name="home" size={20} />
        </button>
      </div>

      {routePicking && (
        <div role="status" className="map-hint">
          <span>📍 {t('map.pickHint')}</span>
          <button type="button" onClick={() => setRoutePicking(false)}>
            {t('map.pickCancel')}
          </button>
        </div>
      )}

      {geoError && (
        <div role="alert" className={`map-toast${routePicking ? ' map-toast--lower' : ''}`}>
          {t('map.geoError', { error: geoError })}
        </div>
      )}
    </>
  );
}
