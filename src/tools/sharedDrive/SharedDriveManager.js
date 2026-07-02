import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faMagnifyingGlass, faFolder, faLock, faUserPlus, faFolderPlus, faUsers, faUser,
    faTrash, faChevronLeft, faChevronRight, faArrowUp, faArrowDown, faPlus, faClockRotateLeft, faRightToBracket,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../auth/AuthProvider';
import { useToast } from '../../components/Toast';
import LoadingOverlay from '../../components/LoadingOverlay';
import { Avatar, DriveMembersPanel, PersonDrivesPanel, CreateDriveModal, AddMemberModal, ConfirmModal, ResultsModal } from './overlays';
import MemberWizard from './MemberWizard';
import { resolvePerson, samePerson } from './data';
import * as svc from './service';
import './SharedDriveManager.css';

const PAGE = 12;
const paginate = (arr, page) => arr.slice((page - 1) * PAGE, page * PAGE);
const pageCount = (n) => Math.max(1, Math.ceil(n / PAGE));

const SharedDriveManager = () => {
    const { userName } = useAuth();
    const showToast = useToast();
    const actor = (userName && userName !== 'User') ? userName : 'You';

    const [people, setPeople] = useState([]);          // directory (Supabase)
    const [drives, setDrives] = useState([]);          // Google drives w/ members
    const [log, setLog] = useState([]);                // activity (Supabase)
    const [connected, setConnected] = useState(svc.isConnected());
    const [connecting, setConnecting] = useState(false);

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

    const [panel, setPanel] = useState(null);
    const [wizard, setWizard] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [addPersonOpen, setAddPersonOpen] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const [results, setResults] = useState(null);
    const [loadingMsg, setLoadingMsg] = useState(null);

    const configured = svc.isConfigured();
    const driveById = (id) => drives.find((d) => d.id === id);
    const memberCount = (p) => drives.filter((d) => (d.members || []).some((m) => samePerson(p.email, m.email))).length;
    const resolve = (email) => resolvePerson(email, people);
    const emailsFor = (ids) => ids.map((id) => people.find((p) => p.id === id)?.email).filter(Boolean);

    const refreshDirectory = useCallback(() => svc.listDirectory().then(setPeople).catch(() => {}), []);
    const refreshActivity = useCallback(() => svc.listActivity().then(setLog).catch(() => {}), []);
    const pushLog = async (type, title, detail, tone) => { await svc.logActivity({ actor, type, title, detail, tone }); refreshActivity(); };

    // Load directory + activity on mount (these don't need Google).
    useEffect(() => { refreshDirectory(); refreshActivity(); }, [refreshDirectory, refreshActivity]);

    // Fetch every drive + its members from Google (after the user connects).
    const loadDrives = async () => {
        setLoadingMsg('Loading shared drives…');
        try {
            const list = await svc.listDrives();
            const withMembers = await Promise.all(list.map(async (d) => ({
                ...d, excluded: svc.isProtected(d.name),
                members: await svc.listMembers(d.id).catch(() => []),
            })));
            setDrives(withMembers);
            setConnected(true);
        } catch (e) {
            showToast(e.message || 'Could not load drives from Google', 'error');
        } finally { setLoadingMsg(null); }
    };

    const connectGoogle = async () => {
        setConnecting(true);
        try { await svc.connect(); await loadDrives(); }
        catch (e) { showToast(e.message || 'Google sign-in failed', 'error'); }
        finally { setConnecting(false); }
    };

    const refreshDrive = async (driveId) => {
        const members = await svc.listMembers(driveId).catch(() => []);
        setDrives((ds) => ds.map((d) => (d.id === driveId ? { ...d, members } : d)));
    };

    // ---------- mutations ----------
    const createDrive = async (name, memberIds) => {
        setCreateOpen(false);
        setLoadingMsg(`Creating “${name}”…`);
        try {
            const d = await svc.createDrive(name);
            const emails = emailsFor(memberIds);
            for (let i = 0; i < emails.length; i++) {
                setLoadingMsg(`Adding members ${i + 1} of ${emails.length}…`);
                // eslint-disable-next-line no-await-in-loop
                await svc.addMember(d.id, emails[i]).catch(() => {});
            }
            const members = await svc.listMembers(d.id).catch(() => []);
            setDrives((ds) => [{ id: d.id, name: d.name, excluded: svc.isProtected(d.name), members }, ...ds]);
            await pushLog('create', 'Drive created', `${actor} · “${name}”`, 'ok');
            showToast(`Drive “${name}” created`, 'success');
            setPanel({ type: 'drive', id: d.id });
        } catch (e) { showToast(e.message || 'Could not create the drive', 'error'); }
        finally { setLoadingMsg(null); }
    };

    const addPerson = async (name, email) => {
        setAddPersonOpen(false);
        try {
            await svc.addToDirectory(name, email);
            await refreshDirectory();
            await pushLog('directory', 'Directory updated', `${actor} · added ${name}`, 'ok');
            showToast(`${name} added to the directory`, 'success');
        } catch (e) { showToast(e.message || 'Could not add to the directory', 'error'); }
    };

    const removePersonFromDirectory = async (person, alsoDrives) => {
        setConfirm(null);
        setLoadingMsg('Removing…');
        try {
            await svc.removeFromDirectory(person.id);
            if (alsoDrives) {
                for (const d of drives) {
                    if (d.excluded) continue;
                    const m = (d.members || []).find((x) => samePerson(person.email, x.email));
                    // eslint-disable-next-line no-await-in-loop
                    if (m) { await svc.removeMember(d.id, m.permissionId).catch(() => {}); await refreshDrive(d.id); }
                }
            }
            await refreshDirectory();
            await pushLog('directory', 'Directory updated', `${actor} · removed ${person.name}${alsoDrives ? ' (and from all drives)' : ''}`, 'bad');
            showToast(`${person.name} removed`, 'success');
        } catch (e) { showToast(e.message || 'Could not remove', 'error'); }
        finally { setLoadingMsg(null); }
    };

    const removeMemberFromDrive = async (driveId, email) => {
        const d = driveById(driveId);
        const m = (d?.members || []).find((x) => samePerson(email, x.email));
        if (!m) return;
        setLoadingMsg('Removing member…');
        try {
            await svc.removeMember(driveId, m.permissionId);
            await refreshDrive(driveId);
            await pushLog('remove', 'Members removed', `${actor} · ${resolve(email).name} removed from ${d.name}`, 'bad');
            showToast('Member removed', 'success');
        } catch (e) { showToast(e.message || 'Could not remove member', 'error'); }
        finally { setLoadingMsg(null); }
    };

    // ---------- bulk ----------
    const runBulk = async (mode, personIds, driveIds) => {
        setWizard(null);
        const emails = emailsFor(personIds);
        const targets = driveIds.map(driveById).filter(Boolean);
        if (!emails.length || !targets.length) return;
        const skipped = []; const failed = []; let applied = 0;
        for (let i = 0; i < targets.length; i++) {
            const d = targets[i];
            setLoadingMsg(`Updating drive ${i + 1} of ${targets.length}…`);
            if (d.excluded) { emails.forEach((e) => skipped.push(`${resolve(e).name} — “${d.name}” is protected`)); continue; }
            // eslint-disable-next-line no-await-in-loop
            let members = await svc.listMembers(d.id).catch(() => d.members || []);
            for (const email of emails) {
                const existing = members.find((m) => samePerson(email, m.email));
                try {
                    if (mode === 'add') {
                        if (existing) { skipped.push(`${resolve(email).name} — already a member of “${d.name}”`); }
                        // eslint-disable-next-line no-await-in-loop
                        else { await svc.addMember(d.id, email); applied++; }
                    } else if (existing) {
                        // eslint-disable-next-line no-await-in-loop
                        await svc.removeMember(d.id, existing.permissionId); applied++;
                    } else skipped.push(`${resolve(email).name} — not on “${d.name}”`);
                } catch (err) {
                    failed.push(`${resolve(email).name} · ${d.name} — ${err.status === 403 ? 'permission denied — needs Workspace admin' : (err.message || 'failed')}`);
                }
            }
            // eslint-disable-next-line no-await-in-loop
            await refreshDrive(d.id);
        }
        setSelected([]);
        setLoadingMsg(null);
        await pushLog(mode === 'add' ? 'add' : 'remove', mode === 'add' ? 'Members added' : 'Members removed',
            `${actor} · ${applied} ${mode === 'add' ? 'added' : 'removed'} across ${targets.length} drive${targets.length === 1 ? '' : 's'}`, mode === 'add' ? 'ok' : 'bad');
        setResults({
            title: mode === 'add' ? 'Members added' : 'Members removed',
            summary: `${applied} membership${applied === 1 ? '' : 's'} ${mode === 'add' ? 'added' : 'removed'} · ${skipped.length} skipped${failed.length ? ` · ${failed.length} failed` : ''}`,
            skipped, failed,
        });
        showToast(`${applied} membership${applied === 1 ? '' : 's'} ${mode === 'add' ? 'added' : 'removed'}`, applied > 0 ? 'success' : undefined);
    };

    // ---------- derived ----------
    const driveMatches = (d) => {
        if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (driveFilter === 'Standard') return !d.excluded;
        if (driveFilter === 'Protected') return d.excluded;
        if (driveFilter === 'Empty') return (d.members || []).length === 0;
        return true;
    };
    const drivesFiltered = drives.filter(driveMatches).sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'members') return ((a.members || []).length - (b.members || []).length) * dir;
        return a.name.localeCompare(b.name) * dir;
    });
    const drivePages = pageCount(drivesFiltered.length);
    const driveRows = paginate(drivesFiltered, Math.min(drivePage, drivePages));
    const selectableShown = drivesFiltered.filter((d) => !d.excluded);
    const allShownSelected = selectableShown.length > 0 && selectableShown.every((d) => selected.includes(d.id));

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

    const logMap = { Created: 'create', Added: 'add', Removed: 'remove', Directory: 'directory' };
    const logRows = log.filter((e) => logFilter === 'All' || e.type === logMap[logFilter]);

    const resetPage = () => { setDrivePage(1); setMemberPage(1); };
    const go = (v) => { setView(v); setSearch(''); resetPage(); };

    const Pager = ({ total, pages, page, setPage }) => (total <= PAGE ? null : (
        <div className="sdm-pager">
            <span>{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} of {total}</span>
            <div className="sdm-pager-btns">
                <button className="sdm-pgbtn" disabled={page <= 1} onClick={() => setPage(page - 1)}><FontAwesomeIcon icon={faChevronLeft} /></button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <button key={n} className={`sdm-pgbtn${n === page ? ' on' : ''}`} onClick={() => setPage(n)}>{n}</button>)}
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
                {view === 'drives' && (
                    <>
                        <div className="sdm-head">
                            <div><h1>Shared Drives</h1><p>Browse, search and manage access across every shared drive.</p></div>
                            {connected && (
                                <div className="sdm-head-actions">
                                    <button className="sdm-btn sdm-btn-dark" onClick={() => setWizard({ mode: 'add' })}><FontAwesomeIcon icon={faUserPlus} /> Add members</button>
                                    <button className="sdm-btn sdm-btn-yellow" onClick={() => setCreateOpen(true)}><FontAwesomeIcon icon={faFolderPlus} /> Create drive</button>
                                </div>
                            )}
                        </div>

                        {!configured ? (
                            <div className="sdm-empty"><FontAwesomeIcon icon={faRightToBracket} size="2x" /><h3>Google Drive isn’t configured</h3><p>Set <code>REACT_APP_GOOGLE_CLIENT_ID</code> (see supabase/SETUP.md) and reload.</p></div>
                        ) : !connected ? (
                            <div className="sdm-empty">
                                <FontAwesomeIcon icon={faRightToBracket} size="2x" />
                                <h3>Connect your Google account</h3>
                                <p>Sign in with a Workspace account that can manage shared drives to load live data.</p>
                                <button className="sdm-btn sdm-btn-yellow" onClick={connectGoogle} disabled={connecting}><FontAwesomeIcon icon={faRightToBracket} /> {connecting ? 'Connecting…' : 'Connect Google'}</button>
                            </div>
                        ) : (
                            <>
                                <div className="sdm-toolbar">
                                    <div className="sdm-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input placeholder="Search drives by name" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} /></div>
                                    <div><span className="sdm-sortlabel">Sort</span><span className="sdm-seg"><SortBtn k="name" label="Name" /><SortBtn k="members" label="Members" /></span></div>
                                </div>
                                <div className="sdm-filterrow"><span className="sdm-filterlabel">Filter</span><span className="sdm-seg">{['All', 'Standard', 'Protected', 'Empty'].map((f) => <button key={f} className={driveFilter === f ? 'on' : ''} onClick={() => { setDriveFilter(f); resetPage(); }}>{f}</button>)}</span></div>

                                {selected.length > 0 && (
                                    <div className="sdm-bulk">
                                        <span className="ct">{selected.length} drive{selected.length === 1 ? '' : 's'} selected</span>
                                        <button className="sdm-btn sdm-btn-yellow sm sp" onClick={() => setWizard({ mode: 'add', contextDriveIds: selected })}><FontAwesomeIcon icon={faUserPlus} /> Add members</button>
                                        <button className="sdm-btn sdm-btn-ondark sm" onClick={() => setWizard({ mode: 'remove', contextDriveIds: selected })}>Remove members</button>
                                        <button className="sdm-btn sdm-btn-ondark sm" onClick={() => setSelected([])}>Clear</button>
                                    </div>
                                )}

                                {drivesFiltered.length === 0 ? (
                                    <div className="sdm-empty"><FontAwesomeIcon icon={faFolder} size="2x" /><h3>No drives found</h3><p>{search || driveFilter !== 'All' ? 'Try a different search or filter.' : 'Create your first shared drive.'}</p></div>
                                ) : (
                                    <div className="sdm-card">
                                        <div className="sdm-row sdm-drives-grid sdm-thead">
                                            <span><input type="checkbox" className="sdm-check" checked={allShownSelected} onChange={() => setSelected(allShownSelected ? selected.filter((id) => !selectableShown.some((d) => d.id === id)) : [...new Set([...selected, ...selectableShown.map((d) => d.id)])])} /></span>
                                            <span>DRIVE</span><span>MEMBERS</span><span>LAST ACTIVITY</span><span>ACTIONS</span>
                                        </div>
                                        {driveRows.map((d) => {
                                            const mem = (d.members || []).map((m) => resolve(m.email));
                                            return (
                                                <div className="sdm-row sdm-drives-grid sdm-trow" key={d.id}>
                                                    <span>{d.excluded ? <FontAwesomeIcon icon={faLock} className="sdm-lock" /> : <input type="checkbox" className="sdm-check" checked={selected.includes(d.id)} onChange={() => setSelected((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]))} />}</span>
                                                    <div className="sdm-cell"><span className="sdm-tile-ico"><FontAwesomeIcon icon={faFolder} /></span><div style={{ minWidth: 0 }}><div className="sdm-name">{d.name}</div>{d.excluded && <span className="sdm-chip sdm-chip-protected">Protected</span>}</div></div>
                                                    <div className="sdm-cell"><span className="sdm-stack">{mem.slice(0, 3).map((m) => <Avatar key={m.id} person={m} />)}</span><span className="sdm-sub">{mem.length} member{mem.length === 1 ? '' : 's'}</span></div>
                                                    <span className="sdm-sub">—</span>
                                                    <div className="sdm-cell"><button className="sdm-btn sdm-btn-outline sm" onClick={() => setPanel({ type: 'drive', id: d.id })}>View members</button>{!d.excluded && <button className="sdm-iconbtn add" title="Add member" onClick={() => setWizard({ mode: 'add', contextDriveId: d.id })}><FontAwesomeIcon icon={faPlus} /></button>}</div>
                                                </div>
                                            );
                                        })}
                                        <Pager total={drivesFiltered.length} pages={drivePages} page={Math.min(drivePage, drivePages)} setPage={setDrivePage} />
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {view === 'members' && (
                    <>
                        <div className="sdm-head"><div><h1>Members Directory</h1><p>The reusable people list — separate from who’s on each drive.</p></div><div className="sdm-head-actions"><button className="sdm-btn sdm-btn-yellow" onClick={() => setAddPersonOpen(true)}><FontAwesomeIcon icon={faUserPlus} /> Add member</button></div></div>
                        <div className="sdm-toolbar"><div className="sdm-search" style={{ width: 340 }}><FontAwesomeIcon icon={faMagnifyingGlass} /><input placeholder="Search people by name or email" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} /></div><div><span className="sdm-filterlabel">Filter</span><span className="sdm-seg">{['All', 'On drives', 'No access'].map((f) => <button key={f} className={memberFilter === f ? 'on' : ''} onClick={() => { setMemberFilter(f); resetPage(); }}>{f}</button>)}</span></div></div>
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
                                        <span className="sdm-sub">{connected ? `in ${memberCount(p)} drive${memberCount(p) === 1 ? '' : 's'}` : '—'}</span>
                                        <div className="sdm-cell">
                                            <button className="sdm-btn sdm-btn-outline sm" disabled={!connected} onClick={() => setPanel({ type: 'person', id: p.id })}>View drives</button>
                                            <button className="sdm-iconbtn del" title="Remove from directory" onClick={() => setConfirm({ title: 'Remove from directory?', message: `Remove ${p.name} from the members directory?`, confirmLabel: 'Remove', destructive: true, option: connected ? 'Also remove from all shared drives' : null, onConfirm: (also) => removePersonFromDirectory(p, also) })}><FontAwesomeIcon icon={faTrash} /></button>
                                        </div>
                                    </div>
                                ))}
                                <Pager total={membersFiltered.length} pages={memberPages} page={Math.min(memberPage, memberPages)} setPage={setMemberPage} />
                            </div>
                        )}
                    </>
                )}

                {view === 'activity' && (
                    <>
                        <div className="sdm-head"><div><h1>Activity Log</h1><p>Every change to drives and access, most recent first.</p></div></div>
                        <div className="sdm-filterrow"><span className="sdm-seg">{['All', 'Created', 'Added', 'Removed', 'Directory'].map((f) => <button key={f} className={logFilter === f ? 'on' : ''} onClick={() => setLogFilter(f)}>{f}</button>)}</span></div>
                        <div className="sdm-card">
                            {logRows.length === 0 ? <div className="sdm-empty" style={{ border: 'none' }}><p>No activity yet.</p></div> : logRows.map((e) => (
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

            {panel?.type === 'drive' && driveById(panel.id) && (
                <DriveMembersPanel drive={driveById(panel.id)} directory={people} onClose={() => setPanel(null)}
                    onAdd={() => { const id = panel.id; setPanel(null); setWizard({ mode: 'add', contextDriveId: id }); }}
                    onRemove={(m) => removeMemberFromDrive(panel.id, m.email)} />
            )}
            {panel?.type === 'person' && people.find((p) => p.id === panel.id) && (
                <PersonDrivesPanel person={people.find((p) => p.id === panel.id)} drives={drives} onClose={() => setPanel(null)}
                    onAddToDrives={() => { const id = panel.id; setPanel(null); setWizard({ mode: 'add', lockPeople: [id] }); }}
                    onRemoveFromDrive={(d) => removeMemberFromDrive(d.id, people.find((p) => p.id === panel.id).email)} />
            )}
            {wizard && (
                <MemberWizard mode={wizard.mode} people={people} drives={drives} contextDriveId={wizard.contextDriveId} contextDriveIds={wizard.contextDriveIds} lockPeople={wizard.lockPeople}
                    onCancel={() => setWizard(null)} onConfirm={(pids, dids) => runBulk(wizard.mode, pids, dids)} />
            )}
            {createOpen && <CreateDriveModal existingNames={drives.map((d) => d.name)} people={people} defaultMemberIds={[]} onCancel={() => setCreateOpen(false)} onCreate={createDrive} />}
            {addPersonOpen && <AddMemberModal existingEmails={people.map((p) => p.email)} onCancel={() => setAddPersonOpen(false)} onAdd={addPerson} />}
            {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}
            {results && <ResultsModal results={results} onClose={() => setResults(null)} />}
            {loadingMsg && <LoadingOverlay message={loadingMsg} />}
        </div>
    );
};

export default SharedDriveManager;
