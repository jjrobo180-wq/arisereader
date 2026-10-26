// Social, the X way: one timeline of posts (For you / Following), threads you open to read and reply
// in, a floating button to post, and a bottom bar for home, people, notifications and you. Same posts,
// comments and server (server/podcastSocial.ts) as the Clips + Feed style in EarshotSocial.tsx; the
// listener picks the style they like.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Bell, Feather, Flag, Heart, Home, Loader2, MessageCircle, Mic, MoreHorizontal, Play, Repeat2, Search, Share2, Trash2, User } from "lucide-react";
import { durationWords, hiRes } from "@shared/earshot";
import {
  ACCENT, Avatar, ClipInline, ClipsFeed, NotesSheet, PersonPage, ProfileEditor, RepostSheet, SearchSheet, UploadSheet, ago, artOf, compact, shareLink, shown, toEpisode, toShow, useClipAudio,
  type Api, type Comment, type Ctx, type PlayFn, type Post, type Profile,
} from "./EarshotSocial";

/** Each action's color: on, on hover, and its hover halo. */
const HUES = {
  sky: ["text-sky-400", "hover:text-sky-400", "group-hover:bg-sky-400/10"],
  green: ["text-emerald-400", "hover:text-emerald-400", "group-hover:bg-emerald-400/10"],
  pink: ["text-pink-500", "hover:text-pink-500", "group-hover:bg-pink-500/10"],
  orange: ["text-orange-400", "hover:text-orange-400", "group-hover:bg-orange-400/10"],
} as const;
const LINE = "border-white/[.09]", GREY = "text-[#8b8f95]";
type Patch = (id: string, f: (p: Post) => Post) => void;
type Open = null | { kind: "compose"; quote?: Post } | { kind: "thread"; post: Post } | { kind: "repost"; post: Post } | { kind: "notes" } | { kind: "search" } | { kind: "edit" } | { kind: "upload" };
const longTime = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : `${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`; };

