import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import SignaturePad from './SignaturePad';
import { getSignoff } from '../services/profileService';

const today = () => new Date().toISOString().slice(0, 10);

// End-of-report sign-off: Utility locator + Signature + Date.
// The signature is opt-in. The user either adds the signature saved on their
// profile ("Add my signature"), or — when signing on someone else's behalf —
// types a name and draws or uploads a different signature.
// Parent reads the result imperatively via ref.getValue() at generate time:
//   { locatorName, signature (data URL or ''), date }.
const SignOffSection = forwardRef(({ defaultLocator = '' }, ref) => {
    const [mode, setMode] = useState('none');        // 'none' | 'me' | 'other'
    const [locatorName, setLocatorName] = useState(defaultLocator);
    const [signature, setSignature] = useState('');
    const [date, setDate] = useState(today());
    const [profile, setProfile] = useState(null);
    const padRef = useRef(null);

    // Load the saved profile + signature once (for the "my signature" option).
    useEffect(() => { getSignoff().then(setProfile).catch(() => {}); }, []);

    useImperativeHandle(ref, () => ({
        getValue: () => ({ locatorName: (locatorName || '').trim(), signature, date }),
    }), [locatorName, signature, date]);

    const chooseMe = () => {
        setMode('me');
        setSignature((profile && profile.signature) || '');
        if (profile && profile.fullName) setLocatorName(profile.fullName);
    };
    const chooseOther = () => { setMode('other'); setSignature(''); };
    const reset = () => { setMode('none'); setSignature(''); };

    const captureDrawn = () => { if (padRef.current && !padRef.current.isEmpty()) setSignature(padRef.current.toDataURL()); };
    const clearPad = () => { if (padRef.current) padRef.current.clear(); setSignature(''); };
    const onUpload = (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => setSignature(ev.target.result);
        r.readAsDataURL(f);
        e.target.value = '';
    };

    const hasProfileSig = !!(profile && profile.signature);

    return (
        <div className="signoff">
            <div className="signoff-choices">
                <button type="button" className={`signoff-btn ${mode === 'me' ? 'active' : ''}`} onClick={chooseMe}>
                    Add my signature
                </button>
                <button type="button" className={`signoff-btn ${mode === 'other' ? 'active' : ''}`} onClick={chooseOther}>
                    Sign on someone else&rsquo;s behalf
                </button>
                {mode !== 'none' && (
                    <button type="button" className="signoff-btn ghost" onClick={reset}>Remove</button>
                )}
            </div>

            {mode === 'me' && !hasProfileSig && (
                <p className="signoff-hint">No signature saved on your profile yet — add one on the Profile screen, or sign on someone else&rsquo;s behalf below.</p>
            )}

            {mode !== 'none' && (
                <div className="signoff-fields">
                    <label>Utility locator
                        <input type="text" value={locatorName} onChange={(e) => setLocatorName(e.target.value)} placeholder="Full name" />
                    </label>
                    <label>Date
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>
                </div>
            )}

            {mode === 'me' && signature && (
                <div className="signoff-preview"><img src={signature} alt="signature" /></div>
            )}

            {mode === 'other' && (
                <div className="signoff-draw">
                    <p className="signoff-hint">Draw the signature below, or upload an image of it.</p>
                    <SignaturePad ref={padRef} height={150} />
                    <div className="signoff-pad-actions">
                        <button type="button" onClick={captureDrawn}>Use drawing</button>
                        <button type="button" onClick={clearPad}>Clear</button>
                        <label className="signoff-upload">Upload image<input type="file" accept="image/*" hidden onChange={onUpload} /></label>
                    </div>
                    {signature && <div className="signoff-preview"><img src={signature} alt="signature" /></div>}
                </div>
            )}
        </div>
    );
});

export default SignOffSection;
