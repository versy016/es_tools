import React from 'react';
import './LoadingOverlay.css';

// Full-screen dimmed overlay with a spinner + message — shown while a report is being
// generated/emailed, or any other blocking async task. Self-contained (brings its own
// styles) so it can be dropped into any screen. Render it conditionally:
//   {busy && <LoadingOverlay message="Generating report, please wait…" />}
const LoadingOverlay = ({ message = 'Working, please wait…' }) => (
    <div className="loading-overlay" role="status" aria-live="polite">
        <div className="loading-overlay-box">
            <span className="loading-overlay-spinner" aria-hidden="true" />
            <p>{message}</p>
        </div>
    </div>
);

export default LoadingOverlay;
