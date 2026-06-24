// Central, env-driven app config. One place to change instead of hunting through screens.

// Backend email endpoint (Supabase send-report edge function / SMTP). Empty = email disabled.
export const EMAIL_ENDPOINT = process.env.REACT_APP_EMAIL_ENDPOINT || '';

// An internal copy of every generated/sent report is archived to this address.
// Flip to bgosling@engsurveys.com.au by setting REACT_APP_REPORT_ARCHIVE_EMAIL.
export const REPORT_ARCHIVE_EMAIL =
    process.env.REACT_APP_REPORT_ARCHIVE_EMAIL || 'sverma@engsurveys.com.au';
