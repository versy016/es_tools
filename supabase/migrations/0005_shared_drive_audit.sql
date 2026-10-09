-- Shared Drive Manager — Audit tab (idempotent: safe to re-run).
-- One row per audit run. The scan itself happens in the browser (Drive API + Reports API
-- with the manager's own Google token); this table just persists the latest findings so
-- the Audit tab is useful without re-scanning. `results` holds the grouped findings:
--   { unknownClients, looseItems, nonStandardProjects, oversizedProjects, driveCaps,
--     deletions, lastCreated, unclassifiedDrives, errors }  — each { rows[], total }
-- Spec: docs/superpowers/specs/2026-10-02-shared-drive-audit-design.md

set check_function_bodies = off;

create table if not exists public.shared_drive_audit_runs (
    id uuid primary key default gen_random_uuid(),
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    actor text,
    status text not null default 'running',   -- running | partial | complete | failed
    reports_available boolean,                -- null = not attempted, false = needs admin reports access
    drives_done int not null default 0,
    drives_total int not null default 0,
    results jsonb not null default '{}'::jsonb
);
alter table public.shared_drive_audit_runs enable row level security;
create index if not exists shared_drive_audit_runs_started_idx on public.shared_drive_audit_runs (started_at desc);

-- Same manager/admin predicate as the other Shared Drive Manager tables (0003).
drop policy if exists sd_audit_runs_rw on public.shared_drive_audit_runs;
create policy sd_audit_runs_rw on public.shared_drive_audit_runs
    for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'manager')))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'manager')));
