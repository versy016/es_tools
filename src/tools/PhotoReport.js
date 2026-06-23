import React, { useState, useEffect, useRef } from 'react';
import { pdf } from '@react-pdf/renderer';
import '../stylessheets/ServiceLocater.css';
import '../stylessheets/PhotoReport.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faXmark, faPenToSquare, faGripVertical,
    faCloudArrowUp, faDownload, faUpRightFromSquare, faCamera, faPaperPlane,
} from '@fortawesome/free-solid-svg-icons';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { setupClientsSearch, setupContactsSearch, setupUsersSearch } from '../scripts/algoliaSearch';
import { loadGoogleMapsScript } from '../scripts/googleMaps';
import { UTILITIES, QUALITY_LEVELS } from '../report/legendColors';
import AnnotatorSwitch from '../components/AnnotatorSwitch';
import CameraCapture from '../components/CameraCapture';
import PotholePanel from '../components/PotholePanel';
import PhotoReportDoc from '../report/PhotoReportPdf';
import { useToast } from '../components/Toast';
import { saveReport } from '../services/reportsService';
import { getSignoff } from '../services/profileService';

// Internal copy of every generated report is emailed here.
// TODO: change to bgosling@engsurveys.com.au after testing.
const AUTO_REPORT_RECIPIENT = 'sverma@engsurveys.com.au';
// Backend email endpoint (nodemailer/SMTP). Set REACT_APP_EMAIL_ENDPOINT in .env.
const EMAIL_ENDPOINT = process.env.REACT_APP_EMAIL_ENDPOINT || '';

