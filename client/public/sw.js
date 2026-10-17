// A.R.I.S.E. Reader service worker: shows push notifications and opens the app when one is tapped.
// (It does not cache pages, so the site always loads the newest version.)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "A.R.I.S.E. Reader";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  // A timer going off: stays on screen and buzzes until it is dealt with, and a repeat with the same tag buzzes again.
  if (data.urgent === true) {
    options.requireInteraction = true;
    options.renotify = !!data.tag;
    options.vibrate = [250, 120, 250, 120, 250];
  }
  event.waitUntil((async () => {
    // Take away notifications this one replaces (the "timer running" one goes when the timer rings).
    if (Array.isArray(data.closeTags)) {
      for (const tag of data.closeTags.slice(0, 5)) {
        try { (await self.registration.getNotifications({ tag: String(tag) })).forEach((n) => n.close()); } catch (e) {}
      }
    }
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && "focus" in client) {
        await client.focus();
        if ("navigate" in client) { try { await client.navigate(target); } catch (e) {} }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
