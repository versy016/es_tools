import React, { useEffect, useState } from 'react';

// Invite dialog: collects the new user's full name, email and role. `roles` is the list
// the current admin/manager may assign. onSubmit({ name, email, role }) fires when valid.
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

const InviteDialog = ({ open, roles = ['Surveyor'], onSubmit, onCancel }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState(roles[0] || 'Surveyor');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setName(''); setEmail(''); setRole(roles[0] || 'Surveyor'); setError('');
    }, [open, roles]);

    if (!open) return null;

    const submit = (e) => {
        e.preventDefault();
        if (!name.trim()) { setError('Enter the person’s name.'); return; }
        if (!isEmail(email)) { setError('Enter a valid email address.'); return; }
        onSubmit?.({ name: name.trim(), email: email.trim(), role });
    };

    const onKeyDown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel?.(); } };

    return (
        <div className="confirm-overlay" onMouseDown={(e) => { if (e.target.classList.contains('confirm-overlay')) onCancel?.(); }}>
            <form className="confirm-card" onSubmit={submit} onKeyDown={onKeyDown} noValidate
                role="dialog" aria-modal="true" aria-labelledby="invite-title">
                <h3 id="invite-title" className="confirm-title">Invite user</h3>
                <p className="confirm-message">They’ll get a branded email to set a password and join ES Tools.</p>

                <label className="confirm-field">
                    <span>Full name</span>
                    <input type="text" value={name} placeholder="Dave Mitchell"
                        onChange={(e) => { setName(e.target.value); if (error) setError(''); }} />
                </label>
                <label className="confirm-field">
                    <span>Email address</span>
                    <input type="email" value={email} placeholder="name@engsurveys.com.au"
                        onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }} />
                </label>
                <label className="confirm-field">
                    <span>Role</span>
                    <select value={role} onChange={(e) => setRole(e.target.value)}>
                        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                </label>

                {error && <div className="confirm-error">{error}</div>}
                <div className="confirm-actions">
                    <button type="button" className="btn-outline" onClick={() => onCancel?.()}>Cancel</button>
                    <button type="submit" className="btn-charcoal">Send invite</button>
                </div>
            </form>
        </div>
    );
};

export default InviteDialog;
