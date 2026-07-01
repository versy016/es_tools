// Site-wide smoke tests. The whole point of the beforeEach route-block below is that
// EVERY call to Supabase (auth, REST, storage, edge functions) is intercepted and
// answered locally — so these tests exercise the real UI in a real browser WITHOUT
// ever touching the backend. No sign-in happens, no report is created, nothing is
// written: the run cannot leave test records behind.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    // Stub anything going to a *.supabase.co host (project API + edge functions).
    await page.route(/https?:\/\/[^/]*supabase\.co\/.*/i, (route) => {
        const url = route.request().url();
        // No active session for auth calls; empty arrays for data reads; ok for the rest.
        if (url.includes('/auth/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: null, user: null }) });
        if (url.includes('/rest/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    // Belt-and-braces: also block Google Maps / Algolia so a smoke run is fully offline.
    await page.route(/https?:\/\/[^/]*(googleapis|gstatic|algolia)\.[^/]*\/.*/i, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
});

test('app boots to the sign-in screen with no uncaught runtime errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');

    // The login split-screen headline is stable copy on the unauthenticated screen.
    await expect(page.getByRole('heading', { name: /Every field tool/i })).toBeVisible();
    await expect(page.getByPlaceholder(/@engsurveys\.com\.au/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();

    expect(errors, `Uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the sign-in form validates a required email before submitting', async ({ page }) => {
    await page.goto('/');
    // Submitting empty should not navigate away (HTML5 required on the email field).
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
});
