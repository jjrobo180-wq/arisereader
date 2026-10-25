// Podscroll's service worker: makes the site installable and opens it offline to its shell.
// Podcasts, art and audio always come from the network; only the app's own files are cached.
const CACHE = "podscroll-v1";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/icon-192.png"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && (e.request.mode === "navigate" || url.pathname.startsWith("/assets/"))) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request.mode === "navigate" ? "/" : e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request.mode === "navigate" ? "/" : e.request).then((r) => r || Response.error())));
});
