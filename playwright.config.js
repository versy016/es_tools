// Playwright config for the ES Tools site-wide (E2E) smoke tests.
//
// These run the real app in a real browser but INTERCEPT every Supabase request
// (see e2e/*.spec.js), so an E2E run cannot create/read/delete real reports —
// it can never leave test records in the database.
//
// One-time setup (not installed by default to keep the main install light):
//   npm run e2e:install     # adds @playwright/test + downloads Chromium
// Then:
//   npm run e2e             # headless
//   npm run e2e:ui          # interactive
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    expect: { timeout: 10_000 },
    fullyParallel: true,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    // Boot the CRA dev server for the test run (reused if already running locally).
    webServer: {
        command: 'npm start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { BROWSER: 'none' },
    },
});
