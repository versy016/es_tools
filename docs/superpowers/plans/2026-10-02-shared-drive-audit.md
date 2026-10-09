# Shared Drive Audit Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Audit tab to the Shared Drive Manager that scans every Google shared drive on demand, runs six hygiene checks, and persists the latest run to Supabase.

**Architecture:** Pure check logic lives in `audit.js` with no I/O so it is fully unit-tested; `googleDrive.js` and a new `algolia.js` fetch raw data; `service.js` stores runs; `AuditView.js` orchestrates one drive at a time and renders results. Everything runs in the browser with the connected manager's tokens, matching the existing tool.

**Tech Stack:** React 18 (CRA + craco), Jest + RTL, Playwright, Supabase JS, Google Drive v3 REST, Google Admin SDK Reports API v1, Algolia REST (search-only key).

**Spec:** `docs/superpowers/specs/2026-10-02-shared-drive-audit-design.md`

## Global Constraints

- Work in the **base checkout** `C:\Users\sverma\Desktop\es_tools` on `main`, not the session worktree. If Write/Edit is hook-blocked there, author in the scratchpad and `cp` into place; for edits to existing files use a Node string-replace script run from PowerShell. (See memory `workspace-base-vs-worktree`.)
- **Do not commit.** The user commits themselves. Each task ends with a green test run, not a commit.
- Run Jest with `npx craco test --watchAll=false <pattern>` from the base dir in PowerShell. CRA sets `resetMocks: true`; re-apply `jest.fn()` implementations in `beforeEach` or use plain functions.
- `src/setupTests.js` makes unmocked `fetch` throw. Every test that reaches `fetch` assigns its own `global.fetch = jest.fn(...)`.
- No new runtime dependencies. Algolia is called with `fetch`, not the `algoliasearch` package.
- Code style: 4-space indent, single quotes, trailing commas, one-line arrow helpers, as in `src/tools/sharedDrive/*`.
- Spec values, verbatim: `AUDIT_PROJECT_ITEM_LIMIT = 3000`, `AUDIT_DRIVE_WARN = 400000`, `AUDIT_DRIVE_CRITICAL = 450000`, `AUDIT_ACTIVITY_DAYS = 90`, `AUDIT_MAX_ROWS = 200`, project-name rule `/^(\d{4}|E\d{8})_\S/`, scope string `https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/admin.reports.audit.readonly`.
- Env names: `REACT_APP_ALGOLIA_APP_ID`, `REACT_APP_ALGOLIA_SEARCH_KEY`.

## Review Focus

1. A drive whose client root folder (`_Clients`, `__Accounts/__Clients`) is missing must produce a `results.errors` entry, not a crash or an empty "all good". Test in Task 3.
2. A file whose `parents` is absent (orphaned shared-drive item) must still be counted toward the drive total and never throw in tree building. Test in Task 3.
3. Reports API events arrive with `parameters` as an array of `{name, value|boolValue|intValue}`; a `delete` event with no `doc_type` parameter must be ignored, not treated as a folder. Test in Task 4.
4. The Algolia response for an empty index (`nbPages: 0`, `hits: []`) must return `[]` after one request, not loop forever. Test in Task 1.
5. Cancelling mid-scan must save the run as `partial` with the drives completed so far, and the Run button must become enabled again. Test in Task 7 (orchestrator) and Task 8 (UI).

---

### Task 1: Config + Algolia master-list client

**Files:**
- Modify: `src/config.js` (append two exports)
- Modify: `src/config.test.js` (add two cases)
- Create: `src/tools/sharedDrive/algolia.js`
- Create: `src/tools/sharedDrive/algolia.test.js`

**Interfaces:**
- Produces: `ALGOLIA_APP_ID: string`, `ALGOLIA_SEARCH_KEY: string` from `src/config.js` (empty string when unset).
- Produces: `isAlgoliaConfigured(): boolean` and `listAllClients(): Promise<Array<{ title: string, reference: string }>>` from `algolia.js`. Throws `Error('Algolia is not configured')` when either env value is empty.

- [ ] **Step 1: Add failing config tests** to `src/config.test.js`, following the existing `jest.isolateModules` pattern:

```js
test('ALGOLIA_APP_ID / ALGOLIA_SEARCH_KEY default to empty strings', () => { /* delete both env vars; expect '' and '' */ });
test('ALGOLIA_APP_ID / ALGOLIA_SEARCH_KEY honour env', () => { /* set 'ENGDR4U6W2' and 'k'; expect same */ });
```

- [ ] **Step 2: Run** `npx craco test --watchAll=false config.test` → FAIL (undefined exports).

