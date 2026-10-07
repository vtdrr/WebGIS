import { expect, test } from '@playwright/test';

// Uses a throw-away place with a unique code and deletes it at the end.
// If the backend has ADMIN_API_KEY set, pass it as E2E_ADMIN_KEY.
const KEY = process.env.E2E_ADMIN_KEY ?? 'any-key-works-when-the-server-has-none';

test('admin can create, edit and delete a place', async ({ page }) => {
  const code = `E2E-${Date.now()}`;
  page.on('dialog', (d) => d.accept());

  await page.goto('/#/admin');
  await page.getByLabel('Khóa quản trị').fill(KEY);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Quản trị địa điểm' })).toBeVisible();

  // validation first
  await page.getByRole('button', { name: '+ Thêm địa điểm' }).click();
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Cần nhập tên tiếng Việt.')).toBeVisible();

  // create
  await page.getByLabel('Tên (tiếng Việt) *').fill('Phòng thử nghiệm E2E');
  await page.getByLabel('Tên (English)').fill('E2E test room');
  await page.getByLabel('Mã', { exact: true }).fill(code);
  await page.getByLabel('Danh mục *').selectOption({ label: 'Phòng học/Giảng đường' });
  await page.getByLabel('Vĩ độ').fill('20.9626');
  await page.getByLabel('Kinh độ').fill('105.7487');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Đã lưu')).toBeVisible();

  // it is searchable in the list and in the public API
  await page.getByPlaceholder('Tìm theo tên hoặc mã...').fill(code);
  await expect(page.getByRole('button', { name: new RegExp(code) })).toBeVisible();
  const api = await page.request.get(`/api/places/search?q=${code}`);
  expect((await api.json()).data).toHaveLength(1);

  // edit
  await page.getByRole('button', { name: new RegExp(code) }).click();
  await page.getByLabel('Tên (tiếng Việt) *').fill('Phòng E2E đã sửa');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Đã lưu')).toBeVisible();
  await expect(page.getByRole('button', { name: /Phòng E2E đã sửa/ })).toBeVisible();

  // delete
  await page.getByRole('button', { name: 'Xóa địa điểm' }).click();
  await expect(page.getByText('Đã xóa')).toBeVisible();
  const gone = await page.request.get(`/api/places/search?q=${code}`);
  expect((await gone.json()).data).toHaveLength(0);
});

test('a wrong key is rejected when the server requires one', async ({ page }) => {
  const required = await page.request.post('/api/auth/verify', { headers: { 'x-admin-key': 'definitely-wrong' } });
  test.skip(required.status() !== 401, 'server has no ADMIN_API_KEY configured');
  await page.goto('/#/admin');
  await page.getByLabel('Khóa quản trị').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('alert')).toContainText('Khóa không hợp lệ');
});
