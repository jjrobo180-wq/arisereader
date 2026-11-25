// Opens the hub a rule picks (shared/hubAutoOpen.ts) when Arise To Duo opens, or comes back after REOPEN_AFTER_MS.
// LifeHub keeps a copy of the account's rules on this device (saveHubOpenCopy), so WorkHub and FamilyHub can use
// them too. Only a hub page is switched (never a link into something, never another page), and only once per open.
import { useEffect } from "react";
import { HUB_ROUTE, REOPEN_AFTER_MS, cleanHubOpen, pickHub, type HubOpenRule } from "@shared/hubAutoOpen";

const KEY = "duo-hub-open";
export function saveHubOpenCopy(userId: unknown, rules: HubOpenRule[] | undefined) {
  try { localStorage.setItem(KEY, JSON.stringify({ user: String(userId ?? ""), rules: rules ?? [] })); } catch { /* not kept */ }
}
function copyFor(userId: unknown): HubOpenRule[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.user === String(userId ?? "") ? cleanHubOpen(v.rules) ?? [] : []; } catch { return []; }
}

/** Where this device is, if it can say quickly (only asked when there's a place rule). */
export function herePosition(timeout = 4000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((done) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return done(null);
    const t = setTimeout(() => done(null), timeout + 500);
    navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); done({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { clearTimeout(t); done(null); }, { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout });
  });
}

const HUB_HASH = /^#\/(lifehub|workhub|familyhub)\/?$/;
async function apply(userId: unknown) {
  const rules = copyFor(userId);
  if (!rules.some((r) => r.on)) return;
  if (!HUB_HASH.test(window.location.hash)) return;
  const where = rules.some((r) => r.on && r.kind === "place") ? await herePosition() : null;
  const rule = pickHub(rules, new Date(), where);
  if (!rule || !HUB_HASH.test(window.location.hash)) return;
  const to = `#${HUB_ROUTE[rule.hub]}`;
  if (window.location.hash.replace(/\/$/, "") !== to) window.location.hash = to;
}

/** Mounted once for a signed-in To Duo person. */
export function useHubAutoOpen(userId: unknown, active: boolean) {
  useEffect(() => {
    if (!active || !userId) return;
    void apply(userId);
    let hiddenAt = 0;
    const vis = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt >= REOPEN_AFTER_MS) void apply(userId);
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [userId, active]);
}
