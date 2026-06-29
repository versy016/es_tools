// Supabase Edge Function: email a generated report as an attachment over SMTP.
// Deno port of the old AWS email-service. Accepts JSON:
//   { to: string|string[], subject?, text?, filename?, contentBase64? }
// `contentBase64` is the report (PDF or .docx); the content type is inferred from the
// filename extension. `pdfBase64` is accepted as a legacy alias for contentBase64.
//
// Deploy:  supabase functions deploy send-report --no-verify-jwt
//
// Gmail / Google Workspace (recommended — implicit SSL on 465):
//   supabase secrets set \
//     SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true \
//     SMTP_USER=you@gmail.com SMTP_PASS=<16-char App Password> SMTP_FROM=you@gmail.com
//   The password MUST be a Google "App Password" (Account > Security > 2-Step
//   Verification > App passwords) — your normal login password will NOT work.
// Frontend: REACT_APP_EMAIL_ENDPOINT=https://<project>.supabase.co/functions/v1/send-report

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const contentTypeFor = (filename: string) =>
    filename.toLowerCase().endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';

// Reject after `ms` so a hung SMTP connection fails fast with a clear JSON error
// instead of running until the platform kills the function (the silent 503).
const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
        p,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s — check SMTP_HOST/SMTP_PORT and that SMTP_PASS is a Gmail App Password`)), ms)),
    ]);

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    // Default to Gmail-friendly implicit SSL on 465.
    const host = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const user = Deno.env.get('SMTP_USER');
    const pass = Deno.env.get('SMTP_PASS');
    const port = parseInt(Deno.env.get('SMTP_PORT') || '465', 10);
    const from = Deno.env.get('SMTP_FROM') || user;
    // Implicit TLS unless explicitly disabled; always implicit on 465.
    const secure = Deno.env.get('SMTP_SECURE') !== 'false' || port === 465;

    const missing = ['SMTP_USER:' + (user ? 1 : 0), 'SMTP_PASS:' + (pass ? 1 : 0)].filter((m) => m.endsWith(':0'));
    if (!user || !pass) {
        return json({ error: `SMTP is not configured (missing ${missing.map((m) => m.split(':')[0]).join(', ')}). Set the Gmail secrets on the function.` }, 500);
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({ error: 'Invalid JSON body' }, 400);
    }

    const recipients = (Array.isArray(body.to) ? body.to : [body.to]).filter(Boolean) as string[];
    if (recipients.length === 0) return json({ error: 'No recipients provided' }, 400);

    const content64 = (body.contentBase64 || body.pdfBase64) as string | undefined;
    const filename = (body.filename as string) || 'report.pdf';

    const client = new SMTPClient({
        connection: { hostname: host, port, tls: secure, auth: { username: user, password: pass } },
    });
    try {
        await withTimeout(client.send({
            from: from!,
            to: recipients,
            subject: (body.subject as string) || 'ES Tools report',
            content: (body.text as string) || 'Please find the attached report.',
            attachments: content64
                ? [{ filename, contentType: contentTypeFor(filename), encoding: 'base64', content: content64 }]
                : [],
        }), 25000, 'SMTP send');
        try { await withTimeout(client.close(), 5000, 'SMTP close'); } catch { /* ignore close errors */ }
        return json({ ok: true });
    } catch (err) {
        try { await client.close(); } catch { /* ignore */ }
        const msg = String((err as Error)?.message || err);
        console.error('send-report failed:', msg);
        // 502: we reached the function but the upstream SMTP server failed/timed out.
        return json({ error: `Email send failed: ${msg}` }, 502);
    }
});
