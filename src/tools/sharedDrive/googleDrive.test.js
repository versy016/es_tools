// Unit tests for the audit additions to the browser-side Google client: the widened OAuth
// scope, full-drive listing and the Admin SDK Reports API. fetch is mocked — no network.
// A valid token is seeded in sessionStorage BEFORE the module loads so api() never tries
// to open the Google sign-in popup. (require, not import: ES imports are hoisted above
// the seed line and the module reads sessionStorage at load time.)
jest.mock('../../config', () => ({ GOOGLE_CLIENT_ID: 'cid' }));
sessionStorage.setItem('es_sdm_gtoken', JSON.stringify({ access_token: 'T', expiresAt: Date.now() + 3600e3 }));

const { SCOPE, REPORTS_SCOPE, listDriveTree, listAuditEvents, connect, connectSilent, hasReportsScope, tokenExpiresIn, setRetryDelay } = require('./googleDrive');

setRetryDelay(() => 0); // no real waiting in the retry tests

const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

beforeEach(() => { global.fetch = jest.fn(); });

test('SCOPE includes drive and reports audit', () => {
    expect(SCOPE).toBe('https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/admin.reports.audit.readonly');
});

describe('listDriveTree', () => {
    test('pages with the spec params and reports progress', async () => {
        fetch.mockResolvedValueOnce(json({ files: [{ id: 'a' }], nextPageToken: 'p2' }))
            .mockResolvedValueOnce(json({ files: [{ id: 'b' }] }));
        const seen = [];
        const out = await listDriveTree('D1', (n) => seen.push(n));
        expect(out.map((f) => f.id)).toEqual(['a', 'b']);
        expect(seen).toEqual([1, 2]);
        const u = new URL(fetch.mock.calls[0][0]);
        expect(u.origin + u.pathname).toBe('https://www.googleapis.com/drive/v3/files');
        expect(Object.fromEntries(u.searchParams)).toEqual({
            corpora: 'drive', driveId: 'D1', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', pageSize: '1000',
            // Only what the audit uses: every extra field multiplies memory on 400k-item drives.
            fields: 'nextPageToken,files(id,name,mimeType,parents,trashed)',
        });
        expect(new URL(fetch.mock.calls[1][0]).searchParams.get('pageToken')).toBe('p2');
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer T');
    });

    test('stops paging when onPage returns false and throws a cancelled error', async () => {
        fetch.mockResolvedValueOnce(json({ files: [{ id: 'a' }], nextPageToken: 'p2' }))
            .mockResolvedValueOnce(json({ files: [{ id: 'b' }] }));
        await expect(listDriveTree('D1', () => false)).rejects.toMatchObject({ cancelled: true });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('works without a progress callback and with an empty drive', async () => {
        fetch.mockResolvedValueOnce(json({}));
        await expect(listDriveTree('D1')).resolves.toEqual([]);
    });
});

describe('listAuditEvents', () => {
    test('hits the Reports API with eventName/startTime and pages', async () => {
        fetch.mockResolvedValueOnce(json({ items: [{ id: { time: 't1' } }], nextPageToken: 'n' }))
            .mockResolvedValueOnce(json({ items: [{ id: { time: 't2' } }] }));
        const out = await listAuditEvents('delete', '2026-07-04T00:00:00Z');
        expect(out.map((e) => e.id.time)).toEqual(['t1', 't2']);
        const u = new URL(fetch.mock.calls[0][0]);
        expect(u.origin + u.pathname).toBe('https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/drive');
        expect(Object.fromEntries(u.searchParams)).toEqual({ eventName: 'delete', startTime: '2026-07-04T00:00:00Z', maxResults: '1000', filters: 'doc_type==folder' });
        expect(new URL(fetch.mock.calls[1][0]).searchParams.get('pageToken')).toBe('n');
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer T');
    });

    test('a 401 from the Reports API is NOT treated as an expired token (no refresh, one request)', async () => {
        fetch.mockResolvedValueOnce(json({ error: { code: 401, message: 'Access denied. You are not authorized to read activity records.', errors: [{ reason: 'authError' }] } }, 401));
        await expect(listAuditEvents('delete', '2026-07-04T00:00:00Z')).rejects.toMatchObject({ status: 401, message: /not authorized to read activity records/ });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('403 surfaces err.status for the caller to decide', async () => {
        fetch.mockResolvedValueOnce(json({ error: { message: 'Not Authorized to access this resource/api' } }, 403));
        await expect(listAuditEvents('create', '2026-07-04T00:00:00Z')).rejects.toMatchObject({ status: 403, message: /Not Authorized/ });
    });
});

describe('api retry', () => {
    test('retries 429 and 5xx with backoff, then succeeds', async () => {
        fetch.mockResolvedValueOnce(json({ error: { message: 'Rate Limit Exceeded' } }, 429))
            .mockResolvedValueOnce(json({ error: { message: 'Backend Error' } }, 503))
            .mockResolvedValueOnce(json({ files: [{ id: 'ok' }] }));
        await expect(listDriveTree('D1')).resolves.toEqual([{ id: 'ok' }]);
        expect(fetch).toHaveBeenCalledTimes(3);
    });
    test('gives up after 5 retries and surfaces the last error', async () => {
        for (let i = 0; i < 6; i++) fetch.mockResolvedValueOnce(json({ error: { message: 'Backend Error' } }, 500));
        await expect(listDriveTree('D1')).rejects.toMatchObject({ status: 500 });
        expect(fetch).toHaveBeenCalledTimes(6);
    });
    test('retries a 403 rate limit (userRateLimitExceeded) instead of failing the drive', async () => {
        fetch.mockResolvedValueOnce(json({ error: { code: 403, message: 'User rate limit exceeded.', errors: [{ reason: 'userRateLimitExceeded' }] } }, 403))
            .mockResolvedValueOnce(json({ error: { code: 403, message: 'Rate Limit Exceeded', errors: [{ reason: 'rateLimitExceeded' }] } }, 403))
            .mockResolvedValueOnce(json({ files: [{ id: 'ok' }] }));
        await expect(listDriveTree('D1')).resolves.toEqual([{ id: 'ok' }]);
        expect(fetch).toHaveBeenCalledTimes(3);
    });
    test('does not retry a plain 404', async () => {
        fetch.mockResolvedValueOnce(json({ error: { message: 'Shared drive not found' } }, 404));
        await expect(listDriveTree('D1')).rejects.toMatchObject({ status: 404 });
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});

// ---- Token / scope handling (these replace the seeded token, so they run last) ----
const gis = (impl) => { window.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: (opts) => impl(cfg, opts) }) } } }; };

describe('token and scope', () => {
    test('a legacy stored token (no scope) does not have the reports scope', () => {
        expect(hasReportsScope()).toBe(false);
        expect(tokenExpiresIn()).toBeGreaterThan(3500e3);
    });

    test('connect rejects instead of hanging when GIS reports an error (e.g. popup blocked)', async () => {
        gis((cfg) => cfg.error_callback({ type: 'popup_failed_to_open', message: 'Popup blocked' }));
        await expect(connect()).rejects.toThrow(/popup/i);
    });

    test('connect stores the granted scope; hasReportsScope reflects it', async () => {
        gis((cfg) => cfg.callback({ access_token: 'N1', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive' }));
        await expect(connect()).resolves.toBe(true);
        expect(hasReportsScope()).toBe(false);
        expect(JSON.parse(sessionStorage.getItem('es_sdm_gtoken')).scope).toBe('https://www.googleapis.com/auth/drive');
        gis((cfg) => cfg.callback({ access_token: 'N2', expires_in: 3600, scope: `https://www.googleapis.com/auth/drive ${REPORTS_SCOPE}` }));
        await connect();
        expect(hasReportsScope()).toBe(true);
    });

    test('a 401 mid-request is retried once after a silent reconnect, no popup', async () => {
        let prompts = [];
        gis((cfg, opts) => { prompts.push(opts.prompt); cfg.callback({ access_token: 'S', expires_in: 3600, scope: SCOPE }); });
        fetch.mockResolvedValueOnce(json({ error: { message: 'Invalid Credentials' } }, 401))
            .mockResolvedValueOnce(json({ files: [{ id: 'after' }] }));
        await expect(listDriveTree('D1')).resolves.toEqual([{ id: 'after' }]);
        expect(prompts).toEqual(['']);
        expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer S');
    });

    test('a scan never opens a sign-in popup: an expired token mid-listing throws authExpired', async () => {
        const prompts = [];
        gis((cfg, opts) => { prompts.push(opts.prompt); cfg.error_callback({ type: 'popup_failed_to_open', message: 'Failed to open popup window' }); });
        fetch.mockResolvedValueOnce(json({ error: { message: 'Invalid Credentials' } }, 401));
        await expect(listDriveTree('D1')).rejects.toMatchObject({ authExpired: true, status: 401 });
        expect(prompts).toEqual(['']);          // only the silent attempt — never the consent popup
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('connectSilent resolves false (never throws) when GIS errors', async () => {
        sessionStorage.removeItem('es_sdm_gtoken');
        gis((cfg) => cfg.error_callback({ type: 'popup_failed_to_open' }));
        // Force the module to forget the in-memory token by expiring it through a 401 path is
        // overkill here: connectSilent short-circuits on isConnected(), so test the error path
        // through connect's sibling by clearing the stored token and the memory token together.
        const mod = require('./googleDrive');
        mod.disconnect();
        await expect(mod.connectSilent()).resolves.toBe(false);
    });
});
