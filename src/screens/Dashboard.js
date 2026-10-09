// Dashboard.js — landing screen. Time-of-day greeting, the tool search, the tool grid/list
// (favouritable, search-filtered) and a recent-reports list. Reports come from
// reportsService; search, favourites and grid/list view are local UI state.
import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { TOOLS } from '../data/toolsRegistry';
import ToolTile from '../components/ToolTile';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { listReports, getReportUrl } from '../services/reportsService';
import { isDraft } from '../lib/reportStatus';

// Favourites are persisted client-side only (localStorage), keyed by tool id.
const FAVS_KEY = 'es_tools_favs';
const loadFavs = () => {
    try { return JSON.parse(localStorage.getItem(FAVS_KEY) || '[]'); } catch { return []; }
};

const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
};

const todayLabel = () => new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
const statusClass = (s) => `pill pill-${String(s || 'draft').toLowerCase()}`;
const monogram = (s) => (s || 'PR').replace(/[^A-Za-z]/g, ' ').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'PR';

const Dashboard = () => {
    const navigate = useNavigate();
    const showToast = useToast();
    const { userName } = useOutletContext() || {};
    const [search, setSearch] = useState('');
    const { allowedTools, profile, user, role } = useAuth(); // tools restriction + profile + role
    const isManager = String(role || '').toLowerCase() === 'manager'; // top role; admins excluded
    const [favs, setFavs] = useState(loadFavs);
    const [view, setView] = useState('grid');
    const [reports, setReports] = useState(null); // null = loading, [] = loaded-but-empty

    // Fetch reports once on mount; drives the recent list and draft count.
    useEffect(() => { listReports().then(setReports); }, []);

    // First login without a signature: nudge the user to set one up (once per browser).
    useEffect(() => {
        if (!profile) return;
        let prompted = false;
        try { prompted = localStorage.getItem(`es_tools_sig_prompted_${user?.id}`) === '1'; } catch { /* ignore */ }
        if (!profile.signature && !prompted) navigate('/setup-signature', { replace: true });
    }, [profile, user, navigate]);

    const firstName = (userName || 'there').split(' ')[0];
    const q = search.trim().toLowerCase();
    // Manager-only tools are shown to managers ONLY (not admins/surveyors); then apply any
    // per-user tool allowlist before searching.
    const permitted = TOOLS.filter((t) => (!t.managerOnly || isManager) && (!allowedTools || allowedTools.includes(t.id)));
    const visible = permitted;
    const tools = q ? visible.filter((t) => (t.name + ' ' + t.desc).toLowerCase().includes(q)) : visible;
    const recent = (reports || []).slice(0, 4);
    const draftCount = (reports || []).filter((r) => isDraft(r.status)).length;

    const toggleFav = (id) => {
        setFavs((prev) => {
            const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
            localStorage.setItem(FAVS_KEY, JSON.stringify(next));
            return next;
        });
    };

    // Live tools route to their tool page; coming-soon tools just toast.
    const openTool = (tool) => {
        if (tool.live) navigate(tool.route);
        else showToast(`${tool.name} is coming soon`);
    };

    // Open a stored report in a new tab via a freshly signed URL.
    const openReport = async (r) => {
        const url = await getReportUrl(r.id);
        if (url) window.open(url, '_blank', 'noreferrer');
        else showToast('Could not open this report');
    };

    return (
        <div className="page dc-pop">
            <div className="page-head dash-head">
                <div>
                    <p className="page-eyebrow">{todayLabel()}</p>
                    <h1>{greeting()}, {firstName}</h1>
                    <p>{draftCount > 0 ? `You have ${draftCount} draft${draftCount === 1 ? '' : 's'} in progress.` : 'Pick a tool to start a new report.'}</p>
                </div>
                <div className="dash-search">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" fill="none" stroke="#1B2230" strokeWidth="2" />
                        <path d="M16 16 L21 21" stroke="#1B2230" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tools…" aria-label="Search tools" />
                </div>
            </div>

            <div className="tools-head">
                <div className="tools-head-left">
                    <h2>Your tools</h2>
                    <span className="tools-count">{tools.length} of {visible.length}</span>
                </div>
                <div className="view-toggle">
                    <button type="button" className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Grid view">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                    </button>
                    <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="List view">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                    </button>
                </div>
            </div>

            {tools.length === 0 ? (
                <div className="empty-panel">
                    <div className="empty-title">No tools match “{search}”</div>
                    <div className="empty-sub">Try a different search or clear the filter.</div>
                </div>
            ) : view === 'grid' ? (
                <div className="tools-grid">
                    {tools.map((t) => (
                        <ToolTile key={t.id} tool={t} fav={favs.includes(t.id)} onToggleFav={toggleFav} onOpen={openTool} view="grid" />
                    ))}
                </div>
            ) : (
                <div className="tools-list">
                    {tools.map((t) => (
                        <ToolTile key={t.id} tool={t} fav={favs.includes(t.id)} onToggleFav={toggleFav} onOpen={openTool} view="list" />
                    ))}
                </div>
            )}

            {/* Recent reports: loading spinner, empty state, or up to four rows. */}
            <div className="recent-card">
                <h2>Recent reports</h2>
                {reports === null ? (
                    <div className="loading-row">Loading…</div>
                ) : recent.length === 0 ? (
                    <EmptyState title="No reports yet" sub="Reports you generate will appear here." />
                ) : recent.map((r) => (
                    <div key={r.id} className="recent-row" onClick={() => openReport(r)}>
                        <div className="recent-mono" style={{ background: '#1B2230', color: '#F5A623' }}>{monogram(r.title)}</div>
                        <div className="recent-text">
                            <div className="recent-title">{r.title}</div>
                            <div className="recent-meta">{r.meta}</div>
                        </div>
                        <span className={statusClass(r.status)}>{r.status || 'Draft'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
