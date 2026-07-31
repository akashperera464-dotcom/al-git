/// <reference lib="webworker" />
/**
 * Verda ERP · Service Worker (Workbox)
 * ------------------------------------------------------------------
 * Offline-first engine for the field supervisor & supplier apps.
 * - Precaches the app shell
 * - Serves read APIs NetworkFirst (fresh when online, cached when down)
 * - Buffers all mutations in a BackgroundSync queue (IndexedDB) and
 *   flushes them automatically when connectivity returns
 *
 * Register from main.tsx (dev only) — production uses vite-plugin-pwa.
 */
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from "workbox-strategies";
import { Queue } from "workbox-background-sync";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope;

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
registerRoute(({ request }) => ["style", "script", "image", "font"].includes(request.destination), new CacheFirst({ cacheName: "verda-assets" }));

// 6. Catch-all fallback to the app shell for navigation
setCatchHandler(async ({ event }) => {
  if (event.request.destination === "document") {
    return (await caches.match("/")) || Response.error();
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