export function XSocial({ api, say, onPlay, onHush }: { api: Api; say: (m: string) => void; onPlay: PlayFn; onHush?: () => void }) {
  const [me, setMe] = useState<{ profile: Profile | null; unread?: number; avatars: string[]; v2?: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"all" | "following" | "clips">("all");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [people, setPeople] = useState<string[]>([]);
  const list = useRef<HTMLDivElement | null>(null);
  const audio = useClipAudio(onHush);
  const loadMe = useCallback(() => api("/api/earshot/social/me").then((b) => { setMe(b); setErr(""); }).catch((e) => setErr(e?.message || "Social didn't load.")), [api]);
  const load = useCallback(() => { setPosts(null); api(`/api/earshot/social/feed?tab=${tab}`).then((b) => setPosts(b.posts || [])).catch((e) => { setPosts([]); say(e?.message || "The timeline didn't load."); }); }, [api, tab, say]);
  useEffect(() => { void loadMe(); }, [loadMe]);
  useEffect(() => { load(); }, [load]);
  const patch: Patch = useCallback((id, f) => setPosts((l) => l?.map((p) => (p.id === id ? f(p) : p.repost?.id === id ? { ...p, repost: f(p.repost) } : p)) ?? null), []);
  const needProfile = () => { say("Make your profile first. It takes a few seconds."); setOpen({ kind: "edit" }); };
  const ctx: Ctx = {
    api, say, onPlay, audio, me: me?.profile ?? null,
    person: (h) => setPeople((s) => [...s, h]),
    comments: (post) => setOpen({ kind: "thread", post }),
    repost: (post) => (me?.profile ? setOpen({ kind: "repost", post }) : needProfile()),
    needProfile,
  };
  const home = () => { setPeople([]); setOpen(null); if (list.current && list.current.scrollTop > 40) list.current.scrollTo({ top: 0, behavior: "smooth" }); else load(); };

  if (err && !me) return <div className="grid h-full place-items-center bg-black p-6 pt-16 text-center"><div><p className="text-lg font-bold">Social</p><p className={`mt-1 max-w-xs text-sm ${GREY}`}>{err}</p><button type="button" onClick={() => { void loadMe(); }} className="mt-4 min-h-11 rounded-full bg-white px-5 font-bold text-black">Try again</button></div></div>;
  if (!me) return <div className="grid h-full place-items-center bg-black"><Loader2 className="animate-spin" /></div>;
  const unread = me.unread ?? 0;

  return <div className="relative flex h-full flex-col bg-black pt-16">
      {/* The header and tabs stay put while the timeline scrolls under them. */}
      <div className={`z-10 flex-none border-b ${LINE} bg-black`}>
        <div className="flex items-center gap-2 px-4 pb-1 pt-1">
          <button type="button" onClick={() => (me.profile ? ctx.person(me.profile.handle) : setOpen({ kind: "edit" }))} aria-label="Your profile">{me.profile ? <Avatar p={me.profile} size={32} /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><User size={16} /></span>}</button>
          <span className="mx-auto text-[19px] font-black tracking-tight">Pod<span style={{ color: ACCENT }}>+</span></span>
          <button type="button" onClick={() => setOpen({ kind: "search" })} aria-label="Find people" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><Search size={19} /></button>
        </div>
        <div className="flex" role="tablist">
          {([["all", "For you"], ["following", "Following"], ["clips", "Clips"]] as const).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => (tab === v ? home() : setTab(v))} className={`relative flex-1 py-3.5 text-[15px] ${tab === v ? "font-bold text-white" : `font-medium ${GREY}`} hover:bg-white/[.03]`}>
            {l}{tab === v && <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full" style={{ background: ACCENT }} />}
          </button>)}
        </div>
      </div>
    {tab === "clips" ? <div className="flex min-h-0 flex-1 flex-col pb-14"><ClipsFeed posts={posts} ctx={ctx} setup={me.v2 === false} onRefresh={load} /></div>
    : <div ref={list} className="min-h-0 flex-1 overflow-y-auto pb-24 [scrollbar-width:none] mx-auto w-full max-w-2xl">

      {!me.profile && <div className={`border-b ${LINE} px-4 py-5`}>
        <p className="text-[22px] font-extrabold leading-tight">See what listeners are saying.</p>
        <p className={`mt-1 text-[15px] ${GREY}`}>Make a profile to post, reply, repost and follow.</p>
        <button type="button" onClick={() => setOpen({ kind: "edit" })} className="mt-3 min-h-10 rounded-full bg-white px-5 text-[15px] font-bold text-black">Create profile</button>
      </div>}
      {me.profile && <button type="button" onClick={() => setOpen({ kind: "compose" })} className={`flex w-full gap-3 border-b ${LINE} px-4 py-3 text-left`}>
        <Avatar p={me.profile} size={40} /><span className={`flex-1 pt-2 text-[19px] ${GREY}`}>What are you listening to?</span>
      </button>}

      {!posts && <div className="grid place-items-center py-10"><Loader2 className="animate-spin" style={{ color: ACCENT }} /></div>}
      {posts && !posts.length && <div className="px-8 py-14 text-center"><p className="text-[28px] font-extrabold leading-tight">{tab === "following" ? "Nobody here yet" : "Be the first to post"}</p><p className={`mt-2 text-[15px] ${GREY}`}>{tab === "following" ? "Follow people and their posts show up here." : "Say what you're listening to, or clip a moment: play an episode, tap Share, then Clip a moment."}</p></div>}
      {posts?.map((p) => <XPost key={p.id} post={p} ctx={ctx} patch={patch} onOpen={(x) => setOpen({ kind: "thread", post: x })} onGone={() => setPosts((l) => (l || []).filter((x) => x.id !== p.id && x.repost?.id !== p.id))} />)}
    </div>}

    {/* Post */}
    {!open && !people.length && tab !== "clips" && <button type="button" onClick={() => (me.profile ? setOpen({ kind: "compose" }) : setOpen({ kind: "edit" }))} aria-label="Post"
      className="absolute bottom-[4.5rem] right-4 z-20 grid h-14 w-14 place-items-center rounded-full text-black shadow-[0_6px_24px_rgba(0,0,0,.6)] active:scale-95" style={{ background: ACCENT }}><Feather size={23} strokeWidth={2.2} /></button>}

    {/* Bottom bar */}
    <nav className={`absolute inset-x-0 bottom-0 z-[45] flex h-14 border-t ${LINE} bg-black/90 backdrop-blur-xl`} aria-label="Social">
      <NavBtn label="Home" on={!open && !people.length} onClick={home}><Home size={25} strokeWidth={!open && !people.length ? 2.6 : 1.8} /></NavBtn>
      <NavBtn label="Find people" on={open?.kind === "search"} onClick={() => { setPeople([]); setOpen({ kind: "search" }); }}><Search size={24} strokeWidth={open?.kind === "search" ? 2.8 : 1.8} /></NavBtn>
      <NavBtn label="Make a podcast" on={open?.kind === "upload"} onClick={() => (me.profile ? setOpen({ kind: "upload" }) : setOpen({ kind: "edit" }))}><Mic size={24} strokeWidth={1.8} /></NavBtn>
      <NavBtn label={unread ? `Notifications, ${unread} new` : "Notifications"} on={open?.kind === "notes"} onClick={() => { setPeople([]); setOpen({ kind: "notes" }); }}>
        <Bell size={24} strokeWidth={open?.kind === "notes" ? 2.6 : 1.8} />{unread > 0 && open?.kind !== "notes" && <span className="absolute left-1/2 top-1.5 ml-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-black" style={{ background: ACCENT }}>{unread > 99 ? "99+" : unread}</span>}
      </NavBtn>
      <NavBtn label="You" on={!!me.profile && people[people.length - 1] === me.profile.handle} onClick={() => { setOpen(null); me.profile ? setPeople([me.profile.handle]) : setOpen({ kind: "edit" }); }}><User size={24} strokeWidth={1.8} /></NavBtn>
    </nav>

    {people.length > 0 && <PersonPage key={people[people.length - 1]} handle={people[people.length - 1]} ctx={ctx} patch={patch} onEdit={() => setOpen({ kind: "edit" })} onClose={() => setPeople((s) => s.slice(0, -1))}
      row={(p, pt, gone) => <XPost post={p} ctx={ctx} patch={pt} onOpen={(x) => setOpen({ kind: "thread", post: x })} onGone={gone} />} />}
    {open?.kind === "thread" && <Thread post={open.post} ctx={ctx} patch={patch} onClose={() => setOpen(null)} onOpen={(x) => setOpen({ kind: "thread", post: x })} />}
    {open?.kind === "compose" && <Compose api={api} say={say} me={me.profile} quote={open.quote} onClose={() => setOpen(null)} onPosted={(p) => { setOpen(null); if (p) setPosts((l) => [p, ...(l || [])]); if (open.quote) patch(open.quote.id, (x) => ({ ...x, reposts: x.reposts + 1 })); }} />}
    {open?.kind === "repost" && <RepostSheet post={open.post} ctx={ctx} onClose={() => setOpen(null)} onDone={(on, quote) => { patch(open.post.id, (p) => ({ ...p, reposted: on, reposts: Math.max(0, p.reposts + (on ? 1 : -1)) })); setOpen(null); if (quote) setPosts((l) => [quote, ...(l || [])]); }} />}
    {open?.kind === "notes" && <div className="absolute inset-x-0 bottom-14 top-0 z-40"><NotesSheet api={api} onClose={() => { setOpen(null); setMe((m) => (m ? { ...m, unread: 0 } : m)); }} onPost={(id) => { api(`/api/earshot/social/posts/${id}`).then((b) => b.post && setOpen({ kind: "thread", post: b.post })).catch((e) => say(e.message)); }} onPerson={(h) => { setOpen(null); ctx.person(h); }} /></div>}
    {open?.kind === "search" && <SearchSheet api={api} say={say} onClose={() => setOpen(null)} onPerson={(h) => { setOpen(null); ctx.person(h); }} needProfile={!me.profile} />}
    {open?.kind === "edit" && <ProfileEditor api={api} say={say} initial={me.profile} avatars={me.avatars} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void loadMe(); }} />}
    {open?.kind === "upload" && <UploadSheet api={api} say={say} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); }} />}
  </div>;
}

