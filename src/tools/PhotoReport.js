import React, { useState, useEffect, useRef } from 'react';
import { pdf } from '@react-pdf/renderer';
import '../stylessheets/ServiceLocater.css';
import '../stylessheets/PhotoReport.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTimes, faPenToSquare, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { setupClientsSearch, setupContactsSearch, setupUsersSearch } from '../scripts/algoliaSearch';
import { loadGoogleMapsScript } from '../scripts/googleMaps';
import { UTILITIES, QUALITY_LEVELS } from '../report/legendColors';
import PhotoAnnotator from '../components/PhotoAnnotator';
import PotholePanel from '../components/PotholePanel';
import PhotoReportDoc from '../report/PhotoReportPdf';

const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const today = () => new Date().toISOString().slice(0, 10);

// es_tools v2.0 "Photo Report" tool: collect cover/job details, annotate site
// photos in the utility-legend colours, attach pothole photos, and generate a
// PDF on the Engineering Surveys letterhead.
const PhotoReport = ({ goBack }) => {
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
    const [pdfUrl, setPdfUrl] = useState('');
    const [loading, setLoading] = useState(false);

    const locatorRef = useRef(null);
    const clientRef = useRef(null);
    const contactRef = useRef(null);
    const addressRef = useRef(null);

    const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

    useEffect(() => {
        if (locatorRef.current) {
            setupUsersSearch(locatorRef.current, (sel) => setField('locatorName', sel.name));
        }
        if (clientRef.current) {
            setupClientsSearch(clientRef.current, (sel) => setField('clientName', sel.title));
        }
        if (contactRef.current) {
            setupContactsSearch(contactRef.current, (sel) => {
                setField('clientContact', sel.name);
                setField('clientMobile', sel.phone || '');
            });
        }
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

    const toggleUtility = (key) => {
        setUtilitiesLocated((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
    };

    const toggleQuality = (q) => {
        setQualityLevels((prev) => ({ ...prev, [q]: !prev[q] }));
    };

    const handlePhotoUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (!files.length) return;
        const srcs = await Promise.all(files.map(readFileAsDataURL));
        const added = srcs.map((src, i) => ({
            id: `photo_${Date.now()}_${i}`,
            src,
            annotations: [],
            flattenedDataUrl: src,
            lastUtility: 'water',
            potholes: [],
        }));
        setPhotos((prev) => [...prev, ...added]);
        event.target.value = '';
    };

    const updatePhoto = (id, patch) => {
        setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    };

    const removePhoto = (id) => {
        setPhotos((prev) => prev.filter((p) => p.id !== id));
    };

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

    const handleAnnotatorSave = ({ annotations, flattenedDataUrl, lastUtility }) => {
        updatePhoto(editingPhotoId, { annotations, flattenedDataUrl, lastUtility });
        setEditingPhotoId(null);
    };

    const handleGenerate = async () => {
        if (photos.length === 0) {
            alert('Add at least one photo before generating the report.');
            return;
        }
        setLoading(true);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        try {
            const job = { ...form, utilitiesLocated, qualityLevels, photos };
            const blob = await pdf(<PhotoReportDoc job={job} />).toBlob();
            setPdfUrl(URL.createObjectURL(blob));
        } catch (err) {
            console.error('Error generating PDF', err);
            alert('Something went wrong generating the PDF. See console for details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="back-link" onClick={goBack}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back to Tools
            </div>
            <div className="service-locater">
                <h1>Photo Report</h1>

                <section className="job-details">
                    <h2>Job Details</h2>
                    <div className="job-details-grid">
                        <label>
                            Date
                            <input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} />
                        </label>
                        <label>
                            Locator
                            <input type="text" placeholder="Start typing for locator suggestions.."
                                ref={locatorRef} value={form.locatorName}
                                onChange={(e) => setField('locatorName', e.target.value)} autoComplete="off" />
                        </label>
                        <label>
                            DBYD No
                            <input type="text" value={form.dbydNo} onChange={(e) => setField('dbydNo', e.target.value)} />
                        </label>
                        <label>
                            Site Address
                            <input type="text" ref={addressRef} value={form.siteAddress}
                                onChange={(e) => setField('siteAddress', e.target.value)} autoComplete="off" />
                        </label>
                        <label>
                            Scope of Works
                            <input type="text" value={form.scopeOfWorks} onChange={(e) => setField('scopeOfWorks', e.target.value)} />
                        </label>
                        <label>
                            Client Name
                            <input type="text" placeholder="Start typing for client suggestions.."
                                ref={clientRef} value={form.clientName}
                                onChange={(e) => setField('clientName', e.target.value)} autoComplete="off" />
                        </label>
                        <label>
                            Client Contact
                            <input type="text" placeholder="Enter contact name" ref={contactRef}
                                value={form.clientContact} onChange={(e) => setField('clientContact', e.target.value)} autoComplete="off" />
                        </label>
                        <label>
                            Mobile No
                            <input type="text" placeholder="04xxx xxx xxx" value={form.clientMobile}
                                onChange={(e) => setField('clientMobile', e.target.value)} />
                        </label>
                        <label>
                            DBYD Email
                            <input type="text" value={form.dbydEmail} onChange={(e) => setField('dbydEmail', e.target.value)} />
                        </label>
                        <label>
                            Ref No
                            <input type="text" value={form.refNo} onChange={(e) => setField('refNo', e.target.value)} />
                        </label>
                    </div>
                </section>

                <section className="job-details">
                    <h2>Utilities Located</h2>
                    <div className="utilities-grid">
                        {UTILITIES.map((u) => (
                            <label key={u.key} className="utility-check">
                                <input type="checkbox" checked={utilitiesLocated.includes(u.key)}
                                    onChange={() => toggleUtility(u.key)} />
                                <span className="utility-swatch" style={{ background: u.color }} />
                                {u.label}
                            </label>
                        ))}
                    </div>
                    <h2 style={{ marginTop: '1rem' }}>Located to Quality Level</h2>
                    <div className="ql-row">
                        {QUALITY_LEVELS.map((q) => (
                            <label key={q} className="ql-check">
                                <input type="checkbox" checked={!!qualityLevels[q]} onChange={() => toggleQuality(q)} />
                                QL-{q}
                            </label>
                        ))}
                    </div>
                </section>

                <section className="site-notes">
                    <h2>Comments</h2>
                    <textarea rows="4" style={{ width: '100%' }} value={form.comments}
                        onChange={(e) => setField('comments', e.target.value)} />
                </section>

                <section className="photos">
                    <h2>Photos</h2>
                    <label className="upload-btn">
                        + Add photo(s)
                        <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} hidden />
                    </label>

                    {photos.length === 0 ? (
                        <p style={{ color: '#888' }}>No photos added yet.</p>
                    ) : (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="photo-blocks" direction="vertical">
                                {(provided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps}>
                                        {photos.map((photo, index) => (
                                            <Draggable key={photo.id} draggableId={photo.id} index={index}>
                                                {(prov) => (
                                                    <div className="photo-block" ref={prov.innerRef} {...prov.draggableProps}>
                                                        <div className="photo-block-header">
                                                            <span className="drag-handle" {...prov.dragHandleProps}>
                                                                <FontAwesomeIcon icon={faGripVertical} />
                                                            </span>
                                                            <strong>Photo {String(index + 1).padStart(2, '0')}</strong>
                                                            <div className="photo-block-actions">
                                                                <button type="button" className="annotate-btn"
                                                                    onClick={() => setEditingPhotoId(photo.id)}>
                                                                    <FontAwesomeIcon icon={faPenToSquare} /> Annotate
                                                                </button>
                                                                <button type="button" className="remove-photo-btn"
                                                                    onClick={() => removePhoto(photo.id)}>
                                                                    <FontAwesomeIcon icon={faTimes} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="photo-block-body">
                                                            <img src={photo.flattenedDataUrl} alt={`Site marking ${index + 1}`}
                                                                className="photo-preview"
                                                                onClick={() => setEditingPhotoId(photo.id)} />
                                                            <div className="photo-block-side">
                                                                <PotholePanel
                                                                    potholes={photo.potholes}
                                                                    onChange={(potholes) => updatePhoto(photo.id, { potholes })} />
                                                            </div>
                                                        </div>
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
                </section>

                <div className="buttons">
                    <button type="button" onClick={handleGenerate} disabled={loading}>
                        {loading ? 'Generating…' : 'Generate PDF Report'}
                    </button>
                </div>

                {pdfUrl && (
                    <div className="download-link">
                        <a href={pdfUrl} download={`Photo Report - ${form.siteAddress || 'report'}.pdf`}>
                            Download Photo Report (PDF)
                        </a>
                        {' · '}
                        <a href={pdfUrl} target="_blank" rel="noreferrer">Open in new tab</a>
                    </div>
                )}
            </div>

            {editingPhoto && (
                <PhotoAnnotator
                    photo={editingPhoto}
                    onSave={handleAnnotatorSave}
                    onCancel={() => setEditingPhotoId(null)}
                />
            )}
        </div>
    );
};

export default PhotoReport;
