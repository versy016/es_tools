# ES Tools — Supabase setup

Authentication, database and file storage now run on **Supabase** (migrated off AWS
Cognito + Amplify S3).

## 1. Create the project
1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.

## 2. Configure the web app
Create `es_tools/.env`:
```
REACT_APP_SUPABASE_URL=https://<your-project>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon public key>
```
Then rebuild / restart (`npm start`). Until these are set the app shows a
"Connect Supabase" screen instead of crashing.

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

## What this replaces
- Cognito login → Supabase Auth.
- Amplify S3 (`reports/`, `profile/`) → Supabase Storage (`reports` bucket) + `reports`
  table; signature/profile in the `profiles` table.
- `admin-service` Cognito Lambda → `profiles`/`audit` tables + RLS (no Lambda needed for
  list/role/active; emailing invites still uses Supabase's invite or the dashboard).
- `email-service` (SMTP) can stay as-is, or be replaced by a Supabase Edge Function later.
