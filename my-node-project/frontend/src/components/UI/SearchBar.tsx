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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { searchQuery, setSearchQuery, searchPlaces, searchResults, searchLoading, clearSearch } = useStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      searchPlaces: state.searchPlaces,
      searchResults: state.searchResults,
      searchLoading: state.searchLoading,
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
  };

  const handleSelect = (place: Place) => {
    setShowResults(false);
    inputRef.current?.blur();
    onSelect(place);
  };

  const handleClear = () => {
    setQuery('');
    clearSearch();
    setShowResults(false);
    inputRef.current?.focus();
  };

  const open = showResults && query.trim() !== '';

  return (
    <div ref={containerRef} className="search" onKeyDown={(e) => e.key === 'Escape' && setShowResults(false)}>
      <span className="search__icon">
        <Icon name="search" size={18} />
      </span>
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
        aria-label={t('search.placeholder')}
        className="search__input"
        value={query}
        onChange={handleChange}
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
          {!searchLoading && searchResults.length === 0 && (
            <div className="search__status search__status--muted">{t('search.noResults', { query })}</div>
          )}
          {!searchLoading &&
            searchResults.map((place) => (
              <button
                key={place.id}
                type="button"
                role="option"
                aria-selected={false}
                className="search__result"
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
