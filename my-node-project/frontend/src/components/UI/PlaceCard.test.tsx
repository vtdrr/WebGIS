import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { makeCategory, makePlace } from '../../test/fixtures';
import { useStore } from '../../store/useStore';
import { CategoryFilter } from './CategoryFilter';
import { PlaceCard } from './PlaceCard';

const initial = useStore.getState();
beforeEach(() => useStore.setState({ ...initial, lang: 'vi' }, true));

describe('PlaceCard', () => {
  it('shows name, code, category, floor and today\'s opening hours', () => {
    render(
      <PlaceCard
        place={makePlace({ floor: 3, opening_hours: { 'mon-sun': '00:00-24:00' } })}
        onClick={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Tòa A1' })).toBeInTheDocument();
    expect(screen.getByText('Mã: A1')).toBeInTheDocument();
    expect(screen.getByText('Tòa nhà chính')).toBeInTheDocument();
    expect(screen.getByText('Tầng 3')).toBeInTheDocument();
    expect(screen.getByText('Mở: 00:00-24:00')).toBeInTheDocument();
  });

  it('omits optional parts and calls onClick', () => {
    const onClick = vi.fn();
    render(<PlaceCard place={makePlace({ code: null, floor: null, opening_hours: null })} onClick={onClick} selected />);
    expect(screen.queryByText(/Mã:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tầng/)).not.toBeInTheDocument();
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('switches to English names', () => {
    useStore.setState({ lang: 'en' });
    render(<PlaceCard place={makePlace({ floor: 2 })} onClick={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Building A1' })).toBeInTheDocument();
    expect(screen.getByText('Main Building')).toBeInTheDocument();
    expect(screen.getByText('Floor 2')).toBeInTheDocument();
  });
});

describe('CategoryFilter', () => {
  const categories = [makeCategory(), makeCategory({ id: 2, code: 'lab', name_vi: 'Phòng thí nghiệm', name_en: 'Laboratory', color: '#dc2626' })];

  it('lists categories and toggles the filter', () => {
    const setActiveCategoryFilter = vi.fn();
    useStore.setState({ categories, setActiveCategoryFilter });
    render(<CategoryFilter />);
    fireEvent.click(screen.getByLabelText('Phòng thí nghiệm'));
    expect(setActiveCategoryFilter).toHaveBeenCalledWith('lab');
  });

  it('clicking the active category clears it, and "clear" is offered', () => {
    const setActiveCategoryFilter = vi.fn();
    useStore.setState({ categories, activeCategoryFilter: 'lab', setActiveCategoryFilter });
    render(<CategoryFilter />);
    expect(screen.getByLabelText('Phòng thí nghiệm')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Phòng thí nghiệm'));
    expect(setActiveCategoryFilter).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ lọc' }));
    expect(setActiveCategoryFilter).toHaveBeenLastCalledWith(null);
  });
});
