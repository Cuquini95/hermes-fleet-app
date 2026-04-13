/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Take control of all clients immediately on activation
self.skipWaiting();
clientsClaim();

// ── Precache all build assets (manifest injected by vite-plugin-pwa) ──────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Runtime caching ───────────────────────────────────────────────────────────

// Google Fonts — cache-first, 1 year
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  }),
);

// Hermes API parts/diagrams — network-first, 24h fallback
registerRoute(
  ({ url }) => /\/hermes-api\/(parts|diagrams)\//i.test(url.pathname),
  new NetworkFirst({
    cacheName: 'hermes-api-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 })],
  }),
);

// ── Web Push ──────────────────────────────────────────────────────────────────

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: PushPayload = {};
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = { body: event.data.text() };
  }

  const title = payload.title ?? 'Hermes Fleet';
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: payload.tag ?? 'hermes-fleet',
    data: { url: payload.url ?? '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url: string = (event.notification.data as { url: string })?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open in a window, focus it
        for (const client of clientList) {
          if ('navigate' in client && 'focus' in client) {
            return (client as WindowClient).navigate(url).then((c) => c?.focus());
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(url);
      }),
  );
});
