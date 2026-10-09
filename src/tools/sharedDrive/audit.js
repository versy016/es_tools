// Shared Drive audit — pure logic. No I/O here: callers hand in drive listings, master
// client lists and Reports API events, and get findings back. Everything is unit-tested in
// audit.test.js. Spec: docs/superpowers/specs/2026-10-02-shared-drive-audit-design.md
import {
    AUDIT_DRIVE_ROOTS, AUDIT_EXCLUDED_DRIVES, AUDIT_MAX_ROWS, AUDIT_PROJECT_ITEM_LIMIT,
    AUDIT_DRIVE_WARN, AUDIT_DRIVE_CRITICAL, AUDIT_ACTIVITY_DAYS,
} from './service';

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ORPHAN = '__orphan__';
const isFolder = (f) => f && f.mimeType === FOLDER_MIME;

// ---- Drive classification ----
const matches = (rule, name) => (rule instanceof RegExp
    ? rule.test(name)
    : String(rule).toLowerCase() === String(name || '').trim().toLowerCase());

// → { kind: 'client' | 'excluded' | 'unclassified', rootPath: string[], singleClient, driveName }
export const classifyDrive = (name, roots = AUDIT_DRIVE_ROOTS, excluded = AUDIT_EXCLUDED_DRIVES) => {
    const driveName = String(name || '');
    const base = { rootPath: [], singleClient: false, driveName };
    if (excluded.some((r) => matches(r, driveName))) return { ...base, kind: 'excluded' };
    const rule = roots.find((r) => matches(r.match, driveName));
    if (rule) return { ...base, kind: 'client', rootPath: rule.rootPath || [], singleClient: !!rule.singleClient };
    return { ...base, kind: 'unclassified' };
};

// ---- Client-name matching ----
// Lower-case, strip punctuation, collapse spaces, drop a trailing company suffix so folder
// names like "ARTC Pty Ltd" match the ESE title "ARTC".
export const normaliseName = (s) => String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(pty ltd|ltd|limited)$/, '')
    .trim();

const bigrams = (s) => {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i++) { const b = s.slice(i, i + 2); out.set(b, (out.get(b) || 0) + 1); }
    return out;
};
// Sørensen–Dice coefficient over character bigrams of the normalised strings, in [0, 1].
const dice = (a, b) => {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const ba = bigrams(a); const bb = bigrams(b);
    let shared = 0;
    ba.forEach((n, k) => { if (bb.has(k)) shared += Math.min(n, bb.get(k)); });
    return (2 * shared) / ((a.length - 1) + (b.length - 1));
};

// Best candidate for `name` → { title, score } or null when there are no candidates.
export const closestMatch = (name, candidates) => {
    const n = normaliseName(name);
    let best = null;
    (candidates || []).forEach((title) => {
        const score = dice(n, normaliseName(title));
        if (!best || score > best.score) best = { title, score };
    });
    return best;
};

// ---- Drive tree ----
// Index a full files.list result for one drive. Items with no `parents` (orphaned
// shared-drive items) are bucketed under '__orphan__' so they still count toward totals.
// → { byId: Map<id, file>, childrenOf: Map<parentId, id[]>, total, trashed }
export const buildTree = (files, driveId) => {
    const byId = new Map();
    const childrenOf = new Map();
    let trashed = 0;
    (files || []).forEach((f) => {
        if (!f || !f.id) return;
        byId.set(f.id, f);
        if (f.trashed) trashed += 1;
        const parent = (f.parents && f.parents[0]) || ORPHAN;
        if (!childrenOf.has(parent)) childrenOf.set(parent, []);
        childrenOf.get(parent).push(f.id);
    });
    return { byId, childrenOf, total: byId.size, trashed, driveId };
};

