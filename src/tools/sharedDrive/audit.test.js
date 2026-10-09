// Unit tests for the Shared Drive audit's pure logic (no network, no DOM).
jest.mock('../../lib/supabase', () => ({ supabase: null }));

import {
    classifyDrive, normaliseName, closestMatch, isStandardProjectName, PROJECT_NAME_RULE,
    FOLDER_MIME, buildTree, descendantCounts, findRoot, deriveFolders, capList,
    paramMap, reduceDeletions, reduceCreates, emptyResults, runAudit, CHECKS, SCAN_CHECKS, REPORT_CHECKS,
} from './audit';

// Reports API event shape: { id: { time }, actor: { email }, events: [{ name, parameters: [{ name, value|boolValue|intValue }] }] }
const ev = (time, email, name, params) => ({
    id: { time }, actor: { email },
    events: [{ name, parameters: Object.entries(params).map(([k, v]) => (typeof v === 'boolean' ? { name: k, boolValue: v } : { name: k, value: String(v) })) }],
});

// ---- Shared fixture: one drive, two clients, one project, a loose file and an orphan ----
const D = 'drv1';
const f = (id, name, parent, extra = {}) => ({
    id, name, mimeType: extra.folder ? FOLDER_MIME : 'text/csv',
    parents: parent ? [parent] : undefined, trashed: !!extra.trashed,
});
const FILES = [
    f('c1', 'ARTC', D, { folder: true }),
    f('p1', '2025_Depot', 'c1', { folder: true }),
    f('x1', 'a.csv', 'p1'),
    f('x2', 'b.csv', 'p1', { trashed: true }),
    f('c2', 'Unknown Co', D, { folder: true }),
    f('loose', 'stray.csv', D),
    f('orphan', 'ghost.csv', null),
];
const CLIENT_ROOT = { kind: 'client', rootPath: [], singleClient: false, driveName: '_A' };

describe('classifyDrive', () => {
    test.each([['_A'], ['_z']])('%s → client at drive root', (n) => {
        expect(classifyDrive(n)).toMatchObject({ kind: 'client', rootPath: [], singleClient: false, driveName: n });
    });
    test('ES Cloud → _Clients', () => expect(classifyDrive('ES Cloud').rootPath).toEqual(['_Clients']));
    test('Accounts QT → __Accounts/__Clients', () => expect(classifyDrive('Accounts QT').rootPath).toEqual(['__Accounts', '__Clients']));
    test('United Precast is a single-client drive', () => {
        expect(classifyDrive('United Precast')).toMatchObject({ kind: 'client', singleClient: true, rootPath: [] });
    });
    test.each([['Backups'], ['Cadastral_2024'], ['DIT'], ['training']])('%s → excluded', (n) => {
        expect(classifyDrive(n).kind).toBe('excluded');
    });
    test('unknown drive → unclassified', () => {
        expect(classifyDrive('Random')).toMatchObject({ kind: 'unclassified', rootPath: [], singleClient: false, driveName: 'Random' });
    });
});

describe('normaliseName', () => {
    test.each([
        ['  SA  Water ', 'sa water'],
        ['ARTC Pty Ltd', 'artc'],
        ['Ashcon Pty. Ltd.', 'ashcon'],
        ['Built Environs Limited', 'built environs'],
        ['A&B (Holdings)', 'ab holdings'],
        ['Precast LTD', 'precast'],
        ['', ''],
    ])('%j → %j', (i, o) => expect(normaliseName(i)).toBe(o));
});

describe('closestMatch', () => {
    test('picks the nearest title with a score in [0,1]', () => {
        const m = closestMatch('SA Watr', ['SA Water', 'ARTC']);
        expect(m.title).toBe('SA Water');
        expect(m.score).toBeGreaterThan(0.5);
        expect(m.score).toBeLessThanOrEqual(1);
    });
    test('identical names score 1', () => expect(closestMatch('ARTC', ['ARTC']).score).toBe(1));
    test('empty candidates → null', () => expect(closestMatch('x', [])).toBeNull());
});

