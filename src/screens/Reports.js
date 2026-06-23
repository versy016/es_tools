import React, { useState } from 'react';
import { useToast } from '../components/Toast';

const REPORTS = [
    { id: 'SL-20471', mono: 'WC', title: 'Photo report — Westfield Carpark', meta: 'Job SL‑20471 · 4 photos · 3 potholes', status: 'Draft', badgeBg: '#1B2230', badgeFg: '#F5A623' },
    { id: 'SL-20455', mono: 'YK', title: 'Photo report — Yankalilla', meta: 'Job SL‑20455 · Sent to MDJV/APEX · 23 Jun', status: 'Sent', badgeBg: '#FEF3DD', badgeFg: '#9A6B00' },
    { id: 'SL-20448', mono: 'MS', title: 'Service location — Main South Rd', meta: 'Job SL‑20448 · Approved by B. Gosling · 21 Jun', status: 'Approved', badgeBg: '#E9F6F0', badgeFg: '#1E7A52' },
    { id: 'SL-20440', mono: 'RP', title: 'Photo report — Reservoir Pump Stn', meta: 'Job SL‑20440 · Sent · 19 Jun', status: 'Sent', badgeBg: '#FEF3DD', badgeFg: '#9A6B00' },
];

const FILTERS = ['All', 'Drafts', 'Sent', 'Approved'];
const statusClass = (s) => `pill pill-${s.toLowerCase()}`;

const Reports = () => {
    const showToast = useToast();
    const [filter, setFilter] = useState('All');

    const rows = filter === 'All'
        ? REPORTS
        : REPORTS.filter((r) => r.status === filter.replace(/s$/, ''));

    return (
        <div className="page dc-pop">
            <div className="page-head">
                <h1>Reports</h1>
                <p>Every report you've created — re‑download or re‑send any time.</p>
            </div>

            <div className="filter-pills">
                {FILTERS.map((f) => (
                    <button key={f} type="button" className={`filter-pill ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f}</button>
                ))}
            </div>

            <div className="list-card">
                {rows.map((r) => (
                    <div key={r.id} className="report-row">
                        <div className="recent-mono" style={{ background: r.badgeBg, color: r.badgeFg }}>{r.mono}</div>
                        <div className="recent-text">
                            <div className="recent-title">{r.title}</div>
                            <div className="recent-meta">{r.meta}</div>
                        </div>
                        <span className={statusClass(r.status)}>{r.status}</span>
                        <div className="row-actions">
                            <button type="button" className="icon-btn" title="Re-download" onClick={() => showToast(`Downloading ${r.id}…`)}>
                                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                            </button>
                            <button type="button" className="icon-btn" title="Re-send" onClick={() => showToast(`Report ${r.id} re‑sent`)}>
                                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Reports;
