import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { makePlace } from '../../test/fixtures';
import { useStore } from '../../store/useStore';
import { SearchBar } from './SearchBar';

const initial = useStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useStore.setState({ ...initial, lang: 'vi', searchPlaces: vi.fn().mockResolvedValue(undefined), clearSearch: vi.fn() }, true);
});
afterEach(() => vi.useRealTimers());

const type = (value: string) => fireEvent.change(screen.getByRole('combobox'), { target: { value } });

describe('SearchBar', () => {
  it('debounces: searches once, 300 ms after the last keystroke', () => {
    const searchPlaces = useStore.getState().searchPlaces as ReturnType<typeof vi.fn>;
    render(<SearchBar onSelect={() => undefined} />);
    type('t');
    act(() => void vi.advanceTimersByTime(200));
    type('th');
    act(() => void vi.advanceTimersByTime(200));
    expect(searchPlaces).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(100));
    expect(searchPlaces).toHaveBeenCalledTimes(1);
    expect(searchPlaces).toHaveBeenCalledWith('th');
  });

  it('shows results and reports the chosen place', () => {
    const onSelect = vi.fn();
    const place = makePlace({ name_vi: 'Thư viện', code: 'LIB' });
    useStore.setState({ searchResults: [place] });
    render(<SearchBar onSelect={onSelect} />);
    type('thu');
    act(() => void vi.advanceTimersByTime(300));

    const option = screen.getByRole('option', { name: /Thư viện/ });
    expect(option).toHaveTextContent('Mã: LIB');
    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith(place);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows a no-results message', () => {
    useStore.setState({ searchResults: [], searchLoading: false });
    render(<SearchBar onSelect={() => undefined} />);
    type('zzz');
    act(() => void vi.advanceTimersByTime(300));
    expect(screen.getByText('Không tìm thấy kết quả cho "zzz"')).toBeInTheDocument();
  });

  it('uses English names and texts in English mode', () => {
    useStore.setState({ lang: 'en', searchResults: [makePlace({ name_vi: 'Thư viện', name_en: 'Library' })] });
    render(<SearchBar onSelect={() => undefined} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'Search buildings, classrooms, library...');
    type('lib');
    act(() => void vi.advanceTimersByTime(300));
    expect(screen.getByRole('option')).toHaveTextContent('Library');
  });

  it('clears the input and the search with the clear button', () => {
    const clearSearch = useStore.getState().clearSearch as ReturnType<typeof vi.fn>;
    render(<SearchBar onSelect={() => undefined} />);
    type('abc');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(clearSearch).toHaveBeenCalled();
  });

  it('closes the results with Escape', () => {
    useStore.setState({ searchResults: [makePlace()] });
    render(<SearchBar onSelect={() => undefined} />);
    type('a');
    act(() => void vi.advanceTimersByTime(300));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
