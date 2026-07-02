-- Shared Drive Manager backend tables.
-- Drives + membership live in Google Drive (called directly from the browser with the
-- signed-in manager's Google token). These two tables hold the app-side data:
--   * shared_drive_directory — the reusable people list (replaces the old members.json)
--   * shared_drive_activity  — the audit feed of every change made in the tool
-- Both are readable/writable only by admins & managers (RLS).

create table if not exists public.shared_drive_directory (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    full_name text not null default '',
    created_at timestamptz not null default now()
);
alter table public.shared_drive_directory enable row level security;

create table if not exists public.shared_drive_activity (
    id uuid primary key default gen_random_uuid(),
    ts timestamptz not null default now(),
    actor text,
    type text not null,          -- create | add | remove | directory
    title text not null,
    detail text,
    tone text                    -- ok | bad
);
alter table public.shared_drive_activity enable row level security;
create index if not exists shared_drive_activity_ts_idx on public.shared_drive_activity (ts desc);

-- Admin/manager-only access to both tables.
drop policy if exists sd_directory_rw on public.shared_drive_directory;
create policy sd_directory_rw on public.shared_drive_directory
    for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'manager')))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'manager')));

drop policy if exists sd_activity_rw on public.shared_drive_activity;
create policy sd_activity_rw on public.shared_drive_activity
    for all to authenticated
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'manager')))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.role) in ('admin', 'manager')));
