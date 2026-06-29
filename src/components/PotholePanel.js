import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPlus, faCamera } from '@fortawesome/free-solid-svg-icons';
import CameraCapture from './CameraCapture';
import { downscaleImage } from '../utils/image';

// Read a File/Blob into a base64 data URL (so thumbnails can be stored/serialised
// without a server round-trip).
const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const pad2 = (n) => String(n).padStart(2, '0');

// Next sequential pothole name (PH01, PH02…) based on the highest existing number,
// so adds — including camera shots — are numbered in order. Names are then editable
// and are NOT auto-renumbered on remove (so user edits are preserved).
const nextLabel = (list) => {
    const nums = list.map((p) => parseInt(String(p.label || '').replace(/\D/g, ''), 10)).filter((n) => !Number.isNaN(n));
    return `PH${pad2((nums.length ? Math.max(...nums) : 0) + 1)}`;
};

const newId = () => `ph_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

// Manages the pothole photos attached to a single main photo. Each pothole is just
// an image + an editable name (defaulting to PH01, PH02…). A pothole = { id, label, src }.
// Controlled component: `potholes` is the source of truth, every mutation flows out
// through onChange.
const PotholePanel = ({ potholes, onChange }) => {
    const [showCamera, setShowCamera] = useState(false);
    const [busy, setBusy] = useState(false);   // processing/downscaling uploads

    // Append photos (from a file picker), downscaled + auto-named in sequence.
    const handleAdd = async (event) => {
        const files = Array.from(event.target.files);
        event.target.value = '';
        if (!files.length) return;
        setBusy(true);
        try {
            const dataUrls = await Promise.all(files.map(readFileAsDataURL));
            const small = await Promise.all(dataUrls.map((s) => downscaleImage(s)));
            let list = potholes;
            small.forEach((src) => { list = [...list, { id: newId(), label: nextLabel(list), src }]; });
            onChange(list);
        } finally {
            setBusy(false);
        }
    };

    // Append a single photo captured on the spot, downscaled + auto-named in sequence.
    const addCaptured = async (src) => {
        setBusy(true);
        try {
            const small = await downscaleImage(src);
            onChange([...potholes, { id: newId(), label: nextLabel(potholes), src: small }]);
        } finally {
            setBusy(false);
        }
    };

    // Edit a pothole's name.
    const rename = (id, label) => onChange(potholes.map((p) => (p.id === id ? { ...p, label } : p)));

    // Delete a pothole (no renumbering — keeps any edited names intact).
    const remove = (id) => onChange(potholes.filter((p) => p.id !== id));

    return (
        <div className="pothole-panel">
            <div className="pothole-panel-header">
                <h4>Potholes ({potholes.length})</h4>
                <div className="pothole-add-actions">
                    <label className="pothole-add-btn">
                        <FontAwesomeIcon icon={faPlus} /> Add photo(s)
                        <input type="file" accept="image/*" multiple onChange={handleAdd} hidden />
                    </label>
                    <button type="button" className="pothole-add-btn" onClick={() => setShowCamera(true)}>
                        <FontAwesomeIcon icon={faCamera} /> Take photo
                    </button>
                </div>
            </div>

            {busy && (
                <div className="photo-loading"><span className="spinner" /> Adding photo(s)…</div>
            )}

            {potholes.length === 0 && !busy ? (
                <p className="pothole-empty">No potholes added for this photo.</p>
            ) : (
                <div className="pothole-list">
                    {potholes.map((p) => (
                        <div className="pothole-card" key={p.id}>
                            <button type="button" className="pothole-remove" title="Remove pothole"
                                onClick={() => remove(p.id)}>
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                            <img src={p.src} alt={p.label} className="pothole-thumb" />
                            <label className="pothole-name">
                                Name
                                <input type="text" value={p.label} placeholder="e.g. PH01"
                                    onChange={(e) => rename(p.id, e.target.value)} />
                            </label>
                        </div>
                    ))}
                </div>
            )}

            {showCamera && (
                <CameraCapture onCapture={addCaptured} onClose={() => setShowCamera(false)} />
            )}
        </div>
    );
};

export default PotholePanel;
