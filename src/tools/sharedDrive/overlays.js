import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faXmark, faUserPlus, faFolderPlus, faTriangleExclamation, faCheck, faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';

export const Avatar = ({ person, lg }) => (
    <span className={`sdm-av${lg ? ' lg' : ''}`}>{person?.initials || '?'}</span>
);

const Backdrop = ({ onClick }) => <div className="sdm-backdrop" onClick={onClick} />;

const ORG_DOMAIN = 'engsurveys.com.au';
const isOrgEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim()) && (s || '').toLowerCase().trim().endsWith(`@${ORG_DOMAIN}`);

// ---- Drive members slide-over ----
export const DriveMembersPanel = ({ drive, people, onClose, onAdd, onRemove }) => {
    const members = drive.memberIds.map((id) => people.find((p) => p.id === id)).filter(Boolean);
    return (
        <>
            <Backdrop onClick={onClose} />
            <aside className="sdm-slideover" role="dialog" aria-modal="true">
                <button className="sdm-so-close" onClick={onClose} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
                <div className="sdm-so-head">
                    <h2>{drive.name}{drive.excluded && <span className="sdm-chip sdm-chip-protected">Protected</span>}</h2>
                    <p className="sdm-sub" style={{ marginTop: 4 }}>{members.length} member{members.length === 1 ? '' : 's'}</p>
                </div>
                <div className="sdm-so-body">
                    <button className="sdm-btn sdm-btn-yellow" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
                        onClick={onAdd}><FontAwesomeIcon icon={faUserPlus} /> Add member</button>
                    {members.length === 0 ? (
                        <p className="sdm-note">No members in this drive yet.</p>
                    ) : members.map((m) => (
                        <div className="sdm-list-row" key={m.id}>
                            <Avatar person={m} lg />
                            <div style={{ minWidth: 0 }}>
                                <div className="sdm-name">{m.name}</div>
                                <div className="sdm-sub">{m.email} · Content Manager</div>
                            </div>
                            <button className="sdm-btn sdm-btn-outline sm" style={{ marginLeft: 'auto' }} onClick={() => onRemove(m)}>Remove</button>
                        </div>
                    ))}
                </div>
            </aside>
        </>
    );
};

// ---- Person drives slide-over ----
export const PersonDrivesPanel = ({ person, drives, onClose, onAddToDrives, onRemoveFromDrive }) => {
    const on = drives.filter((d) => d.memberIds.includes(person.id));
    return (
        <>
            <Backdrop onClick={onClose} />
            <aside className="sdm-slideover" role="dialog" aria-modal="true">
                <button className="sdm-so-close" onClick={onClose} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
                <div className="sdm-so-head">
                    <h2><Avatar person={person} lg /> {person.name}</h2>
                    <p className="sdm-sub" style={{ marginTop: 6 }}>{person.email} · on {on.length} drive{on.length === 1 ? '' : 's'}</p>
                </div>
                <div className="sdm-so-body">
                    <button className="sdm-btn sdm-btn-yellow" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
                        onClick={onAddToDrives}><FontAwesomeIcon icon={faFolderPlus} /> Add to drives</button>
                    {on.length === 0 ? (
                        <p className="sdm-note">Not a member of any drive yet.</p>
                    ) : on.map((d) => (
                        <div className="sdm-list-row" key={d.id}>
                            <div className="sdm-name">{d.name}{d.excluded && <span className="sdm-chip sdm-chip-protected" style={{ marginLeft: 6 }}>Protected</span>}</div>
                            {!d.excluded && <button className="sdm-btn sdm-btn-outline sm" style={{ marginLeft: 'auto' }} onClick={() => onRemoveFromDrive(d)}>Remove</button>}
                        </div>
                    ))}
                </div>
            </aside>
        </>
    );
};

