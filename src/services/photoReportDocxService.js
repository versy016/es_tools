import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { supabase } from '../lib/supabase';
import { getUtility, QUALITY_LEVELS } from '../report/legendColors';

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

const loadTemplate = async () => {
    if (supabase) {
        try {
            const { data } = await supabase.storage.from('templates').download(TEMPLATE_NAME);
            if (data) return await data.arrayBuffer();
        } catch { /* fall back to bundled */ }
    }
    const res = await fetch(`${process.env.PUBLIC_URL || ''}/templates/${TEMPLATE_NAME}`);
    if (!res.ok) throw new Error('Photo report template not found');
    return res.arrayBuffer();
};

// Map the Photo Report tool's form/state to the template tags.
const buildData = (job, signoff) => {
    const hasSig = !!(signoff && signoff.signature);
    return {
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
        // Utilities located → loop of { label } in canonical order.
        utilities: (job.utilitiesLocated || []).map((k) => ({ label: getUtility(k).label })),
        qlLevels: QUALITY_LEVELS.filter((q) => job.qualityLevels && job.qualityLevels[q]).join(', ') || '—',
        comments: job.comments || '',
        hasSignoff: hasSig,
        signName: (hasSig && (signoff.fullName || job.locatorName)) || '',
        signMeta: hasSig ? [signoff.role, signoff.accreditation, signoff.mobile, signoff.email].filter(Boolean).join('  ·  ') : '',
        signature: hasSig ? signoff.signature : '',
        // One block per photo; each carries its main image + a pothole loop.
        photos: (job.photos || []).map((p, i) => ({
            num: String(i + 1).padStart(2, '0'),
            photo: p.flattenedDataUrl || p.src,
            hasPotholes: (p.potholes || []).length > 0,
            potholes: (p.potholes || []).map((ph) => ({
                data: ph.src,
                label: ph.label || '',
                code: getUtility(ph.utility).code,
                ql: ph.qualityLevel || '',
                depth: ph.depth || '',
                comment: ph.comment || '',
            })),
        })),
    };
};

export const renderDocx = async (job, signoff) => {
    const content = await loadTemplate();
    try {
        const zip = new PizZip(content);
        const imageModule = new ImageModule({
            getImage: (tagValue) => base64ToArrayBuffer(tagValue),
            // Size per image tag: the main photo large, signature medium, pothole thumb small.
            getSize: (img, tagValue, tagName) => {
                if (tagName === 'photo') return [440, 300];
                if (tagName === 'signature') return [150, 46];
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
export const docxToPdf = async (docxBlob, filename = 'Photo Report.docx') => {
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