// Number of descendants (files + folders, trashed included) per FOLDER id. Iterative
// post-order so a drive with hundreds of thousands of items can't blow the stack.
export const descendantCounts = (tree) => {
    const counts = new Map();
    const folders = [];
    tree.byId.forEach((f) => { if (isFolder(f)) folders.push(f.id); });
    const done = new Set();
    folders.forEach((rootId) => {
        if (done.has(rootId)) return;
        const stack = [[rootId, false]];
        while (stack.length) {
            const [id, visited] = stack.pop();
            if (done.has(id)) continue;
            const kids = tree.childrenOf.get(id) || [];
            if (!visited) {
                stack.push([id, true]);
                kids.forEach((k) => { if (isFolder(tree.byId.get(k)) && !done.has(k)) stack.push([k, false]); });
            } else {
                let n = 0;
                kids.forEach((k) => { n += 1 + (isFolder(tree.byId.get(k)) ? (counts.get(k) || 0) : 0); });
                counts.set(id, n);
                done.add(id);
            }
        }
    });
    return counts;
};

// Walk `rootPath` (folder names, case-insensitive) down from the drive root. [] → driveId.
export const findRoot = (tree, driveId, rootPath) => {
    let cur = driveId;
    for (const seg of rootPath || []) {
        const want = String(seg).toLowerCase();
        const kids = tree.childrenOf.get(cur) || [];
        const hit = kids.find((k) => { const f = tree.byId.get(k); return isFolder(f) && !f.trashed && String(f.name).toLowerCase() === want; });
        if (!hit) return null;
        cur = hit;
    }
    return cur;
};

const liveChildren = (tree, id) => (tree.childrenOf.get(id) || []).map((k) => tree.byId.get(k)).filter((f) => f && !f.trashed);

// Client folders, project folders and loose items for one classified drive.
// → { clientFolders: [{id,name}], projectFolders: [{id,name,clientName}], looseItems: [{id,name}], error? }
export const deriveFolders = (tree, driveId, classification) => {
    const empty = { clientFolders: [], projectFolders: [], looseItems: [] };
    const rootId = findRoot(tree, driveId, classification.rootPath);
    if (!rootId) return { ...empty, error: `Client root "${(classification.rootPath || []).join('/')}" not found` };
    const kids = liveChildren(tree, rootId);
    const looseItems = kids.filter((f) => !isFolder(f)).map((f) => ({ id: f.id, name: f.name }));
    if (classification.singleClient) {
        const clientName = classification.driveName;
        return {
            clientFolders: [{ id: rootId, name: clientName }],
            projectFolders: kids.filter(isFolder).map((f) => ({ id: f.id, name: f.name, clientName })),
            looseItems,
        };
    }
    const clientFolders = kids.filter(isFolder).map((f) => ({ id: f.id, name: f.name }));
    const projectFolders = [];
    clientFolders.forEach((c) => liveChildren(tree, c.id).filter(isFolder).forEach((p) => projectFolders.push({ id: p.id, name: p.name, clientName: c.name })));
    return { clientFolders, projectFolders, looseItems };
};

// Cap a findings list for storage/display while keeping the true count.
export const capList = (list, max = AUDIT_MAX_ROWS) => ({ rows: (list || []).slice(0, max), total: (list || []).length });

// ---- Admin SDK Reports API (drive audit events) ----
// Flatten event.events[0].parameters ([{name, value|boolValue|intValue|multiValue}]) → object.
export const paramMap = (event) => {
    const out = {};
    const params = (event && event.events && event.events[0] && event.events[0].parameters) || [];
    params.forEach((p) => {
        if (!p || !p.name) return;
        if ('boolValue' in p) out[p.name] = p.boolValue;
        else if ('multiValue' in p) out[p.name] = p.multiValue;
        else if ('intValue' in p) out[p.name] = p.intValue;
        else out[p.name] = p.value;
    });
    return out;
};

const eventTime = (e) => (e && e.id && e.id.time) || '';
const eventActor = (e) => String((e && e.actor && e.actor.email) || 'unknown').toLowerCase();
// Drive audit events carry the drive ID (shared_drive_id / team_drive_id), not its name —
// resolve through the id→name map built from the scanned drives; fall back to the raw id.
const driveOf = (p, names) => {
    const id = p.shared_drive_id || p.team_drive_id || '';
    if (id) return (names && names.get && names.get(id)) || id;
    return p.shared_drive_name || p.team_drive_name || '';
};
const byTimeDesc = (a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0);

