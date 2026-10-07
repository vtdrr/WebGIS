import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';
import { formatDistance, formatDuration } from '../../utils/format';
import { Icon } from '../UI';
import type { RoutingParams } from '../../types';

const GPS_ORIGIN = '__gps__';
const MAP_ORIGIN = '__map__';

type Mode = NonNullable<RoutingParams['mode']>;
const MODES: Array<{ value: Mode; icon: string }> = [
  { value: 'walk', icon: '🚶' },
  { value: 'bike', icon: '🚴' },
  { value: 'wheelchair', icon: '♿' },
];

interface RoutePanelProps {
  /** Current GPS fix, if any */
  gpsPosition: { lat: number; lng: number } | null;
}

/** Directions panel: origin picker, travel mode, summary and turn list. */
export function RoutePanel({ gpsPosition }: RoutePanelProps) {
  const { t, placeName } = useT();
  const {
    mapPlaces, routingFrom, routingTo, routingResult, routingLoading, routingError, routingMode,
    setRoutingMode, setRoutingOrigin, routePicking, setRoutePicking, swapRouting, clearRouting,
  } = useStore(
    useShallow((s) => ({
      mapPlaces: s.mapPlaces,
      routingFrom: s.routingFrom,
      routingTo: s.routingTo,
      routingResult: s.routingResult,
      routingLoading: s.routingLoading,
      routingError: s.routingError,
      routingMode: s.routingMode,
      setRoutingMode: s.setRoutingMode,
      setRoutingOrigin: s.setRoutingOrigin,
      routePicking: s.routePicking,
      setRoutePicking: s.setRoutePicking,
      swapRouting: s.swapRouting,
      clearRouting: s.clearRouting,
    })),
  );

  const originOptions = useMemo(
    () => mapPlaces.filter((p) => p.geom_point?.coordinates && p.id !== routingTo?.id),
    [mapPlaces, routingTo],
  );

  if (!(routingResult || routingLoading || routingError || routingTo)) return null;

  const originValue =
    routingFrom?.placeId ?? (routingFrom?.source === 'map' ? MAP_ORIGIN : routingFrom ? GPS_ORIGIN : '');
  const canSwap = Boolean(routingFrom?.placeId && routingTo);
  const route = routingResult?.routes?.[0];
  const steps = route?.legs?.[0]?.steps;
  const offNetworkM = routingResult?.meta?.off_network_m ?? 0;

  const handleOriginChange = (value: string) => {
    if (!value) setRoutingOrigin(null);
    else if (value === GPS_ORIGIN) {
      if (gpsPosition) setRoutingOrigin({ ...gpsPosition, name: t('map.myLocation'), source: 'gps' });
    } else if (value === MAP_ORIGIN) {
      // Already picked on the map: nothing to change
    } else {
      const place = mapPlaces.find((p) => p.id === value);
      if (place) setRoutingOrigin(place);
    }
  };

  return (
    <section className="route-panel" aria-label={t('route.title')}>
      <header className="route-panel__header">
        <span>{t('route.title')}</span>
        <button type="button" className="icon-button icon-button--small" onClick={clearRouting} aria-label={t('route.close')}>
          <Icon name="close" size={14} />
        </button>
      </header>

      <div className="route-panel__body">
        <div className="route-panel__modes" role="group">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`mode-button${routingMode === m.value ? ' is-active' : ''}`}
              aria-pressed={routingMode === m.value}
              disabled={!routingFrom || !routingTo}
              onClick={() => setRoutingMode(m.value)}
            >
              <span aria-hidden="true">{m.icon}</span>
              {t(`route.${m.value}` as const)}
            </button>
          ))}
        </div>

        <div className="route-panel__endpoints">
          <div className="route-panel__row">
            <span className="dot" style={{ background: '#3b82f6' }} />
            <select value={originValue} onChange={(e) => handleOriginChange(e.target.value)} aria-label={t('route.from')}>
              <option value="">{t('route.chooseOrigin')}</option>
              {routingFrom?.source === 'map' && <option value={MAP_ORIGIN}>{t('route.originPicked')}</option>}
              <option value={GPS_ORIGIN} disabled={!gpsPosition}>
                {gpsPosition ? t('map.myLocation') : t('route.noGps')}
              </option>
              {originOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {placeName(p)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`icon-button icon-button--small${routePicking ? ' is-active' : ''}`}
              onClick={() => setRoutePicking(!routePicking)}
              title={t('route.pickOnMap')}
              aria-label={t('route.pickOnMap')}
              aria-pressed={routePicking}
            >
              <Icon name="pin" size={14} />
            </button>
            <button
              type="button"
              className="icon-button icon-button--small"
              onClick={swapRouting}
              disabled={!canSwap}
              title={t('route.swap')}
              aria-label={t('route.swap')}
            >
              <Icon name="swap" size={14} />
            </button>
          </div>
          <div className="route-panel__row">
            <span className="dot" style={{ background: '#ef4444' }} />
            <span className="route-panel__destination">{routingTo ? placeName(routingTo) : '...'}</span>
          </div>
          {!routingFrom && routingTo && !routingLoading && <div className="route-panel__hint">{t('route.needOrigin')}</div>}
        </div>

        {routingLoading && (
          <div className="route-panel__status" role="status">
            {t('route.loading')}
          </div>
        )}

        {routingError && (
          <div className="alert alert--error alert--small" role="alert">
            {routingError}
          </div>
        )}

        {route && (
          <div>
            <div className="route-summary">
              <div>
                <div className="route-summary__label">{t('route.distance')}</div>
                <div className="route-summary__value">{formatDistance(route.distance)}</div>
              </div>
              <div>
                <div className="route-summary__label">{t('route.duration')}</div>
                <div className="route-summary__value">{formatDuration(route.duration, t)}</div>
              </div>
              {routingResult?.meta?.fallback && <div className="badge badge--warning">{t('route.straightLine')}</div>}
            </div>

            {!routingResult?.meta?.fallback && offNetworkM > 0 && (
              <div className="alert alert--warning alert--small">
                {t('route.offNetwork', { distance: formatDistance(offNetworkM) })}
              </div>
            )}

            {steps && steps.length > 1 && (
              <ol className="route-steps">
                {steps.map((step, i) => (
                  <li key={i}>
                    <span className="route-steps__num">{i + 1}</span>
                    <div>
                      <div>{step.instruction}</div>
                      <div className="route-steps__meta">
                        {formatDistance(step.distance)} • {formatDuration(step.duration, t)}
                        {step.off_network && <span className="route-steps__off"> • {t('route.offNetworkStep')}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
