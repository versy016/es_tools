# Deploying ES Tools (Netlify + estools.com.au)

The frontend is a static React (CRA) PWA hosted on **Netlify**; the backend
(database, auth, storage, edge functions) stays on **Supabase**. Build config and
the SPA redirect live in [`netlify.toml`](netlify.toml).

## 1. Connect the repo

1. Push the repo to GitHub (Netlify deploys from git):
   ```bash
   git push origin main
   ```
2. Netlify → **Add new site → Import an existing project → GitHub** → pick the repo.
   Build command (`npm run build`) and publish dir (`build`) come from `netlify.toml`.

   *No GitHub? Alternatively `npm run build` locally and drag the `build/` folder
   onto Netlify, or use the Netlify CLI (`netlify deploy --prod`).*

## 2. Environment variables (REQUIRED)

`.env.local` is gitignored, so Netlify won't have it. CRA **bakes these in at build
time**, so set them in **Site settings → Environment variables**, then redeploy:

```
REACT_APP_SUPABASE_URL
REACT_APP_SUPABASE_PUBLISHABLE_KEY
REACT_APP_EMAIL_ENDPOINT
REACT_APP_DOCX_PDF_ENDPOINT
REACT_APP_REPORT_ARCHIVE_EMAIL
```

## 3. Custom domain — estools.com.au (GoDaddy DNS)

Netlify → **Domain management → Add a domain → `estools.com.au`**. Then in
**GoDaddy → Manage DNS** add (Netlify shows the exact values; defaults below):

| Type  | Name | Value                       |
|-------|------|-----------------------------|
| A     | `@`  | `75.2.60.5` (Netlify)       |
| CNAME | `www`| `<your-site>.netlify.app`   |

Remove any GoDaddy "Parked"/Forwarding records that conflict. Netlify provisions
HTTPS (Let's Encrypt) automatically once DNS resolves. *(Or use Netlify DNS by
pointing GoDaddy's nameservers at Netlify — simplest for the apex domain.)*

## 4. Post-domain updates (don't skip)

1. **Supabase Auth** → Authentication → URL Configuration:
   - Site URL: `https://estools.com.au`
   - Redirect URLs: add `https://estools.com.au` and `https://www.estools.com.au`
   (otherwise login / Google SSO redirects to localhost and fails).
2. **Google Maps API key** (Google Cloud Console) → add `estools.com.au/*` and
   `www.estools.com.au/*` to the key's HTTP-referrer restrictions, or address
   autocomplete stops working off localhost.
3. **Edge functions** — already `Access-Control-Allow-Origin: *`, so no change.
   Keep `send-report` and `docx-to-pdf` deployed with `--no-verify-jwt`.

## Notes

- **CI=false** is set in `netlify.toml` because CRA fails the build on ESLint
  warnings when `CI` is set (Netlify sets it). Don't remove it unless the warnings
  are cleaned up.
- **PWA**: the service worker only runs in the production (Netlify) build over
  HTTPS — not in `npm start`. After the first visit the app is installable and the
  UI loads offline.
