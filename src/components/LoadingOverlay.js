import React from 'react';
import Spinner from './Spinner';
import './LoadingOverlay.css';

// Full-screen dimmed overlay with a spinner + message — shown while a report is being
// generated/emailed, a user is invited/deleted, or any other blocking async task.
// Self-contained + portable. Render it conditionally:
//   {busy && <LoadingOverlay message="Generating report, please wait…" />}
const LoadingOverlay = ({ message = 'Working, please wait…' }) => (
    <div className="loading-overlay" role="status" aria-live="polite">
        <div className="loading-overlay-box">
            <Spinner size={24} light />
            <p>{message}</p>
        </div>
    </div>
);

export default LoadingOverlay;
