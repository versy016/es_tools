import { uploadData, list, getUrl, downloadData, remove } from 'aws-amplify/storage';

// Reports are persisted to the app's S3 bucket (per-user, accessLevel "private").
// PDF lives at reports/<id>.pdf and its metadata at reports/<id>.json.
// Every call is guarded so the UI degrades to an empty state if storage is unavailable.

const OPTS = { accessLevel: 'private' };
const keyOf = (i) => i.key || i.path || '';

export const saveReport = async ({ id, blob, meta }) => {
    try {
        await uploadData({ key: `reports/${id}.pdf`, data: blob, options: { ...OPTS, contentType: 'application/pdf' } }).result;
        const metaBlob = new Blob([JSON.stringify(meta)], { type: 'application/json' });
        await uploadData({ key: `reports/${id}.json`, data: metaBlob, options: { ...OPTS, contentType: 'application/json' } }).result;
        return true;
    } catch (err) {
        console.warn('saveReport failed (storage unavailable?)', err);
        return false;
    }
};

export const listReports = async () => {
    try {
        const res = await list({ prefix: 'reports/', options: { ...OPTS, listAll: true } });
        const metas = (res.items || []).filter((i) => keyOf(i).endsWith('.json'));
        const out = [];
        for (const m of metas) {
            try {
                const { body } = await downloadData({ key: keyOf(m), options: OPTS }).result;
                out.push(JSON.parse(await body.text()));
            } catch { /* skip unreadable item */ }
        }
        return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (err) {
        console.warn('listReports failed (storage unavailable?)', err);
        return [];
    }
};

export const getReportUrl = async (id) => {
    try {
        const { url } = await getUrl({ key: `reports/${id}.pdf`, options: { ...OPTS, expiresIn: 300 } });
        return url.toString();
    } catch (err) {
        console.warn('getReportUrl failed', err);
        return null;
    }
};

export const getReportBlob = async (id) => {
    try {
        const { body } = await downloadData({ key: `reports/${id}.pdf`, options: OPTS }).result;
        return await body.blob();
    } catch (err) {
        console.warn('getReportBlob failed', err);
        return null;
    }
};

export const removeReport = async (id) => {
    try {
        await remove({ key: `reports/${id}.pdf`, options: OPTS });
        await remove({ key: `reports/${id}.json`, options: OPTS });
        return true;
    } catch (err) {
        console.warn('removeReport failed', err);
        return false;
    }
};
