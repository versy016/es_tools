// Welcome.js — friendly landing shown after a user confirms their email (the signup
// confirmation link redirects here). By this point Supabase has established a session,
// so the routed app is already rendered; this just gives a warm "you're in" moment.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const Welcome = () => {
    const navigate = useNavigate();
    const { userName } = useAuth();
    const firstName = (userName || '').split(' ')[0];

    return (
        <div className="page dc-pop" style={{ maxWidth: 460 }}>
            <div className="list-card" style={{ padding: 32, textAlign: 'center' }}>
                <div style={{
                    width: 56, height: 56, borderRadius: '50%', background: 'var(--success, #1e9e64)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px', fontSize: 26, fontWeight: 700,
                }}>✓</div>
                <h1 style={{ margin: '0 0 6px', fontSize: '1.4rem' }}>
                    You’re all set{firstName ? `, ${firstName}` : ''}!
                </h1>
                <p style={{ margin: '0 0 22px', color: 'var(--muted)' }}>
                    Your email is confirmed and your ES Tools account is ready to go.
                </p>
                <button type="button" className="btn-charcoal" onClick={() => navigate('/dashboard', { replace: true })}>
                    Go to the dashboard
                </button>
            </div>
        </div>
    );
};

export default Welcome;
