// =============================================
// Phenikaa WebGIS - UI Components
// =============================================

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import type { Place } from '../../types';

// =============================================
// Search Bar
// =============================================
export function SearchBar() {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debouncedQueryRef = useRef(query);

  const { searchQuery, setSearchQuery, searchPlaces, searchResults, searchLoading, clearSearch } = useStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      searchPlaces: state.searchPlaces,
      searchResults: state.searchResults,
      searchLoading: state.searchLoading,
      clearSearch: state.clearSearch,
    }))
  );

  // Sync local state with store
  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  // Debounce search
  useEffect(() => {
    debouncedQueryRef.current = query;
    const timer = setTimeout(() => {
      if (query.trim()) {
        searchPlaces(query);
        setShowResults(true);
      } else {
        clearSearch();
        setShowResults(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchPlaces, clearSearch]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node) &&
          resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSearchQuery(value);
  };

  const handleFocus = () => {
    if (query.trim()) setShowResults(true);
  };

  const handleResultClick = (place: Place) => {
    setQuery(place.name_vi);
    setSearchQuery(place.name_vi);
    setShowResults(false);
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuery('');
    setSearchQuery('');
    clearSearch();
    setShowResults(false);
    inputRef.current?.focus();
  };

  return (
    <div className="search-bar-container" style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
      <div className="search-input-wrapper" style={{ position: 'relative' }}>
        <svg
          className="search-icon"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 18,
            height: 18,
            color: '#9ca3af',
            pointerEvents: 'none',
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="Tìm kiếm tòa nhà, phòng học, thư viện..."
          className="search-input"
          style={{
            width: '100%',
            padding: '10px 12px 10px 44px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            background: 'white',
          }}
        />
        {query && (
          <button
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 24,
              height: 24,
              borderRadius: 4,
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showResults && (query.trim() || searchResults.length > 0) && (
        <div
          ref={resultsRef}
          className="search-results"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            maxHeight: 300,
            overflow: 'auto',
            zIndex: 100,
          }}
        >
          {searchLoading && (
            <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              Đang tìm kiếm...
            </div>
          )}
          {!searchLoading && searchResults.length === 0 && query.trim() && (
            <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Không tìm thấy kết quả cho "{query}"
            </div>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div style={{ maxHeight: 280, overflow: 'auto' }}>
              {searchResults.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handleResultClick(place)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    color: '#1f2937',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: place.category_color || '#3388ff',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {place.name_vi}
                    </div>
                    {place.code && (
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>Mã: {place.code}</div>
                    )}
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{place.category_name_vi}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================
// Category Filter
// =============================================
export function CategoryFilter() {
  const { categories, activeCategoryFilter, setActiveCategoryFilter, fetchCategories } = useStore(
    useShallow((state) => ({
      categories: state.categories,
      activeCategoryFilter: state.activeCategoryFilter,
      setActiveCategoryFilter: state.setActiveCategoryFilter,
      fetchCategories: state.fetchCategories,
    }))
  );

  useEffect(() => {
    if (categories.length === 0) fetchCategories();
  }, [categories.length, fetchCategories]);

  const handleCategoryClick = (code: string | null) => {
    setActiveCategoryFilter(code === activeCategoryFilter ? null : code);
  };

  return (
    <div className="category-filter" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Danh mục
        </span>
        {activeCategoryFilter && (
          <button
            onClick={() => handleCategoryClick(null)}
            style={{
              fontSize: 11,
              color: '#3b82f6',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
            }}
          >
            Bỏ lọc
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {categories.map((category) => (
          <label
            key={category.code}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 0.1s',
              background: activeCategoryFilter === category.code ? `${category.color}15` : 'transparent',
              border: activeCategoryFilter === category.code ? `1px solid ${category.color}` : 'none',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = activeCategoryFilter === category.code ? `${category.color}25` : '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.background = activeCategoryFilter === category.code ? `${category.color}15` : 'transparent'}
          >
            <input
              type="checkbox"
              checked={activeCategoryFilter === category.code}
              onChange={() => handleCategoryClick(category.code)}
              style={{
                width: 16,
                height: 16,
                accentColor: category.color,
                cursor: 'pointer',
              }}
            />
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: category.color,
                flexShrink: 0,
                border: activeCategoryFilter === category.code ? '2px solid white' : 'none',
                boxShadow: activeCategoryFilter === category.code ? '0 0 0 2px ' + category.color : 'none',
              }}
            />
            <span style={{ fontSize: 13, color: '#374151', fontWeight: activeCategoryFilter === category.code ? 500 : 400 }}>
              {category.name_vi}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// =============================================
// Place Card (for list view)
// =============================================
interface PlaceCardProps {
  place: Place;
  onClick: () => void;
  selected?: boolean;
}

export function PlaceCard({ place, onClick, selected }: PlaceCardProps) {
  const categoryColor = place.category_color || '#3388ff';

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '12px',
        border: selected ? `2px solid ${categoryColor}` : '1px solid #e5e7eb',
        borderRadius: 8,
        background: selected ? `${categoryColor}0d` : 'white',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.borderColor = '#d1d5db';
        e.currentTarget.style.background = '#f9fafb';
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = '#e5e7eb';
          e.currentTarget.style.background = 'white';
        }
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: categoryColor,
          flexShrink: 0,
          marginTop: 3,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: 0 }}>
            {place.name_vi}
          </h4>
          {place.floor !== null && (
            <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
              Tầng {place.floor}
            </span>
          )}
        </div>
        {place.code && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
            Mã: {place.code}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {place.category_name_vi || place.category_code}
        </div>
        {place.opening_hours && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            {formatOpeningHours(place.opening_hours)}
          </div>
        )}
      </div>
    </button>
  );
}

function formatOpeningHours(hours: Record<string, string | undefined>): string {
  const today = new Date().getDay();
  const dayMap: Record<number, string> = {
    0: 'sun', 1: 'mon-fri', 2: 'mon-fri', 3: 'mon-fri', 4: 'mon-fri', 5: 'mon-fri', 6: 'sat'
  };
  const todayKey = dayMap[today];
  const todayHours = hours[todayKey];
  if (!todayHours) return 'Đóng cửa hôm nay';
  if (todayHours === 'closed') return 'Đóng cửa hôm nay';
  return `Mở: ${todayHours}`;
}

// =============================================
// Place Detail Panel
// =============================================
interface PlaceDetailPanelProps {
  place: Place | null;
  onClose: () => void;
  onDirections?: () => void;
}

export function PlaceDetailPanel({ place, onClose, onDirections }: PlaceDetailPanelProps) {
  if (!place) return null;

  const categoryColor = place.category_color || '#3388ff';
  const categoryName = place.category_name_vi || place.category_code || 'Unknown';

  return (
    <div className="place-detail-panel" style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: 380,
      maxWidth: '100vw',
      background: 'white',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideIn 0.3s ease',
    }}>

      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: categoryColor,
                flexShrink: 0,
              }}
            />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: 0 }}>
              {place.name_vi}
            </h2>
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#fff',
            background: categoryColor,
            padding: '2px 8px',
            borderRadius: '9999px',
          }}>
            {categoryName}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: '#f3f4f6',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {place.code && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
              Mã địa điểm
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937', fontFamily: 'monospace' }}>
              {place.code}
            </div>
          </div>
        )}

        {place.description_vi && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Mô tả
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              {place.description_vi}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Thông tin
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <DetailItem label="Tầng" value={place.floor !== null ? `Tầng ${place.floor}` : 'Cả tòa nhà'} />
            {place.contact_phone && <DetailItem label="Điện thoại" value={place.contact_phone} />}
            {place.contact_email && <DetailItem label="Email" value={place.contact_email} />}
            {place.attributes?.capacity && <DetailItem label="Sức chứa" value={`${place.attributes.capacity} người`} />}
          </div>
        </div>

        {place.opening_hours && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Giờ mở cửa
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(place.opening_hours).map(([day, time]) => (
                <div key={day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>{formatDayName(day)}</span>
                  <span style={{ color: time === 'closed' ? '#ef4444' : '#1f2937', fontWeight: time === 'closed' ? 400 : 500 }}>
                    {time === 'closed' ? 'Đóng cửa' : time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {place.attributes && Object.keys(place.attributes).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Tiện nghi
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(place.attributes)
                .filter(([_, v]) => v === true)
                .map(([key]) => (
                  <span
                    key={key}
                    style={{
                      fontSize: 11,
                      color: '#374151',
                      background: '#f3f4f6',
                      padding: '4px 8px',
                      borderRadius: 4,
                    }}
                  >
                    {formatAttributeKey(key)}
                  </span>
                ))}
            </div>
          </div>
        )}

        {place.images && place.images.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Hình ảnh
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
              {place.images.map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={img.caption || place.name_vi}
                  style={{
                    width: 100,
                    height: 75,
                    objectFit: 'cover',
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        gap: 8,
      }}>
        <button
          onClick={onDirections || onClose}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: categoryColor,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'opacity 0.1s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 10V6a2 2 0 00-2-2H5a2 2 0 00-2 2v8" />
            <path d="M17 14L21 18M5 14L1 18M12 2v12" />
          </svg>
          Chỉ đường
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(`${place.name_vi} - ${place.code || ''}`)}
          style={{
            padding: '10px 16px',
            background: 'white',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1f2937' }}>{value}</div>
    </div>
  );
}

function formatDayName(day: string): string {
  const map: Record<string, string> = {
    'mon-fri': 'Thứ 2 - Thứ 6',
    'sat': 'Thứ 7',
    'sun': 'Chủ nhật',
  };
  return map[day] || day;
}

function formatAttributeKey(key: string): string {
  const map: Record<string, string> = {
    has_wifi: 'WiFi',
    has_ac: 'Điều hòa',
    has_projector: 'Máy chiếu',
    wheelchair_access: 'Tiếp cận KHTN',
    has_elevator: 'Thang máy',
  };
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}