import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import SignaturePad from '../components/SignaturePad';
import { useToast } from '../components/Toast';
import { loadProfile, saveProfile, loadSignature, saveSignature } from '../services/profileService';

const Profile = () => {
    const showToast = useToast();
    const { userName, signOut } = useOutletContext() || {};
    const padRef = useRef(null);
    const fileRef = useRef(null);
    const [sig, setSig] = useState('');
    const [profile, setProfile] = useState({
        fullName: userName || '',
        role: 'Surveyor',
        accreditation: '',
        mobile: '',
        email: '',
    });

    const setField = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

    useEffect(() => {
        loadProfile().then((p) => { if (p) setProfile((prev) => ({ ...prev, ...p })); });
        loadSignature().then((saved) => {
            if (saved) {
                setSig(saved);
                if (padRef.current) padRef.current.fromDataURL(saved);
            }
        });
    }, []);

    const onSaveProfile = async () => {
        await saveProfile(profile);
        showToast('Profile saved');
    };

    const onSaveSignature = async () => {
        if (!padRef.current || padRef.current.isEmpty()) { showToast('Draw or upload a signature first'); return; }
        const url = padRef.current.toDataURL();
        await saveSignature(url);
        setSig(url);
        showToast('Signature saved');
    };

    const clear = () => { if (padRef.current) padRef.current.clear(); };

    const upload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => padRef.current && padRef.current.fromDataURL(reader.result);
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <div className="page dc-pop">
            <div className="page-head">
                <h1>Profile &amp; signature</h1>
                <p>Your details and the digital signature stamped onto generated reports.</p>
            </div>

            <div className="profile-grid">
                <div className="panel">
                    <h2>Your details</h2>
                    <label className="field">Full name
                        <input type="text" value={profile.fullName} onChange={(e) => setField('fullName', e.target.value)} />
                    </label>
                    <label className="field">Role
                        <input type="text" value={profile.role} readOnly className="readonly" />
                    </label>
                    <label className="field">Accreditation / licence
                        <input type="text" value={profile.accreditation} placeholder="e.g. DBYD Accredited Locator" onChange={(e) => setField('accreditation', e.target.value)} />
                    </label>
                    <label className="field">Mobile
                        <input type="text" value={profile.mobile} placeholder="04xx xxx xxx" onChange={(e) => setField('mobile', e.target.value)} />
                    </label>
                    <label className="field">Email
                        <input type="email" value={profile.email} placeholder="name@engsurveys.com.au" onChange={(e) => setField('email', e.target.value)} />
                    </label>
                    <div className="profile-actions">
                        <button type="button" className="btn-charcoal" onClick={onSaveProfile}>Save profile</button>
                        <button type="button" className="btn-outline" onClick={signOut}>Sign out</button>
                    </div>
                </div>

                <div className="panel">
                    <h2>Digital signature</h2>
                    <p className="panel-sub">Sign in the box below — this is applied to your reports.</p>
                    <SignaturePad ref={padRef} height={180} />
                    <div className="sig-actions">
                        <button type="button" className="btn-outline sm" onClick={clear}>Clear</button>
                        <button type="button" className="btn-outline sm" onClick={() => fileRef.current && fileRef.current.click()}>Upload</button>
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
                        <button type="button" className="btn-yellow sm" onClick={onSaveSignature}>Save signature</button>
                    </div>

                    <div className="sig-preview-label">How this appears on reports</div>
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

export default Profile;
