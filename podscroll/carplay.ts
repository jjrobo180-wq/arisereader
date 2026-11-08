// Pod+ in the car (CarPlay, native/arise-carplay). The car's screens and player are native, so they
// work even when Pod+ is started from the car; this side keeps them in step with the phone:
//   - hands over the library (shows you follow, Listen later, Liked, Pod Modes, where you are in each
//     episode, and how to reach the server as this listener) whenever it changes
//   - takes back where you got to in the car, so Continue listening on the phone picks up there
//   - one sound at a time: the car starting pauses the phone's player, and the phone starting stops the car's
// Outside the iPhone app (or a build without CarPlay) none of this does anything.
import type { Earshot, SavedEpisode } from "@shared/earshot";
import { hasNativePlugin, isNativeApp, nativeCall, nativeListen } from "../client/src/lib/nativeApp";
import { onOtherSound, soundStarted } from "../client/src/components/family-hub/earshot/soundBus";

const PLUGIN = /arise.?carplay/i;
const NAME = "AriseCarPlay";
const SPOTS_KEY = "earshot.spots";
const SPOTS_EVENT = "earshot-spots";

export type CarSpot = { t: number; secs: number; title: string; show: string; showId: string; art: string; at: number; c?: 1; ct?: number };
type Ep = { id: string; showId: string; title: string; show: string; art: string; audio: string; secs: number; date?: string };

const ep = (e: SavedEpisode): Ep => ({ id: e.id, showId: e.showId, title: e.title, show: e.show, art: e.art, audio: e.audio || "", secs: e.secs || 0, ...(e.date ? { date: e.date } : {}) });

/** What the car is handed: small, and only what its screens use. */
export function carPlayLibrary(es: Earshot, o: { api: string; device: string; session: string; spots: Record<string, CarSpot>; now?: number }) {
  const spots = Object.entries(o.spots || {})
    .filter(([, s]) => s && Number.isFinite(s.t) && s.t > 0 && s.title)
    .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
    .slice(0, 40);
  return {
    api: o.api, device: o.device, session: o.session || "",
    speed: es.settings?.speed ?? 1, skipIntro: es.settings?.skipIntro !== false,
    genres: es.genres.slice(0, 12),
    follows: es.follows.slice(0, 100).map((f) => ({ id: f.id, name: f.name, author: f.author, art: f.art })),
    later: es.saved.slice(0, 40).map(ep),
    liked: es.liked.slice(0, 40).map(ep),
    modes: es.modes.filter((m) => m.episodes.length).slice(0, 12).map((m) => ({ id: m.id, name: m.name, episodes: m.episodes.slice(0, 40).map(ep) })),
    spots: Object.fromEntries(spots),
    at: o.now ?? Date.now(),
  };
}

/** Folds the car's spots into the phone's: the newer one wins; a spot at 0 means it was finished. */
export function mergeCarSpots(mine: Record<string, CarSpot>, car: Record<string, CarSpot>): { spots: Record<string, CarSpot>; changed: boolean } {
  const out = { ...mine };
  let changed = false;
  for (const [id, s] of Object.entries(car || {})) {
    if (!s || !Number.isFinite(s.at)) continue;
    const have = out[id];
    if (have && have.at >= s.at) continue;
    if (!(s.t > 0)) { if (have) { delete out[id]; changed = true; } continue; }
    out[id] = { t: Math.floor(s.t), secs: Math.floor(s.secs || have?.secs || 0), title: s.title || have?.title || "", show: s.show || have?.show || "", showId: s.showId || have?.showId || "", art: s.art || have?.art || "", at: s.at, ...(s.c === 1 ? { c: 1 as const } : {}) };
    changed = true;
  }
  return { spots: out, changed };
}

const readSpots = (): Record<string, CarSpot> => { try { const v = JSON.parse(localStorage.getItem(SPOTS_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };

let installed = false;

/** Starts keeping the car in step. `library()` gives what to hand over right now. */
export function installCarPlay(o: { api: string; device: () => string; session: () => string; es: () => Earshot }): { publish: () => void } {
  const none = { publish: () => {} };
  if (installed || !isNativeApp() || !hasNativePlugin(PLUGIN)) return none;
  installed = true;

  let last = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  const send = () => {
    timer = null;
    const library = carPlayLibrary(o.es(), { api: o.api, device: o.device(), session: o.session(), spots: readSpots() });
    const key = JSON.stringify({ ...library, at: 0 });
    if (key === last) return;
    last = key;
    void nativeCall(PLUGIN, NAME, "setLibrary", { library }).catch(() => { last = ""; });
  };
  const publish = () => { if (timer) clearTimeout(timer); timer = setTimeout(send, 1500); };

  // Where you got to in the car (taken when Pod+ comes back to the front, and now and then).
  const take = () => {
    void nativeCall(PLUGIN, NAME, "takeSpots").then((r: any) => {
      const car = r?.spots && typeof r.spots === "object" ? r.spots : {};
      if (!Object.keys(car).length) return;
      const { spots, changed } = mergeCarSpots(readSpots(), car);
      if (!changed) return;
      try { localStorage.setItem(SPOTS_KEY, JSON.stringify(spots)); } catch { /* not kept */ }
      try { window.dispatchEvent(new Event(SPOTS_EVENT)); } catch { /* no window */ }
      publish();
    }).catch(() => {});
  };
  take();
  setInterval(take, 60_000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") take(); });
  window.addEventListener(SPOTS_EVENT, publish);

  // One sound at a time: the car started (the phone's players pause), or the phone did (the car's stops).
  let fromCar = false;
  void nativeListen(NAME, "nativePlay", () => {
    fromCar = true; soundStarted("carplay"); fromCar = false;
    // The car's player owns Now Playing now: the paused web player stops showing (and answering) there.
    try { if ("mediaSession" in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = "none"; } } catch { /* not supported */ }
  });
  onOtherSound("carplay", () => { if (!fromCar) void nativeCall(PLUGIN, NAME, "stop").catch(() => {}); });

  publish();
  return { publish };
}

/** Signed in: the library is saved to the account too (a little while after it changes), so the Apple
 *  TV app and other devices signed in to the same Pod+ account show the same shows and spots. */
export function installLibrarySync(o: { api: (path: string, init?: { method?: string; body?: unknown }) => Promise<any>; signedIn: () => boolean; es: () => Earshot }): { changed: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = "";
  const save = () => {
    timer = null;
    if (!o.signedIn()) return;
    const { device: _d, session: _s, api: _a, ...library } = carPlayLibrary(o.es(), { api: "", device: "", session: "", spots: readSpots() });
    const key = JSON.stringify({ ...library, at: 0 });
    if (key === last) return;
    last = key;
    void o.api("/api/earshot/account/library", { method: "POST", body: { library } }).catch(() => { last = ""; });
  };
  const changed = () => { if (timer) clearTimeout(timer); timer = setTimeout(save, 20_000); };
  if (typeof window !== "undefined") {
    window.addEventListener(SPOTS_EVENT, changed);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && timer) { clearTimeout(timer); save(); } });
  }
  return { changed };
}
