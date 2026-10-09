# Shared Drive Manager — Audit tab

Date: 2026-10-02. Status: approved in conversation, awaiting written review.

## Purpose

Give managers a one-click health check of the Google shared drives so misuse and drift
are caught early: client folders that are not real ESE clients, project folders that
ignore the naming standard, projects that have grown past 3,000 items, drives nearing
Google's 500,000-item cap, folder deletions, and who last created a project.

Audience: ES Tools users with the `manager` role, using the existing Shared Drive
Manager. Success: a manager opens the Audit tab, clicks Run audit, and within a few
minutes sees six populated lists, with the last run persisted for the next visit.

## Scope

In scope: a new Audit view inside `src/tools/sharedDrive/`, one Supabase table, a
browser-side Algolia client, one extra Google scope, unit tests, one e2e test.

Out of scope (deliberately): the local `C:\_Clients` mirror, CSV export, scheduled or
background sweeps, fixing anything the audit finds.

## Architecture

```
Audit view (React)
  ├─ runAudit()                 orchestrates, drive by drive, saves progress
  │    ├─ googleDrive.listDriveTree(driveId)      Drive v3 files.list, 1000/page
  │    ├─ googleDrive.listAuditEvents(kind, since)  Admin SDK Reports API
  │    ├─ algolia.listAllClients()                 search-only key, 1000/page
  │    └─ audit.js (pure)                          tree, counts, rules, reducers
  └─ service.saveAuditRun / loadLatestAuditRun     Supabase table
```

All Google and Algolia calls run in the browser with the connected manager's tokens,
matching the rest of the tool. No new backend code beyond one migration.

### Files

| File | Role |
|---|---|
| `src/tools/sharedDrive/audit.js` | Pure functions: drive classification, tree build, descendant counts, name normalisation and matching, prefix rule, event reducers. No I/O. |
| `src/tools/sharedDrive/audit.test.js` | Jest tests for everything in audit.js. |
| `src/tools/sharedDrive/algolia.js` | `listAllClients()` against Algolia's REST API with the search-only key. |
| `src/tools/sharedDrive/googleDrive.js` | Add `listDriveTree`, `listAuditEvents`; extend `SCOPE`. |
| `src/tools/sharedDrive/service.js` | Add `AUDIT_DRIVE_ROOTS`, `AUDIT_EXCLUDED_DRIVES`, thresholds, `saveAuditRun`, `loadLatestAuditRun`. |
| `src/tools/sharedDrive/AuditView.js` | The tab UI: run button, progress, six check panels. |
| `src/tools/sharedDrive/SharedDriveManager.js` | Fourth nav item `audit`; renders `AuditView`. |
| `src/tools/sharedDrive/SharedDriveManager.css` | Audit panel styles under `.sdm-audit*`. |
| `src/config.js` | `ALGOLIA_APP_ID`, `ALGOLIA_SEARCH_KEY`. |
| `supabase/migrations/0005_shared_drive_audit.sql` | `shared_drive_audit_runs` table + RLS. |
| `supabase/SETUP.md` | §5c additions: Algolia key, re-consent, admin requirement. |
| `e2e/app.spec.js` | Manager sees the Audit tab. |

## Drive classification

`AUDIT_DRIVE_ROOTS` in service.js is an ordered list of rules, matched by drive name:

| Match | Client root | Notes |
|---|---|---|
| `/^_[A-Z]$/` | drive root | Per-letter client drives. |
| `ES Cloud` | `_Clients` | Legacy path. Root folder found by name under the drive root. |
| `Accounts QT` | `__Accounts/__Clients` | Quotes. Nested path, each segment found by name. |
| `United Precast`, `WSP Australia` | drive is the client | `singleClient: true`; the drive name is the client name and top-level folders are projects. |

`AUDIT_EXCLUDED_DRIVES` = `Backups`, `Management`, `Training`, `DIT`, and `/^Cadastral/`.
Excluded drives skip the client and project checks but are still counted for the
item-cap check. A drive matching neither list is reported under "Unclassified drives"
so nothing is silently skipped; it is counted for the cap only.

Definitions used by every check:

- Client folder: a folder whose parent is the client root.
- Project folder: a folder whose parent is a client folder (or, for `singleClient`
  drives, whose parent is the drive root).
- Loose item: any non-folder whose parent is the client root.

## Scan

`listDriveTree(driveId)` calls `files.list` with `corpora=drive`, `driveId`,
`includeItemsFromAllDrives=true`, `supportsAllDrives=true`, `pageSize=1000`, and
`fields=nextPageToken,files(id,name,mimeType,parents,createdTime,trashed,lastModifyingUser(emailAddress))`.
No `q` filter, so trashed items are included; the item cap counts them.

`audit.buildTree(files, driveId)` returns `{ byId, childrenOf }` maps. Descendant
counts are computed once per folder with an iterative post-order pass (no recursion,
drives can hold hundreds of thousands of items). The 500,000 figure is the total number
of files returned for the drive.

The scan runs one drive at a time. After each drive finishes, its stats and findings
are merged into the in-progress run and the row is upserted, so a browser closed
mid-run still leaves partial results with `status: 'partial'`. Progress UI shows
`Drive 12 of 41 · _M · 38,400 items`.

Drive API quota: a full sweep is roughly one request per 1,000 items. At the default
12,000 requests per minute per user this is well within limits; the wall-clock cost is
network latency, estimated at 2 to 5 minutes for the current estate.

## The six checks

### 1. Unknown clients

- Master list: `algolia.listAllClients()` POSTs to
  `https://{APP_ID}-dsn.algolia.net/1/indexes/clients/query` with
  `{ query: '', hitsPerPage: 1000, page: n, attributesToRetrieve: ['title','reference'] }`
  and loops until `page >= nbPages`. Returns `[{ title, reference }]`.
- Normalisation (`audit.normaliseName`): lower-case, trim, collapse whitespace,
  strip characters other than letters, digits and spaces, drop a trailing
  `pty ltd` / `pty. ltd.` / `ltd` / `limited`.
- A client folder is unknown when its normalised name matches no normalised master
  `title`. For each unknown, `audit.closestMatch` returns the master title with the
  highest Dice coefficient over character bigrams, shown as a hint, with its score.
- Loose items at the client root are reported as one finding per drive:
  `{ drive, count, samples: first 20 names }`.

### 2. Non-standard project names

Rule (`audit.isStandardProjectName`): `/^(\d{4}|E\d{8})_\S/`. The year form is what
the desktop app prefills; the `E` form is the ESE tender reference the app inserts when
a tender is picked. Finding: `{ drive, client, name, folderId }`.

### 3. Oversized projects

Project folders with descendant count `> 3000` (`AUDIT_PROJECT_ITEM_LIMIT`). Finding:
`{ drive, client, name, folderId, count }`, sorted by count descending.

### 4. Drive item cap

Per drive: `{ drive, driveId, total, trashed, level }` where level is `ok` below
400,000, `warn` from 400,000, `critical` from 450,000 (`AUDIT_DRIVE_WARN`,
`AUDIT_DRIVE_CRITICAL`). Every drive appears here, including excluded and
unclassified ones, so the panel doubles as a size table.

### 5. Deletions

`listAuditEvents('delete', since)` calls
`GET https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/drive?eventName=delete&startTime=<ISO>&maxResults=1000`
and pages on `nextPageToken`. Window: now minus 90 days (`AUDIT_ACTIVITY_DAYS`).
`audit.reduceDeletions(events)` keeps events whose `doc_type` parameter is `folder`,
emitting `{ when, actor, driveName, docTitle, docId, ownerIsTeamDrive }`. Sorted newest
first. Any folder anywhere counts, per the agreed scope.

### 6. Staff last created

`listAuditEvents('create', since)` with the same window.
`audit.reduceCreates(events, projectFolderIds)` keeps folder-create events whose
`doc_id` is a known project folder from the scan, then reduces to one row per actor:
`{ actor, lastCreatedAt, lastProject, driveName, countInWindow }`. Actors are joined
with the Members Directory plus live drive members so staff who created nothing in the
window still appear with `none in 90 days`.

