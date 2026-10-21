import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';
import { formatDistance, formatDuration } from '../../utils/format';
import { Icon } from '../UI';

/** Directions panel: origin picker, travel mode, summary and turn list. */
export function RoutePanel() {
  const { t, placeName } = useT();
  const {
    routePlaces, routePlacesLoading, routePlacesError, fetchRoutePlaces, routingFrom, routingTo, routingResult, routingLoading, routingError,
    setRoutingOrigin, swapRouting, clearRouting,
  } = useStore(
    useShallow((s) => ({
      routePlaces: s.routePlaces,
      routePlacesLoading: s.routePlacesLoading,
      routePlacesError: s.routePlacesError,
      fetchRoutePlaces: s.fetchRoutePlaces,
      routingFrom: s.routingFrom,
      routingTo: s.routingTo,
      routingResult: s.routingResult,
      routingLoading: s.routingLoading,
      routingError: s.routingError,
      setRoutingOrigin: s.setRoutingOrigin,
      swapRouting: s.swapRouting,
      clearRouting: s.clearRouting,
    })),
  );

  const originOptions = useMemo(
    () => routePlaces.filter((p) => p.geom_point?.coordinates && p.id !== routingTo?.id),
    [routePlaces, routingTo],
  );

  if (!(routingResult || routingLoading || routingError || routingTo)) return null;

  const originValue = routingFrom?.placeId ?? '';
  const canSwap = Boolean(routingFrom?.placeId && routingTo);
  const route = routingResult?.routes?.[0];
  const steps = route?.legs?.[0]?.steps;
  const offNetworkM = routingResult?.meta?.off_network_m ?? 0;

  const handleOriginChange = (value: string) => {
    if (!value) setRoutingOrigin(null);
    else {
      const place = routePlaces.find((p) => p.id === value);
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
        <div className="route-panel__modes" aria-label={t('route.walkOnly')}>
          <span className="mode-button is-active">
            <span aria-hidden="true">🚶</span>
            {t('route.walk')}
          </span>
        </div>

        <div className="route-panel__endpoints">
          <div className="route-panel__row">
            <span className="dot" style={{ background: '#3b82f6' }} />
            <select value={originValue} onChange={(e) => handleOriginChange(e.target.value)} aria-label={t('route.from')}>
              <option value="">{t('route.chooseOrigin')}</option>
              {routePlacesLoading && <option value="__loading__" disabled>{t('route.originsLoading')}</option>}
              {originOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {placeName(p)}
                </option>
              ))}
            </select>
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
          {routePlacesError && (
            <div className="alert alert--error alert--small" role="alert">
              {t('route.originsLoadFailed')}
              <button type="button" className="btn btn--small" onClick={fetchRoutePlaces} disabled={routePlacesLoading}>
                {t('route.retryOrigins')}
              </button>
            </div>
          )}
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

            {routingResult?.meta?.fallback && (
              <div className="alert alert--warning alert--small" role="alert">
                {t('route.fallbackNotice')}
              </div>
            )}

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
