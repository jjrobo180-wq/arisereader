// Arise Fit's how-to videos (shared/fitVideos.ts): a still with a play button that turns into YouTube's
// player when tapped, and small video stills for lists. Videos only ever play here, inside the app:
// the player is sandboxed with no pop-ups and no top-level navigation, so nothing in it (YouTube's logo,
// its title, the end screen) can leave the app or open the YouTube app. The player runs through /fit-video.html on
// arisetodo.com, so it also works inside the iPhone app (see that page for why).
import { useState, type ReactNode } from "react";
import { Play, X } from "lucide-react";
import { isNativeApp, nativeAppInfo } from "@/lib/nativeApp";
import { longVideoFor, quickClipsUrl, videoFor, videoPlayerUrl, videoThumb, type FitVideo } from "@shared/fitVideos";
import { C, Layer, cardStyle, display } from "./fitUi";
import { Art, workoutArt, type ArtKind } from "./fitArt";

/** Where the player page lives: this site, or arisetodo.com inside the iPhone app. */
const playerOrigin = () => (isNativeApp() ? nativeAppInfo().api : window.location.origin);

/** One video: a still first (nothing loads from YouTube until it's tapped), then the player. Shorts are upright. */
function Clip({ v, testId, autoStart = false }: { v: FitVideo; testId: string; autoStart?: boolean }) {
  const [playing, setPlaying] = useState(autoStart);
  const frame = v.short ? "mx-auto aspect-[9/16] w-[min(100%,calc(58vh*9/16))]" : "aspect-video w-full";
  return <div className={`relative overflow-hidden rounded-[14px] bg-black shadow-[0_20px_40px_-20px_rgba(0,0,0,.8)] ring-1 ring-white/[.06] ${frame}`}>
    {playing
      ? <iframe src={videoPlayerUrl(v.id, playerOrigin())} title={v.title} className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation" data-testid={`${testId}-frame`} />
      : <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 text-left" aria-label={`Play: ${v.title}`} data-testid={`${testId}-play`}>
          <Still v={v} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-active:scale-[1.02]" />
          <span aria-hidden className="absolute inset-0" style={{ background: "rgba(0,0,0,.18)" }} />
          <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-[0_10px_30px_rgba(var(--fit-accent-rgb),.35)] transition group-active:scale-95" style={{ background: C.lime }}>
            <Play className="ml-1 h-7 w-7" style={{ color: C.ink, fill: C.ink }} />
          </span>
        </button>}
  </div>;
}

/** A video's still, as sharp as YouTube has it: a Short's upright still first, then the bigger 4:3 ones
 *  (cropped to the picture: YouTube letterboxes them). A missing still comes back as a tiny gray image. */
function Still({ v, className }: { v: FitVideo; className: string }) {
  const tries = v.short ? [`https://i.ytimg.com/vi/${v.id}/oardefault.jpg`, videoThumb(v.id, "maxres"), `https://i.ytimg.com/vi/${v.id}/sddefault.jpg`, videoThumb(v.id, "hq")] : [videoThumb(v.id, "maxres"), `https://i.ytimg.com/vi/${v.id}/sddefault.jpg`, videoThumb(v.id, "hq")];
  const [i, setI] = useState(0);
  const src = tries[Math.min(i, tries.length - 1)], upright = v.short && i === 0;
  const next = () => setI((n) => (n < tries.length - 1 ? n + 1 : n));
  return <img src={src} alt="" loading="lazy" onError={next} onLoad={(e) => { if (e.currentTarget.naturalWidth < 200) next(); }}
    className={`${className} ${upright ? "" : v.short ? "scale-[1.9]" : src.includes("maxres") ? "" : "scale-[1.34]"}`} />;
}

