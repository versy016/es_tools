# ES Tools — Testing

Two layers, both designed so **tests never write to the real database** — there is
nothing to clean up because nothing real is ever created.

| Layer | Runner | What it covers | How it stays data-safe |
|---|---|---|---|
| **Frontend / unit** | Jest + React Testing Library | pure logic, services, components | the Supabase client and `fetch` are **mocked**; unmocked network is **blocked** |
| **Site-wide / E2E** | Playwright (Chromium) | the real app in a real browser | every Supabase request is **intercepted** in the browser, so no call reaches the backend |

If a test is ever pointed at the real backend on purpose and leaves a row behind,
`npm run cleanup:test-data` removes it (safety net, see below).

---

## 1. Frontend / unit tests (Jest)

```bash
npm test            # watch mode (dev)
npm run test:ci     # single run, exits non-zero on failure (CI)
npm run test:coverage
```

Tests live next to the code as `*.test.js`:

- `src/report/legendColors.test.js` — DBYD/AS 5488 palette + `getUtility` fallback + quality levels.
- `src/config.test.js` — env-driven config (archive email default/override, email endpoint).
- `src/services/emailService.test.js` — send path: recipient de-dupe/archive, backend + network error surfacing (`fetch` mocked).
- `src/services/reportsService.test.js` — save/draft/load/list/remove against a **fake in-memory Supabase client**.
- `src/components/PotholePanel.test.js` — pothole auto-numbering (PH01, PH02…), rename, remove.
- `src/components/SignOffSection.test.js` — sign-off `getValue()` shape, date formatting, "add my signature".

### Why these can't populate the database

- **`src/setupTests.js` blocks real network.** `global.fetch` is replaced with a stub
  that throws on any unmocked call, so a test can't accidentally hit a server.
- **The Supabase client is mocked** in service tests (`jest.mock('../lib/supabase')`).
  The real `@supabase/supabase-js` is never loaded, so `saveReport`/`saveDraft`/etc.
  write to in-memory arrays, not the project.

> **Gotcha for contributors:** CRA's Jest config sets `resetMocks: true`, which clears a
> `jest.fn()`'s implementation before every test. So define mock behaviour with **plain
> functions inside the `jest.mock` factory** (immune to reset), or re-apply it in
> `beforeEach` via `mockResolvedValue`/`mockImplementation`. See the existing tests.

---

## 2. Site-wide / E2E tests (Playwright)

Kept out of the default install to keep it light. One-time setup:

```bash
npm run e2e:install     # adds @playwright/test as a devDependency + downloads Chromium
```

Run:

```bash
npm run e2e             # headless (boots `npm start` automatically)
npm run e2e:ui          # interactive runner
```

Specs live in `e2e/` (shared helpers in `e2e/fixtures.js`):

- **`smoke.spec.js`** — the app boots without uncaught errors (works configured *or* not),
  and a guard that no request escapes to a real backend host.
- **`auth.spec.js`** — sign-in/sign-up: branded screen renders, mode toggle reveals the
  full-name field, email is required before submit, invalid-credentials surfaces the
  backend error, a **successful sign-in transitions into the dashboard**, and the Google
  button kicks off the OAuth handshake.
- **`app.spec.js`** — the **authenticated** app: lands on the dashboard tool grid,
  navbar navigation (Reports/Users/Profile), **RBAC** (admin sees Users; a surveyor
  doesn't and is redirected from `/users`), opening a tool tile, and sign-out.

### Why these can't populate the database

`e2e/fixtures.js` intercepts **every** Supabase/Maps/Algolia request in the browser and
answers it locally. Signed-in flows are faked by **seeding a session into localStorage**
(no real login) and returning fake profile/report rows — so the run never signs in for
real and never reads or writes a real row. PostgREST `.single()` vs list shapes are
honoured via the `Accept: …pgrst.object…` header.

### Requirements / gating

The authenticated + login specs need the app to be **configured** — they read
`REACT_APP_SUPABASE_URL` from `.env.local`/`.env` to derive the project ref for the auth
localStorage key. On a box without that env they **skip automatically** (only the
env-agnostic smoke test runs). Nothing here contacts the real project regardless.

---

## 3. Cleanup safety net

For the rare case where someone runs a test/flow against the **real** backend and it
writes a row, follow the convention of titling test reports with a `[TEST]` prefix, then:

```bash
# dry run — lists what it would delete
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run cleanup:test-data
# actually delete
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-test-data.mjs --yes
```

It finds `reports` whose title starts with `[TEST]`, deletes their storage files, then
the rows. Needs the **service-role** key (read from env, never printed or committed).
```