- [ ] **Step 3: Append to `src/config.js`:**

```js
// Algolia (Shared Drive Manager audit → ESE master client list). Search-only key: public-safe.
export const ALGOLIA_APP_ID = process.env.REACT_APP_ALGOLIA_APP_ID || '';
export const ALGOLIA_SEARCH_KEY = process.env.REACT_APP_ALGOLIA_SEARCH_KEY || '';
```

- [ ] **Step 4: Run** config tests → PASS.

- [ ] **Step 5: Write `algolia.test.js`** (mock `../../config` with `jest.mock('../../config', () => ({ ALGOLIA_APP_ID: 'APP', ALGOLIA_SEARCH_KEY: 'KEY' }))`; set `global.fetch = jest.fn()` in `beforeEach`):

```js
test('listAllClients pages until nbPages and maps title/reference', async () => {
    fetch.mockResolvedValueOnce(json({ hits: [{ title: 'ARTC', reference: 'ARTC' }], page: 0, nbPages: 2 }))
         .mockResolvedValueOnce(json({ hits: [{ title: 'SA Water', reference: 'SAW' }], page: 1, nbPages: 2 }));
    await expect(listAllClients()).resolves.toEqual([{ title: 'ARTC', reference: 'ARTC' }, { title: 'SA Water', reference: 'SAW' }]);
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://APP-dsn.algolia.net/1/indexes/clients/query');
    expect(init.headers['X-Algolia-Application-Id']).toBe('APP');
    expect(init.headers['X-Algolia-API-Key']).toBe('KEY');
    expect(JSON.parse(init.body)).toEqual({ query: '', hitsPerPage: 1000, page: 0, attributesToRetrieve: ['title', 'reference'] });
});
test('empty index (nbPages 0) returns [] after one request', ...);   // Review Focus 4
test('non-OK response throws with status in message', ...);           // status 403 → /403/
test('isAlgoliaConfigured false when a value is empty', ...);          // use jest.isolateModules with mocked config
```

where `json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body })`.

- [ ] **Step 6: Run** `npx craco test --watchAll=false algolia.test` → FAIL (module missing).

- [ ] **Step 7: Implement `src/tools/sharedDrive/algolia.js`** exporting `isAlgoliaConfigured` and `listAllClients`. POST per page with `method: 'POST'`, headers `X-Algolia-Application-Id`, `X-Algolia-API-Key`, `Content-Type: application/json`; loop `page` from 0 while `page < nbPages` (treat missing `nbPages` as 1); map hits to `{ title: hit.title || '', reference: hit.reference || '' }`.

- [ ] **Step 8: Run** algolia tests → PASS.

---

### Task 2: audit.js — drive classification and naming rules

**Files:**
- Create: `src/tools/sharedDrive/audit.js`
- Create: `src/tools/sharedDrive/audit.test.js`
- Modify: `src/tools/sharedDrive/service.js` (append constants)

**Interfaces:**
- Produces (service.js): `AUDIT_DRIVE_ROOTS`, `AUDIT_EXCLUDED_DRIVES`, `AUDIT_PROJECT_ITEM_LIMIT`, `AUDIT_DRIVE_WARN`, `AUDIT_DRIVE_CRITICAL`, `AUDIT_ACTIVITY_DAYS`, `AUDIT_MAX_ROWS`.
- Produces (audit.js):
  - `classifyDrive(name: string, roots = AUDIT_DRIVE_ROOTS, excluded = AUDIT_EXCLUDED_DRIVES): { kind: 'client' | 'excluded' | 'unclassified', rootPath: string[], singleClient: boolean }`
  - `normaliseName(s: string): string`
  - `closestMatch(name: string, candidates: string[]): { title: string, score: number } | null`
  - `isStandardProjectName(name: string): boolean`
  - `PROJECT_NAME_RULE: RegExp`

- [ ] **Step 1: Append to `service.js`** (below `NEW_MEMBER_EXCLUDED_DRIVES`):

