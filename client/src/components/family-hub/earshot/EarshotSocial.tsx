// Earshot/Podscroll social: a Clips feed you swipe (moments of episodes people cut, with what's said),
// and a Feed of posts (text, shared episodes, clips, reposts and quotes) with comments and replies,
// likes, notifications, people search, profiles, and podcasts people make themselves (upload a file or
// record one right here). Shared by both apps (server/podcastSocial.ts), so it imports nothing from
// the Arise app itself.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Headphones, Heart, Loader2, MessageCircle, Mic, Pause, Play, Plus, Quote, Repeat2, Scissors, Search, Send, Share2, Square, Upload, UserPlus, X } from "lucide-react";
import { clock, durationWords, hiRes, type PodEpisode, type PodShow } from "@shared/earshot";

export const ACCENT = "#ff8a3d";

/**
 * Social, Explore and Library sit on a white page. Their parts are styled for the dark player (white
 * text, see-through white fills, black surfaces), so inside `.ps-light` those are remapped to their
 * light-page versions. Things on artwork (avatars, cover cards, Clips) opt out with `.ps-dark`.
 */
const N = ":not(.ps-dark,.ps-dark *)";
export const LIGHT_CSS = `
.ps-light{background:#fff;color:#0f1419}
.ps-light .ps-dark{color:#fff}
.ps-light .bg-black${N}{background-color:#fff}
.ps-light :is([class*="bg-black/80"],[class*="bg-black/85"],[class*="bg-black/90"])${N}{background-color:rgba(255,255,255,.92)}
.ps-light :is([class*="bg-black/25"],[class*="bg-black/30"],[class*="bg-black/45"])${N}{background-color:rgba(15,20,25,.05)}
.ps-light :is([class^="bg-white/"],[class*=" bg-white/"])${N}{background-color:rgba(15,20,25,.06)}
.ps-light [class*="hover:bg-white/"]${N}:hover{background-color:rgba(15,20,25,.05)}
.ps-light .bg-white${N}{background-color:#0f1419;color:#fff}
.ps-light .bg-white${N}:disabled{opacity:.35}
.ps-light [class*="text-white/"]${N}{color:#536471}
.ps-light :is(.text-white,[class*="text-white/8"],[class*="text-white/9"])${N}:not(.bg-white){color:#0f1419}
.ps-light [class*="hover:text-white"]${N}:hover{color:#0f1419}
.ps-light [class*="placeholder:text-white/"]::placeholder{color:#8b98a5}
.ps-light [class*="border-white/"]${N}{border-color:rgba(15,20,25,.12)}
.ps-light [class*="ring-white/"]${N}{--tw-ring-color:rgba(15,20,25,.14)}
.ps-light .ring-black{--tw-ring-color:#fff}
`;
export type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
export type Profile = { handle: string; name: string; bio: string; avatar: string };
export type PostEpisode = { id: string; showId: string; show: string; title: string; art: string; audio: string; secs: number; date: string; about?: string };
type Clip = { s: number; e: number; quote: string; audio?: string };
export type Post = {
  id: string; kind: "share" | "bookmark" | "own" | "text" | "clip" | "repost"; caption: string; at: string; episode: PostEpisode | null; clip: Clip | null; repost: Post | null;
  author: Profile; likes: number; liked: boolean; comments: number; reposts: number; reposted: boolean; mine: boolean;
};
export type Comment = { id: string; postId: string; parentId: string | null; body: string; at: string; author: Profile; likes: number; liked: boolean; mine: boolean };
export type Note = { id: string; kind: "like" | "comment" | "reply" | "follow" | "repost" | "comment_like" | "episode"; at: string; read: boolean; actor: Profile; post: { id: string; kind: Post["kind"]; text: string; art: string } | null; comment: string };
export type Person = Profile & { followed: boolean };
/** Plays an episode in the main feed; with at, from that moment. */
export type PlayFn = (show: PodShow, ep: PodEpisode, at?: number) => void;

