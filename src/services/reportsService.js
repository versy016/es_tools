import { supabase, REPORTS_BUCKET } from '../lib/supabase';

// Reports: PDF in the Supabase "reports" bucket (path <uid>/<id>.pdf), metadata in the
// "reports" table. RLS gives each user their own + lets managers/admins see all.
// Every call is guarded so the UI degrades to an empty state if Supabase is unavailable.

const uid = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
};

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

export const saveReport = async ({ id, blob, meta }) => {
    if (!supabase) return false;
    try {
        const userId = await uid();
        const path = `${userId}/${id}.pdf`;
        const up = await supabase.storage.from(REPORTS_BUCKET).upload(path, blob, { upsert: true, contentType: 'application/pdf' });
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
        console.warn('saveReport failed', err);
        return false;
    }
};

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

const pathOf = async (id) => {
    const { data } = await supabase.from('reports').select('storage_path').eq('id', id).single();
    return data?.storage_path || null;
};

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
