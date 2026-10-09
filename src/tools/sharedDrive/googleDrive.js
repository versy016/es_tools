// Browser-side Google Drive client for the Shared Drive Manager.
// Uses Google Identity Services (GIS) to get the signed-in manager's OAuth access token
// (Drive scope), then calls the Drive REST API directly (it's CORS-enabled). No backend
// / service account — actions run as the authorising Google user, so that user needs
// Workspace rights to manage shared drives (a Workspace admin sees all drives via
// useDomainAdminAccess; a non-admin only sees drives they belong to).
import { GOOGLE_CLIENT_ID } from '../../config';

// Drive (manage shared drives + membership) and Admin SDK Reports (audit: deletions and
// folder creations). Adding a scope forces a one-time re-consent for existing users.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
export const REPORTS_SCOPE = 'https://www.googleapis.com/auth/admin.reports.audit.readonly';
export const SCOPE = `${DRIVE_SCOPE} ${REPORTS_SCOPE}`;
const REPORTS_API = 'https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/drive';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/drive/v3';

const STORE_KEY = 'es_sdm_gtoken';
const loadStored = () => {
    try { const t = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null'); return t && t.expiresAt > Date.now() + 5000 ? t : null; }
    catch { return null; }
};
const saveToken = (t) => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(t)); } catch { /* ignore */ } };

let _token = loadStored();  // { access_token, expiresAt, scope } — restored per-tab so a refresh keeps the session
const storeToken = (resp) => {
    _token = { access_token: resp.access_token, expiresAt: Date.now() + (resp.expires_in || 3600) * 1000, scope: resp.scope || '' };
    saveToken(_token);
};
let _tokenClient = null;
let _gisPromise = null;

export const isConfigured = () => Boolean(GOOGLE_CLIENT_ID);
export const isConnected = () => !!_token && _token.expiresAt > Date.now() + 5000;
// ms until the current token expires (0 when there is none).
export const tokenExpiresIn = () => (_token ? Math.max(0, _token.expiresAt - Date.now()) : 0);
// Was the Reports scope granted on the current token? Tokens stored before the scope was
// added (no `scope` field) or granted with it unticked say no → the Audit tab asks to reconnect.
export const hasReportsScope = () => !!_token && String(_token.scope || '').split(/\s+/).includes(REPORTS_SCOPE);

// Load the GIS script once.
const loadGis = () => {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (_gisPromise) return _gisPromise;
    _gisPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = GIS_SRC; s.async = true; s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection.'));
        document.head.appendChild(s);
    });
    return _gisPromise;
};

// Prompt the user to authorise their Google account and cache the access token.
export const connect = async () => {
    if (!GOOGLE_CLIENT_ID) throw new Error('Google is not configured (REACT_APP_GOOGLE_CLIENT_ID is not set).');
    await loadGis();
    return new Promise((resolve, reject) => {
        try {
            _tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: SCOPE,
                callback: (resp) => {
                    if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
                    storeToken(resp);
                    resolve(true);
                },
                // Popup blocked / closed → reject rather than hang forever.
                error_callback: (err) => reject(new Error(err?.message || `Google sign-in failed (${err?.type || 'unknown'})`)),
            });
            _tokenClient.requestAccessToken({ prompt: _token ? '' : 'consent' });
        } catch (e) { reject(e); }
    });
};

// Try to get a token WITHOUT any UI (works if the user still has a Google session and has
// consented before). Resolves true on success, false if interaction would be required —
// used to auto-reconnect on page load. Never throws.
export const connectSilent = async () => {
    if (isConnected()) return true;
    if (!GOOGLE_CLIENT_ID) return false;
    try { await loadGis(); } catch { return false; }
    return new Promise((resolve) => {
        try {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: SCOPE,
                callback: (resp) => {
                    if (resp && resp.access_token) { storeToken(resp); resolve(true); } else resolve(false);
                },
                error_callback: () => resolve(false),
            });
            client.requestAccessToken({ prompt: '' });
        } catch { resolve(false); }
    });
};

