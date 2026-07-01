// Sign-in / sign-up form flows. All auth calls are mocked, so no real account is ever
// created or authenticated. Gated on the app being configured (same env that gives us
// the project ref) so these don't run on a backend-less CI box.
const { test, expect, installMocks, hasAuthEnv } = require('./fixtures');

test.skip(!hasAuthEnv, 'needs REACT_APP_SUPABASE_URL (a configured app) to render the login screen');

test.beforeEach(async ({ page }) => {
    await installMocks(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
});

test('renders the branded sign-in screen', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Every field tool/i })).toBeVisible();
    await expect(page.getByPlaceholder(/@engsurveys\.com\.au/i)).toBeVisible();
    await expect(page.getByPlaceholder('••••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
});

test('toggles between sign-in and sign-up, revealing the full-name field', async ({ page }) => {
    // Sign-in mode: no full-name field.
    await expect(page.getByPlaceholder('Dave Mitchell')).toHaveCount(0);

    await page.getByRole('button', { name: /Create an account/i }).click();
    await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible();
    await expect(page.getByPlaceholder('Dave Mitchell')).toBeVisible();

    // Toggle back.
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
});

test('requires an email before it will submit', async ({ page }) => {
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    // HTML5 `required` blocks submit — still on the login screen.
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
});

test('shows the backend error message on invalid credentials', async ({ page }) => {
    // Override the token endpoint for THIS test to reject the sign-in.
    await page.route(/https?:\/\/[^/]*supabase\.[^/]*\/auth\/v1\/token.*/i, (route) =>
        route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' }),
        }));

    await page.getByPlaceholder(/@engsurveys\.com\.au/i).fill('wrong@engsurveys.com.au');
    await page.getByPlaceholder('••••••••••').fill('badpassword');
    await page.getByRole('button', { name: /^Sign in$/i }).click();

    await expect(page.locator('.login-error')).toContainText(/invalid login credentials/i);
    // Did NOT navigate away.
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
});

test('a successful sign-in transitions into the dashboard', async ({ page }) => {
    await page.getByPlaceholder(/@engsurveys\.com\.au/i).fill('e2e@engsurveys.com.au');
    await page.getByPlaceholder('••••••••••').fill('correct-horse');
    await page.getByRole('button', { name: /^Sign in$/i }).click();

    // Mocked token endpoint returns a valid session -> Gate renders the app.
    await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
});

test('the Google button starts the OAuth handshake for google', async ({ page }) => {
    const oauthReq = page.waitForRequest(/\/auth\/v1\/authorize\?.*provider=google/i);
    await page.getByRole('button', { name: /Continue with Google/i }).click();
    await oauthReq; // resolves only if the app kicked off the google OAuth redirect
});
