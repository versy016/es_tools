// es_tools v2.0 "Pothole Report" tool — the container screen for building a
// utility-locating photo report end-to-end in the browser.
// Flow: capture/upload photos → annotate each (AnnotatorSwitch bakes a flattened
// image) + record potholes → build the branded PDF with @react-pdf (buildPdfBlob)
// → persist to the Reports store (persistReport) → optionally email it. No server
// renders the PDF; everything happens client-side from in-memory state.
import React, { useState, useEffect, useRef } from 'react';
import { renderDocx as renderPhotoDocx, docxToPdf as photoDocxToPdf } from '../services/photoReportDocxService';
import '../stylessheets/ServiceLocater.css';
import '../stylessheets/PhotoReport.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faXmark, faPenToSquare, faGripVertical,
    faCloudArrowUp, faDownload, faUpRightFromSquare, faCamera, faPaperPlane,
} from '@fortawesome/free-solid-svg-icons';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { setupClientsSearch, setupContactsSearch, setupUsersSearch } from '../scripts/algoliaSearch';
import { loadGoogleMapsScript, attachAddressAutocomplete } from '../scripts/googleMaps';
import { UTILITIES, QUALITY_LEVELS } from '../report/legendColors';
import AnnotatorSwitch from '../components/AnnotatorSwitch';
import LoadingOverlay from '../components/LoadingOverlay';
import CameraCapture from '../components/CameraCapture';
import PotholePanel from '../components/PotholePanel';
import Section from '../components/FormSection';
import { useToast } from '../components/Toast';
import { saveReport, saveDraft } from '../services/reportsService';
import SignOffSection from '../components/SignOffSection';
import { useNavGuard } from '../components/NavGuard';
import { sendReportEmail, isEmailConfigured, blobToBase64 } from '../services/emailService';
import { REPORT_ARCHIVE_EMAIL } from '../config';

