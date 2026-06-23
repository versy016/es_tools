import { createClient } from '@supabase/supabase-js';

// Supabase client. Configure via .env:
//   REACT_APP_SUPABASE_URL=https://<project>.supabase.co
//   REACT_APP_SUPABASE_ANON_KEY=<anon public key>
const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = (url && anonKey)
    ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

export const isSupabaseConfigured = () => Boolean(supabase);

export const REPORTS_BUCKET = 'reports';
