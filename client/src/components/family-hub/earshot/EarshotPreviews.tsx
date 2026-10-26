// Explore → Previews: swipe up through a taste of shows in your genres. No AI picks a moment: each
// show plays its own trailer when it has one, else a season opener or first episode, else its newest
// episode from the top, after the ads stitched in before the show starts (found the same way the
// player skips them). The start of an episode is where a show says what it's about.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Headphones, Loader2, Pause, Play, Volume2 } from "lucide-react";
import { clock, hiRes, previewEpisode, previewKind as kindOf, type PodEpisode, type PodShow, type PoolShow, type PreviewKind } from "@shared/earshot";

export type PreviewPick = { show: PodShow; ep: PodEpisode };
/** Where a preview's audio comes from: through the server when it can (so pre-roll ads are found in
 *  this very copy), and when the show itself starts in it (after the pre-roll), or 0. */
export type PreviewSource = (ep: PodEpisode) => { src: string; showStart: () => Promise<number> };
/** Up to 40 shows, one episode each, mixed across genres so a swipe doesn't stay in one. */
export function previewPicks(pools: Map<string, PoolShow[]>): PreviewPick[] {
  const lanes = [...pools.values()].map((list) => list.flatMap((p) => { const ep = previewEpisode(p.episodes); return ep ? [{ show: p.show, ep }] : []; }));
  const out: PreviewPick[] = [], seen = new Set<string>();
  for (let i = 0; out.length < 40 && lanes.some((l) => l.length > i); i++) for (const l of lanes) { const x = l[i]; if (x && !seen.has(x.show.id)) { seen.add(x.show.id); out.push(x); } }
  // A steady shuffle per day: new order tomorrow, the same if you come back today.
  const day = Math.floor(Date.now() / 864e5);
  return out.map((x, i) => [((i + 1) * 2654435761 + day * 40503) % 4294967296, x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
}

export function PreviewCard({ picks, onOpen }: { picks: PreviewPick[]; onOpen: () => void }) {
  const arts = picks.slice(0, 3).map((p) => p.ep.art || p.show.art);
  return <button type="button" onClick={onOpen} className="relative mt-5 flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#ff8a3d]/30 via-[#e83e8c]/20 to-[#5b3cc4]/25 p-4 text-left ring-1 ring-white/10">
    <span className="relative h-[84px] w-[72px] flex-none">{arts.map((a, i) => <img key={i} src={hiRes(a, 200)} alt="" referrerPolicy="no-referrer" className="absolute h-14 w-14 rounded-xl object-cover shadow-lg ring-1 ring-black/30" style={{ left: i * 8, top: i * 14, zIndex: 3 - i, transform: `rotate(${(i - 1) * 6}deg)` }} />)}</span>
    <span className="min-w-0 flex-1"><b className="block text-lg leading-tight">Swipe previews</b><span className="mt-0.5 block text-sm leading-snug text-white/65">Trailers and openers from shows you might love. Swipe up for the next one.</span></span>
    <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white text-[#111013]"><Play size={18} fill="currentColor" strokeWidth={0} className="ml-0.5" /></span>
  </button>;
}

/** How long a preview of a full episode runs before it loops (a trailer plays whole). */
const TASTE = 90;
const LABEL: Record<PreviewKind, string> = { trailer: "Official trailer", opener: "Season opener", top: "From the top · ads skipped" };

export function Previews({ picks: given, source, episodes, onClose, onPlay, onShow, onHush }: {
  picks: PreviewPick[]; source: PreviewSource; episodes?: (showId: string) => Promise<PodEpisode[]>;
  onClose: () => void; onPlay: (show: PodShow, ep: PodEpisode, at?: number) => void; onShow: (s: PodShow) => void; onHush: () => void;
}) {
  const [picks, setPicks] = useState(given);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [t, setT] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const asked = useRef(new Set<string>());
  const audio = useMemo(() => { const a = new Audio(); a.preload = "auto"; return a; }, []);
  // The pool only holds a show's newest few episodes: look through all of them for its trailer or opener.
  useEffect(() => {
    if (!episodes) return;
    for (const p of picks.slice(active, active + 3)) {
      if (asked.current.has(p.show.id)) continue;
      asked.current.add(p.show.id);
      episodes(p.show.id).then((list) => {
        const best = previewEpisode(list);
        if (best && best.id !== p.ep.id && kindOf(best) !== "top" && kindOf(p.ep) === "top") setPicks((all) => all.map((x) => (x.show.id === p.show.id ? { ...x, ep: best } : x)));
      }).catch(() => {});
    }
  }, [active, picks, episodes]);
  const cur = picks[active];
  const kind = cur ? kindOf(cur.ep) : "top";
  // Play the one on screen: a trailer from its start, else from where the show starts, on a loop.
  useEffect(() => {
    if (!cur) { audio.pause(); return; }
    onHush();
    let live = true;
    setReady(false); setT(0);
    const { src, showStart } = source(cur.ep);
    audio.src = src;
    let from = 0, to = 0;
    const begin = () => {
      const D = Number.isFinite(audio.duration) ? audio.duration : cur.ep.secs;
      to = kind === "trailer" ? Math.min(D || 180, 180) : Math.min(D || from + TASTE, from + TASTE);
      try { if (from > 0) audio.currentTime = from; } catch { /* the host doesn't allow seeking */ }
      setReady(true);
      void audio.play().then(() => setBlocked(false), () => setBlocked(true));
    };
    // A trailer needs no ad check; anything else waits (briefly) to learn where the show begins.
    const start = kind === "trailer" ? Promise.resolve(0) : showStart();
    const meta = new Promise<void>((r) => { if (audio.readyState >= 1) r(); else audio.addEventListener("loadedmetadata", () => r(), { once: true }); });
    void Promise.all([start, meta]).then(([s]) => { if (live) { from = s; begin(); } });
    const tick = () => { const len = to - from; setT(len > 0 ? Math.max(0, Math.min(1, (audio.currentTime - from) / len)) : 0); if (to && audio.currentTime >= to) { audio.currentTime = from; } };
    const loop = () => { audio.currentTime = from; void audio.play().catch(() => {}); };
    const on = () => setPlaying(true), off = () => setPlaying(false);
    audio.addEventListener("timeupdate", tick); audio.addEventListener("ended", loop); audio.addEventListener("play", on); audio.addEventListener("pause", off);
    return () => { live = false; audio.removeEventListener("timeupdate", tick); audio.removeEventListener("ended", loop); audio.removeEventListener("play", on); audio.removeEventListener("pause", off); };
  }, [cur?.ep.id, audio]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { audio.pause(); audio.removeAttribute("src"); audio.load(); }, [audio]);
  const box = useRef<HTMLDivElement | null>(null);
  const toggle = () => { if (audio.paused) void audio.play().then(() => setBlocked(false), () => {}); else audio.pause(); };
  const full = (p: PreviewPick, at: number) => { audio.pause(); onPlay(p.show, p.ep, at); };

  return <div className="absolute inset-0 z-40 bg-black text-white">
    <div ref={box} onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight)); if (i !== active) setActive(i); }}
      className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none]">
      {picks.map((p, i) => {
        const on = i === active, art = p.ep.art || p.show.art, k = kindOf(p.ep);
        return <section key={p.show.id} className="relative h-full snap-start overflow-hidden [scroll-snap-stop:always]" aria-label={`Preview of ${p.show.name}`}>
          <div aria-hidden className="absolute -inset-[20%] bg-cover bg-center opacity-70 blur-3xl" style={{ backgroundImage: Math.abs(i - active) < 3 ? `url("${hiRes(art, 300)}")` : undefined }} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/90" />
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="absolute inset-0 z-[1]" />
          <div className="pointer-events-none relative z-[2] flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top,0px)+4.5rem)]">
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
              {Math.abs(i - active) < 3 && <img src={hiRes(art, 600)} alt="" referrerPolicy="no-referrer" className={`aspect-square w-[min(62vw,280px,38svh)] rounded-2xl object-cover shadow-[0_30px_80px_rgba(0,0,0,.6)] transition-transform duration-700 ${on && playing ? "scale-100" : "scale-[.92]"}`} />}
              <p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-white/60">{LABEL[k]}</p>
              {p.ep.about && <p className="mt-3 line-clamp-4 max-w-md text-[15px] leading-relaxed text-white/80">{p.ep.about.replace(/<[^>]+>/g, " ")}</p>}
              {on && !ready && <p className="mt-4 flex items-center gap-2 text-sm text-white/60"><Loader2 size={16} className="animate-spin" />{k === "trailer" ? "Loading the trailer…" : "Skipping to where the show starts…"}</p>}
              {on && ready && blocked && <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur"><Volume2 size={15} />Tap to listen</span>}
            </div>
            <div>
              <button type="button" onClick={() => onShow(p.show)} className="pointer-events-auto block max-w-full text-left"><b className="line-clamp-1 text-lg">{p.show.name}</b><span className="line-clamp-2 text-sm text-white/65">{p.ep.title}</span></button>
              <div className="mt-3 flex items-center gap-2 text-[11px] tabular-nums text-white/55">
                <span className="grid h-6 w-6 place-items-center">{on && playing ? <Pause size={14} fill="currentColor" strokeWidth={0} /> : <Play size={14} fill="currentColor" strokeWidth={0} />}</span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/20"><span className="block h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${on ? t * 100 : 0}%` }} /></span>
                {on && <span>{clock(audio.currentTime || 0)}</span>}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => full(p, on ? audio.currentTime : 0)} className="pointer-events-auto flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white font-semibold text-[#111013]"><Headphones size={18} />Keep listening</button>
                <button type="button" onClick={() => onShow(p.show)} className="pointer-events-auto min-h-12 rounded-full bg-white/15 px-5 text-sm font-semibold backdrop-blur">Episodes</button>
              </div>
            </div>
          </div>
        </section>;
      })}
    </div>
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
      <button type="button" onClick={() => { audio.pause(); onClose(); }} aria-label="Back to Explore" className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/40 backdrop-blur"><ChevronLeft size={22} /></button>
      <b className="text-base">Previews</b>
      <span className="ml-auto mr-1 text-xs tabular-nums text-white/50">{active + 1} / {picks.length}</span>
    </div>
  </div>;
}
