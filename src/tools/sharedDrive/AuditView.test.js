// Component tests for the Shared Drive Audit tab. Every I/O module is mocked (audit engine,
// Google, Algolia, Supabase storage) — nothing reaches a network. The job runner is real.
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

jest.mock('./audit', () => {
    const actual = jest.requireActual('./audit');
    return { ...actual, runAudit: jest.fn() };
});
jest.mock('./service', () => ({
    saveAuditRun: jest.fn(), loadLatestAuditRun: jest.fn(), relative: () => '2h ago',
    AUDIT_MAX_ROWS: 200, AUDIT_DRIVE_ROOTS: [], AUDIT_EXCLUDED_DRIVES: [],
    AUDIT_PROJECT_ITEM_LIMIT: 3000, AUDIT_DRIVE_WARN: 400000, AUDIT_DRIVE_CRITICAL: 450000, AUDIT_ACTIVITY_DAYS: 90,
}));
jest.mock('./algolia', () => ({ isAlgoliaConfigured: jest.fn(), listAllClients: jest.fn() }));
jest.mock('./googleDrive', () => ({
    listDriveTree: jest.fn(), listAuditEvents: jest.fn(), connect: jest.fn(), connectSilent: jest.fn(),
    hasReportsScope: jest.fn(), tokenExpiresIn: jest.fn(),
}));
jest.mock('../../components/Toast', () => ({ useToast: () => () => {} }));

import AuditView from './AuditView';
import { runAudit, emptyResults } from './audit';
import { saveAuditRun, loadLatestAuditRun } from './service';
import { isAlgoliaConfigured } from './algolia';
import { connect, connectSilent, hasReportsScope, tokenExpiresIn } from './googleDrive';

const DRIVES = [{ id: 'a', name: '_A' }];
const results = (over = {}) => ({ ...emptyResults(), ...over });
const rows = (arr) => ({ rows: arr, total: arr.length });
const out = (over = {}, extra = {}) => ({ status: 'complete', reportsAvailable: true, drivesDone: 1, projectFolderIds: new Set(), lastCreatedScope: null, results: results(over), ...extra });
const completeRun = (over = {}) => ({
    id: 'r1', started_at: '2026-10-02T00:00:00Z', finished_at: '2026-10-02T00:05:00Z', actor: 'Shivam', status: 'complete',
    reports_available: true, drives_done: 1, drives_total: 1,
    results: results({ unknownClients: rows([{ drive: '_A', client: 'Nobody', folderId: 'c9', closest: { title: 'ARTC', score: 0.4 } }]), checkedAt: { unknownClients: '2026-10-02T00:05:00Z' } }),
    ...over,
});
const panel = (title) => screen.getByText(title).closest('details');
const runBtn = (title) => within(panel(title)).getByRole('button', { name: /^Run$/i });

beforeEach(() => {
    loadLatestAuditRun.mockResolvedValue(null);
    saveAuditRun.mockResolvedValue({ id: 'r1' });
    isAlgoliaConfigured.mockReturnValue(true);
    hasReportsScope.mockReturnValue(true);
    tokenExpiresIn.mockReturnValue(3600e3);
    connectSilent.mockResolvedValue(true);
    connect.mockResolvedValue(true);
    runAudit.mockResolvedValue(out());
});

const renderView = (props = {}) => render(<AuditView connected drives={DRIVES} knownActors={[]} actor="Shivam" onCount={() => {}} {...props} />);

test('shows the last run line, findings and per-check "checked" labels from the saved run', async () => {
    loadLatestAuditRun.mockResolvedValue(completeRun());
    const onCount = jest.fn();
    renderView({ onCount });
    expect(await screen.findByText(/Last run 2h ago by Shivam/)).toBeInTheDocument();
    expect(screen.getByText('Nobody')).toBeInTheDocument();
    expect(screen.getByText(/closest: ARTC/)).toBeInTheDocument();
    expect(within(panel('Unknown clients')).getByText(/checked 2h ago/)).toBeInTheDocument();
    expect(within(panel('Non-standard project names')).getByText(/never run/)).toBeInTheDocument();
    await waitFor(() => expect(onCount).toHaveBeenCalledWith(1));
});

