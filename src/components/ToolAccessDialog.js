import React, { useEffect, useState } from 'react';
import { TOOLS } from '../data/toolsRegistry';

// Manager/admin dialog to restrict a user to specific tools. Saves an array of allowed
// tool ids, or null for "all tools" (no restriction). Controlled via `open`.
const ToolAccessDialog = ({ open, user, onSave, onCancel }) => {
    const [unrestricted, setUnrestricted] = useState(true);
    const [selected, setSelected] = useState([]);

    // Seed from the user's current setting each time it opens.
    useEffect(() => {
        if (!open) return;
        const tools = user?.tools;
        if (Array.isArray(tools)) { setUnrestricted(false); setSelected(tools); }
        else { setUnrestricted(true); setSelected([]); }
    }, [open, user]);

    if (!open) return null;

    const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    return (
        <div className="confirm-overlay" onMouseDown={(e) => { if (e.target.classList.contains('confirm-overlay')) onCancel?.(); }}>
            <div className="confirm-card" role="dialog" aria-modal="true" aria-labelledby="tools-title">
                <h3 id="tools-title" className="confirm-title">Tool access</h3>
                <p className="confirm-message">Choose which tools {user?.name || 'this user'} can open.</p>

                <label className="tool-access-row">
                    <input type="checkbox" checked={unrestricted} onChange={(e) => setUnrestricted(e.target.checked)} />
                    <span><strong>Allow all tools</strong> (no restriction)</span>
                </label>

                <div className={`tool-access-list${unrestricted ? ' disabled' : ''}`}>
                    {TOOLS.map((t) => (
                        <label key={t.id} className="tool-access-row">
                            <input type="checkbox" disabled={unrestricted}
                                checked={unrestricted || selected.includes(t.id)}
                                onChange={() => toggle(t.id)} />
                            <span>{t.name}{t.soon ? ' (coming soon)' : ''}</span>
                        </label>
                    ))}
                </div>

                <div className="confirm-actions">
                    <button type="button" className="btn-outline" onClick={() => onCancel?.()}>Cancel</button>
                    <button type="button" className="btn-charcoal" onClick={() => onSave?.(unrestricted ? null : selected)}>Save access</button>
                </div>
            </div>
        </div>
    );
};

export default ToolAccessDialog;
