// Pod+ smart downloads (Pod+ Membership): when shows you follow put out new episodes, Pod+ asks once
// whether to save them on this device, and takes each one off again 24 hours after you've listened to
// it. Only episodes that smart downloads saved are ever removed this way; anything you downloaded
// yourself stays until you remove it.
//
// What it keeps (this browser only): whether it's on, which episodes it has already offered, and the
// episodes it saved with when each one was first heard.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, X } from "lucide-react";
import type { PodEpisode, SavedEpisode } from "@shared/earshot";
import { episodeKey } from "../client/src/components/family-hub/earshot/offlineAudio";
import { downloads } from "./downloads";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
type Store = { off: boolean; offered: string[]; items: Record<string, { savedAt: number; heardAt?: number }> };

const KEY = "podplus.smartdl.v1";
const DAY = 86_400_000;
const MAX_SHOWS = 10;       // followed shows looked at per check
const MAX_PER_ASK = 6;      // episodes offered at once
const FRESH_DAYS = 4;       // "new" means put out in the last few days

const load = (): Store => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && typeof v === "object") return { off: !!v.off, offered: Array.isArray(v.offered) ? v.offered.slice(-400) : [], items: v.items && typeof v.items === "object" ? v.items : {} }; } catch { /* none yet */ }
  return { off: false, offered: [], items: {} };
};
const save = (s: Store) => { try { localStorage.setItem(KEY, JSON.stringify({ ...s, offered: s.offered.slice(-400) })); } catch { /* private window: works, just isn't kept */ } };

export const smartDownloadsOn = () => !load().off;
export const setSmartDownloads = (on: boolean) => { const s = load(); s.off = !on; save(s); };

const toSaved = (e: PodEpisode): SavedEpisode => ({ id: e.id, showId: e.showId, title: e.title, show: e.show, art: e.art, secs: e.secs, at: new Date().toISOString(), audio: e.audio, date: e.date });