describe('buildTree', () => {
    test('counts total and trashed, buckets orphans under __orphan__', () => {
        const t = buildTree(FILES, D);
        expect(t.total).toBe(7);
        expect(t.trashed).toBe(1);
        expect(t.childrenOf.get('__orphan__')).toEqual(['orphan']);
        expect(t.childrenOf.get(D)).toEqual(['c1', 'c2', 'loose']);
        expect(t.byId.get('p1').name).toBe('2025_Depot');
    });
    test('empty listing → zero counts, no crash', () => {
        expect(buildTree([], D)).toMatchObject({ total: 0, trashed: 0 });
    });
});

describe('descendantCounts', () => {
    test('includes nested files and trashed items, folders only as keys', () => {
        const c = descendantCounts(buildTree(FILES, D));
        expect(c.get('p1')).toBe(2);
        expect(c.get('c1')).toBe(3);
        expect(c.get('c2')).toBe(0);
        expect(c.has('x1')).toBe(false);
    });
    test('handles deep nesting iteratively', () => {
        const deep = [f('r', 'root', D, { folder: true })];
        for (let i = 1; i <= 5000; i++) deep.push(f(`n${i}`, `n${i}`, i === 1 ? 'r' : `n${i - 1}`, { folder: true }));
        expect(descendantCounts(buildTree(deep, D)).get('r')).toBe(5000);
    });
});

describe('findRoot', () => {
    const WITH_ROOT = [...FILES, f('cl', '_Clients', D, { folder: true }), f('acc', '__Accounts', D, { folder: true }), f('acc2', '__clients', 'acc', { folder: true })];
    test('[] → the drive id itself', () => expect(findRoot(buildTree(WITH_ROOT, D), D, [])).toBe(D));
    test('walks one segment by name', () => expect(findRoot(buildTree(WITH_ROOT, D), D, ['_Clients'])).toBe('cl'));
    test('walks nested segments case-insensitively', () => expect(findRoot(buildTree(WITH_ROOT, D), D, ['__Accounts', '__Clients'])).toBe('acc2'));
    test('missing segment → null', () => expect(findRoot(buildTree(WITH_ROOT, D), D, ['Nope'])).toBeNull());
});

describe('deriveFolders', () => {
    test('client drive at root: clients, projects, loose items', () => {
        const r = deriveFolders(buildTree(FILES, D), D, CLIENT_ROOT);
        expect(r.error).toBeUndefined();
        expect(r.clientFolders.map((c) => c.name)).toEqual(['ARTC', 'Unknown Co']);
        expect(r.projectFolders).toEqual([{ id: 'p1', name: '2025_Depot', clientName: 'ARTC' }]);
        expect(r.looseItems.map((l) => l.name)).toEqual(['stray.csv']);
    });
    test('missing client root → error and empty lists', () => {
        const r = deriveFolders(buildTree(FILES, D), D, { ...CLIENT_ROOT, rootPath: ['_Clients'] });
        expect(r.error).toMatch(/_Clients/);
        expect(r.clientFolders).toEqual([]);
        expect(r.projectFolders).toEqual([]);
        expect(r.looseItems).toEqual([]);
    });
    test('singleClient drive: the drive is the client, top-level folders are projects', () => {
        const r = deriveFolders(buildTree(FILES, D), D, { ...CLIENT_ROOT, singleClient: true, driveName: 'United Precast' });
        expect(r.clientFolders).toEqual([{ id: D, name: 'United Precast' }]);
        expect(r.projectFolders.map((p) => p.name)).toEqual(['ARTC', 'Unknown Co']);
        expect(r.projectFolders[0].clientName).toBe('United Precast');
        expect(r.looseItems.map((l) => l.name)).toEqual(['stray.csv']);
    });
    test('trashed folders are not treated as clients or projects', () => {
        const files = [...FILES, f('c3', 'Gone Co', D, { folder: true, trashed: true })];
        expect(deriveFolders(buildTree(files, D), D, CLIENT_ROOT).clientFolders.map((c) => c.name)).toEqual(['ARTC', 'Unknown Co']);
    });
});

describe('capList', () => {
    test('caps and keeps the true total', () => expect(capList([1, 2, 3], 2)).toEqual({ rows: [1, 2], total: 3 }));
    test('short list is returned whole', () => expect(capList([1], 2)).toEqual({ rows: [1], total: 1 }));
    test('defaults to 200', () => expect(capList(Array.from({ length: 250 }, (_, i) => i)).rows).toHaveLength(200));
});

