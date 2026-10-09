// Tests for the audit job runner: per-check runs, a shared scan job, stop rules, full audit.
// runAudit and persistence are injected fakes — no React, no network.
jest.mock('../../lib/supabase', () => ({ supabase: null }));

import { createAuditRunner, resumeTargets } from './auditRunner';
import { emptyResults } from './audit';

const DRIVES = [{ id: 'a', name: '_A' }];
const results = (over = {}) => ({ ...emptyResults(), ...over });
const rows = (arr) => ({ rows: arr, total: arr.length });
const tick = () => new Promise((r) => setTimeout(r, 0));

// A controllable fake runAudit: records calls, lets the test resolve each one.
const makeRunAudit = () => {
    const calls = [];
    const fn = jest.fn((args) => new Promise((resolve) => { calls.push({ args, resolve }); }));
    return { fn, calls };
};
const make = (over = {}) => {
    const ra = makeRunAudit();
    const persist = jest.fn(async (row) => ({ id: row.id || 'r1' }));
    const changes = [];
    const runner = createAuditRunner({
        runAudit: ra.fn, deps: {}, drives: DRIVES, knownActors: [], actor: 'Shivam', persist,
        onChange: (s) => changes.push(s), now: () => new Date('2026-10-02T10:00:00Z'), ...over,
    });
    return { runner, ra, persist, changes };
};
const scanOut = (over = {}) => ({ status: 'complete', reportsAvailable: null, drivesDone: 1, projectFolderIds: new Set(['p1']), lastCreatedScope: null, results: results(over) });
const reportsOut = (over = {}, scope = 'allFolders') => ({ status: 'complete', reportsAvailable: true, drivesDone: 0, projectFolderIds: new Set(), lastCreatedScope: scope, results: results(over) });

test('a single scan check starts one scan-only job and commits only that check', async () => {
    const { runner, ra, persist } = make();
    runner.run(['nonStandardProjects']);
    await tick();
    expect(ra.calls).toHaveLength(1);
    expect(ra.calls[0].args.stages).toEqual({ scan: true, reports: false });
    expect(runner.snapshot().checks.nonStandardProjects.status).toBe('running');
    expect(runner.snapshot().checks.driveCaps.status).toBe('idle');
    ra.calls[0].resolve(scanOut({
        nonStandardProjects: rows([{ drive: '_A', client: 'ARTC', name: 'Bad', folderId: 'b' }]),
        driveCaps: rows([{ drive: '_A', driveId: 'a', total: 7, trashed: 0, level: 'ok' }]),
    }));
    await tick();
    const s = runner.snapshot();
    expect(s.run.results.nonStandardProjects.total).toBe(1);
    expect(s.run.results.driveCaps.total).toBe(0);                       // not subscribed → untouched
    expect(s.checks.nonStandardProjects).toMatchObject({ status: 'idle', checkedAt: '2026-10-02T10:00:00.000Z' });
    expect(s.run.results.checkedAt).toEqual({ nonStandardProjects: '2026-10-02T10:00:00.000Z' });
    expect(s.run.status).toBe('complete');
    expect(s.anyRunning).toBe(false);
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'r1', status: 'complete' }));
});

test('a second scan check started while a scan runs joins the same job', async () => {
    const { runner, ra } = make();
    runner.run(['nonStandardProjects']);
    await tick();
    runner.run(['oversizedProjects']);
    await tick();
    expect(ra.calls).toHaveLength(1);
    expect(runner.snapshot().checks.oversizedProjects.status).toBe('running');
    ra.calls[0].resolve(scanOut({
        nonStandardProjects: rows([{ drive: '_A', client: 'ARTC', name: 'Bad', folderId: 'b' }]),
        oversizedProjects: rows([{ drive: '_A', client: 'ARTC', name: 'Big', folderId: 'g', count: 5000 }]),
    }));
    await tick();
    expect(runner.snapshot().run.results.oversizedProjects.total).toBe(1);
    expect(runner.snapshot().run.results.nonStandardProjects.total).toBe(1);
});

