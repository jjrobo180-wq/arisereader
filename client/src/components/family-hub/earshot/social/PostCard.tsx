// A post, the way the big apps show one: picture, name, @handle and time, then the words (with
// @mentions, #hashtags and links), photos (1 to 4, tap for full screen, double-tap to like), a video
// that plays muted as it scrolls into view, a poll, an episode or a clip you can play, or a quoted
// post. Then reply, repost (or quote), like, save and share.
import { useEffect, useRef, useState, type MouseEvent as RMouseEvent, type ReactNode } from "react";
import { Ban, BarChart2, Bookmark, ChevronLeft, ChevronRight, Flag, Headphones, Heart, Link2, MessageCircle, MoreHorizontal, Pause, Play, Quote, Repeat2, Share, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { clock, durationWords, hiRes } from "@shared/earshot";
import { toEpisode, toShow } from "../EarshotSocial";
import { ActionSheet, Avatar, Layer, NameLine, RichText, compactCount, linkTo, shareOrCopy, shortAgo, type Media, type Post, type SCtx } from "./kit";

export function PostCard({ post, ctx, onChange, onGone, detail }: { post: Post; ctx: SCtx; onChange: (p: Post) => void; onGone: () => void; detail?: boolean }) {
  // A plain repost shows the original, with "<name> reposted" above it; a quote shows the quote.
  const plain = post.kind === "repost" && !post.caption && post.repost;
  const p = plain ? post.repost! : post;
  const update = (np: Post) => onChange(plain ? { ...post, repost: np } : np);
  const [menu, setMenu] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [pop, setPop] = useState(0);
  const like = () => {
    if (ctx.needProfile()) return;
    const on = !p.liked; if (on) setPop((n) => n + 1);
    update({ ...p, liked: on, likes: Math.max(0, p.likes + (on ? 1 : -1)) });
    ctx.api(`/api/earshot/social/posts/${p.id}/like`, { method: "POST", body: { on } }).catch(() => update(p));
  };
  const save = () => {
    if (ctx.needProfile()) return;
    const on = !p.saved; update({ ...p, saved: on });
    ctx.api(`/api/earshot/social/posts/${p.id}/save`, { method: "POST", body: { on } }).then(() => ctx.say(on ? "Saved. Find it on your profile." : "Removed from saved.")).catch((e) => { update(p); ctx.say(e.message); });
  };
  const repost = () => {
    const on = !p.reposted;
    update({ ...p, reposted: on, reposts: Math.max(0, p.reposts + (on ? 1 : -1)) });
    ctx.api(`/api/earshot/social/posts/${p.id}/repost`, { method: "POST", body: { on } }).then(() => ctx.say(on ? "Reposted." : "Repost undone.")).catch((e) => { update(p); ctx.say(e.message); });
  };
  const remove = () => ctx.api(`/api/earshot/social/posts/${post.id}`, { method: "DELETE" }).then(() => { ctx.say("Your post was deleted."); onGone(); }).catch((e) => ctx.say(e.message));
  const report = () => ctx.api(`/api/earshot/social/posts/${p.id}/report`, { method: "POST" }).then(() => { ctx.say("Thanks. We'll take a look."); onGone(); }).catch((e) => ctx.say(e.message));
  const block = () => ctx.api("/api/earshot/social/block", { method: "POST", body: { handle: p.author.handle } }).then(() => { ctx.say(`You blocked @${p.author.handle}.`); onGone(); }).catch((e) => ctx.say(e.message));
  const open = () => { if (!detail) ctx.openPost(p); };
  const big = !!detail;

  return <article className={`${detail ? "" : "hov cursor-pointer"} border-b line px-4 pb-1.5 pt-3`} onClick={open}>
    {plain && <p className="muted -mt-0.5 mb-1 flex items-center gap-2 pl-7 text-[13px] font-bold"><Repeat2 size={15} /><button type="button" className="hover:underline" onClick={(e) => { e.stopPropagation(); ctx.openProfile(post.author.handle); }}>{post.mine ? "You" : post.author.name} reposted</button></p>}
    <div className="flex gap-3">
      {!big && <Avatar p={p.author} size={40} onClick={() => ctx.openProfile(p.author.handle)} />}
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-2">
          {big && <Avatar p={p.author} size={44} onClick={() => ctx.openProfile(p.author.handle)} />}
          <div className={`flex min-w-0 flex-1 ${big ? "flex-col" : "items-center gap-1"}`} onClick={(e) => { e.stopPropagation(); ctx.openProfile(p.author.handle); }}>
            <NameLine p={p.author} />
            <span className="muted flex min-w-0 items-center gap-1 text-[15px]"><span className="truncate">@{p.author.handle}</span>{!big && <><span>·</span><time className="flex-none hover:underline" dateTime={p.at}>{shortAgo(p.at)}</time></>}</span>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); setMenu(true); }} aria-label="More" className="muted -mr-2 grid h-8 w-8 flex-none place-items-center rounded-full hover:bg-[rgba(29,155,240,.1)] hover:text-[#1d9bf0]"><MoreHorizontal size={18} /></button>
        </header>
        <Body p={p} ctx={ctx} big={big} onChange={update} onLike={() => { if (!p.liked) like(); else setPop((n) => n + 1); }} />
        {big && <p className="muted mt-3 border-b line pb-3 text-[15px]">{new Date(p.at).toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric", year: "numeric" })}</p>}
        <div className={`muted flex items-center justify-between ${big ? "border-b line py-1" : "-ml-2 mt-1 max-w-[440px]"}`} onClick={(e) => e.stopPropagation()}>
          <Act label="Reply" n={p.comments} onClick={() => ctx.openPost(p)} tint="#1d9bf0"><MessageCircle size={18} /></Act>
          <Act label={p.reposted ? "Undo repost" : "Repost"} n={p.reposts} on={p.reposted} onClick={() => { if (!ctx.needProfile()) setReposting(true); }} tint="#00ba7c"><Repeat2 size={19} /></Act>
          <Act label={p.liked ? "Unlike" : "Like"} n={p.likes} on={p.liked} onClick={like} tint="#f91880"><Heart key={pop} size={18} className={`${p.liked ? "fill-current" : ""} ${pop ? "pop" : ""}`} /></Act>
          <Act label={p.saved ? "Remove from saved" : "Save"} on={!!p.saved} onClick={save} tint="#1d9bf0"><Bookmark size={18} className={p.saved ? "fill-current" : ""} /></Act>
          <Act label="Share" onClick={() => ctx.sharePost(p)} tint="#1d9bf0"><Share size={18} /></Act>
        </div>
      </div>
    </div>
    {menu && <ActionSheet onClose={() => setMenu(false)} items={[
      ...(post.mine ? [{ label: "Delete post", icon: <Trash2 size={18} />, danger: true, onClick: remove }] : []),
      { label: "Copy link", icon: <Link2 size={18} />, onClick: () => shareOrCopy(linkTo(`post/${p.id}`), "Pod+", ctx.say) },
      ...(!p.mine ? [
        { label: `Block @${p.author.handle}`, icon: <Ban size={18} />, danger: true, onClick: block },
        { label: "Report post", icon: <Flag size={18} />, danger: true, onClick: report },
      ] : []),
    ]} />}
    {reposting && <ActionSheet onClose={() => setReposting(false)} items={[
      { label: p.reposted ? "Undo repost" : "Repost", icon: <Repeat2 size={18} />, onClick: repost },
      { label: "Quote", icon: <Quote size={18} />, onClick: () => ctx.compose({ quote: p }) },
    ]} />}
  </article>;
}

function Act({ label, n, on, onClick, tint, children }: { label: string; n?: number; on?: boolean; onClick: () => void; tint: string; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={n ? `${label}, ${n}` : label} aria-pressed={on}
    className="group flex min-h-9 items-center gap-0.5 text-[13px] transition-colors" style={on ? { color: tint } : undefined}
    onMouseEnter={(e) => { e.currentTarget.style.color = tint; }} onMouseLeave={(e) => { e.currentTarget.style.color = on ? tint : ""; }}>
    <span className="grid h-9 w-9 place-items-center rounded-full transition group-hover:bg-[color:var(--hover)]">{children}</span>
    {n ? <span className="min-w-[1ch] tabular-nums">{compactCount(n)}</span> : null}
  </button>;
}

/** What's in the post: words, then photos/video, poll, episode, clip or the quoted post. */
export function Body({ p, ctx, big, onChange, onLike, compact }: { p: Post; ctx: SCtx; big?: boolean; onChange?: (p: Post) => void; onLike?: () => void; compact?: boolean }) {
  const media = p.media ?? [];
  return <div className="min-w-0">
    {p.caption && <div className={`${big ? "mt-3 text-[17px] leading-[1.45]" : "mt-0.5 text-[15px] leading-[1.4]"}`}><RichText text={p.caption} onMention={ctx.openProfile} onTag={ctx.openTag} /></div>}
    {media.length > 0 && <MediaGrid media={media} onLike={onLike} compact={compact} />}
    {p.poll && <PollBox post={p} ctx={ctx} onChange={onChange} />}
    {p.kind === "clip" && p.episode && p.clip && <ClipCard p={p} ctx={ctx} />}
    {(p.kind === "share" || p.kind === "own" || p.kind === "bookmark") && p.episode && <EpisodeCard p={p} ctx={ctx} />}
    {p.kind === "repost" && p.repost && <button type="button" onClick={(e) => { e.stopPropagation(); ctx.openPost(p.repost!); }} className="hov mt-2.5 block w-full overflow-hidden rounded-2xl border line p-3 text-left">
      <span className="flex items-center gap-1.5"><Avatar p={p.repost.author} size={20} /><NameLine p={p.repost.author} small /><span className="muted truncate text-[14px]">@{p.repost.author.handle} · {shortAgo(p.repost.at)}</span></span>
      <Body p={p.repost} ctx={ctx} compact />
    </button>}
  </div>;
}

// ---------------------------------------------------------------------------
// Photos and video
// ---------------------------------------------------------------------------
export function MediaGrid({ media, onLike, compact }: { media: Media[]; onLike?: () => void; compact?: boolean }) {
  const [view, setView] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const tap = useRef(0);
  const onTap = (i: number) => (e: RMouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - tap.current < 280 && onLike) { tap.current = 0; setBurst((n) => n + 1); onLike(); return; }
    tap.current = now;
    setTimeout(() => { if (tap.current === now) setView(i); }, 290);
  };
  const one = media.length === 1 ? media[0] : null;
  if (one?.type === "video") return <div className="mt-2.5"><FeedVideo m={one} compact={compact} /></div>;
  const ratio = one && one.w && one.h ? Math.min(1.9, Math.max(0.65, one.w / one.h)) : 16 / 10;
  return <div className="relative mt-2.5 overflow-hidden rounded-2xl border line" onClick={(e) => e.stopPropagation()}>
    {one ? <button type="button" onClick={onTap(0)} className="block w-full" style={{ aspectRatio: String(ratio), maxHeight: compact ? 280 : 560 }} aria-label={one.alt || "Photo"}>
      <img src={one.url} alt={one.alt || ""} loading="lazy" className="h-full w-full object-cover" />
    </button>
      : <div className={`grid gap-0.5 ${media.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2"}`} style={{ aspectRatio: compact ? "2 / 1" : "16 / 10" }}>
        {media.map((m, i) => <button key={m.url} type="button" onClick={onTap(i)} aria-label={m.alt || `Photo ${i + 1}`}
          className={`relative block overflow-hidden ${media.length === 3 && i === 0 ? "row-span-2" : ""}`}>
          <img src={m.url} alt={m.alt || ""} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        </button>)}
      </div>}
    {burst > 0 && <span key={burst} className="burst pointer-events-none absolute inset-0 grid place-items-center"><Heart size={96} className="fill-white text-white drop-shadow-[0_4px_24px_rgba(0,0,0,.45)]" /></span>}
    {view !== null && <Lightbox media={media} start={view} onClose={() => setView(null)} />}
  </div>;
}

function FeedVideo({ m, compact }: { m: Media; compact?: boolean }) {
  const el = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const v = el.current; if (!v) return;
    const io = new IntersectionObserver(([e]) => { if (e.intersectionRatio >= 0.6) void v.play().catch(() => {}); else v.pause(); }, { threshold: [0, 0.6, 1] });
    io.observe(v); return () => io.disconnect();
  }, []);
  const ratio = m.w && m.h ? Math.min(1.78, Math.max(0.56, m.w / m.h)) : 16 / 9;
  return <div className="relative overflow-hidden rounded-2xl border line bg-black" onClick={(e) => e.stopPropagation()} style={{ aspectRatio: String(ratio), maxHeight: compact ? 300 : 620 }}>
    <video ref={el} src={m.url} muted={muted} loop playsInline preload="metadata" controls={!muted} className="h-full w-full object-contain" onClick={() => setMuted(false)} />
    {muted && <button type="button" onClick={() => setMuted(false)} aria-label="Turn sound on" className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"><VolumeX size={16} /></button>}
    {!muted && <button type="button" onClick={() => setMuted(true)} aria-label="Mute" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"><Volume2 size={16} /></button>}
  </div>;
}

export function Lightbox({ media, start, onClose }: { media: Media[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const touch = useRef<number | null>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") setI((n) => Math.min(media.length - 1, n + 1)); if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1)); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [media.length, onClose]);
  const m = media[i];
  return <Layer><div className="fade absolute inset-0 z-[90] flex items-center justify-center bg-black/95" onClick={onClose} role="dialog" aria-label="Photo"
    onTouchStart={(e) => { touch.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (dx < -50) setI((n) => Math.min(media.length - 1, n + 1)); if (dx > 50) setI((n) => Math.max(0, n - 1)); }}>
    <button type="button" onClick={onClose} aria-label="Close" className="absolute left-3 top-[max(.75rem,env(safe-area-inset-top))] z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"><X size={22} /></button>
    {m.type === "video" ? <video src={m.url} controls autoPlay playsInline className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()} />
      : <img src={m.url} alt={m.alt || ""} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />}
    {i > 0 && <button type="button" onClick={(e) => { e.stopPropagation(); setI(i - 1); }} aria-label="Previous" className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white"><ChevronLeft size={22} /></button>}
    {i < media.length - 1 && <button type="button" onClick={(e) => { e.stopPropagation(); setI(i + 1); }} aria-label="Next" className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white"><ChevronRight size={22} /></button>}
    {media.length > 1 && <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] flex gap-1.5">{media.map((_, k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${k === i ? "bg-white" : "bg-white/35"}`} />)}</div>}
  </div></Layer>;
}

// ---------------------------------------------------------------------------
// Polls, episodes and clips
// ---------------------------------------------------------------------------
function PollBox({ post, ctx, onChange }: { post: Post; ctx: SCtx; onChange?: (p: Post) => void }) {
  const poll = post.poll!;
  const [busy, setBusy] = useState(false);
  const showResults = poll.mine !== null || poll.closed || post.mine;
  const vote = (i: number) => {
    if (ctx.needProfile() || busy) return;
    setBusy(true);
    ctx.api(`/api/earshot/social/posts/${post.id}/vote`, { method: "POST", body: { choice: i } }).then((b) => { if (b.poll) onChange?.({ ...post, poll: b.poll }); }).catch((e) => ctx.say(e.message)).finally(() => setBusy(false));
  };
  const left = Math.max(0, Date.parse(poll.ends) - Date.now());
  const leftWords = poll.closed ? "Final results" : left > 86_400_000 ? `${Math.ceil(left / 86_400_000)} days left` : left > 3_600_000 ? `${Math.ceil(left / 3_600_000)} hours left` : `${Math.max(1, Math.ceil(left / 60_000))} minutes left`;
  const top = Math.max(...poll.options.map((o) => o.votes));
  return <div className="mt-2.5 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
    {poll.options.map((o, i) => {
      const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
      return showResults
        ? <div key={i} className="relative flex min-h-9 items-center justify-between overflow-hidden rounded-lg px-3 text-[15px]">
          <span className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${Math.max(pct, 2)}%`, background: o.votes === top && top > 0 ? "color-mix(in srgb, var(--link) 35%, transparent)" : "var(--elev2)" }} />
          <span className={`relative ${o.votes === top && top > 0 ? "font-bold" : ""}`}>{o.text}{poll.mine === i && " ✓"}</span>
          <span className={`relative tabular-nums ${o.votes === top && top > 0 ? "font-bold" : ""}`}>{pct}%</span>
        </div>
        : <button key={i} type="button" disabled={busy} onClick={() => vote(i)} className="min-h-9 rounded-full px-4 text-[15px] font-bold link transition hover:bg-[rgba(29,155,240,.1)]" style={{ boxShadow: "inset 0 0 0 1px var(--link)" }}>{o.text}</button>;
    })}
    <p className="muted text-[14px]"><BarChart2 size={14} className="mr-1 inline" />{poll.total.toLocaleString()} {poll.total === 1 ? "vote" : "votes"} · {leftWords}</p>
  </div>;
}

function EpisodeCard({ p, ctx }: { p: Post; ctx: SCtx }) {
  const ep = p.episode!;
  return <button type="button" onClick={(e) => { e.stopPropagation(); ctx.play(toShow(ep, p.author.name), toEpisode(ep, p.author.name)); }}
    className="hov mt-2.5 grid w-full grid-cols-[72px_1fr_auto] items-center gap-3 overflow-hidden rounded-2xl border line p-2 text-left">
    <img src={hiRes(ep.art || "", 200)} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-[72px] w-[72px] rounded-xl object-cover elev2" />
    <span className="min-w-0">
      <span className="muted flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide"><Headphones size={12} />{p.kind === "own" ? "New episode" : "Episode"}</span>
      <b className="mt-0.5 line-clamp-2 block text-[15px] leading-snug">{ep.title}</b>
      <span className="muted line-clamp-1 block text-[13px]">{ep.show}{ep.secs ? ` · ${durationWords(ep.secs)}` : ""}</span>
    </span>
    <span className="bg-accent mr-1 grid h-10 w-10 place-items-center rounded-full"><Play size={18} className="ml-0.5 fill-current" /></span>
  </button>;
}

let clipEl: HTMLAudioElement | null = null;
let clipOwner: string | null = null;
function ClipCard({ p, ctx }: { p: Post; ctx: SCtx }) {
  const ep = p.episode!, clip = p.clip!;
  const [on, setOn] = useState(false);
  useEffect(() => () => { if (clipOwner === p.id) { clipEl?.pause(); clipOwner = null; } }, [p.id]);
  const toggle = (e: RMouseEvent) => {
    e.stopPropagation();
    if (!clip.audio) { ctx.play(toShow(ep, p.author.name), toEpisode(ep, p.author.name), clip.s); return; }
    if (!clipEl) clipEl = new Audio();
    if (on) { clipEl.pause(); setOn(false); return; }
    ctx.hush();
    clipEl.src = clip.audio; clipOwner = p.id;
    clipEl.onended = () => setOn(false); clipEl.onpause = () => { if (clipOwner === p.id) setOn(false); };
    void clipEl.play().then(() => setOn(true)).catch(() => ctx.say("That clip can't play right now."));
  };
  const bars = Array.from({ length: 36 }, (_, i) => 30 + Math.round(60 * Math.abs(Math.sin(i * 1.7 + Number(p.id) % 7))));
  return <div className="mt-2.5 overflow-hidden rounded-2xl border line" onClick={(e) => e.stopPropagation()}>
    <div className="flex items-center gap-3 p-3" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, transparent), transparent)" }}>
      <button type="button" onClick={toggle} aria-label={on ? "Pause clip" : "Play clip"} className="bg-accent grid h-12 w-12 flex-none place-items-center rounded-full shadow-lg">{on ? <Pause size={20} className="fill-current" /> : <Play size={20} className="ml-0.5 fill-current" />}</button>
      <div className="flex h-10 flex-1 items-center gap-[3px]" aria-hidden="true">{bars.map((h, i) => <span key={i} className={`w-[3px] flex-1 rounded-full ${on ? "bg-[color:var(--accent)]" : "elev2"}`} style={{ height: `${h}%` }} />)}</div>
      <span className="muted text-[13px] tabular-nums">{clock(clip.e - clip.s)}</span>
    </div>
    {clip.quote && <p className="px-3 pt-2 text-[15px] italic leading-snug">“{clip.quote}”</p>}
    <button type="button" onClick={() => ctx.play(toShow(ep, p.author.name), toEpisode(ep, p.author.name), clip.s)} className="hov flex w-full items-center gap-2.5 p-3 text-left">
      <img src={hiRes(ep.art || "", 120)} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-9 w-9 rounded-lg object-cover elev2" />
      <span className="min-w-0 flex-1"><b className="line-clamp-1 block text-[13px]">{ep.title}</b><span className="muted line-clamp-1 block text-[12px]">{ep.show} · from {clock(clip.s)}</span></span>
      <span className="muted text-[12px] font-bold">Full episode</span>
    </button>
  </div>;
}

/** A gray stand-in while posts load. */
export function PostSkeleton() {
  return <div className="flex gap-3 border-b line px-4 py-4" aria-hidden="true">
    <span className="h-10 w-10 flex-none animate-pulse rounded-full elev2" />
    <div className="flex-1 space-y-2.5 pt-1"><span className="block h-3 w-1/3 animate-pulse rounded elev2" /><span className="block h-3 w-full animate-pulse rounded elev2" /><span className="block h-3 w-4/5 animate-pulse rounded elev2" /><span className="mt-3 block h-40 w-full animate-pulse rounded-2xl elev2" /></div>
  </div>;
}
