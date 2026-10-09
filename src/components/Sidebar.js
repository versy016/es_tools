// Sidebar.js — the app's only navigation (replaces the old top NavBar). Fixed on the left on
// desktop, a slide-in drawer behind a menu button below tablet width. Groups:
//   Home   — Dashboard, Reports, My drafts (live count badge)
//   Manage — Users, Templates (managers/admins)
//   footer — My signature, the user (→ Profile), Sign out
// Tools are deliberately NOT listed here — the dashboard grid is the launcher.
// Every navigation runs through the NavGuard so a tool can prompt "save as draft?".
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useNavGuard } from './NavGuard';
import { listReports } from '../services/reportsService';
import { isDraft } from '../lib/reportStatus';
import '../stylessheets/Sidebar.css';

const initials = (name) => (name || 'User').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const roleLabel = (r) => (r || 'surveyor').replace(/^./, (c) => c.toUpperCase());

// Small inline icons (stroke-only, inherit colour) so the sidebar needs no icon library.
const Icon = ({ d }) => (
    <svg className="sb-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICONS = {
    dashboard: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
    reports: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6',
    drafts: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    templates: 'M4 4h16v16H4zM4 9h16M9 9v11',
    signature: 'M3 17c3-6 5-6 7 0s4 6 7 0M3 21h18',
    signout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    menu: 'M3 6h18M3 12h18M3 18h18',
};

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { runGuarded } = useNavGuard();
    const { userName, role, signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const [drafts, setDrafts] = useState(0);

    const r = String(role || 'surveyor').toLowerCase();
    const canManage = r === 'manager' || r === 'admin';

    // Re-count on every navigation: drafts get finalised or deleted on other screens, and a
    // count fetched once at app load would go stale.
    useEffect(() => {
        let live = true;
        listReports().then((rows) => { if (live) setDrafts((rows || []).filter((x) => isDraft(x.status)).length); }).catch(() => {});
        return () => { live = false; };
    }, [location.pathname, location.search]);

    const go = (to) => { setOpen(false); runGuarded(() => navigate(to)); };
    // Reports and My drafts share a path and differ only by ?status=Drafts, so their active
    // state is decided here from the router location, not by NavLink's path matching.
    const onDrafts = location.pathname === '/reports' && new URLSearchParams(location.search).get('status') === 'Drafts';
    const linkClass = ({ isActive }) => `sb-item${isActive ? ' active' : ''}`;
    const Link = ({ to, icon, children, end, active }) => (
        <NavLink to={to} end={end} className={active === undefined ? linkClass : () => `sb-item${active ? ' active' : ''}`}
            onClick={(e) => { e.preventDefault(); go(to); }}>
            <Icon d={icon} /><span className="sb-label">{children}</span>
        </NavLink>
    );

    return (
        <>
            <button type="button" className="sb-burger" aria-label="Open menu" onClick={() => setOpen((o) => !o)}><Icon d={ICONS.menu} /></button>
            {open && <div className="sb-backdrop" onClick={() => setOpen(false)} />}
            <nav className={`sb${open ? ' open' : ''}`} aria-label="Main">
                <div className="sb-brand" onClick={() => go('/dashboard')}>
                    <img src="/images/es-logo-dark.png" alt="Engineering Surveys" />
                </div>

                <div className="sb-group">
                    <Link to="/dashboard" icon={ICONS.dashboard}>Dashboard</Link>
                    <Link to="/reports" icon={ICONS.reports} active={location.pathname === '/reports' && !onDrafts}>Reports</Link>
                    {/* className as a function: a plain string would get NavLink's own "active" appended on any /reports match. */}
                    <NavLink to="/reports?status=Drafts" className={() => `sb-item${onDrafts ? ' active' : ''}`}
                        onClick={(e) => { e.preventDefault(); go('/reports?status=Drafts'); }}>
                        <Icon d={ICONS.drafts} /><span className="sb-label">My drafts</span>
                        {drafts > 0 && <span className="sb-badge">{drafts}</span>}
                    </NavLink>
                </div>

                {canManage && (
                    <div className="sb-group">
                        <div className="sb-heading">Manage</div>
                        <Link to="/users" icon={ICONS.users}>Users</Link>
                        <Link to="/templates" icon={ICONS.templates}>Templates</Link>
                    </div>
                )}

                <div className="sb-foot">
                    <Link to="/signature" icon={ICONS.signature}>My signature</Link>
                    <button type="button" className="sb-item sb-user" onClick={() => go('/profile')}>
                        <span className="sb-avatar">{initials(userName)}</span>
                        <span className="sb-id"><span className="sb-name">{userName || 'User'}</span><span className="sb-role">{roleLabel(role)}</span></span>
                    </button>
                    <button type="button" className="sb-item" onClick={() => runGuarded(signOut)}><Icon d={ICONS.signout} /><span className="sb-label">Sign out</span></button>
                </div>
            </nav>
        </>
    );
};

export default Sidebar;
