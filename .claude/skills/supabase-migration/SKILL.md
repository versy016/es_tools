---
name: supabase-migration
description: Write a new idempotent Postgres migration for the es_tools Supabase database following repo conventions — tables-before-functions ordering, if-not-exists / create-or-replace / drop-policy-if-exists, and RLS built on is_manager()/is_admin(). Use when changing the schema, RLS policies, or storage buckets.
---

# Supabase migrations (es_tools)

Migrations live in `supabase/migrations/NNNN_name.sql` (next number after the highest
existing). The baseline is `0001_init.sql` — read it first; match its structure and the
RLS helpers it defines. Apply with `supabase db push` or by pasting into the SQL editor.

## Hard rules

1. **Idempotent.** Every statement must be safe to re-run:
   - tables → `create table if not exists`
   - functions → `create or replace function`
   - policies → `drop policy if exists "<name>" on <table>;` immediately before each
     `create policy` (Postgres has no `create policy if not exists`)
   - buckets → `insert into storage.buckets ... on conflict (id) do nothing`
   - triggers → `drop trigger if exists ... ; create trigger ...`

2. **Order by dependency.** A `language sql` function body is validated at CREATE time, so
   a table it reads must already exist. Create tables **before** the functions that query
   them, and helper functions before the policies that call them. `0001_init.sql` also sets
   `check_function_bodies = off` as a backstop — keep that at the top.

3. **RLS on every new table.** `alter table ... enable row level security;` then policies.
   Reuse the role helpers instead of re-deriving roles:
   - `public.current_role()` — SECURITY DEFINER (so policies that call it don't recurse).
   - `public.is_manager()` → admin or manager. `public.is_admin()` → admin.

## Policy patterns to copy

- **Owner-scoped table** (like `reports`): owner full CRUD + manager read.
  ```sql
  create policy "<t>: owner all" on public.<t>
    for all using (owner = auth.uid()) with check (owner = auth.uid());
  create policy "<t>: manager read" on public.<t> for select using (public.is_manager());
  ```
- **Per-user storage folder** (like `reports` bucket): key on the first path segment.
  ```sql
  using (bucket_id = '<b>' and (storage.foldername(name))[1] = auth.uid()::text)
  ```
- **Admin-only writes via the edge function:** keep the table readable under RLS, but do
  privileged inserts/updates from `admin-users` with the service role (which bypasses RLS).

## After writing

- Don't hand-edit already-applied migrations; add a new numbered file instead.
- If new tables/columns change a query, update the matching `src/services/*.js` mapping
  (e.g. `rowToReport` / `rowToProfile`) and document the apply step in `supabase/SETUP.md`.
- Sanity-check ordering by reading top-to-bottom: every referenced table/function/policy
  target should already appear above its first use.
