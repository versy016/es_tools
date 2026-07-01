// Authenticated app flows. A fake session is seeded into localStorage and every backend
// call is mocked, so the whole signed-in experience is exercised offline — no real login,
// no real data. Gated on env (need the project ref to build the auth storage key).
const { test, expect, authenticate, hasAuthEnv } = require('./fixtures');

test.skip(!hasAuthEnv, 'needs REACT_APP_SUPABASE_URL to seed an authenticated session');

test.describe('as an admin', () => {
    test.beforeEach(async ({ page }) => { await authenticate(page, { role: 'admin' }); });

    test('lands on the dashboard with the tool grid', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
        await expect(page.getByText('Pothole Report Generator')).toBeVisible();
        await expect(page.getByText('Service Location Field Report')).toBeVisible();
    });

    test('the navbar shows the admin-only Users link and navigates the primary sections', async ({ page }) => {
        await page.goto('/dashboard');

        await page.getByRole('link', { name: /^Reports$/i }).click();
        await expect(page).toHaveURL(/\/reports$/);
        await expect(page.getByRole('heading', { name: /^Reports$/i })).toBeVisible();

        // Users link is visible for admins.
        await page.getByRole('link', { name: /^Users$/i }).click();
        await expect(page).toHaveURL(/\/users$/);
        await expect(page.getByRole('heading', { name: /User management/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Audit log/i })).toBeVisible();
    });

    test('the profile button opens the profile screen', async ({ page }) => {
        await page.goto('/dashboard');
        await page.locator('.nav-profile').click();
        await expect(page).toHaveURL(/\/profile$/);
        await expect(page.getByRole('heading', { name: /Profile & signature/i })).toBeVisible();
    });

    test('opening a tool tile routes to that tool', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByText('Pothole Report Generator').click();
        await expect(page).toHaveURL(/\/tools\/photo-report$/);
        // Left the dashboard.
        await expect(page.getByRole('heading', { name: /Your tools/i })).toHaveCount(0);
    });

    test('signs out back to the login screen', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByRole('button', { name: /Sign out/i }).click();
        await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    });

    test('deep-links: /reports renders directly when authenticated', async ({ page }) => {
        await page.goto('/reports');
        await expect(page.getByRole('heading', { name: /^Reports$/i })).toBeVisible();
    });
});

test.describe('RBAC — as a surveyor', () => {
    test.beforeEach(async ({ page }) => { await authenticate(page, { role: 'surveyor' }); });

    test('does not see the Users link', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /^Users$/i })).toHaveCount(0);
    });

    test('is redirected away from /users to the dashboard', async ({ page }) => {
        await page.goto('/users');
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
        // The user-management heading must NOT render.
        await expect(page.getByRole('heading', { name: /User management/i })).toHaveCount(0);
    });
});