test('every check panel has its own Run button; all disabled when not connected', async () => {
    renderView({ connected: false });
    await screen.findByText('Unknown clients');
    const btns = screen.getAllByRole('button', { name: /^Run$/i });
    expect(btns).toHaveLength(7);
    btns.forEach((b) => expect(b).toBeDisabled());
    expect(screen.getByRole('button', { name: /Run full audit/i })).toBeDisabled();
});

test('Run on one panel starts a scan-only job and only that panel shows Running', async () => {
    let resolveRun;
    runAudit.mockImplementation(() => new Promise((res) => { resolveRun = res; }));
    renderView();
    await screen.findByText('Non-standard project names');
    fireEvent.click(runBtn('Non-standard project names'));
    await waitFor(() => expect(runAudit).toHaveBeenCalledTimes(1));
    expect(runAudit.mock.calls[0][0].stages).toEqual({ scan: true, reports: false });
    expect(within(panel('Non-standard project names')).getByText(/Running|Scanning/)).toBeInTheDocument();
    expect(within(panel('Non-standard project names')).getByRole('button', { name: /^Stop$/i })).toBeInTheDocument();
    expect(within(panel('Drive item cap (500,000)')).queryByText(/Running/)).toBeNull();
    expect(screen.getByRole('button', { name: /Stop all and run full audit/i })).toBeInTheDocument();
    resolveRun(out({ nonStandardProjects: rows([{ drive: '_A', client: 'ARTC', name: 'Bad Name', folderId: 'b' }]), driveCaps: rows([{ drive: '_A', driveId: 'a', total: 3, trashed: 0, level: 'ok' }]) }));
    expect(await screen.findByText('Bad Name')).toBeInTheDocument();
    expect(within(panel('Drive item cap (500,000)')).getByText('0')).toBeInTheDocument();   // not subscribed → untouched
    expect(within(panel('Non-standard project names')).getByText(/checked/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Run full audit$/i })).toBeEnabled();
});

test('drives that load after the tab mounted are what the scan uses', async () => {
    // The Audit tab is always mounted, so it usually renders before Google has listed the drives.
    const view = render(<AuditView connected drives={[]} knownActors={[]} actor="Shivam" onCount={() => {}} />);
    await screen.findByText('Drive item cap (500,000)');
    view.rerender(<AuditView connected drives={DRIVES} knownActors={['a@engsurveys.com.au']} actor="Shivam" onCount={() => {}} />);
    fireEvent.click(runBtn('Drive item cap (500,000)'));
    await waitFor(() => expect(runAudit).toHaveBeenCalledTimes(1));
    expect(runAudit.mock.calls[0][0].drives).toEqual(DRIVES);
    expect(runAudit.mock.calls[0][0].knownActors).toEqual(['a@engsurveys.com.au']);
});

test('Run on a second scan panel while a scan runs joins it (one runAudit call)', async () => {
    runAudit.mockImplementation(() => new Promise(() => {}));
    renderView();
    await screen.findByText('Non-standard project names');
    fireEvent.click(runBtn('Non-standard project names'));
    fireEvent.click(runBtn('Projects over 3,000 items'));
    await waitFor(() => expect(within(panel('Projects over 3,000 items')).getByText(/Running|Scanning/)).toBeInTheDocument());
    expect(runAudit).toHaveBeenCalledTimes(1);
});

test('Run on Folder deletions starts a reports-only job', async () => {
    renderView();
    await screen.findByText(/Folder deletions/);
    fireEvent.click(runBtn('Folder deletions (last 90 days)'));
    await waitFor(() => expect(runAudit).toHaveBeenCalledTimes(1));
    expect(runAudit.mock.calls[0][0].stages).toEqual({ scan: false, reports: true });
});

test('Last created without a scan shows the all-folders note', async () => {
    runAudit.mockResolvedValue(out({ lastCreated: rows([{ actor: 'a@engsurveys.com.au', lastCreatedAt: '2026-09-01T00:00:00Z', lastProject: 'X', driveName: '_A', countInWindow: 1 }]) }, { lastCreatedScope: 'allFolders' }));
    renderView();
    await screen.findByText(/last project created/);
    fireEvent.click(runBtn('Staff — last project created (last 90 days)'));
    expect(await screen.findByText(/counts every folder created on a shared drive/)).toBeInTheDocument();
});

