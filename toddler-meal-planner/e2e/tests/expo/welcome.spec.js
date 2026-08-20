const { expect, test } = require('@playwright/test');

// Metro compiles the web bundle on demand, so a cold start costs minutes.
test.beforeEach(async ({}, testInfo) => {
  testInfo.setTimeout(180_000);
});

const FIRST_PAINT = { timeout: 150_000 };

test.describe('expo web app', () => {
  test('root redirects to the welcome screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Continue as guest')).toBeVisible(FIRST_PAINT);
    expect(new URL(page.url()).pathname).toBe('/welcome');
  });

  // Deliberately does not click through: the web build talks to the production
  // API, and "Continue as guest" would create a real profile there.
  test('welcome screen offers all three entry points', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByText('Create account')).toBeVisible(FIRST_PAINT);
    await expect(page.getByText('Continue as guest')).toBeVisible();
    // react-native-web renders Pressable as a div, so match on text, and
    // "Sign in" appears both in the header and as a button.
    await expect(page.getByText('Sign in', { exact: true }).first()).toBeVisible();
  });

  test('sign in screen renders its form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible(FIRST_PAINT);
    await expect(page.getByPlaceholder('Your password')).toBeVisible();
  });

  test('register screen renders its form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByPlaceholder('Your name')).toBeVisible(FIRST_PAINT);
    await expect(page.getByPlaceholder('At least 8 characters')).toBeVisible();
  });
});
