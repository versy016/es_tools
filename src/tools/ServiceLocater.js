import React, { useState, useEffect, useRef } from 'react';
import FileUpload from '../components/FileUpload';
import '../stylessheets/ServiceLocater.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { setupClientsSearch, setupProjectsSearch } from '../scripts/algoliaSearch';
import { loadGoogleMapsScript } from '../scripts/googleMaps';  // Import the function

const ServiceLocater = ({ goBack }) => {

    const [project, setProject] = useState('');
    const [client, setClient] = useState('');
    const [address, setAddress] = useState('');
    const [pdfLink, setPdfLink] = useState('');

    const projectInputRef = useRef(null);
    const clientInputRef = useRef(null);
    const addressInputRef = useRef(null);

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
        setupProjectsSearch(projectInputRef.current);
        setupClientsSearch(clientInputRef.current);
    }, []);

    const initAutocomplete = () => {
        const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
            types: ['geocode', 'establishment'],  // Enable both address and place names
            componentRestrictions: { country: 'Aus' }, // Restrict results to a specific country
            bounds: new window.google.maps.LatLngBounds(
                new window.google.maps.LatLng(37.7749, -122.4194),
                new window.google.maps.LatLng(37.7749, -122.4194)
            ) // Bias results around a specific location (San Francisco example)
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = {
            date: e.target.date.value,
            project,
            client,
            address,
            contact: e.target.contact.value,
            surveyor: e.target.surveyor.value,
            LocaterMob: e.target.LocaterMob.value,
            dbydJobNumber: e.target.dbydJobNumber.value,
            dbydDateRequested: e.target.dbydDateRequested.value,
            dbydPlansAvailable: e.target.dbydPlansAvailable.value,
            dbydPlansCoverAreas: e.target.dbydPlansCoverAreas.value,
            swmsCompleted: e.target.swmsCompleted.value,
            scopeOfWorks: e.target.scopeOfWorks.value,
            siteNotes: e.target.siteNotes.value
        };

        const response = await fetch('https://2ydho3cldk.execute-api.ap-southeast-2.amazonaws.com/default/ServiceLocatorFile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
        });

        if (response.ok) {
            const pdfBlob = await response.blob();
            const downloadUrl = URL.createObjectURL(pdfBlob);
            setPdfLink(downloadUrl);
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
                                <input type="date" name="date" />
                            </label>
                            <label>
                                Project
                                <input type="text" name="project" placeholder="Start Typing For Project Suggestions.." value={project} onChange={handleProjectChange} disabled={!!client} ref={projectInputRef} autoComplete="off" />
                            </label>
                            <label>
                                Client
                                <input type="text" name="client" placeholder="Start Typing For Client Suggestions.." value={client} onChange={handleClientChange} disabled={!!project} ref={clientInputRef} autoComplete="off" />
                            </label>
                            <label>
                                Job Location
                                <input type="text" name="address" value={address} onChange={handleAddressChange} ref={addressInputRef} autoComplete="off" />
                            </label>
                            <label>
                                Contact
                                <input type="text" name="contact" placeholder="Enter Contact Name" />
                            </label>
                            <label>
                                Locater
                                <input type="text" name="surveyor" placeholder="Enter Locater Name" />
                            </label>
                            <label>
                                Contact Mob. No:
                                <input type="text" name="LocaterMob" placeholder="04xxx xxx xx" />
                            </label>
                        </div>
                    </section>
                    <section className="checklist">
                        <h2>Checklist (Standard)</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Asset Type</th>
                                    <th>Markings</th>
                                    <th>Quality</th>
                                    <th>Comment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { type: 'Gas', markings: 'G, GM, GS', quality: 'A,B,C,D' },
                                    { type: 'Sewer', markings: 'SWR', quality: 'A,B,C,D' },
                                    { type: 'Stormwater', markings: 'STW', quality: 'A,B,C,D' },
                                    { type: 'Telecommunications', markings: 'T, COMMS', quality: 'A,B,C,D' },
                                    { type: 'SAPN/Electrical', markings: 'HV, LV, E', quality: 'A,B,C,D' },
                                    { type: 'Traffic Signals', markings: 'TS', quality: 'A,B,C,D' },
                                    { type: 'Street Lighting', markings: 'SL', quality: 'A,B,C,D' },
                                    { type: 'Water', markings: 'WS, WM, W', quality: 'A,B,C,D' },
                                    { type: 'Fire Main', markings: 'FM', quality: 'A,B,C,D' },
                                    { type: 'Optic Fibre', markings: 'OF', quality: 'A,B,C,D' },
                                    { type: 'Reclaimed Water', markings: 'RW', quality: 'A,B,C,D' },
                                    { type: 'Unknown Services', markings: 'UK', quality: 'A,B,C,D' }
                                ].map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            <label>
                                                <input type="checkbox" name={item.type.toLowerCase()} />
                                                {item.type}
                                            </label>
                                        </td>
                                        <td>{item.markings}</td>
                                        <td>
                                            <label>
                                                <input type="radio" name={`quality-${item.type.toLowerCase()}`} value="A" /> A
                                                <input type="radio" name={`quality-${item.type.toLowerCase()}`} value="B" /> B
                                                <input type="radio" name={`quality-${item.type.toLowerCase()}`} value="C" /> C
                                                <input type="radio" name={`quality-${item.type.toLowerCase()}`} value="D" /> D
                                            </label>
                                        </td>
                                        <td><input type="text" name={`comment-${item.type.toLowerCase()}`} /></td>
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
                                <input type="text" name="dbydPlansAvailable" />
                            </label>
                            <label>
                                DBYD plans cover areas of concern:
                                <input type="text" name="dbydPlansCoverAreas" />
                            </label>
                            <label>
                                SWMS Completed?
                                <input type="text" name="swmsCompleted" />
                            </label>
                            <label>
                                Brief for scope of works:
                                <textarea name="scopeOfWorks" rows="4" />
                            </label> 
                        </div>
                    </section>

                    <section className="site-notes">
                        <h2>Site Notes</h2>
                        <textarea name="siteNotes" rows="10" style={{ width: '50rem' }}></textarea>
                    </section>

                    <section className="photos">
                        <h2>Photos</h2>
                        <input type="file" accept="image/*" multiple />
                    </section>

                    <div className="buttons">
                        <button type="submit">Submit Report</button>
                    </div>
                </form>
                {pdfLink && (
                    <div className="download-link">
                        <a href={pdfLink} download="populated-ServiceLocationFieldReport.pdf">
                            Download Populated Report
                        </a>
                    </div>
                )}
            </div>

            <h1>File Upload to S3</h1>
            <FileUpload />
        </div>
    );
};

export default ServiceLocater;