// ---- Create drive modal ----
export const CreateDriveModal = ({ existingNames, people, defaultMemberIds, onCancel, onCreate }) => {
    const [name, setName] = useState('');
    const [err, setErr] = useState('');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(defaultMemberIds || []);

    const filtered = people.filter((p) => (p.name + ' ' + p.email).toLowerCase().includes(search.toLowerCase()));
    const allShown = filtered.length > 0 && filtered.every((p) => selected.includes(p.id));
    const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const toggleAll = () => setSelected((s) => (allShown ? s.filter((id) => !filtered.some((p) => p.id === id)) : [...new Set([...s, ...filtered.map((p) => p.id)])]));

    const submit = () => {
        const n = name.trim();
        if (!n) { setErr('Please enter a drive name.'); return; }
        if ((existingNames || []).some((x) => x.toLowerCase() === n.toLowerCase())) { setErr('A shared drive with this name already exists.'); return; }
        onCreate(n, selected);
    };

    return (
        <div className="sdm-modal-wrap"><Backdrop onClick={onCancel} />
            <div className="sdm-modal" role="dialog" aria-modal="true" style={{ zIndex: 71 }}>
                <div className="sdm-modal-head"><h2>Create shared drive</h2><p>Name the drive and choose who to add.</p></div>
                <div className="sdm-modal-body">
                    <label className="sdm-field">Drive name
                        <input value={name} placeholder="e.g. Client Drive – Jones" autoFocus
                            onChange={(e) => { setName(e.target.value); if (err) setErr(''); }} />
                    </label>
                    {err && <div className="sdm-field-err">{err}</div>}
                    <div className="sdm-field" style={{ marginBottom: 6 }}>Members to add <span style={{ fontWeight: 500, color: 'var(--sdm-muted2)' }}>({selected.length} selected)</span></div>
                    <div className="sdm-search" style={{ width: '100%', marginBottom: 8 }}>
                        <input placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <div className="sdm-picklist">
                        <label className="sdm-pick sdm-pick-sticky"><input type="checkbox" className="sdm-check" checked={allShown} onChange={toggleAll} /> Select all</label>
                        {filtered.map((p) => (
                            <label className="sdm-pick" key={p.id}>
                                <input type="checkbox" className="sdm-check" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                                <Avatar person={p} /> <span>{p.name}</span> <span className="meta">{p.email}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="sdm-modal-foot">
                    <button className="sdm-btn sdm-btn-outline" onClick={onCancel}>Cancel</button>
                    <button className="sdm-btn sdm-btn-yellow" onClick={submit}><FontAwesomeIcon icon={faFolderPlus} /> Create drive</button>
                </div>
            </div>
        </div>
    );
};

// ---- Add member (directory) modal ----
export const AddMemberModal = ({ existingEmails, onCancel, onAdd }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [err, setErr] = useState('');
    const submit = () => {
        if (!name.trim()) { setErr('Enter the person’s full name.'); return; }
        if (!isOrgEmail(email)) { setErr(`Enter a valid @${ORG_DOMAIN} email.`); return; }
        if ((existingEmails || []).some((e) => e.toLowerCase() === email.trim().toLowerCase())) { setErr('That person is already in the directory.'); return; }
        onAdd(name.trim(), email.trim().toLowerCase());
    };
    return (
        <div className="sdm-modal-wrap"><Backdrop onClick={onCancel} />
            <div className="sdm-modal sm" role="dialog" aria-modal="true" style={{ zIndex: 71 }}>
                <div className="sdm-modal-head"><h2>Add member</h2><p>Add a person to the directory.</p></div>
                <div className="sdm-modal-body">
                    <label className="sdm-field">Full name
                        <input value={name} placeholder="Dave Mitchell" autoFocus onChange={(e) => { setName(e.target.value); if (err) setErr(''); }} />
                    </label>
                    <label className="sdm-field">Email address
                        <input type="email" value={email} placeholder={`name@${ORG_DOMAIN}`} onChange={(e) => { setEmail(e.target.value); if (err) setErr(''); }} />
                    </label>
                    {err && <div className="sdm-field-err">{err}</div>}
                </div>
                <div className="sdm-modal-foot">
                    <button className="sdm-btn sdm-btn-outline" onClick={onCancel}>Cancel</button>
                    <button className="sdm-btn sdm-btn-yellow" onClick={submit}><FontAwesomeIcon icon={faUserPlus} /> Add member</button>
                </div>
            </div>
        </div>
    );
};

// ---- Confirm modal (optional checkbox) ----
export const ConfirmModal = ({ title, message, confirmLabel = 'Confirm', destructive, option, onConfirm, onCancel }) => {
    const [checked, setChecked] = useState(false);
    return (
        <div className="sdm-modal-wrap"><Backdrop onClick={onCancel} />
            <div className="sdm-modal sm" role="dialog" aria-modal="true" style={{ zIndex: 71 }}>
                <div className="sdm-modal-head">
                    <h2><FontAwesomeIcon icon={faTriangleExclamation} style={{ color: 'var(--sdm-red-tx)', marginRight: 8 }} />{title}</h2>
                    <p>{message}</p>
                </div>
                {option && (
                    <div className="sdm-modal-body">
                        <label className="sdm-pick" style={{ border: 'none' }}>
                            <input type="checkbox" className="sdm-check" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> {option}
                        </label>
                    </div>
                )}
                <div className="sdm-modal-foot">
                    <button className="sdm-btn sdm-btn-outline" onClick={onCancel}>Cancel</button>
                    <button className={`sdm-btn ${destructive ? 'sdm-btn-red' : 'sdm-btn-yellow'}`} onClick={() => onConfirm(checked)}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
};

// ---- Results modal ----
export const ResultsModal = ({ results, onClose }) => {
    const ok = (results.failed || []).length === 0;
    return (
        <div className="sdm-modal-wrap"><Backdrop onClick={onClose} />
            <div className="sdm-modal" role="dialog" aria-modal="true" style={{ zIndex: 71 }}>
                <div className="sdm-modal-head">
                    <h2><FontAwesomeIcon icon={ok ? faCircleCheck : faTriangleExclamation} style={{ color: ok ? 'var(--sdm-green)' : 'var(--sdm-red-tx)', marginRight: 8 }} />{results.title}</h2>
                    <p>{results.summary}</p>
                </div>
                <div className="sdm-modal-body">
                    {(results.skipped || []).length > 0 && (
                        <div className="sdm-res-sec"><h4>SKIPPED</h4>{results.skipped.map((s, i) => <div className="sdm-res-item" key={i}>{s}</div>)}</div>
                    )}
                    {(results.failed || []).length > 0 && (
                        <div className="sdm-res-sec"><h4 style={{ color: 'var(--sdm-red-tx)' }}>FAILED</h4>{results.failed.map((s, i) => <div className="sdm-res-item" key={i}>{s}</div>)}</div>
                    )}
                </div>
                <div className="sdm-modal-foot">
                    <button className="sdm-btn sdm-btn-yellow" onClick={onClose}><FontAwesomeIcon icon={faCheck} /> Done</button>
                </div>
            </div>
        </div>
    );
};