// Folder deletions, newest first → [{ when, actor, driveName, docTitle, docId }]
export const reduceDeletions = (events, driveNames) => (events || [])
    .map((e) => ({ e, p: paramMap(e) }))
    .filter(({ p }) => p.doc_type === 'folder')
    .map(({ e, p }) => ({ when: eventTime(e), actor: eventActor(e), driveName: driveOf(p, driveNames), docTitle: p.doc_title || '', docId: p.doc_id || '' }))
    .sort(byTimeDesc);

// Project-folder creations reduced to one row per actor. `knownActors` (emails) with no
// events in the window are appended with nulls so idle staff are visible.
// → [{ actor, lastCreatedAt, lastProject, driveName, countInWindow }] newest first, idle last.
// `projectFolderIds` null = no scan available: count every folder created on a shared drive.
export const reduceCreates = (events, projectFolderIds, knownActors, driveNames) => {
    const rows = new Map();
    (events || []).forEach((e) => {
        const p = paramMap(e);
        if (p.doc_type !== 'folder') return;
        if (projectFolderIds) { if (!projectFolderIds.has(p.doc_id)) return; }
        else if (!(p.shared_drive_id || p.team_drive_id)) return;
        const actor = eventActor(e);
        const when = eventTime(e);
        const row = rows.get(actor) || { actor, lastCreatedAt: null, lastProject: null, driveName: null, countInWindow: 0 };
        row.countInWindow += 1;
        if (!row.lastCreatedAt || when > row.lastCreatedAt) { row.lastCreatedAt = when; row.lastProject = p.doc_title || ''; row.driveName = driveOf(p, driveNames) || null; }
        rows.set(actor, row);
    });
    (knownActors || []).forEach((email) => {
        const actor = String(email || '').toLowerCase();
        if (actor && !rows.has(actor)) rows.set(actor, { actor, lastCreatedAt: null, lastProject: null, driveName: null, countInWindow: 0 });
    });
    return [...rows.values()].sort((a, b) => {
        if (a.lastCreatedAt && b.lastCreatedAt) return a.lastCreatedAt < b.lastCreatedAt ? 1 : a.lastCreatedAt > b.lastCreatedAt ? -1 : 0;
        if (a.lastCreatedAt) return -1;
        if (b.lastCreatedAt) return 1;
        return a.actor.localeCompare(b.actor);
    });
};

// ---- Orchestration ----
// The seven user-facing checks and the stage each one needs. Scan checks all come from one
// full drive listing (so they can share a scan job); report checks come from the Reports API.
export const CHECKS = [
    { key: 'unknownClients', label: 'Unknown clients', stage: 'scan' },
    { key: 'looseItems', label: 'Loose files at client level', stage: 'scan' },
    { key: 'nonStandardProjects', label: 'Non-standard project names', stage: 'scan' },
    { key: 'oversizedProjects', label: 'Oversized projects', stage: 'scan' },
    { key: 'driveCaps', label: 'Drive item cap', stage: 'scan' },
    { key: 'deletions', label: 'Folder deletions', stage: 'reports' },
    { key: 'lastCreated', label: 'Staff — last project created', stage: 'reports' },
];
export const SCAN_CHECKS = CHECKS.filter((c) => c.stage === 'scan').map((c) => c.key);
export const REPORT_CHECKS = CHECKS.filter((c) => c.stage === 'reports').map((c) => c.key);
const RESULT_KEYS = [...CHECKS.map((c) => c.key), 'unclassifiedDrives', 'errors'];

// The stored/displayed shape: every list is { rows, total }.
export const emptyResults = () => Object.fromEntries(RESULT_KEYS.map((k) => [k, { rows: [], total: 0 }]));

const capLevel = (total) => (total >= AUDIT_DRIVE_CRITICAL ? 'critical' : total >= AUDIT_DRIVE_WARN ? 'warn' : 'ok');

