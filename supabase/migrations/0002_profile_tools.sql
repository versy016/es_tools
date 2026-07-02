-- Per-user tool allowlist.
-- NULL  = no restriction (the user can open every tool) — this is the default.
-- text[] = the user may ONLY open tools whose id is in this array (see
--          src/data/toolsRegistry.js: 'photo-report', 'service-location', …).
-- Managers (the top role) can set this for anyone, including admins; admins can set it
-- for non-managers. Enforced by the admin-users edge function + the client route guard.
alter table public.profiles add column if not exists tools text[];

comment on column public.profiles.tools is
  'Allowed tool ids; NULL = all tools. Managed via the admin-users function.';
