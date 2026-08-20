const { expect, test } = require('@playwright/test');

test.describe('public pages', () => {
  test('landing page loads', async ({ page }) => {
    const response = await page.goto('/');
    expect(response.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/LittleBowl/i);
  });

  test('sign in page renders its form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('unknown route returns the 404 page', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-real-page');
    expect(response.status()).toBe(404);
  });
});
