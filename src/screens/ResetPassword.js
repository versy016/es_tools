// ResetPassword.js — set-a-password screen for BOTH the invite flow (finish creating
// your account) and the forgot-password flow. Rendered as a blocking full-screen gate
// by App's <Gate> when the user arrived via an invite/recovery link, so it can't be
// skipped by navigating away or refreshing — they either set a password or sign out.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../components/Toast';
import '../stylessheets/Login.css';

const ResetPassword = () => {
    const { updatePassword, completePasswordSetup, signOut, pwSetupReason, userName } = useAuth();
    const showToast = useToast();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const isInvite = pwSetupReason === 'invite';
    const firstName = (userName || '').split(' ')[0];

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (password.length < 8) { setError('Use at least 8 characters.'); return; }
        if (password !== confirm) { setError('Those passwords don’t match.'); return; }
        setBusy(true);
        try {
            const { error: err } = await updatePassword(password);
            if (err) { setError(err.message); return; }
            completePasswordSetup?.();      // lift the blocking gate
            showToast('Password set — you’re all set', 'success');
            navigate('/dashboard', { replace: true });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="page dc-pop" style={{ maxWidth: 460, margin: '48px auto' }}>
            <div className="page-head">
                <h1>{isInvite
                    ? `Welcome${firstName && firstName !== 'User' ? `, ${firstName}` : ''}! Set your password`
                    : 'Set a new password'}</h1>
                <p>{isInvite
                    ? 'Create a password to finish setting up your ES Tools account.'
                    : 'Choose a new password for your ES Tools account.'}</p>
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
                <button type="button" onClick={signOut}
                    style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '13px', cursor: 'pointer', alignSelf: 'center', padding: '4px 0' }}>
                    Sign out
                </button>
            </form>
        </div>
    );
};

export default ResetPassword;