test('a report check starts a reports-only job, independent of a running scan', async () => {
    const { runner, ra } = make();
    runner.run(['driveCaps']);
    await tick();
    runner.run(['deletions']);
    await tick();
    expect(ra.calls).toHaveLength(2);
    expect(ra.calls[1].args.stages).toEqual({ scan: false, reports: true });
    expect(ra.calls[1].args.priorProjectFolderIds).toBeNull();
    ra.calls[1].resolve(reportsOut({ deletions: rows([{ when: 't', actor: 'a', driveName: '_A', docTitle: 'X', docId: 'x' }]) }));
    await tick();
    expect(runner.snapshot().run.results.deletions.total).toBe(1);
    expect(runner.snapshot().checks.driveCaps.status).toBe('running');   // scan still going
    expect(runner.snapshot().anyRunning).toBe(true);
    ra.calls[0].resolve(scanOut());
    await tick();
    expect(runner.snapshot().anyRunning).toBe(false);
});

test('project ids from a finished scan are reused by a later reports-only run', async () => {
    const { runner, ra } = make();
    runner.run(['driveCaps']);
    await tick();
    ra.calls[0].resolve(scanOut());
    await tick();
    runner.run(['lastCreated']);
    await tick();
    expect([...ra.calls[1].args.priorProjectFolderIds]).toEqual(['p1']);
    ra.calls[1].resolve(reportsOut({}, 'projects'));
    await tick();
    expect(runner.snapshot().run.results.lastCreatedScope).toBe('projects');
});

test('stopping one of two subscribers keeps the scan alive; stopping the last cancels it', async () => {
    const { runner, ra } = make();
    runner.run(['nonStandardProjects', 'oversizedProjects']);
    await tick();
    runner.stop('nonStandardProjects');
    expect(ra.calls[0].args.shouldCancel()).toBe(false);
    expect(runner.snapshot().checks.nonStandardProjects.status).toBe('idle');
    expect(runner.snapshot().checks.oversizedProjects.status).toBe('running');
    runner.stop('oversizedProjects');
    expect(ra.calls[0].args.shouldCancel()).toBe(true);
    expect(runner.snapshot().checks.oversizedProjects.status).toBe('stopping');
    ra.calls[0].resolve({ ...scanOut({ nonStandardProjects: rows([{ drive: '_A', client: 'c', name: 'Bad', folderId: 'b' }]) }), status: 'partial' });
    await tick();
    // Nothing committed for stopped checks, no checkedAt, run marked partial.
    expect(runner.snapshot().run.results.nonStandardProjects.total).toBe(0);
    expect(runner.snapshot().run.results.checkedAt).toEqual({});
    expect(runner.snapshot().checks.oversizedProjects.status).toBe('idle');
    expect(runner.snapshot().run.status).toBe('partial');
});

test('runFull stops every running job first, then runs scan + reports with all checks', async () => {
    const { runner, ra, persist } = make();
    runner.run(['driveCaps']);
    runner.run(['deletions']);
    await tick();
    expect(ra.calls).toHaveLength(2);
    const full = runner.runFull();
    await tick();
    expect(ra.calls[0].args.shouldCancel()).toBe(true);
    expect(ra.calls[1].args.shouldCancel()).toBe(true);
    expect(ra.calls).toHaveLength(2);                 // nothing new until the old jobs wind down
    ra.calls[0].resolve({ ...scanOut(), status: 'partial' });
    ra.calls[1].resolve(reportsOut());
    await full;
    await tick();
    expect(ra.calls).toHaveLength(4);
    expect(ra.calls[2].args.stages).toEqual({ scan: true, reports: false });
    expect(ra.calls[3].args.stages).toEqual({ scan: false, reports: true });
    const s = runner.snapshot();
    expect(Object.values(s.checks).every((c) => c.status === 'running')).toBe(true);
    // A full audit starts a fresh run row.
    expect(persist.mock.calls.filter((c) => c[0].id === undefined)).toHaveLength(2);
    ra.calls[2].resolve(scanOut({ driveCaps: rows([{ drive: '_A', driveId: 'a', total: 1, trashed: 0, level: 'ok' }]) }));
    ra.calls[3].resolve(reportsOut());
    await tick();
    expect(s.run.id).toBe('r1');
    expect(runner.snapshot().run.status).toBe('complete');
    expect(Object.keys(runner.snapshot().run.results.checkedAt)).toHaveLength(7);
});

