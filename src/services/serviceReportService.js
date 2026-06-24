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

const base64ToArrayBuffer = (src) => {
    const b64 = src.includes(',') ? src.split(',')[1] : src;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
};

const loadTemplate = async () => {
    if (supabase) {
        try {
            const { data } = await supabase.storage.from('templates').download(TEMPLATE_NAME);
            if (data) return await data.arrayBuffer();
        } catch { /* fall back to bundled */ }
    }
    const res = await fetch(`${process.env.PUBLIC_URL || ''}/templates/${TEMPLATE_NAME}`);
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
        photos: (form.photos || []).map((p) => ({ data: p })),
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

export const renderDocx = async (form) => {
    const content = await loadTemplate();
    try {
        const zip = new PizZip(content);
        const imageModule = new ImageModule({
            getImage: (tagValue) => base64ToArrayBuffer(tagValue),
            getSize: () => [450, 320],
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

// Convert a rendered .docx blob to PDF via the converter endpoint (Gotenberg /
// CloudConvert behind a Supabase Edge Function). Returns null if not configured.
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
