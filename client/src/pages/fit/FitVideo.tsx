// Arise Fit's how-to videos (shared/fitVideos.ts): a still with a play button that turns into YouTube's
// player when tapped, and small video stills for lists. Videos only ever play here, inside the app:
// the player is sandboxed with no pop-ups and no top-level navigation, so nothing in it (YouTube's logo,
// its title, the end screen) can leave the app or open the YouTube app. The player runs through /fit-video.html on
// arisetodo.com, so it also works inside the iPhone app (see that page for why).
import { useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import { isNativeApp, nativeAppInfo } from "@/lib/nativeApp";
import { videoFor, videoPlayerUrl, videoThumb } from "@shared/fitVideos";
import { C } from "./fitUi";

/** Where the player page lives: this site, or arisetodo.com inside the iPhone app. */
const playerOrigin = () => (isNativeApp() ? nativeAppInfo().api : window.location.origin);

/** The exercise's how-to video: a still first (nothing loads from YouTube until it's tapped), then the player. */
export function VideoPlayer({ exId, label = "How-to video", className = "", testId = "fit-video" }: { exId: string; label?: string; className?: string; testId?: string }) {
  const v = videoFor(exId);
  const [playing, setPlaying] = useState(false);
  if (!v) return null;
  return <div className={className} data-testid={testId}>
    <div className="relative aspect-video w-full overflow-hidden rounded-[14px] bg-black shadow-[0_20px_40px_-20px_rgba(0,0,0,.8)] ring-1 ring-white/[.06]">
      {playing
        ? <iframe src={videoPlayerUrl(v.id, playerOrigin())} title={v.title} className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation" data-testid={`${testId}-frame`} />
        : <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 text-left" aria-label={`Play: ${v.title}`} data-testid={`${testId}-play`}>
            <img src={videoThumb(v.id, "hq")} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-[1.34] object-cover transition duration-500 group-active:scale-[1.3]" />
            <span aria-hidden className="absolute inset-0" style={{ background: "rgba(0,0,0,.18)" }} />
            <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-[0_10px_30px_rgba(255,90,31,.35)] transition group-active:scale-95" style={{ background: C.lime }}>
              <Play className="ml-1 h-7 w-7" fill="#0b0b0c" style={{ color: "#0b0b0c" }} />
            </span>
          </button>}
    </div>
    {/* The video's name under it, not on top of it. */}
    <p className="mt-2 px-0.5 text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: C.lime }}>{label}</p>
    <p className="line-clamp-2 px-0.5 text-[15px] font-semibold leading-snug" style={{ color: C.text }}>{v.title}</p>
  </div>;
}

/** A small video still with a play badge (lists, the live workout). Nothing when the exercise has no video. */
export function VideoThumb({ exId, className = "h-14 w-[88px] rounded-[8px]", badge = true }: { exId: string; className?: string; badge?: boolean }) {
  const v = videoFor(exId);
  if (!v) return null;
  return <span className={`relative block shrink-0 overflow-hidden bg-black ${className}`} aria-hidden>
    <img src={videoThumb(v.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
    {badge && <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full" style={{ background: "rgba(11,11,16,.75)" }}><Play className="ml-[1px] h-2.5 w-2.5" fill={C.lime} style={{ color: C.lime }} /></span>}
  </span>;
}

/** A card with a video still as a picture across its top and the words below it on the card, never on
 *  top of the picture (YouTube stills have their own big words, and the two fought each other). */
export function CoverCard({ exId, children, onClick, className = "", testId, tall, style }: { exId?: string; children: ReactNode; onClick?: () => void; className?: string; testId?: string; tall?: boolean; style?: React.CSSProperties }) {
  const v = exId ? videoFor(exId) : undefined;
  const h = tall ? 150 : 96;
  const inner = <>
    <span aria-hidden className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: h }}>
      {v ? <img src={videoThumb(v.id, "hq")} alt="" loading="lazy" className="h-full w-full scale-[1.34] object-cover" />
        : <span className="block h-full w-full" style={{ background: "linear-gradient(150deg, #ff5a1f 0%, #b8360a 55%, #5a2410 100%)" }} />}
      {/* Fades the bottom of the picture into the card. */}
      <span className="absolute inset-x-0 bottom-0 h-8" style={{ background: `linear-gradient(180deg, transparent, ${C.card})` }} />
    </span>
    <span aria-hidden className="block" style={{ height: h - 8 }} />
    <span className="relative flex flex-col">{children}</span>
  </>;
  const cls = `relative block overflow-hidden rounded-[14px] p-4 text-left ring-1 ring-white/[.07] ${onClick ? "w-full transition active:scale-[.98]" : ""} ${className.replace(/!?min-h-\[[^\]]+\]/g, "")}`;
  return onClick
    ? <button type="button" onClick={onClick} className={cls} style={{ background: C.card, ...style }} data-testid={testId}>{inner}</button>
    : <div className={cls} style={{ background: C.card, ...style }} data-testid={testId}>{inner}</div>;
}
