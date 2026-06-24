---
name: supabase-edge-function
description: Scaffold or modify a Supabase Edge Function in es_tools following the repo's conventions (Deno.serve, shared CORS const, json() helper, and an optional JWT + admin re-check via the service role). Use when adding or editing anything under supabase/functions/.
---

# Supabase edge functions (es_tools)

Functions live in `supabase/functions/<name>/index.ts` and run on Deno (NOT Node — no
`require`, no npm; import via `https://esm.sh/...` or `https://deno.land/x/...`). Match the
three existing ones: `admin-users` (privileged, JWT-verified), `send-report` (public SMTP),
`docx-to-pdf` (public Gotenberg proxy).

## House style (copy this skeleton)

```ts
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
};
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    try {
        const body = await req.json();
        // ... work ...
        return json({ ok: true });
    } catch (err) {
        return json({ error: String((err as Error)?.message || err) }, 500);
    }
});
```

Always: handle the `OPTIONS` preflight, spread `...CORS` on every response, and return a
JSON envelope (`{ ok: true }` or `{ error }`) so the frontend can branch on it.

## Two security postures (pick deliberately)

- **Privileged / admin-only** → deploy WITH JWT verification (the default). Read the
  caller from the `Authorization` header, look up their `profiles.role` with a service-role
  client, and reject non-admins **before** acting. Write an `audit` row for the action.
  Model: `supabase/functions/admin-users/index.ts`. Call it from the app with
  `supabase.functions.invoke('<name>', { body })` (it attaches the JWT automatically).

- **Public utility** (email, file conversion) → deploy `--no-verify-jwt` and call it with a
  plain `fetch` from the frontend. Read secrets from `Deno.env.get(...)` and fail with a
  clear `{ error }` if unset. Models: `send-report`, `docx-to-pdf`. Note in a comment that
  it's an open endpoint guarded only by CORS.

Service-role clients: `createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })`.
Those two env vars are injected automatically; everything else is a secret you set via
`supabase secrets set`.

## After writing

1. Add the deploy command + any secrets to [`supabase/SETUP.md`](../../../supabase/SETUP.md).
2. If the frontend calls it, wire a thin function in `src/services/` (don't `fetch` from
   components) — see `emailService.js` / `usersService.js`.
3. Deploy: `supabase functions deploy <name>` (add `--no-verify-jwt` only for public ones).
