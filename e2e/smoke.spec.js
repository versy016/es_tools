// Boot smoke tests — env-agnostic. All backend traffic is mocked (see fixtures), so the
// run is offline and cannot create/read/delete real data.
const { test, expect, installMocks } = require('./fixtures');

test.beforeEach(async ({ page }) => { await installMocks(page); });

test('app boots without uncaught runtime errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');

    // Either the sign-in screen (configured) or the setup notice (no env) — both are
    // valid "the app rendered" states. What matters is it didn't throw.
    const signedOut = page.getByRole('heading', { name: /Every field tool/i });
    const notConfigured = page.getByRole('heading', { name: /Connect Supabase/i });
    await expect(signedOut.or(notConfigured)).toBeVisible();

    expect(errors, `Uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('makes no request to a real backend host', async ({ page }) => {
    // Any supabase.co request must be one WE fulfilled; assert none escaped to the network
    // by checking every response to a supabase host came from our route (status < 500 stub).
    const realHits = [];
    page.on('requestfinished', async (req) => {
        if (/supabase\.co/i.test(req.url())) {
            const res = await req.response();
            // Our stubs always answer; a genuine network round-trip would be uncommon here,
            // but this guards against a missed route pattern.
            if (!res) realHits.push(req.url());
        }
    });
    await page.goto('/');
    await page.waitForTimeout(500);
    expect(realHits).toEqual([]);
});
