// Login.js — branded split-screen sign-in / sign-up. Toggles between email+password
// sign-in and sign-up, offers Google OAuth, and surfaces auth errors and the
// post-signup "confirm your email" notice. Rendered by the Gate when signed out.
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
    const { signIn, signUp, signInWithGoogle } = useAuth();
    const [mode, setMode] = useState('signin'); // signin | signup — drives form fields and copy
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');  // auth failure message
    const [info, setInfo] = useState('');    // success notice (e.g. confirm-email prompt)
    const [busy, setBusy] = useState(false); // disables submit while a request is in flight

    // Submit handler routes to signIn or signUp by mode; on successful sign-up we
    // can't log the user in yet (email confirmation required), so we show `info`.
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

                    {/* Google OAuth — redirects out to the org identity provider. */}
                    <div className="login-or"><span>or</span></div>
                    <button type="button" className="login-oauth" onClick={signInWithGoogle}>
                        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C40.9 36 44 30.5 44 24c0-1.3-.1-2.3-.4-3.5z" />
                        </svg>
                        Continue with Google
                    </button>

                    {/* Toggle between sign-in and sign-up, clearing any stale error. */}
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
