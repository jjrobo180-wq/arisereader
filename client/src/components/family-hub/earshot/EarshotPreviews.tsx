// Explore → Previews: swipe up through the best 45 seconds or so of episodes from shows in your genres.
// The server picks each moment from what's said (server/podcastDirectory.ts moment()) and keeps the
// cut audio, so a preview starts instantly for everyone after the first listener.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Headphones, Loader2, Pause, Play, Quote, Volume2 } from "lucide-react";
import { clock, hiRes, type PodEpisode, type PodShow, type PoolShow } from "@shared/earshot";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
type Moment = { s: number; e: number; quote: string; hook: string; best: boolean; audio?: string };
export type PreviewPick = { show: PodShow; ep: PodEpisode };
type Got = { m?: Moment; err?: boolean };

/** Up to 40 episodes, one per show, mixed across genres so a swipe doesn't stay in one. */
export function previewPicks(pools: Map<string, PoolShow[]>): PreviewPick[] {
  const lanes = [...pools.values()].map((list) => list.flatMap((p) => { const ep = p.episodes.find((e) => e.secs >= 600 && e.audio) ?? null; return ep ? [{ show: p.show, ep }] : []; }));
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
    <span className="min-w-0 flex-1"><b className="block text-lg leading-tight">Swipe previews</b><span className="mt-0.5 block text-sm leading-snug text-white/65">The best moment of each episode. Swipe up for the next one.</span></span>
    <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white text-[#111013]"><Play size={18} fill="currentColor" strokeWidth={0} className="ml-0.5" /></span>
  </button>;
}

export function Previews({ api, picks, onClose, onPlay, onShow, onHush }: { api: Api; picks: PreviewPick[]; onClose: () => void; onPlay: (show: PodShow, ep: PodEpisode, at?: number) => void; onShow: (s: PodShow) => void; onHush: () => void }) {
  const [active, setActive] = useState(0);
  const [got, setGot] = useState<Record<string, Got>>({});
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const asked = useRef(new Set<string>());
  const audio = useMemo(() => { const a = new Audio(); a.preload = "auto"; return a; }, []);
  // Ask for this one and the next two; failures just get skipped past.
  useEffect(() => {
    for (const p of picks.slice(active, active + 3)) {
      if (asked.current.has(p.ep.id)) continue;
      asked.current.add(p.ep.id);
      api(`/api/earshot/moment/${encodeURIComponent(p.ep.id)}?show=${encodeURIComponent(p.ep.showId || p.show.id)}`)
        .then((m: Moment) => setGot((g) => ({ ...g, [p.ep.id]: { m } })))
        .catch(() => setGot((g) => ({ ...g, [p.ep.id]: { err: true } })));
    }
  }, [active, picks, api]);
  const cur = picks[active], m = cur ? got[cur.ep.id]?.m : undefined;
  // Play the moment that's on screen, on a loop.
  useEffect(() => {
    if (!cur || !m) { audio.pause(); return; }
    onHush();
    const own = !!m.audio;
    audio.src = own ? m.audio! : cur.ep.audio;
    const start = () => { if (!own) try { audio.currentTime = m.s; } catch { /* later */ } void audio.play().then(() => setBlocked(false), () => setBlocked(true)); };
    if (own) start(); else audio.addEventListener("loadedmetadata", start, { once: true });
    const tick = () => {
      const at = own ? audio.currentTime : audio.currentTime - m.s, len = m.e - m.s;
      setT(len > 0 ? Math.max(0, Math.min(1, at / len)) : 0);
      if (!own && audio.currentTime >= m.e) audio.currentTime = m.s;
    };
    const loop = () => { audio.currentTime = own ? 0 : m.s; void audio.play().catch(() => {}); };
    const on = () => setPlaying(true), off = () => setPlaying(false);
    audio.addEventListener("timeupdate", tick); audio.addEventListener("ended", loop); audio.addEventListener("play", on); audio.addEventListener("pause", off);
    return () => { audio.removeEventListener("timeupdate", tick); audio.removeEventListener("ended", loop); audio.removeEventListener("play", on); audio.removeEventListener("pause", off); audio.removeEventListener("loadedmetadata", start); };
  }, [cur?.ep.id, m, audio]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { audio.pause(); audio.src = ""; }, [audio]);
  const box = useRef<HTMLDivElement | null>(null);
  // An episode with no preview: move on by itself.
  useEffect(() => { if (cur && got[cur.ep.id]?.err && active < picks.length - 1) { const el = box.current; const t = setTimeout(() => el?.scrollTo({ top: (active + 1) * el.clientHeight, behavior: "smooth" }), 700); return () => clearTimeout(t); } }, [cur, got, active, picks.length]);
  const toggle = () => { if (audio.paused) void audio.play().then(() => setBlocked(false), () => {}); else audio.pause(); };
  const full = (p: PreviewPick, at: number) => { audio.pause(); onPlay(p.show, p.ep, at); };

  return <div className="absolute inset-0 z-40 bg-black">
    <div ref={box} onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight)); if (i !== active) { setActive(i); setT(0); } }}
      className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none]">
      {picks.map((p, i) => {
        const g = got[p.ep.id], mm = g?.m, on = i === active, art = p.ep.art || p.show.art;
        return <section key={p.ep.id} className="relative h-full snap-start overflow-hidden [scroll-snap-stop:always]" aria-label={`Preview of ${p.ep.title}`}>
          <div aria-hidden className="absolute -inset-[20%] bg-cover bg-center opacity-70 blur-3xl" style={{ backgroundImage: Math.abs(i - active) < 3 ? `url("${hiRes(art, 300)}")` : undefined }} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/90" />
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="absolute inset-0 z-[1]" />
          <div className="pointer-events-none relative z-[2] flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top,0px)+4.5rem)]">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              {Math.abs(i - active) < 3 && <img src={hiRes(art, 600)} alt="" referrerPolicy="no-referrer" className={`aspect-square w-[min(62vw,280px)] rounded-2xl object-cover shadow-[0_30px_80px_rgba(0,0,0,.6)] transition-transform duration-700 ${on && playing ? "scale-100" : "scale-[.92]"}`} />}
              {mm?.hook && <p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-white/60">{mm.hook}</p>}
              {mm ? <p className="mt-3 line-clamp-5 max-w-md font-serif text-[clamp(1.25rem,5.4vw,1.75rem)] font-semibold leading-snug"><Quote size={18} className="mr-1 inline -translate-y-1 text-white/40" />{mm.quote || p.ep.title}</p>
                : g?.err ? <p className="mt-6 text-sm text-white/55">No preview for this one. Next…</p>
                  : <p className="mt-6 flex items-center gap-2 text-sm text-white/60"><Loader2 size={16} className="animate-spin" />Finding the best moment…</p>}
              {on && mm && blocked && <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur"><Volume2 size={15} />Tap to listen</span>}
            </div>
            <div className="pr-0">
              <button type="button" onClick={() => onShow(p.show)} className="pointer-events-auto block max-w-full text-left"><b className="line-clamp-1 text-lg">{p.show.name}</b><span className="line-clamp-2 text-sm text-white/65">{p.ep.title}</span></button>
              <div className="mt-3 flex items-center gap-2 text-[11px] tabular-nums text-white/55">
                <span className="grid h-6 w-6 place-items-center">{on && playing ? <Pause size={14} fill="currentColor" strokeWidth={0} /> : <Play size={14} fill="currentColor" strokeWidth={0} />}</span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/20"><span className="block h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${on ? t * 100 : 0}%` }} /></span>
                {mm && <span>{clock(mm.s)}</span>}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={!mm} onClick={() => full(p, mm?.s ?? 0)} className="pointer-events-auto flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white font-semibold text-[#111013] disabled:opacity-50"><Headphones size={18} />Keep listening</button>
                <button type="button" onClick={() => full(p, 0)} className="pointer-events-auto min-h-12 rounded-full bg-white/15 px-5 text-sm font-semibold backdrop-blur">From the start</button>
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
