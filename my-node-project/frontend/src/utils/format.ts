import type { TFunction } from '../i18n/useT';

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number, t: TFunction): string {
  if (seconds < 60) return t('unit.seconds', { n: Math.round(seconds) });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('unit.minutes', { n: minutes });
  return t('unit.hoursMinutes', { h: Math.floor(minutes / 60), m: minutes % 60 });
}

const TODAY_KEYS: Record<number, string[]> = {
  0: ['sun', 'mon-sun'],
  1: ['mon-fri', 'mon-sun'],
  2: ['mon-fri', 'mon-sun'],
  3: ['mon-fri', 'mon-sun'],
  4: ['mon-fri', 'mon-sun'],
  5: ['mon-fri', 'mon-sun'],
  6: ['sat', 'mon-sun'],
};

/** Opening hours for the given day (default today); null when the data has none for that day. */
export function hoursForDay(hours: Record<string, string | undefined>, day = new Date().getDay()): string | null {
  for (const key of TODAY_KEYS[day]) {
    if (hours[key]) return hours[key] ?? null;
  }
  return null;
}

/** One-line summary of today's opening hours. */
export function formatOpeningHours(hours: Record<string, string | undefined>, t: TFunction, day = new Date().getDay()): string {
  const today = hoursForDay(hours, day);
  if (!today || today === 'closed') return t('hours.closedToday');
  return t('hours.openToday', { hours: today });
}

/** Escape user content inserted into HTML strings (Leaflet popups). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
