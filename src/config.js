// Central, env-driven app config. One place to change instead of hunting through screens.

// Backend email endpoint (Supabase send-report edge function / SMTP). Empty = email disabled.
export const EMAIL_ENDPOINT = process.env.REACT_APP_EMAIL_ENDPOINT || '';

// An internal copy of every generated/sent report is archived to this address.
// Flip to bgosling@engsurveys.com.au by setting REACT_APP_REPORT_ARCHIVE_EMAIL.
export const REPORT_ARCHIVE_EMAIL =
    process.env.REACT_APP_REPORT_ARCHIVE_EMAIL || 'sverma@engsurveys.com.au';

// Google OAuth client id for the Shared Drive Manager (Drive API, per-user auth).
// Empty = the tool shows a "not configured" notice. Create a Web OAuth client in the
// Google Cloud console and set REACT_APP_GOOGLE_CLIENT_ID. (Public value, baked in.)
export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
