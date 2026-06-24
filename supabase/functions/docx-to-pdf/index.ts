// Supabase Edge Function: convert an uploaded .docx to PDF via the Google Drive API.
// Keeps conversion inside the Workspace tenant (no third-party SaaS, no self-hosted box).
//
// Contract (unchanged from the previous converter, so the frontend needs no change):
//   POST multipart/form-data with a "file" field (the rendered .docx) -> streams back a PDF.
//
// How it works: mint a Google access token from an OAuth refresh token, upload the .docx
// as a Google Doc (which converts it), export that Doc as PDF, then delete the temp Doc.
// Auth is configured entirely in the Google Cloud Console — no Workspace admin needed.
//
// Deploy:  supabase functions deploy docx-to-pdf --no-verify-jwt
// Secrets (see supabase/SETUP.md §5a):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// Frontend: REACT_APP_DOCX_PDF_ENDPOINT=https://<project>.functions.supabase.co/docx-to-pdf

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
};

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const err = (message: string, status = 500) =>
    new Response(JSON.stringify({ error: message }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Exchange the long-lived OAuth refresh token for a short-lived Drive access token.
const getAccessToken = async (clientId: string, clientSecret: string, refreshToken: string) => {
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
    return (await res.json()).access_token as string;
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
    if (!clientId || !clientSecret || !refreshToken) return err('Google Drive converter is not configured');

    try {
        const inForm = await req.formData();
        const file = inForm.get('file');
        if (!(file instanceof File)) return err('No file', 400);
        const fileBytes = new Uint8Array(await file.arrayBuffer());

        const token = await getAccessToken(clientId, clientSecret, refreshToken);
        const auth = { Authorization: `Bearer ${token}` };

        // 1) Upload the .docx as a Google Doc (uploadType=multipart converts it on ingest).
        const boundary = 'esToolsDocxBoundary';
        const metadata = JSON.stringify({ name: (file.name || 'report').replace(/\.docx$/i, ''), mimeType: GOOGLE_DOC_MIME });
        const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`;
        const body = new Blob([head, fileBytes, `\r\n--${boundary}--`]);
        const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: { ...auth, 'Content-Type': `multipart/related; boundary=${boundary}` },
            body,
        });
        if (!up.ok) throw new Error(`Drive upload failed (${up.status}): ${await up.text()}`);
        const { id } = await up.json();

        // 2) Export that Doc as PDF.
        const ex = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=application/pdf`, { headers: auth });
        const pdf = ex.ok ? new Uint8Array(await ex.arrayBuffer()) : null;
        const exErr = ex.ok ? '' : `Drive export failed (${ex.status}): ${await ex.text()}`;

        // 3) Always clean up the temp Doc, even if the export failed.
        await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, { method: 'DELETE', headers: auth }).catch(() => {});

        if (!pdf) throw new Error(exErr);
        return new Response(pdf, { headers: { ...CORS, 'Content-Type': 'application/pdf' } });
    } catch (e) {
        console.error('docx-to-pdf failed', e);
        return err(String((e as Error)?.message || e));
    }
});
