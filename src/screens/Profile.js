// Profile.js — user details form. Loads/saves via profileService. The digital signature
// has its own page (My signature in the sidebar). Role is read-only (set by an admin).
import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { loadProfile, saveProfile } from '../services/profileService';

const Profile = () => {
    const showToast = useToast();
    const { userName, signOut } = useOutletContext() || {};
    const [profile, setProfile] = useState({
        fullName: userName || '',
        role: 'Surveyor',
        accreditation: '',
        mobile: '',
        email: '',
    });

    const setField = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

    // On mount, hydrate the form from saved data.
    useEffect(() => {
        loadProfile().then((p) => { if (p) setProfile((prev) => ({ ...prev, ...p })); });
    }, []);

    const onSaveProfile = async () => {
        await saveProfile(profile);
        showToast('Profile saved');
    };

    return (
        <div className="page dc-pop">
            <div className="page-head">
                <h1>Profile</h1>
                <p>Your details as they appear on generated reports.</p>
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

            </div>
        </div>
    );
};

export default Profile;
