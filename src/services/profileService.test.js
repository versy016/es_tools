// Tests for the profile + signature service. Supabase is mocked (no backend), and the
// localStorage mirror is exercised against jsdom's localStorage. Plain-function mock so
// CRA's resetMocks:true doesn't strip the implementation.

jest.mock('../lib/supabase', () => {
    const state = {
        user: { id: 'u1' },
        row: { full_name: 'Jane Doe', role: 'admin', accreditation: 'ACC-1', mobile: '0400', email: 'jane@x.com', signature: 'data:image/png;base64,SIG' },
        updates: [],
    };
    // A query object that is BOTH chainable (.select/.update/.eq) and thenable, so the
    // service's two call shapes work: `.select().eq().single()` and `await .update().eq()`.
    const makeQuery = () => {
        const q = {
            select: () => q,
            update: (vals) => { state.updates.push(vals); return q; },
            eq: () => q,
            single: () => Promise.resolve({ data: state.row, error: null }),
            then: (resolve) => resolve({ error: null }),
        };
        return q;
    };
    return {
        __state: state,
        isSupabaseConfigured: () => true,
        supabase: {
            auth: { getUser: () => Promise.resolve({ data: { user: state.user } }) },
            from: () => makeQuery(),
        },
    };
});

import { loadProfile, saveProfile, loadSignature, saveSignature, getSignoff } from './profileService';
import { __state } from '../lib/supabase';

beforeEach(() => {
    localStorage.clear();
    __state.updates.length = 0;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('loadProfile', () => {
    test('maps the DB row to the UI shape and caches it locally', async () => {
        const p = await loadProfile();
        expect(p).toEqual({ fullName: 'Jane Doe', role: 'admin', accreditation: 'ACC-1', mobile: '0400', email: 'jane@x.com' });
        expect(JSON.parse(localStorage.getItem('es_tools_profile'))).toMatchObject({ fullName: 'Jane Doe' });
        expect(localStorage.getItem('es_tools_signature')).toBe('data:image/png;base64,SIG');
    });
});

describe('saveProfile', () => {
    test('writes the local cache and updates the DB (not the role)', async () => {
        const ok = await saveProfile({ fullName: 'New Name', accreditation: 'A', mobile: 'm', email: 'e@x.com' });
        expect(ok).toBe(true);
        expect(__state.updates[0]).toEqual({ full_name: 'New Name', accreditation: 'A', mobile: 'm', email: 'e@x.com' });
        expect(__state.updates[0]).not.toHaveProperty('role');
        expect(JSON.parse(localStorage.getItem('es_tools_profile'))).toMatchObject({ fullName: 'New Name' });
    });
});

describe('signature', () => {
    test('loadSignature returns the stored data URL', async () => {
        await expect(loadSignature()).resolves.toBe('data:image/png;base64,SIG');
    });
    test('saveSignature caches locally and persists', async () => {
        const ok = await saveSignature('data:image/png;base64,NEW');
        expect(ok).toBe(true);
        expect(localStorage.getItem('es_tools_signature')).toBe('data:image/png;base64,NEW');
        expect(__state.updates[0]).toEqual({ signature: 'data:image/png;base64,NEW' });
    });
});

describe('getSignoff', () => {
    test('combines profile fields with the signature for the PDF block', async () => {
        const s = await getSignoff();
        expect(s).toMatchObject({ fullName: 'Jane Doe', signature: 'data:image/png;base64,SIG' });
    });
});
