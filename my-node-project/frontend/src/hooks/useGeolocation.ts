import { useCallback, useState } from 'react';
import type { Point } from '../types';
import { useT } from '../i18n/useT';

/** One-shot browser geolocation with loading/error state. */
export function useGeolocation() {
  const { t } = useT();
  const [position, setPosition] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError(t('map.geoUnsupported'));
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [t]);

  return { position, error, loading, requestLocation };
}
