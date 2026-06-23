import React, { useState } from 'react';
import { useToast } from '../components/Toast';

const USERS = [
    { id: 'u1', name: 'Ben Gosling', email: 'bgosling@engsurveys.com.au', role: 'Manager', tools: ['Photo report', 'Service location'], active: true },
    { id: 'u2', name: 'Ethan Humphries', email: 'ehumphries@engsurveys.com.au', role: 'Surveyor', tools: ['Photo report'], active: true },
    { id: 'u3', name: 'Shivam Verma', email: 'sverma@engsurveys.com.au', role: 'Admin', tools: ['Photo report', 'Service location', 'Site survey'], active: true },
    { id: 'u4', name: 'Dave Mitchell', email: 'dmitchell@engsurveys.com.au', role: 'Surveyor', tools: ['Photo report'], active: false },
];

const AUDIT = [
    { who: 'Shivam Verma', what: 'invited dmitchell@engsurveys.com.au as Surveyor', when: 'Today, 9:14am' },
    { who: 'Ben Gosling', what: 'approved report SL‑20448', when: 'Yesterday, 4:02pm' },
    { who: 'Shivam Verma', what: 'assigned Site survey to E. Humphries', when: '21 Jun, 11:30am' },
];

const roleClass = (r) => `pill pill-role-${r.toLowerCase()}`;
const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const UserManagement = () => {
    const showToast = useToast();
    const [users, setUsers] = useState(USERS);

    const total = users.length;
    const active = users.filter((u) => u.active).length;
    const pending = users.filter((u) => !u.active).length;

    const toggle = (id) => {
        setUsers((prev) => prev.map((u) => {
            if (u.id !== id) return u;
            showToast(`${u.name} ${u.active ? 'deactivated' : 'activated'}`);
            return { ...u, active: !u.active };
        }));
    };

    return (
        <div className="page dc-pop">
            <div className="page-head row-between">
                <div>
                    <h1>User management</h1>
                    <p>Manage who can access ES Tools and what they can do.</p>
                </div>
                <button type="button" className="btn-yellow" onClick={() => showToast('Invite sent')}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6" /></svg>
                    Invite user
                </button>
            </div>

            <div className="stat-tiles">
                <div className="stat-tile"><div className="stat-label">Total users</div><div className="stat-value">{total}</div></div>
                <div className="stat-tile"><div className="stat-label">Active</div><div className="stat-value">{active}</div></div>
                <div className="stat-tile"><div className="stat-label">Pending invites</div><div className="stat-value">{pending}</div></div>
            </div>

            <div className="list-card">
                <div className="user-row user-head">
                    <span>User</span><span>Role</span><span>Tools</span><span>Status</span><span></span>
                </div>
                {users.map((u) => (
                    <div key={u.id} className="user-row">
                        <div className="user-cell">
                            <span className="user-avatar">{initials(u.name)}</span>
                            <div><div className="user-name">{u.name}</div><div className="user-email">{u.email}</div></div>
                        </div>
                        <span className={roleClass(u.role)}>{u.role}</span>
                        <div className="tool-chips">
                            {u.tools.map((t) => <span key={t} className="tool-chip">{t}</span>)}
                        </div>
                        <span className={`status-dot ${u.active ? 'active' : 'inactive'}`}>
                            <span className="dot" />{u.active ? 'Active' : 'Inactive'}
                        </span>
                        <button type="button" className="btn-outline sm" onClick={() => toggle(u.id)}>
                            {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                    </div>
                ))}
            </div>

            <div className="audit-card">
                <h2>Audit log</h2>
                {AUDIT.map((a, i) => (
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
