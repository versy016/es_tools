import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { Avatar } from './overlays';
import { samePerson } from './data';

// Add/Remove members wizard (right slide-over). Self-contained: manages its own step +
// selection state and calls onConfirm(personIds, driveIds). When lockPeople is provided
// (opened for a specific person) it skips the people step (2-step flow with a banner).
const MemberWizard = ({ mode, people, drives, contextDriveId, contextDriveIds, lockPeople, onCancel, onConfirm }) => {
    const locked = Array.isArray(lockPeople) && lockPeople.length > 0;
    const selectable = drives.filter((d) => !d.excluded);
    const protectedCount = drives.length - selectable.length;
    const singlePerson = locked && lockPeople.length === 1 ? lockPeople[0] : null;
    const singleEmail = singlePerson ? (people.find((p) => p.id === singlePerson) || {}).email : null;
    const inDrive = (d) => (d.members || []).some((m) => samePerson(singleEmail, m.email));

    const [personIds, setPersonIds] = useState(locked ? lockPeople.slice() : []);
    const [targetIds, setTargetIds] = useState(() => {
        if (contextDriveId) return [contextDriveId];
        if (contextDriveIds && contextDriveIds.length) return contextDriveIds.slice();
        return [];
    });
    const [pSearch, setPSearch] = useState('');
    const stepKeys = locked ? ['drives', 'review'] : ['people', 'drives', 'review'];
    const [stepIdx, setStepIdx] = useState(0);
    const key = stepKeys[stepIdx];
    const lockedName = singlePerson ? (people.find((p) => p.id === singlePerson) || {}).name : null;

    const togglePerson = (id) => setPersonIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const toggleDrive = (id) => setTargetIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const setScope = (scope) => {
        if (scope === 'all') setTargetIds(selectable.map((d) => d.id));
        else if (scope === 'this' && contextDriveId) setTargetIds([contextDriveId]);
        else if (scope === 'selected' && contextDriveIds) setTargetIds(contextDriveIds.slice());
    };

    const peopleFiltered = people.filter((p) => (p.name + ' ' + p.email).toLowerCase().includes(pSearch.toLowerCase()));
    // For a single locked person in ADD mode, sort drives they're already in to the bottom.
    const driveList = useMemo(() => {
        const list = selectable.slice();
        if (mode === 'add' && singleEmail) list.sort((a, b) => Number(inDrive(a)) - Number(inDrive(b)));
        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectable, mode, singleEmail]);

    const canNext = key === 'people' ? personIds.length > 0 : key === 'drives' ? targetIds.length > 0 : true;
    const isLast = stepIdx === stepKeys.length - 1;
    const next = () => { if (isLast) onConfirm(personIds, targetIds); else setStepIdx((i) => i + 1); };

    const chosenPeople = personIds.map((id) => people.find((p) => p.id === id)).filter(Boolean);
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
                        <div className="sdm-note">{mode === 'add' ? 'Adding' : 'Removing'} {lockedName} — drives they already belong to are greyed out.</div>
                    )}
                </div>

                <div className="sdm-so-body">
                    {key === 'people' && (
                        <>
                            <div className="sdm-search" style={{ width: '100%', marginBottom: 10 }}>
                                <input placeholder="Search people" value={pSearch} onChange={(e) => setPSearch(e.target.value)} />
                            </div>
                            <div className="sdm-steplabel">{personIds.length} selected</div>
                            <div className="sdm-picklist">
                                {peopleFiltered.map((p) => (
                                    <label className="sdm-pick" key={p.id}>
                                        <input type="checkbox" className="sdm-check" checked={personIds.includes(p.id)} onChange={() => togglePerson(p.id)} />
                                        <Avatar person={p} /> <span>{p.name}</span> <span className="meta">{p.email}</span>
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
                                <button onClick={() => setScope('all')}>All drives</button>
                            </div>
                            <div className="sdm-steplabel">{targetIds.length} drive{targetIds.length === 1 ? '' : 's'} selected</div>
                            <div className="sdm-picklist">
                                {driveList.map((d) => {
                                    const already = mode === 'add' && singleEmail && inDrive(d);
                                    return (
                                        <label className={`sdm-pick${already ? ' disabled' : ''}`} key={d.id}>
                                            <input type="checkbox" className="sdm-check" disabled={already} checked={targetIds.includes(d.id)} onChange={() => toggleDrive(d.id)} />
                                            <span>{d.name}</span>
                                            {already && <span className="tag">Already a member</span>}
                                        </label>
                                    );
                                })}
                            </div>
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
