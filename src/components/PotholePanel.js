import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPlus } from '@fortawesome/free-solid-svg-icons';
import { UTILITIES, QUALITY_LEVELS } from '../report/legendColors';

const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

// Manages the pothole photos attached to a single main photo.
// Each pothole gets an auto label (PH01, PH02...) and utility / quality level /
// depth / comment fields, which render below the main photo in the report.
const PotholePanel = ({ potholes, onChange }) => {

    const relabel = (list) => list.map((p, i) => ({
        ...p,
        label: `PH${String(i + 1).padStart(2, '0')}`,
    }));

    const handleAdd = async (event) => {
        const files = Array.from(event.target.files);
        if (!files.length) return;
        const dataUrls = await Promise.all(files.map(readFileAsDataURL));
        const added = dataUrls.map((src, i) => ({
            id: `ph_${Date.now()}_${i}`,
            label: '',
            src,
            utility: 'water',
            qualityLevel: 'A',
            depth: '',
            comment: '',
        }));
        onChange(relabel([...potholes, ...added]));
        event.target.value = '';
    };

    const update = (id, patch) => {
        onChange(potholes.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    };

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
                                            <option key={q} value={q}>QL-{q}</option>
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
