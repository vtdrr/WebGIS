// =============================================
// Phenikaa WebGIS - Main App Component
// =============================================

import React, { useEffect } from 'react';
import {
  BaseMap,
  PlacesLayer,
  BuildingsLayer,
  UserLocation,
  RoutingLayer,
} from './components/Map/MapView';
import {
  SearchBar,
  CategoryFilter,
  PlaceCard,
  PlaceDetailPanel,
} from './components/UI/PlaceDetailPanel';
import { useGeolocation } from './hooks/useMap';
import { useStore } from './store/useStore';
import type { Place } from './types';

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} giây`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  return `${h} giờ ${minutes % 60} phút`;
}

const MODE_LABELS: Array<{ value: 'walk' | 'bike' | 'wheelchair'; label: string; icon: string }> = [
  { value: 'walk', label: 'Đi bộ', icon: '🚶' },
  { value: 'bike', label: 'Xe đạp', icon: '🚴' },
  { value: 'wheelchair', label: 'Xe lăn', icon: '♿' },
];

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
    // Categories
    categories,
    // Selected place
    selectedPlace,
    setSelectedPlace,
    // Search
    clearSearch,
    // UI
    sidebarOpen,
    toggleSidebar,
    // Map reset
    resetMapView,
    // Routing
    routingFrom,
    routingTo,
    routingResult,
    routingLoading,
    routingError,
    routingMode,
    setRoutingMode,
    startRoutingTo,
    clearRouting,
  } = useStore();

  // Initialize data
  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  // Geolocation
  const { position, error: geoError, loading: geoLoading, requestLocation } = useGeolocation();

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
    startRoutingTo(selectedPlace, position);
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
          <PlacesLayer
            places={places}
            categories={categories}
            selectedPlaceId={selectedPlace?.id ?? null}
            onPlaceClick={handlePlaceClick}
          />
          <BuildingsLayer places={places} categories={categories} />
          {position && <UserLocation position={position} />}
          {routingResult?.routes?.[0]?.geometry &&
            typeof routingResult.routes[0].geometry !== 'string' && (
              <RoutingLayer route={routingResult.routes[0].geometry} />
            )}

          {/* Floating action buttons */}
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Location button */}
            <button
              onClick={() => requestLocation()}
              disabled={geoLoading}
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
                opacity: geoLoading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
              title="Vị trí của tôi"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
              </svg>
            </button>

            {/* Reset view button */}
            <button
              onClick={() => resetMapView()}
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
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
              title="Khôi phục bản đồ"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>
          </div>

          {/* Geolocation error toast */}
          {geoError && (
            <div style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              Không lấy được vị trí: {geoError}
            </div>
          )}

          {/* Route info panel */}
          {(routingResult || routingLoading || routingError || routingTo) && (
            <div style={{
              position: 'absolute',
              bottom: 24,
              right: 16,
              zIndex: 50,
              width: 340,
              maxWidth: 'calc(100vw - 32px)',
              background: 'white',
              borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>Chỉ đường</span>
                <button
                  onClick={clearRouting}
                  style={{
                    width: 28, height: 28, borderRadius: 6, background: '#f3f4f6',
                    border: 'none', color: '#6b7280', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  aria-label="Đóng chỉ đường"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div style={{ padding: '12px 16px' }}>
                {/* Mode selector */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {MODE_LABELS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setRoutingMode(m.value)}
                      disabled={!routingFrom || !routingTo}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: routingMode === m.value ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                        background: routingMode === m.value ? '#eff6ff' : 'white',
                        color: routingMode === m.value ? '#1d4ed8' : '#6b7280',
                        fontSize: 12,
                        fontWeight: routingMode === m.value ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        opacity: !routingFrom || !routingTo ? 0.5 : 1,
                      }}
                    >
                      <span>{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* From - To */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                    <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {routingFrom?.name ?? '...'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                    <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {routingTo?.name_vi ?? '...'}
                    </span>
                  </div>
                </div>

                {routingLoading && (
                  <div style={{ padding: '12px 0', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                    Đang tính tuyến đường...
                  </div>
                )}

                {routingError && (
                  <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 12 }}>
                    {routingError}
                  </div>
                )}

                {routingResult && routingResult.routes?.[0] && (
                  <div>
                    <div style={{
                      display: 'flex',
                      gap: 12,
                      padding: '10px 12px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 8,
                      marginBottom: 10,
                    }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#166534' }}>Quãng đường</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#14532d' }}>
                          {formatDistance(routingResult.routes[0].distance)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#166534' }}>Thời gian</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#14532d' }}>
                          {formatDuration(routingResult.routes[0].duration)}
                        </div>
                      </div>
                      {routingResult.meta?.fallback && (
                        <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '2px 6px', borderRadius: 4, alignSelf: 'flex-start' }}>
                          Đường chim bay
                        </div>
                      )}
                    </div>

                    {/* Steps */}
                    {routingResult.routes[0].legs?.[0]?.steps && routingResult.routes[0].legs[0].steps.length > 1 && (
                      <div style={{ maxHeight: 180, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {routingResult.routes[0].legs[0].steps!.map((step, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#374151' }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%',
                              background: '#f3f4f6', color: '#6b7280',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 1,
                            }}>
                              {i + 1}
                            </div>
                            <div>
                              <div>{step.instruction}</div>
                              <div style={{ color: '#9ca3af', fontSize: 11 }}>
                                {formatDistance(step.distance)} • {formatDuration(step.duration)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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