```js
// ---- Audit configuration (see docs/superpowers/specs/2026-10-02-shared-drive-audit-design.md) ----
// Ordered rules mapping a shared drive to where its client folders live. `match` is a
// string (exact, case-insensitive) or RegExp on the drive name. `rootPath` is the folder
// chain under the drive root that holds client folders ([] = drive root itself).
// `singleClient: true` means the drive IS one client and its top-level folders are projects.
export const AUDIT_DRIVE_ROOTS = [
    { match: /^_[A-Z]$/i, rootPath: [] },
    { match: 'ES Cloud', rootPath: ['_Clients'] },
    { match: 'Accounts QT', rootPath: ['__Accounts', '__Clients'] },
    { match: 'United Precast', rootPath: [], singleClient: true },
    { match: 'WSP Australia', rootPath: [], singleClient: true },
];
export const AUDIT_EXCLUDED_DRIVES = ['Backups', 'Management', 'Training', 'DIT', /^Cadastral/i];
export const AUDIT_PROJECT_ITEM_LIMIT = 3000;
export const AUDIT_DRIVE_WARN = 400000;
export const AUDIT_DRIVE_CRITICAL = 450000;
export const AUDIT_ACTIVITY_DAYS = 90;
export const AUDIT_MAX_ROWS = 200;
```

- [ ] **Step 2: Write failing tests** in `audit.test.js`:

```js
describe('classifyDrive', () => {
    test.each([['_A'], ['_z']])('%s → client at drive root', (n) => expect(classifyDrive(n)).toEqual({ kind: 'client', rootPath: [], singleClient: false }));
    test('ES Cloud → _Clients', () => expect(classifyDrive('ES Cloud').rootPath).toEqual(['_Clients']));
    test('Accounts QT → __Accounts/__Clients', () => expect(classifyDrive('Accounts QT').rootPath).toEqual(['__Accounts', '__Clients']));
    test('United Precast is a single-client drive', () => expect(classifyDrive('United Precast')).toMatchObject({ kind: 'client', singleClient: true }));
    test.each([['Backups'], ['Cadastral_2024'], ['DIT']])('%s → excluded', (n) => expect(classifyDrive(n).kind).toBe('excluded'));
    test('unknown drive → unclassified', () => expect(classifyDrive('Random').kind).toBe('unclassified'));
});
describe('normaliseName', () => {
    test.each([
        ['  SA  Water ', 'sa water'], ['ARTC Pty Ltd', 'artc'], ['Ashcon Pty. Ltd.', 'ashcon'],
        ['Built Environs Limited', 'built environs'], ['A&B (Holdings)', 'ab holdings'],
    ])('%s → %s', (i, o) => expect(normaliseName(i)).toBe(o));
});
describe('closestMatch', () => {
    test('picks the nearest title with a score in [0,1]', () => {
        const m = closestMatch('SA Watr', ['SA Water', 'ARTC']);
        expect(m.title).toBe('SA Water'); expect(m.score).toBeGreaterThan(0.5); expect(m.score).toBeLessThanOrEqual(1);
    });
    test('empty candidates → null', () => expect(closestMatch('x', [])).toBeNull());
});
describe('isStandardProjectName', () => {
    test.each([['2025_Bethany_College'], ['E20250066_Road_Rehab'], ['2023_10_Roberts']])('%s ok', (n) => expect(isStandardProjectName(n)).toBe(true));
    test.each([['Bethany'], ['2025X'], ['20250066_X'], ['e20250066_X'], ['2025_'], ['_2025']])('%s not ok', (n) => expect(isStandardProjectName(n)).toBe(false));
});
```

- [ ] **Step 3: Run** `npx craco test --watchAll=false audit.test` → FAIL.

- [ ] **Step 4: Implement** in `audit.js`. Import the constants from `./service`. `normaliseName`: lower-case, replace `[^a-z0-9 ]` with space, collapse whitespace, trim, then strip a trailing `pty ltd`, `ltd` or `limited` (regex `/\s+(pty\s+ltd|ltd|limited)$/`) and trim again. `closestMatch`: Dice coefficient over character bigrams of the normalised strings; return the best `{ title, score }` or `null`. `isStandardProjectName = (n) => PROJECT_NAME_RULE.test(String(n || ''))`.

- [ ] **Step 5: Run** audit tests → PASS.

---

### Task 3: audit.js — tree, counts, folder derivation, list capping

**Files:**
- Modify: `src/tools/sharedDrive/audit.js`
- Modify: `src/tools/sharedDrive/audit.test.js`

**Interfaces:**
- Consumes: `classifyDrive` (Task 2).
- Produces:
  - `FOLDER_MIME = 'application/vnd.google-apps.folder'`
  - `buildTree(files: Array<{id,name,mimeType,parents?,createdTime?,trashed?,lastModifyingUser?}>, driveId: string): { byId: Map, childrenOf: Map<string, string[]>, total: number, trashed: number }` — `childrenOf` keyed by parent id; files with no `parents` go under key `'__orphan__'`.
  - `descendantCounts(tree): Map<string, number>` — count of all descendants (files + folders, incl. trashed) per folder id, iterative.
  - `findRoot(tree, driveId, rootPath: string[]): string | null` — walk `rootPath` by folder name (case-insensitive) from `driveId`; `null` if any segment is missing.
  - `deriveFolders(tree, driveId, classification): { clientFolders: Array<{id,name}>, projectFolders: Array<{id,name,clientName}>, looseItems: Array<{id,name}>, error?: string }` — for `singleClient`, `clientFolders = [{ id: rootId, name: driveName }]`; missing root → `{ clientFolders: [], projectFolders: [], looseItems: [], error: 'Client root "<path>" not found' }`.
  - `capList(list: any[], max = AUDIT_MAX_ROWS): { rows: any[], total: number }`.

