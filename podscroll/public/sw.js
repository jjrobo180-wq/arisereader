// Pod+'s service worker: makes the site installable and opens it offline to its pages.
// Podcasts, art and audio always come from the network; only the site's own files are cached.
// Pages are kept under their own address, so the homepage (/) and the player (/app/) never swap.
const CACHE = "podscroll-v2";
const page = (url) => (url.pathname.startsWith("/app") ? "/app/" : "/");
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/app/", "/icon-192.png"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  const nav = e.request.mode === "navigate";
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && (nav || url.pathname.startsWith("/assets/"))) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(nav ? page(url) : e.request, copy)); }
    return res;
  }).catch(() => caches.match(nav ? page(url) : e.request).then((r) => r || Response.error())));
});
