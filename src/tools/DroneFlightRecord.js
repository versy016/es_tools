import React, { useState, useEffect, useRef } from 'react';
import '../stylessheets/DroneFlightRecord.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { setupClientsSearch, setupProjectsSearch } from '../scripts/algoliaSearch';

const ServiceLocater = ({ goBack }) => {
    const [formData, setFormData] = useState({
        date: '',
        project: '',
        client: '',
        duration: '',
        battery: 'A',
        droneID: '',
        weather: '',
        flightAltitude: '',
        launchAltitude: '',
        incidents: ''
    });

    const [docLink, setDocLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [timerState, setTimerState] = useState('initial'); // 'initial', 'running', 'stopped'
    const [startTime, setStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState({ minutes: 0, seconds: 0 });

    const projectInputRef = useRef(null);
    const clientInputRef = useRef(null);

    useEffect(() => {
        setupProjectsSearch(projectInputRef.current, (project) => setFormData({ ...formData, project }));
        setupClientsSearch(clientInputRef.current, (client) => setFormData({ ...formData, client }));
    }, [formData]);

    useEffect(() => {
        let interval = null;
        if (timerState === 'running') {
            interval = setInterval(() => {
                const now = Date.now();
                const totalSeconds = Math.floor((now - startTime) / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                setElapsedTime({ minutes, seconds });
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [timerState, startTime]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleStartTimer = () => {
        setStartTime(Date.now() - elapsedTime.minutes * 60000 - elapsedTime.seconds * 1000); // To continue from the last time
        setTimerState('running');
    };

    const handleStopTimer = () => {
        setTimerState('stopped');
        const totalMinutes = elapsedTime.minutes + elapsedTime.seconds / 60;
        setFormData({ ...formData, duration: totalMinutes.toFixed(2) });
    };

    const handleResetTimer = () => {
        setTimerState('initial');
        setStartTime(null);
        setElapsedTime({ minutes: 0, seconds: 0 });
        setFormData({ ...formData, duration: '' });
    };

    const handleRestartTimer = () => {
        setStartTime(Date.now() - elapsedTime.minutes * 60000 - elapsedTime.seconds * 1000); // Continue from where it was stopped
        setTimerState('running');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

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
        setLoading(false);
    };

    return (
        <div>
            <div className="back-link" onClick={goBack}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back to Tools
            </div>
            <div className="service-locater">
                <h1>ES Drone Flight Record Log</h1>
                <form onSubmit={handleSubmit} className="form-grid">
                    <section className="job-details">
                        <h2>Drone Flight Record</h2>
                        <div className="form-group">
                            <label>Date:</label>
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Project:</label>
                            <input type="text" name="project" placeholder="Start Typing For Project Suggestions.." value={formData.project.name} disabled={!!formData.client} onChange={handleChange} ref={projectInputRef} autoComplete="off" />
                        </div>
                        <div className="form-group">
                            <label>Client:</label>
                            <input type="text" name="client" placeholder="Start Typing For Client Suggestions.." value={formData.client.name} disabled={!!formData.project} onChange={handleChange} ref={clientInputRef} autoComplete="off" />
                        </div>
                        <div className="form-group timer-controls">
                            <label>Flight Timer:</label>
                            <div>
                                {timerState === 'initial' && (
                                    <button type="button" onClick={handleStartTimer} className="start-button">Start</button>
                                )}
                                {timerState === 'running' && (
                                    <button type="button" onClick={handleStopTimer} className="stop-button">Stop</button>
                                )}
                                {timerState === 'stopped' && (
                                    <>
                                        <button type="button" onClick={handleRestartTimer} className="restart-button">Restart</button>
                                        <button type="button" onClick={handleResetTimer} className="reset-button">Reset</button>
                                    </>
                                )}
                            </div>
                            <span>Duration: {elapsedTime.minutes} minutes {elapsedTime.seconds} seconds</span>
                        </div>
                        <div className="form-group">
                            <label>Battery:</label>
                            <div className="battery-options">
                                {['A', 'B', 'C', 'D'].map((battery) => (
                                    <label key={battery}>
                                        <input type="radio" name="battery" value={battery} checked={formData.battery === battery} onChange={handleChange} />
                                        {battery}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Drone I.D No:</label>
                            <input type="text" name="droneID" value={formData.droneID} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Weather & WindSpeed:</label>
                            <input type="text" name="weather" value={formData.weather} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Flight Altitude AGL:</label>
                            <input type="number" name="flightAltitude" value={formData.flightAltitude} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Launch Altitude:</label>
                            <input type="number" name="launchAltitude" value={formData.launchAltitude} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Incidents During Flight Concerns/Issues:</label>
                            <input type="text" name="incidents" value={formData.incidents} onChange={handleChange} required />
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
