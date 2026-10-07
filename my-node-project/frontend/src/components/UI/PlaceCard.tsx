import type { Place } from '../../types';
import { useT } from '../../i18n/useT';
import { formatOpeningHours } from '../../utils/format';

interface PlaceCardProps {
  place: Place;
  onClick: () => void;
  selected?: boolean;
}

export function PlaceCard({ place, onClick, selected }: PlaceCardProps) {
  const { t, placeName, placeCategory } = useT();
  const color = place.category_color || '#3388ff';

  return (
    <button
      type="button"
      className={`place-card${selected ? ' is-selected' : ''}`}
      style={selected ? { borderColor: color, background: `${color}0d` } : undefined}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="dot dot--lg place-card__dot" style={{ background: color }} />
      <span className="place-card__body">
        <span className="place-card__title">
          <h4>{placeName(place)}</h4>
          {place.floor !== null && <span className="badge">{t('place.floor', { floor: place.floor })}</span>}
        </span>
        {place.code && <span className="place-card__meta">{t('search.code', { code: place.code })}</span>}
        <span className="place-card__category">{placeCategory(place)}</span>
        {place.opening_hours && (
          <span className="place-card__meta place-card__meta--hours">{formatOpeningHours(place.opening_hours, t)}</span>
        )}
      </span>
    </button>
  );
}
