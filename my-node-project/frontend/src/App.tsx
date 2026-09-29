// =============================================
// Phenikaa WebGIS - Main App Component
// =============================================

import React, { useEffect } from 'react';
import { BaseMap } from './components/Map/MapView';
import { SearchBar } from './components/UI/PlaceDetailPanel';
import { CategoryFilter } from './components/UI/PlaceDetailPanel';
import { PlaceCard } from './components/UI/PlaceDetailPanel';
import { PlaceDetailPanel } from './components/UI/PlaceDetailPanel';
import { useStore } from './store/useStore';
import type { Place } from './types';

function App() {
  const {
    // Places
    places,
    placesLoading,
    placesError,
    placesMeta,
    placesQuery,
    fetchPlaces,
    loadMorePlaces,
    // Selected place
    selectedPlace,
    setSelectedPlace,
    // Search
    clearSearch,
    // UI
    sidebarOpen,
    toggleSidebar,
  } = useStore();

  // Initialize data
  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  // Handle place selection
  const handlePlaceClick = (place: Place) => {
    setSelectedPlace(place);
    clearSearch();
  };

  const handleCloseDetail = () => {
    setSelectedPlace(null);
  };

  const handleDirections = () => {
    if (!selectedPlace) return;
    console.log('Get directions to:', selectedPlace);
  };

  // Load more places on scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 100 && !placesLoading && placesMeta && placesQuery.page < placesMeta.totalPages) {
      loadMorePlaces();
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside
        className="sidebar"
        style={{
          width: sidebarOpen ? 380 : 60,
          minWidth: sidebarOpen ? 380 : 60,
          background: 'white',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s ease, min-width 0.3s ease',
          overflow: 'hidden',
          zIndex: 100,
        }}
      >
        {/* Sidebar Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                <path d="M21 10V6a2 2 0 00-2-2H5a2 2 0 00-2 2v8" />
                <path d="M17 14L21 18M5 14L1 18M12 2v12" />
              </svg>
            </div>
            {sidebarOpen && (
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Phenikaa WebGIS
                </h1>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Bản đồ khuôn viên trường
                </p>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
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
              flexShrink: 0,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
            aria-label={sidebarOpen ? 'Thu gọn sidebar' : 'Mở rộng sidebar'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              {sidebarOpen ? (
                <path d="M15 18l-6-6 6-6" />
              ) : (
                <path d="M9 18l6-6-6-6" />
              )}
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <SearchBar />
        </div>

        {/* Category Filter */}
        {sidebarOpen && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
            <CategoryFilter />
          </div>
        )}

        {/* Places List */}
        <div
          style={{ flex: 1, overflow: 'auto', padding: sidebarOpen ? '12px 16px' : 0 }}
          onScroll={handleScroll}
        >
          {sidebarOpen ? (
            <>
              {placesLoading && places.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', color: '#9ca3af' }}>
                  <div style={{ width: 24, height: 24, border: '2px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <p style={{ fontSize: 13 }}>Đang tải địa điểm...</p>
                </div>
              )}

              {placesError && (
                <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
                  {placesError}
                  <button onClick={fetchPlaces} style={{ marginTop: 8, padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
                    Thử lại
                  </button>
                </div>
              )}

              {!placesLoading && places.length === 0 && !placesError && (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.5 }}>
                    <path d="M21 10V6a2 2 0 00-2-2H5a2 2 0 00-2 2v8" />
                    <path d="M17 14L21 18M5 14L1 18M12 2v12" />
                  </svg>
                  <p style={{ fontSize: 13, marginBottom: 4 }}>Không tìm thấy địa điểm</p>
                  <p style={{ fontSize: 11 }}>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                </div>
              )}

              {places.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  onClick={() => handlePlaceClick(place)}
                  selected={selectedPlace?.id === place.id}
                />
              ))}

              {placesLoading && places.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px', color: '#9ca3af', fontSize: 13 }}>
                  Đang tải thêm...
                </div>
              )}

              {placesMeta && placesQuery.page >= placesMeta.totalPages && places.length > 0 && (
                <div style={{ textAlign: 'center', padding: '16px', color: '#9ca3af', fontSize: 12 }}>
                  Đã tải hết {placesMeta.total} địa điểm
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 11 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ marginBottom: 8 }}>
                <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                <path d="M4 12h16" />
              </svg>
              Mở rộng để xem danh sách
            </div>
          )}
        </div>

        {/* Footer Stats */}
        {sidebarOpen && placesMeta && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', fontSize: 11, color: '#9ca3af' }}>
            Hiển thị {places.length} / {placesMeta.total} địa điểm
          </div>
        )}
      </aside>

      {/* Map */}
      <main style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <BaseMap>
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Location button */}
            <button
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      console.log('User location:', pos.coords.latitude, pos.coords.longitude);
                    },
                    (err) => console.error('Geolocation error:', err)
                  );
                }
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: 'white',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#374151',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              title="Vị trí của tôi"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
              </svg>
            </button>

            {/* Reset view button */}
            <button
              onClick={() => {
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: 'white',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#374151',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              title="Khôi phục bản đồ"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>
          </div>
        </BaseMap>
      </main>

      {/* Place Detail Panel */}
      {selectedPlace && (
        <PlaceDetailPanel
          place={selectedPlace}
          onClose={handleCloseDetail}
          onDirections={handleDirections}
        />
      )}
    </div>
  );
}

export default App;