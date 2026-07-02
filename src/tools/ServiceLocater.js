// v1 "Service Location Field Report" tool. Builds a Word (.docx) report from a
// fixed template using docxtemplater, then optionally converts it to PDF and emails it.
// Flow: fill job details + utility checklist + DBYD + notes + photos → handleSubmit
// gathers a flat reportForm and calls renderDocx (template fill) → docxToPdf
// (converter endpoint, optional) → download links + Send via email.
// Note: some fields read straight off the DOM via e.target.<name>/querySelector
// (uncontrolled inputs) rather than React state — a legacy pattern in this tool.
import React, { useState, useEffect, useRef } from 'react';
import '../stylessheets/ServiceLocater.css';
import '../stylessheets/PhotoReport.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFilePdf, faPaperPlane, faDownload, faCheck, faCamera, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { setupClientsSearch, setupProjectsSearch, setupContactsSearch, setupUsersSearch } from '../scripts/algoliaSearch';
import { loadGoogleMapsScript, attachAddressAutocomplete } from '../scripts/googleMaps';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { renderDocx, docxToPdf, isPdfConfigured } from '../services/serviceReportService';
import { sendReportEmail, isEmailConfigured, blobToBase64 } from '../services/emailService';
import { saveReport, saveDraft } from '../services/reportsService';
import FormSection from '../components/FormSection';
import SignOffSection from '../components/SignOffSection';
import CameraCapture from '../components/CameraCapture';
import LoadingOverlay from '../components/LoadingOverlay';
import { useNavGuard } from '../components/NavGuard';
import { useToast } from '../components/Toast';

// Per-utility cell colours for the checklist, matched to the service-location.docx
// template cells (fg only set where the fill is dark). White/none utilities are omitted.
// Standard DBYD/AS 5488 colour code, mapped onto the service-location asset list.
const ASSET_COLORS = {
    'Gas': { bg: '#FFD500' },
    'Sewer': { bg: '#F2E2C4' },
    'Stormwater': { bg: '#00B050', fg: '#fff' },
    'Telecommunications': { bg: '#FFFFFF' },
    'SAPN/Electrical': { bg: '#ED7D31' },
    'Traffic Signals': { bg: '#ED7D31' },
    'Street Lighting': { bg: '#ED7D31' },
    'Water': { bg: '#2E75B6', fg: '#fff' },
    'Fire Main': { bg: '#FF0000', fg: '#fff' },
    'Optic Fibre': { bg: '#FFFFFF' },
    'Reclaimed Water': { bg: '#7030A0', fg: '#fff' },
    'Unknown Services': { bg: '#FF66CC' },
};

