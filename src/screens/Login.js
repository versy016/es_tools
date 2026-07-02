// Login.js — branded split-screen sign-in / sign-up. Toggles between email+password
// sign-in and sign-up, offers Google OAuth, and surfaces auth errors and the
// post-signup "confirm your email" notice. Rendered by the Gate when signed out.
import React, { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { lookupIdentity, resolveLoginEmail } from '../services/identityService';
import { normalizeEmail } from '../lib/emailIdentity';
import '../stylessheets/Login.css';

// Password resets are limited to the org domain (mirrors the send-email-hook guard).
const ORG_DOMAIN = 'engsurveys.com.au';

const Login = () => {
    const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
    const [mode, setMode] = useState('signin'); // signin | signup | forgot — drives form fields and copy
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
            if (mode === 'forgot') {
                if (!email.trim().toLowerCase().endsWith(`@${ORG_DOMAIN}`)) {
                    setError(`Use your @${ORG_DOMAIN} email address.`);
                    return;
                }
                await resetPassword(email.trim());
                // Generic message — never reveal whether the account exists.
                setInfo('If an account exists for that email, a password reset link is on its way.');
            } else if (mode === 'signin') {
                let { error: err } = await signIn(email, password);
                // The user may have signed in with an email alias (e.g. shivam.verma@ when
                // their account is sverma@). If the first attempt fails, resolve the alias to
                // the real account and retry once so aliases land on the same login.
                if (err) {
                    const resolved = await resolveLoginEmail(email);
                    if (normalizeEmail(resolved) !== normalizeEmail(email)) {
                        const retry = await signIn(resolved, password);
                        err = retry.error;
                    }
                }
                if (err) setError(err.message);
            } else {
                // Guard against a duplicate account under an email alias: if a person already
                // has an account under a different form of this address, send them to it.
                const typed = email.trim();
                const match = await lookupIdentity(typed);
                if (match.exists && match.email && normalizeEmail(match.email) !== normalizeEmail(typed)) {
                    setError(`An account already exists for you under ${match.email}. Please sign in with that address (both go to the same inbox).`);
                    return;
                }
                const { error: err } = await signUp(typed, password, fullName);
                if (err) setError(err.message);
                else setInfo('Account created. Check your email to confirm, then sign in.');
            }
        } finally {
            setBusy(false);
        }
    };

    // Switch modes, clearing any stale error/notice.
    const go = (m) => { setMode(m); setError(''); setInfo(''); };

    return (
        <div className="login">
            <div className="login-panel">
                <div className="login-circle a" />
                <div className="login-circle b" />
                <div className="login-brand">
                    <img src="/images/logo.png" alt="Engineering Surveys" style={{ height: '52px', width: 'auto' }} />
                </div>
                <div className="login-hero">
                    <span className="login-pill">ES Tools platform</span>
                    <h1>Every field tool,<br />one login.</h1>
                    <p>Capture photos, log potholes, locate services and send branded reports, from the field or the office.</p>
                </div>
                <div className="login-footer">
                    <span>Service location</span><span>Photo reports</span><span>As‑built</span>
                </div>
            </div>

            <div className="login-form-wrap">
                <form className="login-form" onSubmit={submit}>
                    <h2>{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h2>
                    <p className="login-sub">{mode === 'signin' ? 'Sign in to your ES Tools account.' : mode === 'signup' ? 'Set up your ES Tools account.' : 'We’ll email you a link to choose a new password.'}</p>

                    {mode === 'signup' && (
                        <label className="login-label">Full name
                            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dave Mitchell" />
                        </label>
                    )}
                    <label className="login-label">Email address
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dave.mitchell@engsurveys.com.au" required />
                    </label>
                    {mode !== 'forgot' && (
                        <label className="login-label">Password
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" required />
                        </label>
                    )}
                    {mode === 'signin' && (
                        <button type="button" onClick={() => go('forgot')}
                            style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '13px', cursor: 'pointer', alignSelf: 'flex-end', padding: '2px 0', marginTop: '-4px' }}>
                            Forgot password?
                        </button>
                    )}

                    {error && <div className="login-error">{error}</div>}
                    {info && <div className="login-info">{info}</div>}

                    <button type="submit" className="login-submit" disabled={busy}>
                        {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
                    </button>

                    {/* Google OAuth — hidden on the reset screen. */}
                    {mode !== 'forgot' && (<>
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
                    </>)}

                    {/* Mode switch links, clearing any stale error/notice. */}
                    <div className="login-switch">
                        {mode === 'signin' && <>New here? <button type="button" onClick={() => go('signup')}>Create an account</button></>}
                        {mode === 'signup' && <>Have an account? <button type="button" onClick={() => go('signin')}>Sign in</button></>}
                        {mode === 'forgot' && <button type="button" onClick={() => go('signin')}>Back to sign in</button>}
                    </div>
                    <div className="login-note">Protected by your organisation · Engineering Surveys Pty Ltd</div>
                </form>
            </div>
        </div>
    );
};

export default Login;