const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());
const today = () => new Date().toISOString().slice(0, 10);
const newId = () => `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const Section = ({ step, title, subtitle, children }) => (
    <section className="form-section">
        <div className="form-section-head">
            <span className="form-section-step">{step}</span>
            <div>
                <h2>{title}</h2>
                {subtitle && <span className="form-section-sub">{subtitle}</span>}
            </div>
        </div>
        <div className="form-section-body">{children}</div>
    </section>
);

// es_tools v2.0 "Photo Report" tool.
const PhotoReport = ({ goBack }) => {
    const showToast = useToast();
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
    const [utilitiesLocated, setUtilitiesLocated] = useState([]);
    const [qualityLevels, setQualityLevels] = useState({ A: true, B: true, C: false, D: false });
    const [photos, setPhotos] = useState([]);
    const [editingPhotoId, setEditingPhotoId] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [pdfUrl, setPdfUrl] = useState('');
    const [loading, setLoading] = useState(false);

    const locatorRef = useRef(null);
    const clientRef = useRef(null);
    const contactRef = useRef(null);
    const addressRef = useRef(null);

    const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

    useEffect(() => {
        if (locatorRef.current) setupUsersSearch(locatorRef.current, (sel) => setField('locatorName', sel.name));
        if (clientRef.current) setupClientsSearch(clientRef.current, (sel) => setField('clientName', sel.title));
        if (contactRef.current) setupContactsSearch(contactRef.current, (sel) => {
            setField('clientContact', sel.name);
            setField('clientMobile', sel.phone || '');
        });
    }, []);

    useEffect(() => {
        loadGoogleMapsScript(() => {
            if (!addressRef.current || !window.google) return;
            const autocomplete = new window.google.maps.places.Autocomplete(addressRef.current, {
                types: ['geocode', 'establishment'],
                componentRestrictions: { country: 'Aus' },
            });
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                setField('siteAddress', place.formatted_address || place.name);
            });
        });
    }, []);

    const toggleUtility = (key) => setUtilitiesLocated((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

    const toggleQuality = (q) => setQualityLevels((prev) => ({ ...prev, [q]: !prev[q] }));

    const addPhoto = (src) => setPhotos((prev) => [...prev, {
        id: newId(), src, flattenedDataUrl: src, designState: null, potholes: [],
    }]);

    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files).filter((f) => f.type.startsWith('image/'));
        const srcs = await Promise.all(files.map(readFileAsDataURL));
        srcs.forEach(addPhoto);
        event.target.value = '';
    };

    const updatePhoto = (id, patch) => setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id));

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

    const handleEditorSave = (result) => {
        updatePhoto(editingPhotoId, { flattenedDataUrl: result.flattenedDataUrl, designState: result.designState });
        setEditingPhotoId(null);
    };

    const reportId = useRef(`rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    const buildPdfBlob = async () => {
        const job = { ...form, utilitiesLocated, qualityLevels, photos, signoff: await getSignoff() };
        const blob = await pdf(<PhotoReportDoc job={job} />).toBlob();
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(URL.createObjectURL(blob));
        return blob;
    };

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

    const handleGenerate = async () => {
        if (photos.length === 0) { alert('Add at least one photo before generating the report.'); return; }
        setLoading(true);
        try {
            const blob = await buildPdfBlob();
            await persistReport(blob, 'Draft');
            showToast('PDF generated & saved');
        } catch (err) {
            console.error('Error generating PDF', err);
            alert('Something went wrong generating the PDF. See console for details.');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateAndEmail = async () => {
        if (photos.length === 0) { alert('Add at least one photo before sending the report.'); return; }
        if (emailTo && !isEmail(emailTo)) { alert('Please enter a valid client email, or leave it blank.'); return; }
        setLoading(true);
        try {
            const blob = await buildPdfBlob();
            if (!EMAIL_ENDPOINT) {
                alert('Email is not configured yet (REACT_APP_EMAIL_ENDPOINT is not set). The PDF was generated — use Download for now.');
                return;
            }
            const pdfBase64 = await blobToBase64(blob);
            const recipients = Array.from(new Set([
                ...(isEmail(emailTo) ? [emailTo.trim()] : []),
                AUTO_REPORT_RECIPIENT,
            ]));
            const filename = `Photo Report - ${form.siteAddress || 'report'}.pdf`;
            const response = await fetch(EMAIL_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: recipients,
                    subject: `Photo Report${form.siteAddress ? ' — ' + form.siteAddress : ''}`,
                    text: `Please find attached the photo report${form.siteAddress ? ' for ' + form.siteAddress : ''}.\n\nGenerated via ES Tools.`,
                    filename,
                    pdfBase64,
                }),
            });
            if (!response.ok) throw new Error(`Email endpoint returned ${response.status}`);
            await persistReport(blob, 'Sent');
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
                <div className="tool-topbar">
                    <div className="tool-topbar-left">
                        <nav className="breadcrumb">
                            <span className="crumb-link" onClick={goBack}>Dashboard</span>
                            <span className="crumb-sep">/</span>
                            <span>Tools</span>
                            <span className="crumb-sep">/</span>
                            <span className="crumb-current">Photo &amp; pothole report</span>
                        </nav>
                        <div className="tool-title-row">
                            <h1>Photo &amp; pothole report</h1>
                            <span className="pill pill-draft">Draft · autosaved</span>
                        </div>
                    </div>
                </div>

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

                <Section step="5" title="Send report" subtitle="Email the PDF when you generate it">
                    <div className="field-grid">
                        <label>Client email (optional)
                            <input type="email" value={emailTo} placeholder="client@example.com"
                                onChange={(e) => setEmailTo(e.target.value)} autoComplete="off" />
                        </label>
                    </div>
                    <p className="muted-note">A copy is always sent to <strong>{AUTO_REPORT_RECIPIENT}</strong>.</p>
                </Section>

                <div className="tool-actions tool-actions-bottom">
                    {pdfUrl && (
                        <>
                            <a className="btn-outline sm" href={pdfUrl} download={`Photo Report - ${form.siteAddress || 'report'}.pdf`}>
                                <FontAwesomeIcon icon={faDownload} /> Download
                            </a>
                            <a className="btn-outline sm" href={pdfUrl} target="_blank" rel="noreferrer">
                                <FontAwesomeIcon icon={faUpRightFromSquare} /> Open
                            </a>
                        </>
                    )}
                    <button type="button" className="btn-outline" onClick={handleGenerate} disabled={loading}>Generate PDF</button>
                    <button type="button" className="btn-yellow" onClick={handleGenerateAndEmail} disabled={loading}>
                        <FontAwesomeIcon icon={faPaperPlane} /> {loading ? 'Working…' : 'Export & email PDF'}
                    </button>
                </div>

            </div>

            {editingPhoto && (
                <AnnotatorSwitch photo={editingPhoto} onSave={handleEditorSave} onClose={() => setEditingPhotoId(null)} />
            )}

            {showCamera && (
                <CameraCapture onCapture={addPhoto} onClose={() => setShowCamera(false)} />
            )}
        </div>
    );
};

export default PhotoReport;
