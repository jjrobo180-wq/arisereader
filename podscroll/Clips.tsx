// Pod+ Clips (test page, #/clips, not in the menu yet): hand-picked TikTok videos in a swipe row
// that play inside Pod+ through TikTok's official embed player (developers.tiktok.com/docs/en/embed-player).
// Nothing opens TikTok. The clip in view plays; the rest pause. The list of links is kept on this
// device while it's being tried out.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Volume2, VolumeX } from "lucide-react";

const KEY = "podscroll.clips";
/** The video id from a TikTok link ("…/video/7123…") or a bare id. */
export const clipId = (s: string) => (/\/video\/(\d{8,25})/.exec(s)?.[1] || (/^\d{8,25}$/.test(s.trim()) ? s.trim() : ""));
const readLinks = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
// TikTok's own example video, so the page has something to show before any links are added.
const SAMPLE = "https://www.tiktok.com/@scout2015/video/6718335390845095173";

const send = (f: HTMLIFrameElement | null, type: string, value?: unknown) => {
  try { f?.contentWindow?.postMessage({ "x-tiktok-player": true, type, ...(value !== undefined ? { value } : {}) }, "https://www.tiktok.com"); } catch { /* player not ready */ }
};

export function ClipsTest({ onBack }: { onBack: () => void }) {
  const [links, setLinks] = useState(() => readLinks() || SAMPLE);
  const [editing, setEditing] = useState(false);
  const [sound, setSound] = useState(false);
  const [active, setActive] = useState(0);
  const ids = [...new Set(links.split(/\s+/).map(clipId).filter(Boolean))].slice(0, 50);
  const frames = useRef<(HTMLIFrameElement | null)[]>([]);
  const slides = useRef<(HTMLDivElement | null)[]>([]);

  // The clip that's mostly in view is the one playing.
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number((e.target as HTMLElement).dataset.i));
    }, { threshold: [0.6] });
    slides.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    frames.current.forEach((f, i) => { if (i === active) { send(f, "play"); send(f, sound ? "unMute" : "mute"); } else send(f, "pause"); });
  }, [active, sound]);
  // When a player says it's ready, start it if it's the one in view.
  useEffect(() => {
    const on = (ev: MessageEvent) => {
      if (ev.origin !== "https://www.tiktok.com" || !ev.data?.["x-tiktok-player"]) return;
      const i = frames.current.findIndex((f) => f?.contentWindow === ev.source);
      if (ev.data.type === "onPlayerReady" && i === active) { send(frames.current[i], "play"); send(frames.current[i], sound ? "unMute" : "mute"); }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [active, sound]);

  const save = (v: string) => { setLinks(v); try { localStorage.setItem(KEY, v); } catch { /* private window */ } };

  return <section aria-label="Clips (test)" className="pt-3 pb-10">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <button onClick={onBack} className="-ml-2 inline-flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-medium hover:bg-[#f2f2f2]"><ChevronLeft size={20} />Home</button>
      <div className="flex items-center gap-2">
        <button onClick={() => setSound((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 text-sm font-semibold">{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}{sound ? "Sound on" : "Tap for sound"}</button>
        <button onClick={() => setEditing((v) => !v)} className="h-9 rounded-full bg-[#0f0f0f] px-3 text-sm font-semibold text-white">{editing ? "Done" : "Edit clips"}</button>
      </div>
    </div>
    <h1 className="text-2xl font-bold tracking-tight">Clips <span className="align-middle text-xs font-semibold uppercase tracking-wide text-[#c2410c]">Test</span></h1>
    <p className="mt-1 text-sm text-[#606060]">TikTok videos playing inside Pod+. Scroll: the clip in view plays, the rest pause. {ids.length} clip{ids.length === 1 ? "" : "s"}.</p>
    {editing && <div className="mt-3">
      <label htmlFor="ps-clip-links" className="text-sm font-semibold">TikTok links, one per line</label>
      <textarea id="ps-clip-links" value={links} onChange={(e) => save(e.target.value)} rows={6} placeholder="https://www.tiktok.com/@someone/video/7123456789012345678" className="mt-1.5 w-full rounded-xl border border-[#d3d3d3] p-3 font-mono text-xs outline-none focus:border-[#1c62b9]" />
      <p className="mt-1 text-xs text-[#767676]">Open a video on TikTok, tap Share, Copy link, and paste it here. Short links (vm.tiktok.com) need opening first to get the full one.</p>
    </div>}
    <div className="mt-4 h-[min(78dvh,760px)] snap-y snap-mandatory overflow-y-auto rounded-2xl bg-[#0f0f0f] [scrollbar-width:none]">
      {ids.length ? ids.map((id, i) => <div key={id} ref={(el) => { slides.current[i] = el; }} data-i={i} className="flex h-full snap-start snap-always items-center justify-center p-2">
        <iframe ref={(el) => { frames.current[i] = el; }} title={`Clip ${i + 1}`} loading={Math.abs(i - active) <= 1 ? "eager" : "lazy"}
          src={`https://www.tiktok.com/player/v1/${id}?autoplay=${i === 0 ? 1 : 0}&loop=1&rel=0&music_info=0&description=0&closed_caption=1&muted=0`}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen
          className="aspect-[9/16] h-full max-h-full w-auto max-w-full rounded-xl border-0 bg-black" />
      </div>)
        : <p className="p-10 text-center text-sm text-[#bdbdbd]">Tap “Edit clips” and paste some TikTok links.</p>}
    </div>
  </section>;
}
