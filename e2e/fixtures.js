// Shared E2E helpers. Everything here keeps the run 100% offline and data-safe:
// every Supabase/Maps/Algolia request is intercepted in the browser, and the
// "authenticated" state is faked by seeding a session into localStorage — the app
// never signs in for real, never reads or writes a real row.
const base = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const test = base.test;
const expect = base.expect;

// --- derive the Supabase project ref from CRA's env (for the auth localStorage key) ---
// supabase-js persists the session under `sb-<ref>-auth-token`; we need the same ref to
// seed it. Read it from the same .env files CRA reads at build time.
function supabaseUrl() {
    for (const f of ['.env.local', '.env', '.env.development.local']) {
        try {
            const txt = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
            const m = txt.match(/^\s*REACT_APP_SUPABASE_URL\s*=\s*(.+?)\s*$/m);
            if (m) return m[1].trim().replace(/^["']|["']$/g, '');
        } catch { /* file absent */ }
    }
    return process.env.REACT_APP_SUPABASE_URL || '';
}
const REF = (supabaseUrl().match(/https?:\/\/([^.]+)\.supabase\./) || [])[1] || '';
const STORAGE_KEY = REF ? `sb-${REF}-auth-token` : '';
// Authenticated specs need the ref to seed a session; skip them when env is absent
// (e.g. a CI box without .env.local). The unauth login specs also need the app to be
// "configured", which is the same env, so they gate on this too.
const hasAuthEnv = Boolean(STORAGE_KEY);

const USER = {
    id: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e@engsurveys.com.au',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'E2E Tester' },
    created_at: '2020-01-01T00:00:00.000Z',
};

// A session that looks valid and doesn't expire during the test, so supabase-js accepts
// it from storage without hitting the network to refresh.
function fakeSession() {
    const nowSec = Math.floor(Date.now() / 1000);
    return {
        access_token: 'e2e-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: nowSec + 60 * 60 * 24 * 365,
        refresh_token: 'e2e-refresh-token',
        user: USER,
    };
}

const profileRow = (role = 'admin', tools = null) => ({
    id: USER.id,
    full_name: 'E2E Tester',
    email: USER.email,
    role,
    accreditation: 'DBYD Accredited Locator',
    mobile: '0400000000',
    active: true,
    signature: null,
    tools, // null = all tools; array = allowlist
    created_at: '2020-01-01T00:00:00.000Z',
});

// Intercept every backend call. `role` sets the profile role (drives RBAC); `reports`
// is the fake reports list returned to the dashboard/reports screen.
async function installMocks(page, { role = 'admin', reports = [], tools = null, extraUsers = [] } = {}) {
    const prof = profileRow(role, tools);

    await page.route(/https?:\/\/[^/]*supabase\.[^/]*\/.*/i, (route) => {
        const req = route.request();
        const url = req.url();
        // PostgREST `.single()` sends this Accept header and wants ONE object, not an array.
        const single = (req.headers()['accept'] || '').includes('pgrst.object');
        const json = (body, status = 200) =>
            route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

        // Auth
        if (url.includes('/auth/v1/token')) return json(fakeSession());
        if (url.includes('/auth/v1/user')) return json(USER);
        if (url.includes('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });
        if (url.includes('/auth/v1/')) return json({});

        // REST tables
        if (url.includes('/rest/v1/profiles')) return json(single ? prof : [prof, ...extraUsers]);
        if (url.includes('/rest/v1/reports')) return json(single ? (reports[0] || {}) : reports);
        if (url.includes('/rest/v1/audit')) return json([]);
        if (url.includes('/rest/v1/')) return json(single ? {} : []);

        // Edge functions, storage, realtime, anything else Supabase.
        return json({ ok: true });
    });

    // Keep the run fully offline: stub Google Maps/Fonts + Algolia.
    await page.route(/https?:\/\/[^/]*(googleapis|gstatic|googletagmanager|algolia|algolianet)\.[^/]*\/.*/i,
        (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}

// Seed a signed-in session BEFORE any app script runs, then install mocks. After this the
// Gate renders the authenticated app straight away.
async function authenticate(page, opts = {}) {
    await page.addInitScript(([k, v]) => { window.localStorage.setItem(k, v); },
        [STORAGE_KEY, JSON.stringify(fakeSession())]);
    await installMocks(page, opts);
}

module.exports = { test, expect, installMocks, authenticate, hasAuthEnv, STORAGE_KEY, USER, profileRow };