const NavBtn = ({ label, on, onClick, children }: { label: string; on?: boolean; onClick: () => void; children: ReactNode }) =>
  <button type="button" aria-label={label} aria-current={on ? "page" : undefined} onClick={onClick} className={`relative grid flex-1 place-items-center ${on ? "text-white" : "text-white/70"}`}>{children}</button>;

// ===========================================================================
// One post in the timeline
// ===========================================================================
function XPost({ post, ctx, patch, onOpen, onGone }: { post: Post; ctx: Ctx; patch: Patch; onOpen: (p: Post) => void; onGone: () => void }) {
  const p = shown(post), plain = p !== post;
  const [menu, setMenu] = useState(false);
  const stop = (f: () => void) => (e: { stopPropagation: () => void }) => { e.stopPropagation(); f(); };
  const remove = () => { setMenu(false); ctx.api(`/api/earshot/social/posts/${plain ? p.id : post.id}${plain ? "/repost" : ""}`, plain ? { method: "POST", body: { on: false } } : { method: "DELETE" }).then(() => { ctx.say(plain ? "Repost undone." : "Your post was deleted."); onGone(); }).catch((e) => ctx.say(e.message)); };
  const report = () => { setMenu(false); ctx.api(`/api/earshot/social/posts/${p.id}/report`, { method: "POST" }).then(() => { ctx.say("Reported. Thanks."); onGone(); }).catch((e) => ctx.say(e.message)); };
  return <article onClick={() => onOpen(p)} className={`cursor-pointer border-b ${LINE} px-4 pb-1 pt-3 transition-colors hover:bg-white/[.025]`}>
    {plain && <p className={`mb-1 flex items-center gap-2 pl-[30px] text-[13px] font-bold ${GREY}`}><Repeat2 size={15} />{post.mine ? "You" : post.author.name} reposted</p>}
    <div className="flex gap-3">
      <div onClick={stop(() => ctx.person(p.author.handle))}><Avatar p={p.author} size={40} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[15px] leading-5">
          <button type="button" onClick={stop(() => ctx.person(p.author.handle))} className="min-w-0 truncate font-bold hover:underline">{p.author.name}</button>
          <span className={`min-w-0 truncate ${GREY}`}>@{p.author.handle}</span><span className={`flex-none ${GREY}`}>· {ago(p.at)}</span>
          <div className="relative ml-auto flex-none">
            <button type="button" onClick={stop(() => setMenu((m) => !m))} aria-label="More" className={`-my-1 -mr-2 grid h-8 w-8 place-items-center rounded-full ${GREY} hover:bg-white/10`}><MoreHorizontal size={18} /></button>
            {menu && <div onClick={(e) => e.stopPropagation()} onMouseLeave={() => setMenu(false)} className="absolute right-0 top-8 z-20 w-52 overflow-hidden rounded-xl bg-black text-[15px] font-bold shadow-[0_0_18px_rgba(255,255,255,.18)]">
              {(plain ? post.mine : p.mine) ? <button type="button" onClick={remove} className="flex w-full items-center gap-3 px-4 py-3 text-left text-rose-500 hover:bg-white/5"><Trash2 size={18} />{plain ? "Undo repost" : "Delete"}</button>
                : <button type="button" onClick={report} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"><Flag size={18} />Report post</button>}
            </div>}
          </div>
        </div>
        <XBody post={p} ctx={ctx} />
        <XActions post={p} ctx={ctx} patch={patch} onReply={() => onOpen(p)} />
      </div>
    </div>
  </article>;
}

/** A post's words and what it carries: a clip, an episode card, or the post it quotes. */
function XBody({ post: p, ctx, big, nested }: { post: Post; ctx: Ctx; big?: boolean; nested?: boolean }) {
  const ep = p.episode;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return <div>
    {p.caption && <p className={`whitespace-pre-wrap break-words ${big ? "mt-3 text-[17px] leading-6" : "mt-0.5 text-[15px] leading-5"} ${nested ? "line-clamp-4" : ""}`}>{p.caption}</p>}
    {p.kind === "clip" && p.clip && ep && <div onClick={stop}><ClipInline post={p} ctx={ctx} /></div>}
    {(p.kind === "share" || p.kind === "own" || p.kind === "bookmark") && ep && <button type="button" onClick={(e) => { stop(e); ctx.onPlay(toShow(ep, p.author.name), toEpisode(ep, p.author.name)); }} className={`mt-3 block w-full overflow-hidden rounded-2xl border ${LINE} text-left`}>
      <span className="relative block aspect-[2/1] overflow-hidden">
        <span aria-hidden className="absolute -inset-6 bg-cover bg-center blur-2xl" style={{ backgroundImage: `url("${hiRes(artOf(ep), 200)}")` }} />
        <span className="absolute inset-0 bg-black/30" />
        <img src={hiRes(artOf(ep), 400)} alt="" referrerPolicy="no-referrer" className="absolute left-1/2 top-1/2 h-[78%] -translate-x-1/2 -translate-y-1/2 rounded-xl object-cover shadow-2xl" />
        <span className="absolute bottom-2.5 right-2.5 grid h-10 w-10 place-items-center rounded-full bg-white text-black"><Play size={17} fill="currentColor" strokeWidth={0} className="ml-0.5" /></span>
      </span>
      <span className={`block border-t ${LINE} px-3 py-2.5`}><span className={`block text-[13px] ${GREY}`}>{p.kind === "own" ? `Made by @${p.author.handle}` : ep.show}{ep.secs > 0 ? ` · ${durationWords(ep.secs)}` : ""}</span><span className="line-clamp-2 block text-[15px] leading-5">{ep.title}</span></span>
    </button>}
    {p.kind === "repost" && p.repost && <div onClick={(e) => { stop(e); ctx.comments(p.repost!); }} className={`mt-3 rounded-2xl border ${LINE} px-3 py-2.5 hover:bg-white/[.03]`}>
      <div className="flex items-center gap-1.5 text-[15px]"><Avatar p={p.repost.author} size={20} /><b className="truncate">{p.repost.author.name}</b><span className={`truncate ${GREY}`}>@{p.repost.author.handle} · {ago(p.repost.at)}</span></div>
      <XBody post={p.repost} ctx={ctx} nested />
    </div>}
  </div>;
}

function XActions({ post: p, ctx, patch, onReply, wide }: { post: Post; ctx: Ctx; patch: Patch; onReply: () => void; wide?: boolean }) {
  const like = () => { if (!ctx.me) return ctx.needProfile(); const on = !p.liked; patch(p.id, (x) => ({ ...x, liked: on, likes: Math.max(0, x.likes + (on ? 1 : -1)) })); ctx.api(`/api/earshot/social/posts/${p.id}/like`, { method: "POST", body: { on } }).catch(() => {}); };
  const btn = (label: string, n: number | undefined, on: boolean, hue: keyof typeof HUES, onClick: () => void, icon: ReactNode) =>
    <button type="button" aria-label={label} aria-pressed={on} onClick={(e) => { e.stopPropagation(); onClick(); }} className={`group flex min-h-10 items-center gap-1 text-[13px] tabular-nums transition-colors ${on ? HUES[hue][0] : GREY} ${HUES[hue][1]}`}>
      <span className={`grid h-[34px] w-[34px] place-items-center rounded-full transition-colors ${HUES[hue][2]}`}>{icon}</span>{n ? compact(n) : ""}
    </button>;
  return <div className={`-ml-2 flex items-center justify-between ${wide ? "py-0.5" : "max-w-[420px] pr-2"}`}>
    {btn("Reply", p.comments, false, "sky", onReply, <MessageCircle size={wide ? 21 : 18} />)}
    {btn("Repost", p.reposts, p.reposted, "green", () => ctx.repost(p), <Repeat2 size={wide ? 22 : 19} />)}
    {btn("Like", p.likes, p.liked, "pink", like, <Heart size={wide ? 21 : 18} className={p.liked ? "fill-pink-500" : ""} />)}
    {btn("Share", undefined, false, "sky", () => shareLink(ctx, p), <Share2 size={wide ? 20 : 17} />)}
  </div>;
}

// ===========================================================================
// A post, opened: the whole thing, its numbers, and the replies under it
// ===========================================================================
function Thread({ post: first, ctx, patch, onClose, onOpen }: { post: Post; ctx: Ctx; patch: Patch; onClose: () => void; onOpen: (p: Post) => void }) {
  const [post, setPost] = useState(first);
  const [list, setList] = useState<Comment[] | null>(null);
  const [setup, setSetup] = useState(false);
  const [body, setBody] = useState("");
  const [to, setTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { setPost(first); }, [first]);
  useEffect(() => {
    ctx.api(`/api/earshot/social/posts/${first.id}`).then((b) => b.post && setPost(b.post)).catch(() => {});
    ctx.api(`/api/earshot/social/posts/${first.id}/comments`).then((b) => { setList(b.comments || []); setSetup(!!b.setup); }).catch(() => setList([]));
  }, [first.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const local: Patch = (id, f) => { setPost((p) => (p.id === id ? f(p) : p)); patch(id, f); };
  const count = (n: number) => local(post.id, (p) => ({ ...p, comments: n }));
  const top = useMemo(() => (list || []).filter((c) => !c.parentId), [list]);
  const under = (id: string) => (list || []).filter((c) => c.parentId === id);
  const byId = useMemo(() => new Map((list || []).map((c) => [c.id, c])), [list]);
  const send = () => {
    if (!ctx.me) return ctx.needProfile();
    const text = body.trim(); if (!text) return;
    setBusy(true);
    ctx.api(`/api/earshot/social/posts/${post.id}/comments`, { method: "POST", body: { body: text, parent: to?.id } })
      .then((b) => { setList((l) => { const next = [...(l || []), b.comment]; count(next.length); return next; }); setBody(""); setTo(null); })
      .catch((e) => ctx.say(e.message)).finally(() => setBusy(false));
  };
  const like = (c: Comment) => { if (!ctx.me) return ctx.needProfile(); const on = !c.liked; setList((l) => (l || []).map((x) => (x.id === c.id ? { ...x, liked: on, likes: Math.max(0, x.likes + (on ? 1 : -1)) } : x))); ctx.api(`/api/earshot/social/comments/${c.id}/like`, { method: "POST", body: { on } }).catch(() => {}); };
  const remove = (c: Comment) => ctx.api(`/api/earshot/social/comments/${c.id}`, { method: "DELETE" }).then(() => setList((l) => { const next = (l || []).filter((x) => x.id !== c.id && x.parentId !== c.id); count(next.length); return next; })).catch((e) => ctx.say(e.message));
  const report = (c: Comment) => ctx.api(`/api/earshot/social/comments/${c.id}/report`, { method: "POST" }).then(() => { setList((l) => (l || []).filter((x) => x.id !== c.id)); ctx.say("Reported. Thanks."); }).catch((e) => ctx.say(e.message));
  const reply = (c: Comment) => { if (!ctx.me) return ctx.needProfile(); setTo(c); input.current?.focus(); };

  const row = (c: Comment, line: boolean) => {
    const parent = c.parentId ? byId.get(c.parentId) : null;
    return <div key={c.id} className="flex gap-3 px-4 pt-3">
      <div className="flex flex-col items-center"><Avatar p={c.author} size={40} onClick={() => ctx.person(c.author.handle)} />{line && <span className="mt-1 w-0.5 flex-1 bg-white/[.14]" />}</div>
      <div className={`min-w-0 flex-1 pb-1 ${line ? "" : `border-b ${LINE}`}`}>
        <div className="flex items-center gap-1 text-[15px] leading-5"><button type="button" onClick={() => ctx.person(c.author.handle)} className="truncate font-bold hover:underline">{c.author.name}</button><span className={`truncate ${GREY}`}>@{c.author.handle}</span><span className={`flex-none ${GREY}`}>· {ago(c.at)}</span></div>
        <p className={`text-[15px] leading-5 ${GREY}`}>Replying to <span style={{ color: ACCENT }}>@{(parent ?? post).author.handle}</span></p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-5">{c.body}</p>
        <div className={`-ml-2 flex items-center gap-6 text-[13px] ${GREY}`}>
          <button type="button" onClick={() => reply(c)} aria-label="Reply" className="flex min-h-9 items-center gap-1 rounded-full px-2 hover:text-sky-400"><MessageCircle size={17} />{under(c.id).length || ""}</button>
          <button type="button" onClick={() => like(c)} aria-label="Like" aria-pressed={c.liked} className={`flex min-h-9 items-center gap-1 rounded-full px-2 hover:text-pink-500 ${c.liked ? "text-pink-500" : ""}`}><Heart size={17} className={c.liked ? "fill-pink-500" : ""} />{c.likes || ""}</button>
          {(c.mine || post.mine) ? <button type="button" onClick={() => void remove(c)} aria-label="Delete reply" className="flex min-h-9 items-center rounded-full px-2 hover:text-rose-500"><Trash2 size={16} /></button>
            : <button type="button" onClick={() => void report(c)} aria-label="Report reply" className="flex min-h-9 items-center rounded-full px-2 hover:text-white"><Flag size={16} /></button>}
        </div>
      </div>
    </div>;
  };

  return <div className="absolute inset-x-0 bottom-14 top-0 z-40 flex flex-col bg-black" role="dialog" aria-label="Post">
    <div className={`flex flex-none items-center gap-6 border-b ${LINE} bg-black/85 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] backdrop-blur-xl`}>
      <button type="button" onClick={onClose} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><ArrowLeft size={21} /></button>
      <b className="text-[19px]">Post</b>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto pb-6 [scrollbar-width:none]">
      <div className="px-4 pt-3">
        <div className="flex items-center gap-3">
          <Avatar p={post.author} size={44} onClick={() => ctx.person(post.author.handle)} />
          <button type="button" onClick={() => ctx.person(post.author.handle)} className="min-w-0 text-left leading-5"><b className="block truncate text-[15px]">{post.author.name}</b><span className={`block truncate text-[15px] ${GREY}`}>@{post.author.handle}</span></button>
        </div>
        <XBody post={post} ctx={{ ...ctx, comments: (p) => p.id !== post.id && onOpen(p) }} big />
        <p className={`mt-3 text-[15px] ${GREY}`}>{longTime(post.at)}</p>
        {(post.reposts > 0 || post.likes > 0) && <p className={`mt-3 flex gap-5 border-t ${LINE} pt-3 text-[15px] ${GREY}`}>
          {post.reposts > 0 && <span><b className="text-white">{compact(post.reposts)}</b> Repost{post.reposts === 1 ? "" : "s"}</span>}
          {post.likes > 0 && <span><b className="text-white">{compact(post.likes)}</b> Like{post.likes === 1 ? "" : "s"}</span>}
        </p>}
        <div className={`mt-3 border-y ${LINE} px-1`}><XActions post={post} ctx={ctx} patch={local} onReply={() => { if (!ctx.me) return ctx.needProfile(); setTo(null); input.current?.focus(); }} wide /></div>
      </div>
      {!setup && <div className={`flex items-start gap-3 border-b ${LINE} px-4 py-3`}>
        {ctx.me ? <Avatar p={ctx.me} size={40} /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><User size={18} /></span>}
        <div className="min-w-0 flex-1">
          {to && <p className={`text-[14px] ${GREY}`}>Replying to <span style={{ color: ACCENT }}>@{to.author.handle}</span> <button type="button" onClick={() => setTo(null)} className="ml-1 underline">cancel</button></p>}
          <textarea ref={input} value={body} onChange={(e) => setBody(e.target.value.slice(0, 500))} onFocus={() => { if (!ctx.me) ctx.needProfile(); }} rows={body ? 3 : 1} placeholder="Post your reply" className="w-full resize-none bg-transparent pt-2 text-[17px] outline-none placeholder:text-[#71767b]" />
        </div>
        <button type="button" onClick={send} disabled={busy || !body.trim()} className="mt-1 min-h-9 rounded-full px-4 text-[15px] font-bold text-black disabled:opacity-50" style={{ background: ACCENT }}>{busy ? <Loader2 size={16} className="animate-spin" /> : "Reply"}</button>
      </div>}
      {!list && <div className="grid place-items-center py-8"><Loader2 className="animate-spin" style={{ color: ACCENT }} /></div>}
      {list && !list.length && <p className={`px-6 py-10 text-center text-[15px] ${GREY}`}>{setup ? "Replies are being set up. Check back soon." : "No replies yet. Say something."}</p>}
      {top.map((c) => { const kids = under(c.id); return <div key={c.id}>{row(c, kids.length > 0)}{kids.map((k, i) => row(k, i < kids.length - 1))}</div>; })}
    </div>
  </div>;
}

// ===========================================================================
// Writing a post
// ===========================================================================
function Compose({ api, say, me, quote, onClose, onPosted }: { api: Api; say: (m: string) => void; me: Profile | null; quote?: Post; onClose: () => void; onPosted: (p: Post | null) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const left = 280 - text.length, used = Math.min(1, text.length / 280);
  const post = () => {
    setBusy(true);
    api("/api/earshot/social/posts", { method: "POST", body: quote ? { kind: "repost", repostOf: quote.id, caption: text } : { kind: "text", caption: text } })
      .then((b) => { say("Your post was sent."); onPosted(b.post ?? null); }).catch((e) => say(e.message)).finally(() => setBusy(false));
  };
  const R = 10, C = 2 * Math.PI * R;
  return <div className="absolute inset-0 z-50 flex flex-col bg-black" role="dialog" aria-label="New post">
    <div className="flex flex-none items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
      <button type="button" onClick={onClose} className="min-h-9 text-[16px]">Cancel</button>
      <button type="button" onClick={post} disabled={busy || !text.trim() || left < 0} className="min-h-9 rounded-full px-4 text-[15px] font-bold text-black disabled:opacity-50" style={{ background: ACCENT }}>{busy ? <Loader2 size={16} className="animate-spin" /> : "Post"}</button>
    </div>
    <div className="flex min-h-0 flex-1 gap-3 overflow-y-auto px-4 pt-2">
      {me && <Avatar p={me} size={40} />}
      <div className="min-w-0 flex-1">
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} autoFocus rows={5} placeholder={quote ? "Add a comment" : "What are you listening to?"} className="w-full resize-none bg-transparent pt-1.5 text-[19px] leading-7 outline-none placeholder:text-[#71767b]" />
        {quote && <div className={`mt-1 rounded-2xl border ${LINE} px-3 py-2.5`}><div className="flex items-center gap-1.5 text-[15px]"><Avatar p={quote.author} size={20} /><b className="truncate">{quote.author.name}</b><span className={`truncate ${GREY}`}>@{quote.author.handle}</span></div>{quote.caption && <p className="mt-0.5 line-clamp-3 text-[15px]">{quote.caption}</p>}{quote.clip && <p className="mt-0.5 line-clamp-2 font-serif text-[15px]">“{quote.clip.quote}”</p>}</div>}
        {!quote && <p className={`mt-2 text-[13px] ${GREY}`}>To post a moment of an episode, play it, tap Share, then Clip a moment.</p>}
      </div>
    </div>
    <div className={`flex flex-none items-center justify-end gap-3 border-t ${LINE} px-4 py-2.5`}>
      {text && <span className={`text-[13px] tabular-nums ${left < 0 ? "text-rose-500" : left <= 20 ? "text-amber-400" : GREY}`}>{left <= 20 ? left : ""}</span>}
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden><circle cx="13" cy="13" r={R} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2.5" /><circle cx="13" cy="13" r={R} fill="none" stroke={left < 0 ? "#f43f5e" : left <= 20 ? "#fbbf24" : ACCENT} strokeWidth="2.5" strokeDasharray={C} strokeDashoffset={C * (1 - used)} strokeLinecap="round" transform="rotate(-90 13 13)" /></svg>
    </div>
  </div>;
}
