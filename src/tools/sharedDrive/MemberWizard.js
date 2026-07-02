import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faTriangleExclamation, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { Avatar } from './overlays';
import { samePerson } from './data';
import { isNewMemberExcluded } from './service';
import { normalizeEmail, sameIdentity, isValidOrgEmail } from '../../lib/emailIdentity';

// Add/Remove members wizard (right slide-over). Self-contained: manages its own step +
// selection state and calls onConfirm(emails, driveIds) — picked people and any typed
// @engsurveys.com.au addresses are resolved to emails. When lockPeople is provided (opened
// for a specific person) it skips the people step (2-step flow with a banner).
const MemberWizard = ({ mode, people, drives, contextDriveId, contextDriveIds, lockPeople, onCancel, onConfirm }) => {
    const locked = Array.isArray(lockPeople) && lockPeople.length > 0;
    const selectable = drives.filter((d) => !d.excluded);
    const protectedCount = drives.length - selectable.length;
    const singlePerson = locked && lockPeople.length === 1 ? lockPeople[0] : null;
    const singleEmail = singlePerson ? (people.find((p) => p.id === singlePerson) || {}).email : null;
    const memberInDrive = (d, email) => !!email && (d.members || []).some((m) => samePerson(email, m.email));

    const [personIds, setPersonIds] = useState(locked ? lockPeople.slice() : []);
    const [extraEmails, setExtraEmails] = useState([]);   // typed addresses not in `people`
    const [emailErr, setEmailErr] = useState('');
    const [targetIds, setTargetIds] = useState(() => {
        if (contextDriveId) return [contextDriveId];
        if (contextDriveIds && contextDriveIds.length) return contextDriveIds.slice();
        return [];
    });
    const [pSearch, setPSearch] = useState('');
    // Opened from a single drive's "View members → Add member": the target drive is already
    // known, so skip the drive-selection step (people → review). The top-level "Add members"
    // and bulk (selected drives) flows keep it.
    const fixedDrive = !locked && !!contextDriveId && !(contextDriveIds && contextDriveIds.length);
    const stepKeys = locked ? ['drives', 'review'] : fixedDrive ? ['people', 'review'] : ['people', 'drives', 'review'];
    const [stepIdx, setStepIdx] = useState(0);
    const key = stepKeys[stepIdx];
    const lockedName = singlePerson ? (people.find((p) => p.id === singlePerson) || {}).name : null;

    const togglePerson = (id) => setPersonIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const toggleDrive = (id) => setTargetIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const setScope = (scope) => {
        if (scope === 'all') setTargetIds(addableDrives.map((d) => d.id));
        else if (scope === 'this' && contextDriveId) setTargetIds([contextDriveId]);
        else if (scope === 'selected' && contextDriveIds) setTargetIds(contextDriveIds.slice());
        else if (scope === 'new') setTargetIds(addableDrives.filter((d) => !isNewMemberExcluded(d.name)).map((d) => d.id));
    };

    // Emails chosen so far (selected known people + typed extras), de-duplicated by identity.
    const chosenEmails = () => {
        const out = [];
        const push = (email) => { if (email && !out.some((e) => sameIdentity(e, email))) out.push(normalizeEmail(email)); };
        personIds.forEach((id) => push((people.find((p) => p.id === id) || {}).email));
        extraEmails.forEach(push);
        return out;
    };
    const chosenCount = chosenEmails().length;

    // Add a typed address: if it matches a known person, select them; otherwise keep it as an extra.
    const addTypedEmail = (raw) => {
        const e = normalizeEmail(raw);
        if (!isValidOrgEmail(e)) { setEmailErr('Enter a valid @engsurveys.com.au email.'); return false; }
        if (chosenEmails().some((x) => sameIdentity(x, e))) { setEmailErr('That person is already selected.'); return false; }
        const known = people.find((p) => sameIdentity(p.email, e));
        if (known) setPersonIds((s) => (s.includes(known.id) ? s : [...s, known.id]));
        else setExtraEmails((s) => [...s, e]);
        setEmailErr('');
        return true;
    };
    const removeExtra = (email) => setExtraEmails((s) => s.filter((e) => e !== email));

    // When adding to one specific drive, don't offer people who are already in it.
    const contextDrive = contextDriveId ? drives.find((d) => d.id === contextDriveId) : null;
    const peopleFiltered = people.filter((p) => {
        if (mode === 'add' && contextDrive && memberInDrive(contextDrive, p.email)) return false;
        return (p.name + ' ' + p.email).toLowerCase().includes(pSearch.toLowerCase());
    });
    const typedIsEmail = isValidOrgEmail(pSearch) && !chosenEmails().some((x) => sameIdentity(x, pSearch));

    // The one member being added, when exactly one is chosen (locked, or a single pick). In ADD
    // mode we grey out (disable) drives they already belong to — only the rest are selectable.
    const soloEmail = locked ? singleEmail : (chosenCount === 1 ? chosenEmails()[0] : null);
    const alreadyInDrive = (d) => mode === 'add' && !!soloEmail && memberInDrive(d, soloEmail);
    const driveList = selectable;
    const addableDrives = driveList.filter((d) => !alreadyInDrive(d));

    const canNext = key === 'people' ? chosenCount > 0 : key === 'drives' ? targetIds.length > 0 : true;
    const isLast = stepIdx === stepKeys.length - 1;
    const next = () => { if (isLast) onConfirm(chosenEmails(), targetIds); else setStepIdx((i) => i + 1); };

    const chosenPeople = [
        ...personIds.map((id) => people.find((p) => p.id === id)).filter(Boolean),
        ...extraEmails.map((email) => ({ id: email, name: email, email })),
    ];
    const chosenDrives = targetIds.map((id) => drives.find((d) => d.id === id)).filter(Boolean);

    return (
        <>
            <div className="sdm-backdrop" onClick={onCancel} />
            <aside className="sdm-slideover wide" role="dialog" aria-modal="true">
                <button className="sdm-so-close" onClick={onCancel} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
                <div className="sdm-so-head">
                    <h2>{mode === 'add' ? 'Add members' : 'Remove members'}</h2>
                    <div className="sdm-steps" style={{ marginTop: 12 }}>
                        {stepKeys.map((k, i) => <span key={k} className={i <= stepIdx ? 'on' : ''} />)}
                    </div>
                    <div className="sdm-steplabel">Step {stepIdx + 1} of {stepKeys.length}</div>
                    {locked && lockedName && (
                        <div className="sdm-note">{mode === 'add' ? `Adding ${lockedName} — drives they already belong to are greyed out.` : `Removing ${lockedName}.`}</div>
                    )}
                    {fixedDrive && contextDrive && (
                        <div className="sdm-note">Adding members to “{contextDrive.name}”. People already in this drive are hidden.</div>
                    )}
                </div>

                <div className="sdm-so-body">
                    {key === 'people' && (
                        <>
                            <div className="sdm-search" style={{ width: '100%', marginBottom: 8 }}>
                                <input placeholder="Search people or type an email to add…" value={pSearch}
                                    onChange={(e) => { setPSearch(e.target.value); if (emailErr) setEmailErr(''); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && typedIsEmail) { e.preventDefault(); if (addTypedEmail(pSearch)) setPSearch(''); } }} />
                            </div>
                            {typedIsEmail && (
                                <button className="sdm-btn sdm-btn-outline sm" style={{ marginBottom: 8 }} onClick={() => { if (addTypedEmail(pSearch)) setPSearch(''); }}>
                                    <FontAwesomeIcon icon={faUserPlus} /> Add “{pSearch.trim().toLowerCase()}”
                                </button>
                            )}
                            {emailErr && <div className="sdm-field-err" style={{ marginBottom: 8 }}>{emailErr}</div>}
                            {extraEmails.length > 0 && (
                                <div className="sdm-tagrow" style={{ marginBottom: 10 }}>
                                    {extraEmails.map((email) => (
                                        <span className="sdm-tag sdm-tag-rm" key={email} title={email}>{email}
                                            <button className="sdm-tag-x" onClick={() => removeExtra(email)} aria-label={`Remove ${email}`}><FontAwesomeIcon icon={faXmark} /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="sdm-steplabel">{chosenCount} selected</div>
                            <div className="sdm-picklist sdm-picklist-tall">
                                {peopleFiltered.length === 0 ? (
                                    <div className="sdm-note" style={{ padding: '12px 14px' }}>
                                        {contextDrive
                                            ? 'Everyone in your directory is already in this drive — type an email above to add someone new.'
                                            : people.length === 0
                                                ? 'No saved people yet — type any @engsurveys.com.au email above to add someone.'
                                                : 'No people match your search. Type a full email above to add someone new.'}
                                    </div>
                                ) : peopleFiltered.map((p) => (
                                    <label className="sdm-pick" key={p.id}>
                                        <input type="checkbox" className="sdm-check" checked={personIds.includes(p.id)} onChange={() => togglePerson(p.id)} />
                                        <Avatar person={p} /> <span className="sdm-pick-name">{p.name}</span> <span className="meta">{p.email}</span>
                                    </label>
                                ))}
                            </div>
                        </>
                    )}

                    {key === 'drives' && (
                        <>
                            <div className="sdm-seg sdm-scopechips">
                                {contextDriveId && <button onClick={() => setScope('this')}>This drive</button>}
                                {contextDriveIds && contextDriveIds.length > 0 && <button onClick={() => setScope('selected')}>Selected drives</button>}
                                <button onClick={() => setScope('all')}>Select all</button>
                                {mode === 'add' && <button onClick={() => setScope('new')} title="Selects every drive except Accounts QT">New member</button>}
                            </div>
                            <div className="sdm-steplabel">{targetIds.length} drive{targetIds.length === 1 ? '' : 's'} selected</div>
                            <div className="sdm-picklist sdm-picklist-tall">
                                {driveList.length === 0 ? (
                                    <div className="sdm-note" style={{ padding: '12px 14px' }}>No drives available.</div>
                                ) : driveList.map((d) => {
                                    const already = alreadyInDrive(d);
                                    return (
                                        <label className={`sdm-pick${already ? ' disabled' : ''}`} key={d.id}>
                                            <input type="checkbox" className="sdm-check" disabled={already} checked={!already && targetIds.includes(d.id)} onChange={() => toggleDrive(d.id)} />
                                            <span className="sdm-pick-name">{d.name}</span>
                                            {already ? <span className="tag">Already a member</span>
                                                : (mode === 'add' && isNewMemberExcluded(d.name) && <span className="tag">Skipped by “New member”</span>)}
                                        </label>
                                    );
                                })}
                            </div>
                            {mode === 'add' && soloEmail && addableDrives.length === 0 && driveList.length > 0 && (
                                <div className="sdm-note">Already a member of every drive.</div>
                            )}
                            {protectedCount > 0 && <div className="sdm-note">{protectedCount} protected drive{protectedCount === 1 ? '' : 's'} are excluded from bulk changes.</div>}
                        </>
                    )}

                    {key === 'review' && (
                        <>
                            <div className="sdm-summary">
                                {mode === 'add' ? 'Add' : 'Remove'} <strong>{chosenPeople.length}</strong> {chosenPeople.length === 1 ? 'person' : 'people'} {mode === 'add' ? 'to' : 'from'} <strong>{chosenDrives.length}</strong> drive{chosenDrives.length === 1 ? '' : 's'}.
                            </div>
                            <div className="sdm-steplabel" style={{ marginTop: 14 }}>PEOPLE</div>
                            <div className="sdm-tagrow">{chosenPeople.map((p) => <span className="sdm-tag" key={p.id}>{p.name}</span>)}</div>
                            <div className="sdm-steplabel" style={{ marginTop: 14 }}>DRIVES</div>
                            <div className="sdm-tagrow">{chosenDrives.map((d) => <span className="sdm-tag" key={d.id}>{d.name}</span>)}</div>
                            {mode === 'remove' && (
                                <div className="sdm-warn"><FontAwesomeIcon icon={faTriangleExclamation} /> This removes real Google Workspace access. Protected drives are always skipped.</div>
                            )}
                        </>
                    )}
                </div>

                <div className="sdm-so-foot">
                    {stepIdx > 0 && <button className="sdm-btn sdm-btn-outline" onClick={() => setStepIdx((i) => i - 1)}>Back</button>}
                    <button className="sdm-btn sdm-btn-outline" onClick={onCancel}>Cancel</button>
                    <button className={`sdm-btn ${mode === 'remove' ? 'sdm-btn-red' : 'sdm-btn-yellow'}`} onClick={next} disabled={!canNext}>
                        {isLast ? (mode === 'add' ? 'Add members' : 'Remove members') : 'Next'}
                    </button>
                </div>
            </aside>
        </>
    );
};

export default MemberWizard;
