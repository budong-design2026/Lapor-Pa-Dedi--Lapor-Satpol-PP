// Yeuh Satpol! Service Worker — version: yeuh-satpol-v1
const CACHE_VERSION = "yeuh-satpol-v1";
const APP_SHELL = ["/", "/manifest.json", "/offline-data.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {}); return res; }).catch(() => caches.match(req).then((r) => r || new Response("Offline", { status: 503 }))));
    return;
  }
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {}); return res; }).catch(() => cached)));
});

setInterval(() => { self.registration.update().catch(() => {}); }, 10 * 60 * 1000);
self.addEventListener("message", (event) => { if (event.data === "SKIP_WAITING") self.skipWaiting(); });
