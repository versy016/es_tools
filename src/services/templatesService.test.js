// Unit tests for the managed-templates service (Supabase "templates" bucket). The storage
// client is a chainable fake — nothing reaches a real bucket.
const calls = { from: [], list: [], upload: [], remove: [] };
let listResult = { data: [], error: null };
let uploadResult = { data: { path: 'x' }, error: null };
let removeResult = { data: [], error: null };
const bucket = {
    list(path, opts) { calls.list.push([path, opts]); return Promise.resolve(listResult); },
    upload(name, file, opts) { calls.upload.push([name, file, opts]); return Promise.resolve(uploadResult); },
    remove(names) { calls.remove.push(names); return Promise.resolve(removeResult); },
};
jest.mock('../lib/supabase', () => ({ supabase: { storage: { from: (b) => { calls.from.push(b); return bucket; } } } }));

import { MANAGED_TEMPLATES, listManagedTemplates, uploadTemplate, removeTemplate } from './templatesService';

beforeEach(() => {
    calls.from = []; calls.list = []; calls.upload = []; calls.remove = [];
    listResult = { data: [], error: null }; uploadResult = { data: { path: 'x' }, error: null }; removeResult = { data: [], error: null };
});

test('MANAGED_TEMPLATES names the three report templates with labels', () => {
    expect(MANAGED_TEMPLATES.map((t) => t.name)).toEqual(['photo-report.docx', 'service-location.docx', 'swms.docx']);
    MANAGED_TEMPLATES.forEach((t) => { expect(t.label).toBeTruthy(); expect(t.tool).toBeTruthy(); });
});

test('listManagedTemplates merges the bucket listing onto the known templates', async () => {
    listResult = { data: [{ name: 'swms.docx', updated_at: '2026-09-01T00:00:00Z', metadata: { size: 12345 } }, { name: 'other.docx' }], error: null };
    const out = await listManagedTemplates();
    expect(calls.from).toEqual(['templates']);
    expect(out).toEqual([
        { name: 'photo-report.docx', label: expect.any(String), tool: expect.any(String), managed: false, updatedAt: null, size: null },
        { name: 'service-location.docx', label: expect.any(String), tool: expect.any(String), managed: false, updatedAt: null, size: null },
        { name: 'swms.docx', label: expect.any(String), tool: expect.any(String), managed: true, updatedAt: '2026-09-01T00:00:00Z', size: 12345 },
    ]);
});

test('listManagedTemplates throws on a storage error', async () => {
    listResult = { data: null, error: new Error('bucket missing') };
    await expect(listManagedTemplates()).rejects.toThrow('bucket missing');
});

test('uploadTemplate upserts the .docx under its managed name', async () => {
    const file = new Blob(['x'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await uploadTemplate('swms.docx', file);
    expect(calls.upload).toEqual([['swms.docx', file, { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }]]);
});

test('uploadTemplate rejects names that are not managed templates', async () => {
    await expect(uploadTemplate('evil.docx', new Blob())).rejects.toThrow(/not a managed template/);
    expect(calls.upload).toHaveLength(0);
});

test('removeTemplate deletes the managed copy so the bundled one is used again', async () => {
    await removeTemplate('photo-report.docx');
    expect(calls.remove).toEqual([['photo-report.docx']]);
});

test('without a Supabase client, list reports nothing managed and writes throw', async () => {
    jest.resetModules();
    jest.doMock('../lib/supabase', () => ({ supabase: null }));
    const svc = require('./templatesService');
    const out = await svc.listManagedTemplates();
    expect(out.every((t) => t.managed === false)).toBe(true);
    await expect(svc.uploadTemplate('swms.docx', new Blob())).rejects.toThrow(/not configured/);
});
