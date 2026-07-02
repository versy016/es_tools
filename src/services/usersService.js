import { supabase, isSupabaseConfigured } from '../lib/supabase';

// User management on Supabase. Reads (the user list + audit log) come straight from
// the "profiles"/"audit" tables under RLS — only managers/admins can see them. Writes
// that need elevated rights (inviting a brand-new account, banning a login, changing a
// role) go through the "admin-users" edge function, which runs with the service-role key
// and re-checks that the caller is an admin before acting. See supabase/SETUP.md.

export const isConfigured = () => isSupabaseConfigured();

// Read the user directory and recent audit trail for the admin screen. Both selects are
// RLS-gated to managers/admins; non-privileged callers get empty arrays (not an error).
// Profile rows are normalised: role is Title-cased and `active` defaults to true unless
// explicitly false. Returns { users, audit } and never throws.
export const listUsers = async () => {
    if (!supabase) return { users: [], audit: [] };
    try {
        const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
        const { data: audit } = await supabase.from('audit').select('*').order('ts', { ascending: false }).limit(20);
        return {
            users: (profiles || []).map((p) => ({
                username: p.id,
                name: p.full_name || p.email,
                email: p.email,
                role: (p.role || 'surveyor').replace(/^./, (c) => c.toUpperCase()),
                // null/undefined = unrestricted (all tools); an array = the allowed tool ids.
                tools: Array.isArray(p.tools) ? p.tools : null,
                active: p.active !== false,
            })),
            audit: (audit || []).map((a) => ({
                who: a.who,
                what: a.what,
                when: a.ts ? new Date(a.ts).toLocaleString('en-AU') : '',
            })),
        };
    } catch (err) {
        console.warn('listUsers failed', err);
        return { users: [], audit: [] };
    }
};

// Calls the admin-users edge function. supabase.functions.invoke automatically attaches
// the caller's JWT, which the function verifies (and checks the admin role) server-side.
const adminAction = async (action, payload) => {
    if (!supabase) return false;
    try {
        const { data, error } = await supabase.functions.invoke('admin-users', { body: { action, ...payload } });
        if (error) throw error;
        return data?.ok !== false;
    } catch (err) {
        console.warn(`admin-users:${action} failed`, err);
        return false;
    }
};

// Invite a brand-new user by email with an initial role (triggers the branded invite
// email). redirectBase lets the function send them to <origin>/reset-password to set a
// password, even when the SITE_URL secret isn't set.
export const inviteUser = (email, role = 'surveyor') =>
    adminAction('invite', {
        email: String(email).trim(),
        role: String(role).toLowerCase(),
        redirectBase: typeof window !== 'undefined' ? window.location.origin : undefined,
    });

// Change an existing user's role (admin | manager | surveyor).
export const setUserRole = (userId, role) =>
    adminAction('setRole', { userId, role: String(role).toLowerCase() });

// Enable/disable a user — toggles profiles.active and bans/unbans the login server-side.
export const setUserActive = (userId, active) =>
    adminAction('setActive', { userId, active: !!active });

// Restrict a user to specific tools (array of tool ids), or pass null to clear the
// restriction (all tools). Managers can set this for anyone; admins for non-managers.
export const setUserTools = (userId, tools) =>
    adminAction('setTools', { userId, tools: Array.isArray(tools) ? tools : null });

// Permanently delete a user — removes their profiles row AND their auth login. Cannot
// delete your own account; admins cannot delete a manager.
export const deleteUser = (userId) => adminAction('deleteUser', { userId });
