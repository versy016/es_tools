# ES Tools — Supabase setup

Authentication, database and file storage now run on **Supabase** (migrated off AWS
Cognito + Amplify S3).

## 1. Create the project
1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.

## 2. Configure the web app
Create `es_tools/.env.local` (git-ignored):
```
REACT_APP_SUPABASE_URL=https://<your-project>.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```
Use the **publishable** key (new format) — or `REACT_APP_SUPABASE_ANON_KEY` for older
projects; both are accepted. Then restart (`npm start`). Until these are set the app shows
a "Connect Supabase" screen instead of crashing.

## 3. Create the schema
Open **SQL editor** in Supabase, paste the contents of `schema.sql`, and run it.
This creates the `profiles`, `reports`, `audit` tables, row-level-security policies,
the private `reports` storage bucket, and a trigger that auto-creates a profile row
for each new user.

## 4. Create users
- For an internal tool: **Authentication → Users → Add user** (or invite by email).
- The first user you want as admin: after they sign in once, set their role —
  `update public.profiles set role = 'admin' where email = 'sverma@engsurveys.com.au';`
- Roles: `admin` (manage everyone), `manager` (see all reports + approve),
  `surveyor` (own reports only).

## 5. (Optional) Sign in with Microsoft 365
1. In Supabase **Authentication → Providers → Azure**, enable it and paste your
   Azure app registration's client ID/secret (redirect URL is shown there).
2. The Login screen's "Continue with Microsoft" button already calls
   `signInWithOAuth({ provider: 'azure' })`.

## 6. Service Location template + PDF export
The Service Location report is rendered **in the browser** from a `.docx` template
(`public/templates/service-location.docx`) — no AWS Lambda. To let admins swap the
letterhead without a redeploy, upload the template to the `templates` bucket:
- Storage → `templates` bucket → upload `service-location.docx` (same filename).
- The app prefers the bucket copy and falls back to the bundled one.
- If you edit the Word template, re-run `node scripts/prep-template.js` so the
  `{tags}` and the `{#photos}…{/photos}` image loop stay intact.

**PDF export** converts that rendered `.docx` to PDF via the `docx-to-pdf` Edge Function
(`supabase/functions/docx-to-pdf`), which uses the **Google Drive API** (uploads the doc,
exports it as PDF, deletes it) so the data stays inside your Workspace tenant. Setup
(service account + domain-wide delegation + secrets) is in **`SETUP.md` §5a**:
```
supabase functions deploy docx-to-pdf --no-verify-jwt
supabase secrets set --env-file supabase/functions/.env   # GOOGLE_SA_* + impersonate subject
```
Then set `REACT_APP_DOCX_PDF_ENDPOINT=https://<project>.functions.supabase.co/docx-to-pdf`.
Until configured, the tool produces the `.docx` and shows a "PDF available once the
converter is configured" note.

## What this replaces
- Cognito login → Supabase Auth.
- Amplify S3 (`reports/`, `profile/`) → Supabase Storage (`reports` bucket) + `reports`
  table; signature/profile in the `profiles` table.
- `admin-service` Cognito Lambda → `profiles`/`audit` tables + RLS (no Lambda needed for
  list/role/active; emailing invites still uses Supabase's invite or the dashboard).
- `email-service` (SMTP) can stay as-is, or be replaced by a Supabase Edge Function later.