test('live per-drive progress commits subscribed scan checks and persists partial', async () => {
    const { runner, ra, persist, changes } = make();
    runner.run(['driveCaps']);
    await tick();
    const { onProgress, onPage } = ra.calls[0].args;
    onPage({ driveIndex: 1, driveTotal: 1, driveName: '_A', items: 500 });
    expect(runner.snapshot().progress).toMatchObject({ driveName: '_A', items: 500, partial: true });
    await onProgress({ driveIndex: 1, driveTotal: 1, driveName: '_A', items: 900, results: results({ driveCaps: rows([{ drive: '_A', driveId: 'a', total: 900, trashed: 0, level: 'ok' }]), looseItems: rows([{ drive: '_A', count: 3, samples: [] }]) }) });
    expect(runner.snapshot().run.results.driveCaps.total).toBe(1);
    expect(runner.snapshot().run.results.looseItems.total).toBe(0);
    expect(runner.snapshot().run.drives_done).toBe(1);
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'partial', drives_done: 1 }));
    expect(changes.length).toBeGreaterThan(0);
    ra.calls[0].resolve(scanOut());
    await tick();
});

test('scan errors and unclassified drives land in Notes; a reports job only replaces activity errors', async () => {
    const { runner, ra } = make();
    runner.run(['driveCaps']);
    await tick();
    ra.calls[0].resolve(scanOut({ errors: rows([{ drive: '_B', message: 'boom', source: 'scan' }]), unclassifiedDrives: rows([{ drive: 'Odd', driveId: 'o' }]) }));
    await tick();
    runner.run(['deletions']);
    await tick();
    ra.calls[1].resolve({ ...reportsOut({ errors: rows([{ drive: '*', message: 'Activity unavailable: quota', source: 'activity' }]) }), reportsAvailable: false });
    await tick();
    const r = runner.snapshot().run;
    expect(r.results.errors.rows.map((e) => e.message)).toEqual(['boom', 'Activity unavailable: quota']);
    expect(r.results.unclassifiedDrives.total).toBe(1);
    expect(r.reports_available).toBe(false);
});

test('a failing job marks its checks idle, records the error, and never throws', async () => {
    const { runner, ra } = make();
    runner.run(['driveCaps']);
    await tick();
    ra.calls[0].resolve(Promise.reject(new Error('token gone')));
    await tick(); await tick();
    const s = runner.snapshot();
    expect(s.checks.driveCaps.status).toBe('idle');
    expect(s.run.results.errors.rows[0].message).toMatch(/token gone/);
    expect(s.anyRunning).toBe(false);
});

test('reads drives / knownActors / actor at run time, not at creation time', async () => {
    // The view passes live getters; the runner must read them when a job starts.
    const ra = makeRunAudit();
    const live = { drives: [], knownActors: [], actor: 'nobody' };
    const persist = jest.fn(async (row) => ({ id: 'r1' }));
    const runner = createAuditRunner({
        runAudit: ra.fn, deps: {}, persist, onChange: () => {}, now: () => new Date('2026-10-02T10:00:00Z'),
        get drives() { return live.drives; }, get knownActors() { return live.knownActors; }, get actor() { return live.actor; },
    });
    live.drives = DRIVES; live.knownActors = ['a@engsurveys.com.au']; live.actor = 'Shivam';
    runner.run(['driveCaps']);
    await tick();
    expect(ra.calls[0].args.drives).toEqual(DRIVES);
    expect(ra.calls[0].args.knownActors).toEqual(['a@engsurveys.com.au']);
    expect(persist.mock.calls[0][0]).toMatchObject({ actor: 'Shivam', drives_total: 1 });
});

