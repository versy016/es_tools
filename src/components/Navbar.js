import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../stylessheets/Navbar.css';

const Logo = () => (
    <svg viewBox="0 0 40 40" width="28" height="28" aria-hidden="true">
        <path d="M20 22 L11 36 M20 22 L29 36 M20 22 L20 33" stroke="#1B2230" strokeWidth="2.6" strokeLinecap="round" />
        <rect x="17" y="15" width="6" height="9" rx="1.5" fill="#1B2230" />
        <rect x="8" y="8" width="23" height="8" rx="4" fill="#F5A623" />
        <circle cx="20" cy="12" r="2.4" fill="#1B2230" />
    </svg>
);

const initials = (name) => (name || 'User').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const NavBar = ({ userName, role = 'Surveyor', search, onSearch }) => {
    const navigate = useNavigate();
    const linkClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;

    return (
        <nav className="nav">
            <div className="nav-brand" onClick={() => navigate('/dashboard')}>
                <Logo />
                <span className="nav-wordmark">ES Tools</span>
            </div>

            <div className="nav-links">
                <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
                <NavLink to="/reports" className={linkClass}>Reports</NavLink>
                <NavLink to="/users" className={linkClass}>Users</NavLink>
            </div>

            <div className="nav-search">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" fill="none" stroke="#1B2230" strokeWidth="2" />
                    <path d="M16 16 L21 21" stroke="#1B2230" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input value={search} onChange={(e) => onSearch(e.target.value)}
                    placeholder="Search tools, jobs, reports…" aria-label="Search" />
            </div>

            <button type="button" className="nav-profile" onClick={() => navigate('/profile')}>
                <span className="nav-avatar">{initials(userName)}</span>
                <span className="nav-id">
                    <span className="nav-name">{userName || 'User'}</span>
                    <span className="nav-role">{role}</span>
                </span>
            </button>
        </nav>
    );
};

export default NavBar;
