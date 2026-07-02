// Shared Drive Manager service layer.
// - Drives + membership: Google Drive (see googleDrive.js), re-exported here.
// - Directory + activity: Supabase tables (RLS admin/manager).
import { supabase } from '../../lib/supabase';
import { initials } from './data';

export * from './googleDrive';

// "Protected" drives can't be selected / bulk-changed (business rule; adjust to taste).
// The old desktop tool excluded Backups & Management from selection.
export const PROTECTED_DRIVES = ['Backups', 'Management'];
export const isProtected = (name) => PROTECTED_DRIVES.includes(name);

const rowToPerson = (r) => {
    const name = r.full_name || r.email;
    const [first, ...rest] = name.split(' ');
    return { id: r.id, email: r.email, name, first, last: rest.join(' '), initials: initials(first, rest.join(' ') || name[1]) };
};

// Relative time label from an ISO timestamp.
export const relative = (iso) => {
    const t = new Date(iso).getTime();
    if (!t) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 172800) return 'Yesterday';
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return `${Math.floor(s / 604800)}w ago`;
};

// ---- Directory (Supabase) ----
export const listDirectory = async () => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('shared_drive_directory').select('*').order('full_name');
    if (error) throw error;
    return (data || []).map(rowToPerson);
};

export const addToDirectory = async (fullName, email) => {
    if (!supabase) throw new Error('Backend not configured');
    const { data, error } = await supabase.from('shared_drive_directory')
        .insert({ full_name: fullName, email: email.toLowerCase() }).select().single();
    if (error) throw error;
    return rowToPerson(data);
};

export const removeFromDirectory = async (id) => {
    if (!supabase) throw new Error('Backend not configured');
    const { error } = await supabase.from('shared_drive_directory').delete().eq('id', id);
    if (error) throw error;
};

// ---- Activity (Supabase) ----
export const listActivity = async () => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('shared_drive_activity').select('*').order('ts', { ascending: false }).limit(100);
    if (error) throw error;
    return (data || []).map((r) => ({ id: r.id, type: r.type, title: r.title, detail: r.detail, tone: r.tone, ts: relative(r.ts) }));
};

export const logActivity = async (entry) => {
    if (!supabase) return;
    try { await supabase.from('shared_drive_activity').insert(entry); } catch { /* audit is non-fatal */ }
};