export const ago = (iso: string) => { const d = (Date.now() - Date.parse(iso)) / 1000; if (!Number.isFinite(d)) return ""; if (d < 60) return "now"; if (d < 3600) return `${Math.floor(d / 60)}m`; if (d < 86400) return `${Math.floor(d / 3600)}h`; if (d < 86400 * 7) return `${Math.floor(d / 86400)}d`; return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
export const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K` : String(n));
/** Cover art for an episode someone made without one: their title on a gradient. */
export function madeArt(title: string, seed = title): string {
  const h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const words = title.replace(/[<>&"]/g, "").split(/\s+/).slice(0, 6);
  const lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > 14 && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},80%,58%)"/><stop offset="1" stop-color="hsl(${(h + 60) % 360},70%,28%)"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="470" cy="130" r="70" fill="rgba(255,255,255,.15)"/><text x="48" y="${330 - lines.length * 34}" font-family="system-ui,-apple-system,sans-serif" font-weight="900" font-size="64" fill="#fff">${lines.slice(0, 4).map((l, i) => `<tspan x="48" dy="${i ? 76 : 0}">${l}</tspan>`).join("")}</text><text x="48" y="540" font-family="system-ui,sans-serif" font-weight="700" font-size="28" fill="rgba(255,255,255,.8)">🎙️ Made by a listener</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
export const toEpisode = (e: PostEpisode, author = ""): PodEpisode => ({ id: e.id, showId: e.showId, show: e.show, author, title: e.title, about: e.about || "", audio: e.audio, date: e.date, secs: e.secs, art: e.art || madeArt(e.title, e.id), link: "", explicit: false });
export const toShow = (e: PostEpisode, author = ""): PodShow => ({ id: e.showId, name: e.show, author, art: e.art || madeArt(e.title, e.id), genre: "culture", appleGenre: "", link: "", episodes: 0, explicit: false, latest: e.date });
export const postEpisodeOf = (ep: PodEpisode): PostEpisode => ({ id: ep.id, showId: ep.showId, show: ep.show, title: ep.title, art: ep.art.startsWith("data:") ? "" : ep.art, audio: ep.audio, secs: ep.secs, date: ep.date, about: ep.about?.slice(0, 600) });
export const artOf = (e: PostEpisode | null) => (e ? e.art || madeArt(e.title, e.id) : "");
/** What a plain repost passes on; quotes and everything else are their own post. */
export const shown = (p: Post) => (p.kind === "repost" && !p.caption && p.repost ? p.repost : p);

// ===========================================================================
// One player for every clip on the page
// ===========================================================================
export type ClipAudio = { id: string | null; playing: boolean; t: number; toggle: (p: Post, loop?: boolean) => void; play: (p: Post, loop?: boolean) => void; stop: () => void };
export function useClipAudio(onHush?: () => void): ClipAudio {
  const hush = useRef(onHush); hush.current = onHush;
  const a = useRef<HTMLAudioElement | null>(null);
  const cur = useRef<{ id: string; s: number; e: number; loop: boolean; own: boolean } | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const el = () => {
    if (!a.current) {
      const x = new Audio(); x.preload = "auto";
      x.addEventListener("timeupdate", () => {
        const c = cur.current; if (!c) return;
        const at = c.own ? x.currentTime : x.currentTime - c.s, len = c.e - c.s;
        setT(len > 0 ? Math.min(1, Math.max(0, at / len)) : 0);
        if (!c.own && x.currentTime >= c.e) { if (c.loop) x.currentTime = c.s; else { x.pause(); x.currentTime = c.s; } }
      });
      x.addEventListener("ended", () => { const c = cur.current; if (c?.loop) { x.currentTime = c.own ? 0 : c.s; void x.play().catch(() => {}); } else setPlaying(false); });
      x.addEventListener("play", () => setPlaying(true)); x.addEventListener("pause", () => setPlaying(false));
      a.current = x;
    }
    return a.current;
  };
  const play = useCallback((p: Post, loop = false) => {
    const clip = p.clip, ep = p.episode; if (!clip || !ep) return;
    const x = el(), own = !!clip.audio;
    if (cur.current?.id !== p.id) {
      cur.current = { id: p.id, s: clip.s, e: clip.e, loop, own };
      x.src = own ? clip.audio! : ep.audio; setT(0); setId(p.id);
      if (!own) x.addEventListener("loadedmetadata", () => { try { x.currentTime = clip.s; } catch { /* not seekable yet */ } }, { once: true });
    } else cur.current.loop = loop;
    hush.current?.();
    void x.play().catch(() => setPlaying(false));
  }, []);
  const stop = useCallback(() => { a.current?.pause(); }, []);
  const toggle = useCallback((p: Post, loop = false) => { if (cur.current?.id === p.id && a.current && !a.current.paused) a.current.pause(); else play(p, loop); }, [play]);
  useEffect(() => () => { a.current?.pause(); if (a.current) a.current.src = ""; }, []);
  return { id, playing, t, toggle, play, stop };
}

// ===========================================================================
// What every part of Social is handed
// ===========================================================================
export type Ctx = {
  api: Api; say: (m: string) => void; onPlay: PlayFn; audio: ClipAudio; me: Profile | null;
  person: (handle: string) => void; comments: (p: Post) => void; repost: (p: Post) => void; needProfile: () => void;
};
/** Someone's picture: their initials on a muted color that's always theirs. */
export function Avatar({ p, size = 36, onClick, ring }: { p: Profile; size?: number; onClick?: () => void; ring?: string }) {
  const h = [...(p.handle || p.name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 11);
  const letters = (p.name || p.handle).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join("").toUpperCase() || "?";
  const inner = <span className={`ps-dark grid select-none place-items-center rounded-full font-semibold text-white/95 ${ring ?? ""}`} style={{ width: size, height: size, fontSize: Math.round(size * (letters.length > 1 ? 0.36 : 0.42)), background: `hsl(${h} 28% 34%)` }}>{letters}</span>;
  return onClick ? <button type="button" onClick={onClick} aria-label={`@${p.handle}`} className="flex-none self-start">{inner}</button> : <span className="flex-none self-start">{inner}</span>;
}

// ===========================================================================
// Clips: swipe through moments
// ===========================================================================
export function ClipsFeed({ posts, ctx, setup, onRefresh }: { posts: Post[] | null; ctx: Ctx; setup: boolean; onRefresh: () => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const list = posts ?? [];
  useEffect(() => {
    const p = list[active];
    if (started && p) ctx.audio.play(p, true);
  }, [active, started, list[active]?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!posts) return <div className="grid flex-1 place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!list.length) return <div className="grid flex-1 place-items-center p-8 text-center"><div>
    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/[.06]"><Scissors size={26} /></span>
    <p className="mt-4 text-lg font-semibold">{setup ? "Clips are almost here" : "No clips yet"}</p>
    <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-white/55">{setup ? "Social is being set up for clips, comments and notifications. Check back soon." : "Heard something great? While it plays, tap Share, then Clip a moment. It shows up here for everyone."}</p>
    {!setup && <button type="button" onClick={onRefresh} className="mt-5 min-h-11 rounded-full bg-white/10 px-5 text-sm font-semibold">Refresh</button>}
  </div></div>;
  return <div ref={box} onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight)); if (i !== active) setActive(i); }}
    className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none]">
    {list.map((p, i) => <ClipCard key={p.id} post={p} ctx={ctx} active={i === active} onStart={() => setStarted(true)} />)}
  </div>;
}
function ClipCard({ post, ctx, active, onStart }: { post: Post; ctx: Ctx; active: boolean; onStart: () => void }) {
  const ep = post.episode!, clip = post.clip!, art = artOf(ep);
  const mine = ctx.audio.id === post.id, playing = mine && ctx.audio.playing;
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [following, setFollowing] = useState(false);
  useEffect(() => { setLiked(post.liked); setLikes(post.likes); }, [post.liked, post.likes]);
  const like = () => { if (!ctx.me) return ctx.needProfile(); const on = !liked; setLiked(on); setLikes((n) => Math.max(0, n + (on ? 1 : -1))); ctx.api(`/api/earshot/social/posts/${post.id}/like`, { method: "POST", body: { on } }).catch(() => {}); };
  const tap = () => { onStart(); ctx.audio.toggle(post, true); };
  const follow = () => { if (!ctx.me) return ctx.needProfile(); setFollowing(true); ctx.api("/api/earshot/social/follow", { method: "POST", body: { handle: post.author.handle } }).then(() => ctx.say(`Following @${post.author.handle}.`)).catch((e) => ctx.say(e.message)); };
  const len = clip.e - clip.s;
  return <article className="relative h-full snap-start overflow-hidden [scroll-snap-stop:always]" aria-label={`Clip from ${ep.title}, posted by ${post.author.name}`}>
    <div aria-hidden className="absolute -inset-[20%] bg-cover bg-center opacity-60 blur-3xl" style={{ backgroundImage: `url("${hiRes(art, 300)}")` }} />
    <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/85" />
    <button type="button" onClick={tap} aria-label={playing ? "Pause" : "Play"} className="absolute inset-0 z-[1]" />
    <div className="pointer-events-none relative z-[2] flex h-full flex-col px-5 pb-6 pt-4">
      <div className="flex items-center gap-3">
        <img src={hiRes(art, 300)} alt="" referrerPolicy="no-referrer" className={`h-14 w-14 flex-none rounded-xl object-cover shadow-xl transition-transform duration-500 ${playing ? "scale-105" : ""}`} />
        <div className="min-w-0"><p className="line-clamp-1 text-sm font-semibold">{ep.show}</p><p className="line-clamp-1 text-xs text-white/55">{ep.title}</p></div>
      </div>
      {/* What's said, big: the moment itself. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center pr-12">
        <Quote size={30} className="text-white/30" />
        <p className={`mt-2 text-[clamp(1.4rem,6vw,2rem)] font-bold leading-[1.22] tracking-tight transition-opacity ${playing || !mine ? "opacity-100" : "opacity-80"}`}>{clip.quote || ep.title}</p>
        {!playing && active && <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur"><Play size={14} fill="currentColor" />{mine ? "Paused" : "Tap to listen"}</span>}
      </div>
      <div className="pr-14">
        <div className="flex items-center gap-2">
          <Avatar p={post.author} size={34} />
          <button type="button" onClick={() => ctx.person(post.author.handle)} className="pointer-events-auto min-w-0 text-left"><b className="block truncate text-[15px]">{post.author.name}</b><span className="block truncate text-xs text-white/55">@{post.author.handle} · {ago(post.at)}</span></button>
          {!post.mine && !following && <button type="button" onClick={follow} className="pointer-events-auto ml-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-white/40">Follow</button>}
        </div>
        {post.caption && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/85">{post.caption}</p>}
        <div className="mt-3 flex items-center gap-2 text-[11px] tabular-nums text-white/55">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/20"><span className="block h-full rounded-full bg-white" style={{ width: `${mine ? ctx.audio.t * 100 : 0}%` }} /></span>
          <span>{clock(len)}</span>
        </div>
      </div>
    </div>
    <div className="absolute bottom-6 right-2 z-[3] flex w-14 flex-col items-center gap-3">
      <Rail label="Like" n={likes} on={liked} onClick={like}><Heart size={27} strokeWidth={1.6} className={liked ? "fill-rose-500 text-rose-500" : ""} /></Rail>
      <Rail label="Comments" n={post.comments} onClick={() => ctx.comments(post)}><MessageCircle size={26} strokeWidth={1.6} /></Rail>
      <Rail label="Repost" n={post.reposts} on={post.reposted} onClick={() => ctx.repost(post)}><Repeat2 size={27} strokeWidth={1.6} className={post.reposted ? "text-emerald-400" : ""} /></Rail>
      <Rail label="Full episode" onClick={() => { ctx.audio.stop(); ctx.onPlay(toShow(ep, post.author.name), toEpisode(ep, post.author.name), clip.s); }}><Headphones size={25} strokeWidth={1.6} /></Rail>
      <Rail label="Share" onClick={() => shareLink(ctx, post)}><Share2 size={24} strokeWidth={1.6} /></Rail>
    </div>
  </article>;
}
function Rail({ label, n, on, onClick, children }: { label: string; n?: number; on?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} aria-pressed={on} className="flex min-h-11 w-14 flex-col items-center gap-0.5 text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,.5)] active:scale-95">
    {children}<span className="text-[10px] font-semibold tabular-nums text-white/70">{typeof n === "number" ? (n > 0 ? compact(n) : "") : label}</span>
  </button>;
}
export function shareLink(ctx: Ctx, post: Post) {
  const ep = shown(post).episode;
  const url = `${location.origin}${ep ? `/?s=${ep.showId}&e=${ep.id}` : ""}`;
  const text = shown(post).clip?.quote ? `“${shown(post).clip!.quote}” — ${ep?.show ?? ""}` : shown(post).caption || ep?.title || "Pod+";
  if (navigator.share) void navigator.share({ title: ep?.title || "Pod+", text, url }).catch(() => {});
  else void navigator.clipboard?.writeText(`${text} ${url}`).then(() => ctx.say("Link copied."), () => ctx.say(url));
}

// ===========================================================================
// Feed posts
// ===========================================================================
export function PostBody({ post: p, ctx, nested }: { post: Post; ctx: Ctx; nested?: boolean }) {
  const ep = p.episode;
  return <div className="mt-0.5">
    {p.caption && <p className={`whitespace-pre-wrap break-words leading-relaxed ${p.kind === "text" && !nested ? "text-[16px]" : "text-[15px]"} ${nested ? "line-clamp-4" : ""}`}>{p.caption}</p>}
    {p.kind === "clip" && p.clip && ep && <ClipInline post={p} ctx={ctx} />}
    {(p.kind === "share" || p.kind === "own" || p.kind === "bookmark") && ep && <button type="button" onClick={() => ctx.onPlay(toShow(ep, p.author.name), toEpisode(ep, p.author.name))} className="mt-2.5 grid w-full grid-cols-[64px_1fr_auto] items-center gap-3 rounded-xl bg-black/25 p-2 text-left ring-1 ring-white/[.06]">
      <img src={hiRes(artOf(ep), 300)} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-lg object-cover" />
      <span className="min-w-0"><span className="line-clamp-2 text-sm font-semibold leading-snug">{ep.title}</span><span className="mt-0.5 line-clamp-1 text-xs text-white/55">{ep.show}{ep.secs > 0 ? ` · ${durationWords(ep.secs)}` : ""}</span>{p.kind === "own" && <span className="mt-0.5 block text-[11px] font-semibold" style={{ color: ACCENT }}>Made by @{p.author.handle}</span>}</span>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#111013]"><Play size={15} fill="currentColor" /></span>
    </button>}
    {p.kind === "repost" && p.repost && <div className="mt-2.5 rounded-xl p-3 ring-1 ring-white/[.12]">
      <div className="flex items-center gap-2"><Avatar p={p.repost.author} size={22} /><button type="button" onClick={() => ctx.person(p.repost!.author.handle)} className="truncate text-sm font-semibold">{p.repost.author.name}</button><span className="truncate text-xs text-white/40">@{p.repost.author.handle} · {ago(p.repost.at)}</span></div>
      <PostBody post={p.repost} ctx={ctx} nested />
    </div>}
  </div>;
}
export function ClipInline({ post: p, ctx }: { post: Post; ctx: Ctx }) {
  const ep = p.episode!, clip = p.clip!, mine = ctx.audio.id === p.id, playing = mine && ctx.audio.playing, len = Math.max(1, clip.e - clip.s);
  return <div className="mt-3 rounded-2xl border border-white/[.12] p-3.5">
    {clip.quote && <p className="border-l-2 pl-3 text-[15px] leading-6 text-white/90" style={{ borderColor: ACCENT }}>{clip.quote}</p>}
    <div className={`${clip.quote ? "mt-3" : ""} flex items-center gap-3`}>
      <img src={hiRes(artOf(ep), 120)} alt="" referrerPolicy="no-referrer" className="h-11 w-11 flex-none rounded-md object-cover" />
      <div className="min-w-0 flex-1 leading-[18px]"><p className="truncate text-[14px] font-semibold">{ep.show}</p><p className="truncate text-[13px] text-[#8b8f95]">{ep.title}</p></div>
      <button type="button" onClick={() => ctx.audio.toggle(p)} aria-label={playing ? "Pause clip" : "Play clip"} className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white text-black active:scale-95">{playing ? <Pause size={16} fill="currentColor" strokeWidth={0} /> : <Play size={16} fill="currentColor" strokeWidth={0} className="ml-0.5" />}</button>
    </div>
    <div className="mt-3 flex items-center gap-2.5 text-[12px] tabular-nums text-[#8b8f95]">
      <span className="w-9">{clock(mine ? ctx.audio.t * len : 0)}</span>
      <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[.15]"><span className="block h-full rounded-full bg-white" style={{ width: `${mine ? ctx.audio.t * 100 : 0}%` }} /></span>
      <span className="w-9 text-right">{clock(len)}</span>
    </div>
    <button type="button" onClick={() => { ctx.audio.stop(); ctx.onPlay(toShow(ep), toEpisode(ep), clip.s); }} className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-white/80 hover:underline"><Headphones size={14} />Listen to the full episode from {clock(clip.s)}</button>
  </div>;
}

// ===========================================================================
// Reposting, writing, notifications, one post, finding people
// ===========================================================================
export function RepostSheet({ post, ctx, onClose, onDone }: { post: Post; ctx: Ctx; onClose: () => void; onDone: (on: boolean, quote?: Post) => void }) {
  const [quoting, setQuoting] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const run = (work: Promise<any>, after: (b: any) => void) => { setBusy(true); work.then(after).catch((e) => (e?.needProfile ? ctx.needProfile() : ctx.say(e.message))).finally(() => setBusy(false)); };
  if (post.mine && !quoting) return <Sheet title="Repost" onClose={onClose}><div className="px-4 pb-6"><p className="py-2 text-sm text-white/60">This is your post. You can quote it with something new.</p><button type="button" onClick={() => setQuoting(true)} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-[#111013]"><Quote size={17} />Quote</button></div></Sheet>;
  return <Sheet title={quoting ? "Quote" : "Repost"} onClose={onClose}>
    <div className="px-4 pb-6">
      {!quoting ? <div className="flex flex-col gap-2">
        <button type="button" disabled={busy} onClick={() => run(ctx.api(`/api/earshot/social/posts/${post.id}/repost`, { method: "POST", body: { on: !post.reposted } }), () => { ctx.say(post.reposted ? "Repost undone." : "Reposted to your followers."); onDone(!post.reposted); })} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/[.06] px-4 text-left font-semibold"><Repeat2 size={20} className={post.reposted ? "text-emerald-400" : ""} />{post.reposted ? "Undo repost" : "Repost"}</button>
        <button type="button" onClick={() => setQuoting(true)} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/[.06] px-4 text-left font-semibold"><Quote size={19} />Quote, with your take</button>
      </div> : <>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 280))} rows={3} autoFocus placeholder="Add your take…" className={`${inputCls} py-2.5`} />
        <div className="mt-2 rounded-xl p-3 ring-1 ring-white/[.12]"><div className="flex items-center gap-2 text-sm"><Avatar p={post.author} size={22} /><b className="truncate">{post.author.name}</b></div><PostBody post={post} ctx={ctx} nested /></div>
        <div className="mt-3 flex items-center justify-between"><span className="text-xs tabular-nums text-white/40">{280 - caption.length}</span>
          <button type="button" disabled={busy || !caption.trim()} onClick={() => run(ctx.api("/api/earshot/social/posts", { method: "POST", body: { kind: "repost", repostOf: post.id, caption } }), (b) => { ctx.say("Posted."); onDone(true, b.post); })} className="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 font-semibold text-[#111013] disabled:opacity-40"><Send size={16} />Post</button></div>
      </>}
    </div>
  </Sheet>;
}
const NOTE_WORDS: Record<Note["kind"], string> = { like: "liked your post", comment: "commented", reply: "replied to you", follow: "started following you", repost: "reposted your post", comment_like: "liked your comment", episode: "posted a new episode" };
export function NotesSheet({ api, onClose, onPost, onPerson }: { api: Api; onClose: () => void; onPost: (id: string) => void; onPerson: (h: string) => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [setup, setSetup] = useState(false);
  useEffect(() => { api("/api/earshot/social/notifications").then((b) => { setNotes(b.notes || []); setSetup(!!b.setup); void api("/api/earshot/social/notifications/read", { method: "POST" }).catch(() => {}); }).catch(() => setNotes([])); }, [api]);
  const icon = (k: Note["kind"]) => (k === "like" || k === "comment_like" ? <Heart size={13} className="fill-rose-500 text-rose-500" /> : k === "repost" ? <Repeat2 size={13} className="text-emerald-400" /> : k === "follow" ? <UserPlus size={13} style={{ color: ACCENT }} /> : k === "episode" ? <Mic size={13} style={{ color: ACCENT }} /> : <MessageCircle size={13} className="text-sky-400" />);
  return <Sheet title="Notifications" onClose={onClose} tall>
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
      {!notes && <div className="grid place-items-center py-10"><Loader2 className="animate-spin" /></div>}
      {notes && !notes.length && <p className="py-14 text-center text-sm text-white/50">{setup ? "Notifications are being set up. Check back soon." : "Nothing yet. When people like, comment on, repost or follow you, it shows up here."}</p>}
      {notes?.map((n) => <button key={n.id} type="button" onClick={() => (n.kind === "follow" || !n.post ? onPerson(n.actor.handle) : onPost(n.post.id))} className={`flex w-full items-start gap-3 rounded-2xl p-2.5 text-left hover:bg-white/[.04] ${n.read ? "" : "bg-white/[.04]"}`}>
        <span className="relative"><Avatar p={n.actor} size={40} /><span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-black ring-2 ring-black">{icon(n.kind)}</span></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug"><b>{n.actor.name}</b> <span className="text-white/70">{NOTE_WORDS[n.kind]}</span> <span className="text-white/35">· {ago(n.at)}</span></span>
          {n.comment && <span className="mt-0.5 line-clamp-2 block text-sm text-white/80">“{n.comment}”</span>}
          {n.post?.text && !n.comment && <span className="mt-0.5 line-clamp-1 block text-xs text-white/45">{n.post.text}</span>}
        </span>
        {n.post?.art && <img src={hiRes(n.post.art, 100)} alt="" referrerPolicy="no-referrer" className="h-11 w-11 flex-none rounded-lg object-cover" />}
        {!n.read && <span className="mt-2 h-2 w-2 flex-none rounded-full" style={{ background: ACCENT }} />}
      </button>)}
    </div>
  </Sheet>;
}
export function SearchSheet({ api, say, onClose, onPerson, needProfile }: { api: Api; say: (m: string) => void; onClose: () => void; onPerson: (h: string) => void; needProfile: boolean }) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => { const t = setTimeout(() => { api(`/api/earshot/social/people?q=${encodeURIComponent(q.trim())}`).then((b) => setPeople(b.people || [])).catch(() => setPeople([])); }, q.trim() ? 300 : 0); return () => clearTimeout(t); }, [api, q]);
  const follow = (p: Person) => { if (needProfile) return say("Make your profile first."); const on = !p.followed; setPeople((l) => (l || []).map((x) => (x.handle === p.handle ? { ...x, followed: on } : x))); api("/api/earshot/social/follow", { method: "POST", body: { handle: p.handle, on } }).catch((e) => say(e.message)); };
  return <Sheet title="Find people" onClose={onClose} tall>
    <div className="flex-none px-4 pb-2"><div className="relative"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Search names or @usernames" className={`${inputCls} pl-10`} /></div></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
      {!q.trim() && <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-[.14em] text-white/40">Suggested</p>}
      {!people && <div className="grid place-items-center py-8"><Loader2 className="animate-spin" /></div>}
      {people && !people.length && <p className="py-10 text-center text-sm text-white/50">{q.trim() ? "No one by that name yet." : "No one to suggest yet."}</p>}
      {people?.map((p) => <div key={p.handle} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-white/[.03]">
        <Avatar p={p} size={44} onClick={() => onPerson(p.handle)} />
        <button type="button" onClick={() => onPerson(p.handle)} className="min-w-0 flex-1 text-left"><b className="block truncate text-[15px]">{p.name}</b><span className="block truncate text-xs text-white/45">@{p.handle}{p.bio ? ` · ${p.bio}` : ""}</span></button>
        <button type="button" onClick={() => follow(p)} className={`min-h-9 rounded-full px-4 text-xs font-semibold ${p.followed ? "text-white/80 ring-1 ring-white/25" : "bg-white text-[#111013]"}`}>{p.followed ? "Following" : "Follow"}</button>
      </div>)}
    </div>
  </Sheet>;
}

// ===========================================================================
// Someone's page
// ===========================================================================
export function PersonPage({ handle, ctx, patch, onEdit, onClose, row }: { handle: string; ctx: Ctx; patch: (id: string, f: (p: Post) => Post) => void; onEdit: () => void; onClose: () => void; row: (p: Post, patch: (id: string, f: (p: Post) => Post) => void, gone: () => void) => ReactNode }) {
  const [data, setData] = useState<{ profile: Profile; me: boolean; followers: number; following: number; followed: boolean; posts: Post[] } | null>(null);
  const [err, setErr] = useState("");
  const [which, setWhich] = useState<"posts" | "clips" | "own" | "bookmark">("posts");
  useEffect(() => { setData(null); ctx.api(`/api/earshot/social/u/${handle}`).then(setData).catch((e) => setErr(e?.message || "That profile didn't load.")); }, [handle]); // eslint-disable-line react-hooks/exhaustive-deps
  const follow = () => { if (!data) return; if (!ctx.me) return ctx.needProfile(); const on = !data.followed; setData({ ...data, followed: on, followers: data.followers + (on ? 1 : -1) }); ctx.api("/api/earshot/social/follow", { method: "POST", body: { handle, on } }).catch((e) => ctx.say(e.message)); };
  const local = (pid: string, f: (p: Post) => Post) => { setData((d) => (d ? { ...d, posts: d.posts.map((p) => (p.id === pid ? f(p) : p.repost?.id === pid ? { ...p, repost: f(p.repost) } : p)) } : d)); patch(pid, f); };
  const posts = data?.posts ?? [];
  const tabs = ([["posts", "Posts"], ["clips", "Clips"], ["own", data?.me ? "My podcast" : "Podcast"], ["bookmark", "Saved"]] as const).filter(([v]) => v === "posts" || posts.some((p) => (v === "clips" ? p.kind === "clip" : p.kind === v)));
  const list = which === "posts" ? posts.filter((p) => p.kind !== "bookmark") : posts.filter((p) => (which === "clips" ? p.kind === "clip" : p.kind === which));
  return <div className="absolute inset-0 z-40 overflow-y-auto bg-black pb-14 [scrollbar-width:none]" role="dialog" aria-label={`@${handle}`}>
    <div className="ps-dark relative h-32 bg-[#2a2d32]">
      <button type="button" onClick={onClose} aria-label="Back" className="absolute left-3 top-[max(.75rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-black/40 backdrop-blur"><ChevronLeft size={22} /></button>
    </div>
    <div className="px-5 pb-4">
      {!data && !err && <Loader2 className="mx-auto mt-6 animate-spin" />}
      {err && <p className="mt-6 text-center text-sm text-white/60">{err}</p>}
      {data && <>
        <div className="relative z-[1] -mt-11 flex items-end justify-between">
          <Avatar p={data.profile} size={84} ring="ring-4 ring-black" />
          {data.me ? <button type="button" onClick={onEdit} className="min-h-9 rounded-full px-4 text-[15px] font-bold ring-1 ring-white/30">Edit profile</button>
            : <button type="button" onClick={follow} className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-[15px] font-bold ${data.followed ? "ring-1 ring-white/30" : "bg-white text-black"}`}>{data.followed ? "Following" : "Follow"}</button>}
        </div>
        <h2 className="mt-3 text-[21px] font-extrabold leading-tight">{data.profile.name}</h2>
        <p className="text-[15px] text-[#8b8f95]">@{data.profile.handle}</p>
        {data.profile.bio && <p className="mt-2 text-[15px] leading-relaxed text-white/85">{data.profile.bio}</p>}
        <p className="mt-3 flex gap-4 text-[14px] text-[#8b8f95]"><span><b className="text-white">{compact(data.following)}</b> following</span><span><b className="text-white">{compact(data.followers)}</b> followers</span><span><b className="text-white">{compact(posts.filter((p) => p.kind !== "bookmark").length)}</b> posts</span></p>
      </>}
    </div>
    {data && <>
      <div className="sticky top-0 z-10 flex border-b border-white/[.09] bg-black/85 backdrop-blur-xl">{tabs.map(([v, l]) => <button key={v} type="button" aria-pressed={which === v} onClick={() => setWhich(v)} className={`relative flex-1 py-3.5 text-[15px] ${which === v ? "font-bold" : "font-medium text-[#8b8f95]"}`}>{l}{which === v && <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full" style={{ background: ACCENT }} />}</button>)}</div>
      <div className="pb-12">
        {!list.length && <p className="py-10 text-center text-sm text-white/50">{which === "clips" ? "No clips yet." : which === "own" ? "No episodes yet." : which === "bookmark" ? "Nothing saved yet." : "No posts yet."}</p>}
        {which === "bookmark" ? <div className="grid grid-cols-3 gap-2.5 p-3">{list.map((p) => p.episode && <button key={p.id} type="button" onClick={() => ctx.onPlay(toShow(p.episode!), toEpisode(p.episode!))} className="text-left"><img src={hiRes(artOf(p.episode), 300)} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl object-cover" /><b className="mt-1 line-clamp-2 text-xs leading-tight">{p.episode.title}</b></button>)}</div>
          : list.map((p) => <div key={p.id}>{row(p, local, () => setData((d) => (d ? { ...d, posts: d.posts.filter((x) => x.id !== p.id) } : d)))}</div>)}
      </div>
    </>}
  </div>;
}

// ===========================================================================
// Profile, sharing, clipping, uploading
// ===========================================================================
export function ProfileEditor({ api, say, initial, avatars, onClose, onSaved }: { api: Api; say: (m: string) => void; initial: Profile | null; avatars: string[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [avatar] = useState(initial?.avatar ?? avatars[0] ?? "🎧");
  const [busy, setBusy] = useState(false);
  const save = () => { setBusy(true); api("/api/earshot/social/me", { method: "POST", body: { name, handle, bio, avatar } }).then(() => { say(initial ? "Profile saved." : "Welcome! Your profile is live."); onSaved(); }).catch((e) => say(e.message)).finally(() => setBusy(false)); };
  return <Sheet title={initial ? "Edit profile" : "Make your profile"} onClose={onClose}>
    <div className="overflow-y-auto px-4 pb-5">
      <div className="flex items-center gap-3"><Avatar p={{ handle: handle || "you", name: name || "You", bio: "", avatar }} size={56} /><p className="text-sm text-white/55">Your initials are your picture.</p></div>
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name or a nickname" className={inputCls} /></Field>
      <Field label="Username"><div className="flex items-center rounded-xl border border-white/10 bg-black/30 pl-3"><span className="text-white/45">@</span><input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))} placeholder="podfan_22" className="min-h-11 w-full bg-transparent px-1 text-base outline-none" /></div></Field>
      <Field label="Bio"><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={2} placeholder="What do you love listening to?" className={`${inputCls} py-2`} /></Field>
      <p className="mt-2 text-xs text-white/45">Your profile, posts, clips, bookmarks and episodes are public.</p>
      <button type="button" onClick={save} disabled={busy || !name.trim() || handle.length < 3} className="mt-4 min-h-12 w-full rounded-full bg-white font-semibold text-[#111013] disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>
    </div>
  </Sheet>;
}

/** Share: post it to your profile, clip a moment of it, or send the link anywhere. */
export function ShareSheet({ api, say, ep, onLink, onClose, social, onClip }: { api: Api; say: (m: string) => void; ep: PodEpisode; onLink: () => void; onClose: () => void; social: boolean; onClip?: () => void }) {
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const post = () => { setBusy(true); api("/api/earshot/social/posts", { method: "POST", body: { episode: postEpisodeOf(ep), caption } }).then(() => { say("Posted to your profile."); onClose(); }).catch((e) => say(e?.needProfile || /profile first/i.test(e?.message || "") ? "Make your profile in the Social tab first." : e.message)).finally(() => setBusy(false)); };
  return <Sheet title="Share" onClose={onClose}>
    <div className="px-4 pb-5">
      <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5"><img src={hiRes(ep.art, 200)} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-lg object-cover" /><span className="min-w-0"><b className="line-clamp-1 text-sm">{ep.title}</b><span className="line-clamp-1 text-xs text-white/55">{ep.show}</span></span></div>
      {social && onClip && <button type="button" onClick={onClip} className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left font-semibold text-[#111013]" style={{ background: ACCENT }}><Scissors size={19} /><span><span className="block">Clip a moment</span><span className="block text-xs font-medium opacity-75">Post the part you just heard, with what's said</span></span></button>}
      {social && <><textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={280} rows={2} placeholder="Or share the whole episode: say why it's worth a listen…" className={`${inputCls} mt-3 py-2`} />
        <button type="button" onClick={post} disabled={busy} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-[#111013] disabled:opacity-50"><Send size={17} />{busy ? "Posting…" : "Post to my profile"}</button></>}
      <button type="button" onClick={() => { onClose(); onLink(); }} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 font-bold"><Share2 size={17} />Send a link</button>
    </div>
  </Sheet>;
}

/**
 * Clip a moment of the episode playing: by default the last 30 seconds. Pick its first and last line
 * from what's said (when the transcript has loaded) or nudge either end, hear it, and post it. The
 * server cuts the audio from this listener's own copy (sid) and keeps it with the post.
 */
export function ClipMaker({ api, say, ep, time, lines, sid, onPreview, onClose }: {
  api: Api; say: (m: string) => void; ep: PodEpisode; time: number; lines: { s: number; e: number; t: string }[]; sid?: string;
  onPreview: (s: number, e: number) => void; onClose: () => void;
}) {
  const near = useMemo(() => lines.filter((l) => l.e > time - 150 && l.s < time + 45), [lines, time]);
  const [s, setS] = useState(() => Math.max(0, Math.floor(time - 30)));
  const [e, setE] = useState(() => Math.max(5, Math.floor(time)));
  const [quote, setQuote] = useState("");
  const [edited, setEdited] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<"start" | "end" | null>(null);
  const len = e - s;
  const said = useMemo(() => near.filter((l) => l.e > s + 0.5 && l.s < e - 0.5).map((l) => l.t.trim()).join(" "), [near, s, e]);
  useEffect(() => { if (!edited) setQuote(said.slice(0, 400)); }, [said, edited]);
  const setStart = (v: number) => { const x = Math.max(0, Math.min(v, e - 5)); setS(Math.round(x * 10) / 10); if (e - x > 90) setE(Math.round((x + 90) * 10) / 10); };
  const setEnd = (v: number) => { const x = Math.max(s + 5, v); setE(Math.round(Math.min(x, s + 90) * 10) / 10); };
  const tapLine = (l: { s: number; e: number }) => { if (pick === "end") { setEnd(l.e); setPick(null); } else { setStart(l.s); if (l.s >= e - 5 || e - l.s > 90) setE(Math.round(Math.min(l.s + 30, l.s + 90) * 10) / 10); setPick("end"); } };
  const post = () => {
    setBusy(true);
    api("/api/earshot/social/posts", { method: "POST", body: { kind: "clip", episode: postEpisodeOf(ep), clip: { s, e, quote }, caption, sid } })
      .then(() => { say("Clip posted. It's in Social → Clips."); onClose(); })
      .catch((err) => say(err?.needProfile || /profile first/i.test(err?.message || "") ? "Make your profile in the Social tab first." : err.message)).finally(() => setBusy(false));
  };
  const Nudge = ({ label, onClick }: { label: string; onClick: () => void }) => <button type="button" onClick={onClick} className="min-h-9 rounded-full bg-white/10 px-3 text-xs font-semibold tabular-nums">{label}</button>;
  return <Sheet title="Clip a moment" onClose={onClose}>
    <div className="overflow-y-auto px-4 pb-6">
      <div className="flex items-center gap-3"><img src={hiRes(ep.art, 200)} alt="" referrerPolicy="no-referrer" className="h-11 w-11 rounded-lg object-cover" /><span className="min-w-0"><b className="line-clamp-1 text-sm">{ep.title}</b><span className="text-xs text-white/55">{clock(s)} – {clock(e)} · {Math.round(len)} s</span></span>
        <button type="button" onClick={() => onPreview(s, e)} className="ml-auto flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-[#111013]"><Play size={14} fill="currentColor" />Hear it</button></div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white/[.05] p-2.5"><p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Starts</p><p className="text-lg font-semibold tabular-nums">{clock(s)}</p><div className="mt-1.5 flex gap-1.5"><Nudge label="−5s" onClick={() => setStart(s - 5)} /><Nudge label="+5s" onClick={() => setStart(s + 5)} /></div></div>
        <div className="rounded-2xl bg-white/[.05] p-2.5"><p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Ends</p><p className="text-lg font-semibold tabular-nums">{clock(e)}</p><div className="mt-1.5 flex gap-1.5"><Nudge label="−5s" onClick={() => setEnd(e - 5)} /><Nudge label="+5s" onClick={() => setEnd(e + 5)} /></div></div>
      </div>
      {near.length > 0 && <>
        <p className="mt-4 text-xs text-white/50">{pick === "end" ? "Now tap the line it ends on." : "Or tap the line it starts on, then the one it ends on."}</p>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl bg-black/25 p-1.5">{near.map((l) => { const inside = l.e > s + 0.5 && l.s < e - 0.5; return <button key={l.s} type="button" onClick={() => tapLine(l)} className={`block w-full rounded-xl px-2.5 py-1.5 text-left text-[13px] leading-snug ${inside ? "bg-white/[.12] text-white" : "text-white/55"}`}><span className="mr-2 text-[11px] tabular-nums text-white/35">{clock(l.s)}</span>{l.t}</button>; })}</div>
      </>}
      <Field label="What's said (shown big on the clip)"><textarea value={quote} onChange={(ev) => { setQuote(ev.target.value.slice(0, 400)); setEdited(true); }} rows={3} placeholder="The words that make this moment" className={`${inputCls} py-2`} /></Field>
      <Field label="Your take (optional)"><input value={caption} onChange={(ev) => setCaption(ev.target.value.slice(0, 280))} placeholder="Why this moment?" className={inputCls} /></Field>
      <button type="button" onClick={post} disabled={busy || len < 5 || len > 90} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-semibold text-[#111013] disabled:opacity-40" style={{ background: ACCENT }}>{busy ? <><Loader2 size={17} className="animate-spin" />Cutting your clip…</> : <><Scissors size={17} />Post clip</>}</button>
    </div>
  </Sheet>;
}

export function UploadSheet({ api, say, onClose, onDone }: { api: Api; say: (m: string) => void; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [art, setArt] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [secs, setSecs] = useState(0);
  const [step, setStep] = useState("");
  const [rec, setRec] = useState<{ r: MediaRecorder; at: number } | null>(null);
  const [tick, setTick] = useState(0);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => { if (!rec) return; const t = setInterval(() => setTick((x) => x + 1), 500); return () => clearInterval(t); }, [rec]);
  void tick;
  useEffect(() => {
    if (!file) { setSecs(0); return; }
    const u = URL.createObjectURL(file); const a = new Audio(); a.preload = "metadata"; a.src = u;
    a.onloadedmetadata = () => { setSecs(Number.isFinite(a.duration) ? Math.round(a.duration) : 0); URL.revokeObjectURL(u); };
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const record = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || "";
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const mime = (r.mimeType || "audio/webm").split(";")[0]; const blob = new Blob(chunks.current, { type: mime }); setFile(new File([blob], `recording.${mime.includes("mp4") ? "m4a" : "webm"}`, { type: mime })); };
      r.start(1000); setRec({ r, at: Date.now() });
    } catch { say("Allow the microphone to record, or upload a file instead."); }
  };
  const stop = () => { rec?.r.stop(); setRec(null); };
  const put = async (f: File, kind: "audio" | "art") => {
    const type = (f.type || (kind === "art" ? "image/jpeg" : "audio/mpeg")).split(";")[0];
    const u = await api("/api/earshot/social/upload-url", { method: "POST", body: { kind, type, size: f.size } });
    const res = await fetch(u.url, { method: "PUT", headers: { "Content-Type": type, "x-upsert": "false" }, body: f });
    if (!res.ok) throw new Error("The upload didn't go through. Try again.");
    return u.path as string;
  };
  const publish = async () => {
    if (!file || !title.trim()) return;
    try {
      setStep("Uploading audio…"); const path = await put(file, "audio");
      let artPath = ""; if (art) { setStep("Uploading cover…"); artPath = await put(art, "art"); }
      setStep("Publishing…");
      await api("/api/earshot/social/episodes", { method: "POST", body: { title, about, path, artPath, secs } });
      say("Your episode is live on your page."); onDone();
    } catch (e: any) { say(e?.message || "That didn't work. Try again."); setStep(""); }
  };
  const recSecs = rec ? Math.floor((Date.now() - rec.at) / 1000) : 0;
  return <Sheet title="Make your own podcast" onClose={() => { if (rec) stop(); onClose(); }}>
    <div className="overflow-y-auto px-4 pb-6">
      {!file ? <div className="grid grid-cols-2 gap-2">
        {rec ? <button type="button" onClick={stop} className="col-span-2 flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-rose-600/90 font-semibold"><Square size={22} fill="currentColor" />Stop · {clock(recSecs)}</button>
          : <><button type="button" onClick={record} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-white font-semibold text-[#111013]"><Mic size={24} />Record</button>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-white/10 font-semibold"><Upload size={22} />Upload a file<input type="file" accept="audio/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></>}
      </div> : <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Mic size={18} /></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{file.name}</b><span className="text-xs text-white/55">{secs ? durationWords(secs) : ""} · {(file.size / 1024 / 1024).toFixed(1)} MB</span></span><button type="button" onClick={() => setFile(null)} aria-label="Remove" className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X size={15} /></button></div>}
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Episode 1: Why I started this" className={inputCls} /></Field>
      <Field label="What it's about"><textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={1200} rows={3} className={`${inputCls} py-2`} /></Field>
      <Field label="Cover (optional)"><label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 px-3 text-sm text-white/70"><Plus size={16} />{art ? art.name : "Add a square image"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setArt(e.target.files?.[0] ?? null)} /></label></Field>
      {!art && title.trim() && <img src={madeArt(title)} alt="Cover preview" className="mt-2 h-24 w-24 rounded-xl" />}
      <p className="mt-3 text-xs text-white/45">Up to 100 MB. Everyone can find and play it on your page. Only post things you made or have the rights to.</p>
      <button type="button" onClick={publish} disabled={!file || !title.trim() || !!step || !!rec} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-[#111013] disabled:opacity-40">{step ? <><Loader2 className="animate-spin" size={18} />{step}</> : "Publish"}</button>
    </div>
  </Sheet>;
}

export const inputCls = "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base outline-none focus:border-[#ff8a3d]";
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="mt-3 block"><span className="mb-1 block text-xs font-bold text-white/60">{label}</span>{children}</label>;
export function Sheet({ title, onClose, children, tall }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <div className="absolute inset-0 z-50 flex items-end bg-black/55" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className={`flex w-full flex-col rounded-t-2xl border-t border-white/[.12] bg-black pt-2 shadow-2xl ${tall ? "h-[88%]" : "max-h-[90%]"}`}>
      <div className="mx-auto mb-1 h-1.5 w-10 flex-none rounded-full bg-white/20" />
      <div className="flex flex-none items-center justify-between px-4 pb-2"><h3 className="text-lg font-semibold">{title}</h3><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X size={18} /></button></div>
      {children}
    </div>
  </div>;
}
