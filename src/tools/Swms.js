// Safe Work Method Statement (SWMS) tool. Full port of the standalone SWMS app:
// four template presets (Standard / DIT / Concrete / Underground), a searchable Process
// Library + field autocomplete, a dynamic Safe Work Methods Analysis (JSA) table, and
// client-side Word export via the bundled template (public/templates/swms.docx).
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBook, faPlus, faTrash, faFileWord, faFilePdf, faArrowUp, faArrowDown,
    faXmark, faRotate,
} from '@fortawesome/free-solid-svg-icons';
import FormSection from '../components/FormSection';
import LoadingOverlay from '../components/LoadingOverlay';
import { useToast } from '../components/Toast';
import { renderDocx, docxToPdf, isPdfConfigured, initials } from '../services/swmsReportService';
import { setupTendersSearch, setupUsersSearch } from '../scripts/algoliaSearch';
import {
    HIGH_RISK_ITEMS, TEMPLATES, TEMPLATE_ORDER, buildLookups, allLibraryEntries,
    formatControlMeasuresLines, riskBand,
} from '../data/swmsLibrary';
import { CERTIFICATIONS, formatQualifications } from '../data/swmsCertifications';
import '../stylessheets/PhotoReport.css';
import '../stylessheets/ServiceLocater.css';
import '../stylessheets/Swms.css';

let _rid = 0;
const rowId = () => `r${++_rid}`;
const today = () => new Date().toISOString().split('T')[0];
const blankHazard = () => ({ hazard: '', initialRisk: '', controls: '', residualRisk: '' });

// Map a template's process DB into editable JSA rows (deep-copied so edits don't mutate data).
const dbToRows = (db) => db.map((e) => ({
    id: rowId(),
    process: e.process,
    actionBy: e.actionBy,
    hazards: e.hazards.map((h) => ({
        hazard: h.hazard, initialRisk: h.initialRisk, controls: h.controls, residualRisk: h.residualRisk,
    })),
}));

// "Signed" in the review log and sign-on is not stored: it is the person's initials.
const emptyReviews = (n) => Array.from({ length: n }, () => ({ by: '', reason: '', date: '' }));
const emptyStaff1 = (n) => Array.from({ length: n }, () => ({ name: '', classification: '', employed_by: '', date: '' }));
// Licences: certs = picked from CERTIFICATIONS, other = free-text extra.
const emptyStaff2 = (n) => Array.from({ length: n }, () => ({ name: '', certs: [], other: '' }));

const saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
};

