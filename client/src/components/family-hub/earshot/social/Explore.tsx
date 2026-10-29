// Explore and Search. Before you type: trending hashtags, people to follow, and a grid of the photos,
// videos and episodes people are into this week. As you type: people right away, then Top / People /
// Posts / Hashtags results. Recent searches are kept on this device. Plus each hashtag's own page.
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Clock, Hash, Headphones, Image as ImageIcon, Play, Search, TrendingUp, X } from "lucide-react";
import { hiRes } from "@shared/earshot";
import { Avatar, Empty, FollowButton, NameLine, Sentinel, Spinner, compactCount, local, usePaged, type Person, type Post, type SCtx } from "./kit";
import { PostCard, PostSkeleton } from "./PostCard";

type Results = { people: Person[]; posts: Post[]; tags: { tag: string; posts: number }[] };
type ExploreData = { tags: { tag: string; posts: number }[]; people: Person[]; posts: Post[] };
const RECENT = "podplus.social.recent";

export function ExploreScreen({ ctx, follow }: { ctx: SCtx; follow: (p: Person) => void }) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [data, setData] = useState<ExploreData | null>(null);
  const [res, setRes] = useState<Results | null>(null);
  const [tab, setTab] = useState<"top" | "people" | "posts" | "tags">("top");
  const [recent, setRecent] = useState<string[]>(() => local.get(RECENT, []));
  const [busy, setBusy] = useState(false);
  useEffect(() => { ctx.api("/api/earshot/social/explore").then(setData).catch(() => setData({ tags: [], people: [], posts: [] })); }, [ctx]);
  useEffect(() => {
    const t = q.trim(); if (t.replace("#", "").length < 2) { setRes(null); return; }
    let live = true; setBusy(true);
    const h = setTimeout(() => ctx.api(`/api/earshot/social/search?q=${encodeURIComponent(t)}`).then((b) => { if (live) setRes(b); }).catch(() => { if (live) setRes({ people: [], posts: [], tags: [] }); }).finally(() => { if (live) setBusy(false); }), 260);
    return () => { live = false; clearTimeout(h); };
  }, [q, ctx]);
  const remember = (s: string) => { const next = [s, ...recent.filter((x) => x !== s)].slice(0, 8); setRecent(next); local.set(RECENT, next); };
  const patchPerson = (h: string, f: (p: Person) => Person) => { setRes((r) => (r ? { ...r, people: r.people.map((p) => (p.handle === h ? f(p) : p)) } : r)); setData((d) => (d ? { ...d, people: d.people.map((p) => (p.handle === h ? f(p) : p)) } : d)); };
  const tapFollow = (p: Person) => { if (ctx.needProfile()) return; follow(p); patchPerson(p.handle, (x) => ({ ...x, followed: !x.followed })); };
  const openPerson = (p: Person) => { remember(`@${p.handle}`); ctx.openProfile(p.handle); };
  const showing = q.trim().replace("#", "").length >= 2;

  return <div className="min-h-full">
    <div className="bg sticky top-0 z-10 flex items-center gap-2 px-4 py-2">
      {(focus || q) && <button type="button" onClick={() => { setQ(""); setFocus(false); (document.activeElement as HTMLElement)?.blur(); }} aria-label="Back" className="hov -ml-2 grid h-9 w-9 place-items-center rounded-full"><ArrowLeft size={20} /></button>}
      <label className={`elev flex min-h-11 flex-1 items-center gap-2.5 rounded-full px-4 ring-1 ${focus ? "ring-[color:var(--link)]" : "ring-transparent"}`}>
        <Search size={18} className={focus ? "link" : "muted"} />
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) remember(q.trim()); }} placeholder="Search people, posts and #tags" aria-label="Search" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Clear" className="bg-accent grid h-5 w-5 place-items-center rounded-full"><X size={12} strokeWidth={3} /></button>}
      </label>
    </div>

    {showing ? <>
      <div className="noscroll flex border-b line" role="tablist">{(["top", "people", "posts", "tags"] as const).map((t) => <TabBtn key={t} on={tab === t} onClick={() => setTab(t)}>{t === "top" ? "Top" : t === "people" ? "People" : t === "posts" ? "Posts" : "Hashtags"}</TabBtn>)}</div>
      {busy && !res && <Spinner />}
      {res && <>
        {(tab === "top" || tab === "people") && res.people.slice(0, tab === "top" ? 3 : 20).map((p) => <PersonRow key={p.handle} p={p} ctx={ctx} onOpen={() => openPerson(p)} onFollow={() => tapFollow(p)} />)}
        {tab === "top" && res.people.length > 3 && <button type="button" onClick={() => setTab("people")} className="link hov block w-full border-b line px-4 py-3 text-left text-[15px]">See all people</button>}
        {(tab === "tags" || (tab === "top" && res.tags.length > 0)) && res.tags.slice(0, tab === "top" ? 3 : 10).map((t) => <TagRow key={t.tag} t={t} onOpen={() => { remember(`#${t.tag}`); ctx.openTag(t.tag); }} />)}
        {(tab === "top" || tab === "posts") && res.posts.map((p) => <PostCard key={p.id} post={p} ctx={ctx} onChange={(np) => setRes((r) => (r ? { ...r, posts: r.posts.map((x) => (x.id === np.id ? np : x)) } : r))} onGone={() => setRes((r) => (r ? { ...r, posts: r.posts.filter((x) => x.id !== p.id) } : r))} />)}
        {!res.people.length && !res.posts.length && !res.tags.length && <Empty title={`No results for “${q.trim()}”`} text="Try a name, a @username, a #hashtag or other words." />}
      </>}
    </> : focus ? <div>
      {recent.length > 0 && <div className="flex items-center justify-between px-4 pb-1 pt-3"><b className="text-[20px]">Recent</b><button type="button" onClick={() => { setRecent([]); local.set(RECENT, []); }} className="link text-[14px] font-bold">Clear all</button></div>}
      {recent.map((r) => <button key={r} type="button" onClick={() => { if (r.startsWith("@")) ctx.openProfile(r.slice(1)); else if (r.startsWith("#")) ctx.openTag(r.slice(1)); else setQ(r); }} className="hov flex w-full items-center gap-3 px-4 py-3 text-left text-[15px]"><Clock size={18} className="muted" />{r}</button>)}
      {!recent.length && <p className="muted px-6 py-10 text-center text-[15px]">Search for people, posts and #hashtags.</p>}
    </div> : <>
      {!data && <Spinner />}
      {data && data.tags.length > 0 && <section className="border-b line pb-1">
        <h2 className="px-4 pb-1 pt-3 text-[20px] font-extrabold">Trending</h2>
        {data.tags.slice(0, 6).map((t, i) => <TagRow key={t.tag} t={t} rank={i + 1} onOpen={() => ctx.openTag(t.tag)} />)}
      </section>}
      {data && data.people.length > 0 && <section className="border-b line py-3">
        <h2 className="px-4 pb-3 text-[20px] font-extrabold">Who to follow</h2>
        <div className="noscroll flex gap-3 overflow-x-auto px-4 pb-1">{data.people.map((p) => <div key={p.handle} className="flex w-[156px] flex-none flex-col items-center rounded-2xl border line p-4 text-center">
          <Avatar p={p} size={64} onClick={() => openPerson(p)} />
          <button type="button" onClick={() => openPerson(p)} className="mt-2 w-full"><span className="flex justify-center"><NameLine p={p} small /></span><span className="muted block truncate text-[13px]">@{p.handle}</span></button>
          <span className="muted mt-1 text-[12px]">{compactCount(p.followers ?? 0)} followers</span>
          <div className="mt-3"><FollowButton small on={!!p.followed} followsYou={p.followsYou} onToggle={() => tapFollow(p)} /></div>
        </div>)}</div>
      </section>}
      {data && <section>
        <h2 className="px-4 pb-2 pt-3 text-[20px] font-extrabold">Explore</h2>
        {data.posts.length ? <Grid posts={data.posts} onOpen={(p) => ctx.openPost(p)} /> : <Empty title="Nothing to explore yet" text="Photos, videos and episodes people share will show up here." />}
      </section>}
    </>}
  </div>;
}

