const { test, expect } = require('@playwright/test');

test('loads players from the API and renders them', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
  await expect(page.locator('li')).not.toHaveCount(0);
});

test('search filters the visible list', async ({ page }) => {
  await page.goto('/index.html');
  const items = page.locator('li');
  await expect(items).not.toHaveCount(0);
  const totalCount = await items.count();

  await page.getByPlaceholder('search').fill('lebron');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('LeBron James');

  await page.getByPlaceholder('search').fill('');
  await expect(items).toHaveCount(totalCount);
});

test('health endpoint reports ok', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('ok');
  expect(typeof body.playerCount).toBe('number');
});
