import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeCategory, makePlace } from '../../test/fixtures';
import { useStore } from '../../store/useStore';

const api = vi.hoisted(() => ({ list: vi.fn(), categories: vi.fn() }));
vi.mock('../../services/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/api')>();
  return { ...real, placesApi: { list: api.list }, categoriesApi: { list: api.categories } };
});
// The geometry editor needs a real Leaflet map, which jsdom cannot render
vi.mock('./GeometryEditor', () => ({ GeometryEditor: () => <div data-testid="geo-editor" /> }));

import AdminApp from './AdminApp';

const initial = useStore.getState();
let fetchMock: ReturnType<typeof vi.fn>;

function respond(status: number, body: unknown = {}) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  useStore.setState({ ...initial, lang: 'vi' }, true);
  api.list.mockResolvedValue({ data: [makePlace()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  api.categories.mockResolvedValue([makeCategory()]);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.restoreAllMocks());

async function login(key = 'secret') {
  fireEvent.change(screen.getByLabelText('Khóa quản trị'), { target: { value: key } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

describe('AdminApp', () => {
  it('rejects a wrong key and stays on the login form', async () => {
    fetchMock.mockReturnValue(respond(401, { message: 'Unauthorized' }));
    render(<AdminApp />);
    await login('wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('Khóa không hợp lệ');
    expect(sessionStorage.getItem('webgis.adminKey')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/verify', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'x-admin-key': 'wrong' }) }));
  });

  it('logs in, lists places and edits one', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (url === '/api/auth/verify') return respond(200, { ok: true });
      if (init.method === 'PATCH') return respond(200, makePlace({ name_vi: 'Tòa A1 mới' }));
      return respond(404);
    });
    render(<AdminApp />);
    await login();

    fireEvent.click(await screen.findByRole('button', { name: /Tòa A1/ }));
    expect(screen.getByRole('heading', { name: 'Sửa địa điểm' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tên (tiếng Việt) *')).toHaveValue('Tòa A1');

    fireEvent.change(screen.getByLabelText('Tên (tiếng Việt) *'), { target: { value: 'Tòa A1 mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await screen.findByText('Đã lưu');
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(patch[0]).toBe('/api/places/p-1');
    expect(patch[1].headers['x-admin-key']).toBe('secret');
    expect(JSON.parse(patch[1].body)).toMatchObject({ name_vi: 'Tòa A1 mới', category_id: 1, geom_point: [105.7487, 20.9626] });
  });

  it('validates before sending a new place', async () => {
    fetchMock.mockReturnValue(respond(200, { ok: true }));
    render(<AdminApp />);
    await login();
    fireEvent.click(await screen.findByRole('button', { name: '+ Thêm địa điểm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Cần nhập tên tiếng Việt.')).toBeInTheDocument();
    expect(screen.getByText('Cần chọn danh mục.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the login check
  });

  it('asks for confirmation before deleting', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) =>
      url === '/api/auth/verify' ? respond(200) : init.method === 'DELETE' ? respond(204) : respond(404),
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<AdminApp />);
    await login();
    fireEvent.click(await screen.findByRole('button', { name: /Tòa A1/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Xóa địa điểm' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Xóa địa điểm' }));
    await screen.findByText('Đã xóa');
    expect(confirm).toHaveBeenCalledWith('Xóa "Tòa A1"? Không thể hoàn tác.');
    expect(fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')![0]).toBe('/api/places/p-1');
  });

  it('returns to the login form when the key stops being valid', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) =>
      url === '/api/auth/verify' ? respond(200) : init.method === 'PATCH' ? respond(401, { message: 'no' }) : respond(404),
    );
    render(<AdminApp />);
    await login();
    fireEvent.click(await screen.findByRole('button', { name: /Tòa A1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(screen.getByLabelText('Khóa quản trị')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Khóa không còn hợp lệ');
    expect(sessionStorage.getItem('webgis.adminKey')).toBeNull();
  });

  it('restores a session from sessionStorage', async () => {
    sessionStorage.setItem('webgis.adminKey', 'secret');
    render(<AdminApp />);
    expect(await screen.findByRole('button', { name: /Tòa A1/ })).toBeInTheDocument();
    expect(screen.getByText('Trang 1 / 1')).toBeInTheDocument();
  });
});