describe('paramMap', () => {
    test('folds value / boolValue / intValue / multiValue parameters', () => {
        const e = { events: [{ parameters: [{ name: 'a', value: 'x' }, { name: 'b', boolValue: true }, { name: 'c', intValue: '7' }, { name: 'd', multiValue: ['p', 'q'] }] }] };
        expect(paramMap(e)).toEqual({ a: 'x', b: true, c: '7', d: ['p', 'q'] });
    });
    test('tolerates missing events', () => expect(paramMap({})).toEqual({}));
});

describe('reduceDeletions', () => {
    test('keeps folders only, newest first, with actor/drive/title', () => {
        const out = reduceDeletions([
            ev('2026-09-01T00:00:00Z', 'a@engsurveys.com.au', 'delete', { doc_type: 'folder', doc_title: 'Old', doc_id: 'f1', shared_drive_name: '_A' }),
            ev('2026-09-02T00:00:00Z', 'b@engsurveys.com.au', 'delete', { doc_type: 'document', doc_title: 'x', doc_id: 'f2' }),
            ev('2026-09-03T00:00:00Z', 'c@engsurveys.com.au', 'delete', { doc_title: 'no type', doc_id: 'f3' }),
            ev('2026-09-04T00:00:00Z', 'd@engsurveys.com.au', 'delete', { doc_type: 'folder', doc_title: 'Newer', doc_id: 'f4', team_drive_name: '_B' }),
        ]);
        expect(out).toEqual([
            { when: '2026-09-04T00:00:00Z', actor: 'd@engsurveys.com.au', driveName: '_B', docTitle: 'Newer', docId: 'f4' },
            { when: '2026-09-01T00:00:00Z', actor: 'a@engsurveys.com.au', driveName: '_A', docTitle: 'Old', docId: 'f1' },
        ]);
    });
    test('missing actor email → unknown', () => {
        const e = ev('2026-09-01T00:00:00Z', undefined, 'delete', { doc_type: 'folder', doc_title: 'Old', doc_id: 'f1' });
        expect(reduceDeletions([e])[0].actor).toBe('unknown');
    });
    test('resolves shared_drive_id / team_drive_id to a name through driveNames', () => {
        const names = new Map([['drvA', '_A'], ['drvB', '_B']]);
        const out = reduceDeletions([
            ev('2026-09-01T00:00:00Z', 'a@engsurveys.com.au', 'delete', { doc_type: 'folder', doc_title: 'x', doc_id: 'f1', shared_drive_id: 'drvA' }),
            ev('2026-09-02T00:00:00Z', 'a@engsurveys.com.au', 'delete', { doc_type: 'folder', doc_title: 'y', doc_id: 'f2', team_drive_id: 'drvB' }),
            ev('2026-09-03T00:00:00Z', 'a@engsurveys.com.au', 'delete', { doc_type: 'folder', doc_title: 'z', doc_id: 'f3', shared_drive_id: 'unknownId' }),
        ], names);
        expect(out.map((d) => d.driveName)).toEqual(['unknownId', '_B', '_A']);
    });
});

