// index.js — React entry point. Mounts the root AppRoot router shell into #root.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// Basic PWA: installable + offline app shell (production builds only). A new version
// activates after all tabs are closed — we don't force-reload, to avoid interrupting
// an in-progress report. See src/service-worker.js for the future offline-sync hook.
serviceWorkerRegistration.register();
