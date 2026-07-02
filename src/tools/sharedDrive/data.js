// Shared Drive Manager — small helpers. (All real data now comes from Google Drive +
// Supabase via service.js — no seed/dummy data.)
import { sameIdentity } from '../../lib/emailIdentity';

let _n = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(_n++).toString(36)}`;

export const initials = (first, last) =>
    `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || '?';

// Treat firstname.lastname@ and firstinitiallastname@ (john.smith ↔ jsmith) as one person,
// so re-adding someone under an alias is detected as "already a member". This is the same
// alias rule used at sign-in/account-creation — see src/lib/emailIdentity.js.
export const samePerson = (a, b) => sameIdentity(a, b);

// Person-ish object from a bare email (for drive members not in the directory). Derives a
// readable display name from the local part (ryan.olson → "Ryan Olson") rather than showing
// the raw email twice.
export const personFromEmail = (email) => {
    const local = (email || '').split('@')[0] || '';
    const parts = local.split(/[.\-_]/).filter(Boolean);
    const name = parts.map((s) => s[0].toUpperCase() + s.slice(1)).join(' ') || email;
    return {
        id: `email:${email}`, email, name,
        initials: (((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '')).toUpperCase() || (local[0] || '?').toUpperCase(),
    };
};

// Resolve a drive-member email to a directory person (fuzzy), else a synthesized person.
export const resolvePerson = (email, directory) =>
    (directory || []).find((p) => samePerson(p.email, email)) || personFromEmail(email);
