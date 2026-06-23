-- ES Tools — Supabase schema, RLS and storage.
-- Run this in the Supabase SQL editor once, against a new project.

-- ───────────────────────── Roles helper ─────────────────────────
-- Roles are stored on the profile row: 'admin' | 'manager' | 'surveyor'.

create or replace function public.current_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'surveyor');
$$;

create or replace function public.is_manager() returns boolean
language sql stable as $$ select public.current_role() in ('admin','manager'); $$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.current_role() = 'admin'; $$;

-- ───────────────────────── Profiles ─────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  role          text not null default 'surveyor',
  accreditation text,
  mobile        text,
  signature     text,                 -- data URL of the saved signature
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own or manager" on public.profiles
  for select using (id = auth.uid() or public.is_manager());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid());
create policy "profiles: admin update any" on public.profiles
  for update using (public.is_admin());
create policy "profiles: insert self" on public.profiles
  for insert with check (id = auth.uid());

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Reports ─────────────────────────
create table if not exists public.reports (
  id            text primary key,
  owner         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title         text,
  site_address  text,
  client        text,
  status        text not null default 'Draft',  -- Draft | Sent | Approved
  photo_count   int default 0,
  pothole_count int default 0,
  storage_path  text,                            -- path in the reports bucket
  meta          text,                            -- display meta line
  created_at    timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "reports: owner all" on public.reports
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "reports: manager read" on public.reports
  for select using (public.is_manager());

-- ───────────────────────── Audit ─────────────────────────
create table if not exists public.audit (
  id    bigint generated always as identity primary key,
  who   text,
  what  text,
  ts    timestamptz not null default now()
);

alter table public.audit enable row level security;
create policy "audit: manager read" on public.audit for select using (public.is_manager());
create policy "audit: any insert" on public.audit for insert with check (auth.uid() is not null);

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public)
  values ('reports', 'reports', false)
  on conflict (id) do nothing;

-- Each user's files live under a folder named with their uid: reports/<uid>/...
create policy "reports bucket: owner rw" on storage.objects
  for all using (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reports bucket: manager read" on storage.objects
  for select using (bucket_id = 'reports' and public.is_manager());

-- Report templates (e.g. the Service Location .docx). Any signed-in user can read
-- (the app renders from them); only managers/admins can upload/replace.
insert into storage.buckets (id, name, public)
  values ('templates', 'templates', false)
  on conflict (id) do nothing;

create policy "templates: read signed-in" on storage.objects
  for select using (bucket_id = 'templates' and auth.uid() is not null);
create policy "templates: manager write" on storage.objects
  for all using (bucket_id = 'templates' and public.is_manager())
  with check (bucket_id = 'templates' and public.is_manager());