test('Stop on a panel cancels its job and the panel shows Stopping', async () => {
    let args;
    runAudit.mockImplementation((a) => { args = a; return new Promise(() => {}); });
    renderView();
    await screen.findByText('Drive item cap (500,000)');
    fireEvent.click(runBtn('Drive item cap (500,000)'));
    const stop = await within(panel('Drive item cap (500,000)')).findByRole('button', { name: /^Stop$/i });
    fireEvent.click(stop);
    expect(args.shouldCancel()).toBe(true);
    expect(await within(panel('Drive item cap (500,000)')).findByText(/Stopping/)).toBeInTheDocument();
});

test('Run full audit while checks run stops them first, then runs everything', async () => {
    const pending = [];
    runAudit.mockImplementation((a) => new Promise((res) => { pending.push({ a, res }); }));
    renderView();
    await screen.findByText('Drive item cap (500,000)');
    fireEvent.click(runBtn('Drive item cap (500,000)'));
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /Stop all and run full audit/i }));
    await waitFor(() => expect(pending[0].a.shouldCancel()).toBe(true));
    pending[0].res(out({}, { status: 'partial' }));
    await waitFor(() => expect(pending).toHaveLength(3));
    expect(pending[1].a.stages).toEqual({ scan: true, reports: false });
    expect(pending[2].a.stages).toEqual({ scan: false, reports: true });
    expect(screen.getAllByText(/^(Running…|Scanning _A…)$/)).toHaveLength(7);
    pending[1].res(out()); pending[2].res(out());
    await waitFor(() => expect(screen.getByRole('button', { name: /^Run full audit$/i })).toBeEnabled());
    expect(screen.getByText(/· complete/)).toBeInTheDocument();
});

test('findings appear live as each drive finishes', async () => {
    runAudit.mockImplementation(async ({ onProgress }) => {
        await onProgress({ driveIndex: 1, driveTotal: 1, driveName: '_A', items: 500, results: results({ unknownClients: rows([{ drive: '_A', client: 'Mystery Co', folderId: 'm1', closest: null }]) }) });
        return new Promise(() => {});
    });
    renderView();
    await screen.findByText('Unknown clients');
    fireEvent.click(runBtn('Unknown clients'));
    expect(await screen.findByText('Mystery Co')).toBeInTheDocument();
    expect(screen.getByText(/Drive 1 of 1 · _A · 500 items/)).toBeInTheDocument();
});

test('an interrupted scan shows a banner, marks scan panels incomplete and lists unscanned drives in Notes', async () => {
    const TWO = [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }];
    loadLatestAuditRun.mockResolvedValue({
        id: 'r1', started_at: '2026-10-02T00:00:00Z', finished_at: null, actor: 'Shivam', status: 'partial',
        reports_available: null, drives_done: 1, drives_total: 2,
        results: results({ driveCaps: rows([{ drive: '_A', driveId: 'a', total: 10, trashed: 0, level: 'ok' }]), scanCoverage: { done: 1, total: 2, driveIds: ['a'], at: '2026-10-02T00:03:00Z' } }),
    });
    renderView({ drives: TWO });
    expect(await screen.findByText(/last scan stopped after 1 of 2 drives/i)).toBeInTheDocument();
    expect(within(panel('Drive item cap (500,000)')).getByText(/incomplete · 1\/2 drives/)).toBeInTheDocument();
    expect(within(panel('Drive item cap (500,000)')).queryByText(/never run/)).toBeNull();
    const notes = panel('Notes (unclassified drives + errors)');
    expect(within(notes).getByText('_B')).toBeInTheDocument();
    expect(within(notes).getByText(/Not scanned/)).toBeInTheDocument();
});

