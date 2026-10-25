// Ads seen before, recognised anywhere (Earshot + Podscroll).
//
// Hosts stitch the same ad file into many episodes and many shows, byte for byte. Once an ad has been
// found exactly in one copy (by comparing copies or from its seams), a sample of its frame keys is kept
// here. Every new copy is checked against them as it downloads: a known ad is found, start to end, the
// moment its frames arrive, with no other copy, transcript or AI. The library is kept in the database,
// so it grows with every listener.
import { keyAt } from "../shared/earshotAudio";
import type { KV } from "./podcastDirectory";

type ScanLike = { count: number; time: number; hashes: Uint32Array; timeOf(i: number): number; frameAt(t: number): number };
type Entry = { id: string; len: number; keys: [number, number][]; seen: number; at: number; label?: string };
export type KnownAd = { s: number; e: number; id: string; seen: number };

const KV_KEY = "adlib:v1";
const MAX_ADS = 1500;
/** A key every second of an ad (about 1 KB an ad in the database). */
const KEY_EVERY = 1;

/** Eight frames that are all alike (silence, a held tone) sound the same in every file: never used as a key. */
function plainKey(h: Uint32Array, i: number) {
  let same = 0;
  for (let k = 1; k < 8; k++) if (h[i + k] === h[i + k - 1]) same++;
  return same >= 2;
}

export function createAdLibrary(kv?: KV, o: { saveEveryMs?: number } = {}) {
  const entries = new Map<string, Entry>();
  const byKey = new Map<number, { id: string; off: number }>();
  let loaded: Promise<void> | null = null;
  let dirty = false;

  function index(e: Entry) { for (const [off, k] of e.keys) byKey.set(k, { id: e.id, off }); }
  function load() {
    loaded ??= (async () => {
      try {
        const v = (await kv?.get(KV_KEY))?.value as { ads?: Entry[] } | undefined;
        for (const e of v?.ads ?? []) if (e?.id && Array.isArray(e.keys)) { entries.set(e.id, e); index(e); }
      } catch (err: any) { console.warn("[earshot] ad library load:", err?.message || err); }
    })();
    return loaded;
  }
  async function save() {
    if (!dirty || !kv) return;
    dirty = false;
    try { await kv.set(KV_KEY, { ads: Array.from(entries.values()) }); }
    catch (err: any) { dirty = true; console.warn("[earshot] ad library save:", err?.message || err); }
  }
  const timer = setInterval(() => { void save(); }, o.saveEveryMs ?? 60_000);
  (timer as any).unref?.();

  /** Keeps exact ads found in a copy (each 6 s to 3 min). Returns how many were new. */
  function learn(sc: ScanLike, ads: { s: number; e: number; label?: string }[]): number {
    if (!loaded) void load();
    let added = 0;
    const per = sc.count ? sc.time / sc.count : 0.026;
    const step = Math.max(4, Math.round(KEY_EVERY / per));
    for (const a of ads) {
      const len = a.e - a.s;
      if (len < 6 || len > 180) continue;
      const f0 = sc.frameAt(a.s), f1 = sc.frameAt(a.e);
      const keys: [number, number][] = [];
      let known = 0, tried = 0;
      for (let i = f0 + 2; i + 8 <= f1 - 2; i += step) {
        if (plainKey(sc.hashes, i)) continue;
        const k = keyAt(sc.hashes, i);
        tried++; if (byKey.has(k)) known++;
        keys.push([Math.round((sc.timeOf(i) - a.s) * 1000) / 1000, k]);
      }
      // Already in the library (most of its keys are known), or too plain to recognise.
      if (keys.length < 6 || known > tried * 0.5) continue;
      const id = `${keys[0][1].toString(36)}-${Math.round(len)}`;
      const e: Entry = { id, len: Math.round(len * 100) / 100, keys, seen: 1, at: Date.now(), label: a.label };
      entries.set(id, e); index(e); added++; dirty = true;
    }
    // Over the limit: the ads seen least (then longest ago) go.
    if (entries.size > MAX_ADS) {
      const drop = Array.from(entries.values()).sort((x, y) => x.seen - y.seen || x.at - y.at).slice(0, entries.size - MAX_ADS);
      for (const d of drop) { entries.delete(d.id); for (const [, k] of d.keys) if (byKey.get(k)?.id === d.id) byKey.delete(k); }
    }
    return added;
  }

  /** Known ads in a copy (so far): where each starts and ends in it. */
  function match(sc: ScanLike): KnownAd[] {
    if (!loaded) void load();
    if (!byKey.size || sc.count < 8) return [];
    // Each hit says where its ad would start in this copy.
    const hits = new Map<string, number[]>();
    for (let i = 0; i + 8 <= sc.count; i++) {
      const k = keyAt(sc.hashes, i);
      const h = byKey.get(k);
      if (!h) continue;
      if (plainKey(sc.hashes, i)) continue;
      const list = hits.get(h.id) ?? [];
      list.push(sc.timeOf(i) - h.off);
      hits.set(h.id, list);
    }
    const out: KnownAd[] = [];
    hits.forEach((starts, id) => {
      const e = entries.get(id); if (!e) return;
      starts.sort((a, b) => a - b);
      // Hits that agree (within a second) on where the ad starts; the ad may play more than once.
      for (let k = 0; k < starts.length;) {
        let j = k; while (j + 1 < starts.length && starts[j + 1] - starts[k] < 1) j++;
        const n = j - k + 1;
        if (n >= Math.min(4, Math.ceil(e.keys.length * 0.25))) {
          const s = Math.max(0, starts[Math.floor((k + j) / 2)]);
          out.push({ s: Math.round(s * 100) / 100, e: Math.round(Math.min(sc.time, s + e.len) * 100) / 100, id, seen: e.seen });
        }
        k = j + 1;
      }
    });
    return out.sort((a, b) => a.s - b.s);
  }
  /** Notes that a known ad turned up in another episode (kept ads are the ones seen most). */
  function sawAgain(ids: string[]) { for (const id of ids) { const e = entries.get(id); if (e) { e.seen++; e.at = Date.now(); dirty = true; } } }

  return { learn, match, sawAgain, load, save, size: () => entries.size, stop: () => clearInterval(timer) };
}
export type AdLibrary = ReturnType<typeof createAdLibrary>;
