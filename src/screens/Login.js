import React, { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import '../stylessheets/Login.css';

const Logo = ({ light }) => (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
        <path d="M20 22 L11 36 M20 22 L29 36 M20 22 L20 33" stroke={light ? '#fff' : '#1B2230'} strokeWidth="2.4" strokeLinecap="round" />
        <rect x="17" y="15" width="6" height="9" rx="1.5" fill={light ? '#fff' : '#1B2230'} />
        <rect x="8" y="8" width="23" height="8" rx="4" fill="#F5A623" />
        <circle cx="20" cy="12" r="2.4" fill="#1B2230" />
    </svg>
);

const Login = () => {
    const { signIn, signUp, signInWithMicrosoft } = useAuth();
    const [mode, setMode] = useState('signin'); // signin | signup
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError(''); setInfo(''); setBusy(true);
        try {
            if (mode === 'signin') {
                const { error: err } = await signIn(email, password);
                if (err) setError(err.message);
            } else {
                const { error: err } = await signUp(email, password, fullName);
                if (err) setError(err.message);
                else setInfo('Account created. Check your email to confirm, then sign in.');
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="login">
            <div className="login-panel">
                <div className="login-circle a" />
                <div className="login-circle b" />
                <div className="login-brand">
                    <Logo light />
                    <div className="login-brand-text">ENGINEERING<br />SURVEYS</div>
                </div>
                <div className="login-hero">
                    <span className="login-pill">ES Tools platform</span>
                    <h1>Every field tool,<br />one login.</h1>
                    <p>Capture photos, log potholes, locate services and send branded reports — from the truck or the office.</p>
                </div>
                <div className="login-footer">
                    <span>Service location</span><span>Photo reports</span><span>As‑built</span>
                </div>
            </div>

            <div className="login-form-wrap">
                <form className="login-form" onSubmit={submit}>
                    <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
                    <p className="login-sub">{mode === 'signin' ? 'Sign in to your ES Tools account.' : 'Set up your ES Tools account.'}</p>

                    {mode === 'signup' && (
                        <label className="login-label">Full name
                            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dave Mitchell" />
                        </label>
                    )}
                    <label className="login-label">Email address
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dave.mitchell@engsurveys.com.au" required />
                    </label>
                    <label className="login-label">Password
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" required />
                    </label>

                    {error && <div className="login-error">{error}</div>}
                    {info && <div className="login-info">{info}</div>}

                    <button type="submit" className="login-submit" disabled={busy}>
                        {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
                    </button>

                    <div className="login-or"><span>or</span></div>
                    <button type="button" className="login-ms" onClick={signInWithMicrosoft}>
                        <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true"><rect width="10" height="10" x="1" y="1" fill="#F25022" /><rect width="10" height="10" x="12" y="1" fill="#7FBA00" /><rect width="10" height="10" x="1" y="12" fill="#00A4EF" /><rect width="10" height="10" x="12" y="12" fill="#FFB900" /></svg>
                        Continue with Microsoft
                    </button>

                    <div className="login-switch">
                        {mode === 'signin'
                            ? <>New here? <button type="button" onClick={() => { setMode('signup'); setError(''); }}>Create an account</button></>
                            : <>Have an account? <button type="button" onClick={() => { setMode('signin'); setError(''); }}>Sign in</button></>}
                    </div>
                    <div className="login-note">Protected by your organisation · Engineering Surveys Pty Ltd</div>
                </form>
            </div>
        </div>
    );
};

export default Login;
