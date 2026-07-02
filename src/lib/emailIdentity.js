// Email identity / alias handling — the single source of truth for deciding when two
// email addresses belong to the SAME person.
//
// Engineering Surveys Google Workspace hands every person two working addresses:
//   • the primary   finitiallastname  →  sverma@engsurveys.com.au
//   • an alias      firstname.lastname →  shivam.verma@engsurveys.com.au
// Both deliver to the same mailbox, so without care a person could end up with two
// separate ES Tools accounts (one per address). We collapse an address to a canonical
// key so aliases compare equal, and use that everywhere accounts are created or matched.
//
// NOTE: this logic is mirrored in SQL (supabase/migrations/0004_email_identity.sql —
// public.canonical_email) so the database, the RPC and the edge function agree with the
// client. Keep the two in sync if you change the rule.

export const ORG_DOMAIN = 'engsurveys.com.au';

// Lower-case + trim. Returns '' for falsy input.
export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// Reduce an address to a canonical key so aliases of one person map to one value.
// Rule: strip any "+tag", and collapse a dotted local part (firstname.lastname[.middle…])
// to first-initial + last-name (shivam.verma → sverma). A local part with no dots is
// assumed to already be the primary finitiallastname form and is left as-is. The domain
// is preserved, so identity never crosses domains.
export const canonicalEmail = (email) => {
    const n = normalizeEmail(email);
    const at = n.lastIndexOf('@');
    if (at < 1) return n;                       // no domain — nothing to canonicalise
    let local = n.slice(0, at);
    const domain = n.slice(at + 1);
    local = local.split('+')[0];                // drop +tags (sverma+foo → sverma)
    if (local.includes('.')) {
        const parts = local.split('.').filter(Boolean);
        if (parts.length >= 2) local = parts[0][0] + parts[parts.length - 1];
        else local = parts[0] || local;
    }
    return `${local}@${domain}`;
};

// Do two addresses belong to the same person? True on an exact (normalised) match or a
// shared canonical key. Domains must match for the canonical keys to be equal.
export const sameIdentity = (a, b) => {
    const na = normalizeEmail(a);
    const nb = normalizeEmail(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    return canonicalEmail(a) === canonicalEmail(b);
};

// Is this an @engsurveys.com.au address?
export const isOrgEmail = (email) => normalizeEmail(email).endsWith(`@${ORG_DOMAIN}`);

// A well-formed org address: a real local part + the org domain (stricter than isOrgEmail,
// which only checks the suffix). Use this to validate typed input before adding a member.
export const isValidOrgEmail = (email) =>
    /^[^\s@]+@[^\s@]+$/.test(String(email || '').trim()) && isOrgEmail(email);

// Find the first item in `list` whose email is the same identity as `email`.
// `getEmail` extracts the address from a list item (defaults to item.email).
export const findIdentityMatch = (email, list, getEmail = (x) => x?.email) =>
    (list || []).find((item) => sameIdentity(email, getEmail(item))) || null;