const TabBtn = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) =>
  <button type="button" role="tab" aria-selected={on} onClick={onClick} className={`hov relative min-h-[50px] flex-1 whitespace-nowrap px-4 text-[15px] ${on ? "font-bold" : "muted font-medium"}`}>
    {children}{on && <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-[color:var(--accent)]" />}
  </button>;
export { TabBtn };

export function PersonRow({ p, ctx, onOpen, onFollow, sub }: { p: Person; ctx: SCtx; onOpen: () => void; onFollow?: () => void; sub?: string }) {
  return <div className="hov flex cursor-pointer items-start gap-3 px-4 py-3" onClick={onOpen}>
    <Avatar p={p} size={44} />
    <div className="min-w-0 flex-1">
      <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><NameLine p={p} /><span className="muted flex items-center gap-1.5 text-[14px]"><span className="truncate">@{p.handle}</span>{p.followsYou && <span className="elev2 flex-none rounded px-1 text-[11px] font-semibold">Follows you</span>}</span></div>
        {onFollow && !p.me && ctx.me?.handle !== p.handle && <FollowButton small on={!!p.followed} followsYou={p.followsYou} onToggle={onFollow} />}</div>
      {(sub || p.bio) && <p className="mt-0.5 line-clamp-2 text-[14px]">{sub || p.bio}</p>}
    </div>
  </div>;
}
function TagRow({ t, rank, onOpen }: { t: { tag: string; posts: number }; rank?: number; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="hov flex w-full items-center gap-3 px-4 py-2.5 text-left">
    <span className="elev grid h-10 w-10 flex-none place-items-center rounded-full">{rank ? <TrendingUp size={18} className="accent" /> : <Hash size={18} />}</span>
    <span className="min-w-0"><span className="muted block text-[12px]">{rank ? `${rank} · Trending` : "Hashtag"}</span><b className="block truncate text-[15px]">#{t.tag}</b><span className="muted block text-[13px]">{compactCount(t.posts)} {t.posts === 1 ? "post" : "posts"}</span></span>
  </button>;
}

/** Three across: photos, videos and episode art (tap to open the post). */
export function Grid({ posts, onOpen }: { posts: Post[]; onOpen: (p: Post) => void }) {
  return <div className="grid grid-cols-3 gap-0.5">{posts.map((p) => {
    const src = p.media?.[0] ?? p.repost?.media?.[0];
    const art = src?.type === "image" ? src.url : p.episode?.art ? hiRes(p.episode.art, 400) : "";
    return <button key={p.id} type="button" onClick={() => onOpen(p)} className="elev2 relative block aspect-square overflow-hidden" aria-label={p.caption || p.episode?.title || "Post"}>
      {src?.type === "video" ? <video src={src.url} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        : art ? <img src={art} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition hover:scale-[1.03]" />
          : <span className="absolute inset-0 grid place-items-center p-2 text-[12px]">{p.caption.slice(0, 80)}</span>}
      <span className="absolute right-1.5 top-1.5 text-white drop-shadow">{src?.type === "video" ? <Play size={16} className="fill-white" /> : (p.media?.length ?? 0) > 1 ? <ImageIcon size={16} /> : p.episode ? <Headphones size={16} /> : null}</span>
    </button>;
  })}</div>;
}

/** A hashtag's page: every post with it, newest first, loading more as you scroll. */
export function TagScreen({ tag, ctx }: { tag: string; ctx: SCtx }) {
  const list = usePaged<Post, string>((cursor) => ctx.api(`/api/earshot/social/tags/${encodeURIComponent(tag)}${cursor ? `?before=${encodeURIComponent(cursor)}` : ""}`).then((b) => ({ items: b.posts || [], next: b.next ?? null })), [tag]);
  return <div>
    <div className="flex items-center gap-3 border-b line px-4 py-4"><span className="elev grid h-14 w-14 place-items-center rounded-2xl"><Hash size={28} className="accent" /></span><div><h1 className="text-[22px] font-extrabold">#{tag}</h1><p className="muted text-[14px]">Posts with #{tag}, newest first</p></div></div>
    {!list.items && <><PostSkeleton /><PostSkeleton /></>}
    {list.items?.map((p) => <PostCard key={p.id} post={p} ctx={ctx} onChange={(np) => list.patch(p.id, () => np)} onGone={() => list.patch(p.id, () => null)} />)}
    {list.items && !list.items.length && <Empty title={`No posts with #${tag} yet`} text="Be the first: put it in a post." />}
    {list.items && list.items.length > 0 && <Sentinel onSeen={list.more} done={list.done} />}
  </div>;
}
