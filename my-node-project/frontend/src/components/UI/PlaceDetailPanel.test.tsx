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
    expect(within(dialog).queryByText('Mã địa điểm')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Tầng 2')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Cả tòa nhà')).not.toBeInTheDocument();
    const photo = within(dialog).getByAltText('Mặt tiền');
    expect(photo).toHaveAttribute('src', '/uploads/a.png');
    fireEvent.load(photo);
    expect(photo).toBeVisible();
  });

  it('always displays Vietnamese content even when English fields exist', () => {
    render(<PlaceDetailPanel place={full()} onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Tòa A1' })).toBeInTheDocument();
    expect(screen.getByText('Mô tả tiếng Việt')).toBeInTheDocument();
    expect(screen.getByText('Thứ 2 - Thứ 6')).toBeInTheDocument();
    expect(screen.getByText('Đóng cửa')).toBeInTheDocument();
    expect(screen.getByText('120 người')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chỉ đường/ })).toBeInTheDocument();
  });

  it('uses Vietnamese description', () => {
    render(<PlaceDetailPanel place={makePlace({ description_en: null })} onClose={() => undefined} />);
    expect(screen.getByText('Mô tả tiếng Việt')).toBeInTheDocument();
  });

  it('shows the reviewed campus photo for a matched code and preserves aspect-ratio styles', () => {
    render(<PlaceDetailPanel place={makePlace({ code: 'CAMPUS-LIBRARY-A10', images: [] })} onClose={() => undefined} />);
    const photo = screen.getByAltText('Không gian thư viện');
    expect(photo).toHaveAttribute('src', '/place-images/library.jpg');
    expect(photo).toHaveClass('detail__photo');
    fireEvent.load(photo);
    expect(photo).toBeVisible();
    expect(screen.queryByText('Mã địa điểm')).not.toBeInTheDocument();
  });

  it('falls back to the bundled photo after an uploaded image fails', () => {
    render(<PlaceDetailPanel place={{ ...full(), code: 'A1-MAIN' }} onClose={() => undefined} />);
    fireEvent.error(screen.getByAltText('Mặt tiền'));
    const fallback = screen.getByAltText('Khu giảng đường A1–A8');
    expect(fallback).toHaveAttribute('src', '/place-images/buildings-a1-a8.jpg');
    fireEvent.load(fallback);
    expect(fallback).toBeVisible();
  });

  it('shows all valid place-specific uploads without cropping them into fixed thumbnails', () => {
    render(<PlaceDetailPanel place={makePlace({
      images: [
        { url: '/uploads/landscape.jpg', caption: 'Ảnh ngang', is_primary: true },
        { url: '/uploads/portrait.jpg', caption: 'Ảnh dọc' },
      ],
    })} onClose={() => undefined} />);
    const landscape = screen.getByAltText('Ảnh ngang');
    const portrait = screen.getByAltText('Ảnh dọc');
    expect(landscape).toHaveClass('detail__photo');
    expect(portrait).toHaveClass('detail__photo');
    fireEvent.load(landscape);
    fireEvent.load(portrait);
    expect(landscape).toBeVisible();
    expect(portrait).toBeVisible();
  });

  it('shows a Vietnamese no-photo state for unmatched places and failed image candidates', () => {
    const unknown = makePlace({ code: 'UNKNOWN-PLACE', images: [{ url: '/uploads/broken.jpg' }] });
    const { rerender } = render(<PlaceDetailPanel place={unknown} onClose={() => undefined} />);
    fireEvent.error(screen.getByAltText('Tòa A1'));
    expect(screen.getByRole('status')).toHaveTextContent('Chưa có hình ảnh của địa điểm này.');

    rerender(<PlaceDetailPanel place={makePlace({ id: 'no-photo', code: 'UNKNOWN-PLACE', images: [] })} onClose={() => undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent('Chưa có hình ảnh của địa điểm này.');
  });

  it('replaces the previous photo when the selected place changes', () => {
    const { rerender } = render(<PlaceDetailPanel place={makePlace({ code: 'CAMPUS-LIBRARY-A10', images: [] })} onClose={() => undefined} />);
    expect(screen.getByAltText('Không gian thư viện')).toHaveAttribute('src', '/place-images/library.jpg');
    rerender(<PlaceDetailPanel place={makePlace({ id: 'sports-hall', code: 'OSM-W-892574249', images: [] })} onClose={() => undefined} />);
    expect(screen.queryByAltText('Không gian thư viện')).not.toBeInTheDocument();
    expect(screen.getByAltText('Nhà thi đấu')).toHaveAttribute('src', '/place-images/sports-hall.jpg');
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

  it('copies only the public place name', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<PlaceDetailPanel place={makePlace()} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép tên địa điểm' }));
    expect(writeText).toHaveBeenCalledWith('Tòa A1');
  });
});