describe('reduceCreates', () => {
    test('one row per actor (case-insensitive), known-but-idle actors appear with nulls', () => {
        const out = reduceCreates([
            ev('2026-09-01T00:00:00Z', 'A@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'p1', doc_title: '2026_One', shared_drive_name: '_A' }),
            ev('2026-09-05T00:00:00Z', 'a@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'p2', doc_title: '2026_Two', shared_drive_name: '_B' }),
            ev('2026-09-06T00:00:00Z', 'a@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'notproject', doc_title: 'sub' }),
            ev('2026-09-07T00:00:00Z', 'a@engsurveys.com.au', 'create', { doc_type: 'document', doc_id: 'p2', doc_title: 'file' }),
        ], new Set(['p1', 'p2']), ['a@engsurveys.com.au', 'idle@engsurveys.com.au']);
        expect(out).toEqual([
            { actor: 'a@engsurveys.com.au', lastCreatedAt: '2026-09-05T00:00:00Z', lastProject: '2026_Two', driveName: '_B', countInWindow: 2 },
            { actor: 'idle@engsurveys.com.au', lastCreatedAt: null, lastProject: null, driveName: null, countInWindow: 0 },
        ]);
    });
    test('resolves the drive name through driveNames', () => {
        const out = reduceCreates([ev('2026-09-01T00:00:00Z', 'x@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'p1', doc_title: 'P1', shared_drive_id: 'drvA' })], new Set(['p1']), [], new Map([['drvA', '_A']]));
        expect(out[0].driveName).toBe('_A');
    });
    test('with no project id set (reports-only mode) any folder created on a shared drive counts', () => {
        const out = reduceCreates([
            ev('2026-09-01T00:00:00Z', 'x@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'anything', doc_title: 'Sub', shared_drive_id: 'drvA' }),
            ev('2026-09-02T00:00:00Z', 'y@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'mydrive', doc_title: 'Personal' }),   // no shared drive → ignored
        ], null, [], new Map([['drvA', '_A']]));
        expect(out).toEqual([{ actor: 'x@engsurveys.com.au', lastCreatedAt: '2026-09-01T00:00:00Z', lastProject: 'Sub', driveName: '_A', countInWindow: 1 }]);
    });
    test('actors with events but not in knownActors still appear, sorted newest first', () => {
        const out = reduceCreates([
            ev('2026-09-01T00:00:00Z', 'x@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'p1', doc_title: 'P1' }),
            ev('2026-09-02T00:00:00Z', 'y@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'p2', doc_title: 'P2' }),
        ], new Set(['p1', 'p2']), []);
        expect(out.map((r) => r.actor)).toEqual(['y@engsurveys.com.au', 'x@engsurveys.com.au']);
    });
});

describe('runAudit', () => {
    const RESULT_KEYS = ['unknownClients', 'looseItems', 'nonStandardProjects', 'oversizedProjects', 'driveCaps', 'deletions', 'lastCreated', 'unclassifiedDrives', 'errors'];
    // A bigger listing: FILES plus a non-standard project and an oversized project under ARTC.
    const BIG = (() => {
        const files = [...FILES, f('bad', 'Bethany', 'c1', { folder: true }), f('big', '2026_Big', 'c1', { folder: true })];
        for (let i = 0; i < 3001; i++) files.push(f(`big${i}`, `f${i}.dwg`, 'big'));
        return files;
    })();
    const EVENTS = {
        delete: [ev('2026-09-01T00:00:00Z', 'a@engsurveys.com.au', 'delete', { doc_type: 'folder', doc_title: 'Old', doc_id: 'f1', shared_drive_name: '_A' })],
        create: [ev('2026-09-05T00:00:00Z', 'a@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'p1', doc_title: '2025_Depot', shared_drive_name: '_A' })],
    };
    const deps = (over = {}) => ({
        listDriveTree: async () => BIG,
        listAuditEvents: async (kind) => EVENTS[kind],
        listAllClients: async () => [{ title: 'ARTC', reference: 'ARTC' }],
        now: () => new Date('2026-10-02T00:00:00Z'),
        ...over,
    });
    const noCancel = () => false;

    test('emptyResults has every list as { rows: [], total: 0 }', () => {
        const r = emptyResults();
        expect(Object.keys(r).sort()).toEqual([...RESULT_KEYS].sort());
        RESULT_KEYS.forEach((k) => expect(r[k]).toEqual({ rows: [], total: 0 }));
    });

    test('produces all six checks for one client drive', async () => {
        const progress = [];
        const out = await runAudit({ drives: [{ id: D, name: '_A' }], deps: deps(), knownActors: ['idle@engsurveys.com.au'], onProgress: (p) => progress.push(p), shouldCancel: noCancel });
        expect(out.status).toBe('complete');
        expect(out.reportsAvailable).toBe(true);
        expect(out.drivesDone).toBe(1);
        const r = out.results;
        expect(r.unknownClients.rows).toEqual([{ drive: '_A', client: 'Unknown Co', folderId: 'c2', closest: { title: 'ARTC', score: expect.any(Number) } }]);
        expect(r.looseItems.rows).toEqual([{ drive: '_A', count: 1, samples: ['stray.csv'] }]);
        expect(r.nonStandardProjects.rows).toEqual([{ drive: '_A', client: 'ARTC', name: 'Bethany', folderId: 'bad' }]);
        expect(r.oversizedProjects.rows).toEqual([{ drive: '_A', client: 'ARTC', name: '2026_Big', folderId: 'big', count: 3001 }]);
        expect(r.driveCaps.rows).toEqual([{ drive: '_A', driveId: D, total: BIG.length, trashed: 1, level: 'ok' }]);
        expect(r.deletions.total).toBe(1);
        expect(r.lastCreated.rows.map((x) => x.actor)).toEqual(['a@engsurveys.com.au', 'idle@engsurveys.com.au']);
        expect(r.errors.total).toBe(0);
        expect(progress).toHaveLength(1);
        expect(progress[0]).toMatchObject({ driveIndex: 1, driveTotal: 1, driveName: '_A', items: BIG.length });
    });

    test('client folders are matched against the ESE reference, not the title', async () => {
        const files = [
            f('k1', 'AI Precast', D, { folder: true }),                       // = reference → known
            f('k2', 'ai precast', D, { folder: true }),                       // case/space-insensitive → known
            f('u1', 'Adelaide Integrated Precast', D, { folder: true }),      // = title, not reference → unknown
        ];
        const master = [{ title: 'Adelaide Integrated Precast Pty Ltd', reference: 'AI Precast' }, { title: 'ARTC', reference: 'ARTC' }];
        const out = await runAudit({ drives: [{ id: D, name: '_A' }], deps: deps({ listDriveTree: async () => files, listAllClients: async () => master }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.results.unknownClients.rows.map((r) => r.client)).toEqual(['Adelaide Integrated Precast']);
        expect(out.results.unknownClients.rows[0].closest.title).toBe('AI Precast');
    });

    test('passes the 90-day window to listAuditEvents', async () => {
        const seen = [];
        await runAudit({ drives: [], deps: deps({ listAuditEvents: async (kind, since) => { seen.push([kind, since]); return []; } }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(seen).toEqual([['delete', '2026-07-04T00:00:00.000Z'], ['create', '2026-07-04T00:00:00.000Z']]);
    });

    test('excluded drive only gets a driveCaps row; unclassified drive is listed', async () => {
        const out = await runAudit({ drives: [{ id: 'x', name: 'Backups' }, { id: 'y', name: 'Random' }], deps: deps({ listDriveTree: async () => FILES }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.results.driveCaps.rows.map((d) => d.drive)).toEqual(['Backups', 'Random']);
        expect(out.results.unknownClients.total).toBe(0);
        expect(out.results.unclassifiedDrives.rows).toEqual([{ drive: 'Random', driveId: 'y' }]);
    });

    test('listDriveTree failure is recorded and the scan continues', async () => {
        const listDriveTree = async (id) => { if (id === 'bad') throw new Error('boom'); return FILES; };
        const out = await runAudit({ drives: [{ id: 'bad', name: '_B' }, { id: D, name: '_A' }], deps: deps({ listDriveTree }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.results.errors.rows).toEqual([{ drive: '_B', message: 'boom', source: 'scan', kind: 'listFailed' }]);
        expect(out.results.driveCaps.rows.map((d) => d.drive)).toEqual(['_A']);
        expect(out.drivesDone).toBe(2);
    });

    test('missing client root is recorded as an error for that drive', async () => {
        const out = await runAudit({ drives: [{ id: D, name: 'ES Cloud' }], deps: deps({ listDriveTree: async () => FILES }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.results.errors.rows[0]).toMatchObject({ drive: 'ES Cloud', message: expect.stringMatching(/_Clients/) });
    });

    test('master list failure disables check 1 but the scan still runs', async () => {
        const out = await runAudit({ drives: [{ id: D, name: '_A' }], deps: deps({ listAllClients: async () => { throw new Error('Algolia not configured'); } }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.results.errors.rows).toEqual([{ drive: '*', message: 'Master list unavailable: Algolia not configured', source: 'scan' }]);
        expect(out.results.unknownClients.total).toBe(0);
        expect(out.results.driveCaps.total).toBe(1);
    });

    test('Reports 403 → reportsAvailable false, no throw, no error row', async () => {
        const err = Object.assign(new Error('Not Authorized'), { status: 403 });
        const out = await runAudit({ drives: [], deps: deps({ listAuditEvents: async () => { throw err; } }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.reportsAvailable).toBe(false);
        expect(out.results.deletions.total).toBe(0);
        expect(out.results.errors.total).toBe(0);
    });

    test('Reports 401 (no admin Reports privilege) → reportsAvailable false, no error row', async () => {
        const err = Object.assign(new Error('Access denied. You are not authorized to read activity records.'), { status: 401 });
        const out = await runAudit({ drives: [], deps: deps({ listAuditEvents: async () => { throw err; } }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.reportsAvailable).toBe(false);
        expect(out.results.errors.total).toBe(0);
    });

    test('other Reports errors are recorded', async () => {
        const out = await runAudit({ drives: [], deps: deps({ listAuditEvents: async () => { throw new Error('quota'); } }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.reportsAvailable).toBe(false);
        expect(out.results.errors.rows).toEqual([{ drive: '*', message: 'Activity unavailable: quota', source: 'activity' }]);
    });

    test('a cancel before the activity stage skips it (reportsAvailable null, no fetch)', async () => {
        let called = 0;
        const out = await runAudit({ drives: [], deps: deps({ listAuditEvents: async () => { called += 1; return []; } }), knownActors: [], onProgress: () => {}, shouldCancel: () => true });
        expect(called).toBe(0);
        expect(out.reportsAvailable).toBeNull();
        expect(out.status).toBe('partial');
    });

    test('a 404 from listDriveTree is explained as a membership problem', async () => {
        const err = Object.assign(new Error('Shared drive not found: x'), { status: 404 });
        const out = await runAudit({ drives: [{ id: 'x', name: '_Q' }], deps: deps({ listDriveTree: async () => { throw err; } }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.results.errors.rows[0]).toEqual({ drive: '_Q', message: expect.stringMatching(/not a member of this drive/i), source: 'scan', kind: 'notMember' });
    });

    test('activity rows carry drive names resolved from the scanned drives', async () => {
        const events = { delete: [ev('2026-09-01T00:00:00Z', 'a@engsurveys.com.au', 'delete', { doc_type: 'folder', doc_title: 'Old', doc_id: 'f1', shared_drive_id: D })], create: [] };
        const out = await runAudit({ drives: [{ id: D, name: '_A' }], deps: deps({ listDriveTree: async () => FILES, listAuditEvents: async (k) => events[k] }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.results.deletions.rows[0].driveName).toBe('_A');
    });

    test('a cancel during a drive listing stops that drive: partial, no error row, drive not counted', async () => {
        let cancelled = false;
        const listDriveTree = async (id, onPage) => {
            cancelled = true;   // the user clicks Cancel while this drive is paging
            if (onPage(500) === false) throw Object.assign(new Error('Cancelled'), { cancelled: true });
            return FILES;
        };
        const out = await runAudit({ drives: [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }], deps: deps({ listDriveTree }), knownActors: [], onProgress: () => {}, shouldCancel: () => cancelled });
        expect(out.status).toBe('partial');
        expect(out.drivesDone).toBe(0);
        expect(out.results.errors.total).toBe(0);
        expect(out.results.driveCaps.total).toBe(0);
    });

    test('page progress inside a drive is forwarded through onPage', async () => {
        const seen = [];
        const listDriveTree = async (id, onPage) => { onPage(1000); onPage(2000); return FILES; };
        await runAudit({ drives: [{ id: D, name: '_A' }], deps: deps({ listDriveTree }), knownActors: [], onProgress: () => {}, onPage: (p) => seen.push(p), shouldCancel: noCancel });
        expect(seen).toEqual([
            { driveIndex: 1, driveTotal: 1, driveName: '_A', items: 1000 },
            { driveIndex: 1, driveTotal: 1, driveName: '_A', items: 2000 },
        ]);
    });

    test('shouldCancel after the first drive → partial with drivesDone 1', async () => {
        let done = 0;
        const out = await runAudit({ drives: [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }], deps: deps({ listDriveTree: async () => FILES }), knownActors: [], onProgress: () => { done += 1; }, shouldCancel: () => done >= 1 });
        expect(out.status).toBe('partial');
        expect(out.drivesDone).toBe(1);
        expect(out.results.driveCaps.rows.map((d) => d.drive)).toEqual(['_A']);
    });

    test('driveCaps levels: 399999 ok, 400000 warn, 450000 critical', async () => {
        const sizes = { a: 399999, b: 400000, c: 450000 };
        const listDriveTree = async (id) => Array.from({ length: sizes[id] }, (_, i) => ({ id: `${id}${i}`, name: 'x', mimeType: 'text/csv', parents: [id] }));
        const out = await runAudit({ drives: [{ id: 'a', name: 'Backups' }, { id: 'b', name: 'Training' }, { id: 'c', name: 'DIT' }], deps: deps({ listDriveTree }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.results.driveCaps.rows.map((d) => d.level)).toEqual(['ok', 'warn', 'critical']);
    });

    test('CHECKS registry names every panel and which stage it needs', () => {
        expect(CHECKS.map((c) => c.key)).toEqual(['unknownClients', 'looseItems', 'nonStandardProjects', 'oversizedProjects', 'driveCaps', 'deletions', 'lastCreated']);
        expect(SCAN_CHECKS).toEqual(['unknownClients', 'looseItems', 'nonStandardProjects', 'oversizedProjects', 'driveCaps']);
        expect(REPORT_CHECKS).toEqual(['deletions', 'lastCreated']);
        CHECKS.forEach((c) => expect(typeof c.label).toBe('string'));
    });

    test('stages { scan: false, reports: true } skips the drive scan and master list entirely', async () => {
        let scans = 0; let masters = 0;
        const events = {
            delete: [ev('2026-09-01T00:00:00Z', 'a@engsurveys.com.au', 'delete', { doc_type: 'folder', doc_title: 'Old', doc_id: 'f1', shared_drive_id: D })],
            create: [ev('2026-09-02T00:00:00Z', 'a@engsurveys.com.au', 'create', { doc_type: 'folder', doc_title: 'Sub', doc_id: 'any', shared_drive_id: D })],
        };
        const out = await runAudit({
            drives: [{ id: D, name: '_A' }], knownActors: [], onProgress: () => {}, shouldCancel: noCancel,
            stages: { scan: false, reports: true },
            deps: deps({ listDriveTree: async () => { scans += 1; return FILES; }, listAllClients: async () => { masters += 1; return []; }, listAuditEvents: async (k) => events[k] }),
        });
        expect(scans).toBe(0); expect(masters).toBe(0);
        expect(out.drivesDone).toBe(0);
        expect(out.status).toBe('complete');
        expect(out.results.driveCaps.total).toBe(0);
        expect(out.results.deletions.rows[0].driveName).toBe('_A');
        // No scan → last-created counts every shared-drive folder creation and says so.
        expect(out.results.lastCreated.rows[0].countInWindow).toBe(1);
        expect(out.lastCreatedScope).toBe('allFolders');
    });

    test('reports-only with priorProjectFolderIds filters to projects and reports that scope', async () => {
        const events = { delete: [], create: [
            ev('2026-09-02T00:00:00Z', 'a@engsurveys.com.au', 'create', { doc_type: 'folder', doc_title: 'P', doc_id: 'p1', shared_drive_id: D }),
            ev('2026-09-03T00:00:00Z', 'b@engsurveys.com.au', 'create', { doc_type: 'folder', doc_title: 'S', doc_id: 'sub', shared_drive_id: D }),
        ] };
        const out = await runAudit({ drives: [{ id: D, name: '_A' }], knownActors: [], onProgress: () => {}, shouldCancel: noCancel, stages: { scan: false, reports: true }, priorProjectFolderIds: new Set(['p1']), deps: deps({ listAuditEvents: async (k) => events[k] }) });
        expect(out.results.lastCreated.rows.map((r) => r.actor)).toEqual(['a@engsurveys.com.au']);
        expect(out.lastCreatedScope).toBe('projects');
    });

    test('stages { scan: true, reports: false } skips the Reports API and exposes projectFolderIds', async () => {
        let activity = 0;
        const out = await runAudit({ drives: [{ id: D, name: '_A' }], knownActors: [], onProgress: () => {}, shouldCancel: noCancel, stages: { scan: true, reports: false }, deps: deps({ listDriveTree: async () => FILES, listAuditEvents: async () => { activity += 1; return []; } }) });
        expect(activity).toBe(0);
        expect(out.reportsAvailable).toBeNull();
        expect(out.results.driveCaps.total).toBe(1);
        expect(out.lastCreatedScope).toBeNull();
        expect([...out.projectFolderIds]).toEqual(['p1']);
    });

    test('an expired Google sign-in pauses the scan instead of failing every remaining drive', async () => {
        const authErr = Object.assign(new Error('Google sign-in expired'), { status: 401, authExpired: true });
        let calls = 0;
        const listDriveTree = async (id) => { calls += 1; if (id === 'b') throw authErr; return FILES; };
        const out = await runAudit({ drives: [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }, { id: 'c', name: '_C' }], deps: deps({ listDriveTree }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.status).toBe('partial');
        expect(out.pausedForAuth).toBe(true);
        expect(out.drivesDone).toBe(1);
        expect(calls).toBe(2);                      // _C is never attempted
        expect(out.results.errors.total).toBe(0);   // no misleading per-drive error rows
        expect(out.reportsAvailable).toBeNull();    // and the activity stage is skipped too
    });

    test('an expired sign-in during the activity stage pauses rather than claiming no admin access', async () => {
        const authErr = Object.assign(new Error('Google sign-in expired'), { status: 401, authExpired: true });
        const out = await runAudit({ drives: [], deps: deps({ listAuditEvents: async () => { throw authErr; } }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.pausedForAuth).toBe(true);
        expect(out.reportsAvailable).toBeNull();
        expect(out.status).toBe('partial');
        expect(out.results.errors.total).toBe(0);
    });

    test('reports a per-drive summary: items, outcome, when, and findings counted per check', async () => {
        const rateLimited = Object.assign(new Error('User rate limit exceeded.'), { status: 403 });
        const notMember = Object.assign(new Error('Shared drive not found'), { status: 404 });
        const listDriveTree = async (id) => { if (id === 'b') throw rateLimited; if (id === 'q') throw notMember; return FILES; };
        // The shared FILES fixture hangs off drive id D, so _A must be scanned under that id.
        const out = await runAudit({ drives: [{ id: D, name: '_A' }, { id: 'b', name: '_B' }, { id: 'q', name: '_Q' }], deps: deps({ listDriveTree }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel, stages: { scan: true, reports: false } });
        expect(out.perDrive[D]).toEqual({
            name: '_A', at: '2026-10-02T00:00:00.000Z', status: 'ok', message: null, items: 7, trashed: 1,
            counts: { unknownClients: 1, looseItems: 1, nonStandardProjects: 0, oversizedProjects: 0, driveCaps: 1, unclassifiedDrives: 0, errors: 0 },
        });
        expect(out.perDrive.b).toMatchObject({ name: '_B', status: 'listFailed', message: 'User rate limit exceeded.', items: null, counts: expect.objectContaining({ errors: 1, driveCaps: 0 }) });
        expect(out.perDrive.q).toMatchObject({ name: '_Q', status: 'notMember', items: null });
    });

    test('per-drive progress payloads carry the summaries so far', async () => {
        const seen = [];
        await runAudit({ drives: [{ id: 'a', name: '_A' }], deps: deps({ listDriveTree: async () => FILES }), knownActors: [], onProgress: (p) => seen.push(p), shouldCancel: noCancel, stages: { scan: true, reports: false } });
        expect(seen[0].perDrive.a).toMatchObject({ status: 'ok', items: 7 });
    });

    test('lists are capped at 200 with the true total kept', async () => {
        const files = Array.from({ length: 250 }, (_, i) => f(`c${i}`, `Nobody ${i}`, D, { folder: true }));
        const out = await runAudit({ drives: [{ id: D, name: '_A' }], deps: deps({ listDriveTree: async () => files }), knownActors: [], onProgress: () => {}, shouldCancel: noCancel });
        expect(out.results.unknownClients.rows).toHaveLength(200);
        expect(out.results.unknownClients.total).toBe(250);
    });
});

describe('isStandardProjectName', () => {
    test('exposes the rule', () => expect(PROJECT_NAME_RULE).toBeInstanceOf(RegExp));
    test.each([['2025_Bethany_College'], ['E20250066_Road_Rehab'], ['2023_10_Roberts']])('%s is standard', (n) => {
        expect(isStandardProjectName(n)).toBe(true);
    });
    test.each([['Bethany'], ['2025X'], ['20250066_X'], ['e20250066_X'], ['2025_'], ['_2025'], [''], [undefined]])('%j is not standard', (n) => {
        expect(isStandardProjectName(n)).toBe(false);
    });
});
