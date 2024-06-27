import React, { useState, useEffect, useRef } from 'react';
import '../stylessheets/ServiceLocater.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { setupClientsSearch, setupProjectsSearch, setupContactsSearch, setupUsersSearch } from '../scripts/algoliaSearch';
import { loadGoogleMapsScript } from '../scripts/googleMaps';

const ServiceLocater = ({ goBack }) => {
    const [project, setProject] = useState('');
    const [client, setClient] = useState('');
    const [address, setAddress] = useState('');
    const [docLink, setDocLink] = useState('');
    const [note, setNote] = useState('');
    const [notes, setNotes] = useState([
        "Services located in the area required using Radio Detection & Ground Penetrating Radar (GPR)",
        "Passive sweep of area (Power and Radio mode with Wand and GPR)",
        "Services marked with depths where possible."
    ]);
    const [base64Images, setBase64Images] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
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
        const promises = files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve(e.target.result.split(',')[1]);
                    // For preview
                    setImagePreviews(prev => [...prev, e.target.result]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        Promise.all(promises).then(base64Files => {
            setBase64Images(base64Files);
        }).catch(error => {
            console.error("Error converting images to base64", error);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            alert('Please ensure all selected assets have a quality selected and at least one asset is selected.');
            return;
        }

        const filteredChecklist = checklist.filter(item => item.selected || item.quality.length > 0).map(item => ({
            assetType: item.type,
            quality: item.quality,
            comment: item.comment
        }));
        const formData = {
            date: e.target.date.value,
            client: project.project || client.title,
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
            sitename: address,
            addnotes: notes,
            base64_images: base64Images
        };

        console.log('Form Data:', formData);

        const response = await fetch('https://2ydho3cldk.execute-api.ap-southeast-2.amazonaws.com/dev/ServiceLocatorFile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: formData }),
        });

        if (response.ok) {
            const result = await response.json();
            setDocLink(result.docUrl);
            console.info('Document generated successfully');
        } else {
            console.error('Error generating the document');
        }
    };

    return (
        <div>
            <div className="back-link" onClick={goBack}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back to Tools
            </div>
            <div className="service-locater">
                <h1>Service Location Field Report</h1>
                <form onSubmit={handleSubmit}>
                    <section className="job-details">
                        <h2>Job Details</h2>
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
                                <input type="text" name="contact" placeholder="Enter Contact Name" ref={contactInputRef} />
                            </label>
                            <label>
                                Contact Mob. No:
                                <input type="text" name="ContactMob" placeholder="04xxx xxx xx" />
                            </label>
                            <label>
                                Locater
                                <input type="text" name="surveyor" placeholder="Enter Locater Name" ref={locaterInputRef} />
                            </label>
                            <label>
                                Locater Mob. No:
                                <input type="text" name="LocaterMob" placeholder="04xxx xxx xx" />
                            </label>
                        </div>
                    </section>
                    <section className="checklist">
                        <h2>Checklist (Standard)</h2>
                        <label>
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
                                                <input
                                                    type="checkbox"
                                                    name={`quality-${item.type.toLowerCase()}`}
                                                    value="A"
                                                    checked={item.quality.includes('A')}
                                                    onChange={(e) => handleQualityChange(index, e.target.value)}
                                                /> A
                                                <input
                                                    type="checkbox"
                                                    name={`quality-${item.type.toLowerCase()}`}
                                                    value="B"
                                                    checked={item.quality.includes('B')}
                                                    onChange={(e) => handleQualityChange(index, e.target.value)}
                                                /> B
                                                <input
                                                    type="checkbox"
                                                    name={`quality-${item.type.toLowerCase()}`}
                                                    value="C"
                                                    checked={item.quality.includes('C')}
                                                    onChange={(e) => handleQualityChange(index, e.target.value)}
                                                /> C
                                                <input
                                                    type="checkbox"
                                                    name={`quality-${item.type.toLowerCase()}`}
                                                    value="D"
                                                    checked={item.quality.includes('D')}
                                                    onChange={(e) => handleQualityChange(index, e.target.value)}
                                                /> D
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
                    </section>
                    <section className="dbyd">
                        <h2>DBYD Details</h2>
                        <div className="dbyd-grid">
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
                    </section>

                    <section className="site-notes">
                        <h2>Site Notes</h2>
                        <textarea name="note" value={note} onChange={handleNoteChange} rows="4" style={{ width: '50rem' }}></textarea>
                        <button type="button" onClick={addNote}>Add Note</button>
                        <ul>
                            {notes.map((note, index) => (
                                <li key={index}>{note}</li>
                            ))}
                        </ul>
                    </section>

                    <section className="photos">
                        <h2>Photos</h2>
                        <input type="file" accept="image/*" multiple onChange={handleFileUpload} />
                        <div className="image-previews">
                            {imagePreviews.map((preview, index) => (
                                <img key={index} src={preview} alt={`Preview ${index + 1}`} className="image-thumbnail" />
                            ))}
                        </div>
                    </section>

                    <div className="buttons">
                        <button type="submit">Submit Report</button>
                    </div>
                </form>
                {docLink && (
                    <div className="download-link">
                        <a href={docLink} download="updated_document.docx">
                            Download Populated Report
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ServiceLocater;
