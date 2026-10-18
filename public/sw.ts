/// <reference lib="webworker" />
/**
 * Verda ERP · Service Worker (Workbox)
 * ------------------------------------------------------------------
 * Offline-first engine for the field supervisor & supplier apps.
 * - Precaches the app shell
 * - Never caches authenticated Supabase responses (prevents cross-session data)
 * - Buffers all mutations in a BackgroundSync queue (IndexedDB) and
 *   flushes them automatically when connectivity returns
 *
 * Register from main.tsx (dev only) — production uses vite-plugin-pwa.
 */
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkFirst, NetworkOnly, StaleWhileRevalidate, CacheFirst } from "workbox-strategies";
import { Queue } from "workbox-background-sync";
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

// Activate a newly downloaded release immediately. Without this, a browser can
// keep serving an old precached app shell until every existing tab is closed.
self.skipWaiting();
cleanupOutdatedCaches();

// Always prefer the latest HTML while online. The precached shell remains the
// offline fallback, but it must not hide a newly deployed JavaScript bundle.
registerRoute(
  ({ request, url }) => request.mode === "navigate" && url.origin === self.location.origin,
  new NetworkFirst({ cacheName: "verda-navigation", networkTimeoutSeconds: 4 }),
  "GET",
);

// 1. App shell (populated by the build via __WB_MANIFEST)
precacheAndRoute(self.__WB_MANIFEST || []);

// 2. The IndexedDB-backed mutation queue (the heart of offline capture)
export const mutationQueue = new Queue("verda-mutations", {
  maxRetentionTime: 24 * 60, // minutes — keep failed writes for 24h
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
        // optionally broadcast success to the app
      } catch (err) {
        await queue.unshiftRequest(entry);
        throw err;
      }
    }
  },
});

// 3. Firestore reads: prefer network, fall back to cache
registerRoute(
  ({ url }) => url.hostname.includes("firestore.googleapis.com") && url.pathname.includes("BatchGet"),
  new NetworkFirst({ cacheName: "verda-firestore", networkTimeoutSeconds: 3 }),
  "GET"
);

// 4. Weather API: stale-while-revalidate (hourly cache)
registerRoute(
  ({ url }) => url.hostname.includes("openweathermap.org"),
  new StaleWhileRevalidate({ cacheName: "verda-weather" }),
  "GET"
);

// 5. Static assets
registerRoute(({ request }) => ["style", "script", "image", "font"].includes(request.destination), new CacheFirst({ cacheName: "verda-assets", plugins: [new ExpirationPlugin({ maxAgeSeconds: 30 * 24 * 60 * 60, maxEntries: 250 })] }));

// OpenStreetMap tiles: offline-friendly, bounded seven-day cache.
registerRoute(({ url }) => /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname), new CacheFirst({ cacheName: "verda-map-tiles", plugins: [new ExpirationPlugin({ maxAgeSeconds: 7 * 24 * 60 * 60, maxEntries: 600 })] }), "GET");

// Supabase responses are identity-scoped by their Authorization header. Workbox
// cache keys do not include that header, so caching these requests can replay an
// anonymous (or another user's) RLS response after login. Always go to the
// network; offline business data is handled by the app's user-scoped stores.
registerRoute(
  ({ url, request }) => request.method === "GET" && url.hostname.endsWith(".supabase.co"),
  new NetworkOnly(),
  "GET"
);

// Remove the unsafe cache created by earlier service-worker versions as soon as
// this release activates. clientsClaim() below makes the corrected worker take
// control without requiring the user to uninstall the PWA.
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete("verda-supabase-api"));
});

// 6. Catch-all fallback to the app shell for navigation
setCatchHandler(async ({ event }) => {
  if (event.request.destination === "document") {
    return (await caches.match("/")) || (await caches.match("/index.html")) || Response.error();
  }
  return Response.error();
});

// 7. Background sync tag the app can trigger: registration.sync.register('flush-verda')
self.addEventListener("sync", (event) => {
  if (event.tag === "flush-verda") event.waitUntil(mutationQueue.replayRequests());
});

// 8. FCM push → show notification even when app is closed
self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(payload.title || "KDU TEA FACTORY", {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: payload.data || {},
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

clientsClaim();
