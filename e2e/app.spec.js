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
        // Tool names also appear in the sidebar, so scope to the page body.
        await expect(page.getByRole('main').getByText('Pothole Report Generator')).toBeVisible();
        await expect(page.getByRole('main').getByText('Service Location Field Report')).toBeVisible();
    });

    test('the sidebar shows the admin-only Users link and navigates the primary sections', async ({ page }) => {
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

    test('the sidebar user button opens the profile screen', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByRole('button', { name: /E2E Tester/ }).click();
        await expect(page).toHaveURL(/\/profile$/);
        await expect(page.getByRole('heading', { name: /^Profile$/i })).toBeVisible();
    });

    test('My signature and Templates open from the sidebar', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByRole('link', { name: /My signature/i }).click();
        await expect(page).toHaveURL(/\/signature$/);
        await expect(page.getByRole('heading', { name: /My signature/i })).toBeVisible();
        await page.getByRole('link', { name: /^Templates$/i }).click();
        await expect(page).toHaveURL(/\/templates$/);
        await expect(page.getByRole('heading', { name: /^Templates$/i })).toBeVisible();
        await expect(page.getByText('swms.docx')).toBeVisible();
    });

    test('the dashboard has no resume card and lists the two coming-soon apps', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.getByText(/CONTINUE WHERE YOU LEFT OFF|START HERE/)).toHaveCount(0);
        await expect(page.getByText('ES Planner')).toHaveCount(1);           // tile only (sidebar lists no tools)
        await expect(page.getByText('ES Action Register')).toHaveCount(1);
    });

    test('opening a tool tile routes to that tool', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByRole('main').getByText('Pothole Report Generator').click();
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

    test('does not see the manager-only Shared Drive Manager and is bounced from its route', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
        await expect(page.getByText('Shared Drive Manager')).toHaveCount(0);
        // Deep-linking the manager-only route bounces an admin back to the dashboard.
        await page.goto('/tools/shared-drive-manager');
        await expect(page).toHaveURL(/\/dashboard$/);
    });

    test('opens the SWMS tool with template defaults', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByRole('main').getByText('SWMS Generator').click();
        await expect(page).toHaveURL(/\/tools\/swms$/);
        await expect(page.getByRole('heading', { name: /Safe Work Method Statement/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Process library/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Generate Word/i })).toBeVisible();
    });

    test('SWMS licences: pick certifications from the list and remove them', async ({ page }) => {
        await page.goto('/tools/swms');
        const add = page.getByLabel('Add certification').first();
        await add.selectOption('White card (CPCWHS1001)');
        await page.getByLabel('Add certification').first().selectOption('Confined space (MSAPMPER200, MSAPMPER205, MSAPMPER217)');
        await expect(page.locator('.swms-cert-chip')).toHaveCount(2);
        for (const c of ['DBYD Locator Certification', 'RIW']) {
            await expect(page.getByLabel('Add certification').first().locator('option', { hasText: c })).toHaveCount(1);
        }
        // a picked certification is no longer offered for that person
        await expect(page.getByLabel('Add certification').first().locator('option', { hasText: 'White card' })).toHaveCount(0);
        if (process.env.SWMS_SHOT) { await page.locator('.swms-certs').first().scrollIntoViewIfNeeded(); await page.screenshot({ path: process.env.SWMS_SHOT }); }
        await page.getByRole('button', { name: 'Remove White card (CPCWHS1001)' }).click();
        await expect(page.locator('.swms-cert-chip')).toHaveCount(1);
    });

    test('SWMS project: picking a tender fills the project name and Ref No', async ({ page }) => {
        // Fake the Algolia proxy so the test never hits real tender data.
        await page.route(/execute-api\.ap-southeast-2\.amazonaws\.com/, (route) => {
            const url = route.request().url();
            const body = url.includes('indexName=tenders')
                ? [{ name: 'E2E Test Tender', reference: 'E2E-REF-001', objectID: 't1' }]
                : [];
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        });
        await page.goto('/tools/swms');
        const project = page.getByLabel(/^Project/);
        await project.fill('E2E');
        await page.locator('.dropdown-item', { hasText: 'E2E Test Tender' }).click();
        await expect(project).toHaveValue('E2E Test Tender');
        await expect(page.getByLabel(/^Ref No/)).toHaveValue('E2E-REF-001');
    });

    test('SWMS review + sign-on: staff name suggestions fill the row', async ({ page }) => {
        // Fake the Algolia proxy so the test never hits real staff data.
        await page.route(/execute-api\.ap-southeast-2\.amazonaws\.com/, (route) => {
            const body = route.request().url().includes('indexName=users')
                ? [{ name: 'E2E Alpha', objectID: 'u1' }, { name: 'E2E Bravo', objectID: 'u2' }]
                : [];
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        });
        await page.goto('/tools/swms');

        const reviewer = page.getByPlaceholder('Reviewed by…').nth(1);
        await reviewer.fill('E2E');
        await page.locator('.dropdown-item', { hasText: 'E2E Bravo' }).click();
        await expect(reviewer).toHaveValue('E2E Bravo');
        // "Signed" is the reviewer's initials, filled instantly
        await expect(reviewer.locator('xpath=ancestor::tr[1]').locator('.swms-initials')).toHaveText('EB');
        await page.getByPlaceholder('Reviewed by…').nth(3).fill('Shivam Verma');
        await expect(page.getByPlaceholder('Reviewed by…').nth(3).locator('xpath=ancestor::tr[1]').locator('.swms-initials')).toHaveText('SV');

        const worker = page.locator('.swms-ac-cell input[placeholder="Name…"]').nth(2);
        await worker.fill('E2');
        const workerItem = worker.locator('xpath=..').locator('.dropdown-item', { hasText: 'E2E Alpha' });
        await expect(workerItem).toBeVisible();
        if (process.env.SWMS_STAFF_SHOT) await page.screenshot({ path: process.env.SWMS_STAFF_SHOT });
        await workerItem.click();
        await expect(worker).toHaveValue('E2E Alpha');
        await expect(worker.locator('xpath=ancestor::tr[1]').locator('.swms-initials')).toHaveText('EA');
        await expect(page.getByRole('heading', { name: 'Subcontractor Supervisor Discussed SWMS with the Following People Involved in the Task' })).toBeVisible();
        // no tick boxes left in the sign-on table
        await expect(page.locator('table', { has: page.getByPlaceholder('Classification…') }).locator('input[type="checkbox"]')).toHaveCount(0);
        // other rows untouched
        await expect(page.getByPlaceholder('Reviewed by…').first()).toHaveValue('');
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

        await expect(page.getByRole('main').getByText('Service Location Field Report')).toBeVisible();
        await expect(page.getByText('Pothole Report Generator')).toHaveCount(0);   // hidden from tiles AND sidebar

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

test.describe('as a manager', () => {
    test.beforeEach(async ({ page }) => { await authenticate(page, { role: 'manager' }); });

    test('opens the manager-only Shared Drive Manager and switches sub-nav views', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByRole('main').getByText('Shared Drive Manager').click();
        await expect(page).toHaveURL(/\/tools\/shared-drive-manager$/);
        await expect(page.getByRole('heading', { name: /^Shared Drives$/i })).toBeVisible();
        await page.getByRole('button', { name: /Members Directory/i }).click();
        await expect(page.getByRole('heading', { name: /Members Directory/i })).toBeVisible();
    });

    test('opens the Audit tab (Run is disabled until Google is connected)', async ({ page }) => {
        await page.goto('/tools/shared-drive-manager');
        await page.getByRole('button', { name: /^Audit/i }).click();
        await expect(page.getByRole('heading', { name: /Drive audit/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Run full audit/i })).toBeDisabled();
        // Every check has its own Run button, all disabled until Google is connected.
        await expect(page.getByRole('button', { name: /^Run$/i })).toHaveCount(7);
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

    test('is redirected away from /templates to the dashboard', async ({ page }) => {
        await page.goto('/templates');
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('link', { name: /^Templates$/i })).toHaveCount(0);
    });

    test('is redirected away from /users to the dashboard', async ({ page }) => {
        await page.goto('/users');
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole('heading', { name: /Your tools/i })).toBeVisible();
        // The user-management heading must NOT render.
        await expect(page.getByRole('heading', { name: /User management/i })).toHaveCount(0);
    });
});
