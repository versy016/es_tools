import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { supabase } from '../lib/supabase';
import { formatControlMeasuresLines } from '../data/swmsLibrary';

// Renders the Safe Work Method Statement .docx in the browser from the template
// (public/templates/swms.docx, overridable from the Supabase "templates" bucket).
// The SWMS template uses {{ }} placeholders (docxtemplater's default is single-brace),
// so delimiters are set explicitly. Mirrors serviceReportService.js.

const TEMPLATE_NAME = 'swms.docx';
const PDF_ENDPOINT = process.env.REACT_APP_DOCX_PDF_ENDPOINT || '';

// Fetch the .docx template bytes: prefer the managed copy in the Supabase "templates"
// bucket (so it can be updated without a redeploy), else fall back to the bundled file
// in /public. Throws only if the bundled fallback is also missing.
const loadTemplate = async () => {
    if (supabase) {
        try {
            const { data: signed, error } = await supabase.storage.from('templates').createSignedUrl(TEMPLATE_NAME, 60);
            if (error) {
                console.warn(`[swms] templates/${TEMPLATE_NAME} not loaded from bucket: ${error.message}. Using the bundled template.`);
            } else if (signed?.signedUrl) {
                const res = await fetch(signed.signedUrl, { cache: 'no-store' });
                if (res.ok) return await res.arrayBuffer();
                console.warn(`[swms] templates fetch returned ${res.status}. Using the bundled template.`);
            }
        } catch (e) {
            console.warn(`[swms] templates bucket load failed: ${e?.message || e}. Using the bundled template.`);
        }
    }
    const res = await fetch(`${process.env.PUBLIC_URL || ''}/templates/${TEMPLATE_NAME}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Template not found');
    return res.arrayBuffer();
};

const cb = (on) => (on ? '☒' : '☐');

// "Shivam Verma" -> "SV": first letter of each word, upper-cased. Used for the review
// log and sign-on "Signed" columns, which are filled from the person's name.
export const initials = (name = '') =>
    name.trim().split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('');

// Chunk a flat list of strings into rows of 3 columns { c1, c2, c3 } for the template loops.
const chunk3 = (arr) => {
    const out = [];
    for (let i = 0; i < arr.length; i += 3) {
        out.push({ c1: arr[i] || '', c2: arr[i + 1] || '', c3: arr[i + 2] || '' });
    }
    return out;
};

// Build the docxtemplater data object from the SWMS form state. Matches the placeholder
// catalogue in the bundled template (header text, equipment_rows / ppe_rows loops,
// cb_hr_n_yes/no, review_n_*, jsa_rows loop, ack_n_*, license_n_*).
const buildData = (form) => {
    const data = {
        project: form.project || '',
        ref_no: form.ref_no || '',
        rev_no: form.rev_no || '1',
        subcontractor: form.subcontractor || 'Engineering Surveys P/L',
        date: form.date || '',
        task_and_description: form.task_and_description || '',
        swms_developed_by: form.swms_developed_by || '',
        swms_developed_by_contact: form.swms_developed_by_contact || '',
        swms_implementation_officer: form.swms_implementation_officer || '',
        swms_implementation_officer_contact: form.swms_implementation_officer_contact || '',
        equipment_rows: chunk3(form.equipment || []),
        ppe_rows: chunk3(form.ppe || []),
    };

    // HRCW — 19 items, ☒ in exactly one of the yes/no pair.
    for (let i = 1; i <= 19; i++) {
        const isYes = !!(form.hrcw || [])[i - 1];
        data[`cb_hr_${i}_yes`] = cb(isYes);
        data[`cb_hr_${i}_no`] = cb(!isYes);
    }

    // Review log — fixed 12 rows.
    for (let i = 1; i <= 12; i++) {
        const r = (form.reviews || [])[i - 1] || {};
        data[`review_${i}_by`] = r.by || '';
        data[`review_${i}_reason`] = r.reason || '';
        data[`review_${i}_date`] = r.date || '';
        data[`review_${i}_signed`] = initials(r.by);
    }

    // JSA — flat rows; process/action only on the first hazard of each process (is_first
    // drives the vertical cell merge in the template).
    data.jsa_rows = [];
    (form.jsa || []).forEach((entry) => {
        const hazards = (entry.hazards && entry.hazards.length) ? entry.hazards : [{}];
        hazards.forEach((h, j) => {
            data.jsa_rows.push({
                is_first: j === 0,
                process: j === 0 ? (entry.process || '') : '',
                action_by: j === 0 ? (entry.actionBy || '') : '',
                hazard: h.hazard || '',
                initial_risk: h.initialRisk || '',
                controls: formatControlMeasuresLines(h.controls || ''),
                residual_risk: h.residualRisk || '',
            });
        });
    });

    // Acknowledgements — fixed 14 rows.
    for (let i = 1; i <= 14; i++) {
        const r = (form.acknowledgements || [])[i - 1] || {};
        data[`ack_${i}_name`] = r.name || '';
        data[`ack_${i}_classification`] = r.classification || '';
        data[`ack_${i}_employed_by`] = r.employed_by || '';
        data[`cb_ack_${i}_signed`] = initials(r.name);   // initials, not a tick box
        data[`ack_${i}_date`] = r.date || '';
    }

    // Licenses — fixed 14 rows.
    for (let i = 1; i <= 14; i++) {
        const r = (form.licenses || [])[i - 1] || {};
        data[`license_${i}_name`] = r.name || '';
        data[`license_${i}_qualifications`] = r.qualifications || '';
    }

    return data;
};

// Render the populated .docx Blob from the template + form data. Throws a user-friendly
// Error on template failures (real docxtemplater detail is logged to the console).
export const renderDocx = async (form) => {
    const content = await loadTemplate();
    try {
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{{', end: '}}' },
            nullGetter: () => '',
        });
        doc.render(buildData(form));
        return doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
    } catch (err) {
        console.error('renderDocx (swms) failed', err?.properties?.errors || err);
        throw new Error('Could not generate the SWMS from the template. The template may be invalid or out of date.');
    }
};

// Convert a rendered .docx blob to PDF via the converter endpoint (shared docx-to-pdf
// function). Returns null if not configured or on failure.
export const docxToPdf = async (docxBlob, filename = 'swms.docx') => {
    if (!PDF_ENDPOINT) return null;
    try {
        const fd = new FormData();
        fd.append('file', docxBlob, filename);
        const res = await fetch(PDF_ENDPOINT, { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`PDF converter returned ${res.status}`);
        return await res.blob();
    } catch (err) {
        console.warn('docxToPdf (swms) failed', err);
        return null;
    }
};

export const isPdfConfigured = () => Boolean(PDF_ENDPOINT);
