// UserManagement.js — admin-only screen (gated by RequireManager). Shows user
// stat tiles, a roster with per-user role select and activate/deactivate, an
// invite action, and an audit log. All mutations go through usersService and
// re-fetch on success.
import React, { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthProvider';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import ToolAccessDialog from '../components/ToolAccessDialog';
import InviteDialog from '../components/InviteDialog';
import LoadingOverlay from '../components/LoadingOverlay';
import { TOOLS } from '../data/toolsRegistry';
import { listUsers, setUserActive, setUserRole, setUserTools, deleteUser, inviteUser, isConfigured } from '../services/usersService';

// Assignable roles for the per-user role <select>.
const ROLES = ['Surveyor', 'Manager', 'Admin'];
const toolName = (id) => (TOOLS.find((t) => t.id === id) || {}).name || id;

const roleClass = (r) => `pill pill-role-${String(r || 'surveyor').toLowerCase()}`;
const initials = (n) => (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const UserManagement = () => {
    const showToast = useToast();
    const { role: myRole, user } = useAuth();
    const myId = user?.id; // to prevent deleting your own account
    // A manager (top role) can manage anyone; an admin can manage anyone except a manager.
    const canManage = (targetRole) => {
        const me = String(myRole || '').toLowerCase();
        const them = String(targetRole || '').toLowerCase();
        return me === 'manager' || (me === 'admin' && them !== 'manager');
    };
    const [data, setData] = useState(null); // null = loading; { users, audit } once loaded
    const [inviteOpen, setInviteOpen] = useState(false); // invite dialog visibility
    const [toolUser, setToolUser] = useState(null);       // user whose tool access is being edited
    const [delUser, setDelUser] = useState(null);         // user queued for deletion (drives the confirm dialog)
    const [busy, setBusy] = useState(null);               // message shown in the full-screen overlay during a mutation
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

    // Run an async mutation with the full-screen overlay + a refresh on success.
    const withBusy = async (message, fn, okToast, errToast) => {
        setBusy(message);
        try {
            const ok = await fn();
            if (ok) { showToast(okToast, 'success'); await refresh(); }
            else showToast(errToast, 'error');
        } finally {
            setBusy(null);
        }
    };

    // Activate/deactivate a user.
    const toggle = (u) => withBusy(
        u.active ? 'Deactivating…' : 'Activating…',
        () => setUserActive(u.username || u.email, !u.active),
        `${u.name || u.email} ${u.active ? 'deactivated' : 'activated'}`,
        'Could not update user',
    );

    // Roles the current user may assign when inviting (managers can create managers).
    const inviteRoles = String(myRole || '').toLowerCase() === 'manager'
        ? ['Surveyor', 'Manager', 'Admin']
        : ['Surveyor', 'Admin'];

    // Send an invite with the entered name, email and role.
    const doInvite = ({ name, email, role }) => {
        setInviteOpen(false);
        return withBusy('Sending invite…', () => inviteUser(email, role, name), 'Invite sent', 'Could not send invite');
    };

    // Change a user's role; no-op if unchanged.
    const changeRole = (u, role) => {
        if (role === u.role) return undefined;
        return withBusy('Updating role…', () => setUserRole(u.username || u.email, role),
            `${u.name || u.email} is now ${role}`, 'Could not change role');
    };

    // Save a user's tool restriction (array of ids, or null for all tools).
    const saveTools = (tools) => {
        const u = toolUser;
        setToolUser(null);
        if (!u) return undefined;
        return withBusy('Updating tool access…', () => setUserTools(u.username || u.email, tools),
            `Tool access updated for ${u.name || u.email}`, 'Could not update tool access');
    };

    // Permanently delete a user (profile row + auth login).
    const doDeleteUser = () => {
        const u = delUser;
        setDelUser(null);
        if (!u) return undefined;
        return withBusy('Deleting user…', () => deleteUser(u.username || u.email),
            `${u.name || u.email} deleted`, 'Could not delete this user');
    };

    return (
        <div className="page dc-pop">
            <div className="page-head row-between">
                <div>
                    <h1>User management</h1>
                    <p>Manage who can access ES Tools and what they can do.</p>
                </div>
                <button type="button" className="btn-yellow" onClick={() => setInviteOpen(true)} disabled={!configured}>
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
                                onChange={(e) => changeRole(u, e.target.value)} aria-label="Change role"
                                disabled={!canManage(u.role)}>
                                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <div className="tool-chips">
                                {u.tools === null
                                    ? <span className="tool-chip">All tools</span>
                                    : u.tools.length === 0
                                        ? <span className="tool-chip muted">No tools</span>
                                        : u.tools.map((id) => <span key={id} className="tool-chip">{toolName(id)}</span>)}
                                {canManage(u.role) && (
                                    <button type="button" className="tool-edit-btn" onClick={() => setToolUser(u)}
                                        title="Edit tool access">Edit</button>
                                )}
                            </div>
                            <span className={`status-dot ${u.active ? 'active' : 'inactive'}`}>
                                <span className="dot" />{u.active ? 'Active' : 'Inactive'}
                            </span>
                            <div className="user-row-actions">
                                <button type="button" className="btn-outline sm" onClick={() => toggle(u)}
                                    disabled={!canManage(u.role)}>
                                    {u.active ? 'Deactivate' : 'Activate'}
                                </button>
                                {canManage(u.role) && u.username !== myId && (
                                    <button type="button" className="user-del-btn" onClick={() => setDelUser(u)}
                                        title="Delete user">Delete</button>
                                )}
                            </div>
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

            <InviteDialog
                open={inviteOpen}
                roles={inviteRoles}
                onSubmit={doInvite}
                onCancel={() => setInviteOpen(false)}
            />

            <ToolAccessDialog
                open={!!toolUser}
                user={toolUser}
                onSave={saveTools}
                onCancel={() => setToolUser(null)}
            />

            <ConfirmDialog
                open={!!delUser}
                title="Delete user?"
                message={delUser
                    ? `Permanently delete ${delUser.name || delUser.email}? This removes their account and profile — they'll be signed out and can no longer log in. This cannot be undone.`
                    : ''}
                confirmLabel="Delete user"
                destructive
                onConfirm={doDeleteUser}
                onCancel={() => setDelUser(null)}
            />

            {busy && <LoadingOverlay message={busy} />}
        </div>
    );
};

export default UserManagement;
