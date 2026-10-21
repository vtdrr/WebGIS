import { expect, test } from '@playwright/test';

const CONTROL_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 375, height: 667 },
];

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function currentTileZoom(page: import('@playwright/test').Page): Promise<number | null> {
  return page.locator('.leaflet-tile').evaluateAll((tiles) => {
    const levels = tiles.flatMap((tile) => {
      const match = (tile as HTMLImageElement).src.match(/\/(\d+)\/\d+\/\d+\.\w+(?:\?|$)/);
      return match ? [Number(match[1])] : [];
    });
    return levels.length ? Math.max(...levels) : null;
  });
}

test.describe('map', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.place-card').first()).toBeVisible();
  });

  test('lists places and opens / closes the detail panel', async ({ page }) => {
    await page.locator('.place-card').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Mã địa điểm')).toHaveCount(0);
    await expect(dialog.locator('.detail__item-label').filter({ hasText: 'Tầng' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(dialog).toBeHidden();
  });

  test('shows the library photograph without public OSM code or floor metadata', async ({ page }) => {
    await page.getByRole('combobox').fill('thu vien');
    await page.getByRole('option', { name: /Thư viện/ }).click();

    const dialog = page.getByRole('dialog', { name: /Thư viện/ });
    const photo = dialog.locator('img.detail__photo').first();
    await expect(photo).toHaveAttribute('src', '/place-images/library.jpg');
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(dialog.getByText('Mã địa điểm')).toHaveCount(0);
    await expect(dialog.getByText('LIB-MAIN')).toHaveCount(0);
    await expect(dialog.locator('.detail__item-label').filter({ hasText: 'Tầng' })).toHaveCount(0);
    const overflow = await dialog.locator('.detail__content').evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(overflow).toBe(false);
  });

  test('keeps the photograph inside the tablet detail panel and leaves content scrollable', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 900 });
    await page.getByRole('combobox').fill('thu vien');
    await page.getByRole('option', { name: /Thư viện/ }).click();

    const dialog = page.getByRole('dialog', { name: /Thư viện/ });
    const photo = dialog.locator('img.detail__photo').first();
    await expect(photo).toHaveAttribute('src', '/place-images/library.jpg');
    await expect(photo).toBeVisible();
    const sizing = await dialog.evaluate((element) => {
      const content = element.querySelector<HTMLElement>('.detail__content')!;
      const image = element.querySelector<HTMLImageElement>('img.detail__photo')!;
      return {
        overflows: content.scrollWidth > content.clientWidth,
        imageWidth: image.getBoundingClientRect().width,
        contentWidth: content.clientWidth,
        contentOverflowY: getComputedStyle(content).overflowY,
      };
    });
    expect(sizing.overflows).toBe(false);
    expect(sizing.imageWidth).toBeLessThanOrEqual(sizing.contentWidth);
    expect(sizing.contentOverflowY).toBe('auto');
  });

  test('search ignores accents, and picking a result opens the place', async ({ page }) => {
    await page.getByRole('combobox').fill('thu vien');
    const option = page.getByRole('option', { name: /Thư viện/ });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page.getByRole('dialog', { name: /Thư viện/ })).toBeVisible();
    // the search box is cleared after a selection
    await expect(page.getByRole('combobox')).toHaveValue('');
  });

  test('category filter narrows the list', async ({ page }) => {
    const before = await page.locator('.place-card').count();
    await page.getByLabel('Thư viện', { exact: true }).check();
    await expect(page.locator('.place-card')).toHaveCount(1);
    expect(before).toBeGreaterThan(1);
    await page.getByRole('button', { name: 'Bỏ lọc' }).click();
    await expect(page.locator('.place-card')).toHaveCount(before);
  });

  test('directions between two places', async ({ page }) => {
    await page.getByRole('combobox').fill('thu vien');
    await page.getByRole('option', { name: /Thư viện/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Chỉ đường' }).click();

    const panel = page.getByRole('region', { name: 'Chỉ đường' });
    await expect(panel).toBeVisible();
    // Choose an actual place from the origin list; arbitrary map clicks do not set the origin.
    const originSelect = panel.getByRole('combobox', { name: 'Điểm xuất phát' });
    await expect(originSelect).toHaveValue('');
    const routeRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/routing?')) routeRequests.push(request.url());
    });
    const map = page.locator('.leaflet-container');
    const mapBox = await map.boundingBox();
    expect(mapBox).not.toBeNull();
    await map.click({ position: { x: mapBox!.width * 0.35, y: mapBox!.height * 0.55 } });
    await expect(originSelect).toHaveValue('');
    expect(routeRequests).toHaveLength(0);
    await expect(page.getByRole('status').filter({ hasText: 'Bấm vào bản đồ' })).toHaveCount(0);

    const routeResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/routing?') && response.request().method() === 'GET',
    );
    await originSelect.selectOption({ label: 'Cổng Nam (cổng chính)' });
    const routeResponse = await routeResponsePromise;
    expect(routeResponse.status()).toBe(200);
    const routeResult = await routeResponse.json() as {
      routes: Array<{ geometry: { coordinates: Array<[number, number]> } }>;
      meta: { mode: string; fallback: boolean };
    };
    expect(routeResult.meta.mode).toBe('walk');
    expect(routeResult.meta.fallback).toBe(false);
    expect(routeResult.routes[0].geometry.coordinates.length).toBeGreaterThan(2);
    await expect(panel.getByText('Quãng đường')).toBeVisible();
    await expect(panel.getByText('Thời gian')).toBeVisible();

    await expect(panel.getByText('Đi bộ')).toBeVisible();
    await expect(panel.getByText('Xe đạp')).toHaveCount(0);
    await expect(panel.getByText('Xe lăn')).toHaveCount(0);
    await expect(panel.getByText('Quãng đường')).toBeVisible();

    await panel.getByRole('button', { name: 'Đóng chỉ đường' }).click();
    await expect(panel).toBeHidden();
  });

  test('remains Vietnamese despite an old English language preference', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Phenikaa WebGIS' })).toBeVisible();
    const sidebar = page.getByRole('complementary', { name: 'Bản đồ khuôn viên trường' });
    await expect(sidebar.getByText('Bản đồ khuôn viên trường')).toBeVisible();
    await page.evaluate(() => localStorage.setItem('webgis.lang', 'en'));
    await page.reload();
    await expect(page.getByRole('complementary', { name: 'Bản đồ khuôn viên trường' }).getByText('Bản đồ khuôn viên trường')).toBeVisible();
    await expect(page.getByPlaceholder('Tìm kiếm tòa nhà, phòng học, thư viện...')).toBeVisible();
  });

  test('opens the non-georeferenced campus conference schematic as a reference', async ({ page }) => {
    await page.getByRole('button', { name: 'Xem sơ đồ trường tham khảo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sơ đồ trường tham khảo' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('không theo tỷ lệ tọa độ')).toBeVisible();
    await expect(dialog.getByRole('img', { name: /Sơ đồ Trường Đại học Phenikaa/ })).toHaveAttribute('src', '/phenikaa-event-schematic.jpg');
    await dialog.getByRole('button', { name: 'Đóng sơ đồ' }).click();
    await expect(dialog).toBeHidden();
  });

});

