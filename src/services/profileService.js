import { supabase } from '../lib/supabase';

// Profile + signature live in the Supabase "profiles" table (one row per auth user),
// mirrored to localStorage so the PDF sign-off can read the signature synchronously.

// localStorage keys for the cached profile object and the signature data URL.
const PROFILE_LS = 'es_tools_profile';
const SIG_LS = 'es_tools_signature';

// Parse JSON from localStorage, returning `fallback` for missing/invalid values.
const lsGet = (k, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fallback : v; }
    catch { return fallback; }
};

// Current auth user id (assumes supabase exists; callers guard before calling).
const uid = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
};

// DB row -> UI profile shape, with empty-string/role defaults so fields are never null.
const rowToProfile = (r) => ({
    fullName: r.full_name || '',
    role: r.role || 'surveyor',
    accreditation: r.accreditation || '',
    mobile: r.mobile || '',
    email: r.email || '',
});

// Load the signed-in user's profile from the DB, caching it (and the signature) to
// localStorage. Falls back to the cached copy if Supabase is absent or the fetch fails.
export const loadProfile = async () => {
    if (!supabase) return lsGet(PROFILE_LS, null);
    try {
        const userId = await uid();
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;
        const profile = rowToProfile(data);
        localStorage.setItem(PROFILE_LS, JSON.stringify(profile));
        if (data.signature) localStorage.setItem(SIG_LS, data.signature);
        return profile;
    } catch (err) {
        console.warn('loadProfile failed', err);
        return lsGet(PROFILE_LS, null);
    }
};

// Persist editable profile fields. Always writes the local cache first (optimistic),
// then updates the DB row (RLS: own row only). Note `role` is intentionally not updated
// here — role changes go through the admin path. Returns true iff the DB write succeeded.
export const saveProfile = async (profile) => {
    localStorage.setItem(PROFILE_LS, JSON.stringify(profile));
    if (!supabase) return false;
    try {
        const userId = await uid();
        const { error } = await supabase.from('profiles').update({
            full_name: profile.fullName,
            accreditation: profile.accreditation,
            mobile: profile.mobile,
            email: profile.email,
        }).eq('id', userId);
        if (error) throw error;
        return true;
    } catch (err) {
        console.warn('saveProfile failed (kept locally)', err);
        return false;
    }
};

// Load the signature data URL from the DB, caching it locally; falls back to the cache.
export const loadSignature = async () => {
    if (!supabase) return localStorage.getItem(SIG_LS) || '';
    try {
        const userId = await uid();
        const { data, error } = await supabase.from('profiles').select('signature').eq('id', userId).single();
        if (error) throw error;
        const sig = data?.signature || '';
        if (sig) localStorage.setItem(SIG_LS, sig);
        return sig;
    } catch (err) {
        console.warn('loadSignature failed', err);
        return localStorage.getItem(SIG_LS) || '';
    }
};

// Save the signature data URL (cache first, then DB row). Returns true on DB success.
export const saveSignature = async (dataUrl) => {
    localStorage.setItem(SIG_LS, dataUrl);
    if (!supabase) return false;
    try {
        const userId = await uid();
        const { error } = await supabase.from('profiles').update({ signature: dataUrl }).eq('id', userId);
        if (error) throw error;
        return true;
    } catch (err) {
        console.warn('saveSignature failed (kept locally)', err);
        return false;
    }
};

// Combined profile + signature used to stamp the PDF sign-off block. Always returns an
// object (empty-ish fields if nothing is loaded) so the PDF renderer never sees null.
export const getSignoff = async () => {
    const profile = (await loadProfile()) || lsGet(PROFILE_LS, {}) || {};
    const signature = await loadSignature();
    return { ...profile, signature };
};
