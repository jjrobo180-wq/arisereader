// Live updates for the iPhone apps are OFF, for good (App Review 2.5.2 and 2.5.19: an app may not
// download code that adds or changes its features after review). Every change to an iPhone app now
// ships as an App Store build. This endpoint still answers the updater that's inside builds already
// on phones, and it always answers "nothing new", so those phones keep the copy they have.
// .github/workflows/ota-publish.yml (which built the updates) is gone; the old "ota-*" releases on
// GitHub are never offered or handed out again.
//
// Still here: the Windows and Linux desktop apps' downloads (/download/desktop/<file>), which are not
// App Store apps and are fetched the same way, from GitHub releases through this server.
import type { Express } from "express";

/** What the updater in older builds is told, every time. */
export const LIVE_UPDATES_OFF = "Live updates are off: every change comes as an App Store update.";

export const OTA_APPS = ["todo", "podplus", "reader", "educator", "fit", "eyegaze", "trainer", "notes", "talk"] as const;
export type OtaApp = typeof OTA_APPS[number];
/** `checksum`: the zip's SHA-256 (hex). The updater on the phone (@capgo/capacitor-updater 8) refuses
 *  any update without it ("Checksum required") and checks the download against it before unpacking.
 *  GitHub records it for every release file (`digest: "sha256:…"`). */
export type OtaRelease = { app: OtaApp; level: number; built: number; version: string; url: string; checksum: string; assetId?: number };
/** Where phones and computers fetch files from: this server (arisetodo.com), never GitHub directly. */
export const FILE_HOST = "https://arisetodo.com";
export const otaFileUrl = (r: Pick<OtaRelease, "app" | "version">) => `${FILE_HOST}/api/ota-file/${r.app}/${r.version}.zip`;
/** A desktop download's file names: "Arise-To-Duo-Setup.exe", "latest.yml", "Arise-To-Duo-linux.AppImage". */
const DESKTOP_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

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
    const checksum = /^sha256:([a-f0-9]{64})$/i.exec(String(asset?.digest || ""))?.[1]?.toLowerCase();
    // Without a checksum the phone won't install it, so it isn't offered.
    if (!asset || !checksum) continue;
    out.push({ app: m[1] as OtaApp, level: v.level, built: v.built, version: m[2], url: asset.browser_download_url, checksum, ...(Number.isFinite(asset.id) ? { assetId: Number(asset.id) } : {}) });
  }
  return out;
}

/** The copy this app should switch to, if any: same native level, built later, the newest. */
export function pickUpdate(releases: OtaRelease[], app: OtaApp, current: unknown): OtaRelease | null {
  const now = parseVersion(current);
  if (!now) return null;
  return releases.filter((r) => r.app === app && r.level === now.level && r.built > now.built).sort((a, b) => b.built - a.built)[0] ?? null;
}

