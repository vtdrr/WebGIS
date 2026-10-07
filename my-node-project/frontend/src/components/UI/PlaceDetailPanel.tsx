import { useEffect } from 'react';
import type { Place } from '../../types';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n';
import { Icon } from './Icon';

interface PlaceDetailPanelProps {
  place: Place | null;
  onClose: () => void;
  onDirections?: () => void;
}

/** Translate a known key (hours/attributes) or fall back to a prettified raw key. */
function labelFor(prefix: 'hours' | 'attr', key: string, t: (k: MessageKey) => string): string {
  const messageKey = `${prefix}.${key}` as MessageKey;
  const translated = t(messageKey);
  // `translate` returns the key itself when it is unknown
  if (translated !== messageKey) return translated;
  return key.replace(/^has_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="detail__section">
      <div className="section-title section-title--small">{title}</div>
      {children}
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="detail__item-label">{label}</div>
      <div className="detail__item-value">{value}</div>
    </div>
  );
}

export function PlaceDetailPanel({ place, onClose, onDirections }: PlaceDetailPanelProps) {
  const { t, placeName, placeDescription, placeCategory } = useT();

  // Escape closes the panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!place) return null;

  const color = place.category_color || '#3388ff';
  const description = placeDescription(place);
  const amenities = Object.entries(place.attributes ?? {}).filter(([, v]) => v === true);

  return (
    <aside className="detail" role="dialog" aria-label={placeName(place)}>
      <header className="detail__header">
        <div>
          <div className="detail__title">
            <span className="dot dot--lg" style={{ background: color }} />
            <h2>{placeName(place)}</h2>
          </div>
          <span className="detail__category" style={{ background: color }}>
            {placeCategory(place) || t('place.unknownCategory')}
          </span>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t('place.close')}>
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className="detail__content">
        {place.code && (
          <Section title={t('place.code')}>
            <div className="detail__code">{place.code}</div>
          </Section>
        )}

        {description && (
          <Section title={t('place.description')}>
            <p className="detail__text">{description}</p>
          </Section>
        )}

        <Section title={t('place.info')}>
          <div className="detail__grid">
            <DetailItem
              label={t('place.floorLabel')}
              value={place.floor !== null ? t('place.floor', { floor: place.floor }) : t('place.wholeBuilding')}
            />
            {place.contact_phone && <DetailItem label={t('place.phone')} value={place.contact_phone} />}
            {place.contact_email && <DetailItem label={t('place.email')} value={place.contact_email} />}
            {place.attributes?.capacity ? (
              <DetailItem label={t('place.capacity')} value={t('place.people', { n: place.attributes.capacity })} />
            ) : null}
          </div>
        </Section>

        {place.opening_hours && Object.keys(place.opening_hours).length > 0 && (
          <Section title={t('place.hours')}>
            <div className="detail__hours">
              {Object.entries(place.opening_hours).map(([day, time]) => (
                <div key={day} className="detail__hours-row">
                  <span>{labelFor('hours', day, t)}</span>
                  <span className={time === 'closed' ? 'is-closed' : ''}>{time === 'closed' ? t('hours.closed') : time}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {amenities.length > 0 && (
          <Section title={t('place.amenities')}>
            <div className="detail__tags">
              {amenities.map(([key]) => (
                <span key={key} className="badge badge--tag">
                  {labelFor('attr', key, t)}
                </span>
              ))}
            </div>
          </Section>
        )}

        {place.images && place.images.length > 0 && (
          <Section title={t('place.images')}>
            <div className="detail__images">
              {place.images.map((img, i) => (
                <img key={`${img.url}-${i}`} src={img.url} alt={img.caption || placeName(place)} loading="lazy" />
              ))}
            </div>
          </Section>
        )}
      </div>

      <footer className="detail__footer">
        <button
          type="button"
          className="btn btn--primary"
          style={{ background: color }}
          onClick={onDirections || onClose}
        >
          <Icon name="directions" />
          {t('place.directions')}
        </button>
        <button
          type="button"
          className="btn"
          title={t('place.copy')}
          aria-label={t('place.copy')}
          onClick={() => navigator.clipboard?.writeText(`${placeName(place)}${place.code ? ` - ${place.code}` : ''}`)}
        >
          <Icon name="link" />
        </button>
      </footer>
    </aside>
  );
}
