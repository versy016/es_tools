import { EMAIL_ENDPOINT, REPORT_ARCHIVE_EMAIL } from '../config';

// Single send path for both report tools and the Reports screen. Posts a generated
// report (PDF or .docx) as a base64 attachment to the configured backend
// (Supabase send-report edge function). Throws if unconfigured or on failure.

export const isEmailConfigured = () => Boolean(EMAIL_ENDPOINT);

// Read a Blob (PDF/.docx) and resolve its raw base64 (strips the "data:...;base64," prefix
// that readAsDataURL prepends) for use as an email attachment body.
export const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

// Send one report email. `to` may be a single address or array; the internal archive
// address is appended (unless archive=false) and the whole list is de-duped via a Set.
// Throws if the endpoint isn't configured or the backend returns non-2xx.
export const sendReportEmail = async ({ to, subject, text, filename, contentBase64, archive = true }) => {
    if (!EMAIL_ENDPOINT) throw new Error('Email is not configured (REACT_APP_EMAIL_ENDPOINT is not set).');
    const recipients = Array.from(new Set([
        ...(Array.isArray(to) ? to : [to]).filter(Boolean),
        ...(archive ? [REPORT_ARCHIVE_EMAIL] : []),
    ]));
    let res;
    try {
        res = await fetch(EMAIL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // `contentBase64` is the canonical field; `pdfBase64` kept for backwards compatibility.
            body: JSON.stringify({ to: recipients, subject, text, filename, contentBase64, pdfBase64: contentBase64 }),
        });
    } catch (e) {
        // Network/CORS failure before any HTTP response.
        throw new Error('Could not reach the email service (network/CORS). Check REACT_APP_EMAIL_ENDPOINT and that the function is deployed.');
    }
    if (!res.ok) {
        // Surface the backend's JSON error (e.g. SMTP timeout / App Password) so the user sees why.
        let detail = '';
        try { detail = (await res.json())?.error || ''; } catch (e) { /* non-JSON body */ }
        throw new Error(detail || `Email service returned ${res.status}`);
    }
    return true;
};
