// Supabase Edge Function: convert an uploaded .docx to PDF via the Google Drive API.
// Keeps conversion inside the Workspace tenant (no third-party SaaS, no self-hosted box).
//
// Contract (unchanged from the previous converter, so the frontend needs no change):
//   POST multipart/form-data with a "file" field (the rendered .docx) -> streams back a PDF.
//
// How it works: get a Google access token, upload the .docx as a Google Doc (which
// converts it), export that Doc as PDF, then delete the temp Doc.
//
// Two auth options — set EITHER set of secrets (see supabase/SETUP.md):
//   A) OAuth refresh token — all in the Google Cloud/Developer Console, NO admin console:
//        GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//   B) Service account + domain-wide delegation (needs the Workspace Admin console once):
//        GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY (PEM; \n handled), GOOGLE_IMPERSONATE_SUBJECT
// If the refresh-token secrets are present they win; otherwise it falls back to the SA.
//
// Deploy:  supabase functions deploy docx-to-pdf --no-verify-jwt
// Frontend: REACT_APP_DOCX_PDF_ENDPOINT=https://<project>.functions.supabase.co/docx-to-pdf

import { create } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
};

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const SCOPE = 'https://www.googleapis.com/auth/drive';

const err = (message: string, status = 500) =>
    new Response(JSON.stringify({ error: message }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Import the service account's PEM (PKCS8) private key as a Web Crypto signing key.
const importPrivateKey = async (pem: string) => {
    const b64 = pem.replace(/\\n/g, '\n')
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s+/g, '');
    const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('pkcs8', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
};

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const tokenFromResponse = async (res: Response) => {
    if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
    return (await res.json()).access_token as string;
};

// A) OAuth refresh-token flow — no admin console; acts as the user who consented.
const getTokenViaRefresh = (clientId: string, clientSecret: string, refreshToken: string) =>
    fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    }).then(tokenFromResponse);

// B) Service-account JWT-bearer flow — impersonates `subject` via domain-wide delegation.
const getTokenViaServiceAccount = async (email: string, pem: string, subject: string) => {
    const key = await importPrivateKey(pem);
    const now = Math.floor(Date.now() / 1000);
    const jwt = await create(
        { alg: 'RS256', typ: 'JWT' },
        { iss: email, sub: subject, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
        key,
    );
    return fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    }).then(tokenFromResponse);
};

// Pick whichever credentials are configured (refresh token wins).
const getAccessToken = () => {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
    if (clientId && clientSecret && refreshToken) return getTokenViaRefresh(clientId, clientSecret, refreshToken);

    const email = Deno.env.get('GOOGLE_SA_EMAIL');
    const pem = Deno.env.get('GOOGLE_SA_PRIVATE_KEY');
    const subject = Deno.env.get('GOOGLE_IMPERSONATE_SUBJECT');
    if (email && pem && subject) return getTokenViaServiceAccount(email, pem, subject);

    return null; // nothing configured
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const inForm = await req.formData();
        const file = inForm.get('file');
        if (!(file instanceof File)) return err('No file', 400);
        const fileBytes = new Uint8Array(await file.arrayBuffer());

        const tokenPromise = getAccessToken();
        if (!tokenPromise) return err('Google Drive converter is not configured');
        const token = await tokenPromise;
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
