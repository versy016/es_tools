// User management talks to a Cognito admin Lambda (see admin-service/) via a single
// POST endpoint. Until REACT_APP_ADMIN_ENDPOINT is configured + deployed, every call
// returns empty so the UI shows an empty state rather than mock data.

const ADMIN_ENDPOINT = process.env.REACT_APP_ADMIN_ENDPOINT || '';

export const isConfigured = () => Boolean(ADMIN_ENDPOINT);

const call = async (action, payload = {}) => {
    if (!ADMIN_ENDPOINT) return null;
    const res = await fetch(ADMIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) throw new Error(`Admin endpoint returned ${res.status}`);
    return res.json();
};

export const listUsers = async () => {
    try {
        const data = await call('list');
        return data || { users: [], audit: [] };
    } catch (err) {
        console.warn('listUsers failed', err);
        return { users: [], audit: [] };
    }
};

export const setUserActive = async (username, active) => {
    try { await call('setActive', { username, active }); return true; }
    catch (err) { console.warn('setUserActive failed', err); return false; }
};

export const setUserRole = async (username, role) => {
    try { await call('setRole', { username, role }); return true; }
    catch (err) { console.warn('setUserRole failed', err); return false; }
};

export const inviteUser = async (email, role) => {
    try { await call('invite', { email, role }); return true; }
    catch (err) { console.warn('inviteUser failed', err); return false; }
};
