import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboardCheck, faPlay, faStop, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../../components/Toast';
import { runAudit, CHECKS, SCAN_CHECKS } from './audit';
import { createAuditRunner, resumeTargets } from './auditRunner';
import { listDriveTree, listAuditEvents, connect, connectSilent, hasReportsScope, tokenExpiresIn } from './googleDrive';
import { listAllClients, isAlgoliaConfigured } from './algolia';
import { saveAuditRun, loadLatestAuditRun, relative, AUDIT_ACTIVITY_DAYS, AUDIT_PROJECT_ITEM_LIMIT } from './service';

// Audit tab for the Shared Drive Manager. Seven hygiene checks, each with its own Run/Stop;
// several can run at once sharing one drive scan (see auditRunner.js); "Run full audit" stops
// everything and runs all seven into a fresh run row. The latest run is loaded on open.
// Spec: docs/superpowers/specs/2026-10-02-shared-drive-audit-design.md

const n = (x) => Number(x || 0).toLocaleString();
const MIN_TOKEN_MS = 15 * 60e3;   // refresh the Google token before a job if it has less than this left
const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
const empty = { rows: [], total: 0 };
const list = (results, key) => (results && results[key]) || empty;
const findingsCount = (results) => ['unknownClients', 'looseItems', 'nonStandardProjects', 'oversizedProjects', 'deletions', 'unclassifiedDrives', 'errors']
    .reduce((sum, k) => sum + list(results, k).total, 0)
    + list(results, 'driveCaps').rows.filter((d) => d.level !== 'ok').length;

// One collapsible check panel: title, count chip, per-check Run/Stop + status, notice, table.
const Panel = ({ title, data, columns, notice, open, render, check, onRun, onStop, canRun }) => {
    const status = check ? check.status : null;
    const label = !check ? null
        : status === 'running' ? (check.scanningName ? `Scanning ${check.scanningName}…` : 'Running…')
            : status === 'stopping' ? 'Stopping…'
                : check.incomplete ? check.incomplete
                    : check.checkedAt ? `checked ${relative(check.checkedAt)}` : 'never run';
    return (
        <details className="sdm-audit-panel" open={open}>
            <summary>
                <span className="sdm-audit-title">{title}</span>
                {label && <span className={`sdm-audit-status${status !== 'idle' ? ' live' : ''}`}>{label}</span>}
                <span className={`sdm-chip ${data.total ? 'sdm-chip-count' : 'sdm-chip-role'}`}>{n(data.total)}</span>
                {check && (status === 'idle'
                    ? <button className="sdm-btn sdm-btn-outline sm" disabled={!canRun} onClick={(e) => { e.preventDefault(); onRun(); }}><FontAwesomeIcon icon={faPlay} /> Run</button>
                    : <button className="sdm-btn sdm-btn-outline sm" disabled={status === 'stopping'} onClick={(e) => { e.preventDefault(); onStop(); }}><FontAwesomeIcon icon={faStop} /> Stop</button>)}
            </summary>
            {notice && <div className="sdm-note sdm-audit-notice"><FontAwesomeIcon icon={faTriangleExclamation} /> {notice}</div>}
            {!notice && data.rows.length === 0 && <div className="sdm-note sdm-audit-notice">Nothing found.</div>}
            {data.rows.length > 0 && (
                <div className="sdm-audit-table" style={{ gridTemplateColumns: columns.map((c) => c.w || '1fr').join(' ') }}>
                    {columns.map((c) => <span key={c.h} className="sdm-audit-th">{c.h}</span>)}
                    {data.rows.map((row, i) => render(row, i))}
                </div>
            )}
            {data.rows.length < data.total && <div className="sdm-note sdm-audit-notice">showing {n(data.rows.length)} of {n(data.total)}</div>}
        </details>
    );
};
const Cell = ({ children, className = '', title }) => <span className={`sdm-audit-td ${className}`} title={title}>{children}</span>;

