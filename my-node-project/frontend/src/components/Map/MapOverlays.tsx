import { useEffect, useState } from 'react';
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
export function MapOverlays({
  geoError,
  geoLoading,
  onLocate,
}: MapOverlaysProps) {
  const { t } = useT();
  const [schematicOpen, setSchematicOpen] = useState(false);
  const routePicking = useStore((s) => s.routePicking);
  const setRoutePicking = useStore((s) => s.setRoutePicking);
  const resetMapView = useStore((s) => s.resetMapView);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const mapPlacesLoading = useStore((s) => s.mapPlacesLoading);
  const mapPlacesError = useStore((s) => s.mapPlacesError);
  const fetchMapPlaces = useStore((s) => s.fetchMapPlaces);

  useEffect(() => {
    if (!schematicOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSchematicOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [schematicOpen]);

  return (
    <>
      <div className="map-identity" aria-hidden="true">
        <span className="map-identity__mark">P</span>
        <span className="map-identity__copy">
          <span className="map-identity__eyebrow">{t('app.campus')}</span>
          <strong>{t('app.subtitle')}</strong>
        </span>
      </div>

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
        <button type="button" className="fab schematic-trigger" onClick={() => setSchematicOpen(true)} title="Xem sơ đồ trường tham khảo" aria-label="Xem sơ đồ trường tham khảo">
          <span aria-hidden="true">▧</span>
        </button>
      </div>

      {mapPlacesLoading && !mapPlacesError && (
        <div role="status" className="map-toast map-toast--loading">
          {t('map.placesLoading')}
        </div>
      )}
      {mapPlacesError && (
        <div role="alert" className="map-toast map-toast--data">
          <span>{t('map.placesLoadFailed')}</span>
          <button type="button" onClick={fetchMapPlaces} disabled={mapPlacesLoading}>
            {t('map.retry')}
          </button>
        </div>
      )}

      {schematicOpen && (
        <div className="schematic-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSchematicOpen(false);
        }}>
          <section className="schematic-dialog" role="dialog" aria-modal="true" aria-labelledby="schematic-title">
            <header className="schematic-dialog__header">
              <div>
                <h2 id="schematic-title">Sơ đồ trường tham khảo</h2>
                <p>Sơ đồ phục vụ hội nghị — không theo tỷ lệ tọa độ.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Đóng sơ đồ" onClick={() => setSchematicOpen(false)}>×</button>
            </header>
            <div className="schematic-dialog__image-wrap">
              <img src="/phenikaa-event-schematic.jpg" alt="Sơ đồ Trường Đại học Phenikaa dùng cho hội nghị, có các tòa nhà, cổng và hướng lưu thông" />
            </div>
            <p className="schematic-dialog__note">Dùng để đối chiếu tên khu và hướng đi tổng quát. Đường/mũi tên trên sơ đồ không được dùng để tính tuyến trên bản đồ.</p>
          </section>
        </div>
      )}

      {routePicking && (
        <div role="status" className="map-hint">
          <span>📍 {t('map.pickHint')}</span>
          <button type="button" onClick={() => setRoutePicking(false)}>
            {t('map.pickCancel')}
          </button>
        </div>
      )}

      {geoError && (
        <div role="alert" className={`map-toast${routePicking || mapPlacesError ? ' map-toast--lower' : ''}`}>
          {t('map.geoError', { error: geoError })}
        </div>
      )}
    </>
  );
}