const Swms = ({ goBack }) => {
    const showToast = useToast();

    const [templateKey, setTemplateKey] = useState('standard');
    const tpl = TEMPLATES[templateKey];
    const lookups = useMemo(() => buildLookups(tpl.db), [tpl.db]);

    const [header, setHeader] = useState({
        project: '', ref_no: '', subcontractor: 'Engineering Surveys P/L', date: today(),
        task_and_description: '', swms_developed_by: '', swms_developed_by_contact: '',
        swms_implementation_officer: '', swms_implementation_officer_contact: '',
    });
    const setH = (k, v) => setHeader((s) => ({ ...s, [k]: v }));
    const projectRef = useRef(null);
    const devRef = useRef(null);
    const officerRef = useRef(null);
    // Algolia autocomplete (same source as the other report tools): tenders on the
    // Project field (also fills Ref No from the tender's reference), staff on the two "developed by" / "officer" fields (auto-filling
    // the matching contact number).
    useEffect(() => {
        setupTendersSearch(projectRef.current, (h) => { setH('project', h.name || h.project || ''); if (h.reference) setH('ref_no', h.reference); });
        setupUsersSearch(devRef.current, (h) => { setH('swms_developed_by', h.name || ''); setH('swms_developed_by_contact', h.mobile_phone || h.phone || ''); });
        setupUsersSearch(officerRef.current, (h) => { setH('swms_implementation_officer', h.name || ''); setH('swms_implementation_officer_contact', h.mobile_phone || h.phone || ''); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Staff-name suggestions (Algolia users index) for table rows. Used as a ref callback;
    // setupUsersSearch binds once per input, and rows are only appended, so the row index
    // captured on first bind stays correct.
    const staffSearch = (onPick) => (el) => { if (el) setupUsersSearch(el, (h) => onPick(h.name || '')); };

    // Equipment / PPE: template items + custom "Other" slots.
    const [eq, setEq] = useState(TEMPLATES.standard.equipment.map((i) => ({ ...i })));
    const [eqOther, setEqOther] = useState({ checked: false, text: '' });
    const [ppe, setPpe] = useState(TEMPLATES.standard.ppe.map((i) => ({ ...i })));
    const [ppeOther, setPpeOther] = useState([{ checked: false, text: '' }, { checked: false, text: '' }, { checked: false, text: '' }]);

    const [hrcw, setHrcw] = useState(() => HIGH_RISK_ITEMS.map((_, i) => TEMPLATES.standard.highRiskYes.includes(i + 1)));
    const [reviews, setReviews] = useState(emptyReviews(4));
    const [jsa, setJsa] = useState(() => dbToRows(TEMPLATES.standard.db));
    const [staff1, setStaff1] = useState(emptyStaff1(6));
    const [staff2, setStaff2] = useState(emptyStaff2(5));

    const [ac, setAc] = useState(null);        // { key, items:[{label,apply}] }
    const [libOpen, setLibOpen] = useState(false);
    const [libSearch, setLibSearch] = useState('');
    const [libExpanded, setLibExpanded] = useState({});
    const [npOpen, setNpOpen] = useState(false);
    const [np, setNp] = useState({ process: '', hazard: '', irisk: '', rrisk: '', controls: '', action: 'All ES staff attending site' });
    const [busy, setBusy] = useState(null);
    const acTimer = useRef(null);

    // ---- Template switch ----
    const applyTemplate = useCallback((key) => {
        const t = TEMPLATES[key];
        setTemplateKey(key);
        setEq(t.equipment.map((i) => ({ ...i })));
        setEqOther({ checked: false, text: '' });
        setPpe(t.ppe.map((i) => ({ ...i })));
        setPpeOther([{ checked: false, text: '' }, { checked: false, text: '' }, { checked: false, text: '' }]);
        setHrcw(HIGH_RISK_ITEMS.map((_, i) => t.highRiskYes.includes(i + 1)));
        setJsa(dbToRows(t.db));
    }, []);

    const switchTemplate = (key) => {
        if (key === templateKey) return;
        if (jsa.length > 0 && !window.confirm(`Switch to the "${TEMPLATES[key].label}" template?\n\nThis reloads equipment, PPE, high-risk defaults and the analysis table with that template's defaults.`)) return;
        applyTemplate(key);
        showToast(`${TEMPLATES[key].icon} ${TEMPLATES[key].label} template loaded`, 'success');
    };

    const reloadDefaults = () => {
        if (!window.confirm('Reload the default processes for this template? This replaces the current analysis table.')) return;
        setJsa(dbToRows(tpl.db));
    };

    // ---- Autocomplete ----
    const openAc = (key, items) => { if (acTimer.current) clearTimeout(acTimer.current); setAc(items.length ? { key, items } : null); };
    const closeAc = () => { acTimer.current = setTimeout(() => setAc(null), 150); };

    // ---- JSA row ops ----
    const updateRow = (id, patch) => setJsa((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const updateHazard = (id, idx, patch) => setJsa((rows) => rows.map((r) => {
        if (r.id !== id) return r;
        const hazards = r.hazards.map((h, i) => (i === idx ? { ...h, ...patch } : h));
        return { ...r, hazards };
    }));
    const addHazard = (id) => setJsa((rows) => rows.map((r) => (r.id === id ? { ...r, hazards: [...r.hazards, blankHazard()] } : r)));
    const removeHazard = (id, idx) => setJsa((rows) => rows.map((r) => {
        if (r.id !== id) return r;
        const hazards = r.hazards.filter((_, i) => i !== idx);
        return { ...r, hazards: hazards.length ? hazards : [blankHazard()] };
    }));
    const addRow = (prefill) => setJsa((rows) => [...rows, {
        id: rowId(),
        process: prefill?.process || '',
        actionBy: prefill?.actionBy || 'All ES staff attending site',
        hazards: (prefill?.hazards && prefill.hazards.length)
            ? prefill.hazards.map((h) => ({ ...h }))
            : [blankHazard()],
    }]);
    const deleteRow = (id) => setJsa((rows) => rows.filter((r) => r.id !== id));
    const moveRow = (id, dir) => setJsa((rows) => {
        const i = rows.findIndex((r) => r.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= rows.length) return rows;
        const next = rows.slice();
        [next[i], next[j]] = [next[j], next[i]];
        return next;
    });

    // Autocomplete appliers
    const applyProcessMatch = (id, entry) => updateRow(id, {
        process: entry.process,
        actionBy: entry.actionBy || 'All ES staff attending site',
        hazards: (entry.hazards && entry.hazards.length) ? entry.hazards.map((h) => ({ ...h })) : [blankHazard()],
    });
    const applyHazardMatch = (id, idx, h) => updateHazard(id, idx, {
        hazard: h.hazard, initialRisk: h.initialRisk, controls: h.controls, residualRisk: h.residualRisk,
    });

    const procMatches = (q) => tpl.db.filter((e) => e.process.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
    const hazMatches = (q) => lookups.allHazards.filter((h) => h.hazard.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
    const ctrlMatches = (q) => {
        const needle = q.toLowerCase().slice(0, 50);
        return Object.keys(lookups.controlMap).filter((k) => k.includes(needle)).slice(0, 12).map((k) => lookups.controlMap[k]);
    };

    // ---- Add / remove rows for review + staff tables ----
    const addReview = () => setReviews((r) => [...r, ...emptyReviews(1)]);
    const addStaff1 = () => setStaff1((r) => [...r, ...emptyStaff1(1)]);
    const addStaff2 = () => setStaff2((r) => [...r, ...emptyStaff2(1)]);
    const updateStaff2 = (i, patch) => setStaff2((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

    // ---- Generate ----
    const collectForm = () => {
        const equipment = [
            ...eq.filter((i) => i.checked).map((i) => i.label),
            ...(eqOther.checked && eqOther.text.trim() ? [eqOther.text.trim()] : []),
        ];
        const ppeSel = [
            ...ppe.filter((i) => i.checked).map((i) => i.label),
            ...ppeOther.filter((o) => o.checked && o.text.trim()).map((o) => o.text.trim()),
        ];
        return {
            ...header,
            equipment,
            ppe: ppeSel,
            hrcw,
            reviews,
            jsa,
            acknowledgements: staff1,
            licenses: staff2.map((r) => ({ name: r.name, qualifications: formatQualifications(r.certs, r.other) })),
        };
    };

    const generate = async (asPdf) => {
        setBusy(asPdf ? 'Building PDF…' : 'Building Word document…');
        try {
            const form = collectForm();
            const base = 'SWMS_' + (form.ref_no || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
            const docx = await renderDocx(form);
            if (asPdf) {
                const pdf = await docxToPdf(docx, base + '.docx');
                if (pdf) { saveBlob(pdf, base + '.pdf'); showToast('PDF downloaded', 'success'); }
                else { saveBlob(docx, base + '.docx'); showToast('PDF converter unavailable — downloaded Word instead', 'error'); }
            } else {
                saveBlob(docx, base + '.docx');
                showToast('Word document downloaded', 'success');
            }
        } catch (e) {
            showToast(e.message || 'Could not generate the SWMS', 'error');
        } finally {
            setBusy(null);
        }
    };

    // ---- Process Library ----
    const libEntries = useMemo(() => allLibraryEntries(), []);
    const libFiltered = useMemo(() => {
        const q = libSearch.trim().toLowerCase();
        if (!q) return libEntries;
        return libEntries.filter((e) => e.process.toLowerCase().includes(q)
            || e.hazards.some((h) => h.hazard.toLowerCase().includes(q) || h.controls.toLowerCase().includes(q)));
    }, [libEntries, libSearch]);
    const libGroups = useMemo(() => {
        const groups = {};
        libFiltered.forEach((e) => { (groups[e.tplKey] = groups[e.tplKey] || []).push(e); });
        return TEMPLATE_ORDER.filter((k) => groups[k]).map((k) => ({ key: k, items: groups[k] }));
    }, [libFiltered]);
    const addFromLibrary = (e) => {
        addRow({ process: e.process, actionBy: e.actionBy, hazards: e.hazards });
        setLibOpen(false);
        showToast('Added: ' + e.process.slice(0, 40) + (e.process.length > 40 ? '…' : ''), 'success');
    };

    const submitNewProcess = () => {
        if (!np.process.trim()) return;
        addRow({
            process: np.process.trim(),
            actionBy: np.action.trim() || 'All ES staff attending site',
            hazards: [{ hazard: np.hazard.trim(), initialRisk: np.irisk.trim(), controls: formatControlMeasuresLines(np.controls), residualRisk: np.rrisk.trim() }],
        });
        setNpOpen(false);
        setNp({ process: '', hazard: '', irisk: '', rrisk: '', controls: '', action: 'All ES staff attending site' });
        showToast('Process added to the analysis table', 'success');
    };

    useEffect(() => () => { if (acTimer.current) clearTimeout(acTimer.current); }, []);

    // ---- Autocomplete dropdown ----
    const AC = ({ id }) => (ac && ac.key === id ? (
        <div className="swms-ac">
            {ac.items.map((it, i) => (
                <div key={i} className="swms-ac-item" onMouseDown={(e) => { e.preventDefault(); it.apply(); setAc(null); }}>{it.label}</div>
            ))}
        </div>
    ) : null);

    return (
        <div className="photo-report swms">
            {busy && <LoadingOverlay message={busy} />}
            <div className="pr-content">
                <div className="tool-topbar">
                    <div className="tool-topbar-left">
                        <nav className="breadcrumb">
                            <span className="crumb-link" onClick={goBack}>Dashboard</span>
                            <span className="crumb-sep">/</span>
                            <span>Tools</span>
                            <span className="crumb-sep">/</span>
                            <span className="crumb-current">SWMS</span>
                        </nav>
                        <div className="tool-title-row">
                            <h1>Safe Work Method Statement</h1>
                        </div>
                    </div>
                </div>

                {/* Template */}
                <FormSection step="1" title="Template" subtitle="Choose a starting template — this preloads equipment, PPE, high-risk defaults and the analysis table.">
                    <div className="swms-tpl-bar">
                        {TEMPLATE_ORDER.map((key) => {
                            const t = TEMPLATES[key];
                            return (
                                <button key={key} type="button" className={`swms-tpl-btn${key === templateKey ? ' on' : ''}`} onClick={() => switchTemplate(key)}>
                                    <span className="swms-tpl-dot" style={{ background: t.accent }} /> {t.icon} {t.label}
                                </button>
                            );
                        })}
                    </div>
                </FormSection>

                {/* Project / header */}
                <FormSection step="2" title="Project & document control">
                    <div className="job-details-grid">
                        <label>Project<input type="text" value={header.project} onChange={(e) => setH('project', e.target.value)} ref={projectRef} autoComplete="off" placeholder="Start typing for project suggestions…" /></label>
                        <label>Ref No.<input type="text" value={header.ref_no} onChange={(e) => setH('ref_no', e.target.value)} placeholder="e.g. ES-2026-001" /></label>
                        <label>Sub Contractor<input type="text" value={header.subcontractor} onChange={(e) => setH('subcontractor', e.target.value)} /></label>
                        <label>Date<input type="date" value={header.date} onChange={(e) => setH('date', e.target.value)} /></label>
                        <label style={{ gridColumn: '1 / -1' }}>Task and description<input type="text" value={header.task_and_description} onChange={(e) => setH('task_and_description', e.target.value)} placeholder="Describe the task…" /></label>
                        <label>SWMS developed by<input type="text" value={header.swms_developed_by} onChange={(e) => setH('swms_developed_by', e.target.value)} ref={devRef} autoComplete="off" placeholder="Start typing to find staff…" /></label>
                        <label>Contact no.<input type="text" value={header.swms_developed_by_contact} onChange={(e) => setH('swms_developed_by_contact', e.target.value)} placeholder="Phone" /></label>
                        <label>Implementation officer<input type="text" value={header.swms_implementation_officer} onChange={(e) => setH('swms_implementation_officer', e.target.value)} ref={officerRef} autoComplete="off" placeholder="Start typing to find staff…" /></label>
                        <label>Officer contact no.<input type="text" value={header.swms_implementation_officer_contact} onChange={(e) => setH('swms_implementation_officer_contact', e.target.value)} placeholder="Phone" /></label>
                    </div>
                </FormSection>

                {/* Equipment */}
                <FormSection step="3" title="Equipment to be used on site">
                    <div className="swms-cbgrid">
                        {eq.map((item, i) => (
                            <label className="swms-cbitem" key={i}>
                                <input type="checkbox" checked={item.checked} onChange={() => setEq((s) => s.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))} />
                                <span>{item.label}</span>
                            </label>
                        ))}
                        <label className="swms-cbitem">
                            <input type="checkbox" checked={eqOther.checked} onChange={() => setEqOther((s) => ({ ...s, checked: !s.checked }))} />
                            <span>Other:</span>
                            <input className="swms-other-input" placeholder="specify…" value={eqOther.text} onChange={(e) => setEqOther((s) => ({ ...s, text: e.target.value, checked: s.checked || !!e.target.value }))} />
                        </label>
                    </div>
                </FormSection>

                {/* PPE */}
                <FormSection step="4" title="PPE required for the task">
                    <div className="swms-cbgrid">
                        {ppe.map((item, i) => (
                            <label className="swms-cbitem" key={i}>
                                <input type="checkbox" checked={item.checked} onChange={() => setPpe((s) => s.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))} />
                                <span>{item.label}</span>
                            </label>
                        ))}
                        {ppeOther.map((o, i) => (
                            <label className="swms-cbitem" key={`o${i}`}>
                                <input type="checkbox" checked={o.checked} onChange={() => setPpeOther((s) => s.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))} />
                                <span>Other:</span>
                                <input className="swms-other-input" placeholder="specify…" value={o.text} onChange={(e) => setPpeOther((s) => s.map((x, j) => (j === i ? { text: e.target.value, checked: x.checked || !!e.target.value } : x)))} />
                            </label>
                        ))}
                    </div>
                </FormSection>

                {/* HRCW */}
                <FormSection step="5" title="High risk construction work" subtitle="WHS Regulations 2012, Ch.6, Pt.1, Reg.291">
                    <div style={{ overflowX: 'auto' }}>
                        <table className="swms-table swms-hrcw">
                            <thead><tr><th>Description of risk</th><th className="c" style={{ width: 90 }}>Yes</th><th className="c" style={{ width: 90 }}>No</th></tr></thead>
                            <tbody>
                                {HIGH_RISK_ITEMS.map((item, i) => (
                                    <tr key={i}>
                                        <td>{i + 1}. {item}</td>
                                        <td className="c"><input type="radio" name={`hr_${i}`} checked={hrcw[i]} onChange={() => setHrcw((s) => s.map((v, j) => (j === i ? true : v)))} /></td>
                                        <td className="c"><input type="radio" name={`hr_${i}`} checked={!hrcw[i]} onChange={() => setHrcw((s) => s.map((v, j) => (j === i ? false : v)))} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </FormSection>

                {/* Review */}
                <FormSection step="6" title="SWMS review">
                    <div className="swms-notes">
                        Failure to comply with the content and intent of this SWMS may result in injury to persons or damage to equipment. Ongoing inspections by Engineering Surveys' supervisors are conducted to ensure compliance. If conditions change or new hazards are identified, work must cease and the SWMS be reviewed before continuing.
                    </div>
                    <table className="swms-table">
                        <thead><tr><th style={{ width: 50 }} className="c">No.</th><th>Reviewed by</th><th>Reason</th><th style={{ width: 150 }}>Date</th><th style={{ width: 130 }}>Signed</th></tr></thead>
                        <tbody>
                            {reviews.map((r, i) => (
                                <tr key={i}>
                                    <td className="c"><div className="cellpad">{i + 1}</div></td>
                                    <td className="swms-ac-cell"><input ref={staffSearch((name) => setReviews((s) => s.map((x, j) => (j === i ? { ...x, by: name } : x))))} value={r.by} onChange={(e) => setReviews((s) => s.map((x, j) => (j === i ? { ...x, by: e.target.value } : x)))} placeholder="Reviewed by…" autoComplete="off" /></td>
                                    <td><input value={r.reason} onChange={(e) => setReviews((s) => s.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} placeholder="Reason for review…" /></td>
                                    <td><input type="date" value={r.date} onChange={(e) => setReviews((s) => s.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} /></td>
                                    <td><div className="cellpad swms-initials" title="Initials of the reviewer">{initials(r.by)}</div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button type="button" className="swms-add-btn" onClick={addReview}><FontAwesomeIcon icon={faPlus} /> Add review row</button>
                </FormSection>

                {/* Sign-on */}
                <FormSection step="7" title="Subcontractor Supervisor Discussed SWMS with the Following People Involved in the Task">
                    <table className="swms-table">
                        <thead><tr><th>Name</th><th>Classification</th><th>Employed by</th><th style={{ width: 150 }}>Date</th><th className="c" style={{ width: 80 }}>Signed</th></tr></thead>
                        <tbody>
                            {staff1.map((r, i) => (
                                <tr key={i}>
                                    <td className="swms-ac-cell"><input ref={staffSearch((name) => setStaff1((s) => s.map((x, j) => (j === i ? { ...x, name } : x))))} value={r.name} onChange={(e) => setStaff1((s) => s.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Name…" autoComplete="off" /></td>
                                    <td><input value={r.classification} onChange={(e) => setStaff1((s) => s.map((x, j) => (j === i ? { ...x, classification: e.target.value } : x)))} placeholder="Classification…" /></td>
                                    <td><input value={r.employed_by} onChange={(e) => setStaff1((s) => s.map((x, j) => (j === i ? { ...x, employed_by: e.target.value } : x)))} placeholder="Employer…" /></td>
                                    <td><input type="date" value={r.date} onChange={(e) => setStaff1((s) => s.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} /></td>
                                    <td className="c"><div className="cellpad swms-initials" title="Initials of the person">{initials(r.name)}</div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button type="button" className="swms-add-btn" onClick={addStaff1}><FontAwesomeIcon icon={faPlus} /> Add person</button>
                </FormSection>

                {/* JSA — full-bleed width */}
                <div className="swms-wide">
                <FormSection step="8" title="Safe work methods analysis">
                    <div className="swms-jsa-controls">
                        <button type="button" className="swms-add-btn" onClick={() => setLibOpen(true)}><FontAwesomeIcon icon={faBook} /> Process library</button>
                        <button type="button" className="swms-add-btn" onClick={() => setNpOpen(true)}><FontAwesomeIcon icon={faPlus} /> New process</button>
                        <button type="button" className="swms-add-btn" onClick={reloadDefaults}><FontAwesomeIcon icon={faRotate} /> Reload defaults</button>
                    </div>
                    <div className="swms-jsa-wrap">
                        <table className="swms-jsa">
                            <thead>
                                <tr>
                                    <th style={{ width: 34 }}>#</th>
                                    <th style={{ minWidth: 170 }}>Process / activity <small>Sequence of steps</small></th>
                                    <th style={{ minWidth: 210 }}>Potential hazard <small>Hazard(s) per step</small></th>
                                    <th style={{ width: 90 }}>Initial risk <small>Before</small></th>
                                    <th style={{ minWidth: 250 }}>Control measures <small>Eliminate / minimise</small></th>
                                    <th style={{ width: 90 }}>Residual risk <small>After</small></th>
                                    <th style={{ minWidth: 150 }}>Action by</th>
                                    <th style={{ width: 70 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {jsa.map((row, rIdx) => (
                                    <tr key={row.id}>
                                        <td className="swms-rownum">{rIdx + 1}</td>
                                        <td className="swms-proc">
                                            <div className="swms-ac-wrap">
                                                <textarea rows={2} value={row.process} placeholder="Type process…"
                                                    onChange={(e) => { updateRow(row.id, { process: e.target.value }); openAc(`proc:${row.id}`, procMatches(e.target.value).map((en) => ({ label: en.process, apply: () => applyProcessMatch(row.id, en) }))); }}
                                                    onBlur={closeAc} />
                                                <AC id={`proc:${row.id}`} />
                                            </div>
                                        </td>
                                        <td className="swms-haz-stack">
                                            {row.hazards.map((h, hi) => (
                                                <div className="swms-haz" key={hi}>
                                                    <div className="swms-ac-wrap">
                                                        <textarea rows={2} value={h.hazard} placeholder="Potential hazard…"
                                                            onChange={(e) => { updateHazard(row.id, hi, { hazard: e.target.value }); openAc(`haz:${row.id}:${hi}`, hazMatches(e.target.value).map((m) => ({ label: m.hazard, apply: () => applyHazardMatch(row.id, hi, m) }))); }}
                                                            onBlur={closeAc} />
                                                        <AC id={`haz:${row.id}:${hi}`} />
                                                    </div>
                                                    <div className="swms-haz-actions">
                                                        {hi === row.hazards.length - 1 && <button type="button" className="swms-mini" onClick={() => addHazard(row.id)}><FontAwesomeIcon icon={faPlus} /> hazard</button>}
                                                        {row.hazards.length > 1 && <button type="button" className="swms-mini rm" onClick={() => removeHazard(row.id, hi)}><FontAwesomeIcon icon={faXmark} /></button>}
                                                    </div>
                                                </div>
                                            ))}
                                        </td>
                                        <td className="swms-risk">
                                            {row.hazards.map((h, hi) => (
                                                <div className={`swms-haz ${riskBand(h.initialRisk) ? 'rk-' + riskBand(h.initialRisk) : ''}`} key={hi}>
                                                    <textarea rows={1} value={h.initialRisk} placeholder="H-12" onChange={(e) => updateHazard(row.id, hi, { initialRisk: e.target.value })} />
                                                </div>
                                            ))}
                                        </td>
                                        <td>
                                            {row.hazards.map((h, hi) => (
                                                <div className="swms-haz" key={hi}>
                                                    <div className="swms-ac-wrap">
                                                        <textarea rows={3} value={h.controls} placeholder="Control measures…"
                                                            onChange={(e) => { updateHazard(row.id, hi, { controls: e.target.value }); openAc(`ctrl:${row.id}:${hi}`, ctrlMatches(e.target.value).map((m) => ({ label: (m.controls.split('\n')[0] || '').slice(0, 70), apply: () => applyHazardMatch(row.id, hi, m) }))); }}
                                                            onBlur={(e) => { const f = formatControlMeasuresLines(e.target.value); if (f !== e.target.value) updateHazard(row.id, hi, { controls: f }); closeAc(); }} />
                                                        <AC id={`ctrl:${row.id}:${hi}`} />
                                                    </div>
                                                </div>
                                            ))}
                                        </td>
                                        <td className="swms-risk">
                                            {row.hazards.map((h, hi) => (
                                                <div className={`swms-haz ${riskBand(h.residualRisk) ? 'rk-' + riskBand(h.residualRisk) : ''}`} key={hi}>
                                                    <textarea rows={1} value={h.residualRisk} placeholder="L-2" onChange={(e) => updateHazard(row.id, hi, { residualRisk: e.target.value })} />
                                                </div>
                                            ))}
                                        </td>
                                        <td><textarea rows={2} value={row.actionBy} placeholder="Person responsible…" onChange={(e) => updateRow(row.id, { actionBy: e.target.value })} /></td>
                                        <td className="swms-rowtools">
                                            <button type="button" className="swms-mini" title="Move up" onClick={() => moveRow(row.id, -1)}><FontAwesomeIcon icon={faArrowUp} /></button>
                                            <button type="button" className="swms-mini" title="Move down" onClick={() => moveRow(row.id, 1)}><FontAwesomeIcon icon={faArrowDown} /></button>
                                            <button type="button" className="swms-mini rm" title="Delete" onClick={() => deleteRow(row.id)}><FontAwesomeIcon icon={faTrash} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {jsa.length === 0 && <tr><td colSpan={8} className="swms-lib-empty">No processes yet. Add from the Process library or create a new one.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </FormSection>
                </div>

                {/* Licenses */}
                <FormSection step="9" title="Staff licenses, qualifications & certifications">
                    <table className="swms-table">
                        <thead><tr><th style={{ width: '30%' }}>Name</th><th>License, qualification or certification</th></tr></thead>
                        <tbody>
                            {staff2.map((r, i) => (
                                <tr key={i}>
                                    <td><input value={r.name} onChange={(e) => setStaff2((s) => s.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Name…" /></td>
                                    <td>
                                        <div className="swms-certs">
                                            {r.certs.map((c) => (
                                                <span className="swms-cert-chip" key={c}>
                                                    {c}
                                                    <button type="button" title="Remove" aria-label={`Remove ${c}`} onClick={() => updateStaff2(i, { certs: r.certs.filter((x) => x !== c) })}><FontAwesomeIcon icon={faXmark} /></button>
                                                </span>
                                            ))}
                                            {r.certs.length < CERTIFICATIONS.length && (
                                                <select className="swms-cert-add" value="" aria-label="Add certification"
                                                    onChange={(e) => { if (e.target.value) updateStaff2(i, { certs: [...r.certs, e.target.value] }); }}>
                                                    <option value="">+ Add certification…</option>
                                                    {CERTIFICATIONS.filter((c) => !r.certs.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            )}
                                        </div>
                                        <input className="swms-cert-other" value={r.other} onChange={(e) => updateStaff2(i, { other: e.target.value })} placeholder="Other licence or qualification (optional)…" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button type="button" className="swms-add-btn" onClick={addStaff2}><FontAwesomeIcon icon={faPlus} /> Add person</button>
                </FormSection>

                <div className="tool-actions tool-actions-bottom">
                    <button type="button" className="btn-primary" onClick={() => generate(false)}><FontAwesomeIcon icon={faFileWord} /> Generate Word</button>
                    {isPdfConfigured() && <button type="button" className="btn-outline" onClick={() => generate(true)}><FontAwesomeIcon icon={faFilePdf} /> Generate PDF</button>}
                </div>
            </div>

            {/* Process Library modal */}
            {libOpen && (
                <div className="swms-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setLibOpen(false); }}>
                    <div className="swms-modal">
                        <div className="swms-modal-head">
                            <h3><FontAwesomeIcon icon={faBook} /> Process library</h3>
                            <button type="button" className="swms-modal-x" onClick={() => setLibOpen(false)}><FontAwesomeIcon icon={faXmark} /></button>
                        </div>
                        <div className="swms-modal-body">
                            <input className="swms-lib-search" autoFocus placeholder="Search processes, hazards or controls…" value={libSearch} onChange={(e) => setLibSearch(e.target.value)} />
                            <div className="swms-lib-count">{libFiltered.length} of {libEntries.length} processes across all templates</div>
                            {libGroups.length === 0 && <div className="swms-lib-empty">No processes match your search.</div>}
                            {libGroups.map((g) => {
                                const t = TEMPLATES[g.key];
                                return (
                                    <div key={g.key}>
                                        <div className="swms-lib-tpl" style={{ borderLeftColor: t.accent }}>
                                            <span>{t.icon}</span><span className="name">{t.label}</span><span className="count">{g.items.length} process{g.items.length !== 1 ? 'es' : ''}</span>
                                        </div>
                                        {g.items.map((e) => {
                                            const ek = `${e.tplKey}:${e.dbIdx}`;
                                            const open = !!libExpanded[ek];
                                            return (
                                                <div className="swms-lib-card" key={ek}>
                                                    <div className="swms-lib-card-head" onClick={() => setLibExpanded((s) => ({ ...s, [ek]: !s[ek] }))}>
                                                        <span className="swms-lib-card-title">{e.process}</span>
                                                        <span className="swms-lib-badge" style={{ background: e.tplAccent }}>{e.hazards.length} hazard{e.hazards.length !== 1 ? 's' : ''}</span>
                                                        <button type="button" className="swms-lib-add" style={{ background: e.tplAccent }} onClick={(ev) => { ev.stopPropagation(); addFromLibrary(e); }}>+ Add</button>
                                                    </div>
                                                    {open && (
                                                        <div className="swms-lib-card-body open">
                                                            {e.hazards.map((h, hi) => (
                                                                <div className="swms-lib-haz" key={hi}>
                                                                    <div><div className="swms-lib-col">Hazard</div>{h.hazard}</div>
                                                                    <div><div className="swms-lib-col">Initial</div><strong>{h.initialRisk}</strong></div>
                                                                    <div><div className="swms-lib-col">Controls</div>{formatControlMeasuresLines(h.controls).split('\n').map((l, li) => <div key={li}>{l}</div>)}</div>
                                                                    <div><div className="swms-lib-col">Residual</div><strong>{h.residualRisk}</strong></div>
                                                                    <div><div className="swms-lib-col">Action by</div>{e.actionBy}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="swms-modal-foot">
                            <button type="button" className="swms-add-btn" onClick={() => { setLibOpen(false); setNpOpen(true); }}><FontAwesomeIcon icon={faPlus} /> New process</button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Process modal */}
            {npOpen && (
                <div className="swms-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setNpOpen(false); }}>
                    <div className="swms-modal sm">
                        <div className="swms-modal-head">
                            <h3><FontAwesomeIcon icon={faPlus} /> Create new process</h3>
                            <button type="button" className="swms-modal-x" onClick={() => setNpOpen(false)}><FontAwesomeIcon icon={faXmark} /></button>
                        </div>
                        <div className="swms-modal-body">
                            <div className="swms-field"><label>Process / step description</label><textarea rows={2} autoFocus value={np.process} onChange={(e) => setNp((s) => ({ ...s, process: e.target.value }))} placeholder="e.g. Access site, Set up GPS device…" /></div>
                            <div className="swms-field"><label>Potential hazard(s)</label><textarea rows={3} value={np.hazard} onChange={(e) => setNp((s) => ({ ...s, hazard: e.target.value }))} placeholder="List the potential hazards…" /></div>
                            <div className="swms-field-row">
                                <div className="swms-field"><label>Initial risk</label><input value={np.irisk} onChange={(e) => setNp((s) => ({ ...s, irisk: e.target.value }))} placeholder="e.g. H-16" /></div>
                                <div className="swms-field"><label>Residual risk</label><input value={np.rrisk} onChange={(e) => setNp((s) => ({ ...s, rrisk: e.target.value }))} placeholder="e.g. L-2" /></div>
                            </div>
                            <div className="swms-field"><label>Control measures</label><textarea rows={4} value={np.controls} onChange={(e) => setNp((s) => ({ ...s, controls: e.target.value }))} placeholder="One control per line…" /></div>
                            <div className="swms-field"><label>Action by</label><input value={np.action} onChange={(e) => setNp((s) => ({ ...s, action: e.target.value }))} /></div>
                        </div>
                        <div className="swms-modal-foot">
                            <button type="button" className="swms-add-btn" onClick={() => setNpOpen(false)}>Cancel</button>
                            <button type="button" className="btn-primary" onClick={submitNewProcess}>Add to table</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Swms;
