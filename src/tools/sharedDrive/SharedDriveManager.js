import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faMagnifyingGlass, faFolder, faLock, faUserPlus, faFolderPlus, faUsers, faUser,
    faTrash, faChevronLeft, faChevronRight, faArrowUp, faArrowDown, faPlus, faClockRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../auth/AuthProvider';
import { useToast } from '../../components/Toast';
import LoadingOverlay from '../../components/LoadingOverlay';
import { Avatar, DriveMembersPanel, PersonDrivesPanel, CreateDriveModal, AddMemberModal, ConfirmModal, ResultsModal } from './overlays';
import MemberWizard from './MemberWizard';
import { seedPeople, seedDrives, seedActivity, defaultMemberIds, samePerson, uid, initials as mkInitials } from './data';
import './SharedDriveManager.css';

const PAGE = 12;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const paginate = (arr, page) => arr.slice((page - 1) * PAGE, page * PAGE);
const pageCount = (n) => Math.max(1, Math.ceil(n / PAGE));

// seed once
const initialPeople = seedPeople();
const SEED = { people: initialPeople, drives: seedDrives(initialPeople), activity: seedActivity(), defaults: defaultMemberIds(initialPeople) };

const SharedDriveManager = () => {
    const { userName } = useAuth();
    const showToast = useToast();
    const actor = (userName && userName !== 'User') ? userName : 'You';

    const [people, setPeople] = useState(SEED.people);
    const [drives, setDrives] = useState(SEED.drives);
    const [log, setLog] = useState(SEED.activity);

    const [view, setView] = useState('drives');
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('name');
    const [sortDir, setSortDir] = useState('asc');
    const [driveFilter, setDriveFilter] = useState('All');
    const [memberFilter, setMemberFilter] = useState('All');
    const [drivePage, setDrivePage] = useState(1);
    const [memberPage, setMemberPage] = useState(1);
    const [logFilter, setLogFilter] = useState('All');
    const [selected, setSelected] = useState([]);

    const [panel, setPanel] = useState(null);         // { type:'drive'|'person', id }
    const [wizard, setWizard] = useState(null);        // { mode, contextDriveId, contextDriveIds, lockPeople }
    const [createOpen, setCreateOpen] = useState(false);
    const [addPersonOpen, setAddPersonOpen] = useState(false);
    const [confirm, setConfirm] = useState(null);      // { ...props }
    const [results, setResults] = useState(null);
    const [loadingMsg, setLoadingMsg] = useState(null);

    const personById = (id) => people.find((p) => p.id === id);
    const driveById = (id) => drives.find((d) => d.id === id);
    const memberCount = (p) => drives.filter((d) => d.memberIds.includes(p.id)).length;

    const pushLog = (type, title, detail, tone) =>
        setLog((l) => [{ id: uid('a'), type, title, detail, tone, ts: 'just now' }, ...l]);

    // ---------- mutations ----------
    const createDrive = (name, memberIds) => {
        const d = { id: uid('d'), name, excluded: false, memberIds: [...memberIds], activity: 'just now' };
        setDrives((ds) => [d, ...ds]);
        setCreateOpen(false);
        pushLog('create', 'Drive created', `${actor} · “${name}”`, 'ok');
        showToast(`Drive “${name}” created`, 'success');
        setPanel({ type: 'drive', id: d.id });
    };

    const addPerson = (name, email) => {
        const [first, ...rest] = name.split(' ');
        const last = rest.join(' ');
        const p = { id: uid('p'), first, last, name, email, initials: mkInitials(first, last) };
        setPeople((ps) => [...ps, p]);
        setAddPersonOpen(false);
        pushLog('directory', 'Directory updated', `${actor} · added ${name}`, 'ok');
        showToast(`${name} added to the directory`, 'success');
    };

    const removePersonFromDirectory = (person, alsoDrives) => {
        setPeople((ps) => ps.filter((p) => p.id !== person.id));
        if (alsoDrives) setDrives((ds) => ds.map((d) => ({ ...d, memberIds: d.memberIds.filter((id) => id !== person.id) })));
        pushLog('directory', 'Directory updated', `${actor} · removed ${person.name}${alsoDrives ? ' (and from all drives)' : ''}`, 'bad');
        showToast(`${person.name} removed`, 'success');
        setConfirm(null);
    };

    const removeMemberFromDrive = (driveId, personId) => {
        const d = driveById(driveId); const p = personById(personId);
        setDrives((ds) => ds.map((x) => (x.id === driveId ? { ...x, memberIds: x.memberIds.filter((id) => id !== personId), activity: 'just now' } : x)));
        pushLog('remove', 'Members removed', `${actor} · ${p?.name} removed from ${d?.name}`, 'bad');
        showToast(`${p?.name} removed from ${d?.name}`, 'success');
    };

    // ---------- bulk add/remove ----------
    const runBulk = async (mode, personIds, driveIds) => {
        setWizard(null);
        const targets = driveIds.map(driveById).filter(Boolean);
        if (!targets.length || !personIds.length) return;
        const skipped = []; const failed = []; let applied = 0;
        const next = drives.map((d) => ({ ...d, memberIds: [...d.memberIds] }));
        for (let i = 0; i < targets.length; i++) {
            setLoadingMsg(`Updating drive ${i + 1} of ${targets.length}…`);
            // eslint-disable-next-line no-await-in-loop
            await sleep(200);
            const d = next.find((x) => x.id === targets[i].id);
            if (d.excluded) { personIds.forEach((pid) => skipped.push(`${personById(pid)?.name} — “${d.name}” is protected`)); continue; }
            for (const pid of personIds) {
                const p = personById(pid);
                const isMember = d.memberIds.includes(pid) || d.memberIds.some((mid) => samePerson(p.email, personById(mid)?.email));
                if (mode === 'add') {
                    if (isMember) skipped.push(`${p.name} — already a member of “${d.name}”`);
                    else { d.memberIds.push(pid); applied++; }
                } else if (d.memberIds.includes(pid)) { d.memberIds = d.memberIds.filter((x) => x !== pid); applied++; }
                else skipped.push(`${p.name} — not on “${d.name}”`);
            }
            d.activity = 'just now';
        }
        setDrives(next);
        setSelected([]);
        setLoadingMsg(null);
        pushLog(mode === 'add' ? 'add' : 'remove',
            mode === 'add' ? 'Members added' : 'Members removed',
            `${actor} · ${applied} ${mode === 'add' ? 'added' : 'removed'} across ${targets.length} drive${targets.length === 1 ? '' : 's'}`,
            mode === 'add' ? 'ok' : 'bad');
        setResults({
            title: mode === 'add' ? 'Members added' : 'Members removed',
            summary: `${applied} membership${applied === 1 ? '' : 's'} ${mode === 'add' ? 'added' : 'removed'} · ${skipped.length} skipped`,
            skipped, failed,
        });
        showToast(`${applied} membership${applied === 1 ? '' : 's'} ${mode === 'add' ? 'added' : 'removed'}`, applied > 0 ? 'success' : undefined);
    };

    // ---------- derived: drives ----------
    const driveMatches = (d) => {
        if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (driveFilter === 'Standard') return !d.excluded;
        if (driveFilter === 'Protected') return d.excluded;
        if (driveFilter === 'Empty') return d.memberIds.length === 0;
        return true;
    };
    const drivesFiltered = drives.filter(driveMatches).sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'members') return (a.memberIds.length - b.memberIds.length) * dir;
        return a.name.localeCompare(b.name) * dir;
    });
    const drivePages = pageCount(drivesFiltered.length);
    const driveRows = paginate(drivesFiltered, Math.min(drivePage, drivePages));
    const selectableShown = drivesFiltered.filter((d) => !d.excluded);
    const allShownSelected = selectableShown.length > 0 && selectableShown.every((d) => selected.includes(d.id));

    // ---------- derived: members ----------
    const memberMatches = (p) => {
        if (search && !(p.name + ' ' + p.email).toLowerCase().includes(search.toLowerCase())) return false;
        const c = memberCount(p);
        if (memberFilter === 'On drives') return c > 0;
        if (memberFilter === 'No access') return c === 0;
        return true;
    };
    const membersFiltered = people.filter(memberMatches);
    const memberPages = pageCount(membersFiltered.length);
    const memberRows = paginate(membersFiltered, Math.min(memberPage, memberPages));

    // ---------- derived: activity ----------
    const logMap = { Created: 'create', Added: 'add', Removed: 'remove', Directory: 'directory' };
    const logRows = log.filter((e) => logFilter === 'All' || e.type === logMap[logFilter]);

    const resetPage = () => { setDrivePage(1); setMemberPage(1); };
    const go = (v) => { setView(v); setSearch(''); resetPage(); };

    // ---------- render helpers ----------
    const Pager = ({ total, pages, page, setPage }) => (total <= PAGE ? null : (
        <div className="sdm-pager">
            <span>{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} of {total}</span>
            <div className="sdm-pager-btns">
                <button className="sdm-pgbtn" disabled={page <= 1} onClick={() => setPage(page - 1)}><FontAwesomeIcon icon={faChevronLeft} /></button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                    <button key={n} className={`sdm-pgbtn${n === page ? ' on' : ''}`} onClick={() => setPage(n)}>{n}</button>
                ))}
                <button className="sdm-pgbtn" disabled={page >= pages} onClick={() => setPage(page + 1)}><FontAwesomeIcon icon={faChevronRight} /></button>
            </div>
        </div>
    ));

    const SortBtn = ({ k, label }) => (
        <button className={sortKey === k ? 'on' : ''} onClick={() => { if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(k); setSortDir('asc'); } resetPage(); }}>
            {label}{sortKey === k && <FontAwesomeIcon icon={sortDir === 'asc' ? faArrowUp : faArrowDown} style={{ marginLeft: 6 }} />}
        </button>
    );

    return (
        <div className="sdm">
            {/* Left sub-nav */}
            <nav className="sdm-nav">
                <div className="sdm-nav-label">SHARED DRIVE MANAGER</div>
                {[['drives', faFolder, 'Shared Drives', drives.length],
                  ['members', faUsers, 'Members Directory', people.length],
                  ['activity', faClockRotateLeft, 'Activity Log', log.length]].map(([v, ic, label, ct]) => (
                    <button key={v} className={`sdm-nav-item${view === v ? ' active' : ''}`} onClick={() => go(v)}>
                        <FontAwesomeIcon icon={ic} /> <span>{label}</span> <span className="sdm-nav-ct">{ct}</span>
                    </button>
                ))}
                <div className="sdm-nav-callout">
                    <FontAwesomeIcon icon={faLock} style={{ color: '#8a6a1a' }} />
                    <div><div className="t">Manager level access only</div><div className="s">Bulk changes here affect real Google Workspace access.</div></div>
                </div>
            </nav>

            <div className="sdm-content">
                {/* ---------------- DRIVES ---------------- */}
                {view === 'drives' && (
                    <>
                        <div className="sdm-head">
                            <div><h1>Shared Drives</h1><p>Browse, search and manage access across every shared drive.</p></div>
                            <div className="sdm-head-actions">
                                <button className="sdm-btn sdm-btn-dark" onClick={() => setWizard({ mode: 'add' })}><FontAwesomeIcon icon={faUserPlus} /> Add members</button>
                                <button className="sdm-btn sdm-btn-yellow" onClick={() => setCreateOpen(true)}><FontAwesomeIcon icon={faFolderPlus} /> Create drive</button>
                            </div>
                        </div>

                        <div className="sdm-toolbar">
                            <div className="sdm-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input placeholder="Search drives by name" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} /></div>
                            <div><span className="sdm-sortlabel">Sort</span><span className="sdm-seg"><SortBtn k="name" label="Name" /><SortBtn k="members" label="Members" /></span></div>
                        </div>
                        <div className="sdm-filterrow">
                            <span className="sdm-filterlabel">Filter</span>
                            <span className="sdm-seg">{['All', 'Standard', 'Protected', 'Empty'].map((f) => (
                                <button key={f} className={driveFilter === f ? 'on' : ''} onClick={() => { setDriveFilter(f); resetPage(); }}>{f}</button>))}
                            </span>
                        </div>

                        {selected.length > 0 && (
                            <div className="sdm-bulk">
                                <span className="ct">{selected.length} drive{selected.length === 1 ? '' : 's'} selected</span>
                                <button className="sdm-btn sdm-btn-yellow sm sp" onClick={() => setWizard({ mode: 'add', contextDriveIds: selected })}><FontAwesomeIcon icon={faUserPlus} /> Add members</button>
                                <button className="sdm-btn sdm-btn-ondark sm" onClick={() => setWizard({ mode: 'remove', contextDriveIds: selected })}>Remove members</button>
                                <button className="sdm-btn sdm-btn-ondark sm" onClick={() => setSelected([])}>Clear</button>
                            </div>
                        )}

                        {drivesFiltered.length === 0 ? (
                            <div className="sdm-empty"><FontAwesomeIcon icon={faFolder} size="2x" /><h3>No drives found</h3><p>{search || driveFilter !== 'All' ? 'Try a different search or filter.' : 'Create your first shared drive.'}</p><button className="sdm-btn sdm-btn-yellow" onClick={() => setCreateOpen(true)}><FontAwesomeIcon icon={faFolderPlus} /> Create drive</button></div>
                        ) : (
                            <div className="sdm-card">
                                <div className="sdm-row sdm-drives-grid sdm-thead">
                                    <span><input type="checkbox" className="sdm-check" checked={allShownSelected}
                                        onChange={() => setSelected(allShownSelected ? selected.filter((id) => !selectableShown.some((d) => d.id === id)) : [...new Set([...selected, ...selectableShown.map((d) => d.id)])])} /></span>
                                    <span>DRIVE</span><span>MEMBERS</span><span>LAST ACTIVITY</span><span>ACTIONS</span>
                                </div>
                                {driveRows.map((d) => {
                                    const mem = d.memberIds.map(personById).filter(Boolean);
                                    return (
                                        <div className="sdm-row sdm-drives-grid sdm-trow" key={d.id}>
                                            <span>{d.excluded ? <FontAwesomeIcon icon={faLock} className="sdm-lock" /> : (
                                                <input type="checkbox" className="sdm-check" checked={selected.includes(d.id)} onChange={() => setSelected((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]))} />)}
                                            </span>
                                            <div className="sdm-cell">
                                                <span className="sdm-tile-ico"><FontAwesomeIcon icon={faFolder} /></span>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="sdm-name">{d.name}</div>
                                                    {d.excluded && <span className="sdm-chip sdm-chip-protected">Protected</span>}
                                                </div>
                                            </div>
                                            <div className="sdm-cell">
                                                <span className="sdm-stack">{mem.slice(0, 3).map((m) => <Avatar key={m.id} person={m} />)}</span>
                                                <span className="sdm-sub">{mem.length} member{mem.length === 1 ? '' : 's'}</span>
                                            </div>
                                            <span className="sdm-sub">{d.activity}</span>
                                            <div className="sdm-cell">
                                                <button className="sdm-btn sdm-btn-outline sm" onClick={() => setPanel({ type: 'drive', id: d.id })}>View members</button>
                                                {!d.excluded && <button className="sdm-iconbtn add" title="Add member" onClick={() => setWizard({ mode: 'add', contextDriveId: d.id })}><FontAwesomeIcon icon={faPlus} /></button>}
                                            </div>
                                        </div>
                                    );
                                })}
                                <Pager total={drivesFiltered.length} pages={drivePages} page={Math.min(drivePage, drivePages)} setPage={setDrivePage} />
                            </div>
                        )}
                    </>
                )}

                {/* ---------------- MEMBERS ---------------- */}
                {view === 'members' && (
                    <>
                        <div className="sdm-head">
                            <div><h1>Members Directory</h1><p>The reusable people list — separate from who’s on each drive.</p></div>
                            <div className="sdm-head-actions"><button className="sdm-btn sdm-btn-yellow" onClick={() => setAddPersonOpen(true)}><FontAwesomeIcon icon={faUserPlus} /> Add member</button></div>
                        </div>
                        <div className="sdm-toolbar">
                            <div className="sdm-search" style={{ width: 340 }}><FontAwesomeIcon icon={faMagnifyingGlass} /><input placeholder="Search people by name or email" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} /></div>
                            <div><span className="sdm-filterlabel">Filter</span><span className="sdm-seg">{['All', 'On drives', 'No access'].map((f) => <button key={f} className={memberFilter === f ? 'on' : ''} onClick={() => { setMemberFilter(f); resetPage(); }}>{f}</button>)}</span></div>
                        </div>

                        {membersFiltered.length === 0 ? (
                            <div className="sdm-empty"><FontAwesomeIcon icon={faUser} size="2x" /><h3>No people found</h3><p>{search || memberFilter !== 'All' ? 'Try a different search or filter.' : 'Add your first team member.'}</p></div>
                        ) : (
                            <div className="sdm-card">
                                <div className="sdm-row sdm-members-grid sdm-thead"><span>PERSON</span><span>EMAIL</span><span>ROLE</span><span>ON DRIVES</span><span>ACTIONS</span></div>
                                {memberRows.map((p) => (
                                    <div className="sdm-row sdm-members-grid sdm-trow" key={p.id}>
                                        <div className="sdm-cell"><Avatar person={p} lg /><span className="sdm-name">{p.name}</span></div>
                                        <span className="sdm-sub">{p.email}</span>
                                        <span><span className="sdm-chip sdm-chip-role">Content Manager</span></span>
                                        <span className="sdm-sub">in {memberCount(p)} drive{memberCount(p) === 1 ? '' : 's'}</span>
                                        <div className="sdm-cell">
                                            <button className="sdm-btn sdm-btn-outline sm" onClick={() => setPanel({ type: 'person', id: p.id })}>View drives</button>
                                            <button className="sdm-iconbtn del" title="Remove from directory" onClick={() => setConfirm({
                                                title: 'Remove from directory?',
                                                message: `Remove ${p.name} from the members directory?`,
                                                confirmLabel: 'Remove', destructive: true,
                                                option: 'Also remove from all shared drives',
                                                onConfirm: (also) => removePersonFromDirectory(p, also),
                                            })}><FontAwesomeIcon icon={faTrash} /></button>
                                        </div>
                                    </div>
                                ))}
                                <Pager total={membersFiltered.length} pages={memberPages} page={Math.min(memberPage, memberPages)} setPage={setMemberPage} />
                            </div>
                        )}
                    </>
                )}

                {/* ---------------- ACTIVITY ---------------- */}
                {view === 'activity' && (
                    <>
                        <div className="sdm-head"><div><h1>Activity Log</h1><p>Every change to drives and access, most recent first.</p></div></div>
                        <div className="sdm-filterrow"><span className="sdm-seg">{['All', 'Created', 'Added', 'Removed', 'Directory'].map((f) => <button key={f} className={logFilter === f ? 'on' : ''} onClick={() => setLogFilter(f)}>{f}</button>)}</span></div>
                        <div className="sdm-card">
                            {logRows.length === 0 ? <div className="sdm-empty" style={{ border: 'none' }}><p>No activity for this filter.</p></div> : logRows.map((e) => (
                                <div className="sdm-log-row" key={e.id}>
                                    <span className={`sdm-log-ico ${e.type}`}><FontAwesomeIcon icon={e.type === 'create' ? faFolderPlus : e.type === 'add' ? faUserPlus : e.type === 'remove' ? faTrash : faUsers} /></span>
                                    <div style={{ minWidth: 0 }}><div className="sdm-log-title">{e.title}</div><div className={`sdm-log-detail${e.tone === 'bad' ? ' bad' : ''}`}>{e.detail}</div></div>
                                    <span className="sdm-log-when">{e.ts}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ---------------- overlays ---------------- */}
            {panel?.type === 'drive' && driveById(panel.id) && (
                <DriveMembersPanel drive={driveById(panel.id)} people={people}
                    onClose={() => setPanel(null)}
                    onAdd={() => { const id = panel.id; setPanel(null); setWizard({ mode: 'add', contextDriveId: id }); }}
                    onRemove={(m) => removeMemberFromDrive(panel.id, m.id)} />
            )}
            {panel?.type === 'person' && personById(panel.id) && (
                <PersonDrivesPanel person={personById(panel.id)} drives={drives}
                    onClose={() => setPanel(null)}
                    onAddToDrives={() => { const id = panel.id; setPanel(null); setWizard({ mode: 'add', lockPeople: [id] }); }}
                    onRemoveFromDrive={(d) => removeMemberFromDrive(d.id, panel.id)} />
            )}
            {wizard && (
                <MemberWizard mode={wizard.mode} people={people} drives={drives}
                    contextDriveId={wizard.contextDriveId} contextDriveIds={wizard.contextDriveIds} lockPeople={wizard.lockPeople}
                    onCancel={() => setWizard(null)} onConfirm={(pids, dids) => runBulk(wizard.mode, pids, dids)} />
            )}
            {createOpen && (
                <CreateDriveModal existingNames={drives.map((d) => d.name)} people={people} defaultMemberIds={SEED.defaults}
                    onCancel={() => setCreateOpen(false)} onCreate={createDrive} />
            )}
            {addPersonOpen && (
                <AddMemberModal existingEmails={people.map((p) => p.email)} onCancel={() => setAddPersonOpen(false)} onAdd={addPerson} />
            )}
            {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}
            {results && <ResultsModal results={results} onClose={() => setResults(null)} />}
            {loadingMsg && <LoadingOverlay message={loadingMsg} />}
        </div>
    );
};

export default SharedDriveManager;
