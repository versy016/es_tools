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

// Drives a brand-new member should NOT get by default. The "New member" quick-pick in the
// add-members wizard selects every (non-protected) drive except these. Matched by name,
// case-insensitive + trimmed. Edit this list to change the default.
export const NEW_MEMBER_EXCLUDED_DRIVES = ['Accounts QT'];
export const isNewMemberExcluded = (name) =>
    NEW_MEMBER_EXCLUDED_DRIVES.some((n) => n.toLowerCase() === String(name || '').trim().toLowerCase());

// ---- Audit configuration (see docs/superpowers/specs/2026-10-02-shared-drive-audit-design.md) ----
// Ordered rules mapping a shared drive to where its client folders live. `match` is a
// string (exact, case-insensitive) or RegExp on the drive name. `rootPath` is the folder
// chain under the drive root that holds client folders ([] = drive root itself).
// `singleClient: true` means the drive IS one client and its top-level folders are projects.
export const AUDIT_DRIVE_ROOTS = [
    { match: /^_[A-Z]$/i, rootPath: [] },
    { match: 'ES Cloud', rootPath: ['_Clients'] },
    { match: 'Accounts QT', rootPath: ['__Accounts', '__Clients'] },
    { match: 'United Precast', rootPath: [], singleClient: true },
    { match: 'WSP Australia', rootPath: [], singleClient: true },
];
// Drives that skip the client/project checks (still counted for the item cap).
export const AUDIT_EXCLUDED_DRIVES = ['Backups', 'Management', 'Training', 'DIT', /^Cadastral/i];
export const AUDIT_PROJECT_ITEM_LIMIT = 3000;   // project folders above this are flagged
export const AUDIT_DRIVE_WARN = 400000;         // 80% of Google's 500k shared-drive item cap
export const AUDIT_DRIVE_CRITICAL = 450000;     // 90%
export const AUDIT_ACTIVITY_DAYS = 90;          // Reports API look-back window
export const AUDIT_MAX_ROWS = 200;              // per-list cap stored/displayed per run

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

// ---- Audit runs (Supabase, migration 0005) ----
// Upsert one run row (snake_case columns). Omit `id` to create; pass it to update progress.
export const saveAuditRun = async (run) => {
    if (!supabase) return { id: null };
    const row = { ...run };
    if (row.id === undefined) delete row.id;
    const { data, error } = await supabase.from('shared_drive_audit_runs').upsert(row).select().single();
    if (error) throw error;
    return { id: data?.id || row.id || null };
};

// Most recent run (by started_at) or null.
export const loadLatestAuditRun = async () => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('shared_drive_audit_runs').select('*').order('started_at', { ascending: false }).limit(1);
    if (error) throw error;
    return (data && data[0]) || null;
};