test('drives that failed to list offer Continue scan, which rescans only them', async () => {
    const TWO = [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }];
    loadLatestAuditRun.mockResolvedValue({
        id: 'r1', started_at: '2026-10-02T00:00:00Z', finished_at: '2026-10-02T00:09:00Z', actor: 'Shivam', status: 'complete',
        reports_available: null, drives_done: 2, drives_total: 2,
        results: results({
            driveCaps: rows([{ drive: '_A', driveId: 'a', total: 10, trashed: 0, level: 'ok' }]),
            errors: rows([{ drive: '_B', message: 'User rate limit exceeded.', source: 'scan', kind: 'listFailed' }]),
            scanCoverage: { done: 2, total: 2, driveIds: ['a', 'b'], at: '2026-10-02T00:09:00Z', checks: ['driveCaps'] },
        }),
    });
    renderView({ drives: TWO });
    expect(await screen.findByText(/1 drive failed to scan/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue scan \(1 drive\)/i }));
    await waitFor(() => expect(runAudit).toHaveBeenCalledTimes(1));
    expect(runAudit.mock.calls[0][0].drives.map((d) => d.id)).toEqual(['b']);
});

test('an expired sign-in shows Reconnect and continue, which reconnects first', async () => {
    const TWO = [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }];
    tokenExpiresIn.mockReturnValue(0);
    connectSilent.mockResolvedValue(false);
    loadLatestAuditRun.mockResolvedValue({
        id: 'r1', started_at: '2026-10-02T00:00:00Z', finished_at: '2026-10-02T01:05:00Z', actor: 'Shivam', status: 'partial',
        reports_available: null, drives_done: 1, drives_total: 2,
        results: results({ scanCoverage: { done: 1, total: 2, driveIds: ['a'], at: '2026-10-02T01:05:00Z', checks: ['driveCaps'], pausedForAuth: true } }),
    });
    renderView({ drives: TWO });
    expect(await screen.findByText(/Google sign-in expired after 1 of 2 drives/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reconnect and continue/i }));
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(runAudit).toHaveBeenCalledTimes(1));
    expect(runAudit.mock.calls[0][0].drives.map((d) => d.id)).toEqual(['b']);
});

test('the item cap panel lists every drive with last scanned and outcome; Scan runs just that drive', async () => {
    const THREE = [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }, { id: 'c', name: '_C' }];
    loadLatestAuditRun.mockResolvedValue({
        id: 'r1', started_at: '2026-10-02T00:00:00Z', finished_at: '2026-10-02T00:05:00Z', actor: 'Shivam', status: 'partial',
        reports_available: null, drives_done: 2, drives_total: 3,
        results: results({
            driveCaps: rows([{ drive: '_A', driveId: 'a', total: 10, trashed: 2, level: 'ok' }]),
            driveScans: {
                a: { name: '_A', at: '2026-10-02T00:03:00Z', status: 'ok', message: null, items: 10, trashed: 2, counts: { driveCaps: 1 } },
                b: { name: '_B', at: '2026-10-02T00:04:00Z', status: 'listFailed', message: 'User rate limit exceeded.', items: null, trashed: null, counts: { errors: 1 } },
            },
            scanCoverage: { done: 2, total: 3, driveIds: ['a', 'b'], at: '2026-10-02T00:04:00Z', checks: ['driveCaps'], mode: 'full' },
        }),
    });
    renderView({ drives: THREE });
    const cap = await waitFor(() => panel('Drive item cap (500,000)'));
    const rowOf = (name) => within(cap).getByText(name).closest('[data-drive-row]');
    await waitFor(() => expect(within(rowOf('_A')).getByText('10')).toBeInTheDocument());
    expect(within(rowOf('_A')).getByText('OK')).toBeInTheDocument();
    expect(within(rowOf('_B')).getByText(/Failed/)).toBeInTheDocument();
    expect(within(rowOf('_C')).getByText(/Not scanned/)).toBeInTheDocument();
    fireEvent.click(within(cap).getByRole('button', { name: 'Scan _C' }));
    await waitFor(() => expect(runAudit).toHaveBeenCalledTimes(1));
    expect(runAudit.mock.calls[0][0].drives).toEqual([{ id: 'c', name: '_C' }]);
    expect(runAudit.mock.calls[0][0].stages).toEqual({ scan: true, reports: false });
});

