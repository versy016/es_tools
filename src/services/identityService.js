import { supabase } from '../lib/supabase';
import { normalizeEmail } from '../lib/emailIdentity';

// Ask the backend whether an account already exists for the person behind this address —
// matched by canonical identity, so an alias (shivam.verma@) finds the primary (sverma@).
// Backed by the email_identity_lookup RPC (see 0004_email_identity.sql). Fails soft:
// returns { exists: false } when the backend is absent, the RPC isn't deployed, or on any
// error, so sign-in / sign-up still work (the DB unique index remains the hard backstop).
export const lookupIdentity = async (email) => {
    const wanted = normalizeEmail(email);
    if (!supabase || !wanted) return { exists: false };
    try {
        const { data, error } = await supabase.rpc('email_identity_lookup', { p_email: wanted });
        if (error || !data || typeof data !== 'object') return { exists: false };
        return { exists: Boolean(data.exists), email: data.email || null };
    } catch {
        return { exists: false };
    }
};

// Resolve the address to sign in with: if the typed address is an alias of an existing
// account, return that account's on-file address so we can transparently redirect the
// login there; otherwise return the typed address unchanged.
export const resolveLoginEmail = async (email) => {
    const typed = normalizeEmail(email);
    const match = await lookupIdentity(typed);
    if (match.exists && match.email && normalizeEmail(match.email) !== typed) return match.email;
    return email;
};
