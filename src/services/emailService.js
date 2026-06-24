import { EMAIL_ENDPOINT, REPORT_ARCHIVE_EMAIL } from '../config';

// Single send path for both report tools and the Reports screen. Posts a generated
// report (PDF or .docx) as a base64 attachment to the configured backend
// (Supabase send-report edge function). Throws if unconfigured or on failure.

export const isEmailConfigured = () => Boolean(EMAIL_ENDPOINT);

export const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

export const sendReportEmail = async ({ to, subject, text, filename, contentBase64, archive = true }) => {
    if (!EMAIL_ENDPOINT) throw new Error('Email is not configured (REACT_APP_EMAIL_ENDPOINT is not set).');
    const recipients = Array.from(new Set([
        ...(Array.isArray(to) ? to : [to]).filter(Boolean),
        ...(archive ? [REPORT_ARCHIVE_EMAIL] : []),
    ]));
    const res = await fetch(EMAIL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `contentBase64` is the canonical field; `pdfBase64` kept for backwards compatibility.
        body: JSON.stringify({ to: recipients, subject, text, filename, contentBase64, pdfBase64: contentBase64 }),
    });
    if (!res.ok) throw new Error(`Email service returned ${res.status}`);
    return true;
};
