// Audit job runner: lets each check run on its own, several at once, with ONE shared drive
// scan. Plain JS (no React) so the rules are unit-testable; AuditView renders its snapshots.
//
//   • Scan checks (unknown clients, loose files, non-standard names, oversized, item cap)
//     all come from the same full drive listing. The first one requested starts a scan job;
//     later ones JOIN it (the job computes every scan check anyway) and only the subscribed
//     checks are committed when it finishes. Stopping a check unsubscribes it; stopping the
//     last subscriber cancels the scan.
//   • Report checks (deletions, last created) share a reports job the same way.
//   • runFull() cancels every job, waits for them to wind down, starts a fresh run row and
//     subscribes all seven checks.
//   • Results merge into one run row: a check overwrites only its own list, Notes (errors /
//     unclassified) are replaced per job source, results.checkedAt records when each check
//     last completed.
//   • scanDrives(ids) rescans just those drives and REPLACES only their rows in every scan
//     check, leaving every other drive's rows alone (totals come from per-drive counts).
//     resume() ("Continue scan") is scanDrives over the drives the last scan never reached
//     or failed to list.
import { CHECKS, SCAN_CHECKS, emptyResults } from './audit';
import { AUDIT_MAX_ROWS } from './service';

const ALL_KEYS = CHECKS.map((c) => c.key);
const stageOf = (key) => (SCAN_CHECKS.includes(key) ? 'scan' : 'reports');
const EMPTY = { rows: [], total: 0 };

// Replace the rows that came from the drives in `hit` with this scan's rows for them. The
// total drops by what those drives contributed before — taken from their per-drive counts
// when every one has a record (exact, even when the list is capped at 200 rows), else from
// their visible rows (older runs saved before per-drive records existed).
const replaceDrives = (base, outList, hit, key) => {
    const prev = base[key] || EMPTY;
    const isHit = (r) => (r.driveId && hit.ids.has(r.driveId)) || (r.drive && hit.names.has(r.drive));
    const scans = base.driveScans || {};
    const known = [...hit.ids].every((id) => scans[id] && scans[id].counts && typeof scans[id].counts[key] === 'number');
    const removed = known
        ? [...hit.ids].reduce((sum, id) => sum + scans[id].counts[key], 0)
        : (prev.rows || []).filter(isHit).length;
    return {
        rows: [...(prev.rows || []).filter((r) => !isHit(r)), ...((outList && outList.rows) || [])].slice(0, AUDIT_MAX_ROWS),
        total: Math.max(0, (prev.total || 0) - removed) + ((outList && outList.total) || 0),
    };
};

// Drives a "Continue scan" should (re)scan: never reached by the last scan, or whose listing
// failed (rate limit, expired sign-in, network). Membership failures are skipped — retrying
// can't fix those.
export const resumeTargets = (results, drives) => {
    const cov = results && results.scanCoverage;
    if (!cov) return [];
    const reached = new Set(cov.driveIds || []);
    const failed = new Set(((results.errors && results.errors.rows) || [])
        .filter((e) => e.source === 'scan' && e.kind === 'listFailed').map((e) => e.drive));
    return (drives || []).filter((d) => !reached.has(d.id) || failed.has(d.name));
};

