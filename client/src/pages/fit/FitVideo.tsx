// Arise Fit's how-to videos (shared/fitVideos.ts): a still with a play button that turns into YouTube's
// player when tapped, and small video stills for lists. The player runs through /fit-video.html on
// arisetodo.com, so it also works inside the iPhone app (see that page for why).
import { useState, type ReactNode } from "react";
import { ExternalLink, Play } from "lucide-react";
import { isNativeApp, nativeAppInfo } from "@/lib/nativeApp";
import { videoFor, videoPlayerUrl, videoThumb, videoWatchUrl } from "@shared/fitVideos";
import { C } from "./fitUi";

/** Where the player page lives: this site, or arisetodo.com inside the iPhone app. */
const playerOrigin = () => (isNativeApp() ? nativeAppInfo().api : window.location.origin);

export const openOnYouTube = (id: string) => { window.open(videoWatchUrl(id), "_blank", "noopener"); };

/** The exercise's how-to video: a still first (nothing loads from YouTube until it's tapped), then the player. */
export function VideoPlayer({ exId, label = "How-to video", className = "", testId = "fit-video" }: { exId: string; label?: string; className?: string; testId?: string }) {
  const v = videoFor(exId);
  const [playing, setPlaying] = useState(false);
  if (!v) return null;
  return <div className={className} data-testid={testId}>
    <div className="relative aspect-video w-full overflow-hidden rounded-[20px] bg-black shadow-[0_20px_40px_-20px_rgba(0,0,0,.8)] ring-1 ring-white/[.06]">
      {playing
        ? <iframe src={videoPlayerUrl(v.id, playerOrigin())} title={v.title} className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" data-testid={`${testId}-frame`} />
        : <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 text-left" aria-label={`Play: ${v.title}`} data-testid={`${testId}-play`}>
            <img src={videoThumb(v.id, "hq")} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-[1.34] object-cover transition duration-500 group-active:scale-[1.3]" />
            <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(11,11,16,.05) 30%, rgba(11,11,16,.88) 100%)" }} />
            <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.12em] backdrop-blur" style={{ background: "rgba(11,11,16,.6)", color: C.lime }}>{label}</span>
            <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-[0_10px_30px_rgba(196,245,58,.35)] transition group-active:scale-95" style={{ background: C.lime }}>
              <Play className="ml-1 h-7 w-7" fill="#10120a" style={{ color: "#10120a" }} />
            </span>
            <span className="absolute inset-x-3 bottom-3 line-clamp-2 text-[15px] font-semibold leading-snug text-white">{v.title}</span>
          </button>}
    </div>
    <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[12px]" style={{ color: C.dim }}>
      <span className="min-w-0 truncate">Video from YouTube</span>
      <button type="button" onClick={() => openOnYouTube(v.id)} className="flex shrink-0 items-center gap-1 font-semibold" style={{ color: C.text }} data-testid={`${testId}-youtube`}>Open in YouTube<ExternalLink className="h-3.5 w-3.5" /></button>
    </div>
  </div>;
}

/** A small video still with a play badge (lists, the live workout). Nothing when the exercise has no video. */
export function VideoThumb({ exId, className = "h-14 w-[88px] rounded-[12px]", badge = true }: { exId: string; className?: string; badge?: boolean }) {
  const v = videoFor(exId);
  if (!v) return null;
  return <span className={`relative block shrink-0 overflow-hidden bg-black ${className}`} aria-hidden>
    <img src={videoThumb(v.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
    {badge && <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full" style={{ background: "rgba(11,11,16,.75)" }}><Play className="ml-[1px] h-2.5 w-2.5" fill={C.lime} style={{ color: C.lime }} /></span>}
  </span>;
}

/** A card with a video still behind it, darkened so the words on it stay readable. */
export function CoverCard({ exId, children, onClick, className = "", testId, tall }: { exId?: string; children: ReactNode; onClick?: () => void; className?: string; testId?: string; tall?: boolean }) {
  const v = exId ? videoFor(exId) : undefined;
  const inner = <>
    {v && <img src={videoThumb(v.id, "hq")} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-[1.34] object-cover" />}
    <span aria-hidden className="absolute inset-0" style={{ background: v ? "linear-gradient(180deg, rgba(11,11,16,.15) 0%, rgba(11,11,16,.72) 55%, rgba(11,11,16,.96) 100%)" : `linear-gradient(140deg, #24311a, ${C.card})` }} />
    <span className="relative flex h-full flex-col justify-end">{children}</span>
  </>;
  const cls = `relative block overflow-hidden rounded-[22px] p-4 text-left ring-1 ring-white/[.06] ${tall ? "min-h-[200px]" : "min-h-[150px]"} ${onClick ? "w-full transition active:scale-[.99]" : ""} ${className}`;
  return onClick
    ? <button type="button" onClick={onClick} className={cls} style={{ background: C.card }} data-testid={testId}>{inner}</button>
    : <div className={cls} style={{ background: C.card }} data-testid={testId}>{inner}</div>;
}
