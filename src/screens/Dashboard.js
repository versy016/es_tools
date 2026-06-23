import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { TOOLS } from '../data/toolsRegistry';
import ToolTile from '../components/ToolTile';
import { useToast } from '../components/Toast';

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

const statusClass = (s) => `pill pill-${s.toLowerCase()}`;

const RECENT = [
    { id: 'r1', mono: 'WC', title: 'Photo report — Westfield Carpark', meta: 'Job SL‑20471 · 4 photos · autosaved 2m ago', status: 'Draft', badgeBg: '#1B2230', badgeFg: '#F5A623' },
    { id: 'r2', mono: 'YK', title: 'Photo report — Yankalilla', meta: 'Job SL‑20455 · Sent 23 Jun', status: 'Sent', badgeBg: '#FEF3DD', badgeFg: '#9A6B00' },
    { id: 'r3', mono: 'MS', title: 'Service location — Main South Rd', meta: 'Job SL‑20448 · Approved 21 Jun', status: 'Approved', badgeBg: '#E9F6F0', badgeFg: '#1E7A52' },
];

const Dashboard = () => {
    const navigate = useNavigate();
    const showToast = useToast();
    const { search = '', userName } = useOutletContext() || {};
    const [favs, setFavs] = useState(loadFavs);
    const [view, setView] = useState('grid');

    const firstName = (userName || 'there').split(' ')[0];
    const q = search.trim().toLowerCase();
    const tools = q
        ? TOOLS.filter((t) => (t.name + ' ' + t.desc).toLowerCase().includes(q))
        : TOOLS;

    const toggleFav = (id) => {
        setFavs((prev) => {
            const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
            localStorage.setItem(FAVS_KEY, JSON.stringify(next));
            return next;
        });
    };

    const openTool = (tool) => {
        if (tool.live) navigate(tool.route);
        else showToast(`${tool.name} is coming soon`);
    };

    return (
        <div className="page dc-pop">
            <div className="page-head">
                <p className="page-eyebrow">{todayLabel()}</p>
                <h1>{greeting()}, {firstName}</h1>
                <p>You have 2 drafts in progress — pick up where you left off.</p>
            </div>

            <div className="resume-card" onClick={() => navigate('/tools/photo-report')}>
                <div className="resume-glow" />
                <div className="resume-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1B2230" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                    </svg>
                </div>
                <div className="resume-body">
                    <div className="resume-eyebrow">CONTINUE WHERE YOU LEFT OFF</div>
                    <div className="resume-title">Photo report — Westfield Carpark</div>
                    <div className="resume-meta">Job SL‑20471 · 4 photos · 3 potholes · autosaved 2m ago</div>
                </div>
                <div className="resume-cta">Resume
                    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#F5A623" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </div>
            </div>

            <div className="tools-head">
                <div className="tools-head-left">
                    <h2>Your tools</h2>
                    <span className="tools-count">{tools.length} of {TOOLS.length}</span>
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

            <div className="recent-card">
                <h2>Recent reports</h2>
                {RECENT.map((r) => (
                    <div key={r.id} className="recent-row" onClick={() => navigate('/reports')}>
                        <div className="recent-mono" style={{ background: r.badgeBg, color: r.badgeFg }}>{r.mono}</div>
                        <div className="recent-text">
                            <div className="recent-title">{r.title}</div>
                            <div className="recent-meta">{r.meta}</div>
                        </div>
                        <span className={statusClass(r.status)}>{r.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
