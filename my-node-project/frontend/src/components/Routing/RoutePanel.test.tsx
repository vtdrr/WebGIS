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
    setRoutingOrigin: vi.fn(),
    swapRouting: vi.fn(),
    clearRouting: vi.fn(),
  };
  useStore.setState({ ...initial, lang: 'vi', mapPlaces: [target, other], routePlaces: [target, other], routingTo: target, ...actions, ...state } as never, true);
  return actions;
}

describe('RoutePanel', () => {
  it('renders nothing when there is no routing activity', () => {
    setup({ routingTo: null });
    const { container } = render(<RoutePanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('asks for an origin and lists places except the destination', () => {
    setup();
    render(<RoutePanel />);
    expect(screen.getByText('Chọn điểm xuất phát để xem tuyến đường.')).toBeInTheDocument();
    const select = screen.getByLabelText('Điểm xuất phát');
    expect(select).toHaveTextContent('Căng tin');
    expect(select).not.toHaveTextContent('Thư viện');
    expect(select).not.toHaveTextContent('Vị trí của tôi');
    expect(screen.getByText('Đi bộ')).toBeInTheDocument();
    expect(screen.queryByText('Xe đạp')).not.toBeInTheDocument();
    expect(screen.queryByText('Xe lăn')).not.toBeInTheDocument();
  });

  it('lists origin choices from all places even when the map is category-filtered', () => {
    const building = makePlace({ id: 'building', name_vi: 'Tòa A1', category_code: 'building' });
    const parking = makePlace({ id: 'parking-2', name_vi: 'Bãi giữ xe 2', category_code: 'parking' });
    const actions = setup({ routingTo: parking, mapPlaces: [parking], routePlaces: [parking, building] });
    render(<RoutePanel />);

    const originSelect = screen.getByLabelText('Điểm xuất phát');
    expect(originSelect).toHaveTextContent('Tòa A1');
    expect(originSelect).not.toHaveTextContent('Bãi giữ xe 2');
    fireEvent.change(originSelect, { target: { value: building.id } });
    expect(actions.setRoutingOrigin).toHaveBeenCalledWith(building);
  });

  it('selecting a place as origin goes through the store', () => {
    const actions = setup();
    render(<RoutePanel />);
    fireEvent.change(screen.getByLabelText('Điểm xuất phát'), { target: { value: 'other' } });
    expect(actions.setRoutingOrigin).toHaveBeenCalledWith(other);
  });

  it('does not offer map-click origin selection and still closes', () => {
    const actions = setup();
    render(<RoutePanel />);
    expect(screen.queryByRole('button', { name: /bản đồ/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Điểm xuất phát')).toHaveTextContent('Căng tin');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chỉ đường' }));
    expect(actions.clearRouting).toHaveBeenCalled();
  });

  it('shows the summary, steps and the off-network warning', () => {
    setup({
      routingFrom: { lat: 1, lng: 2, name: 'Căng tin', placeId: 'other' },
      routingResult: result({ off_network_m: 120 }),
    });
    render(<RoutePanel />);
    expect(screen.getByText('1.5 km')).toBeInTheDocument();
    expect(screen.getByText('17 phút')).toBeInTheDocument();
    expect(screen.getByText('Đi từ A đến B')).toBeInTheDocument();
    expect(screen.getByText(/đi thẳng, chưa có dữ liệu đường/)).toBeInTheDocument();
    expect(screen.getByText(/Gồm khoảng 120 m đi thẳng/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đổi điểm đi và điểm đến' })).toBeEnabled();
  });

  it('marks a straight-line fallback and hides the off-network note', () => {
    setup({
      routingFrom: null,
      routingResult: result({ fallback: true, off_network_m: 500 }),
    });
    render(<RoutePanel />);
    expect(screen.getByText('Đường chim bay')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('không phải tuyến đi bộ đã xác minh');
    expect(screen.queryByText(/Gồm khoảng/)).not.toBeInTheDocument();
    // No origin is selected in this fallback display.
    expect(screen.getByRole('button', { name: 'Đổi điểm đi và điểm đến' })).toBeDisabled();
  });

  it('shows loading and error states in Vietnamese', () => {
    setup({ routingLoading: true, routingError: 'Quá xa' });
    render(<RoutePanel />);
    expect(screen.getByText('Đang tính tuyến đường...')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Quá xa');
    expect(screen.getByText('Thư viện')).toBeInTheDocument();
    expect(screen.getByLabelText('Điểm xuất phát')).toHaveTextContent('Căng tin');
  });

  it('reports a failed route-origin list separately and offers retry', () => {
    const fetchRoutePlaces = vi.fn();
    setup({ routePlacesError: 'offline', fetchRoutePlaces });
    render(<RoutePanel />);

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được danh sách điểm xuất phát.');
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
    expect(fetchRoutePlaces).toHaveBeenCalledOnce();
  });
});
