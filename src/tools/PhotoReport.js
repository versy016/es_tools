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
import CameraCapture from '../components/CameraCapture';
import PotholePanel from '../components/PotholePanel';
import Section from '../components/FormSection';
import { useToast } from '../components/Toast';
import { saveReport } from '../services/reportsService';
import { getSignoff } from '../services/profileService';
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
    const [utilitiesLocated, setUtilitiesLocated] = useState([]);          // selected utility keys (legendColors)
    const [qualityLevels, setQualityLevels] = useState({ A: true, B: true, C: false, D: false }); // QL checkboxes
    // photos: [{ id, src (original), flattenedDataUrl (annotated render), designState (editor state), potholes:[] }]
    const [photos, setPhotos] = useState([]);
    const [editingPhotoId, setEditingPhotoId] = useState(null);            // which photo the annotator modal is editing
    const [showCamera, setShowCamera] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [pdfUrl, setPdfUrl] = useState('');                              // object URL for the PDF Download/Open buttons
    const [docUrl, setDocUrl] = useState('');                              // object URL for the Word (.docx) download
    const [loading, setLoading] = useState(false);

    // Refs for the inputs that get Algolia/Maps autocomplete attached imperatively.
    const locatorRef = useRef(null);
    const clientRef = useRef(null);
    const contactRef = useRef(null);
    const addressRef = useRef(null);

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
        setUtilitiesLocated(['gas', 'water', 'sewer', 'comms']);
        setQualityLevels({ A: true, B: true, C: false, D: false });
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

    const toggleUtility = (key) => setUtilitiesLocated((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

    const toggleQuality = (q) => setQualityLevels((prev) => ({ ...prev, [q]: !prev[q] }));

    // Append a new photo block. flattenedDataUrl starts equal to src so an unedited
    // photo still renders in the PDF; the annotator overwrites it once edited.
    const addPhoto = (src) => setPhotos((prev) => [...prev, {
        id: newId(), src, flattenedDataUrl: src, designState: null, potholes: [],
    }]);

    // File picker handler: keep only images, read each to a data URL, add all.
    // Reset the input value so re-selecting the same file fires onChange again.
    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files).filter((f) => f.type.startsWith('image/'));
        const srcs = await Promise.all(files.map(readFileAsDataURL));
        srcs.forEach(addPhoto);
        event.target.value = '';
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

    // Render the report from the letterhead .docx template, then convert it to PDF via
    // the docx-to-pdf service. Returns both blobs (pdfBlob is null if the converter isn't
    // configured) and refreshes the Word + PDF download URLs.
    const buildReport = async () => {
        const job = { ...form, utilitiesLocated, qualityLevels, photos };
        const signoff = await getSignoff();
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
        await saveReport({
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
        if (photos.length === 0) { alert('Add at least one photo before generating the report.'); return; }
        setLoading(true);
        try {
            const { docxBlob, pdfBlob } = await buildReport();
            await persistReport(pdfBlob || docxBlob, 'Draft');
            showToast(pdfBlob ? 'Report generated & saved' : 'Word report generated (configure the PDF converter for a PDF)');
        } catch (err) {
            console.error('Error generating PDF', err);
            alert('Something went wrong generating the PDF. See console for details.');
        } finally {
            setLoading(false);
        }
    };

    // "Export & email PDF": build the PDF, email it (client optional; archive copy
    // always added downstream), then persist as "Sent". If email isn't configured
    // the PDF is still generated/downloadable — we just skip the send.
    const handleGenerateAndEmail = async () => {
        if (photos.length === 0) { alert('Add at least one photo before sending the report.'); return; }
        if (emailTo && !isEmail(emailTo)) { alert('Please enter a valid client email, or leave it blank.'); return; }
        setLoading(true);
        try {
            const { docxBlob, pdfBlob } = await buildReport();
            if (!isEmailConfigured()) {
                alert('Email is not configured yet (REACT_APP_EMAIL_ENDPOINT is not set). The report was generated — use Download for now.');
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
            await persistReport(sendBlob, 'Sent');
            showToast('Branded PDF generated & emailed to client');
        } catch (err) {
            console.error('Error sending email', err);
            alert('Could not send the email. The PDF was generated — see console for details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="photo-report">
            <div className="pr-content">
                {/* Breadcrumb + title bar; goBack returns to the Dashboard */}
                <div className="tool-topbar">
                    <div className="tool-topbar-left">
                        <nav className="breadcrumb">
                            <span className="crumb-link" onClick={goBack}>Dashboard</span>
                            <span className="crumb-sep">/</span>
                            <span>Tools</span>
                            <span className="crumb-sep">/</span>
                            <span className="crumb-current">Pothole Report Generator</span>
                        </nav>
                        <div className="tool-title-row">
                            <h1>Pothole Report Generator</h1>
                            <span className="pill pill-draft">Draft · autosaved</span>
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

                {/* Step 2 — utility + quality-level selection, both driven by legendColors */}
                <Section step="2" title="Utilities located" subtitle="Tick the services located on site">
                    <div className="utilities-grid">
                        {UTILITIES.map((u) => (
                            <label key={u.key} className={`utility-check ${utilitiesLocated.includes(u.key) ? 'checked' : ''}`}>
                                <input type="checkbox" checked={utilitiesLocated.includes(u.key)} onChange={() => toggleUtility(u.key)} />
                                <span className="utility-swatch" style={{ background: u.color }} />
                                {u.label}
                            </label>
                        ))}
                    </div>
                    <h3 className="subhead">Located to quality level</h3>
                    <div className="ql-row">
                        {QUALITY_LEVELS.map((q) => (
                            <label key={q} className={`ql-check ${qualityLevels[q] ? 'checked' : ''}`}>
                                <input type="checkbox" checked={!!qualityLevels[q]} onChange={() => toggleQuality(q)} />
                                QL-{q}
                            </label>
                        ))}
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

                {/* Step 5 — optional client recipient; archive copy is always CC'd (see config) */}
                <Section step="5" title="Send report" subtitle="Email the PDF when you generate it">
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
                                <FontAwesomeIcon icon={faUpRightFromSquare} /> Open
                            </a>
                        </>
                    )}
                    <button type="button" className="btn-outline" onClick={handleGenerate} disabled={loading}>Generate report</button>
                    <button type="button" className="btn-yellow" onClick={handleGenerateAndEmail} disabled={loading}>
                        <FontAwesomeIcon icon={faPaperPlane} /> {loading ? 'Working…' : 'Export & email'}
                    </button>
                </div>

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
