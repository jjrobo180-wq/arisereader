// A.R.I.S.E. service worker: shows push notifications and opens the app when one is tapped.
// (It does not cache pages, so the site always loads the newest version.)
//
// Reminders carry `snooze` ({ u, key, sig }): on phones and computers that show notification buttons
// (Android, Chrome, Edge) they get "Snooze 30 min" and "In 2 hours", which work right from the
// notification. Where there are no buttons (iPhone), tapping opens the app with a one-tap snooze bar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const SNOOZES = { snooze: 30, later: 120 };

/** On arisetodo.com "/" is the welcome page and the app lives at /app, so "/#/lifehub" goes to "/app#/lifehub". */
function appUrl(url) {
  const u = new URL(url || "/", self.location.origin);
  if (/^(www\.)?arisetodo\.com$/i.test(u.hostname) && u.pathname === "/" && u.hash.startsWith("#/")) u.pathname = "/app";
  return u.href;
}

/** The app address with what the snooze bar needs (which reminder, and its words). */
function withSnooze(url, data, title, body) {
  if (!data || !data.snooze || !data.snooze.key) return url;
  const sep = url.includes("?") ? "&" : (url.includes("#") ? "?" : "#/lifehub?");
  const p = new URLSearchParams({ n: data.snooze.key, nuid: String(data.snooze.u), ns: data.snooze.sig, nt: String(title || "").slice(0, 100), nb: String(body || "").slice(0, 160), nu: data.url || "/" });
  return url + sep + p.toString();
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "A.R.I.S.E.";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/", snooze: data.snooze || null },
  };
  if (data.snooze && data.snooze.key) options.actions = [{ action: "snooze", title: "Snooze 30 min" }, { action: "later", title: "In 2 hours" }];
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
  const n = event.notification;
  const data = n.data || {};
  n.close();
  // A snooze button: done right here, no app needed.
  if (SNOOZES[event.action] && data.snooze) {
    event.waitUntil(fetch("/api/push/snooze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ u: data.snooze.u, key: data.snooze.key, sig: data.snooze.sig, minutes: SNOOZES[event.action], title: n.title, body: n.body, url: data.url || "/" }),
    }).catch(() => {}));
    return;
  }
  const target = appUrl(withSnooze(data.url || "/", data, n.title, n.body));
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