export const disconnect = () => {
    if (_token && window.google?.accounts?.oauth2) {
        try { window.google.accounts.oauth2.revoke(_token.access_token); } catch { /* ignore */ }
    }
    _token = null;
    try { sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
};

// An expired sign-in during background work (an audit scan). Browsers block popups that are
// not triggered by a click, so the scan must stop and let the user reconnect, not prompt.
const authExpired = () => Object.assign(new Error('Google sign-in expired — reconnect to continue'), { status: 401, authExpired: true });

// `interactive: false` (audit scans) never opens the Google sign-in popup.
const token = async (interactive = true) => {
    if (isConnected()) return _token.access_token;
    if (!interactive) throw authExpired();
    await connect();
    return _token.access_token;
};

// Transient-error backoff (ms) for attempt n, with jitter; tests override it with setRetryDelay(() => 0).
let _retryDelay = (n) => 1000 * 2 ** n + Math.floor(Math.random() * 500);
export const setRetryDelay = (fn) => { _retryDelay = fn; };
const MAX_RETRIES = 5;
const transient = (status) => status === 429 || (status >= 500 && status < 600);
// Drive reports per-user throttling as a 403 (not 429) with one of these reasons.
const RATE_LIMIT_REASONS = ['rateLimitExceeded', 'userRateLimitExceeded'];
const isRateLimited = (status, data) => status === 403 && (data?.error?.errors || []).some((e) => RATE_LIMIT_REASONS.includes(e.reason));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch helper: attaches the bearer token, parses JSON, throws readable errors. `path` is
// relative to the Drive v3 base, or an absolute https:// URL (Reports API). A 401 is
// retried once after a SILENT reconnect; if that can't get a token, an interactive call
// prompts and a non-interactive one throws `authExpired`. 429, 5xx and 403 rate limits are
// retried with exponential backoff up to MAX_RETRIES.
const api = async (path, { method = 'GET', body, retry = true, attempt = 0, interactive = true, reauthed = false } = {}) => {
    const url = path.startsWith('https://') ? path : `${API}${path}`;
    const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${await token(interactive)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && retry) { _token = null; await connectSilent(); return api(path, { method, body, retry: false, attempt, interactive, reauthed: true }); }
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if ((transient(res.status) || isRateLimited(res.status, data)) && attempt < MAX_RETRIES) {
        await sleep(_retryDelay(attempt));
        return api(path, { method, body, retry, attempt: attempt + 1, interactive, reauthed });
    }
    if (!res.ok) {
        if (res.status === 401 && reauthed && !interactive) throw authExpired();
        const msg = data?.error?.message || `Drive API error (${res.status})`;
        const err = new Error(msg); err.status = res.status; throw err;
    }
    return data;
};

// ---- Drive operations ----

// List all shared drives (paginated). Tries domain-admin access first (sees every drive),
// falls back to the user's own drives if they're not a Workspace admin.
export const listDrives = async () => {
    for (const useDomainAdminAccess of [true, false]) {
        try {
            const drives = [];
            let pageToken;
            do {
                const qs = new URLSearchParams({ pageSize: '100', useDomainAdminAccess: String(useDomainAdminAccess) });
                if (pageToken) qs.set('pageToken', pageToken);
                // eslint-disable-next-line no-await-in-loop
                const r = await api(`/drives?${qs}`);
                (r.drives || []).forEach((d) => drives.push({ id: d.id, name: d.name }));
                pageToken = r.nextPageToken;
            } while (pageToken);
            return drives;
        } catch (e) {
            if ((e.status === 403 || e.status === 404) && useDomainAdminAccess) continue; // retry as non-admin
            throw e;
        }
    }
    return [];
};

// List a drive's members (user/group permissions with an email). Returns
// [{ email, permissionId, role }].
export const listMembers = async (driveId) => {
    for (const useDomainAdminAccess of [true, false]) {
        try {
            const out = [];
            let pageToken;
            do {
                const qs = new URLSearchParams({
                    supportsAllDrives: 'true', useDomainAdminAccess: String(useDomainAdminAccess),
                    pageSize: '100', fields: 'nextPageToken,permissions(id,type,role,emailAddress)',
                });
                if (pageToken) qs.set('pageToken', pageToken);
                // eslint-disable-next-line no-await-in-loop
                const r = await api(`/files/${driveId}/permissions?${qs}`);
                (r.permissions || []).forEach((p) => { if (p.emailAddress) out.push({ email: p.emailAddress, permissionId: p.id, role: p.role }); });
                pageToken = r.nextPageToken;
            } while (pageToken);
            return out;
        } catch (e) {
            if (e.status === 404 && useDomainAdminAccess) continue;
            throw e;
        }
    }
    return [];
};

// Every item in a shared drive (trashed included), 1000 per page. `onPage(countSoFar)` is
// called after each page so the audit can show progress; returning `false` from it aborts
// the listing (throws an Error with `cancelled: true`) so a Cancel takes effect within one
// page rather than after the whole drive. Used by the Audit tab.
export const listDriveTree = async (driveId, onPage) => {
    const out = [];
    let pageToken;
    do {
        const qs = new URLSearchParams({
            corpora: 'drive', driveId, includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', pageSize: '1000',
            // Only what the audit uses: every extra field multiplies browser memory on 400k-item drives.
            fields: 'nextPageToken,files(id,name,mimeType,parents,trashed)',
        });
        if (pageToken) qs.set('pageToken', pageToken);
        // eslint-disable-next-line no-await-in-loop
        const r = await api(`/files?${qs}`, { interactive: false });
        (r.files || []).forEach((f) => out.push(f));
        if (onPage && onPage(out.length) === false) throw Object.assign(new Error('Cancelled'), { cancelled: true });
        pageToken = r.nextPageToken;
    } while (pageToken);
    return out;
};

// Admin SDK Reports API: Drive audit events of one kind ('delete' | 'create') since an ISO
// time, all pages. Needs the connected account to have Workspace admin reports access —
// a 403 is thrown with err.status = 403 for the caller to handle.
export const listAuditEvents = async (eventName, sinceIso) => {
    const out = [];
    let pageToken;
    do {
        const qs = new URLSearchParams({ eventName, startTime: sinceIso, maxResults: '1000', filters: 'doc_type==folder' });
        if (pageToken) qs.set('pageToken', pageToken);
        // retry:false — the Reports API answers 401 "not authorized to read activity records" when
        // the account lacks the admin Reports privilege; that is not an expired token, so don't
        // re-prompt Google. The caller maps 401/403 to "needs Workspace admin reports access".
        // eslint-disable-next-line no-await-in-loop
        const r = await api(`${REPORTS_API}?${qs}`, { retry: false, interactive: false });
        (r.items || []).forEach((e) => out.push(e));
        pageToken = r.nextPageToken;
    } while (pageToken);
    return out;
};

export const createDrive = async (name) => {
    const requestId = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
    const d = await api(`/drives?requestId=${encodeURIComponent(requestId)}`, { method: 'POST', body: { name } });
    return { id: d.id, name: d.name || name };
};

// Add a member as Content Manager (fileOrganizer), no notification email.
export const addMember = (driveId, email) =>
    api(`/files/${driveId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
        method: 'POST', body: { type: 'user', role: 'fileOrganizer', emailAddress: email },
    });

export const removeMember = (driveId, permissionId) =>
    api(`/files/${driveId}/permissions/${permissionId}?supportsAllDrives=true&useDomainAdminAccess=true`, { method: 'DELETE' })
        .catch((e) => { if (e.status === 404) return api(`/files/${driveId}/permissions/${permissionId}?supportsAllDrives=true`, { method: 'DELETE' }); throw e; });
