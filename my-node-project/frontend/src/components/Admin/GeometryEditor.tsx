import { useMemo, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import '../Map/leafletSetup';
import { MAP_BOUNDS, MAP_MIN_ZOOM, PHENIKAA_CENTER, PHENIKAA_ZOOM } from '../../types';
import { useT } from '../../i18n/useT';
import { hasValidPoint, type PlaceFormState } from './placeForm';

type Mode = 'point' | 'polygon';

interface GeometryEditorProps {
  value: Pick<PlaceFormState, 'lat' | 'lng' | 'polygon'>;
  onChange: (value: Pick<PlaceFormState, 'lat' | 'lng' | 'polygon'>) => void;
}

const VERTEX_ICON = L.divIcon({
  html: '<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid #2563eb;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  className: 'vertex-marker',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Small map to set a place's marker and draw its footprint polygon. */
export function GeometryEditor({ value, onChange }: GeometryEditorProps) {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>('point');
  const point = hasValidPoint(value) ? ([Number(value.lat), Number(value.lng)] as [number, number]) : null;

  // Center once on mount (the editor is re-mounted per place via `key`)
  const initialCenter = useMemo<[number, number]>(() => {
    if (point) return point;
    if (value.polygon.length > 0) return [value.polygon[0][1], value.polygon[0][0]];
    return PHENIKAA_CENTER;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setVertex = (index: number, lat: number, lng: number) => {
    const polygon = value.polygon.map((v, i) => (i === index ? ([lng, lat] as [number, number]) : v));
    onChange({ ...value, polygon });
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (mode === 'point') onChange({ ...value, lat: lat.toFixed(7), lng: lng.toFixed(7) });
    else onChange({ ...value, polygon: [...value.polygon, [lng, lat]] });
  };

  const ring = value.polygon.map(([lng, lat]) => [lat, lng] as [number, number]);

  return (
    <div className="geo-editor">
      <div className="geo-editor__toolbar">
        <div role="group" className="segmented">
          {(['point', 'polygon'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'is-active' : ''}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {t(m === 'point' ? 'admin.geo.point' : 'admin.geo.polygon')}
            </button>
          ))}
        </div>
        {mode === 'polygon' && (
          <>
            <button
              type="button"
              className="btn btn--small"
              disabled={value.polygon.length === 0}
              onClick={() => onChange({ ...value, polygon: value.polygon.slice(0, -1) })}
            >
              {t('admin.geo.undo')}
            </button>
            <button
              type="button"
              className="btn btn--small"
              disabled={value.polygon.length === 0}
              onClick={() => onChange({ ...value, polygon: [] })}
            >
              {t('admin.geo.clearPolygon')}
            </button>
          </>
        )}
      </div>
      <p className="geo-editor__hint">{t(mode === 'point' ? 'admin.geo.hintPoint' : 'admin.geo.hintPolygon')}</p>

      <MapContainer
        center={initialCenter}
        zoom={PHENIKAA_ZOOM}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={20}
        maxBounds={MAP_BOUNDS}
        className="geo-editor__map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
          maxNativeZoom={18}
          maxZoom={20}
        />
        <ClickHandler onClick={handleMapClick} />

        {ring.length >= 3 ? (
          <Polygon positions={ring} pathOptions={{ color: '#2563eb', fillOpacity: 0.15 }} />
        ) : (
          ring.length === 2 && <Polyline positions={ring} pathOptions={{ color: '#2563eb' }} />
        )}

        {value.polygon.map(([lng, lat], i) => (
          <Marker
            key={`${i}-${value.polygon.length}`}
            position={[lat, lng]}
            icon={VERTEX_ICON}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                setVertex(i, p.lat, p.lng);
              },
              contextmenu: () => onChange({ ...value, polygon: value.polygon.filter((_, j) => j !== i) }),
            }}
          />
        ))}

        {point && (
          <Marker
            position={point}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                onChange({ ...value, lat: p.lat.toFixed(7), lng: p.lng.toFixed(7) });
              },
            }}
          />
        )}
      </MapContainer>

      <div className="geo-editor__coords">
        <label>
          <span>{t('admin.geo.lat')}</span>
          <input value={value.lat} inputMode="decimal" onChange={(e) => onChange({ ...value, lat: e.target.value })} />
        </label>
        <label>
          <span>{t('admin.geo.lng')}</span>
          <input value={value.lng} inputMode="decimal" onChange={(e) => onChange({ ...value, lng: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
