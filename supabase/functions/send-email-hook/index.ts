// Supabase Auth "Send Email Hook". When enabled (Dashboard → Authentication → Hooks →
// Send Email Hook), Supabase STOPS sending its own templated emails and calls this
// function for EVERY auth email: signup confirm, invite, recovery (password reset),
// magic link, email change, reauthentication. We render branded HTML and send it via
// our own SMTP (the same Gmail secrets as send-report). No Supabase templates involved.
//
// Security: the request is signed by Supabase (Standard Webhooks) and verified here with
// SEND_EMAIL_HOOK_SECRET — the endpoint is not usable by anyone else. Password-reset
// emails are additionally restricted to ALLOWED_EMAIL_DOMAIN (e.g. engsurveys.com.au).
//
// Deploy:  supabase functions deploy send-email-hook --no-verify-jwt
// Secrets: SEND_EMAIL_HOOK_SECRET (from the dashboard hook), ALLOWED_EMAIL_DOMAIN,
//          and the SMTP_* set already used by send-report. SUPABASE_URL is auto-injected.

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { buildEmail } from './templates.ts';

// The hook contract: 200 + {} on success; a non-2xx (or { error }) tells Auth the send
// failed and it aborts the action, surfacing the message to the user.
const ok = () => new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
const fail = (message: string, status = 500) =>
    new Response(JSON.stringify({ error: { http_code: status, message } }), { status, headers: { 'Content-Type': 'application/json' } });

interface HookPayload {
    user: { email: string; new_email?: string };
    email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
    };
}

Deno.serve(async (req) => {
    if (req.method !== 'POST') return fail('Method not allowed', 405);

    const payload = await req.text();

    // 1) Verify the Standard Webhooks signature so only Supabase Auth can call us.
    const rawSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
    if (!rawSecret) return fail('SEND_EMAIL_HOOK_SECRET is not set on the function', 500);
    let data: HookPayload;
    try {
        const wh = new Webhook(rawSecret.replace('v1,whsec_', ''));
        const headers = Object.fromEntries(req.headers);
        data = wh.verify(payload, headers) as HookPayload;
    } catch (_e) {
        return fail('Invalid webhook signature', 401);
    }

    const { user, email_data } = data;
    const { token, token_hash, redirect_to, email_action_type, site_url } = email_data;

    // 2) Abuse guard: only send password-reset emails to the org domain.
    const domain = Deno.env.get('ALLOWED_EMAIL_DOMAIN');
    if (email_action_type === 'recovery' && domain &&
        !user.email.toLowerCase().endsWith('@' + domain.toLowerCase())) {
        // Accept silently (don't reveal, don't send) so off-domain resets are a no-op.
        return ok();
    }

    // 3) Build the verification link that lands the user back in the app. The verify
    // endpoint lives on the Supabase project URL; it redirects to redirect_to afterwards.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || site_url;
    const dest = redirect_to || site_url;
    const link = `${supabaseUrl}/auth/v1/verify?token=${token_hash}` +
        `&type=${encodeURIComponent(email_action_type)}&redirect_to=${encodeURIComponent(dest)}`;

    const recipient = (email_action_type.startsWith('email_change') && user.new_email) ? user.new_email : user.email;
    const { subject, html, text } = buildEmail(email_action_type, { link, token, email: recipient });

    // 4) Send via SMTP (same config as send-report; Gmail 465/SSL by default).
    const host = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const port = parseInt(Deno.env.get('SMTP_PORT') || '465', 10);
    const smtpUser = Deno.env.get('SMTP_USER');
    const pass = Deno.env.get('SMTP_PASS');
    const from = Deno.env.get('SMTP_FROM') || smtpUser;
    const secureEnv = Deno.env.get('SMTP_SECURE');
    const secure = secureEnv != null ? secureEnv === 'true' : port === 465;
    if (!smtpUser || !pass) return fail('SMTP is not configured (SMTP_USER/SMTP_PASS missing)', 500);

    const client = new SMTPClient({ connection: { hostname: host, port, tls: secure, auth: { username: smtpUser, password: pass } } });
    try {
        await client.send({ from: from!, to: recipient, subject, content: text, html });
        try { await client.close(); } catch { /* ignore close errors */ }
        console.log(`send-email-hook: sent ${email_action_type} to ${recipient}`);
        return ok();
    } catch (err) {
        try { await client.close(); } catch { /* ignore */ }
        const msg = String((err as Error)?.message || err);
        console.error('send-email-hook FAILED:', msg);
        return fail(`Email send failed: ${msg}`, 502);
    }
});