- [ ] **Step 1: Write failing tests** using one fixture:

```js
const D = 'drv1';
const f = (id, name, parent, extra = {}) => ({ id, name, mimeType: extra.folder ? FOLDER_MIME : 'text/csv', parents: parent ? [parent] : undefined, trashed: !!extra.trashed });
const FILES = [
    f('c1', 'ARTC', D, { folder: true }), f('p1', '2025_Depot', 'c1', { folder: true }), f('x1', 'a.csv', 'p1'), f('x2', 'b.csv', 'p1', { trashed: true }),
    f('c2', 'Unknown Co', D, { folder: true }), f('loose', 'stray.csv', D), f('orphan', 'ghost.csv', null),
];
test('buildTree counts total and trashed, buckets orphans', () => { const t = buildTree(FILES, D); expect(t.total).toBe(7); expect(t.trashed).toBe(1); expect(t.childrenOf.get('__orphan__')).toEqual(['orphan']); });  // Review Focus 2
test('descendantCounts includes nested + trashed', () => { const c = descendantCounts(buildTree(FILES, D)); expect(c.get('p1')).toBe(2); expect(c.get('c1')).toBe(3); });
test('findRoot walks a path case-insensitively', () => { /* add folders _Clients under D; expect id; missing → null */ });
test('deriveFolders at drive root', () => {
    const r = deriveFolders(buildTree(FILES, D), D, { kind: 'client', rootPath: [], singleClient: false });
    expect(r.clientFolders.map((c) => c.name)).toEqual(['ARTC', 'Unknown Co']);
    expect(r.projectFolders).toEqual([{ id: 'p1', name: '2025_Depot', clientName: 'ARTC' }]);
    expect(r.looseItems.map((l) => l.name)).toEqual(['stray.csv']);
});
test('deriveFolders missing root → error, empty lists', () => { const r = deriveFolders(buildTree(FILES, D), D, { kind: 'client', rootPath: ['_Clients'], singleClient: false }); expect(r.error).toMatch(/_Clients/); expect(r.projectFolders).toEqual([]); });  // Review Focus 1
test('deriveFolders singleClient uses drive as client', () => { /* projectFolders = top-level folders, clientName = driveName passed via classification.driveName */ });
test('capList caps and keeps true total', () => expect(capList([1, 2, 3], 2)).toEqual({ rows: [1, 2], total: 3 }));
```

Note: `deriveFolders` needs the drive name for `singleClient`; pass it as `classification.driveName` (add `driveName` to the object `classifyDrive` returns in Task 2: `classifyDrive(name)` includes `driveName: name`). Update the Task 2 `toEqual` assertions to `toMatchObject`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** `descendantCounts`: compute post-order iteratively (stack of `[id, visited]`), only for folder ids; a trashed folder still counts its children. `deriveFolders`: clients = folder children of root; projects = folder children of each client (or of root for `singleClient`); looseItems = non-folder children of root.

- [ ] **Step 4: Run** → PASS.

---

### Task 4: audit.js — Reports API event reducers

**Files:**
- Modify: `src/tools/sharedDrive/audit.js`
- Modify: `src/tools/sharedDrive/audit.test.js`

**Interfaces:**
- Produces:
  - `paramMap(event): Record<string, any>` — folds `event.events[0].parameters` (`{name, value|boolValue|intValue|multiValue}`) into a flat object.
  - `reduceDeletions(events: any[]): Array<{ when: string, actor: string, driveName: string, docTitle: string, docId: string }>` — keeps events where `paramMap.doc_type === 'folder'`, `when = event.id.time`, `actor = event.actor.email || 'unknown'`, `driveName = params.shared_drive_name || params.team_drive_name || ''`, sorted by `when` desc.
  - `reduceCreates(events: any[], projectFolderIds: Set<string>, knownActors: string[]): Array<{ actor: string, lastCreatedAt: string | null, lastProject: string | null, driveName: string | null, countInWindow: number }>` — folder-create events whose `doc_id ∈ projectFolderIds`, one row per actor (lower-cased email), plus one row with nulls / 0 for each `knownActors` email with no events; sorted by `lastCreatedAt` desc with nulls last.