/** The desktop app's files (the "desktop" release): name -> { id, url }. */
export function desktopFilesFrom(list: unknown): Map<string, { id?: number; url: string }> {
  const out = new Map<string, { id?: number; url: string }>();
  const rel = (Array.isArray(list) ? list : []).find((r: any) => r?.tag_name === "desktop" && !r?.draft);
  for (const a of rel?.assets || []) {
    const name = String(a?.name || ""), url = String(a?.browser_download_url || "");
    if (DESKTOP_FILE.test(name) && /^https:\/\/github\.com\//.test(url)) out.set(name, { ...(Number.isFinite(a?.id) ? { id: Number(a.id) } : {}), url });
  }
  return out;
}

type Resolve = (assetId: number | undefined, publicUrl: string) => Promise<string>;

export function registerOtaRoutes(app: Express, o: { fetchJson?: (url: string) => Promise<any>; repo?: string; now?: () => number; resolve?: Resolve; token?: () => string | undefined } = {}) {
  const repo = o.repo ?? "jjrobo180-wq/arisereader";
  const now = o.now ?? Date.now;
  const token = o.token ?? (() => process.env.GITHUB_TOKEN || undefined);
  /** Where a release file can be fetched right now. With a token GitHub hands out a signed link that
   *  lasts a few minutes (works for a private repository); without one, the public link. */
  const resolve: Resolve = o.resolve ?? (async (assetId, publicUrl) => {
    const t = token();
    if (!t || !assetId) return publicUrl;
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/releases/assets/${assetId}`, { redirect: "manual", headers: { Accept: "application/octet-stream", "User-Agent": "arisetodo-ota", Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(10_000) });
      const where = r.headers.get("location");
      if (r.status >= 300 && r.status < 400 && where && /^https:\/\//.test(where)) return where;
      lastError = `asset ${assetId}: github ${r.status}`;
    } catch (e: any) { lastError = `asset ${assetId}: ${e?.message || e}`; }
    return publicUrl;
  });
  let lastError = "", lastOk = "";
  let rawList: unknown = [];
  // GitHub answers "not changed" (304) to a repeat look without counting it against the hourly
  // allowance, so the list is asked for with the last answer's ETag.
  let etag = "", lastBody: any = null;
  const fetchJson = o.fetchJson ?? (async (url: string) => {
    const t = token();
    const r = await fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "arisetodo-ota", ...(etag ? { "If-None-Match": etag } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, signal: AbortSignal.timeout(10_000) });
    if (r.status === 304 && lastBody) return lastBody;
    if (!r.ok) throw new Error(`github ${r.status} (left this hour: ${r.headers.get("x-ratelimit-remaining") ?? "?"})`);
    etag = r.headers.get("etag") || "";
    lastBody = await r.json();
    return lastBody;
  });
  // One look at GitHub a minute with a token (5,000 an hour allowed; repeats that didn't change don't count),
  // every 5 minutes without one (60 an hour), shared by every app and phone.
  const every = token() ? 60_000 : 5 * 60_000;
  let cache: { at: number; list: OtaRelease[] } | null = null;
  let loading: Promise<OtaRelease[]> | null = null;
  const releases = async (): Promise<OtaRelease[]> => {
    if (cache && now() - cache.at < every) return cache.list;
    loading ??= fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=100`)
      .then((list) => { rawList = list; const l = releasesFrom(list); cache = { at: now(), list: l }; lastOk = new Date(now()).toISOString(); return l; })
      // A failed look keeps the last list but tries again in a minute, not five.
      .catch((e) => { lastError = String(e?.message || e).slice(0, 200); console.warn("[ota] couldn't read the releases:", lastError); if (cache) cache = { at: now() - Math.max(0, every - 60_000), list: cache.list }; return cache?.list ?? []; })
      .finally(() => { loading = null; });
    return loading;
  };
  const none = (res: any, why = "No new version available") => res.json({ message: why, error: "no_new_version_available" });
  // The last few update checks, so we can see what a phone is running and what it was offered
  // (app, versions and plugin details only: nothing about the person).
  const recent: { at: string; app: string; running: string; build: string; plugin: string; os: string; offered: string }[] = [];
  // Also whether this server can read the releases (and so whether the repository can be private).
  app.get("/api/ota-checks", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    const list = await releases();
    res.json({ github: { token: !!token(), releases: list.length, desktopFiles: desktopFilesFrom(rawList).size, lastRead: lastOk || null, lastError: lastError || null }, checks: recent });
  });

  // The update zip a phone was offered: sent on to the file itself.
  app.get("/api/ota-file/:app/:file", (_req: any, res) => {
    res.set("Cache-Control", "no-store");
    res.status(410).json({ message: LIVE_UPDATES_OFF });
  });

  // The Windows and Linux apps (and the update files the installed apps check): sent on to the file.
  app.get("/download/desktop/:file", async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const name = String(req.params.file || "");
    await releases();
    const f = DESKTOP_FILE.test(name) ? desktopFilesFrom(rawList).get(name) : undefined;
    if (!f) return res.status(404).send("Not found");
    res.redirect(302, await resolve(f.id, f.url));
  });

  app.post("/api/ota/:app", async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const which = String(req.params.app);
    if (!(OTA_APPS as readonly string[]).includes(which)) return res.status(404).json({ message: "Unknown app", error: "unknown_app" });
    // Never an update: the build App Review approved is the code that runs.
    recent.unshift({ at: new Date(now()).toISOString(), app: which, running: String(req.body?.version_name ?? "").slice(0, 40), build: String(req.body?.version_build ?? "").slice(0, 40), plugin: String(req.body?.plugin_version ?? "").slice(0, 20), os: String(req.body?.version_os ?? "").slice(0, 20), offered: "nothing (live updates are off)" });
    if (recent.length > 40) recent.length = 40;
    return none(res, LIVE_UPDATES_OFF);
  });
  // Channel requests (the updater may ask): there's one channel.
  app.put("/api/ota/:app", (_req, res) => res.json({ status: "ok", channel: "production" }));
  app.get("/api/ota/:app", (_req, res) => res.json({ channel: "production", status: "ok" }));
}
