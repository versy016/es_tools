// Tests for the reports persistence layer.
//
// The Supabase client is fully MOCKED here — a fake, in-memory client that records
// calls but talks to no server. This is the core guarantee behind "testing must not
// populate the database": the real @supabase/supabase-js is never even loaded, so
// saveReport/saveDraft/removeReport cannot reach the real project. Everything they
// "write" lands in the __records arrays below and is thrown away when the test ends.
//
// NOTE: the factory uses PLAIN functions (not jest.fn) because CRA's Jest config sets
// resetMocks:true, which would otherwise strip a factory jest.fn's implementation
// before each test. Plain closures keep their behaviour.

jest.mock('../lib/supabase', () => {
    const records = { uploaded: [], upserted: [], removed: [], deleted: [], user: { id: 'user-123' } };

    const bucket = {
        upload: (path, blob, opts) => { records.uploaded.push({ path, blob, opts }); return Promise.resolve({ data: { path }, error: null }); },
        remove: (paths) => { records.removed.push(paths); return Promise.resolve({ data: {}, error: null }); },
        download: () => Promise.resolve({ data: { text: () => Promise.resolve(JSON.stringify({ tool: 'photo', state: { a: 1 } })) }, error: null }),
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://signed.example/r1.pdf' }, error: null }),
    };

    // Chainable query builder covering the fluent calls the service makes.
    const query = () => {
        const q = {
            select: () => q,
            eq: () => q,
            order: () => Promise.resolve({ data: [], error: null }),
            single: () => Promise.resolve({ data: { storage_path: 'user-123/r1.pdf' }, error: null }),
            upsert: (row) => { records.upserted.push(row); return Promise.resolve({ error: null }); },
            delete: () => { records.deleted.push(true); return q; },
        };
        return q;
    };

    return {
        REPORTS_BUCKET: 'reports',
        __records: records,
        supabase: {
            auth: { getUser: () => Promise.resolve({ data: { user: records.user } }) },
            storage: { from: () => bucket },
            from: () => query(),
        },
    };
});

import { saveReport, saveDraft, loadDraft, listReports, getReportUrl, removeReport } from './reportsService';
import { __records } from '../lib/supabase';

const resetRecords = () => {
    __records.uploaded.length = 0; __records.upserted.length = 0;
    __records.removed.length = 0; __records.deleted.length = 0;
    __records.user = { id: 'user-123' };
};

beforeEach(() => {
    resetRecords();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

describe('saveReport', () => {
    test('uploads the file + upserts the row for a signed-in user (to the MOCK, not a real DB)', async () => {
        const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
        const ok = await saveReport({ id: 'r1', blob, meta: { title: 'Site A', siteAddress: '1 St', client: 'ACME', status: 'Final', meta: {} } });

        expect(ok).toBe(true);
        // Went to the reports bucket at <uid>/<id>.pdf.
        expect(__records.uploaded).toHaveLength(1);
        expect(__records.uploaded[0].path).toBe('user-123/r1.pdf');
        // Metadata row upserted with the report id + title.
        expect(__records.upserted).toHaveLength(1);
        expect(__records.upserted[0]).toMatchObject({ id: 'r1', title: 'Site A', status: 'Final' });
    });

    test('uses a .docx extension when the blob is a Word document', async () => {
        const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const blob = new Blob(['PK'], { type: DOCX });
        await saveReport({ id: 'r2', blob, meta: { title: 'S', meta: {} } });
        expect(__records.uploaded[0].path).toBe('user-123/r2.docx');
    });

    test('returns false and writes NOTHING when there is no signed-in user', async () => {
        __records.user = null;
        const ok = await saveReport({ id: 'r3', blob: new Blob(['x']), meta: { title: 'S', meta: {} } });
        expect(ok).toBe(false);
        expect(__records.uploaded).toHaveLength(0);
        expect(__records.upserted).toHaveLength(0);
    });
});

describe('saveDraft', () => {
    test('stores the tool state JSON with Draft status', async () => {
        const ok = await saveDraft({ id: 'd1', tool: 'photo', state: { step: 2 }, title: 'WIP', meta: {} });
        expect(ok).toBe(true);
        expect(__records.uploaded[0].path).toBe('user-123/d1.json');
        expect(__records.upserted[0]).toMatchObject({ id: 'd1', status: 'Draft' });
    });
});

describe('loadDraft', () => {
    test('re-hydrates the { tool, state } JSON from storage', async () => {
        const draft = await loadDraft('d1');
        expect(draft).toEqual({ tool: 'photo', state: { a: 1 } });
    });
});

describe('listReports', () => {
    test('returns [] with no rows and never throws', async () => {
        await expect(listReports()).resolves.toEqual([]);
    });
});

describe('getReportUrl', () => {
    test('returns a short-lived signed URL', async () => {
        await expect(getReportUrl('r1')).resolves.toBe('https://signed.example/r1.pdf');
    });
});

describe('removeReport', () => {
    test('removes the storage object then deletes the row', async () => {
        const ok = await removeReport('r1');
        expect(ok).toBe(true);
        expect(__records.removed[0]).toEqual(['user-123/r1.pdf']);
        expect(__records.deleted).toHaveLength(1);
    });
});
