import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { supabase } from '../lib/supabase';

// Renders the Service Location Field Report .docx in the browser from the
// template (public/templates/service-location.docx, overridable from the Supabase
// "templates" bucket), then optionally converts it to PDF via a converter endpoint.

const TEMPLATE_NAME = 'service-location.docx';
const PDF_ENDPOINT = process.env.REACT_APP_DOCX_PDF_ENDPOINT || '';

// Asset checklist type → template tag prefix.
const ASSET_PREFIX = {
    'Gas': 'Gas',
    'Sewer': 'Sewer',
    'Stormwater': 'Stormwater',
    'Telecommunications': 'Telecommunications',
    'SAPN/Electrical': 'SAPN',
    'Traffic Signals': 'Traffic',
    'Street Lighting': 'Street',
    'Water': 'Water',
    'Fire Main': 'Fire',
    'Optic Fibre': 'Optic',
    'Reclaimed Water': 'Reclaimed',
    'Unknown Services': 'Unknown',
};

// 1x1 transparent PNG, used when an image tag has no data so the module never throws.
const BLANK_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Decode a base64 string (or full data URL) into an ArrayBuffer for the image module.
const base64ToArrayBuffer = (src) => {
    const b64 = (src && src.includes(',')) ? src.split(',')[1] : (src || BLANK_PNG);
    const bin = atob(b64 || BLANK_PNG);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
};

// Fetch the .docx template bytes: prefer the managed copy in the Supabase "templates"
// bucket (so it can be updated without a redeploy), else fall back to the bundled file
// in /public. Throws only if the bundled fallback is also missing.
const loadTemplate = async () => {
    if (supabase) {
        try {
            // Use a fresh signed URL (unique token each call) + cache:'no-store' so an updated
            // template in the bucket is picked up immediately — never a stale browser/CDN copy.
            // (supabase .download() goes through the browser's default cache, which Ctrl+Shift+R
            // doesn't bypass for runtime fetches, so an edited template kept loading the old one.)
            const { data: signed, error } = await supabase.storage.from('templates').createSignedUrl(TEMPLATE_NAME, 60);
            if (error) {
                console.warn(`[serviceReport] templates/${TEMPLATE_NAME} not loaded from bucket: ${error.message}. Using the bundled template.`);
            } else if (signed?.signedUrl) {
                const res = await fetch(signed.signedUrl, { cache: 'no-store' });
                if (res.ok) {
                    console.info('[serviceReport] using managed template from the "templates" bucket.');
                    return await res.arrayBuffer();
                }
                console.warn(`[serviceReport] templates fetch returned ${res.status}. Using the bundled template.`);
            }
        } catch (e) {
            console.warn(`[serviceReport] templates bucket load failed: ${e?.message || e}. Using the bundled template.`);
        }
    }
    const res = await fetch(`${process.env.PUBLIC_URL || ''}/templates/${TEMPLATE_NAME}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Template not found');
    return res.arrayBuffer();
};

// Build the docxtemplater data object from the Service Location form data.
const buildData = (form) => {
    const data = {
        date: form.date || '',
        clientOrProject: form.clientOrProject || '',
        jobLocation: form.jobLocation || '',
        contact: form.contact || '',
        contactMob: form.contactMob || '',
        surveyor: form.surveyor || '',
        locaterMob: form.locaterMob || '',
        dbydjobno: form.dbydjobno || '',
        dbyddate: form.dbyddate || '',
        dbydavailable: form.dbydavailable || '',
        dbydplans: form.dbydplans || '',
        SWMS: form.SWMS || '',
        plansupply: form.plansupply || '',
        dbydByClient: !!form.dbydByClient,
        sitename: form.sitename || '',
        addnotes: Array.isArray(form.addnotes) ? form.addnotes.join('\n') : (form.addnotes || ''),
        // End-of-report sign-off block.
        signLocator: form.signLocator || '',
        hasSign: !!form.signImage,
        signImage: form.signImage || '',
        signDate: form.signDate || '',
        // Image-module loop: each entry's `data` (base64 photo) is resolved by getImage;
        // {name}/{description} render as captions under each photo. Accepts string or object.
        photos: (form.photos || []).map((p) => (
            typeof p === 'string'
                ? { data: p, name: '', description: '' }
                : { data: p.data, name: p.name || '', description: p.description || '' }
        )),
    };
    // Blank every checklist tag, then fill the selected ones.
    Object.values(ASSET_PREFIX).forEach((prefix) => {
        data[`${prefix}_quality`] = '';
        data[`${prefix}_comment`] = '';
    });
    (form.checklist || []).forEach((item) => {
        const prefix = ASSET_PREFIX[item.assetType];
        if (!prefix) return;
        data[`${prefix}_quality`] = item.quality || '';
        data[`${prefix}_comment`] = item.comment || '';
    });
    return data;
};

// Render the populated .docx Blob from the template + form data. The free image module
// renders each photo tag at a fixed 450x320. Throws a user-friendly Error on template
// failures (real docxtemplater detail is logged to the console).
export const renderDocx = async (form) => {
    const content = await loadTemplate();
    try {
        const zip = new PizZip(content);
        const imageModule = new ImageModule({
            getImage: (tagValue) => base64ToArrayBuffer(tagValue),
            // One photo per row (~430px wide); the sign-off signature renders smaller.
            getSize: (img, tagValue, tagName) => (tagName === 'signImage' ? [230, 85] : [430, 305]),
        });
        const doc = new Docxtemplater(zip, { modules: [imageModule], paragraphLoop: true, linebreaks: true });
        doc.render(buildData(form));
        return doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
    } catch (err) {
        // docxtemplater errors are cryptic; surface a clean message, keep the detail in the console.
        console.error('renderDocx failed', err?.properties?.errors || err);
        throw new Error('Could not generate the report from the template. The template may be invalid or out of date.');
    }
};

// Convert a rendered .docx blob to PDF via the converter endpoint (the docx-to-pdf
// Supabase Edge Function, which uses the Google Drive API). Returns null if not configured.
export const docxToPdf = async (docxBlob, filename = 'report.docx') => {
    if (!PDF_ENDPOINT) return null;
    try {
        const fd = new FormData();
        fd.append('file', docxBlob, filename);
        const res = await fetch(PDF_ENDPOINT, { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`PDF converter returned ${res.status}`);
        return await res.blob();
    } catch (err) {
        console.warn('docxToPdf failed', err);
        return null;
    }
};

export const isPdfConfigured = () => Boolean(PDF_ENDPOINT);
