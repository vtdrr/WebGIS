import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useStore } from '../../store/useStore';
import { MapOverlays } from './MapOverlays';

const initial = useStore.getState();

beforeEach(() => useStore.setState({ ...initial, lang: 'vi' }, true));

describe('MapOverlays data states', () => {
  it('shows map loading and reports failed map data with a retry action', () => {
    const fetchMapPlaces = vi.fn();
    useStore.setState({ mapPlacesLoading: true, mapPlacesError: null, fetchMapPlaces });
    const { rerender } = render(<MapOverlays geoError={null} geoLoading={false} onLocate={() => undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải địa điểm trên bản đồ');

    act(() => useStore.setState({ mapPlacesLoading: false, mapPlacesError: 'offline' }));
    rerender(<MapOverlays geoError={null} geoLoading={false} onLocate={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được địa điểm trên bản đồ.');
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(fetchMapPlaces).toHaveBeenCalledOnce();
  });
});