test('does not access browser geolocation during normal map use', async ({ page }) => {
  await page.addInitScript(() => {
    const probe = window as Window & { __geoPropertyReads?: number; __geoRequests?: number };
    probe.__geoPropertyReads = 0;
    probe.__geoRequests = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      get: () => {
        probe.__geoPropertyReads!++;
        return {
          getCurrentPosition: () => { probe.__geoRequests!++; },
          watchPosition: () => { probe.__geoRequests!++; return 1; },
          clearWatch: () => undefined,
        };
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.place-card').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vị trí của tôi' })).toHaveCount(0);
  const accesses = await page.evaluate(() => ({
    reads: (window as Window & { __geoPropertyReads?: number }).__geoPropertyReads,
    requests: (window as Window & { __geoRequests?: number }).__geoRequests,
  }));
  expect(accesses).toEqual({ reads: 0, requests: 0 });
});

test.describe('responsive Leaflet map controls', () => {
  for (const viewport of CONTROL_VIEWPORTS) {
    test(`zooms, pans and keeps controls separate at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const sidebar = page.getByRole('complementary', { name: 'Bản đồ khuôn viên trường' });
      if (viewport.width <= 768) {
        await page.getByRole('button', { name: 'Mở danh sách địa điểm' }).click();
        await expect(sidebar).toBeInViewport();
      }
      await expect(page.locator('.place-card').first()).toBeVisible();
      if (viewport.width <= 768) {
        await page.locator('.place-card').first().click();
        const initialDetail = page.getByRole('dialog');
        await expect(initialDetail).toBeVisible();
        await initialDetail.getByRole('button', { name: 'Đóng' }).click();
        await expect(sidebar).not.toBeInViewport();
      }

      const map = page.locator('.leaflet-container');
      const mapControls = page.locator('.map-control-group');
      const zoomIn = page.locator('.leaflet-control-zoom-in');
      const zoomOut = page.locator('.leaflet-control-zoom-out');
      const zoomControl = page.locator('.leaflet-control-zoom');
      const referenceButton = page.getByRole('button', { name: 'Xem sơ đồ trường tham khảo' });
      const layersButton = page.getByRole('button', { name: 'Layers' });
      const layersControl = page.locator('.leaflet-control-layers');
      await expect(zoomIn).toBeVisible();
      await expect(zoomOut).toBeVisible();
      await expect(referenceButton).toBeVisible();
      await expect(page.getByRole('button', { name: 'Vị trí của tôi' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Khôi phục bản đồ' })).toBeVisible();
      await expect(layersButton).toBeVisible();
      await expect(layersControl).toBeVisible();

      const controlBoxes = await page.locator(
        '.leaflet-control-zoom-in, .leaflet-control-zoom-out, .map-control-group__buttons button:visible',
      ).evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }));
      expect(controlBoxes.length).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < controlBoxes.length; i++) {
        for (let j = i + 1; j < controlBoxes.length; j++) {
          expect(boxesOverlap(controlBoxes[i], controlBoxes[j])).toBe(false);
        }
      }
      const zoomControlBox = await zoomControl.boundingBox();
      const layersControlBox = await layersControl.boundingBox();
      const toolbarBoxBefore = await mapControls.boundingBox();
      const identityBox = await page.locator('.map-identity').boundingBox();
      expect(zoomControlBox).not.toBeNull();
      expect(layersControlBox).not.toBeNull();
      expect(toolbarBoxBefore).not.toBeNull();
      expect(identityBox).not.toBeNull();
      expect(boxesOverlap(zoomControlBox!, toolbarBoxBefore!)).toBe(false);
      expect(boxesOverlap(layersControlBox!, toolbarBoxBefore!)).toBe(false);
      expect(boxesOverlap(zoomControlBox!, identityBox!)).toBe(false);
      expect(boxesOverlap(toolbarBoxBefore!, identityBox!)).toBe(false);
      expect(boxesOverlap(layersControlBox!, identityBox!)).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await layersButton.focus();
      await page.keyboard.press('Enter');
      const layersList = page.locator('.leaflet-control-layers-list');
      await expect(layersList).toBeVisible();
      const layersListBox = await layersList.boundingBox();
      expect(layersListBox).not.toBeNull();
      expect(boxesOverlap(layersListBox!, toolbarBoxBefore!)).toBe(false);
      expect(boxesOverlap(layersListBox!, zoomControlBox!)).toBe(false);

      await page.getByRole('button', { name: 'Khôi phục bản đồ' }).click();
      const mapPane = map.locator('.leaflet-map-pane');
      await expect.poll(() => currentTileZoom(page)).toBe(17);
      await expect(mapPane).not.toHaveClass(/leaflet-zoom-anim/);
      await expect.poll(() => currentTileZoom(page)).not.toBeNull();
      const startingZoom = await currentTileZoom(page);
      if (startingZoom === null) throw new Error('Map tiles do not expose a zoom level');
      await zoomIn.click();
      await expect.poll(() => currentTileZoom(page)).toBe(startingZoom + 1);
      await expect(mapPane).not.toHaveClass(/leaflet-zoom-anim/);
      await zoomOut.click();
      await expect(mapPane).not.toHaveClass(/leaflet-zoom-anim/);
      await expect.poll(() => currentTileZoom(page)).toBe(startingZoom);

      await referenceButton.click();
      const referenceDialog = page.getByRole('dialog', { name: 'Sơ đồ trường tham khảo' });
      await expect(referenceDialog).toBeVisible();
      await referenceDialog.getByRole('button', { name: 'Đóng sơ đồ' }).click();
      await expect(referenceDialog).toBeHidden();

      if (viewport.width <= 768) {
        await expect(page.getByRole('button', { name: 'Mở danh sách địa điểm' })).toBeVisible();
        await page.getByRole('button', { name: 'Mở danh sách địa điểm' }).click();
        await expect(sidebar).toBeInViewport();
      }
      await sidebar.locator('.place-card').first().click();
      const detail = page.getByRole('dialog');
      await expect(detail).toBeVisible();
      await detail.getByRole('button', { name: 'Chỉ đường' }).click();
      const routePanel = page.getByRole('region', { name: 'Chỉ đường' });
      await expect(routePanel).toBeVisible();

      const toolbarBox = await mapControls.boundingBox();
      const routeBox = await routePanel.boundingBox();
      expect(toolbarBox).not.toBeNull();
      expect(routeBox).not.toBeNull();
      expect(boxesOverlap(toolbarBox!, routeBox!)).toBe(false);
      const zoomBox = await zoomControl.boundingBox();
      expect(zoomBox).not.toBeNull();
      expect(boxesOverlap(zoomBox!, routeBox!)).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      const mapBox = await map.boundingBox();
      if (!mapBox) throw new Error('Map container is not visible');
      const beforePan = await map.locator('.leaflet-map-pane').evaluate((element) => getComputedStyle(element).transform);
      const start = { x: mapBox.x + mapBox.width * 0.55, y: mapBox.y + mapBox.height * 0.35 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 34, start.y + 22, { steps: 4 });
      await page.mouse.up();
      await expect.poll(() => map.locator('.leaflet-map-pane').evaluate((element) => getComputedStyle(element).transform))
        .not.toBe(beforePan);
    });
  }
});

test.describe('narrow screen', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('the place list is a drawer that closes after choosing a place', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.getByRole('complementary', { name: 'Bản đồ khuôn viên trường' });
    await expect(sidebar).not.toBeInViewport();

    await page.getByRole('button', { name: 'Mở danh sách địa điểm' }).click();
    await expect(sidebar).toBeInViewport();
    await page.locator('.place-card').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect(await dialog.locator('.detail__content').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
    await expect(sidebar).not.toBeInViewport();
  });
});
