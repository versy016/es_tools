// Browser-side Algolia client for the Shared Drive audit. Pulls the FULL ESE master client
// list from the `clients` index (the desktop Project Directory Creation app keeps that index
// in sync with ESE). Uses the REST API directly — no SDK, no backend.
//
// It must use the BROWSE endpoint, not search: search caps at 1,000 total hits
// (paginationLimitedTo) and the index holds ~1,400 clients, so search silently dropped
// ~400 of them and every one was flagged as "unknown". Browse pages by cursor with no cap,
// and needs the key to carry the `browse` ACL (search + browse, still read-only).
import { ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY } from '../../config';

const INDEX = 'clients';
const PAGE_SIZE = 1000;

export const isAlgoliaConfigured = () => Boolean(ALGOLIA_APP_ID && ALGOLIA_SEARCH_KEY);

// Returns every client as [{ title, reference }].
export const listAllClients = async () => {
    if (!isAlgoliaConfigured()) throw new Error('Algolia is not configured');
    const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${INDEX}/browse`;
    const out = [];
    let cursor;
    do {
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Algolia-Application-Id': ALGOLIA_APP_ID,
                'X-Algolia-API-Key': ALGOLIA_SEARCH_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(cursor ? { cursor } : { hitsPerPage: PAGE_SIZE, attributesToRetrieve: ['title', 'reference'] }),
        });
        if (res.status === 403) throw new Error('The Algolia key needs the "browse" permission (API Keys → ACL → add browse; see supabase/SETUP.md §5c)');
        if (!res.ok) throw new Error(`Algolia error (${res.status})`);
        // eslint-disable-next-line no-await-in-loop
        const data = await res.json();
        (data.hits || []).forEach((h) => out.push({ title: h.title || '', reference: h.reference || '' }));
        cursor = data.cursor;
    } while (cursor);
    return out;
};