const AuditView = ({ connected, drives, knownActors, actor, onCount }) => {
    const showToast = useToast();
    const [snap, setSnap] = useState({ run: null, checks: {}, progress: null, anyRunning: false });
    const storageWarned = useRef(false);
    const latest = useRef({ drives, knownActors, actor });
    latest.current = { drives, knownActors, actor };

    // One runner for the life of the tab. It reads drives/actor through `latest` so the
    // props it was created with can't go stale.
    const runner = useMemo(() => createAuditRunner({
        runAudit,
        get drives() { return latest.current.drives; },
        get knownActors() { return latest.current.knownActors; },
        get actor() { return latest.current.actor; },
        deps: {
            listDriveTree, listAuditEvents,
            listAllClients: () => (isAlgoliaConfigured() ? listAllClients() : Promise.reject(new Error('Algolia not configured'))),
        },
        persist: async (row) => {
            try { return await saveAuditRun(row); } catch (e) {
                if (!storageWarned.current) { storageWarned.current = true; showToast('Could not save audit progress — results stay on screen', 'error'); }
                return { id: row.id || null };
            }
        },
        onChange: setSnap,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);

    useEffect(() => { loadLatestAuditRun().then((r) => { if (r) runner.load(r); }).catch(() => {}); }, [runner]);
    const { run, checks, progress, anyRunning } = snap;
    useEffect(() => { if (onCount) onCount(run ? findingsCount(run.results) : null); }, [run, onCount]);

    // A scan can outlive a token restored from sessionStorage: top it up before any job starts,
    // silently if possible, else with the (user-gesture) popup.
    const freshToken = async () => {
        if (tokenExpiresIn() >= MIN_TOKEN_MS) return true;
        try { if (!(await connectSilent())) await connect(); return true; }
        catch (e) { showToast(e.message || 'Google sign-in failed', 'error'); return false; }
    };
    const runCheck = async (key) => { if (connected && await freshToken()) runner.run([key]); };
    const runFull = async () => { if (connected && await freshToken()) runner.runFull(); };
    // Click handlers (user gestures), so reconnecting may open the Google popup if needed.
    const continueScan = async () => { if (connected && await freshToken()) runner.resume(); };
    const scanOne = async (id) => { if (connected && await freshToken()) runner.scanDrives([id]); };

    const results = run ? run.results : {};
    const algoliaOk = isAlgoliaConfigured();
    const scopeMissing = connected && !hasReportsScope();
    const reportsNotice = scopeMissing
        ? 'Reconnect Google to grant audit access (the activity scope was added after you connected).'
        : run && run.reports_available === false ? 'The connected Google account needs Workspace admin reports access for this check.' : null;
    const lastCreatedNotice = reportsNotice || (results.lastCreatedScope === 'allFolders'
        ? 'No drive scan available, so this counts every folder created on a shared drive, not only project folders. Run any scan check first for project-level accuracy.' : null);
    const reconnect = async () => { try { await connect(); setSnap((s) => ({ ...s })); } catch (e) { showToast(e.message || 'Google sign-in failed', 'error'); } };
    const pct = progress ? Math.round((progress.driveIndex / Math.max(1, progress.driveTotal)) * 100) : 0;
    // Scan coverage: an interrupted scan (reload, closed tab, crash) leaves rows for the drives
    // it reached but never stamps checkedAt — say so instead of "never run".
    const cov = results.scanCoverage;
    const covIncomplete = !!cov && cov.done < cov.total;
    const lastReached = covIncomplete && cov.done > 0 ? (drives.find((d) => d.id === cov.driveIds[cov.done - 1]) || {}).name : null;
    const notScanned = covIncomplete ? drives.filter((d) => !cov.driveIds.includes(d.id)) : [];
    const paused = !!cov && !!cov.pausedForAuth;
    const failedDrives = list(results, 'errors').rows.filter((e) => e.source === 'scan' && e.kind === 'listFailed');
    const targets = run ? resumeTargets(results, drives) : [];
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    // Drive list for the item-cap panel: every drive (scanned or not) with its latest result.
    const capByDrive = new Map(list(results, 'driveCaps').rows.map((r) => [r.driveId, r]));
    const driveScans = results.driveScans || {};
    const driveRows = (drives.length ? drives : list(results, 'driveCaps').rows.map((r) => ({ id: r.driveId, name: r.drive })))
        .map((d) => ({ d, cap: capByDrive.get(d.id), s: driveScans[d.id] }));
    // Scan queue state from the runner: the drive being listed now, drives waiting (rest of
    // the running scan, then the queue), and which of those the user can unqueue.
    const currentDriveId = snap.currentDriveId || null;
    const pendingIds = new Set(snap.pendingDriveIds || []);
    const queuedIds = new Set(snap.queuedDriveIds || []);
    const currentDriveName = currentDriveId ? ((drives.find((d) => d.id === currentDriveId) || {}).name || null) : null;
    const check = (key) => {
        const c = checks[key] || { status: 'idle', checkedAt: null };
        const named = SCAN_CHECKS.includes(key) && c.status === 'running' && currentDriveName ? { ...c, scanningName: currentDriveName } : c;
        const stale = SCAN_CHECKS.includes(key) && covIncomplete && (!c.checkedAt || c.checkedAt < cov.at);
        return stale ? { ...named, incomplete: `incomplete · ${cov.done}/${cov.total} drives · ${relative(cov.at)}` } : named;
    };
    // Header: drives that have results (coverage), not the drives this particular run finished.
    const withResults = cov ? cov.done : Math.max((run && run.drives_done) || 0, list(results, 'driveCaps').rows.length);
    const totalDrives = (cov && cov.total) || drives.length || (run && run.drives_total) || 0;
    const driveCount = totalDrives ? ` · ${withResults}/${totalDrives} drives` : '';
    const headerLine = !run ? 'No audit has been run yet. Run a single check from its panel, or the full audit.'
        : anyRunning ? `Audit running${currentDriveName ? ` · scanning ${currentDriveName}` : ''}${driveCount}${totalDrives ? ' have results' : ''}`
            : `Last run ${relative(run.started_at)} by ${run.actor || 'unknown'} · ${run.status}${driveCount}`;
    const panelProps = (key) => ({ check: check(key), canRun: connected, onRun: () => runCheck(key), onStop: () => runner.stop(key) });
    const titles = Object.fromEntries(CHECKS.map((c) => [c.key, c.label]));

    return (
        <>
            <div className="sdm-head">
                <div>
                    <h1>Drive audit</h1>
                    <p>{headerLine}</p>
                </div>
                <div className="sdm-head-actions">
                    <button className="sdm-btn sdm-btn-yellow" onClick={runFull} disabled={!connected} title={connected ? '' : 'Connect Google on the Shared Drives tab first'}>
                        <FontAwesomeIcon icon={anyRunning ? faStop : faPlay} /> {anyRunning ? 'Stop all and run full audit' : 'Run full audit'}
                    </button>
                </div>
            </div>

            {scopeMissing && (
                <div className="sdm-card sdm-audit-progress sdm-audit-scope">
                    <div className="sdm-sub"><FontAwesomeIcon icon={faTriangleExclamation} /> The deletions and last-created checks need a Google permission that was added after you connected.</div>
                    <button className="sdm-btn sdm-btn-outline sm" onClick={reconnect}>Reconnect Google to grant audit access</button>
                </div>
            )}

            {!anyRunning && (covIncomplete || targets.length > 0) && (
                <div className="sdm-card sdm-audit-progress sdm-audit-scope">
                    <div className="sdm-sub"><FontAwesomeIcon icon={faTriangleExclamation} /> {paused
                        ? `Your Google sign-in expired after ${cov.done} of ${cov.total} drives, ${relative(cov.at)}. Reconnect to scan the remaining ${plural(targets.length, 'drive')}; nothing already found is lost.`
                        : covIncomplete && cov.mode === 'subset'
                            ? `${cov.done} of ${cov.total} drives have been scanned so far.${failedDrives.length ? ` ${plural(failedDrives.length, 'drive')} failed to scan.` : ''}`
                        : covIncomplete
                            ? `The last scan stopped after ${cov.done} of ${cov.total} drives${lastReached ? ` (last reached: ${lastReached})` : ''}, ${relative(cov.at)}. The page was probably reloaded or closed while it ran.${failedDrives.length ? ` ${plural(failedDrives.length, 'drive')} also failed to scan.` : ''}`
                            : `${plural(failedDrives.length, 'drive')} failed to scan (Google rate limit or an expired sign-in). Details are under Notes.`}</div>
                    {targets.length > 0 && (
                        <button className="sdm-btn sdm-btn-yellow sm" onClick={continueScan} disabled={!connected}>
                            <FontAwesomeIcon icon={faPlay} /> {paused ? 'Reconnect and continue' : `Continue scan (${plural(targets.length, 'drive')})`}
                        </button>
                    )}
                </div>
            )}

            {anyRunning && (
                <div className="sdm-card sdm-audit-progress">
                    <div className="sdm-progress"><div className="sdm-progress-fill" style={{ width: `${pct}%` }} /></div>
                    <div className="sdm-sub">{progress
                        ? `Drive ${progress.driveIndex} of ${progress.driveTotal} · ${progress.driveName} · ${n(progress.items)} items${progress.partial ? ' so far' : ''}`
                        : check('deletions').status !== 'idle' || check('lastCreated').status !== 'idle' ? 'Fetching activity from the Reports API…' : 'Fetching the master client list…'}</div>
                </div>
            )}

            {!connected && !run && (
                <div className="sdm-empty"><FontAwesomeIcon icon={faClipboardCheck} size="2x" /><h3>Connect Google to run an audit</h3><p>Use the Shared Drives tab to connect, then come back here.</p></div>
            )}

            <Panel title={titles.unknownClients} open data={list(results, 'unknownClients')} {...panelProps('unknownClients')}
                notice={!algoliaOk ? 'Algolia not configured — set REACT_APP_ALGOLIA_APP_ID and REACT_APP_ALGOLIA_SEARCH_KEY (see supabase/SETUP.md §5c).' : null}
                columns={[{ h: 'DRIVE', w: '110px' }, { h: 'CLIENT FOLDER' }, { h: 'CLOSEST ESE REFERENCE' }]}
                render={(r) => (
                    <React.Fragment key={r.folderId}>
                        <Cell>{r.drive}</Cell>
                        <Cell className="sdm-audit-strong">{r.client}</Cell>
                        <Cell className="sdm-sub">{r.closest ? `closest: ${r.closest.title} (${Math.round(r.closest.score * 100)}%)` : '—'}</Cell>
                    </React.Fragment>
                )} />

            <Panel title={titles.looseItems} data={list(results, 'looseItems')} {...panelProps('looseItems')}
                columns={[{ h: 'DRIVE', w: '110px' }, { h: 'FILES', w: '90px' }, { h: 'SAMPLE' }]}
                render={(r) => (
                    <React.Fragment key={r.drive}>
                        <Cell>{r.drive}</Cell>
                        <Cell className="sdm-audit-strong">{n(r.count)}</Cell>
                        <Cell className="sdm-sub" title={(r.samples || []).join('\n')}>{(r.samples || []).join(', ')}</Cell>
                    </React.Fragment>
                )} />

            <Panel title={titles.nonStandardProjects} data={list(results, 'nonStandardProjects')} {...panelProps('nonStandardProjects')}
                columns={[{ h: 'DRIVE', w: '110px' }, { h: 'CLIENT' }, { h: 'PROJECT FOLDER' }]}
                render={(r) => (
                    <React.Fragment key={r.folderId}>
                        <Cell>{r.drive}</Cell>
                        <Cell>{r.client}</Cell>
                        <Cell className="sdm-audit-strong">{r.name}</Cell>
                    </React.Fragment>
                )} />

            <Panel title={`Projects over ${n(AUDIT_PROJECT_ITEM_LIMIT)} items`} data={list(results, 'oversizedProjects')} {...panelProps('oversizedProjects')}
                columns={[{ h: 'DRIVE', w: '110px' }, { h: 'CLIENT' }, { h: 'PROJECT FOLDER' }, { h: 'ITEMS', w: '100px' }]}
                render={(r) => (
                    <React.Fragment key={r.folderId}>
                        <Cell>{r.drive}</Cell>
                        <Cell>{r.client}</Cell>
                        <Cell className="sdm-audit-strong">{r.name}</Cell>
                        <Cell className="sdm-audit-strong">{n(r.count)}</Cell>
                    </React.Fragment>
                )} />

            <Panel title="Drive item cap (500,000)" data={{ rows: driveRows, total: list(results, 'driveCaps').total }} {...panelProps('driveCaps')}
                columns={[{ h: 'DRIVE' }, { h: 'ITEMS', w: '100px' }, { h: 'TRASHED', w: '90px' }, { h: 'STATUS', w: '1.2fr' }, { h: 'LAST SCANNED', w: '120px' }, { h: 'SCAN', w: '84px' }]}
                render={({ d, cap, s }) => {
                    const lvl = cap ? cap.level : '';
                    const scanningNow = currentDriveId === d.id;
                    const pending = !scanningNow && pendingIds.has(d.id);
                    const statusText = scanningNow ? 'Scanning…'
                        : pending ? 'Queued'
                        : cap ? (cap.level === 'ok' ? 'OK' : cap.level === 'warn' ? 'Warning' : 'Critical')
                            : s && s.status === 'listFailed' ? `Failed — ${s.message || 'could not list'}`
                                : s && s.status === 'notMember' ? 'Not a member'
                                    : 'Not scanned';
                    return (
                        <div key={d.id} data-drive-row style={{ display: 'contents' }}>
                            <Cell className={`sdm-audit-strong sdm-audit-row ${lvl}`}>{d.name}</Cell>
                            <Cell className={`sdm-audit-row ${lvl}`}>{cap ? n(cap.total) : '—'}</Cell>
                            <Cell className={`sdm-sub sdm-audit-row ${lvl}`}>{cap ? n(cap.trashed) : '—'}</Cell>
                            <Cell className={`sdm-audit-row ${lvl}${s && s.status === 'listFailed' && !cap ? ' sdm-audit-bad' : ''}`} title={s && s.message ? s.message : undefined}>{statusText}</Cell>
                            <Cell className={`sdm-sub sdm-audit-row ${lvl}`}>{s && s.at ? relative(s.at) : '—'}</Cell>
                            <span className={`sdm-audit-td sdm-audit-row ${lvl}`}>
                                {scanningNow
                                    ? <button type="button" className="sdm-btn sdm-btn-outline sm" aria-label={`Scanning ${d.name}`} disabled>Scanning</button>
                                    : queuedIds.has(d.id)
                                        ? <button type="button" className="sdm-btn sdm-btn-outline sm" aria-label={`Unqueue ${d.name}`} title="Remove from the queue" onClick={() => runner.unqueue(d.id)}>Unqueue</button>
                                        : pending
                                            ? <button type="button" className="sdm-btn sdm-btn-outline sm" aria-label={`Queued ${d.name}`} disabled title="The running scan will reach this drive">Waiting</button>
                                            : <button type="button" className="sdm-btn sdm-btn-outline sm" aria-label={`Scan ${d.name}`} disabled={!connected} title={anyRunning ? 'Added to the queue; scans run one at a time' : ''} onClick={() => scanOne(d.id)}>Scan</button>}
                            </span>
                        </div>
                    );
                }} />

            <Panel title={`Folder deletions (last ${AUDIT_ACTIVITY_DAYS} days)`} data={list(results, 'deletions')} notice={reportsNotice} {...panelProps('deletions')}
                columns={[{ h: 'WHEN', w: '170px' }, { h: 'WHO' }, { h: 'DRIVE', w: '110px' }, { h: 'FOLDER' }]}
                render={(r, i) => (
                    <React.Fragment key={`${r.docId}-${i}`}>
                        <Cell className="sdm-sub">{when(r.when)}</Cell>
                        <Cell>{r.actor}</Cell>
                        <Cell>{r.driveName || '—'}</Cell>
                        <Cell className="sdm-audit-strong sdm-audit-bad">{r.docTitle}</Cell>
                    </React.Fragment>
                )} />

            <Panel title={`Staff — last project created (last ${AUDIT_ACTIVITY_DAYS} days)`} data={list(results, 'lastCreated')} notice={lastCreatedNotice} {...panelProps('lastCreated')}
                columns={[{ h: 'STAFF' }, { h: 'LAST CREATED', w: '170px' }, { h: 'PROJECT' }, { h: 'DRIVE', w: '110px' }, { h: 'IN WINDOW', w: '100px' }]}
                render={(r) => (
                    <React.Fragment key={r.actor}>
                        <Cell className="sdm-audit-strong">{r.actor}</Cell>
                        <Cell className="sdm-sub">{r.lastCreatedAt ? when(r.lastCreatedAt) : `none in ${AUDIT_ACTIVITY_DAYS} days`}</Cell>
                        <Cell>{r.lastProject || '—'}</Cell>
                        <Cell>{r.driveName || '—'}</Cell>
                        <Cell>{n(r.countInWindow)}</Cell>
                    </React.Fragment>
                )} />

            <Panel title="Notes (unclassified drives + errors)" data={{ rows: [...notScanned.map((d) => ({ k: `n-${d.id}`, a: d.name, b: 'Not scanned — the last scan stopped before reaching this drive' })), ...list(results, 'unclassifiedDrives').rows.map((d) => ({ k: `u-${d.driveId}`, a: d.drive, b: 'Not in AUDIT_DRIVE_ROOTS or AUDIT_EXCLUDED_DRIVES — counted for the item cap only' })), ...list(results, 'errors').rows.map((e, i) => ({ k: `e-${i}`, a: e.drive, b: e.message }))], total: notScanned.length + list(results, 'unclassifiedDrives').total + list(results, 'errors').total }}
                columns={[{ h: 'DRIVE', w: '140px' }, { h: 'NOTE' }]}
                render={(r) => (
                    <React.Fragment key={r.k}>
                        <Cell className="sdm-audit-strong">{r.a}</Cell>
                        <Cell className="sdm-sub">{r.b}</Cell>
                    </React.Fragment>
                )} />
        </>
    );
};

export default AuditView;
