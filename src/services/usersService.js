import { supabase, isSupabaseConfigured } from '../lib/supabase';

// User management on Supabase: the "profiles" table is the user list (read/role/active
// gated by RLS — only admins can change others), and the "audit" table is the log.
// Inviting brand-new users needs the service-role key, so it is done from the Supabase
// dashboard (or a future edge function) — see supabase/README.md.

export const isConfigured = () => isSupabaseConfigured();

const writeAudit = async (what) => {
    if (!supabase) return;
    try {
        const { data } = await supabase.auth.getUser();
        const who = data?.user?.email || 'Someone';
        await supabase.from('audit').insert({ who, what });
    } catch { /* non-fatal */ }
};

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

export const setUserActive = async (username, active) => {
    if (!supabase) return false;
    try {
        const { error } = await supabase.from('profiles').update({ active }).eq('id', username);
        if (error) throw error;
        await writeAudit(`${active ? 'activated' : 'deactivated'} a user`);
        return true;
    } catch (err) { console.warn('setUserActive failed', err); return false; }
};

export const setUserRole = async (username, role) => {
    if (!supabase) return false;
    try {
        const { error } = await supabase.from('profiles').update({ role: role.toLowerCase() }).eq('id', username);
        if (error) throw error;
        await writeAudit(`set a user's role to ${role}`);
        return true;
    } catch (err) { console.warn('setUserRole failed', err); return false; }
};

// Inviting a brand-new account requires the service-role key (not available client-side).
export const inviteUser = async () => {
    console.warn('inviteUser: invite new users from the Supabase dashboard (Authentication → Users).');
    return false;
};
