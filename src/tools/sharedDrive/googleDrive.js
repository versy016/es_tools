// Browser-side Google Drive client for the Shared Drive Manager.
// Uses Google Identity Services (GIS) to get the signed-in manager's OAuth access token
// (Drive scope), then calls the Drive REST API directly (it's CORS-enabled). No backend
// / service account — actions run as the authorising Google user, so that user needs
// Workspace rights to manage shared drives (a Workspace admin sees all drives via
// useDomainAdminAccess; a non-admin only sees drives they belong to).
import { GOOGLE_CLIENT_ID } from '../../config';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/drive/v3';

let _token = null;          // { access_token, expiresAt }
let _tokenClient = null;
let _gisPromise = null;

export const isConfigured = () => Boolean(GOOGLE_CLIENT_ID);
export const isConnected = () => !!_token && _token.expiresAt > Date.now() + 5000;

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
                    _token = { access_token: resp.access_token, expiresAt: Date.now() + (resp.expires_in || 3600) * 1000 };
                    resolve(true);
                },
            });
            _tokenClient.requestAccessToken({ prompt: _token ? '' : 'consent' });
        } catch (e) { reject(e); }
    });
};

export const disconnect = () => {
    if (_token && window.google?.accounts?.oauth2) {
        try { window.google.accounts.oauth2.revoke(_token.access_token); } catch { /* ignore */ }
    }
    _token = null;
};

const token = async () => {
    if (isConnected()) return _token.access_token;
    await connect();
    return _token.access_token;
};

// Fetch helper: attaches the bearer token, parses JSON, throws readable errors.
const api = async (path, { method = 'GET', body, retry = true } = {}) => {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && retry) { _token = null; return api(path, { method, body, retry: false }); }
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
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
