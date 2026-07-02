// Shared Drive Manager — small helpers. (All real data now comes from Google Drive +
// Supabase via service.js — no seed/dummy data.)

let _n = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(_n++).toString(36)}`;

export const initials = (first, last) =>
    `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || '?';

// Treat firstname.lastname@ and firstinitiallastname@ (john.smith ↔ jsmith) as one person,
// so re-adding someone under an alias is detected as "already a member".
export const samePerson = (a, b) => {
    if (!a || !b) return false;
    if (a.toLowerCase() === b.toLowerCase()) return true;
    const [la, da] = a.toLowerCase().split('@');
    const [lb, db] = b.toLowerCase().split('@');
    if (!da || da !== db) return false;
    if (la === lb) return true;
    if (la.includes('.') && !lb.includes('.')) return lb === la[0] + la.split('.').pop();
    if (lb.includes('.') && !la.includes('.')) return la === lb[0] + lb.split('.').pop();
    return false;
};

// Person-ish object from a bare email (for drive members not in the directory).
export const personFromEmail = (email) => {
    const local = (email || '').split('@')[0] || '';
    const parts = local.split(/[.\-_]/);
    return {
        id: `email:${email}`, email, name: email,
        initials: (((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '')).toUpperCase() || (local[0] || '?').toUpperCase(),
    };
};

// Resolve a drive-member email to a directory person (fuzzy), else a synthesized person.
export const resolvePerson = (email, directory) =>
    (directory || []).find((p) => samePerson(p.email, email)) || personFromEmail(email);
