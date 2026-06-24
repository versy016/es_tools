import { supabase, isSupabaseConfigured } from '../lib/supabase';

// User management on Supabase. Reads (the user list + audit log) come straight from
// the "profiles"/"audit" tables under RLS — only managers/admins can see them. Writes
// that need elevated rights (inviting a brand-new account, banning a login, changing a
// role) go through the "admin-users" edge function, which runs with the service-role key
// and re-checks that the caller is an admin before acting. See supabase/SETUP.md.

export const isConfigured = () => isSupabaseConfigured();

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
                tools: [],
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

export const inviteUser = (email, role = 'surveyor') =>
    adminAction('invite', { email: String(email).trim(), role: String(role).toLowerCase() });

export const setUserRole = (userId, role) =>
    adminAction('setRole', { userId, role: String(role).toLowerCase() });

export const setUserActive = (userId, active) =>
    adminAction('setActive', { userId, active: !!active });
