// SignatureScreen.js — "My signature": the digital-signature pad + report preview, on its
// own page (reached from the sidebar). Profile keeps only the details form.
import React, { useEffect, useRef, useState } from 'react';
import SignaturePad from '../components/SignaturePad';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthProvider';
import { loadProfile, loadSignature, saveSignature } from '../services/profileService';

const SignatureScreen = () => {
    const showToast = useToast();
    const { userName, reloadProfile } = useAuth();
    const padRef = useRef(null);
    const fileRef = useRef(null);
    const [sig, setSig] = useState('');
    const [profile, setProfile] = useState({ fullName: userName || '', role: '', accreditation: '', mobile: '', email: '' });
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        loadProfile().then((p) => { if (p) setProfile((prev) => ({ ...prev, ...p })); }).catch(() => {});
        loadSignature().then((saved) => {
            if (saved) { setSig(saved); if (padRef.current) padRef.current.fromDataURL(saved); }
        }).catch(() => {});
    }, []);

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
            const url = padRef.current.toDataURL();
            await saveSignature(url);
            setSig(url);
            reloadProfile?.();
            showToast('Signature saved', 'success');
        } catch (e) { showToast(e.message || 'Could not save the signature', 'error'); }
        finally { setBusy(false); }
    };

    return (
        <div className="page dc-pop">
            <div className="page-head">
                <h1>My signature</h1>
                <p>Draw or upload the signature stamped onto every report you generate.</p>
            </div>
            <div className="profile-grid">
                <div className="panel">
                    <h2>Signature</h2>
                    <p className="panel-sub">Sign in the box below, or upload an image of your signature.</p>
                    <SignaturePad ref={padRef} height={200} />
                    <div className="sig-actions">
                        <button type="button" className="btn-outline sm" onClick={clear}>Clear</button>
                        <button type="button" className="btn-outline sm" onClick={() => fileRef.current && fileRef.current.click()}>Upload</button>
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
                        <button type="button" className="btn-yellow sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save signature'}</button>
                    </div>
                </div>
                <div className="panel">
                    <h2>How this appears on reports</h2>
                    <p className="panel-sub">Your name, role and contact details come from your profile.</p>
                    <div className="sig-preview">
                        {sig ? <img src={sig} alt="Signature" className="sig-img" /> : <div className="sig-empty">No signature saved yet</div>}
                        <div className="sig-line" />
                        <div className="sig-name">{profile.fullName || 'Your name'}</div>
                        <div className="sig-role">{profile.role}{profile.accreditation ? ` · ${profile.accreditation}` : ''}</div>
                        <div className="sig-contact">{[profile.mobile, profile.email].filter(Boolean).join(' · ')}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignatureScreen;
