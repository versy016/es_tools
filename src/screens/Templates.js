// Templates.js — manager-only admin for the Word templates behind each report tool. The
// report services already prefer a managed copy in the Supabase "templates" bucket and fall
// back to the bundled file; this screen uploads, replaces or removes those managed copies.
import React, { useEffect, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { listManagedTemplates, uploadTemplate, removeTemplate } from '../services/templatesService';

const fmtSize = (n) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString() : '');

const Templates = () => {
    const showToast = useToast();
    const [rows, setRows] = useState(null);   // null = loading
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');     // template name being uploaded/removed
    const [pendingRevert, setPendingRevert] = useState(null);

    const refresh = () => listManagedTemplates().then((r) => { setRows(r); setError(''); }).catch((e) => { setRows([]); setError(e.message || 'Could not load templates'); });
    useEffect(() => { refresh(); }, []);

    const onPick = async (t, e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        if (!/\.docx$/i.test(file.name)) { showToast('Please choose a Word .docx file', 'error'); return; }
        setBusy(t.name);
        try { await uploadTemplate(t.name, file); showToast(`${t.label} template updated`, 'success'); await refresh(); }
        catch (err) { showToast(err.message || 'Upload failed', 'error'); }
        finally { setBusy(''); }
    };
    const confirmRevert = async () => {
        const t = pendingRevert; setPendingRevert(null);
        if (!t) return;
        setBusy(t.name);
        try { await removeTemplate(t.name); showToast(`${t.label} now uses the bundled template`, 'success'); await refresh(); }
        catch (err) { showToast(err.message || 'Could not revert', 'error'); }
        finally { setBusy(''); }
    };

    return (
        <div className="page dc-pop">
            <div className="page-head">
                <h1>Templates</h1>
                <p>The Word templates each tool fills in. Upload a managed copy to change letterhead or layout without a code release; revert to go back to the version bundled with the app.</p>
            </div>
            <div className="panel">
                {rows === null ? <div className="loading-row">Loading…</div> : (
                    <table className="templates-table">
                        <thead><tr><th>Template</th><th>Used by</th><th>Status</th><th>Updated</th><th /></tr></thead>
                        <tbody>
                            {error && <tr><td colSpan={5} className="templates-error">{error}</td></tr>}
                            {rows.map((t) => (
                                <tr key={t.name}>
                                    <td><div className="templates-name">{t.label}</div><div className="templates-file">{t.name}</div></td>
                                    <td>{t.tool}</td>
                                    <td>{t.managed ? <span className="pill pill-live">Managed copy</span> : <span className="pill pill-soon">Bundled default</span>}</td>
                                    <td className="templates-meta">{t.managed ? `${fmtWhen(t.updatedAt)}${t.size ? ` · ${fmtSize(t.size)}` : ''}` : '—'}</td>
                                    <td className="templates-actions">
                                        <label className={`btn-outline sm templates-upload${busy === t.name ? ' disabled' : ''}`}>
                                            {busy === t.name ? 'Working…' : t.managed ? 'Replace' : 'Upload'}
                                            <input type="file" accept=".docx" aria-label={`Upload ${t.label}`} hidden disabled={busy === t.name} onChange={(e) => onPick(t, e)} />
                                        </label>
                                        {t.managed && <button type="button" className="btn-outline sm" disabled={busy === t.name} onClick={() => setPendingRevert(t)}>Revert to bundled</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <ConfirmDialog open={!!pendingRevert} title="Revert to the bundled template?" destructive confirmLabel="Revert"
                message={pendingRevert ? `The managed ${pendingRevert.label} template will be deleted and reports will use the version bundled with the app.` : ''}
                onConfirm={confirmRevert} onCancel={() => setPendingRevert(null)} />
        </div>
    );
};

export default Templates;
