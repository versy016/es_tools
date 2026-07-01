// Tests for the user-management service. Supabase (tables + the admin-users edge
// function) is mocked, so no real users are invited/changed and no backend is hit.

jest.mock('../lib/supabase', () => {
    const state = {
        profiles: [
            { id: 'u1', full_name: 'Ann Admin', email: 'ann@x.com', role: 'admin', active: true },
            { id: 'u2', full_name: '', email: 'sam@x.com', role: 'surveyor', active: false },
        ],
        audit: [{ who: 'ann@x.com', what: 'invited sam', ts: '2026-01-01T00:00:00Z' }],
        invokeResult: { data: { ok: true }, error: null },
        invokes: [],
    };
    const from = (table) => {
        const isAudit = table === 'audit';
        const q = {
            select: () => q,
            order: () => q,
            limit: () => Promise.resolve({ data: state.audit, error: null }),
            then: (resolve) => resolve({ data: isAudit ? state.audit : state.profiles, error: null }),
        };
        return q;
    };
    return {
        __state: state,
        isSupabaseConfigured: () => true,
        supabase: {
            from,
            functions: { invoke: (name, opts) => { state.invokes.push({ name, ...opts }); return Promise.resolve(state.invokeResult); } },
        },
    };
});

import { isConfigured, listUsers, inviteUser, setUserRole, setUserActive } from './usersService';
import { __state } from '../lib/supabase';

beforeEach(() => {
    __state.invokes.length = 0;
    __state.invokeResult = { data: { ok: true }, error: null };
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('isConfigured reflects the Supabase config', () => {
    expect(isConfigured()).toBe(true);
});

describe('listUsers', () => {
    test('normalises rows: Title-case role, name fallback to email, active default', async () => {
        const { users, audit } = await listUsers();
        expect(users).toHaveLength(2);
        expect(users[0]).toMatchObject({ name: 'Ann Admin', role: 'Admin', active: true });
        // Blank name falls back to email; explicit active:false is preserved.
        expect(users[1]).toMatchObject({ name: 'sam@x.com', role: 'Surveyor', active: false });
        expect(audit[0]).toMatchObject({ who: 'ann@x.com', what: 'invited sam' });
    });
});

describe('admin actions route through the admin-users function', () => {
    test('inviteUser lowercases the role and trims the email', async () => {
        const ok = await inviteUser('  New@X.com  ', 'Manager');
        expect(ok).toBe(true);
        expect(__state.invokes[0]).toMatchObject({ name: 'admin-users', body: { action: 'invite', email: 'New@X.com', role: 'manager' } });
    });

    test('setUserRole / setUserActive send the right payloads', async () => {
        await setUserRole('u2', 'Admin');
        expect(__state.invokes[0].body).toEqual({ action: 'setRole', userId: 'u2', role: 'admin' });

        __state.invokes.length = 0;
        await setUserActive('u2', 0);
        expect(__state.invokes[0].body).toEqual({ action: 'setActive', userId: 'u2', active: false });
    });

    test('returns false (never throws) when the function errors', async () => {
        __state.invokeResult = { data: null, error: new Error('not an admin') };
        await expect(inviteUser('x@y.com')).resolves.toBe(false);
    });
});
