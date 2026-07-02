// SetupSignature.js — onboarding step shown to a new user (after accepting an invite,
// or on their first login without a signature). Draw/upload a signature that gets
// stamped onto reports. Skippable — they can always set it later on Profile.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SignaturePad from '../components/SignaturePad';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthProvider';
import { saveSignature } from '../services/profileService';

// Per-user flag so the first-login redirect only nudges once.
export const sigPromptKey = (uid) => `es_tools_sig_prompted_${uid || 'anon'}`;

const SetupSignature = () => {
    const navigate = useNavigate();
    const showToast = useToast();
    const { user, userName, reloadProfile } = useAuth();
    const padRef = useRef(null);
    const fileRef = useRef(null);
    const [busy, setBusy] = useState(false);

    // Reaching this screen counts as "prompted" — the dashboard won't redirect again.
    useEffect(() => { try { localStorage.setItem(sigPromptKey(user?.id), '1'); } catch { /* ignore */ } }, [user]);

    const clear = () => { if (padRef.current) padRef.current.clear(); };
    const upload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => padRef.current && padRef.current.fromDataURL(reader.result);
        reader.readAsDataURL(file);
        e.target.value = '';
    };
    const save = async () => {
        if (!padRef.current || padRef.current.isEmpty()) { showToast('Draw or upload a signature first', 'error'); return; }
        setBusy(true);
        try {
            await saveSignature(padRef.current.toDataURL());
            reloadProfile?.();
            showToast('Signature saved', 'success');
            navigate('/dashboard', { replace: true });
        } finally { setBusy(false); }
    };
    const skip = () => navigate('/dashboard', { replace: true });

    const first = (userName || '').split(' ')[0];
    return (
        <div className="page dc-pop" style={{ maxWidth: 620 }}>
            <div className="page-head">
                <h1>Set up your signature{first && first !== 'User' ? `, ${first}` : ''}</h1>
                <p>This is stamped onto the reports you generate. You can change it anytime on your Profile.</p>
            </div>
            <div className="panel">
                <h2>Draw your signature</h2>
                <p className="panel-sub">Sign in the box below, or upload an image of your signature.</p>
                <SignaturePad ref={padRef} height={180} />
                <div className="sig-actions">
                    <button type="button" className="btn-outline sm" onClick={clear}>Clear</button>
                    <button type="button" className="btn-outline sm" onClick={() => fileRef.current && fileRef.current.click()}>Upload</button>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
                    <button type="button" className="btn-yellow sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save & continue'}</button>
                </div>
                <div style={{ marginTop: 16 }}>
                    <button type="button" onClick={skip}
                        style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '13px', cursor: 'pointer' }}>
                        Skip for now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SetupSignature;
