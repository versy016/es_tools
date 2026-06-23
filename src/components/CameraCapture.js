import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faXmark, faCameraRotate } from '@fortawesome/free-solid-svg-icons';

// On-the-spot camera capture using getUserMedia. Live preview + capture, with a
// front/back flip and a file-input fallback if the camera can't be accessed.
const CameraCapture = ({ onCapture, onClose }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [error, setError] = useState('');
    const [facing, setFacing] = useState('environment');
    const [count, setCount] = useState(0);

    const stop = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
    };

    const start = async (mode) => {
        stop();
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError('This device/browser does not support live camera access.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setError('');
        } catch (e) {
            setError('Could not access the camera. Check browser permissions, or use “Choose a file” below.');
        }
    };

    useEffect(() => {
        start(facing);
        return stop;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facing]);

    const capture = () => {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        canvas.getContext('2d').drawImage(v, 0, 0);
        onCapture(canvas.toDataURL('image/jpeg', 0.92));
        setCount((c) => c + 1);
    };

    const handleFileFallback = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { onCapture(reader.result); setCount((c) => c + 1); };
        reader.readAsDataURL(file);
    };

    const handleClose = () => { stop(); onClose(); };

    return (
        <div className="camera-overlay" onMouseDown={(e) => { if (e.target.classList.contains('camera-overlay')) handleClose(); }}>
            <div className="camera-modal">
                <div className="camera-head">
                    <strong>Take a photo</strong>
                    {count > 0 && <span className="camera-count">{count} captured</span>}
                    <button type="button" className="camera-close" onClick={handleClose} aria-label="Close">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="camera-stage">
                    {error ? (
                        <div className="camera-error">
                            <p>{error}</p>
                            <label className="camera-file-btn">
                                Choose a file
                                <input type="file" accept="image/*" capture="environment" hidden onChange={handleFileFallback} />
                            </label>
                        </div>
                    ) : (
                        <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
                    )}
                </div>

                <div className="camera-controls">
                    <button type="button" className="btn-ghost" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}>
                        <FontAwesomeIcon icon={faCameraRotate} /> Flip
                    </button>
                    <button type="button" className="camera-shutter" onClick={capture} disabled={!!error} aria-label="Capture photo">
                        <FontAwesomeIcon icon={faCamera} />
                    </button>
                    <button type="button" className="btn-primary" onClick={handleClose}>Done</button>
                </div>
            </div>
        </div>
    );
};

export default CameraCapture;
