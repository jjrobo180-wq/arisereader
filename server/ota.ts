// Live updates for the iPhone apps (no App Store build): each app asks here when it opens whether a
// newer copy of its web code exists (.github/scripts/ota_setup.py sets it up; @capgo/capacitor-updater
// does the asking, downloading and rolling back). New copies are built from master by
// .github/workflows/ota-publish.yml and kept as GitHub releases ("ota-<app>-<version>", a zip each)
// on this public repository, so nothing else stores them.
//
// Versions are "<native level>.<minutes at build>.0". An app is only offered a copy with its own
// native level (web code made for the native shell it has) that was built after the one it's running.
import type { Express } from "express";

export const OTA_APPS = ["todo", "podplus", "reader", "educator", "fit", "eyegaze", "trainer"] as const;
export type OtaApp = typeof OTA_APPS[number];
export type OtaRelease = { app: OtaApp; level: number; built: number; version: string; url: string };

const VERSION = /^(\d{1,4})\.(\d{1,10})\.0$/;
export function parseVersion(v: unknown): { level: number; built: number } | null {
  const m = VERSION.exec(String(v ?? "").trim());
  return m ? { level: Number(m[1]), built: Number(m[2]) } : null;
}

/** Releases from GitHub's list: tag "ota-<app>-<version>", a .zip asset each. */
export function releasesFrom(list: unknown): OtaRelease[] {
  const out: OtaRelease[] = [];
  for (const r of Array.isArray(list) ? list : []) {
    const m = /^ota-([a-z]+)-(\d{1,4}\.\d{1,10}\.0)$/.exec(String((r as any)?.tag_name || ""));
    if (!m || !(OTA_APPS as readonly string[]).includes(m[1]) || (r as any)?.draft) continue;
    const v = parseVersion(m[2])!;
    const asset = ((r as any)?.assets || []).find((a: any) => /\.zip$/i.test(String(a?.name || "")) && /^https:\/\/github\.com\//.test(String(a?.browser_download_url || "")));
    if (!asset) continue;
    out.push({ app: m[1] as OtaApp, level: v.level, built: v.built, version: m[2], url: asset.browser_download_url });
  }
  return out;
}

/** The copy this app should switch to, if any: same native level, built later, the newest. */
export function pickUpdate(releases: OtaRelease[], app: OtaApp, current: unknown): OtaRelease | null {
  const now = parseVersion(current);
  if (!now) return null;
  return releases.filter((r) => r.app === app && r.level === now.level && r.built > now.built).sort((a, b) => b.built - a.built)[0] ?? null;
}

export function registerOtaRoutes(app: Express, o: { fetchJson?: (url: string) => Promise<any>; repo?: string; now?: () => number } = {}) {
  const repo = o.repo ?? "jjrobo180-wq/arisereader";
  const now = o.now ?? Date.now;
  // GitHub answers "not changed" (304) to a repeat look without counting it against the hourly
  // allowance, so the list is asked for with the last answer's ETag.
  let etag = "", lastBody: any = null;
  const fetchJson = o.fetchJson ?? (async (url: string) => {
    const r = await fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "arisetodo-ota", ...(etag ? { "If-None-Match": etag } : {}), ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }, signal: AbortSignal.timeout(10_000) });
    if (r.status === 304 && lastBody) return lastBody;
    if (!r.ok) throw new Error(`github ${r.status} (left this hour: ${r.headers.get("x-ratelimit-remaining") ?? "?"})`);
    etag = r.headers.get("etag") || "";
    lastBody = await r.json();
    return lastBody;
  });
  // One look at GitHub every 5 minutes for every app and phone (well inside its hourly allowance).
  let cache: { at: number; list: OtaRelease[] } | null = null;
  let loading: Promise<OtaRelease[]> | null = null;
  const releases = async (): Promise<OtaRelease[]> => {
    if (cache && now() - cache.at < 5 * 60_000) return cache.list;
    loading ??= fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=100`)
      .then((list) => { const l = releasesFrom(list); cache = { at: now(), list: l }; return l; })
      // A failed look keeps the last list but tries again in a minute, not five.
      .catch((e) => { console.warn("[ota] couldn't read the releases:", e?.message || e); if (cache) cache = { at: now() - 4 * 60_000, list: cache.list }; return cache?.list ?? []; })
      .finally(() => { loading = null; });
    return loading;
  };
  const none = (res: any, why = "No new version available") => res.json({ message: why, error: "no_new_version_available" });

  app.post("/api/ota/:app", async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const which = String(req.params.app) as OtaApp;
    if (!(OTA_APPS as readonly string[]).includes(which)) return res.status(404).json({ message: "Unknown app", error: "unknown_app" });
    // Switched off from the server (an emergency stop: every phone keeps what it has).
    if (process.env.OTA_OFF === "1") return none(res, "Live updates are paused");
    // The copy it's running ("builtin" is the one it shipped with: then the version set at build).
    const current = parseVersion(req.body?.version_name) ? req.body.version_name : req.body?.version_build;
    const list = await releases();
    const next = pickUpdate(list, which, current);
    const newest = list.filter((r) => r.app === which).sort((a, b) => b.built - a.built)[0]?.version || "none";
    console.log(`[ota] ${which} running ${String(req.body?.version_name ?? "")}/${String(req.body?.version_build ?? "")} → ${next ? `offered ${next.version}` : "nothing new"} (newest known ${newest})`);
    if (!next) return none(res);
    res.json({ version: next.version, url: next.url });
  });
  // Channel requests (the updater may ask): there's one channel.
  app.put("/api/ota/:app", (_req, res) => res.json({ status: "ok", channel: "production" }));
  app.get("/api/ota/:app", (_req, res) => res.json({ channel: "production", status: "ok" }));
}
