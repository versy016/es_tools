// Unit tests for the Supabase-backed audit-run storage in service.js. The Supabase client
// is replaced with a chainable fake — nothing reaches a real database.
const calls = { from: [], upsert: [], order: [], limit: [] };
let upsertRow = { id: 'r1' };
let latestRows = [];

// Plain functions (not jest.fn) so CRA's resetMocks can't wipe their implementations.
const chain = {
    upsert(row) { calls.upsert.push(row); return chain; },
    select() { return chain; },
    single() { return Promise.resolve({ data: upsertRow, error: null }); },
    order(col, opts) { calls.order.push([col, opts]); return chain; },
    limit(n) { calls.limit.push(n); return Promise.resolve({ data: latestRows, error: null }); },
};
jest.mock('../../lib/supabase', () => ({ supabase: { from: (t) => { calls.from.push(t); return chain; } } }));

import { saveAuditRun, loadLatestAuditRun } from './service';

beforeEach(() => { calls.from = []; calls.upsert = []; calls.order = []; calls.limit = []; upsertRow = { id: 'r1' }; latestRows = []; });

describe('saveAuditRun', () => {
    test('upserts into shared_drive_audit_runs and returns the row id', async () => {
        const run = { actor: 'Shivam', status: 'running', drives_total: 3, results: {} };
        await expect(saveAuditRun(run)).resolves.toEqual({ id: 'r1' });
        expect(calls.from).toEqual(['shared_drive_audit_runs']);
        expect(calls.upsert).toEqual([run]);
    });
    test('strips an undefined id so the DB generates one', async () => {
        await saveAuditRun({ id: undefined, actor: 'x', status: 'running', results: {} });
        expect('id' in calls.upsert[0]).toBe(false);
    });
});

describe('loadLatestAuditRun', () => {
    test('orders by started_at desc, limit 1, returns the row', async () => {
        latestRows = [{ id: 'r9', status: 'complete' }];
        await expect(loadLatestAuditRun()).resolves.toEqual({ id: 'r9', status: 'complete' });
        expect(calls.from).toEqual(['shared_drive_audit_runs']);
        expect(calls.order).toEqual([['started_at', { ascending: false }]]);
        expect(calls.limit).toEqual([1]);
    });
    test('no rows → null', async () => { await expect(loadLatestAuditRun()).resolves.toBeNull(); });
});

describe('without a Supabase client', () => {
    test('saveAuditRun resolves { id: null } and loadLatestAuditRun resolves null', async () => {
        jest.resetModules();
        jest.doMock('../../lib/supabase', () => ({ supabase: null }));
        const svc = require('./service');
        await expect(svc.saveAuditRun({ status: 'running' })).resolves.toEqual({ id: null });
        await expect(svc.loadLatestAuditRun()).resolves.toBeNull();
    });
});
