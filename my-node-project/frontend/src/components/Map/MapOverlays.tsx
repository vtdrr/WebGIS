import { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';

interface MapOverlaysProps {
  schematicOpen: boolean;
  onCloseSchematic: () => void;
}

/** Campus identity, data-status messages and the reference schematic overlay. */
export function MapOverlays({
  schematicOpen,
  onCloseSchematic,
}: MapOverlaysProps) {
  const { t } = useT();
  const mapPlacesLoading = useStore((s) => s.mapPlacesLoading);
  const mapPlacesError = useStore((s) => s.mapPlacesError);
  const fetchMapPlaces = useStore((s) => s.fetchMapPlaces);

  useEffect(() => {
    if (!schematicOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseSchematic();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [schematicOpen, onCloseSchematic]);

  return (
    <>
      <div className="map-identity" aria-hidden="true">
        <span className="map-identity__mark">P</span>
        <span className="map-identity__copy">
          <span className="map-identity__eyebrow">{t('app.campus')}</span>
          <strong>{t('app.subtitle')}</strong>
        </span>
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
          if (event.target === event.currentTarget) onCloseSchematic();
        }}>
          <section className="schematic-dialog" role="dialog" aria-modal="true" aria-labelledby="schematic-title">
            <header className="schematic-dialog__header">
              <div>
                <h2 id="schematic-title">Sơ đồ trường tham khảo</h2>
                <p>Sơ đồ phục vụ hội nghị — không theo tỷ lệ tọa độ.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Đóng sơ đồ" onClick={onCloseSchematic}>×</button>
            </header>
            <div className="schematic-dialog__image-wrap">
              <img src="/phenikaa-event-schematic.jpg" alt="Sơ đồ Trường Đại học Phenikaa dùng cho hội nghị, có các tòa nhà, cổng và hướng lưu thông" />
            </div>
            <p className="schematic-dialog__note">Dùng để đối chiếu tên khu và hướng đi tổng quát. Đường/mũi tên trên sơ đồ không được dùng để tính tuyến trên bản đồ.</p>
          </section>
        </div>
      )}

    </>
  );
}
