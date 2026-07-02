// Navbar.js — top navigation bar shown across authenticated screens. Holds the
// brand/home link, primary nav (with a role-gated Users link), the shared search
// box, a profile button, and the sign-out button.
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useNavGuard } from './NavGuard';
import '../stylessheets/Navbar.css';

// Derive up-to-two-letter avatar initials from a display name.
const initials = (name) => (name || 'User').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Search/role/sign-out state is owned by AppShell and passed in as props.
const NavBar = ({ userName, role = 'Surveyor', search, onSearch, onSignOut }) => {
    const navigate = useNavigate();
    const { runGuarded } = useNavGuard();
    const linkClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;
    // Route every navigation through the guard so a tool can prompt "save as draft?".
    const go = (to) => runGuarded(() => navigate(to));
    const onLink = (to) => (e) => { e.preventDefault(); go(to); };
    // Mirror App's RBAC check so only managers/admins see the Users link.
    const canManageUsers = ['admin', 'manager'].includes(String(role).toLowerCase());

    return (
        <nav className="nav">
            <div className="nav-brand" onClick={() => go('/dashboard')}>
                <img src="/images/ES_Logo_white_background.png" alt="Engineering Surveys"
                    style={{ height: '30px', width: 'auto', display: 'block' }} />
            </div>

            <div className="nav-links">
                <NavLink to="/dashboard" className={linkClass} onClick={onLink('/dashboard')}>Dashboard</NavLink>
                <NavLink to="/reports" className={linkClass} onClick={onLink('/reports')}>Reports</NavLink>
                {/* Role-gated: hidden from surveyors. */}
                {canManageUsers && <NavLink to="/users" className={linkClass} onClick={onLink('/users')}>Users</NavLink>}
            </div>

            <div className="nav-search">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" fill="none" stroke="#1B2230" strokeWidth="2" />
                    <path d="M16 16 L21 21" stroke="#1B2230" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input value={search} onChange={(e) => onSearch(e.target.value)}
                    placeholder="Search tools, jobs, reports…" aria-label="Search" />
            </div>

            {/* Profile button: avatar + name/role, routes to the profile screen. */}
            <button type="button" className="nav-profile" onClick={() => go('/profile')}>
                <span className="nav-avatar">{initials(userName)}</span>
                <span className="nav-id">
                    <span className="nav-name">{userName || 'User'}</span>
                    <span className="nav-role">{role}</span>
                </span>
            </button>

            {/* Sign-out: only rendered when a handler is supplied. */}
            {onSignOut && (
                <button type="button" className="nav-signout" onClick={() => runGuarded(onSignOut)} title="Sign out" aria-label="Sign out">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                    </svg>
                </button>
            )}
        </nav>
    );
};

export default NavBar;