If the Reports API returns 403, checks 5 and 6 show a single notice: "The connected
Google account needs Workspace admin reports access" and the run is still saved with
`status: 'complete'` and `reportsAvailable: false`.

## Storage

Migration `0005_shared_drive_audit.sql`:

```sql
create table if not exists public.shared_drive_audit_runs (
    id uuid primary key default gen_random_uuid(),
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    actor text,
    status text not null default 'running',   -- running | partial | complete | failed
    reports_available boolean,
    drives_done int not null default 0,
    drives_total int not null default 0,
    results jsonb not null default '{}'::jsonb
);
```

RLS: same manager/admin policy shape as 0003. `results` layout:

```json
{
  "unknownClients": [], "looseItems": [], "nonStandardProjects": [],
  "oversizedProjects": [], "driveCaps": [], "deletions": [], "lastCreated": [],
  "unclassifiedDrives": [], "errors": [{ "drive": "_B", "message": "..." }]
}
```

Each list is capped at 200 entries (`AUDIT_MAX_ROWS`); the UI shows `showing 200 of
3,656` when capped. `loadLatestAuditRun()` returns the most recent row by
`started_at`. The run id is held in component state for the upserts during a scan.

## UI

Nav item: `Audit` with the count of findings from the latest run as its badge.

Header: "Drive audit" with the last run line (`Last run 2 h ago by Shivam · complete`)
and a `Run audit` button, disabled while running or when Google is not connected.
When Algolia env vars are missing, check 1 shows "Algolia not configured" and the rest
still run.

Progress: a bar plus the per-drive line described above. Cancel stops after the
current drive and marks the run `partial`.

Six collapsible panels, one per check, each with a count chip and a plain table.
Severity colour on the drive-cap rows uses the existing `--sdm-red-*` / `--sdm-yellow-*`
tokens. Unclassified drives and per-drive errors appear in a seventh "Notes" panel.

## Config and scopes

`src/config.js` gains `ALGOLIA_APP_ID = process.env.REACT_APP_ALGOLIA_APP_ID || ''`
and `ALGOLIA_SEARCH_KEY = process.env.REACT_APP_ALGOLIA_SEARCH_KEY || ''`. Both are
public-safe values; the search-only key must be created in the Algolia dashboard (the
desktop app's embedded key is an admin key and must not be reused).

`googleDrive.js` `SCOPE` becomes
`https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/admin.reports.audit.readonly`.
Everyone who connected before will be prompted once to re-consent. The fetch helper is
generalised to accept an absolute URL so the Reports endpoint reuses the same token,
401 retry and error mapping.

## Error handling

- A drive that fails to list is recorded in `results.errors` and the scan continues.
- Algolia failure: check 1 reports "Master list unavailable" and the run proceeds.
- Reports API 403: handled as described in check 5.
- Supabase upsert failure during a run: toast once, keep scanning in memory, retry the
  upsert at the end. The audit is never blocked by storage.

## Testing

Jest (`audit.test.js`), all pure, no network:

- `classifyDrive` for each rule and for an unknown drive.
- `buildTree` + `descendantCount` on a small fixture, including a trashed item and an
  item with no parent.
- `normaliseName` edge cases: suffixes, punctuation, double spaces.
- `closestMatch` returns the right title and a score in `[0,1]`.
- `isStandardProjectName` positives (`2025_X`, `E20250066_X`) and negatives
  (`X`, `2025X`, `20250066_X`, `e20250066_X`).
- `reduceDeletions` filters to folders and sorts newest first.
- `reduceCreates` keeps only known project folders and reduces per actor.
- `capList` caps at 200 and reports the true total.

`algolia.js` and the new `googleDrive.js` functions get tests with `fetch` mocked,
covering paging and the 403 path.

Playwright: as a manager, the Audit nav item is visible and clicking it shows the
"Drive audit" heading and a disabled Run button when Google is not configured.

## Open items

None. All questions raised during design were answered: Audit tab in the web tool,
Algolia direct with a search-only key, every shared drive with an exclude list,
90-day window, any folder deletion, 400k/450k thresholds, on-demand run saved to
Supabase.