- [ ] **Step 1: Write failing tests** with a helper `ev = (time, email, name, params) => ({ id: { time }, actor: { email }, events: [{ name, parameters: Object.entries(params).map(([k, v]) => (typeof v === 'boolean' ? { name: k, boolValue: v } : { name: k, value: String(v) })) }] })`:

```js
test('reduceDeletions keeps folders only, newest first', () => {
    const out = reduceDeletions([
        ev('2026-09-01T00:00:00Z', 'a@engsurveys.com.au', 'delete', { doc_type: 'folder', doc_title: 'Old', doc_id: 'f1', shared_drive_name: '_A' }),
        ev('2026-09-02T00:00:00Z', 'b@engsurveys.com.au', 'delete', { doc_type: 'document', doc_title: 'x', doc_id: 'f2' }),
        ev('2026-09-03T00:00:00Z', 'c@engsurveys.com.au', 'delete', { doc_title: 'no type', doc_id: 'f3' }),            // Review Focus 3
    ]);
    expect(out).toEqual([{ when: '2026-09-01T00:00:00Z', actor: 'a@engsurveys.com.au', driveName: '_A', docTitle: 'Old', docId: 'f1' }]);
});
test('reduceCreates: one row per actor, known-but-idle actors appear with nulls', () => {
    const out = reduceCreates([
        ev('2026-09-01T00:00:00Z', 'A@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'p1', doc_title: '2026_One', shared_drive_name: '_A' }),
        ev('2026-09-05T00:00:00Z', 'a@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'p2', doc_title: '2026_Two', shared_drive_name: '_B' }),
        ev('2026-09-06T00:00:00Z', 'a@engsurveys.com.au', 'create', { doc_type: 'folder', doc_id: 'notproject', doc_title: 'sub' }),
    ], new Set(['p1', 'p2']), ['a@engsurveys.com.au', 'idle@engsurveys.com.au']);
    expect(out).toEqual([
        { actor: 'a@engsurveys.com.au', lastCreatedAt: '2026-09-05T00:00:00Z', lastProject: '2026_Two', driveName: '_B', countInWindow: 2 },
        { actor: 'idle@engsurveys.com.au', lastCreatedAt: null, lastProject: null, driveName: null, countInWindow: 0 },
    ]);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.

---

### Task 5: googleDrive.js — scope, absolute-URL fetch, tree listing, Reports API

**Files:**
- Modify: `src/tools/sharedDrive/googleDrive.js`
- Create: `src/tools/sharedDrive/googleDrive.test.js`

**Interfaces:**
- Produces:
  - `SCOPE` = the two-scope string from Global Constraints.
  - `listDriveTree(driveId: string, onPage?: (countSoFar: number) => void): Promise<Array<file>>` — `files.list` pages of 1000 with the exact query params from the spec, no `q`; calls `onPage` after each page.
  - `listAuditEvents(eventName: 'delete' | 'create', sinceIso: string): Promise<any[]>` — Reports API, pages on `nextPageToken`; on HTTP 403 throws an `Error` with `err.status = 403` (caller decides).
  - `api(path, opts)` now accepts an absolute `https://` URL as `path` (used as-is) in addition to a `/drive/v3`-relative path.

- [ ] **Step 1: Write failing tests.** At the top of the test file, before importing the module, seed a token so `api()` never tries to connect: `sessionStorage.setItem('es_sdm_gtoken', JSON.stringify({ access_token: 'T', expiresAt: Date.now() + 3600e3 }))`. Mock `../../config` → `{ GOOGLE_CLIENT_ID: 'cid' }`. `global.fetch = jest.fn()` in `beforeEach`.