test('scan progress records coverage (drives reached, which ones, when) on the run row', async () => {
    const TWO = [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }];
    const { runner, ra, persist } = make({ drives: TWO });
    runner.run(['driveCaps']);
    await tick();
    await ra.calls[0].args.onProgress({ driveIndex: 1, driveTotal: 2, driveName: '_A', items: 5, results: results() });
    expect(runner.snapshot().run.results.scanCoverage).toEqual({ done: 1, total: 2, driveIds: ['a'], at: '2026-10-02T10:00:00.000Z', checks: ['driveCaps'], pausedForAuth: false, mode: 'full' });
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ results: expect.objectContaining({ scanCoverage: expect.objectContaining({ done: 1, total: 2 }) }) }));
    ra.calls[0].resolve({ ...scanOut(), drivesDone: 2 });
    await tick();
    expect(runner.snapshot().run.results.scanCoverage).toMatchObject({ done: 2, total: 2, driveIds: ['a', 'b'] });
});

test('a failed scan does not stamp its checks as checked (in memory or saved)', async () => {
    const { runner, ra } = make();
    runner.run(['driveCaps']);
    await tick();
    ra.calls[0].resolve(Promise.reject(new Error('tab ran out of memory')));
    await tick(); await tick();
    expect(runner.snapshot().checks.driveCaps.checkedAt).toBeNull();
    expect(runner.snapshot().run.results.checkedAt || {}).toEqual({});
});

test('resumeTargets = drives never reached + drives whose listing failed (not membership failures)', () => {
    const THREE = [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }, { id: 'c', name: '_C' }, { id: 'd', name: '_D' }];
    const r = results({
        errors: rows([
            { drive: '_B', message: 'User rate limit exceeded.', source: 'scan', kind: 'listFailed' },
            { drive: '_A', message: 'not a member', source: 'scan', kind: 'notMember' },
        ]),
        scanCoverage: { done: 3, total: 4, driveIds: ['a', 'b', 'c'], at: 't' },
    });
    expect(resumeTargets(r, THREE).map((d) => d.id)).toEqual(['b', 'd']);
    expect(resumeTargets(results(), THREE)).toEqual([]);
});

test('Continue scan rescans only the targets and merges into the same run', async () => {
    const THREE = [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }, { id: 'c', name: '_C' }];
    const { runner, ra } = make({ drives: THREE });
    runner.load({ id: 'r1', status: 'partial', drives_done: 2, drives_total: 3, results: results({
        driveCaps: rows([{ drive: '_A', driveId: 'a', total: 5, trashed: 0, level: 'ok' }]),
        errors: rows([{ drive: '_B', message: 'User rate limit exceeded.', source: 'scan', kind: 'listFailed' }, { drive: '*', message: 'x', source: 'activity' }]),
        scanCoverage: { done: 2, total: 3, driveIds: ['a', 'b'], at: 't', checks: ['driveCaps'] },
    }) });
    runner.resume();
    await tick();
    expect(ra.calls).toHaveLength(1);
    expect(ra.calls[0].args.drives.map((d) => d.id)).toEqual(['b', 'c']);
    expect(ra.calls[0].args.stages).toEqual({ scan: true, reports: false });
    expect(runner.snapshot().checks.driveCaps.status).toBe('running');
    ra.calls[0].resolve({ ...scanOut({ driveCaps: rows([{ drive: '_B', driveId: 'b', total: 7, trashed: 0, level: 'ok' }, { drive: '_C', driveId: 'c', total: 9, trashed: 0, level: 'ok' }]) }), drivesDone: 2 });
    await tick();
    const r = runner.snapshot().run.results;
    expect(r.driveCaps.rows.map((x) => x.drive)).toEqual(['_A', '_B', '_C']);
    expect(r.driveCaps.total).toBe(3);
    expect(r.errors.rows.map((e) => e.message)).toEqual(['x']);   // the rate-limit row is gone; activity notes kept
    expect(r.scanCoverage).toMatchObject({ done: 3, total: 3, driveIds: ['a', 'b', 'c'] });
    expect(r.checkedAt.driveCaps).toBe('2026-10-02T10:00:00.000Z');
    expect(runner.snapshot().run.id).toBe('r1');
    expect(runner.snapshot().run.status).toBe('complete');
});

