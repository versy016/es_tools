# ES Tools — Supabase setup runbook

Run these steps once to stand up the backend for the app
(`https://<project-ref>.supabase.co`). Your **service-role key never leaves
your machine** — it's only used by the Supabase CLI / dashboard, never committed.

Order: **1) database → 2) first admin → 3) template → 4) auth → 5) edge functions →
6) frontend env → 7) verify.**

---

## 0. Prerequisites

- Access to the Supabase project dashboard.
- (For edge functions) the Supabase CLI: `npm i -g supabase`, then
  `supabase login` and `supabase link --project-ref <project-ref>`.

## 1. Database schema + RLS + buckets

This creates the `profiles`, `reports`, `audit` tables, all RLS policies, the
`reports` + `templates` storage buckets, and the new-user trigger. It is idempotent.

**Option A — SQL editor (no CLI):** open the SQL editor in the dashboard, paste the
contents of [`migrations/0001_init.sql`](migrations/0001_init.sql), and run. Then do the
same for [`migrations/0002_profile_tools.sql`](migrations/0002_profile_tools.sql) (adds the
per-user tool allowlist). Both are idempotent.

**Option B — CLI:** `supabase db push` (applies every file in `migrations/`).

✅ Check: Table editor shows `profiles`, `reports`, `audit`; Storage shows the
`reports` and `templates` buckets. This fixes the old `profiles 404` / `templates 400`.

## 2. Create the first admin

Sign in to the app once with your account (email/password) so your `profiles` row
exists, then in the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'sverma@engsurveys.com.au';
```

Roles form a hierarchy: **`manager` (top) > `admin` > `surveyor`**. Managers and admins
see the **Users** page and can invite / change roles / deactivate / restrict tools
(enforced by the `admin-users` function); surveyors cannot. A **manager** can act on
anyone (including admins) and is the only role that can create other managers or restrict
an admin's tools; an **admin** can manage everyone **except** managers. Per-user tool
access is stored in `profiles.tools` (NULL = all tools) — see migration `0002`.

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
- **Google (optional)**: Authentication → Providers → **Google**; the app's
  `signInWithGoogle()` targets `provider: 'google'`. Create a Google OAuth client
  (Cloud Console), and add the callback URL Supabase shows you to that client's
  authorized redirect URIs. For Workspace-only access, keep its consent screen Internal.

## 5. Edge functions

From the repo root (CLI linked as in step 0):

```bash
# Privileged user admin — KEEP JWT verification on (the function re-checks admin).
supabase functions deploy admin-users

# Report email over SMTP — public endpoint, called by the app with a plain fetch.
supabase functions deploy send-report --no-verify-jwt

# Gmail / Google Workspace (recommended: implicit SSL on 465):
supabase secrets set \
  SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true \
  SMTP_USER=you@gmail.com SMTP_PASS=xxxxxxxxxxxxxxxx \
  SMTP_FROM="Engineering Surveys <you@gmail.com>"
#   SMTP_PASS MUST be a 16-char Google **App Password** (Google Account → Security →
#   2-Step Verification → App passwords) — your normal Gmail password will be rejected.
#   The function defaults to smtp.gmail.com:465 SSL, so those three can be omitted for Gmail.
#   (For a provider that needs STARTTLS on 587, set SMTP_PORT=587 and SMTP_SECURE=false.)

# (Optional) Service Location PDF export via the Google Drive API (see step 5a).
supabase functions deploy docx-to-pdf --no-verify-jwt
```

`admin-users` needs no secrets — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
injected into the function runtime automatically.

### 5a. Google Drive PDF converter (optional)

`docx-to-pdf` converts the Service Location `.docx` to PDF by uploading it to Google
Drive as a Google Doc, exporting that as PDF, and deleting the temp file — so the data
stays inside your Workspace tenant. Set up entirely in the **Google Cloud Console** (no
Workspace Admin console needed):

1. **Google Cloud Console** → create/pick a project → **APIs & Services → Enable APIs →
   Google Drive API**.
2. **OAuth consent screen** → User Type **Internal** (engsurveys.com.au only — no Google
   verification, long-lived tokens) → add the scope `https://www.googleapis.com/auth/drive`.
3. **Credentials → Create credentials → OAuth client ID → Web application**. Under
   **Authorized redirect URIs** add `https://developers.google.com/oauthplayground`.
   Note the **Client ID** and **Client secret**.
