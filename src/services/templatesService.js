// templatesService.js — the managed Word templates in the Supabase "templates" bucket.
// Each report service already prefers the bucket copy of its template and falls back to
// the bundled file under public/templates; this service is the manager-facing admin for
// those bucket copies (list / upload / revert). Names are fixed: the report services look
// them up by exact filename.
import { supabase } from '../lib/supabase';

const BUCKET = 'templates';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const MANAGED_TEMPLATES = [
    { name: 'photo-report.docx', label: 'Pothole report', tool: 'Pothole Report Generator' },
    { name: 'service-location.docx', label: 'Service location report', tool: 'Service Location Field Report' },
    { name: 'swms.docx', label: 'SWMS', tool: 'SWMS Generator' },
];
const isManaged = (name) => MANAGED_TEMPLATES.some((t) => t.name === name);

// → [{ name, label, tool, managed, updatedAt, size }] — one row per managed template.
export const listManagedTemplates = async () => {
    let rows = [];
    if (supabase) {
        const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 100 });
        if (error) throw error;
        rows = Array.isArray(data) ? data : [];   // a mocked/odd response must not crash the screen
    }
    return MANAGED_TEMPLATES.map((t) => {
        const hit = rows.find((r) => r.name === t.name);
        return { ...t, managed: !!hit, updatedAt: hit?.updated_at || null, size: hit?.metadata?.size ?? null };
    });
};

// Upload (or replace) a managed template. Only the fixed names are accepted.
export const uploadTemplate = async (name, file) => {
    if (!isManaged(name)) throw new Error(`${name} is not a managed template`);
    if (!supabase) throw new Error('Backend not configured');
    const { error } = await supabase.storage.from(BUCKET).upload(name, file, { upsert: true, contentType: DOCX });
    if (error) throw error;
};

// Delete the managed copy so the report service falls back to the bundled template.
export const removeTemplate = async (name) => {
    if (!isManaged(name)) throw new Error(`${name} is not a managed template`);
    if (!supabase) throw new Error('Backend not configured');
    const { error } = await supabase.storage.from(BUCKET).remove([name]);
    if (error) throw error;
};
