/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE_MANIFEST__: { url: string; revision: string | null }[];

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

clientsClaim();
cleanupOutdatedCaches();

// Cache-first app shell: every asset below is self-hosted (no CDN), so once
// precached the app is fully usable with zero network requests.
precacheAndRoute(__PRECACHE_MANIFEST__);

// Routing is hash-based (#/path) so the only real navigation is to '/' itself;
// this fallback only matters if a deep link or refresh ever requests another path.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/')));

registerRoute(
  ({ request }) => request.destination === 'font' || request.destination === 'image',
  new CacheFirst({ cacheName: 'menuban-assets-v1' }),
);

// The page asks us to activate immediately only after the user confirms the
// "new version available" prompt, so updates never interrupt an open session.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
