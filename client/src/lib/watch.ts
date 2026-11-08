// Apple Watch apps for Arise Duo, Arise Fit and Arise Notes. The iPhone app hands its watch app one small
// JSON object with what to show (native/arise-watch sends it on); what's done on the watch comes back as
// actions for the app to apply like any other change. Outside an iPhone app with the plugin, nothing.
import { hasNativePlugin, isNativeApp, nativeCall, nativeListen } from "@/lib/nativeApp";

const PLUGIN = /arise.?watch/i;
const NAME = "AriseWatch";
export type WatchAction = { type: string; at: number; [field: string]: unknown };

let last = "";
let timer: ReturnType<typeof setTimeout> | null = null;

/** What the watch shows. Sent a moment after the last change, and only when it's different. */
export function publishWatch(payload: Record<string, unknown>): void {
  if (!isNativeApp() || !hasNativePlugin(PLUGIN)) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const json = JSON.stringify(payload);
    if (json === last) return;
    last = json;
    void nativeCall(PLUGIN, NAME, "publish", { payload }).catch(() => { last = ""; });
  }, 1200);
}

async function take(): Promise<WatchAction[]> {
  try {
    const r = await nativeCall(PLUGIN, NAME, "takeActions");
    return Array.isArray(r?.actions) ? r.actions.filter((a: any) => a && typeof a.type === "string").map((a: any) => ({ ...a, at: Number(a.at) || Date.now() })) : [];
  } catch { return []; }
}

/** Calls `handle` with what was done on the watch: right away while the app is open, and on coming back. */
export function watchActions(handle: (actions: WatchAction[]) => void): () => void {
  if (!isNativeApp() || !hasNativePlugin(PLUGIN)) return () => {};
  let live = true;
  const run = () => { void take().then((a) => { if (live && a.length) handle(a); }); };
  run();
  const visible = () => { if (document.visibilityState === "visible") run(); };
  document.addEventListener("visibilitychange", visible);
  // The listener can't be taken off again; once this page stops listening it just does nothing.
  void nativeListen(NAME, "watchAction", () => { if (live) run(); });
  return () => { live = false; document.removeEventListener("visibilitychange", visible); };
}
