import { useEffect, useState } from 'react';
import type { Place } from '../../types';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n';
import { getPlacePhotoCandidates } from '../../data/placePhotos';
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

function PlacePhoto({ place }: { place: Place }) {
  const { placeName, t } = useT();
  const candidates = getPlacePhotoCandidates(place);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(() => new Set());
  const uploaded = candidates.filter((candidate) => !candidate.campusReference && !failedUrls.has(candidate.url));
  const campusReferences = candidates.filter((candidate) => candidate.campusReference && !failedUrls.has(candidate.url));
  const visibleCandidates = uploaded.length > 0 ? uploaded : campusReferences;

  if (visibleCandidates.length === 0) {
    return <p className="detail__photo-status" role="status">{t('place.noImages')}</p>;
  }

  return (
    <div className="detail__photos">
      {visibleCandidates.some((candidate) => !loadedUrls.has(candidate.url)) && (
        <p className="detail__photo-status" role="status">{t('place.imageLoading')}</p>
      )}
      {visibleCandidates.map((candidate) => (
        <figure className="detail__photo-frame" key={`${place.id}:${candidate.url}`}>
          <img
            className={`detail__photo${loadedUrls.has(candidate.url) ? ' is-loaded' : ''}`}
            src={candidate.url}
            alt={candidate.caption || placeName(place)}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoadedUrls((previous) => new Set(previous).add(candidate.url))}
            onError={() => {
              setLoadedUrls((previous) => {
                const next = new Set(previous);
                next.delete(candidate.url);
                return next;
              });
              setFailedUrls((previous) => new Set(previous).add(candidate.url));
            }}
          />
          {loadedUrls.has(candidate.url) && candidate.caption !== placeName(place) && (
            <figcaption className="detail__photo-caption">{candidate.caption}</figcaption>
          )}
        </figure>
      ))}
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
  const hasContactInfo = Boolean(place.contact_phone || place.contact_email || place.attributes?.capacity);

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
        <Section title={t('place.images')}>
          <PlacePhoto key={place.id} place={place} />
        </Section>

        {description && (
          <Section title={t('place.description')}>
            <p className="detail__text">{description}</p>
          </Section>
        )}

        {hasContactInfo && (
          <Section title={t('place.info')}>
            <div className="detail__grid">
              {place.contact_phone && <DetailItem label={t('place.phone')} value={place.contact_phone} />}
              {place.contact_email && <DetailItem label={t('place.email')} value={place.contact_email} />}
              {place.attributes?.capacity ? (
                <DetailItem label={t('place.capacity')} value={t('place.people', { n: place.attributes.capacity })} />
              ) : null}
            </div>
          </Section>
        )}

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
          onClick={() => navigator.clipboard?.writeText(placeName(place))}
        >
          <Icon name="link" />
        </button>
      </footer>
    </aside>
  );
}
