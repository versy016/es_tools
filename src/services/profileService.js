import { uploadData, downloadData } from 'aws-amplify/storage';

// Profile + signature persistence. Source of truth is S3 (per-user, "private"),
// mirrored to localStorage so the PDF sign-off can read the signature synchronously.

const OPTS = { accessLevel: 'private' };
const PROFILE_LS = 'es_tools_profile';
const SIG_LS = 'es_tools_signature';

const lsGet = (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; } catch { return fallback; }
};

export const loadProfile = async () => {
    try {
        const { body } = await downloadData({ key: 'profile/profile.json', options: OPTS }).result;
        const profile = JSON.parse(await body.text());
        localStorage.setItem(PROFILE_LS, JSON.stringify(profile));
        return profile;
    } catch {
        return lsGet(PROFILE_LS, null);
    }
};

export const saveProfile = async (profile) => {
    localStorage.setItem(PROFILE_LS, JSON.stringify(profile));
    try {
        const blob = new Blob([JSON.stringify(profile)], { type: 'application/json' });
        await uploadData({ key: 'profile/profile.json', data: blob, options: { ...OPTS, contentType: 'application/json' } }).result;
        return true;
    } catch (err) {
        console.warn('saveProfile to S3 failed (kept locally)', err);
        return false;
    }
};

export const loadSignature = async () => {
    try {
        const { body } = await downloadData({ key: 'profile/signature.txt', options: OPTS }).result;
        const dataUrl = await body.text();
        localStorage.setItem(SIG_LS, dataUrl);
        return dataUrl;
    } catch {
        return localStorage.getItem(SIG_LS) || '';
    }
};

export const saveSignature = async (dataUrl) => {
    localStorage.setItem(SIG_LS, dataUrl);
    try {
        const blob = new Blob([dataUrl], { type: 'text/plain' });
        await uploadData({ key: 'profile/signature.txt', data: blob, options: { ...OPTS, contentType: 'text/plain' } }).result;
        return true;
    } catch (err) {
        console.warn('saveSignature to S3 failed (kept locally)', err);
        return false;
    }
};

// Combined sign-off block used when generating the PDF.
export const getSignoff = async () => {
    const profile = (await loadProfile()) || lsGet(PROFILE_LS, {}) || {};
    const signature = await loadSignature();
    return { ...profile, signature };
};
