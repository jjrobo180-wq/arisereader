// Apple Watch apps for Arise Duo, Cooked and Arise Notes. The iPhone app hands its watch app one small
// JSON object with what to show (native/arise-watch sends it on); what's done on the watch comes back as
// actions for the app to apply like any other change. Outside an iPhone app with the plugin, nothing.
//
// Arise Duo's watch has a Life / Work switch: LifeHub and WorkHub each send their own part with
// publishWatchPart, the other hub's last part is kept here (on this phone), and the watch gets both.
// Each hub takes only its own actions; the other hub's wait here until it opens.
import { hasNativePlugin, isNativeApp, nativeCall, nativeListen } from "@/lib/nativeApp";
import { watchPayload, actionHub, type WatchHub } from "@shared/watchDuo";

const PLUGIN = /arise.?watch/i;
const NAME = "AriseWatch";
export type WatchAction = { type: string; at: number; hub?: string; [field: string]: unknown };

let last = "";
let timer: ReturnType<typeof setTimeout> | null = null;
const PARTS = "arise-watch-parts";
const WAITING = "arise-watch-waiting";

const read = <T,>(key: string, fallback: T): T => { try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v ?? fallback; } catch { return fallback; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* not kept */ } };

const available = () => isNativeApp() && hasNativePlugin(PLUGIN);

/** What the watch shows. Sent a moment after the last change, and only when it's different. */
export function publishWatch(payload: Record<string, unknown>): void {
  if (!available()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    let json = JSON.stringify(payload);
    // Apple's limit for what the phone hands the watch is 64 KB: the longest lists are cut until it fits.
    if (json.length > 60_000) json = JSON.stringify(shrink(payload));
    if (json === last) return;
    last = json;
    void nativeCall(PLUGIN, NAME, "publish", { payload: JSON.parse(json) }).catch(() => { last = ""; });
  }, 1200);
}

/** Halves the longest lists (anywhere in the object) until it's under the limit. */
export function shrink(payload: Record<string, unknown>, limit = 60_000): Record<string, unknown> {
  let p = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  for (let round = 0; round < 12 && JSON.stringify(p).length > limit; round++) {
    let longest: { holder: Record<string, unknown>; key: string; n: number } | null = null;
    const walk = (o: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(o)) {
        if (Array.isArray(v)) { const n = JSON.stringify(v).length; if (!longest || n > longest.n) longest = { holder: o, key: k, n }; }
        else if (v && typeof v === "object") walk(v as Record<string, unknown>);
      }
    };
    walk(p);
    if (!longest) break;
    const l = longest as { holder: Record<string, unknown>; key: string };
    const arr = l.holder[l.key] as unknown[];
    l.holder[l.key] = arr.slice(0, Math.floor(arr.length / 2));
  }
  return p;
}

/** Arise Duo: one hub's part of the watch (the other hub's last part goes along with it). */
export function publishWatchPart(hub: WatchHub, part: Record<string, unknown>, today: string, name: string): void {
  if (!available()) return;
  const parts = read<Partial<Record<WatchHub, Record<string, unknown>>>>(PARTS, {});
  parts[hub] = part;
  write(PARTS, parts);
  publishWatch(watchPayload(parts, today, name));
}

async function take(): Promise<WatchAction[]> {
  try {
    const r = await nativeCall(PLUGIN, NAME, "takeActions");
    return Array.isArray(r?.actions) ? r.actions.filter((a: any) => a && typeof a.type === "string").map((a: any) => ({ ...a, at: Number(a.at) || Date.now() })) : [];
  } catch { return []; }
}

/** Calls `handle` with what was done on the watch: right away while the app is open, and on coming back.
 *  With `hub` (Arise Duo), only that hub's actions; the other hub's are kept for when it opens. */
export function watchActions(handle: (actions: WatchAction[]) => void, hub?: WatchHub): () => void {
  if (!available()) return () => {};
  let live = true;
  const run = () => {
    void take().then((got) => {
      if (!live) { if (got.length) write(WAITING, [...read<WatchAction[]>(WAITING, []), ...got].slice(-300)); return; }
      if (!hub) { if (got.length) handle(got); return; }
      const all = [...read<WatchAction[]>(WAITING, []), ...got];
      const mine = all.filter((a) => actionHub(a) === hub), others = all.filter((a) => actionHub(a) !== hub);
      write(WAITING, others.slice(-300));
      if (mine.length) handle(mine);
    });
  };
  run();
  const visible = () => { if (document.visibilityState === "visible") run(); };
  document.addEventListener("visibilitychange", visible);
  // The listener can't be taken off again; once this page stops listening it just does nothing.
  void nativeListen(NAME, "watchAction", () => { if (live) run(); });
  return () => { live = false; document.removeEventListener("visibilitychange", visible); };
}

/** A file the watch sent (a meeting recorded on Arise Notes' watch app): read straight from the phone's storage. */
export async function watchFile(path: string): Promise<Blob | null> {
  if (!available()) return null;
  try {
    const cap = (window as any).Capacitor;
    const src = typeof cap?.convertFileSrc === "function" ? cap.convertFileSrc(path.startsWith("file://") ? path : `file://${path}`) : null;
    if (!src) return null;
    const r = await fetch(src);
    return r.ok ? await r.blob() : null;
  } catch { return null; }
}
/** Deletes a file the watch sent, once it's been saved to a note. */
export function removeWatchFile(path: string): void {
  if (available()) void nativeCall(PLUGIN, NAME, "removeFile", { path }).catch(() => {});
}