const ServiceLocater = ({ goBack }) => {
    const { setBlocker } = useNavGuard();
    const showToast = useToast();
    // project/client are mutually exclusive (selecting one disables the other).
    // After an Algolia pick these may hold the selected object, not a plain string.
    const [project, setProject] = useState('');
    const [client, setClient] = useState('');
    const [address, setAddress] = useState('');
    const [docLink, setDocLink] = useState('');     // object URL for the generated .docx
    const [pdfLink, setPdfLink] = useState('');     // object URL for the converted PDF (if any)
    const [dbydByClient, setDbydByClient] = useState(false); // disables/greys the DBYD grid when on
    const [email, setEmail] = useState('');
    const [note, setNote] = useState('');           // draft text in the add-note box
    // Default site notes seeded for every report; user can append more.
    const [notes, setNotes] = useState([
        "Services located in the area required using Radio Detection & Ground Penetrating Radar (GPR)",
        "Passive sweep of area (Power and Radio mode with Wand and GPR)",
        "Services marked with depths where possible."
    ]);
    const [imagePreviews, setImagePreviews] = useState([]);   // data URLs embedded into the docx
    const [, setImageFiles] = useState([]);                   // raw Files (kept in sync for reorder/remove)
    const [docBlob, setDocBlob] = useState(null);             // last generated .docx, needed to email
    const [imageNames, setImageNames] = useState([]);
    const [imageDescriptions, setImageDescriptions] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    // Standard utility checklist; each row: type, quality (CSV like "A, B"), comment, selected.
    const [checklist, setChecklist] = useState([
        { type: 'Gas', quality: '', comment: '', selected: false },
        { type: 'Sewer', quality: '', comment: '', selected: false },
        { type: 'Stormwater', quality: '', comment: '', selected: false },
        { type: 'Telecommunications', quality: '', comment: '', selected: false },
        { type: "SAPN/Electrical", quality: '', comment: '', selected: false },
        { type: "Traffic Signals", quality: '', comment: '', selected: false },
        { type: 'Street Lighting', quality: '', comment: '', selected: false },
        { type: 'Water', quality: '', comment: '', selected: false },
        { type: 'Fire Main', quality: '', comment: '', selected: false },
        { type: 'Optic Fibre', quality: '', comment: '', selected: false },
        { type: 'Reclaimed Water', quality: '', comment: '', selected: false },
        { type: 'Unknown Services', quality: '', comment: '', selected: false }
    ]);
    const [loading, setLoading] = useState(false);
    const [uploadingPhotos, setUploadingPhotos] = useState(false); // spinner while previews decode
    const [showCamera, setShowCamera] = useState(false);           // on-the-spot camera modal
    const [showSuccess, setShowSuccess] = useState(false);         // centred "report generated" modal
    const [savedToReports, setSavedToReports] = useState(false);   // did the last report persist to Supabase?
    const [showExitPrompt, setShowExitPrompt] = useState(false);   // "save as draft?" on exit
    const finalizedRef = useRef(false);                            // a Final report was generated this session
    // Stable id for the session so re-generating overwrites the same saved record.
    const reportId = useRef(`rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    // Refs for the inputs that receive Algolia/Maps autocomplete imperatively.
    const projectInputRef = useRef(null);
    const clientInputRef = useRef(null);
    const addressInputRef = useRef(null);
    const contactInputRef = useRef(null);
    const locaterInputRef = useRef(null);
    const formRef = useRef(null);
    const signOffRef = useRef(null);   // end-of-report sign-off (locator + signature + date)

    // TEMP (testing): fill every field with sample data so a report can be generated
    // quickly — upload photos manually. Remove this fn + its button before release.
    const quickFill = () => {
        setProject('');
        setClient({ name: 'Westside Plumbing Pty Ltd', title: 'Westside Plumbing Pty Ltd' });
        setAddress('123 Test Street, Adelaide SA 5000');
        setEmail('test@engsurveys.com.au');
        setDbydByClient(false);
        setChecklist((prev) => prev.map((it, i) => (
            i < 4 ? { ...it, selected: true, quality: 'B', comment: 'Located with GPR' } : it
        )));
        const f = formRef.current;
        if (!f) return;
        const set = (name, val) => { const el = f.querySelector(`[name="${name}"]`); if (el) el.value = val; };
        const today = new Date().toISOString().slice(0, 10);
        set('date', today);
        set('contact', 'John Tester');
        set('ContactMob', '0400 000 000');
        set('surveyor', 'Sam Locator');
        set('LocaterMob', '0411 111 111');
        set('dbydJobNumber', 'DBYD-12345');
        set('dbydDateRequested', today);
        set('dbydPlansAvailable', 'Yes');
        set('dbydPlansCoverAreas', 'Yes');
        set('swmsCompleted', 'Yes');
        set('dbydPlansSupplied', 'Yes');
    };

    // Typing a project clears client (and vice versa) so only one is ever set.
    const handleProjectChange = (e) => {
        setProject(e.target.value);
        if (e.target.value) {
            setClient('');
        }
    };

    const handleClientChange = (e) => {
        setClient(e.target.value);
        if (e.target.value) {
            setProject('');
        }
    };
    const handleEmailChange = (e) => {
            setEmail(e.target.value);
        };
    // Attach Algolia autocomplete to the four lookup inputs once mounted.
    // Contact/Locater write the chosen name into the input and push the matching
    // mobile straight into the sibling uncontrolled input via querySelector.
    useEffect(() => {
        setupProjectsSearch(projectInputRef.current, setProject);
        setupClientsSearch(clientInputRef.current, setClient);
        setupContactsSearch(contactInputRef.current, (selected) => {
            contactInputRef.current.value = selected.name;
            document.querySelector('input[name="ContactMob"]').value = selected.phone;
        });
        setupUsersSearch(locaterInputRef.current, (selected) => {
            locaterInputRef.current.value = selected.name;
            document.querySelector('input[name="LocaterMob"]').value = selected.mobile_phone;
        });
    }, []);

    // Maps Places autocomplete on the job-location input.
    useEffect(() => {
        loadGoogleMapsScript(() => {
            attachAddressAutocomplete(addressInputRef.current, setAddress);
        });
    }, []);

    const handleAddressChange = (e) => {
        setAddress(e.target.value);
    };

    const handleNoteChange = (e) => {
        setNote(e.target.value);
    };

    // Push the draft note onto the list and clear the box (ignores blank input).
    const addNote = () => {
        if (note.trim() !== '') {
            setNotes([...notes, note]);
            setNote('');
        }
    };

    // Read each picked file to a data URL for preview/embedding. Files, names and
    // (empty) descriptions are appended in lock-step so indices stay aligned.
    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        setUploadingPhotos(true); // show the loading animation until every preview decodes
        const start = Date.now();
        const fileNames = files.map(file => file.name);
        const promises = files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve();
                    setImagePreviews(prev => [...prev, e.target.result]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        Promise.all(promises).then(() => {
            setImageFiles(prev => [...prev, ...files]);
            setImageNames(prev => [...prev, ...fileNames]);
            setImageDescriptions(prev => [...prev, ...fileNames.map(() => '')]);
        }).catch(error => {
            console.error("Error loading images", error);
        }).finally(() => {
            // Hold the spinner for a minimum so it's always visible, even for a fast read.
            const wait = 450 - (Date.now() - start);
            setTimeout(() => setUploadingPhotos(false), Math.max(0, wait));
        });
    };

    // Add a photo captured on the spot (a data URL from CameraCapture). Keeps all four
    // parallel photo arrays index-aligned (imageFiles is unused downstream — null is fine).
    const addCapturedPhoto = (dataUrl) => {
        setImagePreviews(prev => [...prev, dataUrl]);
        setImageFiles(prev => [...prev, null]);
        setImageNames(prev => [...prev, '']);
        setImageDescriptions(prev => [...prev, '']);
    };

    // Toggle a boolean field (used for the row "selected" checkbox).
    const handleCheckboxChange = (index, field) => {
        const newChecklist = [...checklist];
        newChecklist[index][field] = !newChecklist[index][field];
        setChecklist(newChecklist);
    };

    // Toggle a quality letter in the row's comma-separated quality string and mark
    // the row selected. The replace() chain strips the letter and tidies stray commas.
    const handleQualityChange = (index, quality) => {
        const newChecklist = [...checklist];
        if (newChecklist[index].quality.includes(quality)) {
            newChecklist[index].quality = newChecklist[index].quality.replace(quality, '').replace(/,\s*$/, '').replace(/,\s*,/, ',');
        } else {
            newChecklist[index].quality = newChecklist[index].quality ? `${newChecklist[index].quality}, ${quality}` : quality;
        }
        newChecklist[index].selected = true;
        setChecklist(newChecklist);
    };

    const handleCommentChange = (index, value) => {
        const newChecklist = [...checklist];
        newChecklist[index].comment = value;
        setChecklist(newChecklist);
    };

    // Master checkbox: select/deselect every checklist row at once.
    const handleSelectAll = () => {
        const newSelectAll = !selectAll;
        setSelectAll(newSelectAll);
        const newChecklist = checklist.map(item => ({ ...item, selected: newSelectAll }));
        setChecklist(newChecklist);
    };

    // Require at least one selected row, and every selected row to have a quality.
    const validateForm = () => {
        const atLeastOneSelected = checklist.some(item => item.selected);
        if (!atLeastOneSelected) {
            return false;
        }

        for (const item of checklist) {
            if (item.selected && item.quality.length === 0) {
                return false;
            }
        }
        return true;
    };

    const handleRemoveImage = (index) => {
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImageNames(prev => prev.filter((_, i) => i !== index));
        setImageDescriptions(prev => prev.filter((_, i) => i !== index));
    };

    // Reorder all four parallel photo arrays together so they stay index-aligned.
    const onDragEnd = (result) => {
        if (!result.destination) return;

        const reorder = (list, startIndex, endIndex) => {
            const result = Array.from(list);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            return result;
        };

        setImagePreviews(prev => reorder(prev, result.source.index, result.destination.index));
        setImageFiles(prev => reorder(prev, result.source.index, result.destination.index));
        setImageNames(prev => reorder(prev, result.source.index, result.destination.index));
        setImageDescriptions(prev => reorder(prev, result.source.index, result.destination.index));
    };

    const handleImageNameChange = (index, newName) => {
        const newNames = [...imageNames];
        newNames[index] = newName;
        setImageNames(newNames);
    };

    const handleImageDescriptionChange = (index, newDescription) => {
        const newDescriptions = [...imageDescriptions];
        newDescriptions[index] = newDescription;
        setImageDescriptions(newDescriptions);
    };

    // Resume a saved draft handed off from the Reports screen (via localStorage):
    // re-hydrate controlled state immediately and uncontrolled DOM fields after mount.
    useEffect(() => {
        let payload;
        try { payload = JSON.parse(localStorage.getItem('es_tools_resume') || 'null'); } catch (e) { payload = null; }
        if (!payload || payload.tool !== 'service-location') return;
        localStorage.removeItem('es_tools_resume');
        reportId.current = payload.id || reportId.current;
        const s = payload.state || {};
        if (s.project) setProject(s.project);
        if (s.client) setClient(s.client);
        if (typeof s.address === 'string') setAddress(s.address);
        if (typeof s.email === 'string') setEmail(s.email);
        if (typeof s.dbydByClient === 'boolean') setDbydByClient(s.dbydByClient);
        if (Array.isArray(s.checklist)) setChecklist(s.checklist);
        if (Array.isArray(s.notes)) setNotes(s.notes);
        if (Array.isArray(s.photos)) {
            setImagePreviews(s.photos.map((p) => p.src));
            setImageNames(s.photos.map((p) => p.name || ''));
            setImageDescriptions(s.photos.map((p) => p.description || ''));
        }
        setTimeout(() => {
            const f = formRef.current;
            if (!f) return;
            Object.entries(s.fields || {}).forEach(([name, val]) => {
                const el = f.querySelector(`[name="${name}"]`);
                if (el && val != null) el.value = val;
            });
        }, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Snapshot of the form (controlled state + uncontrolled DOM fields) for a draft.
    const draftState = () => {
        const f = formRef.current;
        const get = (name) => { const el = f && f.querySelector(`[name="${name}"]`); return el ? el.value : ''; };
        return {
            fields: {
                date: get('date'), contact: get('contact'), ContactMob: get('ContactMob'),
                surveyor: get('surveyor'), LocaterMob: get('LocaterMob'),
                dbydJobNumber: get('dbydJobNumber'), dbydDateRequested: get('dbydDateRequested'),
                dbydPlansAvailable: get('dbydPlansAvailable'), dbydPlansCoverAreas: get('dbydPlansCoverAreas'),
                swmsCompleted: get('swmsCompleted'), dbydPlansSupplied: get('dbydPlansSupplied'),
            },
            project, client, address, email, dbydByClient, checklist, notes,
            photos: imagePreviews.map((src, i) => ({ src, name: imageNames[i] || '', description: imageDescriptions[i] || '' })),
        };
    };

    // Worth keeping as a draft? (reads the uncontrolled contact/surveyor fields too)
    const hasContent = () => {
        const f = formRef.current;
        const v = (name) => { const el = f && f.querySelector(`[name="${name}"]`); return el ? el.value.trim() : ''; };
        return imagePreviews.length > 0 || !!address || !!email || !!v('contact') || !!v('surveyor') || checklist.some((it) => it.selected);
    };

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
            const siteLabel = address || project.project || client.title || 'Untitled site';
            await saveDraft({
                id: reportId.current,
                tool: 'service-location',
                state: draftState(),
                title: `Service Location report — ${siteLabel}`,
                meta: `${imagePreviews.length} photo${imagePreviews.length === 1 ? '' : 's'} · draft saved ${new Date().toLocaleDateString('en-AU')}`,
            });
        } finally {
            setLoading(false);
            leaveNow();
        }
    };

    // Generate report: validate, gather a flat reportForm, render the .docx from
    // the template, then try to convert it to PDF. Many values are pulled directly
    // off the form DOM (e.target.<name>) since those inputs are uncontrolled.
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            showToast('Select at least one asset and give each a quality level.', 'error');
            return;
        }

        setLoading(true);
        try {
            // Keep only rows that were ticked or carry a quality; reshape for the template.
            const filteredChecklist = checklist.filter(item => item.selected || item.quality.length > 0).map(item => ({
                assetType: item.type,
                quality: item.quality,
                comment: item.comment
            }));
            // End-of-report sign-off (locator + signature + date).
            const signoff = signOffRef.current ? signOffRef.current.getValue() : { locatorName: '', signature: '', date: '' };
            // Flat data object matching the docx template placeholders.
            const reportForm = {
                signLocator: signoff.locatorName,
                signImage: signoff.signature,
                signDate: signoff.date,
                date: e.target.date.value,
                clientOrProject: project.project || client.title || '',
                jobLocation: address,
                contact: e.target.contact.value,
                contactMob: e.target.ContactMob.value,
                surveyor: e.target.surveyor.value,
                locaterMob: e.target.LocaterMob.value,
                checklist: filteredChecklist,
                dbydjobno: e.target.dbydJobNumber.value,
                dbyddate: e.target.dbydDateRequested.value,
                dbydavailable: e.target.dbydPlansAvailable.value,
                dbydplans: e.target.dbydPlansCoverAreas.value,
                SWMS: e.target.swmsCompleted.value,
                plansupply: e.target.dbydPlansSupplied.value,
                dbydByClient,                 // when true the template skips ES DBYD details
                sitename: address,            // site name mirrors the job location/address
                addnotes: notes,
                // Each photo carries its name + description so the template can caption it.
                photos: imagePreviews.map((src, i) => ({
                    data: src, name: imageNames[i] || '', description: imageDescriptions[i] || '',
                })),
            };

            // Free any previous object URLs before regenerating to avoid leaks.
            if (docLink) URL.revokeObjectURL(docLink);
            if (pdfLink) URL.revokeObjectURL(pdfLink);
            setPdfLink('');

            // Render the .docx in the browser from the template.
            const docxBlob = await renderDocx(reportForm);
            setDocBlob(docxBlob);
            setDocLink(URL.createObjectURL(docxBlob));

            // Optionally convert to PDF (needs the converter endpoint configured).
            const pdfBlob = await docxToPdf(docxBlob, 'Service Location Field Report.docx');
            if (pdfBlob) setPdfLink(URL.createObjectURL(pdfBlob));

            // Persist the report (PDF if available, else the Word file) to Supabase.
            const siteLabel = address || project.project || client.title || 'Untitled site';
            const saved = await saveReport({
                id: reportId.current,
                blob: pdfBlob || docxBlob,
                meta: {
                    title: `Service Location report — ${siteLabel}`,
                    siteAddress: address,
                    client: email || client.title || '',
                    status: 'Final',
                    photoCount: imagePreviews.length,
                    potholeCount: 0,
                    meta: `${imagePreviews.length} photo${imagePreviews.length === 1 ? '' : 's'} · ${new Date().toLocaleDateString('en-AU')}`,
                },
            });
            setSavedToReports(saved);
            if (saved) finalizedRef.current = true;   // a Final report exists → no draft prompt on exit

            setShowSuccess(true); // centred confirmation with the download options
        } catch (err) {
            console.error('Error generating the document', err);
            showToast('Something went wrong generating the report (see console).', 'error');
        } finally {
            setLoading(false);
        }
    };

    const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

    // Email the previously generated .docx (requires one to exist first). Client
    // email is optional/validated; bails with a notice if email isn't configured.
    const handleSendEmail = async () => {
        if (!docBlob) {
            showToast('Please generate the report first.', 'error');
            return;
        }
        if (email && !isEmail(email)) {
            showToast('Please enter a valid email address, or leave it blank.', 'error');
            return;
        }
        if (!isEmailConfigured()) {
            showToast('Email is not configured yet — use Download for now.', 'error');
            return;
        }
        setLoading(true);
        try {
            const contentBase64 = await blobToBase64(docBlob);
            await sendReportEmail({
                to: isEmail(email) ? [email.trim()] : [],
                subject: `Service Location Field Report${address ? ' — ' + address : ''}`,
                text: `Please find attached the Service Location Field Report${address ? ' for ' + address : ''}.\n\nGenerated via ES Tools.`,
                filename: 'Service Location Field Report.docx',
                contentBase64,
            });
            showToast('Report emailed successfully', 'success');
        } catch (err) {
            console.error('Error sending email', err);
            showToast(`Could not send the email: ${err.message || 'see console'}. Use Download instead.`, 'error');
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
                            <span className="crumb-link" onClick={requestExit}>Dashboard</span>
                            <span className="crumb-sep">/</span>
                            <span>Tools</span>
                            <span className="crumb-sep">/</span>
                            <span className="crumb-current">Service Location report</span>
                        </nav>
                        <div className="tool-title-row">
                            <h1>Service Location Field Report</h1>
                            {/* TEMP testing helper — remove before release */}
                            <button type="button" onClick={quickFill} style={{
                                marginLeft: 'auto', padding: '6px 12px', fontSize: '.8rem', fontWeight: 600,
                                border: '1.5px dashed var(--es-yellow)', background: 'var(--es-yellow-soft)',
                                color: 'var(--es-yellow-dark)', borderRadius: '8px', cursor: 'pointer',
                            }}>⚡ Quick fill (test)</button>
                        </div>
                    </div>
                </div>
                {/* Submitting the form triggers handleSubmit → docx/PDF generation */}
                <form onSubmit={handleSubmit} ref={formRef}>
                    {/* Step 1 — job details. Project/Client/Contact/Locater carry Algolia
                        autocomplete; Job Location carries Maps. Project & Client are
                        mutually disabled. ContactMob/LocaterMob are uncontrolled (filled imperatively). */}
                    <FormSection step="1" title="Job details">
                        <div className="job-details-grid">
                            <label>
                                Date:
                                <input type="date" name="date" required />
                            </label>
                            <label>
                                Project
                                <input type="text" name="project" placeholder="Start Typing For Project Suggestions.." value={project.name} disabled={!!client} onChange={handleProjectChange} ref={projectInputRef} autoComplete="off" />
                            </label>
                            <label>
                                Client
                                <input type="text" name="client" placeholder="Start Typing For Client Suggestions.." value={client.name} disabled={!!project} onChange={handleClientChange} ref={clientInputRef} autoComplete="off" />
                            </label>
                            <label>
                                Job Location
                                <input type="text" name="address" value={address} onChange={handleAddressChange} ref={addressInputRef} autoComplete="off" />
                            </label>
                            <label>
                                Contact
                                <input type="text" name="contact" placeholder="Enter Contact Name" ref={contactInputRef} autoComplete="off"/>
                            </label>
                            <label>
                                Contact Mob. No:
                                <input type="text" name="ContactMob" placeholder="04xxx xxx xx" autoComplete="off" />
                            </label>
                            <label>
                                Locater
                                <input type="text" name="surveyor" placeholder="Enter Locater Name" ref={locaterInputRef} autoComplete="off"/>
                            </label>
                            <label>
                                Locater Mob. No:
                                <input type="text" name="LocaterMob" placeholder="04xxx xxx xx" autoComplete="off"/>
                            </label>
                             <label>
                                Email
                                <input type="email" name="email" placeholder="Enter email" value={email} onChange={handleEmailChange} autoComplete="off"/>
                            </label>
                        </div>
                    </FormSection>
                    {/* Step 2 — per-asset checklist: select the row, tick A/B/C/D quality, add a comment */}
                    <FormSection step="2" title="Checklist (standard)">
                        <div className="checklist">
                        <label className="select-all-label">
                            <input type="checkbox" checked={selectAll} onChange={handleSelectAll} /> Select All
                        </label>
                        <table>
                            <thead>
                                <tr>
                                    <th>Asset Type</th>
                                    <th>Quality</th>
                                    <th>Comment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {checklist.map((item, index) => (
                                    <tr key={index}>
                                        <td className="svc-cell"
                                            style={ASSET_COLORS[item.type] ? { background: ASSET_COLORS[item.type].bg, color: ASSET_COLORS[item.type].fg } : undefined}>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    name={item.type.toLowerCase()}
                                                    checked={item.selected}
                                                    onChange={() => handleCheckboxChange(index, 'selected')}
                                                />
                                                {item.type}
                                            </label>
                                        </td>
                                        <td>
                                            <label>
                                                A
                                                <input
                                                    type="checkbox"
                                                    name={`quality-${item.type.toLowerCase()}`}
                                                    value="A"
                                                    checked={item.quality.includes('A')}
                                                    onChange={(e) => handleQualityChange(index, e.target.value)}
                                                />
                                                B
                                                <input
                                                    type="checkbox"
                                                    name={`quality-${item.type.toLowerCase()}`}
                                                    value="B"
                                                    checked={item.quality.includes('B')}
                                                    onChange={(e) => handleQualityChange(index, e.target.value)}
                                                />
                                                C
                                                <input
                                                    type="checkbox"
                                                    name={`quality-${item.type.toLowerCase()}`}
                                                    value="C"
                                                    checked={item.quality.includes('C')}
                                                    onChange={(e) => handleQualityChange(index, e.target.value)}
                                                />
                                                D
                                                <input
                                                    type="checkbox"
                                                    name={`quality-${item.type.toLowerCase()}`}
                                                    value="D"
                                                    checked={item.quality.includes('D')}
                                                    onChange={(e) => handleQualityChange(index, e.target.value)}
                                                />
                                            </label>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                name={`comment-${item.type.toLowerCase()}`}
                                                value={item.comment}
                                                onChange={(e) => handleCommentChange(index, e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </FormSection>

                    {/* Step 3 — DBYD details. The toggle below greys out and disables this
                        whole grid (pointerEvents:none) when the client supplies DBYD. */}
                    <FormSection step="3" title="DBYD details">
                        <label className="dbyd-client-toggle">
                            <input type="checkbox" checked={dbydByClient} onChange={(e) => setDbydByClient(e.target.checked)} />
                            DBYD to be supplied by client
                        </label>
                        <div className="dbyd-grid" style={dbydByClient ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
                            <label>
                                DBYD Job Number:
                                <input type="text" name="dbydJobNumber" />
                            </label>
                            <label>
                                DBYD Date Requested:
                                <input type="date" name="dbydDateRequested" />
                            </label>
                            <label>
                                DBYD plans available:
                                <select name="dbydPlansAvailable" defaultValue="Yes">
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                </select>
                            </label>
                            <label>
                                DBYD plans cover areas of concern:
                                <select name="dbydPlansCoverAreas" defaultValue="Yes">
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                </select>
                            </label>
                            <label>
                                SWMS Completed?
                                <select name="swmsCompleted" defaultValue="Yes">
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                </select>
                            </label>
                            <label>
                                DBYD plans supplied by Engineering Surveys?
                                <select name="dbydPlansSupplied" defaultValue="Yes">
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                </select>
                            </label>
                        </div>
                    </FormSection>

                    {/* Step 4 — site notes: type, Add Note appends to the list below */}
                    <FormSection step="4" title="Site notes">
                        <div className="note-input">
                            <textarea name="note" value={note} onChange={handleNoteChange} rows="4"></textarea>
                            <button type="button" className="add-note-btn" onClick={addNote}>Add Note</button>
                        </div>
                        <ul>
                            {notes.map((note, index) => (
                                <li key={index}>{note}</li>
                            ))}
                        </ul>
                    </FormSection>

                    {/* Step 5 — photos: upload, then drag to reorder; each thumbnail has an
                        editable name + description that flow into the docx. */}
                    <FormSection step="5" title="Photos">
                        <div className="photo-upload-row">
                            <label className="photo-upload-btn">
                                + Add photos
                                <input type="file" accept="image/*" multiple onChange={handleFileUpload} hidden />
                            </label>
                            <button type="button" className="photo-upload-btn" onClick={() => setShowCamera(true)}>
                                <FontAwesomeIcon icon={faCamera} /> Take a photo
                            </button>
                        </div>
                        {uploadingPhotos && (
                            <div className="photo-loading"><span className="spinner" /> Loading photos…</div>
                        )}
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="photos" direction="horizontal">
                                {(provided) => (
                                    <div className="image-previews" {...provided.droppableProps} ref={provided.innerRef}>
                                        {imagePreviews.map((preview, index) => (
                                            <Draggable key={index} draggableId={`photo-${index}`} index={index}>
                                                {(provided) => (
                                                    <div
                                                        className="image-container"
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                    >
                                                        <div className="image-frame">
                                                            <span className="image-index">{index + 1}</span>
                                                            <img src={preview} alt={`Preview ${index + 1}`} className="image-thumbnail" />
                                                            <button type="button" className="remove-image" onClick={() => handleRemoveImage(index)} aria-label="Remove photo">
                                                                <FontAwesomeIcon icon={faTimes} />
                                                            </button>
                                                        </div>
                                                        <div className="image-fields">
                                                            <input
                                                                type="text"
                                                                placeholder="Photo name"
                                                                value={imageNames[index]}
                                                                onChange={(e) => handleImageNameChange(index, e.target.value)}
                                                                className="image-name"
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="Description (optional)"
                                                                value={imageDescriptions[index]}
                                                                onChange={(e) => handleImageDescriptionChange(index, e.target.value)}
                                                                className="image-description"
                                                            />
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
                    </FormSection>

                    {/* Step 6 — end-of-report sign-off (locator + signature + date) */}
                    <FormSection step="6" title="Sign-off">
                        <SignOffSection ref={signOffRef} />
                    </FormSection>

                    {/* Bottom action bar — Word/PDF download links appear once generated;
                        Send via email is disabled until a doc exists; submit generates. */}
                    <div className="tool-actions tool-actions-bottom">
                        {docLink && (
                            <>
                                <a className="btn-outline sm" href={docLink} download="Service Location Field Report.docx">
                                    <FontAwesomeIcon icon={faDownload} /> Word
                                </a>
                                {pdfLink && (
                                    <>
                                        <a className="btn-outline sm" href={pdfLink} download="Service Location Field Report.pdf">
                                            <FontAwesomeIcon icon={faDownload} /> PDF
                                        </a>
                                        <a className="btn-outline sm" href={pdfLink} target="_blank" rel="noreferrer">
                                            <FontAwesomeIcon icon={faUpRightFromSquare} /> Quick view
                                        </a>
                                    </>
                                )}
                            </>
                        )}
                        <button type="button" className="btn-outline" onClick={handleSendEmail} disabled={!docLink}>
                            <FontAwesomeIcon icon={faPaperPlane} /> Send via email
                        </button>
                        <button type="submit" className="btn-yellow">
                            <FontAwesomeIcon icon={faFilePdf} /> {loading ? 'Generating…' : 'Generate report'}
                        </button>
                    </div>
                </form>
                
                {loading && <LoadingOverlay message="Generating report, please wait…" />}

                {showSuccess && (
                    <div className="success-overlay" onClick={() => setShowSuccess(false)}>
                        <div className="success-card" onClick={(e) => e.stopPropagation()}>
                            <div className="success-check"><FontAwesomeIcon icon={faCheck} /></div>
                            <h3>Report generated</h3>
                            <p>Your Service Location Field Report is ready to download.</p>
                            <p className="success-note">
                                {savedToReports
                                    ? '✓ Saved to your reports.'
                                    : 'Not saved to your reports — check that you are signed in and the backend is configured (see console).'}
                            </p>
                            <div className="success-actions">
                                <a className="btn-yellow" href={docLink} download="Service Location Field Report.docx" onClick={() => setShowSuccess(false)}>
                                    <FontAwesomeIcon icon={faDownload} /> Download Word
                                </a>
                                {pdfLink ? (
                                    <>
                                        <a className="btn-outline" href={pdfLink} download="Service Location Field Report.pdf" onClick={() => setShowSuccess(false)}>
                                            <FontAwesomeIcon icon={faFilePdf} /> Download PDF
                                        </a>
                                        <a className="btn-outline" href={pdfLink} target="_blank" rel="noreferrer" onClick={() => setShowSuccess(false)}>
                                            <FontAwesomeIcon icon={faUpRightFromSquare} /> Quick view
                                        </a>
                                    </>
                                ) : (
                                    <button type="button" className="btn-outline" disabled>
                                        <FontAwesomeIcon icon={faFilePdf} /> PDF unavailable
                                    </button>
                                )}
                            </div>
                            {!pdfLink && (
                                <p className="success-note">
                                    {isPdfConfigured()
                                        ? 'PDF conversion failed — the Word file is ready to download.'
                                        : 'Set REACT_APP_DOCX_PDF_ENDPOINT in your .env to enable PDF export.'}
                                </p>
                            )}
                            <button type="button" className="success-close" onClick={() => setShowSuccess(false)}>Close</button>
                        </div>
                    </div>
                )}

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

                {/* On-the-spot camera capture; each shot is appended as a photo */}
                {showCamera && (
                    <CameraCapture onCapture={addCapturedPhoto} onClose={() => setShowCamera(false)} />
                )}
            </div>
        </div>
    );
}

export default ServiceLocater;
