import { supabase, REPORTS_BUCKET } from '../lib/supabase';

// Reports: PDF in the Supabase "reports" bucket (path <uid>/<id>.pdf), metadata in the
// "reports" table. RLS gives each user their own + lets managers/admins see all.
// Every call is guarded so the UI degrades to an empty state if Supabase is unavailable.

// Current auth user id, or null (used to namespace storage paths). Error-safe.
const uid = async () => {
    try {
        const { data } = await supabase.auth.getUser();
        return data?.user?.id || null;
    } catch { return null; }
};

// Map a snake_case DB row to the camelCase shape the UI expects; created_at becomes an
// epoch ms (0 when missing) for easy sorting/formatting.
const rowToReport = (r) => ({
    id: r.id,
    title: r.title,
    meta: r.meta,
    status: r.status,
    siteAddress: r.site_address,
    client: r.client,
    storagePath: r.storage_path,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
});

// Upsert a report: upload the PDF blob to reports/<uid>/<id>.pdf (overwriting any prior
// version) then upsert the metadata row. RLS scopes both to the owner. Returns true on
// success, false on any failure (incl. no auth user) — never throws to the caller.
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const saveReport = async ({ id, blob, meta }) => {
    if (!supabase) return false;
    try {
        const userId = await uid();
        if (!userId) { console.warn('saveReport: no signed-in user — not saved'); return false; }
        // Store with the right extension/type: a PDF when the converter ran, else the .docx.
        const isPdf = ((blob && blob.type) || '').includes('pdf');
        const ext = isPdf ? 'pdf' : 'docx';
        const path = `${userId}/${id}.${ext}`;
        const up = await supabase.storage.from(REPORTS_BUCKET).upload(path, blob, {
            upsert: true,
            contentType: (blob && blob.type) || (isPdf ? 'application/pdf' : DOCX_MIME),
        });
        if (up.error) throw up.error;
        const { error } = await supabase.from('reports').upsert({
            id,
            title: meta.title,
            site_address: meta.siteAddress,
            client: meta.client,
            status: meta.status,
            photo_count: meta.photoCount,
            pothole_count: meta.potholeCount,
            storage_path: path,
            meta: meta.meta,
        });
        if (error) throw error;
        return true;
    } catch (err) {
        console.warn('saveReport failed', err?.message || err);
        return false;
    }
};

// Save an in-progress draft: the tool's form STATE (not a rendered file) is stored as
// JSON in the reports bucket so it can be re-opened and finished later. Status 'Draft'.
export const saveDraft = async ({ id, tool, state, title, meta }) => {
    if (!supabase) return false;
    try {
        const userId = await uid();
        if (!userId) { console.warn('saveDraft: no signed-in user — not saved'); return false; }
        const path = `${userId}/${id}.json`;
        const blob = new Blob([JSON.stringify({ tool, state })], { type: 'application/json' });
        const up = await supabase.storage.from(REPORTS_BUCKET).upload(path, blob, { upsert: true, contentType: 'application/json' });
        if (up.error) throw up.error;
        const { error } = await supabase.from('reports').upsert({
            id, title, meta, status: 'Draft', storage_path: path,
        });
        if (error) throw error;
        return true;
    } catch (err) {
        console.warn('saveDraft failed', err?.message || err);
        return false;
    }
};

// Load a saved draft's { tool, state } JSON so a tool can re-hydrate from it. Null on miss.
export const loadDraft = async (id) => {
    if (!supabase) return null;
    try {
        const { data: row } = await supabase.from('reports').select('storage_path').eq('id', id).single();
        const path = row?.storage_path;
        if (!path) return null;
        const { data, error } = await supabase.storage.from(REPORTS_BUCKET).download(path);
        if (error) throw error;
        return JSON.parse(await data.text());
    } catch (err) {
        console.warn('loadDraft failed', err?.message || err);
        return null;
    }
};

// List reports visible to the caller (own rows, plus all rows for managers/admins via
// RLS), newest first. Returns [] on failure.
export const listReports = async () => {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(rowToReport);
    } catch (err) {
        console.warn('listReports failed', err);
        return [];
    }
};

// Look up a report's storage_path by id (RLS enforces visibility). Null if not found.
const pathOf = async (id) => {
    try {
        const { data } = await supabase.from('reports').select('storage_path').eq('id', id).single();
        return data?.storage_path || null;
    } catch { return null; }
};

// Short-lived (5 min) signed URL for viewing/downloading the report file. Null on miss.
export const getReportUrl = async (id) => {
    if (!supabase) return null;
    try {
        const path = await pathOf(id);
        if (!path) return null;
        const { data, error } = await supabase.storage.from(REPORTS_BUCKET).createSignedUrl(path, 300);
        if (error) throw error;
        return data?.signedUrl || null;
    } catch (err) {
        console.warn('getReportUrl failed', err);
        return null;
    }
};

// Download the report file as a Blob (e.g. to re-attach to an email). Null on miss.
export const getReportBlob = async (id) => {
    if (!supabase) return null;
    try {
        const path = await pathOf(id);
        if (!path) return null;
        const { data, error } = await supabase.storage.from(REPORTS_BUCKET).download(path);
        if (error) throw error;
        return data;
    } catch (err) {
        console.warn('getReportBlob failed', err);
        return null;
    }
};

// Delete a report: remove the storage object (if any) then the metadata row. RLS limits
// this to the owner. Returns true unless an error is thrown.
export const removeReport = async (id) => {
    if (!supabase) return false;
    try {
        const path = await pathOf(id);
        if (path) await supabase.storage.from(REPORTS_BUCKET).remove([path]);
        await supabase.from('reports').delete().eq('id', id);
        return true;
    } catch (err) {
        console.warn('removeReport failed', err);
        return false;
    }
};
