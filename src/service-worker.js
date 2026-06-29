/* eslint-disable no-restricted-globals */
// Service worker (compiled by CRA's Workbox InjectManifest). Basic PWA: precaches
// the built app shell + assets and serves index.html offline so the installed app
// opens without a network. Data still needs the network for now — see the FUTURE
// note at the bottom for how to add full offline (queued report sync).

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

clientsClaim();

// Precache everything the build emits (CSS/JS/icons) — injected at build time.
precacheAndRoute(self.__WB_MANIFEST);

// App-shell routing: for SPA navigations, serve the cached index.html so any
// in-app route loads offline. Skip asset files and the build's internal paths.
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
    ({ request, url }) => {
        if (request.mode !== 'navigate') return false;
        if (url.pathname.startsWith('/_')) return false;
        if (url.pathname.match(fileExtensionRegexp)) return false;
        return true;
    },
    createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// Runtime cache for same-origin images (icons, etc.) — stale-while-revalidate.
registerRoute(
    ({ url }) => url.origin === self.location.origin && /\.(?:png|jpg|jpeg|svg|gif|webp)$/.test(url.pathname),
    new StaleWhileRevalidate({
        cacheName: 'images',
        plugins: [new ExpirationPlugin({ maxEntries: 60 })],
    })
);

// Let the page tell a waiting SW to activate immediately (used by the update flow).
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── FUTURE: full offline support ──────────────────────────────────────────────
// To let surveyors save reports/drafts with no signal and sync when back online:
//   1. import { BackgroundSyncPlugin } from 'workbox-background-sync';
//   2. registerRoute(({url}) => url.href.startsWith('<supabase>/rest|/storage'),
//        new NetworkOnly({ plugins: [new BackgroundSyncPlugin('es-report-queue',
//          { maxRetentionTime: 24 * 60 })] }), 'POST');
//   3. Mirror reads with CacheFirst/NetworkFirst where appropriate.
// (No app code today depends on this; it's purely additive.)
