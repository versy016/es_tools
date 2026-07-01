import React, { useEffect, useRef, useState } from 'react';

// Branded, non-blocking replacement for native window.confirm / window.prompt.
// Controlled: render with open=true and provide onConfirm/onCancel.
//   - Plain confirm: omit `input`; onConfirm() fires on the confirm button.
//   - Prompt: pass input={{ type, label, placeholder, defaultValue }} and read the
//     entered value in onConfirm(value). validate(value) returns '' (ok) or an error.
// `destructive` colours the confirm button red for delete/clear actions.
const ConfirmDialog = ({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    input = null,
    validate,
    onConfirm,
    onCancel,
}) => {
    const [value, setValue] = useState('');
    const [error, setError] = useState('');
    const focusRef = useRef(null);

    // Reset + focus each time the dialog opens.
    useEffect(() => {
        if (!open) return undefined;
        setValue(input?.defaultValue || '');
        setError('');
        const t = setTimeout(() => focusRef.current?.focus(), 0);
        return () => clearTimeout(t);
    }, [open, input]);

    if (!open) return null;

    const submit = (e) => {
        e.preventDefault();
        if (input) {
            const v = value.trim();
            const err = validate ? validate(v) : (v ? '' : 'This field is required.');
            if (err) { setError(err); return; }
            onConfirm?.(v);
        } else {
            onConfirm?.();
        }
    };

    // Escape cancels. stopPropagation keeps it from reaching other global key handlers
    // (e.g. the annotation editor's own Escape-to-close).
    const onKeyDown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel?.(); } };

    return (
        <div className="confirm-overlay"
            onMouseDown={(e) => { if (e.target.classList.contains('confirm-overlay')) onCancel?.(); }}>
            <form className="confirm-card" onSubmit={submit} onKeyDown={onKeyDown} noValidate
                role="dialog" aria-modal="true" aria-labelledby="confirm-title">
                <h3 id="confirm-title" className="confirm-title">{title}</h3>
                {message && <p className="confirm-message">{message}</p>}
                {input && (
                    <label className="confirm-field">
                        {input.label && <span>{input.label}</span>}
                        <input
                            ref={focusRef}
                            type={input.type || 'text'}
                            placeholder={input.placeholder || ''}
                            value={value}
                            onChange={(e) => { setValue(e.target.value); if (error) setError(''); }}
                        />
                    </label>
                )}
                {error && <div className="confirm-error">{error}</div>}
                <div className="confirm-actions">
                    <button type="button" className="btn-outline" onClick={() => onCancel?.()}>{cancelLabel}</button>
                    <button type="submit" ref={input ? null : focusRef}
                        className={destructive ? 'btn-danger' : 'btn-charcoal'}>{confirmLabel}</button>
                </div>
            </form>
        </div>
    );
};

export default ConfirmDialog;