// Read an uploaded File into a base64 data URL so it can live in state and be
// embedded directly into the PDF (react-pdf accepts data URLs as image src).
const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());
const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD for <input type=date>
const newId = () => `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const PhotoReport = ({ goBack }) => {
    const showToast = useToast();
    const { setBlocker } = useNavGuard();
    // Cover-page form fields (mirrors the PROJECT/CLIENT detail tables in the PDF).
    const [form, setForm] = useState({
        date: today(),
        locatorName: '',
        dbydNo: '',
        siteAddress: '',
        scopeOfWorks: 'Utility locating',
        clientName: '',
        clientContact: '',
        clientMobile: '',
        dbydEmail: '',
        refNo: '',
        comments: '',
    });
    // Service-report-style checklist: one row per utility, each with a "located"
    // checkbox and per-row quality-level ticks. Rows carry their DIT colour for the
    // coloured background. Derived into utilitiesLocated + qualityLevels at render time.
    const [utilChecklist, setUtilChecklist] = useState(
        UTILITIES.map((u) => ({
            key: u.key, label: u.label, color: u.color, text: u.text,
            selected: false, quality: { A: false, B: false, C: false, D: false }, comment: '',
        }))
    );
    // photos: [{ id, src (original), flattenedDataUrl (annotated render), designState (editor state), potholes:[] }]
    const [photos, setPhotos] = useState([]);
    const [editingPhotoId, setEditingPhotoId] = useState(null);            // which photo the annotator modal is editing
    const [showCamera, setShowCamera] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [pdfUrl, setPdfUrl] = useState('');                              // object URL for the PDF Download/Open buttons
    const [docUrl, setDocUrl] = useState('');                              // object URL for the Word (.docx) download
    const [loading, setLoading] = useState(false);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);         // spinner while photos decode
    const [showExitPrompt, setShowExitPrompt] = useState(false);           // "save as draft?" on exit
    const finalizedRef = useRef(false);                                    // a Final report was generated this session

    // Refs for the inputs that get Algolia/Maps autocomplete attached imperatively.
    const locatorRef = useRef(null);
    const clientRef = useRef(null);
    const contactRef = useRef(null);
    const addressRef = useRef(null);
    const signOffRef = useRef(null);   // end-of-report sign-off (locator + signature + date)

    const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

    // TEMP (testing): fill every cover field + utilities + quality levels with sample
    // data so a report can be generated quickly — upload/annotate photos manually.
    // Remove this fn + its button before release.
    const quickFill = () => {
        setForm({
            date: today(),
            locatorName: 'Sam Locator',
            dbydNo: 'DBYD-12345',
            siteAddress: '123 Test Street, Adelaide SA 5000',
            scopeOfWorks: 'Utility locating',
            clientName: 'Westside Plumbing Pty Ltd',
            clientContact: 'John Tester',
            clientMobile: '0400 000 000',
            dbydEmail: 'test@engsurveys.com.au',
            refNo: 'REF-001',
            comments: 'Sample report generated for testing.',
        });
        setUtilChecklist((prev) => prev.map((r) => (
            ['gas', 'water', 'sewer', 'comms'].includes(r.key)
                ? { ...r, selected: true, quality: { A: true, B: true, C: false, D: false }, comment: 'Located with GPR' }
                : { ...r, selected: false, quality: { A: false, B: false, C: false, D: false }, comment: '' }
        )));
    };

    // Wire Algolia autocomplete onto the locator/client/contact inputs once mounted.
    // Selecting a suggestion writes back into form state (contact also fills mobile).
    useEffect(() => {
        if (locatorRef.current) setupUsersSearch(locatorRef.current, (sel) => setField('locatorName', sel.name));
        if (clientRef.current) setupClientsSearch(clientRef.current, (sel) => setField('clientName', sel.title));
        if (contactRef.current) setupContactsSearch(contactRef.current, (sel) => {
            setField('clientContact', sel.name);
            setField('clientMobile', sel.phone || '');
        });
    }, []);

    // Lazy-load the Maps script, then attach Places autocomplete to the address input.
    useEffect(() => {
        loadGoogleMapsScript(() => {
            attachAddressAutocomplete(addressRef.current, (addr) => setField('siteAddress', addr));
        });
    }, []);

    const toggleUtilSelected = (key) => setUtilChecklist((prev) =>
        prev.map((r) => (r.key === key ? { ...r, selected: !r.selected } : r)));
    // Ticking a quality level also marks that utility as located.
    const toggleUtilQuality = (key, q) => setUtilChecklist((prev) =>
        prev.map((r) => (r.key === key ? { ...r, selected: true, quality: { ...r.quality, [q]: !r.quality[q] } } : r)));
    const setUtilComment = (key, comment) => setUtilChecklist((prev) =>
        prev.map((r) => (r.key === key ? { ...r, comment } : r)));
    const allUtilSelected = utilChecklist.every((r) => r.selected);
    const toggleAllUtil = () => setUtilChecklist((prev) => {
        const v = !prev.every((r) => r.selected);
        return prev.map((r) => ({ ...r, selected: v }));
    });

    // Append a new photo block. flattenedDataUrl starts equal to src so an unedited
    // photo still renders in the PDF; the annotator overwrites it once edited.
    const addPhoto = (src) => setPhotos((prev) => [...prev, {
        id: newId(), src, flattenedDataUrl: src, designState: null, potholes: [],
    }]);

    // File picker handler: keep only images, read each to a data URL, add all.
    // Reset the input value so re-selecting the same file fires onChange again.
    // Shows a loading indicator (held for a minimum so it's always visible).
    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files).filter((f) => f.type.startsWith('image/'));
        event.target.value = '';
        if (!files.length) return;
        setUploadingPhotos(true);
        const start = Date.now();
        try {
            const srcs = await Promise.all(files.map(readFileAsDataURL));
            srcs.forEach(addPhoto);
        } finally {
            const wait = 450 - (Date.now() - start);
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));
            setUploadingPhotos(false);
        }
    };

    const updatePhoto = (id, patch) => setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id));

    // Reorder photos via drag-and-drop; page order in the PDF follows this array.
    const onDragEnd = (result) => {
        if (!result.destination) return;
        setPhotos((prev) => {
            const next = Array.from(prev);
            const [moved] = next.splice(result.source.index, 1);
            next.splice(result.destination.index, 0, moved);
            return next;
        });
    };

    const editingPhoto = photos.find((p) => p.id === editingPhotoId);

    // Annotator returns the flattened (baked) image + reopenable design state.
    const handleEditorSave = (result) => {
        updatePhoto(editingPhotoId, { flattenedDataUrl: result.flattenedDataUrl, designState: result.designState });
        setEditingPhotoId(null);
    };

    // Stable report id for the whole session so re-generating overwrites the same
    // saved record instead of creating duplicates (useRef keeps it across renders).
    const reportId = useRef(`rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    // Resume a saved draft handed off from the Reports screen (via localStorage):
    // re-hydrate the form and reuse its id so finishing it overwrites the draft row.
    useEffect(() => {
        let payload;
        try { payload = JSON.parse(localStorage.getItem('es_tools_resume') || 'null'); } catch (e) { payload = null; }
        if (!payload || payload.tool !== 'photo-report') return;
        localStorage.removeItem('es_tools_resume');
        reportId.current = payload.id || reportId.current;
        const s = payload.state || {};
        if (s.form) setForm((prev) => ({ ...prev, ...s.form }));
        if (Array.isArray(s.utilChecklist)) setUtilChecklist(s.utilChecklist);
        if (Array.isArray(s.photos)) setPhotos(s.photos);
        if (typeof s.emailTo === 'string') setEmailTo(s.emailTo);
    }, []);

    // Snapshot of everything needed to re-open this report as a draft.
    const draftState = () => ({ form, utilChecklist, photos, emailTo });

    // Render the report from the letterhead .docx template, then convert it to PDF via
    // the docx-to-pdf service. Returns both blobs (pdfBlob is null if the converter isn't
    // configured) and refreshes the Word + PDF download URLs.
    const buildReport = async () => {
        // The checklist table is the source of truth: emit a per-utility quality
        // string (e.g. "A, B") + comment, keyed by utility, for the report table.
        const utilData = {};
        utilChecklist.forEach((r) => {
            utilData[r.key] = {
                quality: QUALITY_LEVELS.filter((q) => r.quality[q]).join(', '),
                comment: r.comment || '',
            };
        });
        const job = { ...form, utilData, photos };
        const signoff = signOffRef.current ? signOffRef.current.getValue() : { locatorName: '', signature: '', date: '' };
        const docxBlob = await renderPhotoDocx(job, signoff);
        if (docUrl) URL.revokeObjectURL(docUrl);
        setDocUrl(URL.createObjectURL(docxBlob));
        const pdfBlob = await photoDocxToPdf(docxBlob, `Pothole Report - ${form.siteAddress || 'report'}.docx`);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(pdfBlob ? URL.createObjectURL(pdfBlob) : '');
        return { docxBlob, pdfBlob };
    };

    // Save the generated PDF + display metadata to the Reports store. `status`
    // distinguishes a local "Draft" (Generate) from a "Sent" report (email path).
    const persistReport = async (blob, status) => {
        const potholeCount = photos.reduce((n, p) => n + (p.potholes ? p.potholes.length : 0), 0);
        return await saveReport({
            id: reportId.current,
            blob,
            meta: {
                id: reportId.current,
                title: `Photo report — ${form.siteAddress || 'Untitled site'}`,
                meta: `${photos.length} photo${photos.length === 1 ? '' : 's'} · ${potholeCount} pothole${potholeCount === 1 ? '' : 's'} · ${new Date().toLocaleDateString('en-AU')}`,
                siteAddress: form.siteAddress,
                client: emailTo || form.clientName || '',
                status,
                createdAt: Date.now(),
                photoCount: photos.length,
                potholeCount,
            },
        });
    };

    // "Generate PDF": build + persist as a Draft (no email). Sets pdfUrl for download.
    const handleGenerate = async () => {
        if (photos.length === 0) { showToast('Add at least one photo before generating the report.', 'error'); return; }
        setLoading(true);
        try {
            const { docxBlob, pdfBlob } = await buildReport();
            const saved = await persistReport(pdfBlob || docxBlob, 'Final');
            if (saved) finalizedRef.current = true;   // a Final report exists → no draft prompt on exit
            showToast(saved
                ? (pdfBlob ? 'Final report generated & saved' : 'Final Word report generated & saved (configure the PDF converter for a PDF)')
                : 'Report generated, but saving to your reports failed — check you are signed in (see console)');
        } catch (err) {
            console.error('Error generating PDF', err);
            showToast('Something went wrong generating the PDF (see console).', 'error');
        } finally {
            setLoading(false);
        }
    };

    // "Export & email PDF": build the PDF, email it (client optional; archive copy
    // always added downstream), then persist as "Sent". If email isn't configured
    // the PDF is still generated/downloadable — we just skip the send.
    const handleGenerateAndEmail = async () => {
        if (photos.length === 0) { showToast('Add at least one photo before sending the report.', 'error'); return; }
        if (emailTo && !isEmail(emailTo)) { showToast('Please enter a valid client email, or leave it blank.', 'error'); return; }
        setLoading(true);
        try {
            const { docxBlob, pdfBlob } = await buildReport();
            if (!isEmailConfigured()) {
                showToast('Email is not configured yet — the report was generated, use Download for now.', 'error');
                return;
            }
            const sendBlob = pdfBlob || docxBlob; // prefer the PDF; fall back to the Word file
            const contentBase64 = await blobToBase64(sendBlob);
            await sendReportEmail({
                to: isEmail(emailTo) ? [emailTo.trim()] : [], // empty = archive-only recipient
                subject: `Pothole Report${form.siteAddress ? ' — ' + form.siteAddress : ''}`,
                text: `Please find attached the photo report${form.siteAddress ? ' for ' + form.siteAddress : ''}.\n\nGenerated via ES Tools.`,
                filename: `Pothole Report - ${form.siteAddress || 'report'}.${pdfBlob ? 'pdf' : 'docx'}`,
                contentBase64,
            });
            const saved = await persistReport(sendBlob, 'Sent');
            if (saved) finalizedRef.current = true;
            showToast(saved
                ? 'Branded PDF generated, emailed & saved'
                : 'Report emailed, but saving to your reports failed — check you are signed in (see console)');
        } catch (err) {
            console.error('Error sending email', err);
            showToast(`Could not send the email: ${err.message || 'see console'}. The report was generated — use Download.`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Is there enough entered to be worth keeping as a draft?
    const hasContent = () => photos.length > 0 || !!form.siteAddress || !!form.clientName
        || !!form.locatorName || !!form.dbydNo || utilChecklist.some((r) => r.selected);

    // Leaving the tool (back button OR any navbar/profile/sign-out navigation): if
    // there's unsaved work and no Final report was produced, offer to save a draft.
    const pendingNavRef = useRef(null);                 // where to go once the user decides
    const exitGuardRef = useRef(() => false);
    exitGuardRef.current = () => !finalizedRef.current && hasContent();   // fresh each render
    const promptOrProceed = (proceed) => {
        if (exitGuardRef.current()) { pendingNavRef.current = proceed; setShowExitPrompt(true); return true; }
        proceed();
        return false;
    };
    const requestExit = () => promptOrProceed(goBack);
    const leaveNow = () => { const go = pendingNavRef.current || goBack; pendingNavRef.current = null; go(); };

    // Register the navigation blocker so navbar/profile/sign-out also prompt.
    useEffect(() => {
        setBlocker((proceed) => promptOrProceed(proceed));
        return () => setBlocker(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveDraftAndExit = async () => {
        setShowExitPrompt(false);
        setLoading(true);
        try {
            const potholeCount = photos.reduce((n, p) => n + (p.potholes ? p.potholes.length : 0), 0);
            await saveDraft({
                id: reportId.current,
                tool: 'photo-report',
                state: draftState(),
                title: `Pothole report — ${form.siteAddress || 'Untitled site'}`,
                meta: `${photos.length} photo${photos.length === 1 ? '' : 's'} · ${potholeCount} pothole${potholeCount === 1 ? '' : 's'} · draft saved ${new Date().toLocaleDateString('en-AU')}`,
            });
        } finally {
            setLoading(false);
            leaveNow();
        }
    };

    return (
        <div className="photo-report">
            <div className="pr-content">
                {/* Breadcrumb + title bar; goBack returns to the Dashboard */}
                <div className="tool-topbar">
                    <div className="tool-topbar-left">
                        <nav className="breadcrumb">
                            <span className="crumb-link" onClick={requestExit}>Dashboard</span>
                            <span className="crumb-sep">/</span>
                            <span>Tools</span>
                            <span className="crumb-sep">/</span>
                            <span className="crumb-current">Pothole Report Generator</span>
                        </nav>
                        <div className="tool-title-row">
                            <h1>Pothole Report Generator</h1>
                            <span className="pill pill-draft">Editing — Generate to finalise</span>
                            {/* TEMP testing helper — remove before release */}
                            <button type="button" onClick={quickFill} style={{
                                marginLeft: 'auto', padding: '6px 12px', fontSize: '.8rem', fontWeight: 600,
                                border: '1.5px dashed var(--es-yellow)', background: 'var(--es-yellow-soft)',
                                color: 'var(--es-yellow-dark)', borderRadius: '8px', cursor: 'pointer',
                            }}>⚡ Quick fill (test)</button>
                        </div>
                    </div>
                </div>

                {/* Step 1 — cover-page fields. Locator/Client/Contact inputs carry
                    Algolia autocomplete (refs above); Site address carries Maps autocomplete. */}
                <Section step="1" title="Job details" subtitle="Appears on the report cover page">
                    <div className="field-grid">
                        <label>Date<input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} /></label>
                        <label>Locator<input type="text" placeholder="Start typing for suggestions.." ref={locatorRef}
                            value={form.locatorName} onChange={(e) => setField('locatorName', e.target.value)} autoComplete="off" /></label>
                        <label>DBYD No<input type="text" value={form.dbydNo} onChange={(e) => setField('dbydNo', e.target.value)} /></label>
                        <label>Site address<input type="text" ref={addressRef} value={form.siteAddress}
                            onChange={(e) => setField('siteAddress', e.target.value)} autoComplete="off" /></label>
                        <label>Scope of works<input type="text" value={form.scopeOfWorks} onChange={(e) => setField('scopeOfWorks', e.target.value)} /></label>
                        <label>Client name<input type="text" placeholder="Start typing for suggestions.." ref={clientRef}
                            value={form.clientName} onChange={(e) => setField('clientName', e.target.value)} autoComplete="off" /></label>
                        <label>Client contact<input type="text" placeholder="Contact name" ref={contactRef}
                            value={form.clientContact} onChange={(e) => setField('clientContact', e.target.value)} autoComplete="off" /></label>
                        <label>Mobile no<input type="text" placeholder="04xxx xxx xxx" value={form.clientMobile}
                            onChange={(e) => setField('clientMobile', e.target.value)} /></label>
                        <label>DBYD email<input type="text" value={form.dbydEmail} onChange={(e) => setField('dbydEmail', e.target.value)} /></label>
                        <label>Ref no<input type="text" value={form.refNo} onChange={(e) => setField('refNo', e.target.value)} /></label>
                    </div>
                </Section>

                {/* Step 2 — service + quality checklist (mirrors the Service report).
                    Each utility row is coloured by its DIT colour; tick a row and its
                    quality levels. Driven by legendColors. */}
                <Section step="2" title="Utilities located" subtitle="Select each service located and tick its quality level">
                    <div className="checklist">
                        <label className="select-all-label">
                            <input type="checkbox" checked={allUtilSelected} onChange={toggleAllUtil} /> Select all
                        </label>
                        <table>
                            <thead>
                                <tr><th>Service</th><th>Quality</th><th>Comment</th></tr>
                            </thead>
                            <tbody>
                                {utilChecklist.map((r) => (
                                    <tr key={r.key}>
                                        <td className="svc-cell" style={{ background: r.color, color: r.text }}>
                                            <label>
                                                <input type="checkbox" checked={r.selected} onChange={() => toggleUtilSelected(r.key)} />
                                                {r.label}
                                            </label>
                                        </td>
                                        <td>
                                            <div className="ql-ticks">
                                                {QUALITY_LEVELS.map((q) => (
                                                    <label key={q}>
                                                        <input type="checkbox" checked={r.quality[q]} onChange={() => toggleUtilQuality(r.key, q)} />
                                                        {q}
                                                    </label>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            <input type="text" className="svc-comment" placeholder="Optional"
                                                value={r.comment} onChange={(e) => setUtilComment(r.key, e.target.value)} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>

                <Section step="3" title="Comments" subtitle="Optional notes for the cover page">
                    <textarea rows="4" style={{ width: '100%' }} value={form.comments}
                        onChange={(e) => setField('comments', e.target.value)} placeholder="Add any comments…" />
                </Section>

                {/* Step 4 — photo intake + per-photo cards. Each card: drag handle to
                    reorder, pothole badge, Annotate (opens editor), remove, and a
                    PotholePanel. Clicking the preview also opens the annotator. */}
                <Section step="4" title="Photos" subtitle="Take a photo on the spot or pick from files — each becomes a report page">
                    <div className="upload-actions">
                        <label className="dropzone">
                            <FontAwesomeIcon icon={faCloudArrowUp} className="dropzone-icon" />
                            <span className="dropzone-title">Choose from files</span>
                            <span className="dropzone-sub">JPG or PNG · add several at once</span>
                            <input type="file" accept="image/*" multiple onChange={handleFileUpload} hidden />
                        </label>
                        <button type="button" className="camera-btn" onClick={() => setShowCamera(true)}>
                            <FontAwesomeIcon icon={faCamera} className="dropzone-icon" />
                            <span className="dropzone-title">Take a photo</span>
                            <span className="dropzone-sub">Use the device camera</span>
                        </button>
                    </div>

                    {uploadingPhotos && (
                        <div className="photo-loading"><span className="spinner" /> Adding photo(s)…</div>
                    )}

                    {photos.length > 0 && (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="photo-blocks" direction="vertical">
                                {(provided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps} className="photo-blocks">
                                        {photos.map((photo, index) => (
                                            <Draggable key={photo.id} draggableId={photo.id} index={index}>
                                                {(prov) => (
                                                    <div className="photo-card" ref={prov.innerRef} {...prov.draggableProps}>
                                                        <div className="photo-card-head">
                                                            <span className="drag-handle" {...prov.dragHandleProps}>
                                                                <FontAwesomeIcon icon={faGripVertical} />
                                                            </span>
                                                            <strong>Photo {String(index + 1).padStart(2, '0')}</strong>
                                                            {photo.potholes.length > 0 && (
                                                                <span className="count-badge">{photo.potholes.length} pothole{photo.potholes.length === 1 ? '' : 's'}</span>
                                                            )}
                                                            <div className="photo-card-actions">
                                                                <button type="button" className="annotate-btn" onClick={() => setEditingPhotoId(photo.id)}>
                                                                    <FontAwesomeIcon icon={faPenToSquare} /> Annotate
                                                                </button>
                                                                <button type="button" className="remove-photo-btn" onClick={() => removePhoto(photo.id)}>
                                                                    <FontAwesomeIcon icon={faXmark} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="photo-preview-wrap" onClick={() => setEditingPhotoId(photo.id)}>
                                                            <img src={photo.flattenedDataUrl} alt={`Site marking ${index + 1}`} className="photo-preview" />
                                                            <span className="photo-preview-overlay">
                                                                <FontAwesomeIcon icon={faPenToSquare} /> Annotate photo
                                                            </span>
                                                        </div>
                                                        <PotholePanel potholes={photo.potholes}
                                                            onChange={(potholes) => updatePhoto(photo.id, { potholes })} />
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    )}
                </Section>

                {/* Step 5 — end-of-report sign-off (locator + signature + date) */}
                <Section step="5" title="Sign-off" subtitle="Add your signature, or sign on someone else's behalf">
                    <SignOffSection ref={signOffRef} defaultLocator={form.locatorName} />
                </Section>

                {/* Step 6 — optional client recipient; archive copy is always CC'd (see config) */}
                <Section step="6" title="Send report" subtitle="Email the PDF when you generate it">
                    <div className="field-grid">
                        <label>Client email (optional)
                            <input type="email" value={emailTo} placeholder="client@example.com"
                                onChange={(e) => setEmailTo(e.target.value)} autoComplete="off" />
                        </label>
                    </div>
                    <p className="muted-note">A copy is always sent to <strong>{REPORT_ARCHIVE_EMAIL}</strong>.</p>
                </Section>

                {/* Bottom action bar — Word/PDF downloads appear once a report is generated */}
                <div className="tool-actions tool-actions-bottom">
                    {docUrl && (
                        <a className="btn-outline sm" href={docUrl} download={`Pothole Report - ${form.siteAddress || 'report'}.docx`}>
                            <FontAwesomeIcon icon={faDownload} /> Word
                        </a>
                    )}
                    {pdfUrl && (
                        <>
                            <a className="btn-outline sm" href={pdfUrl} download={`Pothole Report - ${form.siteAddress || 'report'}.pdf`}>
                                <FontAwesomeIcon icon={faDownload} /> PDF
                            </a>
                            <a className="btn-outline sm" href={pdfUrl} target="_blank" rel="noreferrer">
                                <FontAwesomeIcon icon={faUpRightFromSquare} /> Quick view
                            </a>
                        </>
                    )}
                    <button type="button" className="btn-outline" onClick={handleGenerate} disabled={loading}>Generate report</button>
                    <button type="button" className="btn-yellow" onClick={handleGenerateAndEmail} disabled={loading}>
                        <FontAwesomeIcon icon={faPaperPlane} /> {loading ? 'Working…' : 'Export & email'}
                    </button>
                </div>

                {/* Full-screen working overlay while the Word/PDF are generated. */}
                {loading && <LoadingOverlay message="Working, please wait…" />}

                {/* Save-as-draft prompt when leaving with unsaved work */}
                {showExitPrompt && (
                    <div className="success-overlay" onClick={() => setShowExitPrompt(false)}>
                        <div className="success-card" onClick={(e) => e.stopPropagation()}>
                            <h3>Save as draft?</h3>
                            <p>You haven't generated a final report yet. Save your progress as a draft to finish it later?</p>
                            <div className="success-actions">
                                <button type="button" className="btn-yellow" onClick={saveDraftAndExit}>Save as draft</button>
                                <button type="button" className="btn-outline" onClick={() => { setShowExitPrompt(false); leaveNow(); }}>Discard &amp; leave</button>
                            </div>
                            <button type="button" className="success-close" onClick={() => { setShowExitPrompt(false); pendingNavRef.current = null; }}>Keep editing</button>
                        </div>
                    </div>
                )}

            </div>

            {/* Annotation modal — mounted only while a photo is being edited */}
            {editingPhoto && (
                <AnnotatorSwitch photo={editingPhoto} onSave={handleEditorSave} onClose={() => setEditingPhotoId(null)} />
            )}

            {/* Device-camera capture modal; onCapture adds a photo just like an upload */}
            {showCamera && (
                <CameraCapture onCapture={addPhoto} onClose={() => setShowCamera(false)} />
            )}
        </div>
    );
};

export default PhotoReport;
