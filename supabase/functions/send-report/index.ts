// Supabase Edge Function: email a generated report as an attachment over SMTP.
// Deno port of the old AWS email-service (nodemailer). Accepts JSON:
//   { to: string|string[], subject?, text?, filename?, contentBase64? }
// `contentBase64` is the report (PDF or .docx); the content type is inferred from the
// filename extension. `pdfBase64` is accepted as a legacy alias for contentBase64.
//
// Deploy:  supabase functions deploy send-report --no-verify-jwt
// Secrets: supabase secrets set SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... SMTP_FROM=...
//          (SMTP_SECURE=true for implicit TLS on port 465)
// Frontend: REACT_APP_EMAIL_ENDPOINT=https://<project>.functions.supabase.co/send-report

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

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const host = Deno.env.get('SMTP_HOST');
        const user = Deno.env.get('SMTP_USER');
        const pass = Deno.env.get('SMTP_PASS');
        const port = parseInt(Deno.env.get('SMTP_PORT') || '587', 10);
        const from = Deno.env.get('SMTP_FROM') || user;
        const secure = Deno.env.get('SMTP_SECURE') === 'true' || port === 465;
        if (!host || !user || !pass) return json({ error: 'SMTP is not configured' }, 500);

        const body = await req.json();
        const recipients = (Array.isArray(body.to) ? body.to : [body.to]).filter(Boolean);
        if (recipients.length === 0) return json({ error: 'No recipients provided' }, 400);

        const content64 = body.contentBase64 || body.pdfBase64;
        const filename = body.filename || 'report.pdf';

        const client = new SMTPClient({
            connection: { hostname: host, port, tls: secure, auth: { username: user, password: pass } },
        });
        await client.send({
            from: from!,
            to: recipients,
            subject: body.subject || 'ES Tools report',
            content: body.text || 'Please find the attached report.',
            attachments: content64
                ? [{ filename, contentType: contentTypeFor(filename), encoding: 'base64', content: content64 }]
                : [],
        });
        await client.close();

        return json({ ok: true });
    } catch (err) {
        console.error('send-report failed', err);
        return json({ error: String((err as Error)?.message || err) }, 500);
    }
});
