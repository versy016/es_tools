import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPlus } from '@fortawesome/free-solid-svg-icons';
import { UTILITIES, QUALITY_LEVELS } from '../report/legendColors';

// Read a File/Blob into a base64 data URL (so thumbnails can be stored/serialised
// without a server round-trip).
const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

// Manages the pothole photos attached to a single main photo.
// Each pothole gets an auto label (PH01, PH02...) and utility / quality level /
// depth / comment fields, which render below the main photo in the report.
// Controlled component: `potholes` is the source of truth, every mutation flows
// out through onChange. A pothole = { id, label PHxx, src dataURL, utility,
// qualityLevel A-E, depth, comment }.
const PotholePanel = ({ potholes, onChange }) => {

    // Re-derive sequential PH01, PH02… labels from list position. Run after any
    // add/remove so labels always match the displayed order with no gaps.
    const relabel = (list) => list.map((p, i) => ({
        ...p,
        label: `PH${String(i + 1).padStart(2, '0')}`,
    }));

    // Upload one or more thumbnails: read each to a data URL, build new pothole
    // records with sensible defaults, append, then relabel. Reset the input value
    // so picking the same file again still fires onChange.
    const handleAdd = async (event) => {
        const files = Array.from(event.target.files);
        if (!files.length) return;
        const dataUrls = await Promise.all(files.map(readFileAsDataURL));
        const added = dataUrls.map((src, i) => ({
            id: `ph_${Date.now()}_${i}`,
            label: '',                 // filled in by relabel()
            src,
            utility: 'water',
            qualityLevel: 'A',
            depth: '',
            comment: '',
        }));
        onChange(relabel([...potholes, ...added]));
        event.target.value = '';
    };

    // Patch a single field on one pothole (label is unaffected, so no relabel needed).
    const update = (id, patch) => {
        onChange(potholes.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    };

    // Delete a pothole, then relabel so the remaining PHxx numbers stay contiguous.
    const remove = (id) => {
        onChange(relabel(potholes.filter((p) => p.id !== id)));
    };

    return (
        <div className="pothole-panel">
            <div className="pothole-panel-header">
                <h4>Potholes ({potholes.length})</h4>
                <label className="pothole-add-btn">
                    <FontAwesomeIcon icon={faPlus} /> Add pothole photo(s)
                    <input type="file" accept="image/*" multiple onChange={handleAdd} hidden />
                </label>
            </div>

            {potholes.length === 0 ? (
                <p className="pothole-empty">No potholes added for this photo.</p>
            ) : (
                <div className="pothole-list">
                    {potholes.map((p) => (
                        <div className="pothole-card" key={p.id}>
                            <button type="button" className="pothole-remove" title="Remove pothole"
                                onClick={() => remove(p.id)}>
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                            <div className="pothole-label">{p.label}</div>
                            <img src={p.src} alt={p.label} className="pothole-thumb" />
                            <div className="pothole-fields">
                                <label>
                                    Utility
                                    <select value={p.utility} onChange={(e) => update(p.id, { utility: e.target.value })}>
                                        {UTILITIES.map((u) => (
                                            <option key={u.key} value={u.key}>{u.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Quality Level
                                    <select value={p.qualityLevel} onChange={(e) => update(p.id, { qualityLevel: e.target.value })}>
                                        {QUALITY_LEVELS.map((q) => (
                                            <option key={q} value={q}>{q}</option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Depth / note
                                    <input type="text" value={p.depth} placeholder="e.g. 0.6d, 0.52 Top"
                                        onChange={(e) => update(p.id, { depth: e.target.value })} />
                                </label>
                                <label>
                                    Comment
                                    <input type="text" value={p.comment} placeholder="Optional"
                                        onChange={(e) => update(p.id, { comment: e.target.value })} />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PotholePanel;