/** Today's form tip: a card with the still beside its name; tapping it plays the clip full screen. */
export function TipCard({ exId, testId = "fit-tip" }: { exId: string; testId?: string }) {
  const v = videoFor(exId);
  const [open, setOpen] = useState(false);
  if (!v) return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} className="fit-in flex w-full items-stretch gap-3 overflow-hidden rounded-[16px] p-2 text-left active:scale-[.99]" style={cardStyle} data-testid={testId}>
      <span className="relative block h-[132px] w-[92px] shrink-0 overflow-hidden rounded-[12px] bg-black"><Still v={v} className="absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden className="absolute inset-0 grid place-items-center" style={{ background: "linear-gradient(transparent 40%, rgba(0,0,0,.45))" }}><span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: C.lime }}><Play className="ml-0.5 h-5 w-5" style={{ color: C.ink, fill: C.ink }} /></span></span></span>
      <span className="flex min-w-0 flex-1 flex-col justify-center py-1 pr-2">
        <span className="text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: C.lime }}>{v.short ? "Under a minute" : "How-to"}</span>
        <span className="mt-1 line-clamp-3 text-[17px] leading-snug" style={display}>{v.title}</span>
        <span className="mt-1.5 text-[13px] font-semibold" style={{ color: C.dim }}>Tap to watch</span>
      </span>
    </button>
    {open && <Layer><div className="fixed inset-0 z-[96] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={v.title} data-testid={`${testId}-player`}>
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(10px,var(--sat,env(safe-area-inset-top,0px)))] text-white">
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><X className="h-5 w-5" /></button>
        <p className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">{v.title}</p><span className="w-11" />
      </div>
      <div className="grid min-h-0 flex-1 place-items-center px-3 pb-[max(16px,env(safe-area-inset-bottom))]"><div className="w-full max-w-md"><Clip v={v} testId={`${testId}-clip`} autoStart /></div></div>
    </div></Layer>}
  </>;
}

/** The exercise's how-to clip: a short one (a minute or less) when there is one, with the long tutorial a tap away.
 *  With no video at all, a link to quick clips on YouTube. */
export function VideoPlayer({ exId, name, label = "Quick how-to", className = "", testId = "fit-video", autoStart }: { exId: string; name?: string; label?: string; className?: string; testId?: string; autoStart?: boolean }) {
  const v = videoFor(exId);
  const long = longVideoFor(exId);
  const [showLong, setShowLong] = useState(false);
  if (!v) return name ? <a href={quickClipsUrl(name)} target="_blank" rel="noopener noreferrer" className={`flex min-h-12 items-center justify-center gap-2 rounded-[12px] px-4 text-[15px] font-semibold ${className}`} style={{ background: C.card2, color: C.text }} data-testid={`${testId}-find`}><Play className="h-4 w-4" fill={C.lime} style={{ color: C.lime }} />Find a quick clip of {name}</a> : null;
  return <div className={className} data-testid={testId}>
    <Clip v={v} testId={testId} autoStart={autoStart} />
    {/* The video's name under it, not on top of it. */}
    <p className="mt-2 px-0.5 text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: C.lime }}>{v.short ? `${label} · under a minute` : label}</p>
    <p className="line-clamp-2 px-0.5 text-[15px] font-semibold leading-snug" style={{ color: C.text }}>{v.title}</p>
    {long && (showLong
      ? <div className="mt-3"><Clip v={long} testId={`${testId}-long`} /><p className="mt-2 px-0.5 text-[13px]" style={{ color: C.dim }}>{long.title}</p></div>
      : <button type="button" onClick={() => setShowLong(true)} className="mt-2 px-0.5 text-[13px] font-semibold underline" style={{ color: C.dim }} data-testid={`${testId}-more`}>Want more detail? Watch the full tutorial</button>)}
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

/** A card with designed cover art across its top (fitArt.tsx) and the words below it on the card,
 *  never on top of a picture. `art` picks the art; otherwise it follows the exercise's muscle. */
export function CoverCard({ exId, art, children, onClick, className = "", testId, tall, style }: { exId?: string; art?: ArtKind; children: ReactNode; onClick?: () => void; className?: string; testId?: string; tall?: boolean; style?: React.CSSProperties }) {
  const kind = art ?? workoutArt("", exId);
  const h = tall ? 132 : 86;
  const inner = <>
    <span aria-hidden className="absolute inset-x-0 top-0" style={{ height: h }}><Art kind={kind} className="h-full w-full" /></span>
    <span aria-hidden className="block" style={{ height: h }} />
    <span className="relative flex flex-col pt-3">{children}</span>
  </>;
  const cls = `relative block overflow-hidden rounded-[16px] px-4 pb-4 text-left ${onClick ? "w-full transition active:scale-[.98]" : ""} ${className.replace(/!?min-h-\[[^\]]+\]/g, "").replace(/!p-\[?[0-9.]+(px)?\]?/g, "")}`;
  return onClick
    ? <button type="button" onClick={onClick} className={cls} style={{ ...cardStyle, ...style }} data-testid={testId}>{inner}</button>
    : <div className={cls} style={{ ...cardStyle, ...style }} data-testid={testId}>{inner}</div>;
}
