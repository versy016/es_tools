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

    test('invite uses a branded dialog (not a native prompt) with inline validation', async ({ page }) => {
        await page.goto('/users');
        await page.getByRole('button', { name: /Invite user/i }).click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // A bad email is rejected inline (dialog stays open).
        await page.getByPlaceholder('Dave Mitchell').fill('New Hire');
        await page.getByPlaceholder('name@engsurveys.com.au').fill('not-an-email');
        await dialog.getByRole('button', { name: /Send invite/i }).click();
        await expect(page.getByText(/valid email address/i)).toBeVisible();

        // Name + valid email sends and surfaces a toast.
        await page.getByPlaceholder('name@engsurveys.com.au').fill('newhire@engsurveys.com.au');
        await dialog.getByRole('button', { name: /Send invite/i }).click();
        await expect(page.getByText(/Invite sent/i)).toBeVisible();
    });

    test('opens the Shared Drive Manager and switches sub-nav views', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByText('Shared Drive Manager').click();
        await expect(page).toHaveURL(/\/tools\/shared-drive-manager$/);
        await expect(page.getByRole('heading', { name: /^Shared Drives$/i })).toBeVisible();
        await page.getByRole('button', { name: /Members Directory/i }).click();
        await expect(page.getByRole('heading', { name: /Members Directory/i })).toBeVisible();
    });

    test('signs out back to the login screen', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByRole('button', { name: /Sign out/i }).click();
        await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    });

    test('the post-confirmation welcome screen routes to the dashboard', async ({ page }) => {
        await page.goto('/welcome');
        await expect(page.getByRole('heading', { name: /all set/i })).toBeVisible();
        await page.getByRole('button', { name: /Go to the dashboard/i }).click();
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
    });

    test('deep-links: /reports renders directly when authenticated', async ({ page }) => {
        await page.goto('/reports');
        await expect(page.getByRole('heading', { name: /^Reports$/i })).toBeVisible();
    });
});

test.describe('signature onboarding', () => {
    test('a new user with no signature is routed to set one up', async ({ page }) => {
        await authenticate(page, { role: 'surveyor', signature: null });
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/setup-signature$/);
        await expect(page.getByRole('heading', { name: /Set up your signature/i })).toBeVisible();
    });
});

test.describe('tool restrictions', () => {
    test('a restricted user only sees allowed tools and is blocked from the rest', async ({ page }) => {
        await authenticate(page, { role: 'admin', tools: ['service-location'] });
        await page.goto('/dashboard');

        await expect(page.getByText('Service Location Field Report')).toBeVisible();
        await expect(page.getByText('Pothole Report Generator')).toHaveCount(0);

        // Deep-linking a disallowed tool bounces back to the dashboard.
        await page.goto('/tools/photo-report');
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
    });
});

test.describe('user deletion', () => {
    test('an admin deletes another user via a branded confirm (not a native dialog)', async ({ page }) => {
        await authenticate(page, {
            role: 'admin',
            extraUsers: [{ id: 'u-2', full_name: 'Old Teammate', email: 'old@engsurveys.com.au', role: 'surveyor', active: true, tools: null }],
        });
        await page.goto('/users');
        await expect(page.getByText('Old Teammate')).toBeVisible();

        await page.getByRole('button', { name: /^Delete$/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByRole('button', { name: /Delete user/i }).click();
        await expect(page.getByText(/deleted/i)).toBeVisible();
    });
});

test.describe('RBAC — as a surveyor', () => {
    test.beforeEach(async ({ page }) => { await authenticate(page, { role: 'surveyor' }); });

    test('does not see the Users link', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /^Users$/i })).toHaveCount(0);
    });

    test('does not see the manager-only Shared Drive Manager tool', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
        await expect(page.getByText('Shared Drive Manager')).toHaveCount(0);
    });

    test('is redirected away from /users to the dashboard', async ({ page }) => {
        await page.goto('/users');
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
        // The user-management heading must NOT render.
        await expect(page.getByRole('heading', { name: /User management/i })).toHaveCount(0);
    });
});