// Run every check, one drive at a time. Pure apart from the injected `deps`:
//   deps.listDriveTree(driveId, onPage) → files[]
//   deps.listAuditEvents(kind, sinceIso) → Reports API events (403 → err.status 403)
//   deps.listAllClients() → [{ title, reference }]
//   deps.now?() → Date
// onProgress({ driveIndex, driveTotal, driveName, items, results }) is awaited after each
// drive (the UI persists partial results there); onPage({ driveIndex, driveTotal, driveName,
// items }) fires after every 1000-item page inside a drive. shouldCancel() is checked before
// each drive AND after every page (the listing is aborted mid-drive; that drive is dropped).
// `stages` picks the work: { scan } = list every drive and compute the five scan checks (the
// master list is fetched for Unknown clients); { reports } = the two Reports API checks. With
// reports but no scan, Last created falls back to `priorProjectFolderIds` (from an earlier scan)
// or, failing that, counts every folder created on a shared drive (`lastCreatedScope`).
// → { results, status: 'complete' | 'partial', reportsAvailable: boolean | null, drivesDone,
//     projectFolderIds: Set, lastCreatedScope: 'projects' | 'allFolders' | null }
export const runAudit = async ({ drives, deps, knownActors, onProgress, onPage, shouldCancel, stages = { scan: true, reports: true }, priorProjectFolderIds = null }) => {
    const raw = Object.fromEntries(RESULT_KEYS.map((k) => [k, []]));
    const capped = () => Object.fromEntries(RESULT_KEYS.map((k) => [k, capList(raw[k])]));
    const now = deps.now ? deps.now() : new Date();
    const doScan = stages.scan !== false;
    const doReports = stages.reports !== false;

    // Check 1 input: the ESE master list (normalised once). null = unavailable. Client folders
    // are named after the ESE *reference* (e.g. "AI Precast"), not the full title
    // ("Adelaide Integrated Precast Pty Ltd"), so that's what we match on.
    let master = null;
    if (doScan) {
        try {
            const list = await deps.listAllClients();
            const refs = list.map((c) => c.reference || c.title).filter(Boolean);
            master = { titles: refs, keys: new Set(refs.map(normaliseName)) };
        } catch (e) { raw.errors.push({ drive: '*', message: `Master list unavailable: ${e.message || e}`, source: 'scan' }); }
    }

    const projectFolderIds = new Set();
    let drivesDone = 0;
    let status = 'complete';
    let pausedForAuth = false;   // Google sign-in expired mid-run: stop, let the user reconnect + continue
    // Per-drive summary: when it was scanned, outcome, size, and how many findings it added to
    // each list — lets a single-drive rescan replace exactly that drive's contribution.
    const perDrive = {};
    const COUNT_KEYS = [...SCAN_CHECKS, 'unclassifiedDrives', 'errors'];
    for (let i = 0; doScan && i < (drives || []).length; i++) {
        if (shouldCancel && shouldCancel()) { status = 'partial'; break; }
        const drive = drives[i];
        const cls = classifyDrive(drive.name);
        const before = Object.fromEntries(COUNT_KEYS.map((k) => [k, raw[k].length]));
        let tree = null;
        let cancelledMidDrive = false;
        let outcome = 'ok';
        let outcomeMessage = null;
        try {
            // eslint-disable-next-line no-await-in-loop
            const files = await deps.listDriveTree(drive.id, (count) => {
                if (onPage) onPage({ driveIndex: i + 1, driveTotal: drives.length, driveName: drive.name, items: count });
                return !(shouldCancel && shouldCancel());
            });
            tree = buildTree(files, drive.id);
        } catch (e) {
            if (e && e.cancelled) { cancelledMidDrive = true; }
            else if (e && e.authExpired) { pausedForAuth = true; }
            else {
                // files.list on a shared drive needs membership (domain-admin access doesn't apply here).
                // `kind` tells "Continue scan" which failures are worth retrying.
                const notMember = !!e && e.status === 404;
                const message = notMember
                    ? 'The connected account is not a member of this drive — add it as a member (Content manager) and re-run'
                    : (e.message || String(e));
                outcome = notMember ? 'notMember' : 'listFailed';
                outcomeMessage = message;
                raw.errors.push({ drive: drive.name, message, source: 'scan', kind: outcome });
            }
        }
        if (cancelledMidDrive || pausedForAuth) { status = 'partial'; break; }
        if (tree) {
            raw.driveCaps.push({ drive: drive.name, driveId: drive.id, total: tree.total, trashed: tree.trashed, level: capLevel(tree.total) });
            if (cls.kind === 'unclassified') raw.unclassifiedDrives.push({ drive: drive.name, driveId: drive.id });
            else if (cls.kind === 'client') {
                const { clientFolders, projectFolders, looseItems, error } = deriveFolders(tree, drive.id, cls);
                if (error) raw.errors.push({ drive: drive.name, message: error, source: 'scan' });
                if (master && !cls.singleClient) {
                    clientFolders.forEach((c) => {
                        if (!master.keys.has(normaliseName(c.name))) raw.unknownClients.push({ drive: drive.name, client: c.name, folderId: c.id, closest: closestMatch(c.name, master.titles) });
                    });
                }
                if (looseItems.length) raw.looseItems.push({ drive: drive.name, count: looseItems.length, samples: looseItems.slice(0, 20).map((l) => l.name) });
                const counts = descendantCounts(tree);
                projectFolders.forEach((p) => {
                    projectFolderIds.add(p.id);
                    if (!isStandardProjectName(p.name)) raw.nonStandardProjects.push({ drive: drive.name, client: p.clientName, name: p.name, folderId: p.id });
                    const n = counts.get(p.id) || 0;
                    if (n > AUDIT_PROJECT_ITEM_LIMIT) raw.oversizedProjects.push({ drive: drive.name, client: p.clientName, name: p.name, folderId: p.id, count: n });
                });
            }
        }
        perDrive[drive.id] = {
            name: drive.name, at: (deps.now ? deps.now() : new Date()).toISOString(), status: outcome, message: outcomeMessage,
            items: tree ? tree.total : null, trashed: tree ? tree.trashed : null,
            counts: Object.fromEntries(COUNT_KEYS.map((k) => [k, raw[k].length - before[k]])),
        };
        drivesDone += 1;
        // eslint-disable-next-line no-await-in-loop
        if (onProgress) await onProgress({ driveIndex: i + 1, driveTotal: drives.length, driveName: drive.name, items: tree ? tree.total : 0, results: capped(), perDrive: { ...perDrive } });
    }
    raw.oversizedProjects.sort((a, b) => b.count - a.count);

    // Checks 5 + 6: Reports API, last AUDIT_ACTIVITY_DAYS days. Skipped on cancel.
    let reportsAvailable = null;
    let lastCreatedScope = null;
    if (!doReports) { /* scan-only run */ }
    else if (pausedForAuth || (shouldCancel && shouldCancel())) status = 'partial';
    else {
        const since = new Date(now.getTime() - AUDIT_ACTIVITY_DAYS * 86400e3).toISOString();
        const driveNames = new Map((drives || []).map((d) => [d.id, d.name]));
        const ids = doScan ? projectFolderIds : (priorProjectFolderIds || null);
        lastCreatedScope = ids ? 'projects' : 'allFolders';
        try {
            const deletes = await deps.listAuditEvents('delete', since);
            const creates = await deps.listAuditEvents('create', since);
            raw.deletions = reduceDeletions(deletes, driveNames);
            raw.lastCreated = reduceCreates(creates, ids, knownActors || [], driveNames);
            reportsAvailable = true;
        } catch (e) {
            if (e && e.authExpired) { pausedForAuth = true; status = 'partial'; lastCreatedScope = null; return { results: capped(), status, reportsAvailable: null, drivesDone, projectFolderIds, lastCreatedScope, pausedForAuth, perDrive }; }
            reportsAvailable = false;
            // 403 = not an admin; 401 "not authorized to read activity records" = no Reports
            // privilege. Both mean the same thing to the user → the panel notice, not an error row.
            if (e && e.status !== 403 && e.status !== 401) raw.errors.push({ drive: '*', message: `Activity unavailable: ${e.message || e}`, source: 'activity' });
        }
    }

    return { results: capped(), status, reportsAvailable, drivesDone, projectFolderIds, lastCreatedScope, pausedForAuth, perDrive };
};

// ---- Project-name rule ----
// Standard names start with the year (desktop app prefill: 2025_Name) or an ESE tender
// reference (E + 8 digits: E20250066_Name), then an underscore and at least one character.
export const PROJECT_NAME_RULE = /^(\d{4}|E\d{8})_\S/;
export const isStandardProjectName = (name) => PROJECT_NAME_RULE.test(String(name || ''));
