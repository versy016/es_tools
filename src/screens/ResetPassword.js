// ResetPassword.js — set a new password after following an invite or a password-reset
// email link. Reached at /reset-password once Supabase has established the recovery/
// invite session from the link (the Gate renders the routed app once a session exists).
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../components/Toast';
import '../stylessheets/Login.css';

const ResetPassword = () => {
    const { updatePassword } = useAuth();
    const showToast = useToast();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (password.length < 8) { setError('Use at least 8 characters.'); return; }
        if (password !== confirm) { setError('Those passwords don’t match.'); return; }
        setBusy(true);
        try {
            const { error: err } = await updatePassword(password);
            if (err) { setError(err.message); return; }
            showToast('Password updated', 'success');
            navigate('/dashboard', { replace: true });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="page dc-pop" style={{ maxWidth: 460 }}>
            <div className="page-head">
                <h1>Set a new password</h1>
                <p>Choose a password for your ES Tools account.</p>
            </div>
            <form className="list-card" onSubmit={submit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="login-label">New password
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" required />
                </label>
                <label className="login-label">Confirm password
                    <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••••" required />
                </label>
                {error && <div className="login-error">{error}</div>}
                <button type="submit" className="btn-charcoal" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
            </form>
        </div>
    );
};

export default ResetPassword;
