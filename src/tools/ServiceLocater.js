import React, { useState, useEffect, useRef } from 'react';
import '../stylessheets/ServiceLocater.css';
import '../stylessheets/PhotoReport.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFilePdf, faPaperPlane, faDownload } from '@fortawesome/free-solid-svg-icons';
import { setupClientsSearch, setupProjectsSearch, setupContactsSearch, setupUsersSearch } from '../scripts/algoliaSearch';
import { loadGoogleMapsScript } from '../scripts/googleMaps';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { renderDocx, docxToPdf } from '../services/serviceReportService';
import FormSection from '../components/FormSection';

const ServiceLocater = ({ goBack }) => {
    const [project, setProject] = useState('');
    const [client, setClient] = useState('');
    const [address, setAddress] = useState('');
    const [docLink, setDocLink] = useState('');
    const [pdfLink, setPdfLink] = useState('');
    const [dbydByClient, setDbydByClient] = useState(false);
    const [email, setEmail] = useState('');
    const [note, setNote] = useState('');
    const [notes, setNotes] = useState([
        "Services located in the area required using Radio Detection & Ground Penetrating Radar (GPR)",
        "Passive sweep of area (Power and Radio mode with Wand and GPR)",
        "Services marked with depths where possible."
    ]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [imageFiles, setImageFiles] = useState([]);
    const [imageNames, setImageNames] = useState([]);
    const [imageDescriptions, setImageDescriptions] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
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

    const projectInputRef = useRef(null);
    const clientInputRef = useRef(null);
    const addressInputRef = useRef(null);
    const contactInputRef = useRef(null);
    const locaterInputRef = useRef(null);

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

    const initAutocomplete = () => {
        const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
            types: ['geocode', 'establishment'],
            componentRestrictions: { country: 'Aus' },
            bounds: new window.google.maps.LatLngBounds(
                new window.google.maps.LatLng(37.7749, -122.4194),
                new window.google.maps.LatLng(37.7749, -122.4194)
            )
        });
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            setAddress(place.formatted_address || place.name);
        });
    };

    useEffect(() => {
        loadGoogleMapsScript(initAutocomplete);
    }, []);

    const handleAddressChange = (e) => {
        setAddress(e.target.value);
    };

    const handleNoteChange = (e) => {
        setNote(e.target.value);
    };

    const addNote = () => {
        if (note.trim() !== '') {
            setNotes([...notes, note]);
            setNote('');
        }
    };

    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files);
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
        });
    };

    const handleCheckboxChange = (index, field) => {
        const newChecklist = [...checklist];
        newChecklist[index][field] = !newChecklist[index][field];
        setChecklist(newChecklist);
    };

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

    const handleSelectAll = () => {
        const newSelectAll = !selectAll;
        setSelectAll(newSelectAll);
        const newChecklist = checklist.map(item => ({ ...item, selected: newSelectAll }));
        setChecklist(newChecklist);
    };

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            alert('Please ensure all selected assets have a quality selected and at least one asset is selected.');
            return;
        }

        setLoading(true);
        try {
            const filteredChecklist = checklist.filter(item => item.selected || item.quality.length > 0).map(item => ({
                assetType: item.type,
                quality: item.quality,
                comment: item.comment
            }));
            const reportForm = {
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
                dbydByClient,
                sitename: address,
                addnotes: notes,
                photos: imagePreviews,
            };

            if (docLink) URL.revokeObjectURL(docLink);
            if (pdfLink) URL.revokeObjectURL(pdfLink);
            setPdfLink('');

            // Render the .docx in the browser from the template.
            const docxBlob = await renderDocx(reportForm);
            setDocLink(URL.createObjectURL(docxBlob));

            // Optionally convert to PDF (needs the converter endpoint configured).
            const pdfBlob = await docxToPdf(docxBlob, 'Service Location Field Report.docx');
            if (pdfBlob) setPdfLink(URL.createObjectURL(pdfBlob));
        } catch (err) {
            console.error('Error generating the document', err);
            alert('Something went wrong generating the report. See console for details.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
            if (!docLink) {
                alert('Please generate the document first.');
                return;
            }

            setLoading(true);

            const response = await fetch('https://your-backend-endpoint/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, docUrl: docLink }),
            });

            if (response.ok) {
                alert('Email sent successfully.');
            } else {
                alert('Error sending email.');
            }

            setLoading(false);
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
                            <span className="crumb-current">Service Location report</span>
                        </nav>
                        <div className="tool-title-row">
                            <h1>Service Location Field Report</h1>
                        </div>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
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
                                        <td>
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

                    <FormSection step="5" title="Photos">
                        <input type="file" accept="image/*" multiple onChange={handleFileUpload} />
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
                                                        <img src={preview} alt={`Preview ${index + 1}`} className="image-thumbnail" />
                                                        <input
                                                            type="text"
                                                            placeholder="Description"
                                                            value={imageDescriptions[index]}
                                                            onChange={(e) => handleImageDescriptionChange(index, e.target.value)}
                                                            className="image-description"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Image Name"
                                                            value={imageNames[index]}
                                                            onChange={(e) => handleImageNameChange(index, e.target.value)}
                                                            className="image-name"
                                                        />
                                                        <button type="button" className="remove-image" onClick={() => handleRemoveImage(index)}>
                                                            <FontAwesomeIcon icon={faTimes} />
                                                        </button>
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

                    <div className="tool-actions tool-actions-bottom">
                        {docLink && (
                            <>
                                <a className="btn-outline sm" href={docLink} download="Service Location Field Report.docx">
                                    <FontAwesomeIcon icon={faDownload} /> Word
                                </a>
                                {pdfLink && (
                                    <a className="btn-outline sm" href={pdfLink} download="Service Location Field Report.pdf">
                                        <FontAwesomeIcon icon={faDownload} /> PDF
                                    </a>
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
                
                {loading && (
                    <div className="loading-overlay">
                        <p>Processing document, please wait...</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ServiceLocater;
