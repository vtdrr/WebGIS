import { expect, test } from '@playwright/test';

test.describe('map', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.place-card').first()).toBeVisible();
  });

  test('lists places and opens / closes the detail panel', async ({ page }) => {
    await page.locator('.place-card').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Mã địa điểm')).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(dialog).toBeHidden();
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
    // no GPS in the test browser: the app asks to pick the origin
    await expect(page.getByRole('status').filter({ hasText: 'Bấm vào bản đồ' })).toBeVisible();

    await panel.getByRole('combobox', { name: 'Điểm xuất phát' }).selectOption({ label: 'Cổng Nam (cổng chính)' });
    await expect(panel.getByText('Quãng đường')).toBeVisible();
    await expect(panel.getByText('Thời gian')).toBeVisible();

    await panel.getByRole('button', { name: /Xe đạp/ }).click();
    await expect(panel.getByRole('button', { name: /Xe đạp/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByText('Quãng đường')).toBeVisible();

    await panel.getByRole('button', { name: 'Đóng chỉ đường' }).click();
    await expect(panel).toBeHidden();
  });

  test('language switch translates the UI and is remembered', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Phenikaa WebGIS' })).toBeVisible();
    await expect(page.getByText('Bản đồ khuôn viên trường')).toBeVisible();
    await page.getByRole('button', { name: 'Chuyển sang English' }).click();
    await expect(page.getByText('Campus map')).toBeVisible();
    await expect(page.getByPlaceholder('Search buildings, classrooms, library...')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Campus map')).toBeVisible();
  });
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
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(sidebar).not.toBeInViewport();
  });
});