test('an expired sign-in pauses the scan: nothing stamped, coverage records the pause', async () => {
    const { runner, ra } = make();
    runner.run(['driveCaps']);
    await tick();
    ra.calls[0].resolve({ ...scanOut(), status: 'partial', drivesDone: 0, pausedForAuth: true });
    await tick();
    expect(runner.snapshot().checks.driveCaps.checkedAt).toBeNull();
    expect(runner.snapshot().run.results.scanCoverage).toMatchObject({ pausedForAuth: true, done: 0, total: 1 });
    expect(runner.snapshot().run.status).toBe('partial');
});

// A saved two-drive run with per-drive records, for the single-drive scan tests.
const TWO = [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }];
const ds = (name, items, counts) => ({ name, at: '2026-09-01T00:00:00Z', status: 'ok', message: null, items, trashed: 0, counts });
const savedTwo = () => ({
    id: 'r1', status: 'complete', drives_done: 2, drives_total: 2,
    results: results({
        driveCaps: rows([{ drive: '_A', driveId: 'a', total: 5, trashed: 0, level: 'ok' }, { drive: '_B', driveId: 'b', total: 7, trashed: 0, level: 'ok' }]),
        nonStandardProjects: rows([{ drive: '_A', client: 'C', name: 'x', folderId: 'x' }, { drive: '_B', client: 'C', name: 'y', folderId: 'y' }]),
        driveScans: {
            a: ds('_A', 5, { nonStandardProjects: 1, driveCaps: 1 }),
            b: ds('_B', 7, { nonStandardProjects: 1, driveCaps: 1 }),
        },
        scanCoverage: { done: 2, total: 2, driveIds: ['a', 'b'], at: 't', checks: ['driveCaps', 'nonStandardProjects'], mode: 'full' },
        checkedAt: { driveCaps: '2026-09-01T00:00:00Z' },
    }),
});

test('scanDrives scans just the chosen drive and replaces only its rows in every scan check', async () => {
    const { runner, ra } = make({ drives: TWO });
    runner.load(savedTwo());
    runner.scanDrives(['b']);
    await tick();
    expect(ra.calls).toHaveLength(1);
    expect(ra.calls[0].args.drives).toEqual([{ id: 'b', name: '_B' }]);
    expect(ra.calls[0].args.stages).toEqual({ scan: true, reports: false });
    expect(runner.snapshot().scanningDriveIds).toEqual(['b']);
    ra.calls[0].resolve({
        ...scanOut({
            driveCaps: rows([{ drive: '_B', driveId: 'b', total: 9, trashed: 0, level: 'ok' }]),
            nonStandardProjects: rows([{ drive: '_B', client: 'C', name: 'z', folderId: 'z' }]),
        }),
        drivesDone: 1,
        perDrive: { b: { ...ds('_B', 9, { nonStandardProjects: 1, driveCaps: 1 }), at: '2026-10-02T10:00:00.000Z' } },
    });
    await tick();
    const r = runner.snapshot().run.results;
    expect(r.driveCaps.rows.map((x) => [x.drive, x.total])).toEqual([['_A', 5], ['_B', 9]]);
    expect(r.driveCaps.total).toBe(2);
    expect(r.nonStandardProjects.rows.map((x) => x.name)).toEqual(['x', 'z']);
    expect(r.nonStandardProjects.total).toBe(2);
    expect(r.driveScans.b).toMatchObject({ items: 9, at: '2026-10-02T10:00:00.000Z' });
    expect(r.driveScans.a).toMatchObject({ items: 5, at: '2026-09-01T00:00:00Z' });
    expect(r.scanCoverage).toMatchObject({ done: 2, total: 2 });
    expect(r.checkedAt.driveCaps).toBe('2026-10-02T10:00:00.000Z');   // every drive is current again
    expect(runner.snapshot().scanningDriveIds).toEqual([]);
    expect(runner.snapshot().run.id).toBe('r1');
});