test('during a scan: the drive being scanned is marked, other drives can be queued, panels name the drive', async () => {
    const TWO = [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }];
    runAudit.mockImplementation(() => new Promise(() => {}));
    renderView({ drives: TWO });
    const cap = await waitFor(() => panel('Drive item cap (500,000)'));
    fireEvent.click(within(cap).getByRole('button', { name: 'Scan _A' }));
    await waitFor(() => expect(runAudit).toHaveBeenCalledTimes(1));
    const rowOf = (name) => within(cap).getByText(name).closest('[data-drive-row]');
    await waitFor(() => expect(within(rowOf('_A')).getByRole('button', { name: 'Scanning _A' })).toBeDisabled());
    expect(within(rowOf('_A')).getByText('Scanning…')).toBeInTheDocument();
    expect(within(panel('Non-standard project names')).getByText('Scanning _A…')).toBeInTheDocument();
    // _B stays clickable: it is queued, not started alongside.
    fireEvent.click(within(rowOf('_B')).getByRole('button', { name: 'Scan _B' }));
    await waitFor(() => expect(within(rowOf('_B')).getByRole('button', { name: 'Unqueue _B' })).toBeInTheDocument());
    expect(within(rowOf('_B')).getByText('Queued')).toBeInTheDocument();
    expect(runAudit).toHaveBeenCalledTimes(1);
    // Unqueue puts it back.
    fireEvent.click(within(rowOf('_B')).getByRole('button', { name: 'Unqueue _B' }));
    await waitFor(() => expect(within(rowOf('_B')).getByRole('button', { name: 'Scan _B' })).toBeInTheDocument());
});

test('the header counts drives that have results, not the drives this run finished', async () => {
    loadLatestAuditRun.mockResolvedValue(completeRun({
        drives_done: 0, drives_total: 3,
        results: results({ driveCaps: rows([{ drive: '_A', driveId: 'a', total: 1, trashed: 0, level: 'ok' }, { drive: '_B', driveId: 'b', total: 1, trashed: 0, level: 'ok' }]) }),
    }));
    renderView({ drives: [{ id: 'a', name: '_A' }, { id: 'b', name: '_B' }, { id: 'c', name: '_C' }] });
    expect(await screen.findByText(/· 2\/3 drives/)).toBeInTheDocument();
});

test('a complete scan shows no incomplete banner', async () => {
    loadLatestAuditRun.mockResolvedValue(completeRun({ results: results({ scanCoverage: { done: 1, total: 1, driveIds: ['a'], at: '2026-10-02T00:03:00Z' }, checkedAt: { driveCaps: '2026-10-02T00:03:00Z' } }) }));
    renderView();
    await screen.findByText(/Last run/);
    expect(screen.queryByText(/last scan stopped/i)).toBeNull();
    expect(within(panel('Drive item cap (500,000)')).getByText(/checked 2h ago/)).toBeInTheDocument();
});

test('Algolia not configured shows the notice on the Unknown clients panel', async () => {
    isAlgoliaConfigured.mockReturnValue(false);
    renderView();
    expect(await screen.findByText(/Algolia not configured/)).toBeInTheDocument();
});

test('reports_available false shows the admin-access notice on Deletions and Last created', async () => {
    loadLatestAuditRun.mockResolvedValue(completeRun({ reports_available: false }));
    renderView();
    expect(await screen.findAllByText(/needs Workspace admin reports access/)).toHaveLength(2);
});

test('a missing reports scope shows a reconnect prompt that calls connect', async () => {
    hasReportsScope.mockReturnValue(false);
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: /Reconnect Google to grant audit access/i }));
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
});

test('a token about to expire is refreshed silently before any job starts', async () => {
    tokenExpiresIn.mockReturnValue(60e3);
    renderView();
    await screen.findByText('Drive item cap (500,000)');
    fireEvent.click(runBtn('Drive item cap (500,000)'));
    await waitFor(() => expect(runAudit).toHaveBeenCalledTimes(1));
    expect(connectSilent).toHaveBeenCalledTimes(1);
    expect(connectSilent.mock.invocationCallOrder[0]).toBeLessThan(runAudit.mock.invocationCallOrder[0]);
});

test('capped lists say how many are shown', async () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ drive: '_B', client: `C${i}`, folderId: `f${i}`, closest: null }));
    loadLatestAuditRun.mockResolvedValue(completeRun({ results: results({ unknownClients: { rows: many, total: 3656 } }) }));
    renderView();
    expect(await screen.findByText(/showing 200 of 3,656/)).toBeInTheDocument();
});
