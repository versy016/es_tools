# ES Tools — Supabase setup runbook

Run these steps once to stand up the backend for the app
(`https://rqjywiqdeqzdzlyfmden.supabase.co`). Your **service-role key never leaves
your machine** — it's only used by the Supabase CLI / dashboard, never committed.

Order: **1) database → 2) first admin → 3) template → 4) auth → 5) edge functions →
6) frontend env → 7) verify.**

---

## 0. Prerequisites

- Access to the Supabase project dashboard.
- (For edge functions) the Supabase CLI: `npm i -g supabase`, then
  `supabase login` and `supabase link --project-ref rqjywiqdeqzdzlyfmden`.

## 1. Database schema + RLS + buckets

This creates the `profiles`, `reports`, `audit` tables, all RLS policies, the
`reports` + `templates` storage buckets, and the new-user trigger. It is idempotent.

**Option A — SQL editor (no CLI):** open the SQL editor in the dashboard, paste the
contents of [`migrations/0001_init.sql`](migrations/0001_init.sql), and run.

**Option B — CLI:** `supabase db push`

✅ Check: Table editor shows `profiles`, `reports`, `audit`; Storage shows the
`reports` and `templates` buckets. This fixes the old `profiles 404` / `templates 400`.

## 2. Create the first admin

Sign in to the app once with your account (email/password) so your `profiles` row
exists, then in the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'sverma@engsurveys.com.au';
```

Roles are `admin` | `manager` | `surveyor`. Only `admin`/`manager` see the **Users**
page; only `admin` can invite/role/deactivate (enforced by the `admin-users` function).

## 3. Upload the report template (optional)

The app falls back to the bundled `public/templates/service-location.docx`, so this is
optional. To manage it centrally: Storage → `templates` bucket → upload
`service-location.docx` (keep that exact name).

## 4. Auth configuration

- **Authentication → Providers → Email**: enabled. For invites to work, leave email
  signups on. Configure the SMTP sender (Authentication → Emails) or use Supabase's
  built-in email for invite/confirmation links.
- **Authentication → URL Configuration**: add your app origin (e.g.
  `http://localhost:3000` and the deployed URL) to **Redirect URLs** so invite and
  OAuth callbacks land back in the app.
- **Microsoft (optional)**: Authentication → Providers → **Azure**; the app's
  `signInWithMicrosoft()` already targets `provider: 'azure'`.

## 5. Edge functions

From the repo root (CLI linked as in step 0):

```bash
# Privileged user admin — KEEP JWT verification on (the function re-checks admin).
supabase functions deploy admin-users

# Report email over SMTP — public endpoint, called by the app with a plain fetch.
supabase functions deploy send-report --no-verify-jwt
supabase secrets set SMTP_HOST=smtp.yourhost.com SMTP_PORT=587 \
  SMTP_USER=apikey-or-user SMTP_PASS=your-smtp-password \
  SMTP_FROM="Engineering Surveys <office@engsurveys.com.au>"
#   add SMTP_SECURE=true only if you use implicit TLS on port 465

# (Optional) Service Location PDF export via the Google Drive API (see step 5a).
supabase functions deploy docx-to-pdf --no-verify-jwt
```

`admin-users` needs no secrets — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
injected into the function runtime automatically.

### 5a. Google Drive PDF converter (optional)

`docx-to-pdf` converts the Service Location `.docx` to PDF by uploading it to Google
Drive as a Google Doc, exporting that as PDF, and deleting the temp file — so the data
stays inside your Workspace tenant. Pick **ONE** auth method and set its secrets.

Both start the same way: **Google Cloud Console** → create/pick a project →
**APIs & Services → Enable APIs → Google Drive API**.

#### Option A — OAuth refresh token (no Admin console; all in the dev console)

1. **OAuth consent screen** → User Type **Internal** (engsurveys.com.au only — no
   Google verification, long-lived tokens) → add the scope
   `https://www.googleapis.com/auth/drive`.
2. **Credentials → Create credentials → OAuth client ID → Desktop app**. Note the
   **Client ID** and **Client secret**.
3. Get a refresh token once (easiest: [OAuth Playground](https://developers.google.com/oauthplayground)
   → gear icon → "Use your own OAuth credentials" → paste client ID/secret → authorize
   the Drive scope as a Workspace user → "Exchange authorization code for tokens" → copy
   the **refresh_token**).
4. Secrets:
   ```bash
   # supabase/functions/.env  (git-ignored)
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxx
   GOOGLE_REFRESH_TOKEN=1//xxxx
   ```

> Must be a **Desktop-app** client for the Playground flow, and the consent screen must
> be **Internal** (or Published) — an **External + Testing** screen expires the refresh
> token after 7 days.

#### Option B — Service account + domain-wide delegation (needs the Admin console once)

1. **Credentials → Create credentials → Service account**, then **Keys → Add key → JSON**
   (gives `client_email` + `private_key`).
2. **Workspace Admin console** → **Security → API controls → Domain-wide delegation →
   Add new**: paste the service account's **Client ID** and scope
   `https://www.googleapis.com/auth/drive` → Authorise.
3. Secrets:
   ```bash
   # supabase/functions/.env  (git-ignored)
   GOOGLE_SA_EMAIL=es-tools@your-project.iam.gserviceaccount.com
   GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_IMPERSONATE_SUBJECT=office@engsurveys.com.au   # a real Workspace user to act as
   ```

#### Apply + test (either option)

The function uses the refresh-token secrets if present, else the service-account ones.

```bash
supabase secrets set --env-file supabase/functions/.env
```

Then test:

```bash
curl -X POST https://rqjywiqdeqzdzlyfmden.functions.supabase.co/docx-to-pdf \
  -F "file=@public/templates/service-location.docx" -o out.pdf
```

> Note: `send-report` is deployed `--no-verify-jwt` (it's hit by a plain `fetch`). It's
> an internal endpoint guarded by CORS; if you want to lock it down further, add a shared
> secret header check in the function later.

## 6. Frontend environment

Create `.env` (or `.env.local`) in the repo root — these are public/publishable keys:

```
REACT_APP_SUPABASE_URL=https://rqjywiqdeqzdzlyfmden.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx

# Email + PDF (the function URLs from step 5)
REACT_APP_EMAIL_ENDPOINT=https://rqjywiqdeqzdzlyfmden.functions.supabase.co/send-report
REACT_APP_DOCX_PDF_ENDPOINT=https://rqjywiqdeqzdzlyfmden.functions.supabase.co/docx-to-pdf

# Internal archive copy of every report (flip to bgosling@ after testing)
REACT_APP_REPORT_ARCHIVE_EMAIL=sverma@engsurveys.com.au
```

Restart `npm start` after editing env files.

## 7. Verify end-to-end

1. Sign in — no `profiles 404`; your name/role show in the navbar.
2. **Profile**: edit details + draw a signature → reload → both persist.
3. **Photo Report**: create → **Generate** saves a row in `reports` + a PDF in the
   `reports` bucket → it appears on **Dashboard** and **Reports** → download works →
   **Export & email** sends via `send-report`.
4. **Service Location**: generate the `.docx` (and PDF if docx-to-pdf is deployed) →
   **Send via email** works; address autocomplete biases to Australia.
5. **RBAC**: a `surveyor` doesn't see **Users** and is redirected from `/users`; an
   `admin` sees it, can invite a user (they get an email), and change a role — each
   action shows up in the **Audit log**.
6. **Sign out** from the navbar returns to the Login screen.

## Cleanup (after verifying email works)

The AWS `email-service/` and `admin-service/` folders are superseded by the
`send-report` and `admin-users` edge functions and can be deleted.
