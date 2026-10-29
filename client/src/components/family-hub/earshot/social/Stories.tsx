// Stories: the row of circles at the top of Home (a colorful ring means new), a full-screen viewer
// (tap right for next, left for back, hold to pause, swipe down to close, reply to send a message),
// and making one: a photo, a video, words on a color, or an episode you're listening to.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, Headphones, Image as ImageIcon, Loader2, MoreHorizontal, Pause, Play, Plus, Send, Trash2, Type, X } from "lucide-react";
import { hiRes } from "@shared/earshot";
import { toEpisode, toShow } from "../EarshotSocial";
import { ActionSheet, Avatar, Layer, NeedSignIn, shortAgo, uploadMedia, type Media, type Profile, type PostEpisode, type SCtx, type Story, type TrayItem } from "./kit";
import { EpisodeFinder } from "./Composer";

const RING = "conic-gradient(from 210deg, #ff6a1f, #f91880, #a855f7, #ff6a1f)";

export function StoryTray({ tray, me, onOpen, onCreate }: { tray: TrayItem[] | null; me: Profile | null; onOpen: (i: number) => void; onCreate: () => void }) {
  const mine = tray?.find((t) => t.me);
  const others = (tray ?? []).map((t, i) => ({ t, i })).filter((x) => !x.t.me);
  return <div className="noscroll flex gap-3.5 overflow-x-auto border-b line px-4 py-3" aria-label="Stories">
    <div className="flex w-[68px] flex-none flex-col items-center gap-1.5">
      <button type="button" onClick={() => (mine ? onOpen(tray!.indexOf(mine)) : onCreate())} aria-label={mine ? "Your story" : "Add to your story"} className="relative">
        <span className="block rounded-full p-[2.5px]" style={{ background: mine ? RING : "transparent" }}><span className="block rounded-full p-[2px] bg">{me ? <Avatar p={me} size={58} /> : <span className="elev2 block h-[58px] w-[58px] rounded-full" />}</span></span>
        {!mine && <span className="bg-accent absolute bottom-0 right-0 grid h-[22px] w-[22px] place-items-center rounded-full ring-[3px] ring-[color:var(--bg)]"><Plus size={14} strokeWidth={3} /></span>}
      </button>
      {mine && <button type="button" onClick={onCreate} className="sr-only">Add to your story</button>}
      <span className="w-full truncate text-center text-[12px]">Your story</span>
    </div>
    {others.map(({ t, i }) => <button key={t.author.handle} type="button" onClick={() => onOpen(i)} className="flex w-[68px] flex-none flex-col items-center gap-1.5" aria-label={`${t.author.name}'s story${t.unseen ? ", new" : ""}`}>
      <span className="block rounded-full p-[2.5px]" style={{ background: t.unseen ? RING : "var(--line)" }}><span className="block rounded-full p-[2px] bg"><Avatar p={t.author} size={58} /></span></span>
      <span className={`w-full truncate text-center text-[12px] ${t.unseen ? "" : "muted"}`}>{t.author.handle}</span>
    </button>)}
    {tray === null && Array.from({ length: 5 }, (_, i) => <span key={i} className="flex w-[68px] flex-none flex-col items-center gap-1.5"><span className="elev2 block h-[66px] w-[66px] animate-pulse rounded-full" /><span className="elev2 block h-2.5 w-12 animate-pulse rounded" /></span>)}
  </div>;
}

