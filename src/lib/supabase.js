import { createClient } from '@supabase/supabase-js';

// Supabase client. Configure via .env / .env.local:
//   REACT_APP_SUPABASE_URL=https://<project>.supabase.co
//   REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   (new key format)
//   (REACT_APP_SUPABASE_ANON_KEY is also accepted for older projects)
const url = process.env.REACT_APP_SUPABASE_URL;
const clientKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = (url && clientKey)
    ? createClient(url, clientKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

export const isSupabaseConfigured = () => Boolean(supabase);

export const REPORTS_BUCKET = 'reports';
