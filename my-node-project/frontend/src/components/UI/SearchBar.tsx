import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/useStore';
import { useT } from '../../i18n/useT';
import type { Place } from '../../types';
import { Icon } from './Icon';

interface SearchBarProps {
  /** Called when the user picks a search result */
  onSelect: (place: Place) => void;
}

const DEBOUNCE_MS = 300;

export function SearchBar({ onSelect }: SearchBarProps) {
  const { t, placeName, placeCategory } = useT();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { searchQuery, setSearchQuery, searchPlaces, searchResults, searchLoading, searchError, clearSearch } = useStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      searchPlaces: state.searchPlaces,
      searchResults: state.searchResults,
      searchLoading: state.searchLoading,
      searchError: state.searchError,
      clearSearch: state.clearSearch,
    })),
  );

  // Sync local state with store (e.g. the store clears the search after a selection)
  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        searchPlaces(query);
        setShowResults(true);
      } else {
        clearSearch();
        setShowResults(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, searchPlaces, clearSearch]);

  // Click outside closes the results
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSearchQuery(e.target.value);
    setShowResults(false);
    setActiveIndex(-1);
  };

  const handleSelect = (place: Place) => {
    setShowResults(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
    onSelect(place);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowResults(false);
      setActiveIndex(-1);
      return;
    }

    if (!open || searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((current) => current < 0 ? 0 : (current + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((current) => current < 0 ? searchResults.length - 1 : (current - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(searchResults[activeIndex]);
    }
  };

  const handleClear = () => {
    setQuery('');
    clearSearch();
    setShowResults(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const open = showResults && query.trim() !== '';

  return (
    <div ref={containerRef} className="search">
      <span className="search__icon">
        <Icon name="search" size={18} />
      </span>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
        aria-activedescendant={open && activeIndex >= 0 ? `search-option-${searchResults[activeIndex]?.id}` : undefined}
        aria-label={t('search.placeholder')}
        className="search__input"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => query.trim() && setShowResults(true)}
        placeholder={t('search.placeholder')}
        autoComplete="off"
      />
      {query && (
        <button type="button" className="search__clear" onClick={handleClear} aria-label={t('search.clear')}>
          <Icon name="close" />
        </button>
      )}

      {open && (
        <div id="search-results" role="listbox" className="search__results">
          {searchLoading && <div className="search__status">{t('search.loading')}</div>}
          {!searchLoading && searchError && (
            <div className="search__status" role="alert">
              <span>{t('search.failed')}</span>
              <button type="button" className="btn btn--small" onClick={() => searchPlaces(query)}>
                {t('search.retry')}
              </button>
            </div>
          )}
          {!searchLoading && !searchError && searchResults.length === 0 && (
            <div className="search__status search__status--muted">{t('search.noResults', { query })}</div>
          )}
          {!searchLoading &&
            searchResults.map((place, index) => (
              <button
                key={place.id}
                id={`search-option-${place.id}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={`search__result${activeIndex === index ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleSelect(place)}
              >
                <span className="dot" style={{ background: place.category_color || '#3388ff' }} />
                <span className="search__result-text">
                  <span className="search__result-name">{placeName(place)}</span>
                  {place.code && <span className="search__result-meta">{t('search.code', { code: place.code })}</span>}
                  <span className="search__result-meta">{placeCategory(place)}</span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