```js
test('SCOPE includes drive and reports audit', () => expect(SCOPE).toBe('https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/admin.reports.audit.readonly'));
test('listDriveTree pages with the spec params and reports progress', async () => {
    fetch.mockResolvedValueOnce(json({ files: [{ id: 'a' }], nextPageToken: 'p2' })).mockResolvedValueOnce(json({ files: [{ id: 'b' }] }));
    const seen = []; const out = await listDriveTree('D1', (n) => seen.push(n));
    expect(out.map((f) => f.id)).toEqual(['a', 'b']); expect(seen).toEqual([1, 2]);
    const u = new URL(fetch.mock.calls[0][0]);
    expect(u.pathname).toBe('/drive/v3/files');
    expect(Object.fromEntries(u.searchParams)).toEqual({ corpora: 'drive', driveId: 'D1', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', pageSize: '1000', fields: 'nextPageToken,files(id,name,mimeType,parents,createdTime,trashed,lastModifyingUser(emailAddress))' });
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get('pageToken')).toBe('p2');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer T');
});
test('listAuditEvents hits the Reports API and pages', async () => {
    fetch.mockResolvedValueOnce(json({ items: [{ id: { time: 't1' } }], nextPageToken: 'n' })).mockResolvedValueOnce(json({ items: [{ id: { time: 't2' } }] }));
    const out = await listAuditEvents('delete', '2026-07-04T00:00:00Z');
    expect(out).toHaveLength(2);
    const u = new URL(fetch.mock.calls[0][0]);
    expect(u.origin + u.pathname).toBe('https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/drive');
    expect(Object.fromEntries(u.searchParams)).toEqual({ eventName: 'delete', startTime: '2026-07-04T00:00:00Z', maxResults: '1000' });
});
test('listAuditEvents 403 surfaces err.status', async () => { fetch.mockResolvedValueOnce(json({ error: { message: 'Not Authorized' } }, 403)); await expect(listAuditEvents('create', 'x')).rejects.toMatchObject({ status: 403 }); });
```

Note: `SCOPE` is not currently exported; export it.

- [ ] **Step 2: Run** `npx craco test --watchAll=false googleDrive.test` → FAIL.

- [ ] **Step 3: Implement.** In `api()`, `const url = path.startsWith('https://') ? path : \`${API}${path}\``. Export `SCOPE`. Add `listDriveTree` and `listAuditEvents` as described; `listAuditEvents` builds `https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/drive?eventName=…&startTime=…&maxResults=1000` and appends `pageToken` on later pages; returns the concatenated `items` (default `[]`).

- [ ] **Step 4: Run** → PASS. Also run `npx craco test --watchAll=false sharedDrive` to confirm nothing else in the folder broke.

---

### Task 6: Supabase storage — migration, service functions, setup doc

**Files:**
- Create: `supabase/migrations/0005_shared_drive_audit.sql`
- Modify: `src/tools/sharedDrive/service.js`
- Create: `src/tools/sharedDrive/service.test.js`
- Modify: `supabase/SETUP.md` (§5c and §6 env block)

**Interfaces:**
- Produces: `saveAuditRun(run: { id?: string, started_at?, finished_at?, actor, status, reports_available, drives_done, drives_total, results }): Promise<{ id: string }>` — upsert by `id`, returns the row id; `loadLatestAuditRun(): Promise<AuditRun | null>` — newest by `started_at`. Both no-op (`{ id: null }` / `null`) when `supabase` is null.

- [ ] **Step 1: Write the migration** using the `supabase-migration` skill conventions (idempotent, RLS policy named `sd_audit_runs_rw`, same `profiles.role in ('admin','manager')` predicate as 0003). Table columns exactly as the spec's SQL block, plus `create index if not exists shared_drive_audit_runs_started_idx on public.shared_drive_audit_runs (started_at desc);`.

- [ ] **Step 2: Write failing service tests.** `jest.mock('../../lib/supabase', () => ({ supabase: { from: fromMock } }))` with a chainable fake (`from().upsert().select().single()` and `from().select().order().limit()`); re-apply implementations in `beforeEach`.

```js
test('saveAuditRun upserts into shared_drive_audit_runs and returns id', ...);  // expect from('shared_drive_audit_runs'), upsert called with the run, returns { id: 'r1' }
test('loadLatestAuditRun orders by started_at desc, limit 1, returns row or null', ...);
test('both no-op when supabase is null', ...);  // jest.isolateModules with supabase: null
```

- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** in `service.js`. **Step 5: Run** → PASS.

- [ ] **Step 6: Update `supabase/SETUP.md` §5c:** add step 5 "Run migration `0005_shared_drive_audit.sql`"; step 6 "Algolia: in the Algolia dashboard (app `ENGDR4U6W2`) create a **Search-only** API key restricted to index `clients`; set `REACT_APP_ALGOLIA_APP_ID` and `REACT_APP_ALGOLIA_SEARCH_KEY`. Do not reuse the desktop app's admin key."; step 7 "The Audit tab's deletions and last-created checks use the Admin SDK Reports API: the connecting Google account needs Workspace admin reports access, and everyone will be asked to re-consent once because the scope changed." Add the two env lines to the §6 block. Also correct the §5c opener from "admin/manager-only" to "manager-only".

---

### Task 7: audit.js — runAudit orchestrator

