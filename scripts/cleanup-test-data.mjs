// Safety-net: delete any TEST reports that a manual/E2E run against the REAL backend
// may have left behind. The automated suites mock the backend and never write data,
// so normally this finds nothing — it exists for the "if a test ever does populate
// data, remove it" guarantee.
//
// Convention: any report a test creates against the real project must have a title
// starting with the TEST_MARKER below (e.g. "[TEST] Site A"). This script finds those
// rows, deletes their storage objects, then deletes the rows.
//
// Env is auto-loaded from .env.local / .env (see loadEnv below), so from the repo root:
//   node scripts/cleanup-test-data.mjs          # dry run (lists only)
//   node scripts/cleanup-test-data.mjs --yes     # actually delete
// …as long as .env has REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//
// The SERVICE ROLE key is required (bypasses RLS to clean any user's test rows). It is
// read from the environment and never printed — do not commit it.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Node does NOT read .env automatically (only CRA does, at build time). Load it here so
// `node scripts/...` picks up the same values. Precedence: real env > .env.local > .env;
// only keys not already set are filled. Lines starting with # are ignored.
const loadEnv = () => {
    for (const file of ['.env.local', '.env']) {
        let txt;
        try { txt = fs.readFileSync(path.join(process.cwd(), file), 'utf8'); } catch { continue; }
        for (const line of txt.split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
            if (!m) continue;
            const key = m[1];
            const val = m[2].trim().replace(/^["']|["']$/g, '');
            if (process.env[key] === undefined) process.env[key] = val;
        }
    }
};
loadEnv();

const TEST_MARKER = '[TEST]';
const REPORTS_BUCKET = 'reports';

const url = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
// Prefer the non-prefixed name. A REACT_APP_-prefixed service key is a SECURITY RISK —
// CRA bakes every REACT_APP_* var into the public JS bundle, exposing this admin key.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes('--yes');

if (process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠  SECURITY: the service-role key is set as REACT_APP_SUPABASE_SERVICE_ROLE_KEY.\n' +
        '   Any REACT_APP_* var is compiled into the public browser bundle — this would leak a\n' +
        '   full-admin key. Rename it to SUPABASE_SERVICE_ROLE_KEY in .env and rebuild.\n');
}
if (!url) {
    console.error('Missing Supabase URL. Set REACT_APP_SUPABASE_URL (or SUPABASE_URL) in .env.');
    process.exit(1);
}
if (!serviceKey) {
    console.error('Missing service-role key. Add SUPABASE_SERVICE_ROLE_KEY to .env — the "service_role"\n' +
        'secret from Supabase → Project Settings → API (NOT the anon/publishable key).');
    process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const main = async () => {
    const { data: rows, error } = await supabase
        .from('reports')
        .select('id, title, storage_path')
        .ilike('title', `${TEST_MARKER}%`);

    if (error) { console.error('Query failed:', error.message); process.exit(1); }

    if (!rows || rows.length === 0) {
        console.log(`No test reports found (title starting with "${TEST_MARKER}"). Nothing to clean. ✅`);
        return;
    }

    console.log(`Found ${rows.length} test report(s):`);
    for (const r of rows) console.log(`  - ${r.id}  ${JSON.stringify(r.title)}  ${r.storage_path || '(no file)'}`);

    if (!apply) {
        console.log('\nDry run. Re-run with --yes to delete these rows and their files.');
        return;
    }

    const paths = rows.map((r) => r.storage_path).filter(Boolean);
    if (paths.length) {
        const { error: rmErr } = await supabase.storage.from(REPORTS_BUCKET).remove(paths);
        if (rmErr) console.warn('Some storage objects could not be removed:', rmErr.message);
    }
    const { error: delErr } = await supabase.from('reports').delete().in('id', rows.map((r) => r.id));
    if (delErr) { console.error('Row delete failed:', delErr.message); process.exit(1); }

    console.log(`\nDeleted ${rows.length} test report(s) and ${paths.length} file(s). ✅`);
};

main().catch((e) => { console.error(e); process.exit(1); });
