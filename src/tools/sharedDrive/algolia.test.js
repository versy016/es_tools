// Unit tests for the browser-side Algolia client used by the Shared Drive audit to pull the
// full ESE master client list. fetch is mocked — no network.
//
// Uses the BROWSE endpoint (cursor paging), not search: search caps at 1,000 total hits
// (paginationLimitedTo) and the clients index holds ~1,400, so search silently dropped
// ~400 clients and every one of them was flagged as "unknown".
jest.mock('../../config', () => ({ ALGOLIA_APP_ID: 'APP', ALGOLIA_SEARCH_KEY: 'KEY' }));

import { listAllClients, isAlgoliaConfigured } from './algolia';

const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

beforeEach(() => { global.fetch = jest.fn(); });

describe('listAllClients', () => {
    test('browses with cursor paging until no cursor and maps title/reference', async () => {
        fetch.mockResolvedValueOnce(json({ hits: [{ title: 'ARTC', reference: 'ARTC' }], cursor: 'c1' }))
            .mockResolvedValueOnce(json({ hits: [{ title: 'Adbri Concrete', reference: 'Adbri Concrete' }] }));
        await expect(listAllClients()).resolves.toEqual([
            { title: 'ARTC', reference: 'ARTC' }, { title: 'Adbri Concrete', reference: 'Adbri Concrete' },
        ]);
        expect(fetch).toHaveBeenCalledTimes(2);
        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe('https://APP-dsn.algolia.net/1/indexes/clients/browse');
        expect(init.method).toBe('POST');
        expect(init.headers['X-Algolia-Application-Id']).toBe('APP');
        expect(init.headers['X-Algolia-API-Key']).toBe('KEY');
        expect(JSON.parse(init.body)).toEqual({ hitsPerPage: 1000, attributesToRetrieve: ['title', 'reference'] });
        expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ cursor: 'c1' });
    });

    test('empty index returns [] after one request', async () => {
        fetch.mockResolvedValueOnce(json({ hits: [] }));
        await expect(listAllClients()).resolves.toEqual([]);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('missing title/reference become empty strings', async () => {
        fetch.mockResolvedValueOnce(json({ hits: [{ objectID: 'x' }] }));
        await expect(listAllClients()).resolves.toEqual([{ title: '', reference: '' }]);
    });

    test('403 explains that the key needs the browse permission', async () => {
        fetch.mockResolvedValueOnce(json({ message: 'Method not allowed with this API key' }, 403));
        await expect(listAllClients()).rejects.toThrow(/browse/i);
    });

    test('other non-OK responses throw with the status in the message', async () => {
        fetch.mockResolvedValueOnce(json({ message: 'nope' }, 500));
        await expect(listAllClients()).rejects.toThrow(/500/);
    });
});

describe('isAlgoliaConfigured', () => {
    test('true when both values are set', () => expect(isAlgoliaConfigured()).toBe(true));

    test('false when a value is empty, and listAllClients throws', async () => {
        jest.resetModules();
        jest.doMock('../../config', () => ({ ALGOLIA_APP_ID: 'APP', ALGOLIA_SEARCH_KEY: '' }));
        const mod = require('./algolia');
        expect(mod.isAlgoliaConfigured()).toBe(false);
        await expect(mod.listAllClients()).rejects.toThrow('Algolia is not configured');
        expect(fetch).not.toHaveBeenCalled();
    });
});
