import { expect, test } from '@playwright/test';

// Uses a throw-away place with a unique code and deletes it at the end.
// Playwright config requires E2E_ADMIN_KEY to match the isolated server key.
const KEY = process.env.E2E_ADMIN_KEY!;

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
  await page.getByLabel('Mã', { exact: true }).fill(code);
  await page.getByLabel('Danh mục *').selectOption({ label: 'Phòng học/Giảng đường' });
  await page.getByLabel('Vĩ độ').fill('20.9626');
  await page.getByLabel('Kinh độ').fill('105.7487');

  // Draw a valid footprint using the Leaflet map rather than changing the design for E2E.
  const geometryMap = page.locator('.geo-editor__map');
  await page.getByRole('button', { name: 'Vẽ vùng' }).click();
  await geometryMap.scrollIntoViewIfNeeded();
  const initialMapBounds = await geometryMap.boundingBox();
  if (!initialMapBounds) throw new Error('Geometry editor map is not visible');
  for (const point of [{ x: 90, y: 100 }, { x: 210, y: 100 }, { x: 150, y: 220 }]) {
    await geometryMap.click({ position: point });
  }
  await expect(geometryMap.locator('.vertex-marker')).toHaveCount(3);

  const upload = page.getByLabel('Tải ảnh lên');
  await upload.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByRole('alert')).toContainText('Only valid PNG, JPEG, and WebP images are supported');
  await upload.setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXcAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.locator('.editor__images img').first()).toHaveAttribute('src', /^\/uploads\//);
  await expect(page.locator('.editor__images img').first()).toHaveJSProperty('naturalWidth', 1);
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Đã lưu')).toBeVisible();

  // it is searchable in the list and in the public API
  await page.getByPlaceholder('Tìm theo tên hoặc mã...').fill(code);
  await expect(page.getByRole('button', { name: new RegExp(code) })).toBeVisible();
  const api = await page.request.get(`/api/places/search?q=${code}`);
  const created = (await api.json()).data;
  expect(created).toHaveLength(1);
  expect(created[0].images).toHaveLength(1);
  const createdRing = created[0].geom_polygon.coordinates[0] as [number, number][];
  expect(createdRing).toHaveLength(4);
  expect(createdRing[0]).toEqual(createdRing.at(-1));
  const servedImage = await page.request.get(created[0].images[0].url);
  expect(servedImage.status()).toBe(200);
  expect(servedImage.headers()['content-type']).toBe('image/png');

  // Reload the record and verify its footprint is rebuilt in the geometry editor.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quản trị địa điểm' })).toBeVisible();
  await page.getByPlaceholder('Tìm theo tên hoặc mã...').fill(code);
  await page.getByRole('button', { name: new RegExp(code) }).click();
  const vertices = page.locator('.geo-editor__map .vertex-marker');
  await expect(vertices).toHaveCount(3);

  // Edit a saved polygon vertex by dragging the Leaflet marker.
  await vertices.first().scrollIntoViewIfNeeded();
  const vertexBounds = await vertices.first().boundingBox();
  if (!vertexBounds) throw new Error('Saved polygon vertex is not visible');
  const vertexCenter = {
    x: vertexBounds.x + vertexBounds.width / 2,
    y: vertexBounds.y + vertexBounds.height / 2,
  };
  await page.mouse.move(vertexCenter.x, vertexCenter.y);
  await page.mouse.down();
  await page.mouse.move(vertexCenter.x + 18, vertexCenter.y + 14, { steps: 5 });
  await page.mouse.up();

  await page.getByLabel('Tên (tiếng Việt) *').fill('Phòng E2E đã sửa');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Đã lưu')).toBeVisible();
  await expect(page.getByRole('button', { name: /Phòng E2E đã sửa/ })).toBeVisible();
  const editedResponse = await page.request.get(`/api/places/search?q=${code}`);
  const edited = (await editedResponse.json()).data[0];
  expect(edited.geom_polygon.coordinates[0]).not.toEqual(createdRing);

  // A self-intersecting polygon passes client shape checks but must be rejected by PostGIS.
  await page.getByRole('button', { name: 'Vẽ vùng' }).click();
  await page.getByRole('button', { name: 'Xóa vùng' }).click();
  const invalidPolygonMap = page.locator('.geo-editor__map');
  await invalidPolygonMap.scrollIntoViewIfNeeded();
  for (const point of [{ x: 100, y: 100 }, { x: 220, y: 220 }, { x: 100, y: 220 }, { x: 180, y: 100 }]) {
    await invalidPolygonMap.click({ position: point });
  }
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByRole('alert')).toContainText('Self-intersection');
  const afterRejectedEdit = await page.request.get(`/api/places/${created[0].id}`);
  expect((await afterRejectedEdit.json()).geom_polygon.coordinates[0]).toEqual(edited.geom_polygon.coordinates[0]);

  // Reload restores the saved valid polygon; a later unsaved vertex is discarded on navigation.
  await page.reload();
  await page.getByPlaceholder('Tìm theo tên hoặc mã...').fill(code);
  await page.getByRole('button', { name: new RegExp(code) }).click();
  await expect(page.locator('.geo-editor__map .vertex-marker')).toHaveCount(3);

  // A new unsaved vertex is discarded when leaving and reopening the editor.
  await page.getByRole('button', { name: 'Vẽ vùng' }).click();
  const currentMapBounds = await geometryMap.boundingBox();
  if (!currentMapBounds) throw new Error('Geometry editor map is not visible');
  await geometryMap.click({ position: { x: 300, y: 260 } });
  await expect(vertices).toHaveCount(4);
  await page.getByRole('link', { name: 'Về bản đồ' }).click();
  await page.goto('/#/admin');
  await expect(page.getByRole('heading', { name: 'Quản trị địa điểm' })).toBeVisible();
  await page.getByPlaceholder('Tìm theo tên hoặc mã...').fill(code);
  await page.getByRole('button', { name: new RegExp(code) }).click();
  await expect(page.locator('.geo-editor__map .vertex-marker')).toHaveCount(3);
  const persistedResponse = await page.request.get(`/api/places/search?q=${code}`);
  expect((await persistedResponse.json()).data[0].geom_polygon.coordinates[0]).toEqual(edited.geom_polygon.coordinates[0]);

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