/** Full-screen stories, person after person. */
export function StoryViewer({ tray, start, ctx, onClose, onSeen, onDeleted, onCreate }: { tray: TrayItem[]; start: number; ctx: SCtx; onClose: () => void; onSeen: (storyId: string) => void; onDeleted: (storyId: string) => void; onCreate: () => void }) {
  const [who, setWho] = useState(start);
  const [k, setK] = useState(() => Math.max(0, tray[start]?.stories.findIndex((s) => !s.seen) ?? 0));
  const [paused, setPaused] = useState(false);
  const [pct, setPct] = useState(0);
  const [reply, setReply] = useState("");
  const [menu, setMenu] = useState(false);
  const [viewers, setViewers] = useState<Profile[] | null>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const group = tray[who], story = group?.stories[k];
  const next = useCallback(() => {
    if (!group) return onClose();
    if (k < group.stories.length - 1) { setK(k + 1); setPct(0); return; }
    if (who < tray.length - 1) { setWho(who + 1); setK(Math.max(0, tray[who + 1].stories.findIndex((s) => !s.seen))); setPct(0); return; }
    onClose();
  }, [group, k, who, tray, onClose]);
  const prev = () => { if (k > 0) { setK(k - 1); setPct(0); } else if (who > 0) { setWho(who - 1); setK(0); setPct(0); } else setPct(0); };
  useEffect(() => { if (story && !story.seen && !group.me) { onSeen(story.id); void ctx.api(`/api/earshot/social/stories/${story.id}/view`, { method: "POST" }).catch(() => {}); } }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Photos and words show for 6 seconds, episodes 8, videos as long as they run (up to 60).
  useEffect(() => {
    if (!story || paused || story.media?.type === "video") return;
    const total = story.episode ? 8000 : 6000, t0 = Date.now() - pct * total;
    const t = setInterval(() => { const p = (Date.now() - t0) / total; if (p >= 1) { clearInterval(t); next(); } else setPct(p); }, 50);
    return () => clearInterval(t);
  }, [story?.id, paused, next]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const v = vid.current; if (!v) return; if (paused) v.pause(); else void v.play().catch(() => {}); }, [paused, story?.id]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); });
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  if (!group || !story) return null;
  const sendReply = () => {
    const body = reply.trim(); if (!body || ctx.needProfile()) return;
    ctx.api("/api/earshot/social/dm/with", { method: "POST", body: { handle: group.author.handle } })
      .then((b) => ctx.api(`/api/earshot/social/dm/${b.thread.id}/messages`, { method: "POST", body: { body: `Replied to your story: ${body}` } }))
      .then(() => { setReply(""); ctx.say("Sent."); }).catch((e) => ctx.say(e.message));
  };
  const remove = () => ctx.api(`/api/earshot/social/stories/${story.id}`, { method: "DELETE" }).then(() => { onDeleted(story.id); ctx.say("Story deleted."); if (group.stories.length <= 1) onClose(); }).catch((e) => ctx.say(e.message));
  const report = () => ctx.api(`/api/earshot/social/stories/${story.id}/report`, { method: "POST" }).then(() => { ctx.say("Thanks. We'll take a look."); next(); }).catch((e) => ctx.say(e.message));

  return <Layer><div className="fade absolute inset-0 z-[95] flex items-center justify-center bg-black text-white" role="dialog" aria-label={`${group.author.name}'s story`}>
    <div className="relative h-full w-full max-w-[460px] overflow-hidden sm:my-6 sm:h-[calc(100%-3rem)] sm:rounded-2xl">
      {/* What's in the story */}
      {story.media?.type === "image" && <img src={story.media.url} alt="" className="absolute inset-0 h-full w-full object-contain" />}
      {story.media?.type === "video" && <video ref={vid} key={story.id} src={story.media.url} autoPlay playsInline className="absolute inset-0 h-full w-full object-contain"
        onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setPct(Math.min(1, v.currentTime / Math.min(60, v.duration))); if (v.currentTime >= 60) next(); }} onEnded={next} />}
      {!story.media && !story.episode && <div className="absolute inset-0 grid place-items-center p-8" style={{ background: `linear-gradient(160deg, ${story.bg}, color-mix(in srgb, ${story.bg} 55%, #000))` }}><p className="whitespace-pre-wrap break-words text-center text-[28px] font-bold leading-tight drop-shadow">{story.body}</p></div>}
      {story.episode && <EpisodeStory ep={story.episode} body={story.body} ctx={ctx} author={group.author} onPlay={onClose} />}
      {story.media && story.body && <p className="absolute inset-x-6 bottom-28 whitespace-pre-wrap break-words rounded-2xl bg-black/50 px-4 py-3 text-center text-[18px] font-semibold backdrop-blur">{story.body}</p>}
      {/* Tap zones: left back, right next; hold anywhere to pause */}
      <div className="absolute inset-0 z-[1]"
        onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY, t: Date.now() }; setPaused(true); }}
        onPointerUp={(e) => {
          const d0 = down.current; down.current = null; setPaused(false);
          if (!d0) return;
          if (e.clientY - d0.y > 90) return onClose();
          if (Date.now() - d0.t > 350) return;
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          if (e.clientX - r.left < r.width * 0.33) prev(); else next();
        }} onPointerCancel={() => { down.current = null; setPaused(false); }} />
      {/* Progress and who */}
      <div className="absolute inset-x-0 top-0 z-[2] bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-[max(.6rem,env(safe-area-inset-top))]">
        <div className="flex gap-1">{group.stories.map((s, i) => <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35"><span className="block h-full bg-white" style={{ width: `${i < k ? 100 : i === k ? pct * 100 : 0}%` }} /></span>)}</div>
        <div className="mt-3 flex items-center gap-2.5">
          <button type="button" onClick={() => { onClose(); ctx.openProfile(group.author.handle); }} className="flex min-w-0 items-center gap-2.5"><Avatar p={group.author} size={34} /><b className="truncate text-[15px]">{group.me ? "Your story" : group.author.name}</b></button>
          <span className="text-[14px] text-white/70">{shortAgo(story.at)}</span>
          <span className="flex-1" />
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"} className="grid h-9 w-9 place-items-center rounded-full">{paused ? <Play size={20} className="fill-white" /> : <Pause size={20} className="fill-white" />}</button>
          <button type="button" onClick={() => { setPaused(true); setMenu(true); }} aria-label="More" className="grid h-9 w-9 place-items-center rounded-full"><MoreHorizontal size={22} /></button>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full"><X size={24} /></button>
        </div>
      </div>
      {/* Reply, or (yours) who saw it */}
      <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-[max(.9rem,env(safe-area-inset-bottom))] pt-10">
        {group.me ? <>
          <button type="button" onClick={() => { setPaused(true); ctx.api(`/api/earshot/social/stories/${story.id}/viewers`).then((b) => setViewers(b.people || [])).catch(() => setViewers([])); }} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[14px] font-semibold"><Eye size={18} />{story.views ?? 0} {story.views === 1 ? "view" : "views"}</button>
          <span className="flex-1" />
          <button type="button" onClick={() => { onClose(); onCreate(); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/15 px-4 text-[14px] font-bold backdrop-blur"><Plus size={16} />Add</button>
        </> : <form className="flex flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); sendReply(); }}>
          <input value={reply} onChange={(e) => setReply(e.target.value.slice(0, 500))} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} placeholder={`Reply to ${group.author.name.split(" ")[0]}…`} aria-label="Reply" className="min-h-11 flex-1 rounded-full border border-white/40 bg-black/30 px-4 text-[15px] text-white outline-none placeholder:text-white/60" />
          <button type="submit" disabled={!reply.trim()} aria-label="Send" className="grid h-11 w-11 place-items-center rounded-full disabled:opacity-40"><Send size={22} /></button>
        </form>}
      </div>
    </div>
    {menu && <ActionSheet onClose={() => { setMenu(false); setPaused(false); }} items={group.me ? [{ label: "Delete story", icon: <Trash2 size={18} />, danger: true, onClick: remove }] : [{ label: "Report story", danger: true, onClick: report }]} />}
    {viewers && <div className="fade absolute inset-0 z-[96] flex items-end justify-center bg-black/50" onClick={() => { setViewers(null); setPaused(false); }}>
      <div className="rise surface fg max-h-[70%] w-full max-w-[460px] overflow-y-auto rounded-t-3xl p-3" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 pb-2 text-[17px] font-bold">Viewers</p>
        {!viewers.length && <p className="muted px-2 py-6 text-center">No one has seen this yet.</p>}
        {viewers.map((p) => <button key={p.handle} type="button" onClick={() => { onClose(); ctx.openProfile(p.handle); }} className="hov flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"><Avatar p={p} size={40} /><span className="min-w-0"><b className="block truncate text-[15px]">{p.name}</b><span className="muted block truncate text-[13px]">@{p.handle}</span></span></button>)}
      </div>
    </div>}
  </div></Layer>;
}

function EpisodeStory({ ep, body, ctx, author, onPlay }: { ep: PostEpisode; body: string; ctx: SCtx; author: Profile; onPlay: () => void }) {
  return <div className="absolute inset-0 grid place-items-center overflow-hidden p-8">
    <img src={hiRes(ep.art, 600)} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl" />
    <div className="relative z-[3] flex w-full max-w-[300px] flex-col items-center text-center">
      <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-[13px] font-semibold backdrop-blur"><Headphones size={14} />Listening now</p>
      <img src={hiRes(ep.art, 600)} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-2xl object-cover shadow-[0_20px_60px_rgba(0,0,0,.55)]" />
      <b className="mt-4 line-clamp-2 text-[20px] leading-tight drop-shadow">{ep.title}</b>
      <span className="mt-1 text-[14px] text-white/80">{ep.show}</span>
      {body && <p className="mt-3 text-[16px] font-semibold">{body}</p>}
      <button type="button" onClick={() => { onPlay(); ctx.play(toShow(ep, author.name), toEpisode(ep, author.name)); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-black"><Play size={17} className="fill-black" />Listen</button>
    </div>
  </div>;
}

/** Make a story: pick a photo/video, write on a color, or share an episode. */
export function StoryMaker({ ctx, onClose, onPosted }: { ctx: SCtx; onClose: () => void; onPosted: (s: Story) => void }) {
  const [mode, setMode] = useState<"pick" | "text" | "media" | "episode">("pick");
  const [file, setFile] = useState<{ preview: string; video: boolean; media?: Media; pct: number } | null>(null);
  const [body, setBody] = useState("");
  const [bg, setBg] = useState("#7c3aed");
  const [episode, setEpisode] = useState<PostEpisode | null>(null);
  const [findEp, setFindEp] = useState(false);
  const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const COLORS = ["#7c3aed", "#ff6a1f", "#e11d48", "#0ea5e9", "#10b981", "#111827", "#f59e0b", "#db2777"];
  const choose = async (f: File | undefined) => {
    if (!f) return;
    const video = f.type.startsWith("video/") || /\.(mov|mp4|webm)$/i.test(f.name);
    setFile({ preview: URL.createObjectURL(f), video, pct: 0 }); setMode("media");
    try { const media = await uploadMedia(ctx.api, f, (pct) => setFile((x) => (x ? { ...x, pct } : x))); setFile((x) => (x ? { ...x, media, pct: 1 } : x)); }
    catch (e: any) {
      if (e instanceof NeedSignIn) { setFile(null); setMode("pick"); if (await ctx.signIn()) void choose(f); return; }
      ctx.say(e?.message || "That didn't upload."); setFile(null); setMode("pick");
    }
  };
  const share = () => {
    if (busy) return;
    const payload: any = mode === "text" ? { body, bg } : mode === "episode" ? { episode, body } : { media: file?.media ? [file.media] : [], body };
    setBusy(true);
    ctx.api("/api/earshot/social/stories", { method: "POST", body: payload }).then((b) => { onPosted(b.story); ctx.say("Added to your story."); onClose(); }).catch((e) => ctx.say(e.message)).finally(() => setBusy(false));
  };
  const ready = mode === "text" ? !!body.trim() : mode === "episode" ? !!episode : !!file?.media;
  return <Layer><div className="fade absolute inset-0 z-[95] flex items-center justify-center bg-black text-white" role="dialog" aria-label="New story">
    <div className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden sm:my-6 sm:h-[calc(100%-3rem)] sm:rounded-2xl" style={mode === "text" ? { background: `linear-gradient(160deg, ${bg}, color-mix(in srgb, ${bg} 55%, #000))` } : { background: "#0b0b0d" }}>
      <div className="z-[2] flex items-center justify-between px-3 pt-[max(.7rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-black/30"><X size={22} /></button>
        {mode !== "pick" && <button type="button" onClick={share} disabled={!ready || busy} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-black disabled:opacity-40">{busy && <Loader2 size={15} className="animate-spin" />}Share to story</button>}
      </div>
      {mode === "pick" && <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8">
        <p className="mb-4 text-[24px] font-extrabold">Add to your story</p>
        <input ref={pick} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" className="hidden" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        <Choice icon={<ImageIcon size={22} />} label="Photo or video" sub="From your camera roll" onClick={() => pick.current?.click()} />
        <Choice icon={<Type size={22} />} label="Words" sub="Say something on a color" onClick={() => setMode("text")} />
        <Choice icon={<Headphones size={22} />} label="What you're listening to" sub="Share an episode" onClick={() => { setMode("episode"); setFindEp(true); }} />
        <p className="mt-4 text-center text-[13px] text-white/50">Stories disappear after 24 hours.</p>
      </div>}
      {mode === "text" && <div className="flex flex-1 flex-col items-center justify-center px-6">
        <textarea autoFocus value={body} onChange={(e) => setBody(e.target.value.slice(0, 200))} rows={4} placeholder="Type something…" aria-label="Story text" className="w-full resize-none bg-transparent text-center text-[28px] font-bold leading-tight text-white outline-none placeholder:text-white/60" />
        <div className="mt-6 flex gap-2.5">{COLORS.map((c) => <button key={c} type="button" onClick={() => setBg(c)} aria-label={`Color ${c}`} aria-pressed={bg === c} className={`h-8 w-8 rounded-full ring-2 ${bg === c ? "ring-white" : "ring-white/30"}`} style={{ background: c }} />)}</div>
      </div>}
      {mode === "media" && file && <div className="relative flex-1">
        {file.video ? <video src={file.preview} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-contain" /> : <img src={file.preview} alt="" className="absolute inset-0 h-full w-full object-contain" />}
        {!file.media && <div className="absolute inset-x-6 top-4 h-1.5 overflow-hidden rounded-full bg-white/25"><div className="h-full bg-white transition-[width]" style={{ width: `${Math.round(file.pct * 100)}%` }} /></div>}
        <input value={body} onChange={(e) => setBody(e.target.value.slice(0, 200))} placeholder="Add a caption…" aria-label="Caption" className="absolute inset-x-5 bottom-[max(1.2rem,env(safe-area-inset-bottom))] min-h-12 rounded-full bg-black/50 px-5 text-[16px] text-white outline-none backdrop-blur placeholder:text-white/60" />
      </div>}
      {mode === "episode" && <div className="flex flex-1 flex-col items-center justify-center px-8">
        {episode ? <><img src={hiRes(episode.art, 500)} alt="" referrerPolicy="no-referrer" className="aspect-square w-full max-w-[280px] rounded-2xl object-cover shadow-2xl" /><b className="mt-4 line-clamp-2 text-center text-[19px]">{episode.title}</b><span className="mt-1 text-[14px] text-white/70">{episode.show}</span>
          <input value={body} onChange={(e) => setBody(e.target.value.slice(0, 200))} placeholder="Say something about it…" aria-label="Caption" className="mt-5 min-h-12 w-full rounded-full bg-white/10 px-5 text-[16px] text-white outline-none placeholder:text-white/50" />
          <button type="button" onClick={() => setFindEp(true)} className="mt-3 text-[14px] font-semibold text-white/70 underline">Pick a different episode</button></>
          : <button type="button" onClick={() => setFindEp(true)} className="rounded-full bg-white px-6 py-3 font-bold text-black">Find an episode</button>}
      </div>}
    </div>
    {findEp && <EpisodeFinder z={97} ctx={ctx} onPick={(e) => { setEpisode(e); setFindEp(false); }} onClose={() => { setFindEp(false); if (!episode) setMode("pick"); }} />}
  </div></Layer>;
}
const Choice = ({ icon, label, sub, onClick }: { icon: ReactNode; label: string; sub: string; onClick: () => void }) =>
  <button type="button" onClick={onClick} className="flex min-h-[64px] w-full max-w-[320px] items-center gap-4 rounded-2xl bg-white/[.08] px-4 text-left transition hover:bg-white/[.14]">
    <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white/10">{icon}</span>
    <span><b className="block text-[16px]">{label}</b><span className="text-[13px] text-white/60">{sub}</span></span>
  </button>;