// `opts.drives`, `opts.knownActors` and `opts.actor` are read EVERY time a job starts (the
// view passes live getters, since the tab mounts before Google has listed the drives), so
// they must not be destructured here.
export const createAuditRunner = (opts) => {
    const { runAudit, deps, persist, onChange, now = () => new Date() } = opts;
    const drivesNow = () => opts.drives || [];
    const checks = Object.fromEntries(ALL_KEYS.map((k) => [k, { status: 'idle', checkedAt: null }]));
    const jobs = { scan: null, reports: null };
    let run = null;              // the run row being shown / updated (snake_case like the table)
    let progress = null;
    let projectFolderIds = null; // from the latest finished scan (for reports-only last-created)
    let storageFailed = false;

    // Drives waiting for their own scan. Only one scan ever runs at a time (Google rate limits
    // and browser memory); clicking Scan on another drive during a scan queues it instead.
    let queue = [];
    const anyRunning = () => !!(jobs.scan || jobs.reports);
    const snapshot = () => {
        const job = jobs.scan;
        return {
            run, checks: { ...checks }, progress, anyRunning: anyRunning(),
            scanningDriveIds: job ? job.drives.map((d) => d.id) : [],
            currentDriveId: job ? ((job.drives[job.done] || {}).id || null) : null,
            // Not started yet: the rest of the running scan, then the queue.
            pendingDriveIds: [...(job ? job.drives.slice(job.done + 1).map((d) => d.id) : []), ...queue],
            queuedDriveIds: [...queue],
        };
    };
    const emit = () => { if (onChange) onChange(snapshot()); };
    const save = async (row) => {
        try { return await persist(row); } catch { storageFailed = true; return { id: row.id || null }; }
    };

    // Make sure there is a run row to merge into. `fresh` forces a new one (full audit).
    // Serialised: two checks started in the same tick must share one row, not create two.
    let ensuring = null;
    const ensureRun = async (fresh) => {
        if (ensuring) await ensuring;
        if (run && !fresh) { run = { ...run, status: 'running' }; return; }
        ensuring = (async () => {
            const base = { actor: opts.actor, started_at: now().toISOString(), finished_at: null, status: 'running', drives_total: drivesNow().length, drives_done: 0, reports_available: null, results: emptyResults() };
            const { id } = await save(base);
            run = { ...base, id };
        })();
        try { await ensuring; } finally { ensuring = null; }
    };

    // Merge a job's output for its subscribed checks into the run row. A subset job (single
    // drives, Continue scan) merges onto the snapshot taken when it started (`job.subset.base`),
    // replacing only the rows of the drives it has actually reached so far.
    const commit = (stage, out, subs, { final, job } = {}) => {
        const subset = job && job.subset;
        const base = subset ? subset.base : run.results;
        const jobDrives = (job && job.drives) || drivesNow();
        const doneHere = out.drivesDone ?? (job ? job.done : 0) ?? 0;
        const reachedDrives = jobDrives.slice(0, doneHere);
        const hit = { ids: new Set(reachedDrives.map((d) => d.id)), names: new Set(reachedDrives.map((d) => d.name)) };
        const results = { ...run.results, checkedAt: { ...(run.results.checkedAt || {}) } };
        subs.forEach((k) => { results[k] = subset ? replaceDrives(base, out.results[k], hit, k) : (out.results[k] || EMPTY); });
        // Notes: replace this job's own error rows, keep the other job's. A subset job also keeps
        // the earlier scan's notes for drives it hasn't rescanned.
        const otherSource = stage === 'scan' ? 'activity' : 'scan';
        const keep = ((subset ? base : run.results).errors?.rows || []).filter((e) => e.source === otherSource
            || (subset && e.drive !== '*' && !hit.names.has(e.drive)));
        const mine = out.results.errors?.rows || [];
        results.errors = { rows: [...keep, ...mine], total: keep.length + mine.length };
        let extra = { reports_available: out.reportsAvailable };
        let coverageComplete = true;
        if (stage === 'scan') {
            results.unclassifiedDrives = subset ? replaceDrives(base, out.results.unclassifiedDrives, hit, 'unclassifiedDrives') : (out.results.unclassifiedDrives || EMPTY);
            results.driveScans = { ...(base.driveScans || {}), ...(out.perDrive || {}) };
            // Coverage: which drives have results, saved with every drive, so an interrupted scan
            // (reload, closed tab, crash, expired sign-in) is visible and resumable afterwards.
            const reached = reachedDrives.map((d) => d.id);
            const driveIds = subset ? [...subset.priorIds, ...reached.filter((id) => !subset.priorIds.includes(id))] : reached;
            coverageComplete = driveIds.length >= drivesNow().length;
            results.scanCoverage = {
                done: driveIds.length, total: drivesNow().length, driveIds, at: now().toISOString(),
                checks: subset ? subset.checks : [...((job && job.subs) || subs)], pausedForAuth: !!out.pausedForAuth,
                mode: subset ? 'subset' : 'full',
            };
            extra = { drives_done: driveIds.length, drives_total: drivesNow().length };
        }
        // A check is "checked" once its results reflect every drive.
        if (final && (!subset || coverageComplete)) subs.forEach((k) => { results.checkedAt[k] = now().toISOString(); });
        if (stage === 'reports' && out.lastCreatedScope) results.lastCreatedScope = out.lastCreatedScope;
        run = { ...run, ...extra, results };
    };

    const finishRun = async (partial) => {
        if (anyRunning()) { await save({ id: run.id, drives_done: run.drives_done, reports_available: run.reports_available, results: run.results, status: 'partial' }); return; }
        run = { ...run, finished_at: now().toISOString(), status: partial ? 'partial' : 'complete' };
        await save({ id: run.id, finished_at: run.finished_at, status: run.status, drives_done: run.drives_done, reports_available: run.reports_available, results: run.results });
    };

    const startJob = async (stage, keys, { drives: jobDrives, subset } = {}) => {
        const job = { cancelled: false, subs: new Set(keys), promise: null, stoppedAny: false, drives: jobDrives || drivesNow(), subset, done: 0 };
        jobs[stage] = job;
        keys.forEach((k) => { checks[k] = { ...checks[k], status: 'running' }; });
        emit();
        job.promise = (async () => {
            let partial = false;
            let paused = false;
            try {
                const out = await runAudit({
                    drives: stage === 'scan' ? job.drives : drivesNow(), deps, knownActors: opts.knownActors || [],
                    stages: { scan: stage === 'scan', reports: stage === 'reports' },
                    priorProjectFolderIds: stage === 'reports' ? projectFolderIds : null,
                    shouldCancel: () => job.cancelled,
                    onPage: (p) => { if (stage === 'scan') { progress = { ...p, partial: true }; emit(); } },
                    onProgress: async (p) => {
                        if (stage !== 'scan') return;
                        progress = p;
                        job.done = p.driveIndex;
                        commit('scan', { results: p.results, drivesDone: p.driveIndex }, [...job.subs], { job });
                        emit();
                        await save({ id: run.id, drives_done: run.drives_done, status: 'partial', results: run.results });
                    },
                });
                if (stage === 'scan' && out.projectFolderIds && out.status === 'complete') projectFolderIds = out.projectFolderIds;
                partial = out.status !== 'complete' || job.stoppedAny;
                paused = !!out.pausedForAuth;
                // Stopped checks never commit; the rest commit as final (unless the scan paused).
                commit(stage, out, [...job.subs], { final: !job.cancelled && !paused, job });
            } catch (e) {
                partial = true;
                const source = stage === 'scan' ? 'scan' : 'activity';
                const row = { drive: '*', message: `${stage === 'scan' ? 'Scan' : 'Activity'} failed: ${e?.message || e}`, source };
                // Keep everything the job already saved per drive; just add the failure note.
                const errs = run.results.errors?.rows || [];
                run = { ...run, results: { ...run.results, errors: { rows: [...errs, row], total: errs.length + 1 } } };
            }
            // The in-memory "checked" time mirrors exactly what commit() saved.
            job.subs.forEach((k) => { checks[k] = { status: 'idle', checkedAt: (run.results.checkedAt || {})[k] || checks[k].checkedAt }; });
            ALL_KEYS.filter((k) => stageOf(k) === stage && checks[k].status === 'stopping').forEach((k) => { checks[k] = { ...checks[k], status: 'idle' }; });
            jobs[stage] = null;
            if (stage === 'scan') progress = null;
            await finishRun(partial || run.status === 'partial');
            emit();
            // Next queued drives, one scan after another. A stopped scan drops the queue.
            if (stage === 'scan') {
                if (job.cancelled) queue = [];
                else if (queue.length) { const next = queue; queue = []; scanDrives(next); }
            }
        })();
        return job.promise;
    };

    const run_ = async (keys, { fresh = false } = {}) => {
        const wanted = keys.filter((k) => ALL_KEYS.includes(k) && checks[k].status === 'idle');
        if (!wanted.length) return;
        await ensureRun(fresh);
        const byStage = { scan: wanted.filter((k) => stageOf(k) === 'scan'), reports: wanted.filter((k) => stageOf(k) === 'reports') };
        Object.entries(byStage).forEach(([stage, ks]) => {
            if (!ks.length) return;
            if (jobs[stage]) { ks.forEach((k) => { jobs[stage].subs.add(k); checks[k] = { ...checks[k], status: 'running' }; }); }
            else startJob(stage, ks);
        });
        emit();
    };

    const stop = (key) => {
        const stage = stageOf(key);
        const job = jobs[stage];
        if (!job || !job.subs.has(key)) return;
        job.subs.delete(key);
        job.stoppedAny = true;
        if (job.subs.size === 0) { job.cancelled = true; checks[key] = { ...checks[key], status: 'stopping' }; }
        else checks[key] = { ...checks[key], status: 'idle' };
        emit();
    };

    const stopAll = async () => {
        queue = [];
        const running = ['scan', 'reports'].map((s) => jobs[s]).filter(Boolean);
        running.forEach((job) => { job.cancelled = true; job.stoppedAny = true; job.subs.forEach((k) => { checks[k] = { ...checks[k], status: 'stopping' }; }); });
        emit();
        await Promise.all(running.map((j) => j.promise));
    };

    const runFull = async () => { await stopAll(); await run_(ALL_KEYS, { fresh: true }); };

    // Scan just these drives for the given scan checks (default: all five), replacing only
    // their rows in the current run. While a scan is running, the drives are queued instead
    // (unless the running scan will still reach them) and run next.
    const scanDrives = async (ids, keys) => {
        if (jobs.scan) {
            const willReach = new Set(jobs.scan.drives.slice(jobs.scan.done).map((d) => d.id));
            (ids || []).forEach((id) => { if (!willReach.has(id) && !queue.includes(id)) queue.push(id); });
            emit();
            return;
        }
        const want = new Set(ids || []);
        const targets = drivesNow().filter((d) => want.has(d.id));
        if (!targets.length) return;
        const useKeys = ((keys && keys.length) ? keys : SCAN_CHECKS).filter((k) => SCAN_CHECKS.includes(k));
        await ensureRun(false);
        const cov = (run.results && run.results.scanCoverage) || {};
        startJob('scan', useKeys, {
            drives: targets,
            subset: { base: run.results, priorIds: cov.driveIds || [], checks: (cov.checks && cov.checks.length) ? cov.checks : useKeys },
        });
        emit();
    };

    // "Continue scan": the drives the last scan never reached or failed to list, same checks.
    const resume = async () => {
        if (jobs.scan || !run) return;
        const cov = run.results.scanCoverage || {};
        await scanDrives(resumeTargets(run.results, drivesNow()).map((d) => d.id), cov.checks);
    };

    const load = (row) => {
        run = row;
        const at = (row && row.results && row.results.checkedAt) || {};
        ALL_KEYS.forEach((k) => { checks[k] = { status: 'idle', checkedAt: at[k] || null }; });
        emit();
    };

    const unqueue = (id) => { queue = queue.filter((x) => x !== id); emit(); };

    return { run: run_, stop, stopAll, runFull, resume, scanDrives, unqueue, load, snapshot, storageFailed: () => storageFailed };
};
