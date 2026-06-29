import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { supabase } from '../lib/supabase';

// Renders the Photo & Pothole report .docx in the browser from the letterhead-based
// template (public/templates/photo-report.docx, overridable from the Supabase
// "templates" bucket). The matching PDF is produced by docxToPdf (the docx-to-pdf
// edge function), same as the Service Location report.

const TEMPLATE_NAME = 'photo-report.docx';
const PDF_ENDPOINT = process.env.REACT_APP_DOCX_PDF_ENDPOINT || '';
// 1x1 transparent PNG, used when an image tag has no data so the module never throws.
const BLANK_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const base64ToArrayBuffer = (src) => {
    const b64 = (src && src.includes(',')) ? src.split(',')[1] : (src || BLANK_PNG);
    const bin = atob(b64 || BLANK_PNG);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
};

// Split an array into fixed-size groups (last group may be short).
const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const loadTemplate = async () => {
    if (supabase) {
        try {
            // Fresh signed URL + cache:'no-store' so a bucket update is picked up immediately
            // (supabase .download() uses the browser cache, which Ctrl+Shift+R won't bypass).
            const { data: signed, error } = await supabase.storage.from('templates').createSignedUrl(TEMPLATE_NAME, 60);
            if (error) {
                console.warn(`[photoReport] templates/${TEMPLATE_NAME} not loaded from bucket: ${error.message}. Using the bundled template.`);
            } else if (signed?.signedUrl) {
                const res = await fetch(signed.signedUrl, { cache: 'no-store' });
                if (res.ok) {
                    console.info('[photoReport] using managed template from the "templates" bucket.');
                    return await res.arrayBuffer();
                }
                console.warn(`[photoReport] templates fetch returned ${res.status}. Using the bundled template.`);
            }
        } catch (e) {
            console.warn(`[photoReport] templates bucket load failed: ${e?.message || e}. Using the bundled template.`);
        }
    }
    const res = await fetch(`${process.env.PUBLIC_URL || ''}/templates/${TEMPLATE_NAME}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Photo report template not found');
    return res.arrayBuffer();
};

// Map the Photo Report tool's form/state to the template tags.
const buildData = (job, signoff) => {
    const sign = signoff || {};
    const data = {
        date: job.date || '',
        locatorName: job.locatorName || '',
        dbydNo: job.dbydNo || '',
        refNo: job.refNo || '',
        siteAddress: job.siteAddress || '',
        scopeOfWorks: job.scopeOfWorks || '',
        clientName: job.clientName || '',
        clientContact: job.clientContact || '',
        clientMobile: job.clientMobile || '',
        dbydEmail: job.dbydEmail || '',
        comments: job.comments || '',
        // End-of-report sign-off block.
        signLocator: sign.locatorName || '',
        hasSign: !!sign.signature,
        signImage: sign.signature || '',
        signDate: sign.date || '',
        // One block per photo; potholes render under the main image in an ADAPTIVE
        // grid: 1 pothole -> one big image, 2 -> 2 columns, 3 -> 3 columns, 4+ -> a
        // 4-column grid (so fewer potholes show bigger). The column count picks the
        // matching template section (g1/g2/g3/g4) and image size (see getSize).
        photos: (job.photos || []).map((p, i) => {
            const phs = p.potholes || [];
            const n = phs.length;
            const cols = n <= 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : 4;
            const prefix = `g${cols}`;
            const rows = chunk(phs, cols).map((group) => {
                const row = {};
                for (let c = 0; c < cols; c++) {
                    const ph = group[c];
                    row[`${prefix}c${c}img`] = ph ? ph.src : '';        // '' -> BLANK_PNG (invisible)
                    row[`${prefix}c${c}label`] = ph ? (ph.label || '') : '';
                }
                return row;
            });
            return {
                num: String(i + 1).padStart(2, '0'),
                photo: p.flattenedDataUrl || p.src,
                hasPotholes: n > 0,
                g1: cols === 1, g2: cols === 2, g3: cols === 3, g4: cols === 4,
                [`${prefix}rows`]: rows,
            };
        }),
    };
    // Per-utility checklist tags — the "Utilities located" table is the source of
    // truth: {<key>_quality} + {<key>_comment} for every utility row.
    Object.entries(job.utilData || {}).forEach(([key, v]) => {
        data[`${key}_quality`] = (v && v.quality) || '';
        data[`${key}_comment`] = (v && v.comment) || '';
    });
    return data;
};

export const renderDocx = async (job, signoff) => {
    const content = await loadTemplate();
    try {
        const zip = new PizZip(content);
        const imageModule = new ImageModule({
            getImage: (tagValue) => base64ToArrayBuffer(tagValue),
            // Size per image tag: the main photo large, signature medium, pothole thumb small.
            getSize: (img, tagValue, tagName) => {
                if (tagName === 'photo') return [600, 400];          // main photo: wide + taller
                if (tagName === 'signImage') return [230, 85];       // sign-off signature
                if (/^g1c\d+img$/.test(tagName)) return [480, 360];  // 1 pothole -> big
                if (/^g2c\d+img$/.test(tagName)) return [320, 240];  // 2 -> 2 columns
                if (/^g3c\d+img$/.test(tagName)) return [215, 160];  // 3 -> 3 columns
                if (/^g4c\d+img$/.test(tagName)) return [150, 112];  // 4+ -> 4-col grid
                return [92, 70];
            },
        });
        const doc = new Docxtemplater(zip, { modules: [imageModule], paragraphLoop: true, linebreaks: true });
        doc.render(buildData(job, signoff));
        return doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
    } catch (err) {
        console.error('photo report renderDocx failed', err?.properties?.errors || err);
        throw new Error('Could not generate the report from the template.');
    }
};

// Convert the rendered .docx to PDF via the docx-to-pdf edge function. Null if unconfigured.
export const docxToPdf = async (docxBlob, filename = 'Pothole Report.docx') => {
    if (!PDF_ENDPOINT) return null;
    try {
        const fd = new FormData();
        fd.append('file', docxBlob, filename);
        const res = await fetch(PDF_ENDPOINT, { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`PDF converter returned ${res.status}`);
        return await res.blob();
    } catch (err) {
        console.warn('photo report docxToPdf failed', err);
        return null;
    }
};

export const isPdfConfigured = () => Boolean(PDF_ENDPOINT);
