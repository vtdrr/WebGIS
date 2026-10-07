import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { makePlace } from '../../test/fixtures';
import { useStore } from '../../store/useStore';
import { RoutePanel } from './RoutePanel';
import type { RoutingResponse } from '../../types';

const initial = useStore.getState();
const target = makePlace({ id: 'dest', name_vi: 'Thư viện', name_en: 'Library' });
const other = makePlace({ id: 'other', name_vi: 'Căng tin', name_en: 'Canteen' });

const result = (over: Partial<RoutingResponse['meta']> = {}): RoutingResponse => ({
  routes: [
    {
      geometry: { type: 'LineString', coordinates: [] },
      distance: 1540,
      duration: 1040,
      weight: 0,
      weight_name: 'w',
      legs: [
        {
          distance: 1540,
          duration: 1040,
          summary: '',
          steps: [
            { name: 'a', distance: 900, duration: 600, geometry: 'x', maneuver: { type: 'depart', location: [0, 0] }, instruction: 'Đi từ A đến B' },
            { name: 'b', distance: 550, duration: 440, geometry: 'x', maneuver: { type: 'arrive', location: [0, 0] }, instruction: 'Đi thẳng đến C', off_network: true },
          ],
        },
      ],
    },
  ],
  waypoints: [],
  meta: { mode: 'walk', took_ms: 3, ...over },
});

function setup(state: Parameters<typeof useStore.setState>[0] = {}) {
  const actions = {
    setRoutingMode: vi.fn(),
    setRoutingOrigin: vi.fn(),
    setRoutePicking: vi.fn(),
    swapRouting: vi.fn(),
    clearRouting: vi.fn(),
  };
  useStore.setState({ ...initial, lang: 'vi', mapPlaces: [target, other], routingTo: target, ...actions, ...state } as never, true);
  return actions;
}

describe('RoutePanel', () => {
  it('renders nothing when there is no routing activity', () => {
    setup({ routingTo: null });
    const { container } = render(<RoutePanel gpsPosition={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('asks for an origin and lists places except the destination', () => {
    setup();
    render(<RoutePanel gpsPosition={null} />);
    expect(screen.getByText('Chọn điểm xuất phát để xem tuyến đường.')).toBeInTheDocument();
    const select = screen.getByLabelText('Điểm xuất phát');
    expect(select).toHaveTextContent('Căng tin');
    expect(select).not.toHaveTextContent('Thư viện');
    expect(screen.getByText('Vị trí của tôi (chưa có GPS)')).toBeInTheDocument();
    // modes are disabled until both ends exist
    expect(screen.getByRole('button', { name: /Đi bộ/ })).toBeDisabled();
  });

  it('picking a place or GPS as origin goes through the store', () => {
    const actions = setup();
    render(<RoutePanel gpsPosition={{ lat: 20.9, lng: 105.7 }} />);
    fireEvent.change(screen.getByLabelText('Điểm xuất phát'), { target: { value: 'other' } });
    expect(actions.setRoutingOrigin).toHaveBeenCalledWith(other);
    fireEvent.change(screen.getByLabelText('Điểm xuất phát'), { target: { value: '__gps__' } });
    expect(actions.setRoutingOrigin).toHaveBeenLastCalledWith({ lat: 20.9, lng: 105.7, name: 'Vị trí của tôi', source: 'gps' });
  });

  it('toggles map picking and closes', () => {
    const actions = setup();
    render(<RoutePanel gpsPosition={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chọn điểm xuất phát trên bản đồ' }));
    expect(actions.setRoutePicking).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chỉ đường' }));
    expect(actions.clearRouting).toHaveBeenCalled();
  });

  it('shows the summary, steps and the off-network warning', () => {
    setup({
      routingFrom: { lat: 1, lng: 2, name: 'Căng tin', placeId: 'other', source: 'place' },
      routingResult: result({ off_network_m: 120 }),
    });
    render(<RoutePanel gpsPosition={null} />);
    expect(screen.getByText('1.5 km')).toBeInTheDocument();
    expect(screen.getByText('17 phút')).toBeInTheDocument();
    expect(screen.getByText('Đi từ A đến B')).toBeInTheDocument();
    expect(screen.getByText(/đi thẳng, chưa có dữ liệu đường/)).toBeInTheDocument();
    expect(screen.getByText(/Gồm khoảng 120 m đi thẳng/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đổi điểm đi và điểm đến' })).toBeEnabled();
  });

  it('marks a straight-line fallback and hides the off-network note', () => {
    setup({
      routingFrom: { lat: 1, lng: 2, name: 'x', source: 'map' },
      routingResult: result({ fallback: true, off_network_m: 500 }),
    });
    render(<RoutePanel gpsPosition={null} />);
    expect(screen.getByText('Đường chim bay')).toBeInTheDocument();
    expect(screen.queryByText(/Gồm khoảng/)).not.toBeInTheDocument();
    // a map-picked origin cannot be swapped
    expect(screen.getByRole('button', { name: 'Đổi điểm đi và điểm đến' })).toBeDisabled();
  });

  it('switches the mode', () => {
    const actions = setup({ routingFrom: { lat: 1, lng: 2, name: 'x', source: 'gps' }, routingResult: result() });
    render(<RoutePanel gpsPosition={{ lat: 1, lng: 2 }} />);
    fireEvent.click(screen.getByRole('button', { name: /Xe lăn/ }));
    expect(actions.setRoutingMode).toHaveBeenCalledWith('wheelchair');
  });

  it('shows loading and error states, and is translated in English', () => {
    setup({ lang: 'en', routingLoading: true, routingError: 'Too far' });
    render(<RoutePanel gpsPosition={null} />);
    expect(screen.getByText('Calculating the route...')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Too far');
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByLabelText('Starting point')).toHaveTextContent('Canteen');
  });
});