**Files:**
- Modify: `src/tools/sharedDrive/audit.js`
- Modify: `src/tools/sharedDrive/audit.test.js`

**Interfaces:**
- Consumes: Tasks 2–4 functions; constants from `service.js`.
- Produces:

```js
emptyResults(): Results  // all nine lists empty — keys exactly: unknownClients, looseItems, nonStandardProjects, oversizedProjects, driveCaps, deletions, lastCreated, unclassifiedDrives, errors
runAudit({
    drives: Array<{ id, name }>,
    deps: { listDriveTree, listAuditEvents, listAllClients, now?: () => Date },
    knownActors: string[],
    onProgress: (p: { driveIndex, driveTotal, driveName, items, results }) => Promise<void> | void,
    shouldCancel: () => boolean,
}): Promise<{ results: Results, status: 'complete' | 'partial', reportsAvailable: boolean | null, drivesDone: number }>
```

Behaviour: fetch master list once (failure → `errors.push({ drive: '*', message: 'Master list unavailable: …' })` and skip check 1). For each drive in order: classify; `listDriveTree` (failure → `errors.push({ drive: name, message })`, continue); push `driveCaps` row `{ drive, driveId, total, trashed, level }`; if `unclassified` push to `unclassifiedDrives` and continue; if `excluded` continue; `deriveFolders` (error → `errors`); unknown clients → `{ drive, client, folderId, closest: closestMatch(...) }`; loose items → one `{ drive, count, samples: first 20 names }` if any; non-standard and oversized projects as per spec; call `onProgress` after each drive; check `shouldCancel()` before starting the next drive → stop with `status: 'partial'`. After the drive loop (or on cancel), call `listAuditEvents('delete', since)` and `('create', since)` with `since = now() - AUDIT_ACTIVITY_DAYS days` ISO; a 403 sets `reportsAvailable = false` and leaves both lists empty; any other error → `errors`; otherwise `reportsAvailable = true`, reduce. Finally cap every list with `capList`, storing `{ rows, total }` in place of raw arrays.

- [ ] **Step 1: Write failing tests** with fake deps built from the Task 3 fixture:

