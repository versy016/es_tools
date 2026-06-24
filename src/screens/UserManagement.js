// UserManagement.js — admin-only screen (gated by RequireManager). Shows user
// stat tiles, a roster with per-user role select and activate/deactivate, an
// invite action, and an audit log. All mutations go through usersService and
// re-fetch on success.
import React, { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import { listUsers, setUserActive, setUserRole, inviteUser, isConfigured } from '../services/usersService';

// Assignable roles for the per-user role <select>.
const ROLES = ['Surveyor', 'Manager', 'Admin'];

const roleClass = (r) => `pill pill-role-${String(r || 'surveyor').toLowerCase()}`;
const initials = (n) => (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const UserManagement = () => {
    const showToast = useToast();
    const [data, setData] = useState(null); // null = loading; { users, audit } once loaded
    const configured = isConfigured(); // false => backend not wired; disables invite + shows hint

    // Re-fetch users + audit after any mutation so the UI reflects server state.
    const refresh = () => listUsers().then(setData);
    useEffect(() => { refresh(); }, []);

    const users = (data && data.users) || [];
    const audit = (data && data.audit) || [];
    // Stat tile counts: inactive users are treated as pending invites.
    const total = users.length;
    const active = users.filter((u) => u.active).length;
    const pending = users.filter((u) => !u.active).length;

    // Activate/deactivate a user; toast and refresh on success.
    const toggle = async (u) => {
        const ok = await setUserActive(u.username || u.email, !u.active);
        if (ok) { showToast(`${u.name || u.email} ${u.active ? 'deactivated' : 'activated'}`); refresh(); }
        else showToast('Could not update user');
    };

    // Prompt for an email and send an invite (defaults the new user to Surveyor).
    const invite = async () => {
        const email = window.prompt('Email address to invite:');
        if (!email) return;
        const ok = await inviteUser(email, 'Surveyor');
        if (ok) { showToast('Invite sent'); refresh(); }
        else showToast('Could not send invite');
    };

    // Change a user's role; no-op if unchanged.
    const changeRole = async (u, role) => {
        if (role === u.role) return;
        const ok = await setUserRole(u.username || u.email, role);
        if (ok) { showToast(`${u.name || u.email} is now ${role}`); refresh(); }
        else showToast('Could not change role');
    };

    return (
        <div className="page dc-pop">
            <div className="page-head row-between">
                <div>
                    <h1>User management</h1>
                    <p>Manage who can access ES Tools and what they can do.</p>
                </div>
                <button type="button" className="btn-yellow" onClick={invite} disabled={!configured}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6" /></svg>
                    Invite user
                </button>
            </div>

            <div className="stat-tiles">
                <div className="stat-tile"><div className="stat-label">Total users</div><div className="stat-value">{total}</div></div>
                <div className="stat-tile"><div className="stat-label">Active</div><div className="stat-value">{active}</div></div>
                <div className="stat-tile"><div className="stat-label">Pending invites</div><div className="stat-value">{pending}</div></div>
            </div>

            {/* Loading -> spinner; no users -> empty state whose copy depends on
                whether the backend is configured; else the roster. */}
            {data === null ? (
                <div className="list-card"><div className="loading-row">Loading users…</div></div>
            ) : users.length === 0 ? (
                <EmptyState
                    title={configured ? 'No users found' : 'User management not connected'}
                    sub={configured
                        ? 'Invite your first team member to get started.'
                        : 'Connect Supabase and run supabase/SETUP.md to manage users and roles.'}
                />
            ) : (
                <div className="list-card">
                    <div className="user-row user-head"><span>User</span><span>Role</span><span>Tools</span><span>Status</span><span></span></div>
                    {users.map((u) => (
                        <div key={u.username || u.email} className="user-row">
                            <div className="user-cell">
                                <span className="user-avatar">{initials(u.name)}</span>
                                <div><div className="user-name">{u.name || u.email}</div><div className="user-email">{u.email}</div></div>
                            </div>
                            <select className={`role-select ${roleClass(u.role)}`} value={u.role || 'Surveyor'}
                                onChange={(e) => changeRole(u, e.target.value)} aria-label="Change role">
                                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <div className="tool-chips">
                                {(u.tools || []).map((t) => <span key={t} className="tool-chip">{t}</span>)}
                            </div>
                            <span className={`status-dot ${u.active ? 'active' : 'inactive'}`}>
                                <span className="dot" />{u.active ? 'Active' : 'Inactive'}
                            </span>
                            <button type="button" className="btn-outline sm" onClick={() => toggle(u)}>
                                {u.active ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Audit log of administrative actions (who / what / when). */}
            <div className="audit-card">
                <h2>Audit log</h2>
                {data === null ? (
                    <div className="loading-row">Loading…</div>
                ) : audit.length === 0 ? (
                    <EmptyState title="No activity yet" sub="Administrative actions will be logged here." />
                ) : audit.map((a, i) => (
                    <div key={i} className="audit-row">
                        <span className="audit-dot" />
                        <div className="audit-text"><strong>{a.who}</strong> {a.what}</div>
                        <span className="audit-when">{a.when}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UserManagement;
