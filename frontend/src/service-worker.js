/* eslint-disable no-restricted-globals */
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

self.skipWaiting();
clientsClaim();

// This line is required for CRA's InjectManifest:
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Optional: runtime fallback can go here (not required)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