```js
test('runAudit produces all six checks for one client drive', async () => { /* drives [{id:'drv1',name:'_A'}]; listAllClients → [{title:'ARTC'}]; listDriveTree → FILES + an oversized project fixture (3001 children generated); listAuditEvents → the Task 4 events; expect unknownClients.rows[0].client === 'Unknown Co', looseItems.rows[0].count === 1, nonStandardProjects.rows contain the bad name, oversizedProjects.rows[0].count === 3001, driveCaps.rows[0].level === 'ok', deletions.total === 1, status 'complete', reportsAvailable true */ });
test('excluded drive only gets a driveCaps row; unclassified is listed', ...);
test('listDriveTree failure is recorded and the scan continues', ...);
test('Reports 403 → reportsAvailable false, no throw', ...);
test('shouldCancel after first drive → partial with drivesDone 1', ...);  // Review Focus 5
test('driveCaps level thresholds: 399999 ok, 400000 warn, 450000 critical', ...);  // listDriveTree returns arrays of that length
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement `runAudit`.** **Step 4: Run** → PASS.

---

### Task 8: AuditView UI, nav wiring, styles, e2e

**Files:**
- Create: `src/tools/sharedDrive/AuditView.js`
- Create: `src/tools/sharedDrive/AuditView.test.js`
- Modify: `src/tools/sharedDrive/SharedDriveManager.js` (nav array + view branch)
- Modify: `src/tools/sharedDrive/SharedDriveManager.css` (append `.sdm-audit*` rules)
- Modify: `e2e/app.spec.js` (manager describe block)
- Modify: `e2e/fixtures.js:92` area (add `shared_drive_audit_runs` → `[]` route before the generic `/rest/v1/` fallback; already covered by the fallback, so only add if a specific shape is needed)

**Interfaces:**
- Consumes: `runAudit`, `emptyResults` (Task 7); `listDriveTree`, `listAuditEvents`, `listDrives` (Task 5 / existing); `listAllClients`, `isAlgoliaConfigured` (Task 1); `saveAuditRun`, `loadLatestAuditRun`, `relative` (Task 6 / existing); `useToast`, `Spinner`.
- Produces: `export default AuditView({ connected: boolean, drives: Array<{id,name}>, knownActors: string[], actor: string })`.

- [ ] **Step 1: Wire the nav** in `SharedDriveManager.js`: add `['audit', faClipboardCheck, 'Audit', auditCount]` to the nav array (import `faClipboardCheck`), hold `const [auditCount, setAuditCount] = useState(null)`, and render `{view === 'audit' && <AuditView connected={connected} drives={drives} knownActors={allPeople.map((p) => p.email)} actor={actor} onCount={setAuditCount} />}`. Badge shows `auditCount ?? '—'`.

- [ ] **Step 2: Write failing RTL tests** for `AuditView` (mock `./audit`, `./service`, `./algolia`, `./googleDrive`, `../../components/Toast`):

```js
test('shows last run line and findings counts from loadLatestAuditRun', ...);   // mock returns a complete run with results; expect "Last run" text and a chip "1" on Unknown clients
test('Run audit disabled when not connected; enabled when connected', ...);
test('clicking Run calls runAudit then saveAuditRun and renders the results', ...);
test('Cancel during a run marks it partial', ...);                             // Review Focus 5: runAudit mock calls onProgress then checks shouldCancel → returns partial; expect status text "partial" and Run enabled again
test('Algolia not configured shows the notice on the Unknown clients panel', ...);
test('reportsAvailable false shows the admin-access notice on Deletions and Last created', ...);
```

- [ ] **Step 3: Run** `npx craco test --watchAll=false AuditView` → FAIL.

- [ ] **Step 4: Implement `AuditView.js`.** State: `run` (latest row or null), `running`, `progress`, `cancelRef = useRef(false)`. On mount `loadLatestAuditRun()`; call `onCount(sum of every list's total)` whenever `run` changes. `start()`: create a row via `saveAuditRun({ actor, status: 'running', drives_total: drives.length, results: emptyResults() })`, then `runAudit` with `deps = { listDriveTree, listAuditEvents, listAllClients: isAlgoliaConfigured() ? listAllClients : async () => { throw new Error('Algolia not configured'); } }`, `onProgress` → `setProgress` and `saveAuditRun({ id, drives_done, results })`, `shouldCancel: () => cancelRef.current`; finish with `saveAuditRun({ id, finished_at: new Date().toISOString(), status, reports_available, drives_done, results })` and `setRun(...)`. Storage failures: toast once, continue. Layout: `.sdm-head` with title "Drive audit", last-run line (`Last run ${relative(run.started_at)} by ${run.actor} · ${run.status}`), `Run audit` / `Cancel` buttons; progress bar `Drive ${i} of ${n} · ${name} · ${items.toLocaleString()} items`; seven `<details className="sdm-audit-panel">` panels (six checks + Notes) each with a `.sdm-chip` count and a `.sdm-audit-table` grid; "showing 200 of N" footer when `rows.length < total`; drive-cap rows get `.warn` / `.critical` classes.

- [ ] **Step 5: Append CSS** for `.sdm-audit-panel`, `.sdm-audit-panel summary`, `.sdm-audit-table` (grid, 13px, row border `var(--sdm-line2)`), `.sdm-progress` (track `var(--sdm-line)`, fill `var(--sdm-yellow)`), `.sdm-audit-row.warn` (`var(--sdm-yellow-bg)`), `.sdm-audit-row.critical` (`var(--sdm-red-bg)`, text `var(--sdm-red-tx)`).

- [ ] **Step 6: Run** AuditView tests → PASS; then `npx craco test --watchAll=false sharedDrive` → all PASS.

- [ ] **Step 7: Add the e2e test** inside `test.describe('as a manager', …)`:

```js
test('opens the Audit tab', async ({ page }) => {
    await page.goto('/tools/shared-drive-manager');
    await page.getByRole('button', { name: /^Audit/i }).click();
    await expect(page.getByRole('heading', { name: /Drive audit/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Run audit/i })).toBeDisabled(); // Google not configured in e2e
});
```

- [ ] **Step 8: Verify.** From PowerShell in the base dir: `$env:CI='false'; npm run build` → succeeds with no new ESLint warnings; `npx playwright test app.spec.js` → the new test passes along with the existing manager test.

- [ ] **Step 9: Update memory** `shared-drive-manager.md` with: Audit tab exists, migration 0005 required, Algolia env vars, re-consent due to new scope.

---

## Self-review notes

- Spec coverage: classification (T2), scan + tree (T3, T5), six checks (T2–T4 rules, T7 orchestration), storage (T6), UI + nav + progress + cancel (T8), config + scopes (T1, T5), error handling (T7 tests), testing section (every task), SETUP.md (T6). No gaps found.
- Types: `classifyDrive` returns `{ kind, rootPath, singleClient, driveName }` everywhere after the Task 3 note; `Results` keys are identical in Task 7 and Task 8; `saveAuditRun` field names are the snake_case column names in all tasks.
- Commits intentionally omitted per the user's standing preference.
