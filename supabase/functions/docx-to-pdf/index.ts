// Supabase Edge Function: convert an uploaded .docx to PDF.
// The browser POSTs multipart/form-data with a "file" field (the rendered .docx);
// this forwards it to a Gotenberg instance (LibreOffice) and streams back the PDF.
//
// Deploy:  supabase functions deploy docx-to-pdf --no-verify-jwt
// Secret:  supabase secrets set GOTENBERG_URL=https://<your-gotenberg-host>
// Frontend: REACT_APP_DOCX_PDF_ENDPOINT=https://<project>.functions.supabase.co/docx-to-pdf
//
// Gotenberg is free/open-source (run the Docker image). To use a SaaS converter
// (e.g. CloudConvert) instead, swap the fetch below for that API.

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const GOTENBERG_URL = Deno.env.get('GOTENBERG_URL');
    if (!GOTENBERG_URL) {
        return new Response(JSON.stringify({ error: 'GOTENBERG_URL not configured' }), {
            status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }

    try {
        const inForm = await req.formData();
        const file = inForm.get('file');
        if (!(file instanceof File)) {
            return new Response(JSON.stringify({ error: 'No file' }), {
                status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }

        const out = new FormData();
        out.append('files', file, file.name || 'report.docx');

        const res = await fetch(`${GOTENBERG_URL.replace(/\/$/, '')}/forms/libreoffice/convert`, {
            method: 'POST',
            body: out,
        });
        if (!res.ok) throw new Error(`Gotenberg ${res.status}`);

        return new Response(res.body, {
            headers: { ...CORS, 'Content-Type': 'application/pdf' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }
});
