// After an update, a page that was already open still asks for the code files of the version it started with.
// Those files have a fingerprint in their name (Home-Ab12Cd.js), so each update makes new names and, without
// this, the old ones are gone and the open page crashes ("Something went wrong").
//
// So each build lists its files in /assets/asset-list.json with the day each was first built, and the next
// build (which runs while the old version is still live) downloads the files the live site still lists and
// keeps them for KEEP_DAYS. A missing network never fails the build: it only means fewer old files kept.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const KEEP_DAYS = 4;
export const LIST = "asset-list.json";
export type AssetList = { builtAt: string; files: Record<string, string> };

/** Which old files to keep: listed by the live site, not in this build, safe names, and newer than KEEP_DAYS. */
export function oldFilesToKeep(live: AssetList | null, mine: string[], now: Date, keepDays = KEEP_DAYS): Record<string, string> {
  const out: Record<string, string> = {};
  if (!live || typeof live.files !== "object" || !live.files) return out;
  const have = new Set(mine);
  const cutoff = now.getTime() - keepDays * 86_400_000;
  for (const [name, firstSeen] of Object.entries(live.files)) {
    if (have.has(name) || !/^[\w.-]{1,160}\.(js|css|mjs|woff2?|wasm)$/.test(name) || name === LIST) continue;
    const t = Date.parse(String(firstSeen));
    if (Number.isFinite(t) && t >= cutoff) out[name] = new Date(t).toISOString();
  }
  return out;
}

/** The list this build writes: its own files (first seen now, or when the live site first had them) plus the kept ones. */
export function nextList(live: AssetList | null, mine: string[], kept: Record<string, string>, now: Date): AssetList {
  const files: Record<string, string> = { ...kept };
  for (const name of mine) files[name] = (live?.files?.[name] && Number.isFinite(Date.parse(live.files[name]))) ? live.files[name] : now.toISOString();
  return { builtAt: now.toISOString(), files };
}

export async function keepOldAssets(assetsDir: string, sites = [process.env.RENDER_EXTERNAL_URL, "https://arisetodo.com", "https://arisereader.onrender.com"]): Promise<void> {
  const now = new Date();
  const mine = (await readdir(assetsDir)).filter((f) => f !== LIST);
  let live: AssetList | null = null, from = "";
  for (const site of sites.filter(Boolean) as string[]) {
    try {
      const r = await fetch(`${site.replace(/\/$/, "")}/assets/${LIST}`, { signal: AbortSignal.timeout(15_000) });
      if (r.ok) { live = await r.json(); from = site.replace(/\/$/, ""); break; }
    } catch { /* try the next address */ }
  }
  const want = oldFilesToKeep(live, mine, now);
  const kept: Record<string, string> = {};
  let bytes = 0;
  for (const [name, firstSeen] of Object.entries(want)) {
    if (bytes > 250 * 1024 * 1024) break; // never let old files crowd out the build
    try {
      const r = await fetch(`${from}/assets/${name}`, { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      bytes += buf.length;
      await writeFile(path.join(assetsDir, name), buf);
      kept[name] = firstSeen;
    } catch { /* skip that one */ }
  }
  await mkdir(assetsDir, { recursive: true });
  await writeFile(path.join(assetsDir, LIST), JSON.stringify(nextList(live, mine, kept, now)));
  console.log(`[keep-old-assets] ${live ? `kept ${Object.keys(kept).length} of ${Object.keys(want).length} files from the live site (${Math.round(bytes / 1024)} KB)` : "no live list yet; starting one"}`);
}

if (process.argv[1] && /keepOldAssets\.ts$/.test(process.argv[1])) {
  void keepOldAssets(path.resolve(process.argv[2] || "dist/public/assets")).catch((e) => console.log("[keep-old-assets] skipped:", e?.message || e));
}