/** Episodes of followed shows put out recently that haven't been heard, saved, or offered yet. */
async function findNew(api: Api, follows: { id: string; art: string }[], heard: string[], ex: string): Promise<PodEpisode[]> {
  const s = load();
  const skip = new Set([...s.offered, ...heard, ...Object.keys(s.items)]);
  const out: PodEpisode[] = [];
  // A few shows at a time, so a long follow list never floods the connection.
  const shows = follows.slice(0, MAX_SHOWS);
  for (let i = 0; i < shows.length && out.length < MAX_PER_ASK; i += 3) {
    const lists = await Promise.all(shows.slice(i, i + 3).map((f) => api(`/api/earshot/show/${f.id}?x=1${ex}`).then((b) => ((b.episodes || []) as PodEpisode[]).slice(0, 2).map((e) => ({ ...e, art: e.art || f.art }))).catch(() => [] as PodEpisode[])));
    for (const e of lists.flat()) {
      const age = (Date.now() - Date.parse(e.date)) / DAY;
      if (!/^https:\/\//i.test(e.audio || "") || skip.has(e.id) || !(age >= 0 && age <= FRESH_DAYS) || downloads?.state(episodeKey(e.id)).status !== "none") continue;
      skip.add(e.id); out.push(e);
    }
  }
  return out.slice(0, MAX_PER_ASK);
}

/** Starts the 24-hour clock on episodes that were heard, and removes the ones whose day is up. */
export async function sweepSmartDownloads(heard: string[]) {
  if (!downloads) return;
  const s = load(); let changed = false;
  const heardSet = new Set(heard);
  for (const [id, it] of Object.entries(s.items)) {
    if (!heardSet.has(id)) continue;
    if (!it.heardAt) { it.heardAt = Date.now(); changed = true; }
    if (Date.now() - it.heardAt >= DAY) { await downloads.remove(episodeKey(id)).catch(() => {}); delete s.items[id]; changed = true; }
  }
  // Removed by hand from the Downloads page: nothing left to track.
  for (const id of Object.keys(s.items)) if (downloads.state(episodeKey(id)).status === "none" && Date.now() - s.items[id].savedAt > 10 * 60_000) { delete s.items[id]; changed = true; }
  if (changed) save(s);
}

/** The ask, and the quiet clean-up. Mount once on the home page. */
export function SmartDownloads({ api, follows, heard, member, ex, say }: { api: Api; follows: { id: string; art: string }[]; heard: string[]; member: boolean; ex: string; say: (m: string) => void }) {
  const [ask, setAsk] = useState<PodEpisode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const checked = useRef(0);
  const followKey = follows.map((f) => f.id).join(",");
  const heardRef = useRef(heard); heardRef.current = heard;

  // Clean-up: when the page opens, whenever it comes back to the front, and every 15 minutes.
  useEffect(() => {
    const run = () => { void sweepSmartDownloads(heardRef.current); };
    run();
    const t = setInterval(run, 15 * 60_000);
    const vis = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, []);
  useEffect(() => { void sweepSmartDownloads(heard); }, [heard.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // New episodes: looked for a few seconds after opening, then at most every 3 hours while it stays open.
  useEffect(() => {
    if (!member || !follows.length || load().off) return;
    const look = () => {
      if (document.visibilityState !== "visible" || ask || Date.now() - checked.current < 3 * 3_600_000) return;
      checked.current = Date.now();
      findNew(api, follows, heardRef.current, ex).then((eps) => { if (eps.length) setAsk(eps); }).catch(() => {});
    };
    const first = setTimeout(look, 8000);
    const again = setInterval(look, 30 * 60_000);
    return () => { clearTimeout(first); clearInterval(again); };
  }, [member, followKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const remember = useCallback((eps: PodEpisode[], saved: boolean) => {
    const s = load();
    s.offered = [...s.offered, ...eps.map((e) => e.id)];
    if (saved) for (const e of eps) s.items[e.id] = { savedAt: Date.now() };
    save(s);
  }, []);
  const yes = async () => {
    if (!ask || !downloads || busy) return;
    const eps = ask; setBusy(true); remember(eps, true); setAsk(null);
    say(`Downloading ${eps.length} new episode${eps.length === 1 ? "" : "s"}. They're removed a day after you listen.`);
    for (const e of eps) await downloads.saveEpisode(toSaved(e)).catch(() => {});
    setBusy(false);
  };
  const later = () => { if (ask) remember(ask, false); setAsk(null); };
  const never = () => { setSmartDownloads(false); setAsk(null); say("Smart downloads are off. You can turn them on in Settings."); };

  if (!ask?.length) return null;
  return <div role="dialog" aria-label="Download new episodes" className="fixed inset-x-3 z-[60] mx-auto max-w-md rounded-2xl border border-[#e5e5e5] bg-white p-4 shadow-xl" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }} data-testid="smart-downloads">
    <button onClick={later} aria-label="Not now" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-[#909090] hover:bg-[#f2f2f2]"><X size={16} /></button>
    <p className="pr-8 text-[15px] font-semibold">{ask.length} new episode{ask.length === 1 ? "" : "s"} from shows you follow</p>
    <p className="mt-0.5 text-[13px] text-[#606060]">Save {ask.length === 1 ? "it" : "them"} on this device to listen without a connection. Each is removed 24 hours after you listen to it.</p>
    <ul className="mt-2 space-y-1.5">{ask.slice(0, 3).map((e) => <li key={e.id} className="flex items-center gap-2.5">
      {e.art ? <img src={e.art} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-md object-cover" /> : <span className="h-9 w-9 shrink-0 rounded-md bg-[#f2f2f2]" />}
      <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{e.title}</span><span className="block truncate text-[12px] text-[#606060]">{e.show}</span></span></li>)}
      {ask.length > 3 && <li className="text-[12px] text-[#606060]">and {ask.length - 3} more</li>}</ul>
    <div className="mt-3 flex items-center gap-2">
      <button onClick={() => void yes()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#0f0f0f] px-4 text-sm font-semibold text-white disabled:opacity-50"><ArrowDownToLine size={15} />Download</button>
      <button onClick={later} className="h-10 rounded-full bg-[#f2f2f2] px-4 text-sm font-semibold">Not now</button>
      <button onClick={never} className="ml-auto text-[12px] text-[#909090] underline">Don't ask</button>
    </div>
  </div>;
}
