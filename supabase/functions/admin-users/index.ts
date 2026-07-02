// Supabase Edge Function: privileged user administration.
// Runs with the service-role key, but RE-CHECKS that the caller is an admin or manager
// before doing anything. The frontend calls this via supabase.functions.invoke('admin-users'),
// which attaches the caller's JWT automatically.
//
// Actions (JSON body): { action: 'invite'|'setRole'|'setActive', ... }
//   invite:    { email, role? }            -> emails an invite, sets the role on the new profile
//   setRole:   { userId, role }            -> updates profiles.role
//   setActive: { userId, active: boolean } -> updates profiles.active AND bans/unbans login
//
// Deploy:  supabase functions deploy admin-users         (keep JWT verification ON)
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const url = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

        // Identify the caller from their JWT.
        const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        if (!token) return json({ ok: false, error: 'Not authenticated' }, 401);
        const { data: userData, error: userErr } = await admin.auth.getUser(token);
        if (userErr || !userData?.user) return json({ ok: false, error: 'Invalid session' }, 401);
        const caller = userData.user;

        // Admins and managers may use this function (case-insensitive; report the seen role to aid setup).
        const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', caller.id).single();
        const callerRole = String(callerProfile?.role || 'surveyor').toLowerCase();
        if (!['admin', 'manager'].includes(callerRole)) {
            return json({ ok: false, error: `Managers or admins only — your account role is "${callerRole}".` }, 403);
        }

        const { action, email, role, userId, active, tools } = await req.json();
        const writeAudit = (what: string) => admin.from('audit').insert({ who: caller.email, what });

        // Role hierarchy: manager (top) > admin > surveyor. Managers may act on anyone;
        // admins may act on anyone EXCEPT a manager, and may not grant the manager role.
        const isManager = callerRole === 'manager';
        const targetRole = async (id: string) => {
            const { data } = await admin.from('profiles').select('role').eq('id', id).single();
            return String(data?.role || 'surveyor').toLowerCase();
        };
        // Block an admin from acting on a manager (a manager outranks them). Managers pass.
        const denyIfOutranked = async (id: string) => {
            if (isManager) return null;
            if ((await targetRole(id)) === 'manager') {
                return json({ ok: false, error: 'Only a manager can modify a manager.' }, 403);
            }
            return null;
        };

        if (action === 'invite') {
            if (!email) return json({ ok: false, error: 'Email is required' }, 400);
            const wanted = String(role || 'surveyor').toLowerCase();
            if (!isManager && wanted === 'manager') return json({ ok: false, error: 'Only a manager can create a manager.' }, 403);
            // Land invited users on the set-password screen. The branded invite email is
            // sent by the send-email-hook function (Supabase calls it instead of templating).
            const siteUrl = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
            const redirectTo = siteUrl ? `${siteUrl}/reset-password` : undefined;
            const { data, error } = await admin.auth.admin.inviteUserByEmail(email, redirectTo ? { redirectTo } : undefined);
            if (error) throw error;
            const newId = data?.user?.id;
            if (newId && role) await admin.from('profiles').update({ role: wanted }).eq('id', newId);
            await writeAudit(`invited ${email}${role ? ' as ' + wanted : ''}`);
            return json({ ok: true });
        }

        if (action === 'setRole') {
            if (!userId || !role) return json({ ok: false, error: 'userId and role are required' }, 400);
            const wanted = String(role).toLowerCase();
            const denied = await denyIfOutranked(userId);
            if (denied) return denied;
            if (!isManager && wanted === 'manager') return json({ ok: false, error: 'Only a manager can grant the manager role.' }, 403);
            const { error } = await admin.from('profiles').update({ role: wanted }).eq('id', userId);
            if (error) throw error;
            await writeAudit(`set a user's role to ${wanted}`);
            return json({ ok: true });
        }

        if (action === 'setActive') {
            if (!userId) return json({ ok: false, error: 'userId is required' }, 400);
            const denied = await denyIfOutranked(userId);
            if (denied) return denied;
            const { error } = await admin.from('profiles').update({ active: !!active }).eq('id', userId);
            if (error) throw error;
            // Banning disables the login; 'none' lifts it.
            await admin.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' });
            await writeAudit(`${active ? 'activated' : 'deactivated'} a user`);
            return json({ ok: true });
        }

        if (action === 'setTools') {
            if (!userId) return json({ ok: false, error: 'userId is required' }, 400);
            const denied = await denyIfOutranked(userId);
            if (denied) return denied;
            // `tools`: array of allowed tool ids, or null to clear the restriction (= all tools).
            const value = Array.isArray(tools) ? tools.map(String) : null;
            const { error } = await admin.from('profiles').update({ tools: value }).eq('id', userId);
            if (error) throw error;
            await writeAudit(value ? `restricted a user's tools to ${value.join(', ') || '(none)'}` : "cleared a user's tool restrictions");
            return json({ ok: true });
        }

        return json({ ok: false, error: 'Unknown action' }, 400);
    } catch (err) {
        return json({ ok: false, error: String((err as Error)?.message || err) }, 500);
    }
});
