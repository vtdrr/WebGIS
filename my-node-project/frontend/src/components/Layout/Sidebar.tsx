import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';
import { CategoryFilter, Icon, LanguageSwitch, PlaceCard, SearchBar } from '../UI';
import type { Place } from '../../types';

interface SidebarProps {
  onPlaceSelect: (place: Place) => void;
}

export function Sidebar({ onPlaceSelect }: SidebarProps) {
  const { t } = useT();
  const {
    places, placesLoading, placesError, placesMeta, placesQuery, fetchPlaces, loadMorePlaces,
    selectedPlace, sidebarOpen, toggleSidebar,
  } = useStore(
    useShallow((s) => ({
      places: s.places,
      placesLoading: s.placesLoading,
      placesError: s.placesError,
      placesMeta: s.placesMeta,
      placesQuery: s.placesQuery,
      fetchPlaces: s.fetchPlaces,
      loadMorePlaces: s.loadMorePlaces,
      selectedPlace: s.selectedPlace,
      sidebarOpen: s.sidebarOpen,
      toggleSidebar: s.toggleSidebar,
    })),
  );

  const hasMore = Boolean(placesMeta && placesQuery.page < placesMeta.totalPages);

  // Infinite scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 100 && !placesLoading && hasMore) loadMorePlaces();
  };

  return (
    <aside className={`sidebar${sidebarOpen ? '' : ' is-collapsed'}`} aria-label={t('app.subtitle')}>
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <div className="sidebar__logo">
            <Icon name="directions" size={20} />
          </div>
          {sidebarOpen && (
            <div className="sidebar__titles">
              <h1>{t('app.title')}</h1>
              <p>{t('app.subtitle')}</p>
            </div>
          )}
        </div>
        <div className="sidebar__actions">
          {sidebarOpen && <LanguageSwitch />}
          <button
            type="button"
            className="icon-button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? t('sidebar.collapse') : t('sidebar.expand')}
            aria-expanded={sidebarOpen}
          >
            <Icon name={sidebarOpen ? 'chevronLeft' : 'chevronRight'} size={18} />
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <>
          <div className="sidebar__block">
            <SearchBar onSelect={onPlaceSelect} />
          </div>
          <div className="sidebar__block">
            <CategoryFilter />
          </div>
        </>
      )}

      <div className="sidebar__list" onScroll={handleScroll}>
        {sidebarOpen ? (
          <>
            {placesLoading && places.length === 0 && (
              <div className="empty-state" role="status">
                <div className="spinner" />
                <p>{t('sidebar.loading')}</p>
              </div>
            )}

            {placesError && (
              <div className="alert alert--error" role="alert">
                {placesError}
                <button type="button" className="btn btn--danger btn--small" onClick={fetchPlaces}>
                  {t('sidebar.retry')}
                </button>
              </div>
            )}

            {!placesLoading && places.length === 0 && !placesError && (
              <div className="empty-state">
                <p>{t('sidebar.empty')}</p>
                <p className="empty-state__hint">{t('sidebar.emptyHint')}</p>
              </div>
            )}

            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                onClick={() => onPlaceSelect(place)}
                selected={selectedPlace?.id === place.id}
              />
            ))}

            {placesLoading && places.length > 0 && <div className="sidebar__note">{t('sidebar.loadingMore')}</div>}

            {placesMeta && !hasMore && places.length > 0 && (
              <div className="sidebar__note sidebar__note--small">{t('sidebar.allLoaded', { total: placesMeta.total })}</div>
            )}
          </>
        ) : (
          <div className="empty-state empty-state--collapsed">{t('sidebar.expandHint')}</div>
        )}
      </div>

      {sidebarOpen && placesMeta && (
        <div className="sidebar__footer">
          {t('sidebar.showing', { shown: places.length, total: placesMeta.total })}
        </div>
      )}
    </aside>
  );
}
