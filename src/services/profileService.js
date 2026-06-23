import { supabase } from '../lib/supabase';

// Profile + signature live in the Supabase "profiles" table (one row per auth user),
// mirrored to localStorage so the PDF sign-off can read the signature synchronously.

const PROFILE_LS = 'es_tools_profile';
const SIG_LS = 'es_tools_signature';

const lsGet = (k, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fallback : v; }
    catch { return fallback; }
};

const uid = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
};

const rowToProfile = (r) => ({
    fullName: r.full_name || '',
    role: r.role || 'surveyor',
    accreditation: r.accreditation || '',
    mobile: r.mobile || '',
    email: r.email || '',
});

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

export const getSignoff = async () => {
    const profile = (await loadProfile()) || lsGet(PROFILE_LS, {}) || {};
    const signature = await loadSignature();
    return { ...profile, signature };
};
