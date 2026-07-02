# Handoff: Shared Drive Manager (ES Tools)

## Overview
Shared Drive Manager is an **admin/manager-only** console inside ES Tools for Google Workspace
housekeeping: creating shared drives and controlling who has access, individually and in bulk
across dozens of drives. It replaces a legacy desktop app's chained pop-up windows with a single
console: a **drives table**, a **members directory**, a reusable **activity log**, and
slide-over / modal panels for add/remove operations with multi-select and inline progress.

The primary user is an admin doing bulk membership changes; the design prioritises making
"who has access to what" obvious and making bulk operations clear and safe.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing
the intended look, copy, and behaviour. **They are not production code to paste in.** The task is
to **recreate this design inside the existing ES Tools React SPA**, using its established
component library, routing, state, and API layer.

> **The global ES Tools top navbar has been intentionally removed** from
> `Shared Drive Manager (tool).dc.html`. This tool renders **inside the existing app shell** — do
> not rebuild the ES logo / top nav / global search / avatar. Only the tool body is in scope:
> the left sub-nav (Shared Drives / Members Directory / Activity Log) **is** part of the tool.

### How to preview the prototype
Open `Shared Drive Manager (tool).dc.html` in a browser (it loads `support.js` from the same
folder). Everything is clickable with in-memory sample data — create drives, add/remove members,
paginate, filter, and watch the activity log update. No backend; state resets on reload.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, copy, and interactions are all as intended.
Recreate the UI faithfully using ES Tools' existing components (buttons, pills, modals, toasts,
table). Where ES Tools already has an equivalent primitive (pill button, status chip, modal,
toast, spinner overlay), **use that** rather than reproducing these inline styles verbatim.

Note: the prototype root is rendered at `zoom: 0.9` to increase density — treat that as "compact
density", not a literal transform. Use the px values documented below (they are pre-zoom values).

---

## Screens / Views

The tool has three primary views (switched via the left sub-nav) plus a set of overlays. A single
piece of view state (`view: 'drives' | 'members' | 'activity'`) drives which primary view shows.

