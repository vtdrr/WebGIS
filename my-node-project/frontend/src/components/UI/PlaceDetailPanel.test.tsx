import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { makePlace } from '../../test/fixtures';
import { useStore } from '../../store/useStore';
import { PlaceDetailPanel } from './PlaceDetailPanel';

const initial = useStore.getState();
beforeEach(() => useStore.setState({ ...initial, lang: 'vi' }, true));

const full = () =>
  makePlace({
    floor: 2,
    contact_phone: '024 1234',
    contact_email: 'a1@phenikaa-uni.edu.vn',
    opening_hours: { 'mon-fri': '07:00-22:00', sat: '08:00-17:00', sun: 'closed', 'mon-sun': '00:00-24:00' },
    attributes: { has_wifi: true, has_ac: false, wheelchair_access: true, capacity: 120, has_garden: true },
    images: [{ url: '/uploads/a.png', caption: 'Mặt tiền' }],
  });

describe('PlaceDetailPanel', () => {
  it('renders nothing without a place', () => {
    const { container } = render(<PlaceDetailPanel place={null} onClose={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows all the details (Vietnamese)', () => {
    render(<PlaceDetailPanel place={full()} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'Tòa A1' });
    expect(within(dialog).getByText('Mô tả tiếng Việt')).toBeInTheDocument();
    expect(within(dialog).getByText('Tầng 2')).toBeInTheDocument();
    expect(within(dialog).getByText('024 1234')).toBeInTheDocument();
    expect(within(dialog).getByText('120 người')).toBeInTheDocument();
    expect(within(dialog).getByText('Thứ 2 - Thứ 6')).toBeInTheDocument();
    expect(within(dialog).getByText('Hằng ngày')).toBeInTheDocument();
    expect(within(dialog).getByText('Đóng cửa')).toBeInTheDocument();
    expect(within(dialog).getByText('WiFi')).toBeInTheDocument();
    expect(within(dialog).getByText('Tiếp cận xe lăn')).toBeInTheDocument();
    // unknown boolean attributes are prettified, false ones are not shown
    expect(within(dialog).getByText('Garden')).toBeInTheDocument();
    expect(within(dialog).queryByText('Điều hòa')).not.toBeInTheDocument();
    expect(within(dialog).getByAltText('Mặt tiền')).toHaveAttribute('src', '/uploads/a.png');
  });

  it('is fully translated in English', () => {
    useStore.setState({ lang: 'en' });
    render(<PlaceDetailPanel place={full()} onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Building A1' })).toBeInTheDocument();
    expect(screen.getByText('English description')).toBeInTheDocument();
    expect(screen.getByText('Mon - Fri')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('120 people')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Directions/ })).toBeInTheDocument();
  });

  it('falls back to Vietnamese text when the English field is empty', () => {
    useStore.setState({ lang: 'en' });
    render(<PlaceDetailPanel place={makePlace({ description_en: null })} onClose={() => undefined} />);
    expect(screen.getByText('Mô tả tiếng Việt')).toBeInTheDocument();
  });

  it('shows "whole building" when there is no floor', () => {
    render(<PlaceDetailPanel place={makePlace({ floor: null })} onClose={() => undefined} />);
    expect(screen.getByText('Cả tòa nhà')).toBeInTheDocument();
  });

  it('wires the close button, Escape and the directions button', () => {
    const onClose = vi.fn();
    const onDirections = vi.fn();
    render(<PlaceDetailPanel place={makePlace()} onClose={onClose} onDirections={onDirections} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chỉ đường' }));
    expect(onDirections).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('copies name and code', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<PlaceDetailPanel place={makePlace()} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép tên và mã' }));
    expect(writeText).toHaveBeenCalledWith('Tòa A1 - A1');
  });
});
