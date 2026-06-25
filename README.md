# ES Tools

Internal web app for **Engineering Surveys** — a single home for the company's
field-reporting tools. Surveyors fill in job details, annotate site photos, and
generate branded reports (Word + PDF) on the official ES letterhead, then download
or email them. Built as a React single-page app with a Supabase backend.

> Internal company tool — not intended for public distribution.

## Tools

| Tool | What it does |
|------|--------------|
| **Service Location Field Report** | Job details, a utility-services checklist (colour-coded per utility), DBYD details, site notes and photos → a Word report on the ES letterhead, converted to PDF. |
| **Photo & Pothole Report** | Cover (project/client details, utilities located, quality level), a DIT utility legend + AS 5488.1 quality-level page, and one page per annotated photo with its pothole thumbnails → Word + PDF. |

Both reports render from `.docx` templates built into the real letterhead
(`public/templates/`), so the header/footer are genuinely ES.

## Features

- **Photo annotation** — draw utility-coloured lines, arrows, text and shapes over a
  photo (custom Konva editor or Excalidraw, switchable), plus on-the-spot camera capture.
- **Per-photo potholes** — utility, quality level, depth and a thumbnail.
- **Letterhead report templates** — `docxtemplater` fills the template, then the
  `docx-to-pdf` edge function converts it to PDF (via the Google Drive API).
- **Email** — reports are emailed as an attachment through an SMTP edge function, with
  an archive copy to an internal address.
- **Auth + RBAC** — Supabase email/password and Google (Workspace) SSO; roles
  `admin | manager | surveyor` gate the Users screen and admin actions.
- **Persistence** — generated reports are saved to Supabase Storage + a `reports`
  table and listed on the Dashboard / Reports screens.
- **Saved profile & signature** — flows onto the report sign-off.

## Tech stack

- **React 18** (Create React App + **CRACO** for webpack overrides) · **react-router v6**
- **Supabase** — Auth, Postgres (RLS), Storage, Edge Functions (`@supabase/supabase-js`)
- **Konva / react-konva** + **Excalidraw** — annotation
- **docxtemplater** + **pizzip** + image module — Word report rendering
- **FontAwesome**, **react-beautiful-dnd**

## Getting started

```bash
npm install
# create .env (see below), then:
npm start          # http://localhost:3000
```

Other scripts: `npm run build` (production build), `npm test`.

### Environment (`.env` at the repo root)

```bash
# Supabase (publishable/anon — safe in the client)
REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx

# Edge function endpoints
REACT_APP_EMAIL_ENDPOINT=https://<project-ref>.supabase.co/functions/v1/send-report
REACT_APP_DOCX_PDF_ENDPOINT=https://<project-ref>.supabase.co/functions/v1/docx-to-pdf

# Internal archive copy of every report
REACT_APP_REPORT_ARCHIVE_EMAIL=someone@engsurveys.com.au
```

CRA bakes these in at **start/build time** — restart `npm start` after changing `.env`.
The app still runs without the backend configured; it just degrades to empty states.

## Backend (Supabase)

The app code is complete, but the Supabase project must be provisioned once. Follow
**[`supabase/SETUP.md`](supabase/SETUP.md)** — it covers, in order:

1. Database schema + RLS + storage buckets (`supabase/migrations/0001_init.sql`)
2. Setting the first admin
3. Auth providers (email + Google)
4. Deploying the edge functions and their secrets:
   - `admin-users` — privileged user admin (invite / role / activate), admin-checked
   - `send-report` — SMTP email (Gmail/Workspace app password)
   - `docx-to-pdf` — Word → PDF via the Google Drive API
5. Frontend env vars

## Reports & templates

- Templates live in `public/templates/` (`service-location.docx`, `photo-report.docx`),
  overridable from the Supabase `templates` bucket.
- They're generated from the company letterhead by the scripts in `scripts/`
  (`build-service-location-template.py`, `build-photo-report-template.py`), which inject
  the report body and `docxtemplater` tags while leaving the letterhead header/footer
  untouched. Requires Python + the [docx skill](https://github.com/anthropics) helpers
  and the letterhead source file (not committed).

## Project structure

```
src/
  App.js                 router shell + RBAC route guards
  auth/                  Supabase auth context
  lib/supabase.js        Supabase client
  config.js              env-driven config (email endpoint, archive address)
  screens/               Login, Dashboard, Reports, Users, Profile
  tools/                 ServiceLocater, PhotoReport
  components/            annotation editors, navbar, toast, form pieces
  report/                legend colours, PhotoReportPdf (legacy native PDF)
  services/              reports / profiles / users / email / report-render services
  scripts/               Algolia + Google Maps helpers
public/templates/        the .docx report templates
supabase/                migration, edge functions, SETUP runbook
scripts/                 .docx template generators
```