test('totals come from per-drive counts, so a capped list stays correct after a single-drive rescan', async () => {
    const { runner, ra } = make({ drives: TWO });
    const saved = savedTwo();
    saved.results.nonStandardProjects = { rows: saved.results.nonStandardProjects.rows, total: 500 };
    saved.results.driveScans.a.counts.nonStandardProjects = 450;
    saved.results.driveScans.b.counts.nonStandardProjects = 50;
    runner.load(saved);
    runner.scanDrives(['b']);
    await tick();
    ra.calls[0].resolve({
        ...scanOut({ nonStandardProjects: { rows: [{ drive: '_B', client: 'C', name: 'z', folderId: 'z' }], total: 10 } }),
        drivesDone: 1, perDrive: { b: ds('_B', 9, { nonStandardProjects: 10, driveCaps: 1 }) },
    });
    await tick();
    expect(runner.snapshot().run.results.nonStandardProjects.total).toBe(460);
});

test('Scan on another drive during a scan queues it and runs it next, one at a time', async () => {
    const { runner, ra } = make({ drives: TWO });
    runner.scanDrives(['a']);
    await tick();
    expect(runner.snapshot().currentDriveId).toBe('a');
    runner.scanDrives(['b']);
    await tick();
    expect(ra.calls).toHaveLength(1);                          // never two scans at once
    expect(runner.snapshot().queuedDriveIds).toEqual(['b']);
    expect(runner.snapshot().pendingDriveIds).toEqual(['b']);
    ra.calls[0].resolve({ ...scanOut(), drivesDone: 1, perDrive: { a: ds('_A', 5, { driveCaps: 1 }) } });
    await tick(); await tick();
    expect(ra.calls).toHaveLength(2);
    expect(ra.calls[1].args.drives).toEqual([{ id: 'b', name: '_B' }]);
    expect(runner.snapshot().queuedDriveIds).toEqual([]);
    expect(runner.snapshot().currentDriveId).toBe('b');
});

test('a drive the running scan will still reach is pending, not queued twice', async () => {
    const { runner, ra } = make({ drives: TWO });
    runner.run(['driveCaps']);                                  // full scan over a, b
    await tick();
    runner.scanDrives(['b']);
    await tick();
    expect(runner.snapshot().queuedDriveIds).toEqual([]);
    expect(runner.snapshot().pendingDriveIds).toEqual(['b']);
    expect(ra.calls).toHaveLength(1);
});

test('unqueue removes a queued drive; stopAll clears the queue', async () => {
    const THREE = [...TWO, { id: 'c', name: '_C' }];
    const { runner, ra } = make({ drives: THREE });
    runner.scanDrives(['a']);
    await tick();
    runner.scanDrives(['b']); runner.scanDrives(['c']);
    await tick();
    expect(runner.snapshot().queuedDriveIds).toEqual(['b', 'c']);
    runner.unqueue('b');
    expect(runner.snapshot().queuedDriveIds).toEqual(['c']);
    const stopping = runner.stopAll();
    expect(runner.snapshot().queuedDriveIds).toEqual([]);
    ra.calls[0].resolve({ ...scanOut(), status: 'partial', drivesDone: 0 });
    await stopping; await tick();
    expect(ra.calls).toHaveLength(1);                          // nothing queued runs after a stop
});

test('a first-ever single-drive scan records partial coverage in subset mode', async () => {
    const { runner, ra } = make({ drives: TWO });
    runner.scanDrives(['a']);
    await tick();
    ra.calls[0].resolve({ ...scanOut({ driveCaps: rows([{ drive: '_A', driveId: 'a', total: 5, trashed: 0, level: 'ok' }]) }), drivesDone: 1, perDrive: { a: ds('_A', 5, { driveCaps: 1 }) } });
    await tick();
    const r = runner.snapshot().run.results;
    expect(r.scanCoverage).toMatchObject({ done: 1, total: 2, driveIds: ['a'], mode: 'subset' });
    expect(r.checkedAt.driveCaps).toBeUndefined();   // the other drive has never been scanned
    expect(r.driveScans.a.items).toBe(5);
});

test('load() seeds state from a saved run including checkedAt', () => {
    const { runner } = make();
    runner.load({ id: 'old', status: 'complete', results: results({ checkedAt: { driveCaps: '2026-09-01T00:00:00Z' } }) });
    expect(runner.snapshot().checks.driveCaps.checkedAt).toBe('2026-09-01T00:00:00Z');
    expect(runner.snapshot().run.id).toBe('old');
});
