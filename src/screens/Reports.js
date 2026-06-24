import React, { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import { listReports, getReportUrl, getReportBlob } from '../services/reportsService';
import { sendReportEmail, isEmailConfigured, blobToBase64 } from '../services/emailService';

const FILTERS = ['All', 'Drafts', 'Sent', 'Approved'];
const statusClass = (s) => `pill pill-${String(s || 'draft').toLowerCase()}`;
const monogram = (s) => (s || 'PR').replace(/[^A-Za-z]/g, ' ').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'PR';

const Reports = () => {
    const showToast = useToast();
    const [filter, setFilter] = useState('All');
    const [reports, setReports] = useState(null); // null = loading

    useEffect(() => { listReports().then(setReports); }, []);

    const rows = (reports || []).filter((r) =>
        filter === 'All' ? true : (r.status || 'Draft') === filter.replace(/s$/, ''));

    const download = async (r) => {
        const url = await getReportUrl(r.id);
        if (url) window.open(url, '_blank', 'noreferrer');
        else showToast('Could not download this report');
    };

    const resend = async (r) => {
        if (!isEmailConfigured()) { showToast('Email is not configured yet'); return; }
        const blob = await getReportBlob(r.id);
        if (!blob) { showToast('Could not load this report'); return; }
        try {
            const contentBase64 = await blobToBase64(blob);
            await sendReportEmail({
                to: [r.client].filter(Boolean),
                subject: `Photo Report${r.siteAddress ? ' — ' + r.siteAddress : ''}`,
                text: 'Please find attached the photo report (re-sent).',
                filename: `${r.title || 'Photo Report'}.pdf`,
                contentBase64,
            });
            showToast(`Report ${r.id} re-sent`);
        } catch (err) {
            console.error(err);
            showToast('Could not re-send the report');
        }
    };

    return (
        <div className="page dc-pop">
            <div className="page-head">
                <h1>Reports</h1>
                <p>Every report you've created — re-download or re-send any time.</p>
            </div>

            <div className="filter-pills">
                {FILTERS.map((f) => (
                    <button key={f} type="button" className={`filter-pill ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f}</button>
                ))}
            </div>

            {reports === null ? (
                <div className="list-card"><div className="loading-row">Loading reports…</div></div>
            ) : rows.length === 0 ? (
                <EmptyState
                    title={reports.length === 0 ? 'No reports yet' : `No ${filter.toLowerCase()} reports`}
                    sub={reports.length === 0 ? 'Generate a report from a tool and it will be saved here.' : 'Try a different filter.'}
                />
            ) : (
                <div className="list-card">
                    {rows.map((r) => (
                        <div key={r.id} className="report-row">
                            <div className="recent-mono" style={{ background: '#1B2230', color: '#F5A623' }}>{monogram(r.title)}</div>
                            <div className="recent-text">
                                <div className="recent-title">{r.title}</div>
                                <div className="recent-meta">{r.meta}</div>
                            </div>
                            <span className={statusClass(r.status)}>{r.status || 'Draft'}</span>
                            <div className="row-actions">
                                <button type="button" className="icon-btn" title="Download" onClick={() => download(r)}>
                                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                </button>
                                <button type="button" className="icon-btn" title="Re-send" onClick={() => resend(r)}>
                                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Reports;
