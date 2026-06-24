import { createClient } from '@supabase/supabase-js';

// Supabase client. Configure via .env / .env.local:
//   REACT_APP_SUPABASE_URL=https://<project>.supabase.co
//   REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   (new key format)
//   (REACT_APP_SUPABASE_ANON_KEY is also accepted for older projects)
const url = process.env.REACT_APP_SUPABASE_URL;
const clientKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

// The shared browser client, or null when env vars are missing. Every service/auth
// helper imports this and null-guards it so the app degrades instead of crashing when
// the backend is unconfigured. persistSession + autoRefreshToken keep the user logged
// in across reloads and silently refresh the access token.
export const supabase = (url && clientKey)
    ? createClient(url, clientKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

// True when both env vars were present at build time and a client exists.
export const isSupabaseConfigured = () => Boolean(supabase);

// Private Storage bucket holding generated report files (path: <uid>/<id>.pdf).
export const REPORTS_BUCKET = 'reports';