4. Get a refresh token once via the [OAuth Playground](https://developers.google.com/oauthplayground):
   - Gear icon → tick **Use your own OAuth credentials** → paste the client ID/secret.
     Confirm **Access type: Offline** and **Force prompt: Consent Screen** → Close.
   - Step 1: in **Input your own scopes** paste `https://www.googleapis.com/auth/drive`
     → **Authorize APIs** → sign in as a Workspace user → Allow.
   - Step 2: **Exchange authorization code for tokens** → copy the **refresh_token**
     (starts with `1//`).
5. Secrets:
   ```bash
   # supabase/functions/.env  (git-ignored)
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxx
   GOOGLE_REFRESH_TOKEN=1//xxxx
   ```

> The OAuth client must be a **Web application** with the playground redirect URI above
> (a Desktop client gives `redirect_uri_mismatch`). Keep the consent screen **Internal**
> (or Published) — an **External + Testing** screen expires the refresh token after 7 days.

#### Apply + test

```bash
supabase secrets set --env-file supabase/functions/.env
```

Then test:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/docx-to-pdf \
  -F "file=@public/templates/service-location.docx" -o out.pdf
```

> Note: `send-report` is deployed `--no-verify-jwt` (it's hit by a plain `fetch`). It's
> an internal endpoint guarded by CORS; if you want to lock it down further, add a shared
> secret header check in the function later.

### 5b. Branded auth emails (Send Email Hook)

ES Tools sends its **own branded HTML** for every auth email — invite, password reset,
signup confirmation, magic link, email change, reauthentication — instead of Supabase's
built-in templates. Supabase's "Send Email Hook" calls the `send-email-hook` function for
each email; it renders the branded HTML and sends via your SMTP.

1. Deploy the function:
   ```bash
   supabase functions deploy send-email-hook --no-verify-jwt
   ```
2. Enable the hook: **Authentication → Hooks → Send Email Hook** → Enable → type **HTTPS**
   → URI `https://<project-ref>.supabase.co/functions/v1/send-email-hook`. Supabase shows a
   **signing secret** (`v1,whsec_…`) — copy it.
3. Set the secrets (SMTP_* are reused from `send-report`):
   ```bash
   supabase secrets set \
     SEND_EMAIL_HOOK_SECRET='v1,whsec_...' \
     ALLOWED_EMAIL_DOMAIN=engsurveys.com.au \
     SITE_URL=https://estools.com.au
   ```
   - `SEND_EMAIL_HOOK_SECRET` — verifies the request really came from Supabase Auth.
   - `ALLOWED_EMAIL_DOMAIN` — password-reset emails are only sent to this domain (abuse guard).
   - `SITE_URL` — invited users are redirected to `<SITE_URL>/reset-password` to set a password.
4. **Auth → URL Configuration → Redirect URLs**: allow `https://estools.com.au/reset-password`
   (and `http://localhost:3000/reset-password` for local dev).

Once the hook is enabled, Supabase **stops** sending its default templated emails — the Auth
"SMTP provider settings" screen is no longer used for these; the hook sends via the function's
own `SMTP_*` secrets. Verify: **Users → Invite** (branded invite arrives) and **Login → Forgot
password** (branded reset link arrives, only for `@engsurveys.com.au`).

### 5c. Shared Drive Manager (Google Drive)

The Shared Drive Manager (admin/manager-only tool) manages Google shared drives + access.
Drives + membership are read/written **directly from the browser** using the signed-in
manager's Google token (per-user OAuth — no service account). The reusable **Members
Directory** and the **Activity Log** are Supabase tables.

1. **Database:** run migration [`0003_shared_drive.sql`](migrations/0003_shared_drive.sql)
   (SQL editor or `supabase db push`) — creates `shared_drive_directory` +
   `shared_drive_activity` with admin/manager RLS.
2. **Google Cloud Console** (same project is fine):
   - **APIs & Services → Enable APIs → Google Drive API.**
   - **OAuth consent screen** → User type **Internal** (engsurveys.com.au) → add scope
     `https://www.googleapis.com/auth/drive`.
   - **Credentials → Create credentials → OAuth client ID → Web application.** Under
     **Authorized JavaScript origins** add `https://estools.com.au` and
     `http://localhost:3000`. Copy the **Client ID** (it ends `.apps.googleusercontent.com`).
3. **Frontend env:** set `REACT_APP_GOOGLE_CLIENT_ID=<that client id>` in `.env` / `.env.local`
   and rebuild. (Public value, baked into the bundle — fine; it's not a secret.)
4. **Who can use it:** the tool is restricted to ES Tools **admins/managers**, and the
   Google account they connect must be allowed to manage shared drives. A **Workspace
   admin** sees/edits every shared drive (via domain-admin access); a non-admin only sees
   drives they belong to. Members are added as **Content Manager** (no notification email).

> No service-account key or domain-wide delegation needed — each manager authorises their
> own Google account when they open the tool (token is in-memory, re-prompted each session).

## 6. Frontend environment

Create `.env` (or `.env.local`) in the repo root — these are public/publishable keys:

```
REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx

# Email + PDF (the function URLs from step 5)
REACT_APP_EMAIL_ENDPOINT=https://<project-ref>.supabase.co/functions/v1/send-report
REACT_APP_DOCX_PDF_ENDPOINT=https://<project-ref>.supabase.co/functions/v1/docx-to-pdf

# Internal archive copy of every report (flip to bgosling@ after testing)
REACT_APP_REPORT_ARCHIVE_EMAIL=sverma@engsurveys.com.au

# Shared Drive Manager — Google OAuth client id (step 5c)
REACT_APP_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

Restart `npm start` after editing env files.

## 7. Verify end-to-end

1. Sign in — no `profiles 404`; your name/role show in the navbar.
2. **Profile**: edit details + draw a signature → reload → both persist.
3. **Pothole Report Generator**: create → **Generate** saves a row in `reports` + a PDF in the
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
