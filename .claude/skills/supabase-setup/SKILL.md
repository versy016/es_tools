---
name: supabase-setup
description: Stand up, verify, or troubleshoot the es_tools Supabase backend — apply the database migration, create storage buckets + the first admin, deploy the edge functions with their secrets, and set the frontend env vars. Use when the user wants to deploy/configure Supabase or hits profiles 404, templates 400, or email/invites not working.
---

# Supabase setup (es_tools)

The full runbook lives in [`supabase/SETUP.md`](../../../supabase/SETUP.md). This skill is
the actionable checklist. The project is `rqjywiqdeqzdzlyfmden`. The app code is correct;
the usual failure mode is that the **project itself was never provisioned** (empty DB →
`profiles 404`, missing bucket → `templates 400`).

Do the steps **in order** and stop at the first failure — report the exact SQL/CLI error
rather than guessing.

## 1. Database schema + RLS + buckets

Run [`supabase/migrations/0001_init.sql`](../../../supabase/migrations/0001_init.sql) — it
creates `profiles`/`reports`/`audit`, all RLS policies, the `reports` + `templates`
buckets, and the new-user trigger. It is idempotent (safe to re-run).

- **SQL editor:** paste the file's contents and run.
- **CLI:** `supabase link --project-ref rqjywiqdeqzdzlyfmden` then `supabase db push`.

Gotcha already fixed in the file: the role-helper functions read from `profiles`, so the
table is created **before** them and `check_function_bodies = off` guards the rest. If you
write further migrations, keep tables ahead of the functions that reference them.

✅ Check: Table editor shows the three tables; Storage shows both buckets.

## 2. First admin

Sign into the app once so your `profiles` row exists, then:

```sql
update public.profiles set role = 'admin' where email = 'sverma@engsurveys.com.au';
```

Roles: `admin | manager | surveyor`. Only admin/manager see Users; only admin can
invite/role/deactivate (enforced by the `admin-users` function).

## 3. Edge functions + secrets (CLI linked)

```bash
supabase functions deploy admin-users                 # keep JWT verification ON
supabase functions deploy send-report --no-verify-jwt
supabase secrets set SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... \
  SMTP_FROM="Engineering Surveys <office@engsurveys.com.au>"
supabase functions deploy docx-to-pdf --no-verify-jwt # optional (Service Location PDF)
# docx-to-pdf converts via the Google Drive API (Workspace), set up entirely in the
# Google Cloud Console (no Admin console). Secrets: GOOGLE_CLIENT_ID /
# GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN. Full steps in supabase/SETUP.md §5a.
```

`admin-users` needs no secrets — `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected.

## 4. Frontend env (`.env`, then restart `npm start`)

```
REACT_APP_SUPABASE_URL=https://rqjywiqdeqzdzlyfmden.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
REACT_APP_EMAIL_ENDPOINT=https://rqjywiqdeqzdzlyfmden.functions.supabase.co/send-report
REACT_APP_DOCX_PDF_ENDPOINT=https://rqjywiqdeqzdzlyfmden.functions.supabase.co/docx-to-pdf
REACT_APP_REPORT_ARCHIVE_EMAIL=sverma@engsurveys.com.au
```

## 5. Verify end-to-end

Sign in (no 404) → Profile saves + signature persists → Photo Report Generate writes a
`reports` row + a PDF in the bucket → appears on Dashboard/Reports → download + email work
→ Service Location generates docx and emails → a surveyor can't see/reach `/users`, an
admin can invite + change roles (audit log records it) → navbar sign-out returns to Login.
