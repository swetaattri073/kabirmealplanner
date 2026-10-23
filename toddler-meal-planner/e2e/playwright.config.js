const { defineConfig, devices } = require('@playwright/test');

// Flask app. Defaults to the local dev server; override for other environments,
// e.g. E2E_BASE_URL=https://littlebowl.in npm test
const flaskURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5000';

// Expo web build of the mobile app, served by Metro via `npm run web` in mobile/.
const expoURL = process.env.E2E_EXPO_URL || 'http://localhost:8081';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  // Accidental .only in CI should fail the run rather than silently skip everything.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'flask',
      testDir: './tests/flask',
      use: { ...devices['Desktop Chrome'], baseURL: flaskURL },
    },
    {
      name: 'expo-web',
      testDir: './tests/expo',
      use: { ...devices['Desktop Chrome'], baseURL: expoURL },
    },
  ],
});