### Left sub-nav (persistent, sticky)
- Width 246px, sticky. Section label "SHARED DRIVE MANAGER" (11px/700, letter-spacing .8px, #9a9182).
- Three nav items, each a pill row (radius 12px, padding 11px 13px): icon + label (14px/600–700) +
  count badge on the right. **Active** item: background `#1B2230`, white text, count in `#F5A623`.
  **Inactive**: transparent, text `#6b6357`, count `#a99f8d`, hover background `#EFEADF`.
  - Shared Drives — count = total drives
  - Members Directory — count = total members
  - Activity Log — count = total log entries
- Below the nav: a callout card (background `#FBEFD6`, border `#F3E0B8`, radius 12px): lock icon +
  "Manager level access only" (12.5px/700, `#8a6a1a`) and "Bulk changes here affect real Google
  Workspace access." (11.5px, `#a07f2e`).

### 1. Drives Overview (`view === 'drives'`)
- **Purpose:** browse/search/sort all shared drives, multi-select for bulk actions, quick access.
- **Header row:** H1 "Shared Drives" (25px/800, letter-spacing -.5px) + subtitle (14px/500,
  `#8A8172`) on the left; on the right two buttons: **Add members** (charcoal secondary) and
  **Create drive** (yellow primary).
- **Toolbar:** search input (pill, 320px, magnifier icon, placeholder "Search drives by name") on
  the left; on the right "Sort" label + two toggle buttons **Name** and **Members** (each shows
  ↑/↓ when active; clicking toggles direction).
- **Filter row:** "Filter" label + segmented pill buttons **All / Standard / Protected / Empty**
  (single-select; active = charcoal fill / white text).
- **Bulk action bar** (only when ≥1 drive selected): charcoal bar (radius 14px) with
  "N drive(s) selected" + **Add members** (yellow) + **Remove members** (outline-on-dark) +
  **Clear**. Animates in (pop 0.2s).
- **Table (card, white, radius 16px, border `#ECE5D8`):**
  - Grid columns: `40px | minmax(180px,2.2fr) | minmax(150px,1.4fr) | minmax(120px,1.1fr) | minmax(150px,1.1fr)` with `column-gap:18px`.
  - Header (46px, background `#FAF7F0`): select-all checkbox, DRIVE, MEMBERS, LAST ACTIVITY, ACTIONS. Header labels 11.5px/700, letter-spacing .4px, `#9a9182`.
  - Row (64px, hover `#FCFAF5`): selection checkbox **OR** a lock glyph for protected drives
    (protected drives cannot be selected); folder icon tile (34px, radius 9px, `#F3EEE4`); drive
    name (14.5px/700) with a "Protected" chip beneath if excluded; a member avatar stack (up to 3
    circles, 28px, `#1B2230`/white initials, -8px overlap) + "N members"; last-activity text
    (13px, `#9a9182`); actions = **View members** (outline pill) + a round yellow **+** (add member)
    icon button (`#FBEFD6` bg, `#F3E0B8` border).
- **Pagination footer** (when > 12 rows): "X–Y of Z" left; ‹ prev, numbered page buttons (active =
  charcoal), next › right. 12 rows per page.
- **Empty state:** dashed card, folder icon, title + text (search/filter-aware) + Create drive CTA.

### 2. Members Directory (`view === 'members'`)
- **Purpose:** manage the reusable people list (separate from who is on each drive).
- Header: H1 "Members Directory" + subtitle; right: **Add member** (yellow primary).
- Toolbar: search (pill, 340px, "Search people by name or email") + on the right "Filter" +
  segmented **All / On drives / No access**.
- Table columns: `minmax(150px,1.3fr) | minmax(150px,1.5fr) | 140px | 100px | 140px`.
  Header: PERSON, EMAIL, ROLE, ON DRIVES, ACTIONS. Row (62px): avatar (34px circle) + name; email
  (`#6b6357`); role chip "Content Manager" (pill, `#EEF1F6` bg, `#3A4557` text); "in N drive(s)";
  actions = **View drives** (outline pill) + a red trash icon button (`#F1D6D6` border, `#D0454A`).
- Pagination footer, 12 per page. Empty state as above (people icon).
- **Member rows are NOT multi-selectable** (this was explicitly removed — single-row actions only).

### 3. Activity Log (`view === 'activity'`)
- **Purpose:** audit trail of every change (who did what, when).
- Header H1 "Activity Log" + subtitle. Filter chips: **All / Created / Added / Removed / Directory**.
- Timeline card: each row = a 38px rounded icon tile (colour by category) + title (14.5px/700) +
  detail line ("Alex Morgan · 4 added"; red text when the entry is destructive/errored) + relative
  timestamp on the right ("8m ago", "Yesterday", "6d ago").
  - Category colours: **create** `#FBEFD6`/`#8a6a1a`, **add** `#E4F3E9`/`#2E9E5B`,
    **remove** `#FCEBEC`/`#D0454A`, **directory** `#EEF1F6`/`#3A4557`.
- Seeded with sample history; **every real action in the tool prepends a new entry.**

### Overlays

**Drive members slide-over** (right panel, 480px, slides in): drive name + "Protected" chip +
"N members" header, full-width **Add member** button, then a scrollable member list (avatar, name,
email · Content Manager, **Remove** button per row). Empty state when the drive has no members.

**Person drives slide-over** (right panel, 480px): person avatar/name/email header, "On N drives",
an **Add to drives** button, then the list of drives the person is on with a **Remove** per row.

**Add / Remove members wizard** (right slide-over, 520px): a 3-step flow with a segmented progress
bar and "Step X of N" label.
- Step 1 — **Choose people**: searchable directory list with checkboxes; "N selected".
- Step 2 — **Choose drives**: scope chips (This drive / Selected drives / All drives) + a checkable
  drive list; protected drives are disabled with a "Protected" tag and a note "N protected drives
  are excluded from bulk changes".
- Step 3 — **Review & confirm**: summary sentence + chips of chosen people and target drives; the
  Remove flow adds a red warning note.
- Footer: Back / Cancel / primary (yellow for Add, red for Remove; disabled state when nothing valid).
- **Person-scoped shortcut:** opening the wizard from a single person (Person slide-over → Add to
  drives) or from the directory skips Step 1 (people are pre-locked). It becomes a 2-step flow with a
  banner ("Adding <name> — drives they already belong to are greyed out"). For a single person,
  drives they're already in are **disabled + "Already a member"** and sorted below the available ones.

**Create drive modal** (centered, 480px, max-height 88vh): drive-name input with inline validation
(empty → "Please enter a drive name."; duplicate → "A shared drive with this name already exists.");
then a **Members to add** picker — a "N selected" count, a search box, and a scrollable list with a
sticky **Select all** row (respects the search filter). The default member set (first 3 people) is
pre-selected. Cancel / **Create drive**.

**Add member modal** (centered, 440px): Full name + Email inputs; validation (both required; email
must end `@engsurveys.com.au`; no duplicates). Cancel / **Add member**.

**Confirm modal** (centered): warning icon, title, message, optional checkbox (e.g. "Also remove
from all shared drives"), Cancel + a confirm button (red for destructive, yellow otherwise). Used
for removing a person from the directory.

**Loading overlay** (full-screen, z 80): spinner + "Updating drive X of N…" + "Please keep this tab
open until it finishes." + a yellow progress bar. Shown during bulk add/remove.

**Results modal** (centered, ≤500px, scrollable): success/error icon, summary ("Added 33
memberships · 33 skipped"), a **SKIPPED** section (e.g. "Already a member — matched jsmith ↔
john.smith") and a **FAILED** section ("Permission denied — needs Workspace admin"). Done button.

**Toast** (bottom-center, z 90): success (green check) or error (red ×, with a Dismiss). Auto-hides
after ~3.6s.

---

## Interactions & Behavior
- **Navigation:** left sub-nav switches primary view; search resets to page 1.
- **Sorting:** Name / Members toggle asc/desc; resets to page 1.
- **Filtering:** drive & member filter chips; combine with search; page resets to 1; empty state
  copy adapts when a filter/search is active.
- **Pagination:** 12 rows/page, prev/next + numbered pages, clamps when the result set shrinks.
- **Multi-select (drives only):** per-row checkboxes (protected drives excluded), select-all over
  the current filtered set, contextual bulk bar.
- **Bulk add/remove:** simulated async progress stepping through target drives (~200–800ms/drive),
  then a results summary. **Protected drives are always skipped.** Adds that hit an existing member
  are **skipped** (with the fuzzy-match note for the seeded alias case); removes can **fail** with
  "needs Workspace admin" (permission error surface).
- **Fuzzy-match skip:** when adding someone already on a drive, they're skipped; the seeded
  `john.smith` shows "matched jsmith ↔ john.smith".
- **Create drive:** validates name, creates with the chosen members, toasts, opens the new drive's
  panel, logs activity.
- **Directory remove:** branded confirm with "also remove from all drives" option.
- **Animations:** slide-overs `translateX` 0.28s cubic-bezier(.2,.8,.2,1); modals pop 0.24s;
  backdrops fade 0.18–0.2s; toast rises 0.28s; spinner 0.8s linear.
- **Every mutating action appends an Activity Log entry.**

## State Management
Recreate with the codebase's state approach (hooks/store). Core state in the prototype:
- `view` — 'drives' | 'members' | 'activity'
- `drives[]` — `{ id, name, excluded (protected), memberIds[], activity }`
- `people[]` — `{ id, first, last, name, email, initials }` (the directory)
- `selected[]` — selected drive ids (bulk)
- `search`, `sortKey`, `sortDir`, `driveFilter`, `memberFilter`, `drivePage`, `memberPage`
- `panelId` / `personId` — which slide-over is open
- `flow` — the add/remove wizard: `{ mode, step, scope, personIds[], targetIds[], contextDriveId, lockPerson, lockPeople }`
- Modal/overlay flags: `createOpen` (+ `createName`, `createMembers[]`, `createMemberSearch`),
  `addPersonOpen`, `confirm` (+ `confirmExtra`), `results` / `resultsOpen`, `loading`, `toast`
- `activityLog[]` — `{ id, ts, actor, type, title, detail, tone }`
- `logFilter`

**Data requirements for production:** list shared drives + member counts; list a drive's members;
list the directory; create drive; add/remove members (bulk, per-drive, returning per-item
skipped/failed with reasons — including permission errors); directory CRUD; and an activity/audit
feed. The excluded/"protected" flag must come from the backend.

## Design Tokens
**Colours**
- Accent yellow (primary) `#F5A623`; yellow tint bg `#FBEFD6`, border `#F3E0B8`, text `#8a6a1a`
- Ink / charcoal (text, dark buttons) `#1B2230`; near-black `#130C0E`
- Page background `#F3EFE7`; surfaces white `#FFFFFF`; header/zebra `#FAF7F0`, `#FCFAF5`
- Borders `#ECE5D8`, `#F0EADF`, `#F3EEE4`, outline-button border `#E2DACC`
- Muted text `#8A8172`, `#9a9182`, `#6b6357`, `#a99f8d`; secondary `#546070`, `#3A4557`
- Destructive red `#E5484D` (fills), `#D0454A` / `#a13539` (text/icon), tint `#FCEBEC` / `#F3CFD1`
- Success green `#2E9E5B`, tint `#E4F3E9`; info tint `#EEF1F6` / `#DDE3EC`

**Typography** — Plus Jakarta Sans (400/500/600/700/800).
- H1 25/800 (-.5px); panel H2 19–20/800; body 13.5–14.5; table header 11.5/700 (.4px);
  chips/badges 11–13/700; buttons 13.5–14/700–800.

**Radius** — buttons/pills 999px; cards/modals/panels 16–20px; icon tiles 8–12px; inputs 10–12px.

**Shadow** — card `0 1px 2px rgba(19,12,14,.05)`; bulk bar `0 8px 24px rgba(19,12,14,.18)`;
slide-over `-8px 0 40px rgba(19,12,14,.16)`; modal `0 24px 64px rgba(19,12,14,.28)`;
primary button `0 2px 8px rgba(245,166,35,.35)`.

**Layout** — content max-width 1440px; left sub-nav 246px; slide-overs 480–520px; row heights
46 (header) / 62–64 (rows); table page size 12.

## Assets
- **Font:** Google Fonts "Plus Jakarta Sans". Use the ES Tools font if one is already standard.
- **Icons:** all inline SVG (stroke-based, ~1.8–2.6 stroke width) — search, folder, folder-plus,
  user, user-plus, user-minus, users, lock, plus, minus, chevrons ‹ ›, check, close ×, trash,
  warning triangle, activity pulse. Swap for the codebase's existing icon set (Lucide/Feather-style).
- **Avatars:** initials on `#1B2230` circles; the signed-in user avatar is yellow. No image assets.
- **Sample data** (drives like `_A`, `Client Drive – Smith`, `Accounts QT`; people with
  `first.last@engsurveys.com.au`) is placeholder for the prototype only.

## Files
- `Shared Drive Manager (tool).dc.html` — the tool prototype **with the global navbar removed**
  (renders inside the ES Tools shell). Primary reference.
- `support.js` — runtime needed to open the `.dc.html` prototype in a browser. Not for production.

A full-app version of the prototype (including the demo navbar) lives in the project as
`Shared Drive Manager.dc.html` if you want to see it in the ES Tools shell context.
