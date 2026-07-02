-- ES Tools — email alias / identity hardening (idempotent: safe to re-run).
-- Google Workspace gives each person two addresses that hit the same mailbox:
--   primary  finitiallastname   (sverma@engsurveys.com.au)
--   alias    firstname.lastname (shivam.verma@engsurveys.com.au)
-- Without care that lets one person create two accounts. We add a canonical_email key
-- (aliases collapse to the same value), keep it populated, expose a lookup RPC the sign-in
-- / invite flows use, and add a best-effort unique backstop.
--
-- Mirrors the client rule in src/lib/emailIdentity.js (canonicalEmail). Keep in sync.

set check_function_bodies = off;

-- ───────────────────────── canonical_email() ─────────────────────────
-- Collapse an address to a canonical key: lower-case, drop any "+tag", and reduce a dotted
-- local part (firstname.lastname[.middle…]) to first-initial + last-name. A dot-free local
-- part is assumed to already be the primary finitiallastname form.
create or replace function public.canonical_email(p_email text)
returns text language plpgsql immutable set search_path = public as $$
declare
  n text := lower(trim(coalesce(p_email, '')));
  at_pos int;
  local text;
  domain text;
  parts text[];
begin
  if n = '' then return n; end if;
  at_pos := position('@' in n);
  if at_pos < 2 then return n; end if;               -- no usable domain
  local := substring(n from 1 for at_pos - 1);
  domain := substring(n from at_pos + 1);
  local := split_part(local, '+', 1);                -- drop +tag
  if position('.' in local) > 0 then
    parts := array_remove(string_to_array(local, '.'), '');
    if array_length(parts, 1) >= 2 then
      local := left(parts[1], 1) || parts[array_length(parts, 1)];
    elsif array_length(parts, 1) = 1 then
      local := parts[1];
    end if;
  end if;
  return local || '@' || domain;
end; $$;

-- ───────────────────────── profiles.canonical_email ─────────────────────────
alter table public.profiles add column if not exists canonical_email text;

-- Backfill existing rows so the lookup + backstop see historical accounts.
update public.profiles
   set canonical_email = public.canonical_email(email)
 where email is not null
   and (canonical_email is distinct from public.canonical_email(email));

-- Best-effort uniqueness backstop. Wrapped so the migration still succeeds if legacy
-- duplicates already exist — resolve them, then re-run to get the index.
do $$
begin
  begin
    create unique index if not exists profiles_canonical_email_uidx
      on public.profiles (canonical_email) where canonical_email is not null;
  exception when others then
    raise notice 'Skipped unique index on profiles.canonical_email (duplicate aliases exist?). Merge/remove duplicates, then re-run this migration.';
  end;
end $$;

-- Keep canonical_email set whenever a new auth user (signup / invite / OAuth) appears.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, canonical_email)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    public.canonical_email(new.email)
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── email_identity_lookup() ─────────────────────────
-- Given any address, return whether a person already has an account under an alias of it,
-- and if so the address on file. SECURITY DEFINER so the sign-in / sign-up screens can call
-- it before the user is authenticated (RLS would otherwise hide profiles). This does reveal
-- account existence to callers, which is acceptable for an internal, org-restricted tool.
create or replace function public.email_identity_lookup(p_email text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  found_email text;
begin
  if coalesce(trim(p_email), '') = '' then
    return jsonb_build_object('exists', false);
  end if;
  select email into found_email
    from public.profiles
   where canonical_email = public.canonical_email(p_email)
   order by created_at asc
   limit 1;
  if found_email is null then
    return jsonb_build_object('exists', false);
  end if;
  return jsonb_build_object('exists', true, 'email', found_email);
end; $$;

grant execute on function public.email_identity_lookup(text) to anon, authenticated;
grant execute on function public.canonical_email(text) to anon, authenticated;
