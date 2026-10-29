// Pod+ Social: the app. Home (stories, For You / Following / Clips), Search & Explore, Create,
// Messages and your Profile, each tab with its own stack of screens (profiles, posts, hashtags,
// followers, chats, notifications). Server: server/podcastSocial.ts + server/podcastSocialPlus.ts.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, Clapperboard, Home, Image as ImageIcon, Link2, Mail, Mic, PenSquare, Plus, Search, Send, User } from "lucide-react";
import type { PodEpisode, PodShow } from "@shared/earshot";
import { ClipsFeed, useClipAudio, type Ctx as OldCtx } from "../EarshotSocial";
import { ActionSheet, Avatar, Empty, PillButton, SX_CSS, Sentinel, linkTo, shareOrCopy, usePaged, type Api, type Counts, type Post, type Profile, type SCtx, type Thread, type TrayItem } from "./kit";
import { PostCard, PostSkeleton } from "./PostCard";
import { Composer } from "./Composer";
import { StoryMaker, StoryTray, StoryViewer } from "./Stories";
import { ExploreScreen, TagScreen } from "./Explore";
import { EditProfile, PeopleScreen, ProfileScreen } from "./ProfileView";
import { ActivityScreen, PostScreen } from "./Screens";
import { ChatScreen, InboxScreen, PeoplePicker } from "./Messages";

type Tab = "home" | "search" | "messages" | "me";
type Screen = { k: "profile"; handle: string } | { k: "post"; post: Post | string } | { k: "tag"; tag: string } | { k: "people"; handle: string; which: "followers" | "following" }
  | { k: "chat"; thread: Thread } | { k: "requests" } | { k: "activity" };
type Feed = "foryou" | "following" | "clips";

export function SocialApp({ api: rawApi, say, night, onPlay, onHush, onCreate, openPerson, onPersonOpened, onSignIn }: {
  api: Api; say: (m: string) => void; night: boolean; onPlay: (show: PodShow, ep: PodEpisode, at?: number) => void; onHush?: () => void;
  onCreate?: () => void; openPerson?: string | null; onPersonOpened?: () => void; onSignIn?: () => Promise<boolean>;
}) {
  // Always the newest api (signing in changes it), so a retry right after sign-in uses the new session.
  const apiRef = useRef(rawApi); apiRef.current = rawApi;
  const api = useCallback<Api>((p, i) => apiRef.current(p, i), []);
  const [me, setMe] = useState<Profile | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("home");
  const [stacks, setStacks] = useState<Record<Tab, Screen[]>>({ home: [], search: [], messages: [], me: [] });
  const [seenTabs, setSeenTabs] = useState<Set<Tab>>(new Set(["home"]));
  const [feed, setFeed] = useState<Feed>("foryou");
  const [counts, setCounts] = useState<Counts>({ notes: 0, dms: 0, requests: 0 });
  const [compose, setCompose] = useState<null | { quote?: Post }>(null);
  const [edit, setEdit] = useState(false);
  const [create, setCreate] = useState(false);
  const [tray, setTray] = useState<TrayItem[] | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [maker, setMaker] = useState(false);
  const [sharing, setSharing] = useState<Post | null>(null);
  const [sendTo, setSendTo] = useState<Post | null>(null);
  const [clips, setClips] = useState<Post[] | null>(null);
  const audio = useClipAudio(onHush);
  const scrollers = useRef(new Map<string, HTMLDivElement>());

  const loadMe = useCallback(() => api("/api/earshot/social/me").then((b) => setMe(b.profile ?? null)).catch(() => setMe(null)), [api]);
  const loadTray = useCallback(() => api("/api/earshot/social/stories").then((b) => setTray(b.tray || [])).catch(() => setTray([])), [api]);
  const loadCounts = useCallback(() => api("/api/earshot/social/counts").then(setCounts).catch(() => {}), [api]);
  useEffect(() => { void loadMe(); void loadTray(); void loadCounts(); const t = setInterval(loadCounts, 25000); return () => clearInterval(t); }, [loadMe, loadTray, loadCounts]);

  const push = useCallback((s: Screen, on?: Tab) => setTab((cur) => { const t = on ?? cur; setStacks((all) => ({ ...all, [t]: [...all[t], s] })); setSeenTabs((x) => new Set(x).add(t)); return t; }), []);
  const pop = useCallback(() => setStacks((all) => ({ ...all, [tab]: all[tab].slice(0, -1) })), [tab]);
  useEffect(() => { if (openPerson) { push({ k: "profile", handle: openPerson }, "home"); onPersonOpened?.(); } }, [openPerson]); // eslint-disable-line react-hooks/exhaustive-deps

  const needProfile = useCallback(() => { if (me) return false; say("Make your profile first. It takes a few seconds."); setEdit(true); return true; }, [me, say]);
  const ctx: SCtx = useMemo(() => ({
    api, say, me: me ?? null,
    openProfile: (handle) => push({ k: "profile", handle: handle.toLowerCase() }),
    openPost: (post) => push({ k: "post", post }),
    openTag: (tag) => push({ k: "tag", tag: tag.toLowerCase() }),
    openChatWith: (handle) => { if (needProfile()) return; api("/api/earshot/social/dm/with", { method: "POST", body: { handle } }).then((b) => push({ k: "chat", thread: b.thread }, "messages")).catch((e) => say(e.message)); },
    compose: (o) => { if (!needProfile()) setCompose(o ?? {}); },
    sharePost: (p) => setSharing(p),
    needProfile,
    signIn: () => (onSignIn ? onSignIn() : Promise.resolve(false)),
    play: onPlay, hush: () => { audio.stop(); onHush?.(); },
  }), [api, say, me, push, needProfile, onSignIn, onPlay, onHush, audio]);

  // The For You / Following feed, page after page.
  const list = usePaged<Post, string | number>((c) => api(`/api/earshot/social/feed?tab=${feed === "following" ? "following" : "foryou"}${c != null ? (feed === "following" ? `&before=${encodeURIComponent(String(c))}` : `&page=${c}`) : ""}`).then((b) => ({ items: b.posts || [], next: b.next ?? null })), [feed === "clips" ? "foryou" : feed]);
  useEffect(() => { if (feed === "clips" && !clips) api("/api/earshot/social/feed?tab=clips").then((b) => setClips(b.posts || [])).catch(() => setClips([])); }, [feed, clips, api]);
  const oldCtx: OldCtx = { api, say, onPlay, audio, me: me ?? null, person: ctx.openProfile, comments: (p) => ctx.openPost(p as Post), repost: (p) => ctx.compose({ quote: p as Post }), needProfile: () => { needProfile(); } };

  const goTab = (t: Tab) => {
    if (t === tab) {
      if (stacks[t].length) setStacks((all) => ({ ...all, [t]: [] }));
      else { const el = scrollers.current.get(`${t}:root`); if (el && el.scrollTop > 40) el.scrollTo({ top: 0, behavior: "smooth" }); else if (t === "home") { list.reset(); void loadTray(); } }
      return;
    }
    if (t === "me" && needProfile()) return;
    setTab(t); setSeenTabs((x) => new Set(x).add(t));
  };

  const screen = (s: Screen): ReactNode => {
    switch (s.k) {
      case "profile": return <ProfileScreen handle={s.handle} ctx={ctx} onBack={pop} onEdit={() => setEdit(true)} onPeople={(h, w) => push({ k: "people", handle: h, which: w })} />;
      case "post": return <PostScreen start={s.post} ctx={ctx} onBack={pop} />;
      case "tag": return <TagScreen tag={s.tag} ctx={ctx} onBack={pop} />;
      case "people": return <PeopleScreen handle={s.handle} which={s.which} ctx={ctx} onBack={pop} />;
      case "chat": return <ChatScreen thread={s.thread} ctx={ctx} onBack={() => { pop(); void loadCounts(); }} />;
      case "requests": return <InboxScreen requests ctx={ctx} onBack={pop} onOpen={(t) => push({ k: "chat", thread: t })} />;
      case "activity": return <ActivityScreen ctx={ctx} onBack={pop} onRead={() => setCounts((c) => ({ ...c, notes: 0 }))} />;
    }
  };

  const home = <div>
    <div className="glass sticky top-0 z-20">
      <div className="flex h-[52px] items-center px-4">
        <button type="button" onClick={() => (me ? goTab("me") : setEdit(true))} aria-label="Your profile" className="flex-none">{me ? <Avatar p={me} size={32} /> : <span className="elev grid h-8 w-8 place-items-center rounded-full"><User size={16} /></span>}</button>
        <span className="flex-1 text-center text-[21px] font-black tracking-tight">Pod<span className="accent">+</span></span>
        <button type="button" onClick={() => push({ k: "activity" })} aria-label={counts.notes ? `Notifications, ${counts.notes} new` : "Notifications"} className="hov relative grid h-10 w-10 place-items-center rounded-full">
          <Bell size={22} />{counts.notes > 0 && <span className="bg-accent absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold">{counts.notes > 99 ? "99+" : counts.notes}</span>}
        </button>
      </div>
      <div className="flex border-b line" role="tablist">{([["foryou", "For you"], ["following", "Following"], ["clips", "Clips"]] as const).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={feed === v} onClick={() => (feed === v ? list.reset() : setFeed(v))} className={`hov relative min-h-[50px] flex-1 text-[15px] ${feed === v ? "font-bold" : "muted font-medium"}`}>{l}{feed === v && <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-[color:var(--accent)]" />}</button>)}</div>
    </div>
    {feed === "clips" ? <div className="ps-dark flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col bg-black text-white"><ClipsFeed posts={clips as any} ctx={oldCtx} setup={false} onRefresh={() => setClips(null)} /></div> : <>
      <StoryTray tray={tray} me={me ?? null} onOpen={(i) => setViewer(i)} onCreate={() => (needProfile() ? null : setMaker(true))} />
      {me ? <button type="button" onClick={() => setCompose({})} className="flex w-full items-center gap-3 border-b line px-4 py-3 text-left">
        <Avatar p={me} size={40} /><span className="muted flex-1 text-[17px]">What's happening?</span><span className="link"><ImageIcon size={20} /></span>
      </button> : me === null && <div className="border-b line px-4 py-5"><p className="text-[17px] font-bold">Join the conversation</p><p className="muted mt-0.5 text-[15px]">Make a profile to post, follow people, message and share stories.</p><PillButton kind="accent" className="mt-3" onClick={() => setEdit(true)}>Create profile</PillButton></div>}
      {!list.items && <><PostSkeleton /><PostSkeleton /><PostSkeleton /></>}
      {list.items?.map((p) => <PostCard key={p.id} post={p} ctx={ctx} onChange={(np) => list.patch(p.id, () => np)} onGone={() => list.patch(p.id, () => null)} />)}
      {list.items && !list.items.length && <Empty title={feed === "following" ? "Your timeline is empty" : "Nothing here yet"} text={feed === "following" ? "Follow people and their posts show up here." : "Be the first to post something."} action={<PillButton kind="accent" onClick={() => (feed === "following" ? goTab("search") : ctx.compose())}>{feed === "following" ? "Find people" : "Write a post"}</PillButton>} />}
      {list.items && list.items.length > 0 && <Sentinel onSeen={list.more} done={list.done} />}
    </>}
  </div>;

  const roots: Record<Tab, ReactNode> = {
    home,
    search: <ExploreScreen ctx={ctx} follow={(p) => api("/api/earshot/social/follow", { method: "POST", body: { handle: p.handle, on: !p.followed } }).catch((e) => say(e.message))} />,
    messages: <InboxScreen ctx={ctx} onOpen={(t) => push(t.id === "requests" ? { k: "requests" } : { k: "chat", thread: t })} />,
    me: me ? <ProfileScreen handle={me.handle} ctx={ctx} onEdit={() => setEdit(true)} onPeople={(h, w) => push({ k: "people", handle: h, which: w })} /> : null,
  };

  return <div className={`sx ps-dark relative flex h-full flex-col pt-16 ${night ? "" : "sx-light"}`} style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
    <style>{SX_CSS}</style>
    <div className="relative min-h-0 flex-1">
      {(["home", "search", "messages", "me"] as Tab[]).filter((t) => seenTabs.has(t)).map((t) => {
        const layers = [{ key: `${t}:root`, node: roots[t] }, ...stacks[t].map((s, i) => ({ key: `${t}:${i}:${s.k}`, node: screen(s) }))];
        return layers.map((l, i) => {
          const top = t === tab && i === layers.length - 1;
          return <div key={l.key} ref={(el) => { if (el) scrollers.current.set(l.key, el); else scrollers.current.delete(l.key); }} aria-hidden={!top}
            className="bg noscroll absolute inset-0 overflow-y-auto overscroll-contain" style={{ visibility: top ? "visible" : "hidden", zIndex: top ? 2 : 1 }}>
            <div className="mx-auto min-h-full w-full max-w-[600px] border-x line pb-[calc(4rem+var(--ps-safe-b,0px))]">{l.node}</div>
          </div>;
        });
      })}
    </div>

    {tab === "home" && !stacks.home.length && feed !== "clips" && <button type="button" onClick={() => ctx.compose()} aria-label="Post"
      className="bg-accent absolute bottom-[calc(4.5rem+var(--ps-safe-b,0px))] right-4 z-30 grid h-14 w-14 place-items-center rounded-full shadow-[0_6px_20px_rgba(0,0,0,.35)] active:scale-95"><PenSquare size={22} /></button>}

    <nav className="glass absolute inset-x-0 bottom-0 z-40 box-content flex h-[54px] border-t line pb-[var(--ps-safe-b,0px)]" aria-label="Social">
      <NavBtn label="Home" on={tab === "home"} onClick={() => goTab("home")}><Home size={25} strokeWidth={tab === "home" ? 2.6 : 1.8} /></NavBtn>
      <NavBtn label="Search" on={tab === "search"} onClick={() => goTab("search")}><Search size={25} strokeWidth={tab === "search" ? 2.8 : 1.8} /></NavBtn>
      <NavBtn label="Create" onClick={() => (needProfile() ? null : setCreate(true))}><span className="btn-fg grid h-9 w-11 place-items-center rounded-xl"><Plus size={22} strokeWidth={2.6} /></span></NavBtn>
      <NavBtn label={counts.dms ? `Messages, ${counts.dms} unread` : "Messages"} on={tab === "messages"} onClick={() => goTab("messages")}>
        <Mail size={25} strokeWidth={tab === "messages" ? 2.6 : 1.8} />{counts.dms + counts.requests > 0 && <span className="bg-accent absolute left-1/2 top-1.5 ml-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold">{counts.dms + counts.requests}</span>}
      </NavBtn>
      <NavBtn label="Profile" on={tab === "me"} onClick={() => goTab("me")}>{me ? <Avatar p={me} size={28} ring={tab === "me" ? "0 0 0 2px var(--fg)" : undefined} /> : <User size={25} strokeWidth={1.8} />}</NavBtn>
    </nav>

    <div id="sx-layer" />
    {create && <ActionSheet onClose={() => setCreate(false)} items={[
      { label: "Post", icon: <PenSquare size={20} />, onClick: () => setCompose({}) },
      { label: "Story", icon: <Clapperboard size={20} />, onClick: () => setMaker(true) },
      { label: "Podcast episode or go live", icon: <Mic size={20} />, onClick: () => onCreate?.() },
    ]} />}
    {compose && <Composer ctx={ctx} quote={compose.quote} onClose={() => setCompose(null)} onPosted={(p) => { setCompose(null); if (feed !== "clips") list.prepend(p); say("Your post was sent."); }} />}
    {edit && <EditProfile ctx={ctx} initial={me ?? null} onClose={() => setEdit(false)} onSaved={(p) => { setEdit(false); setMe(p); }} />}
    {viewer !== null && tray && tray.length > 0 && <StoryViewer tray={tray} start={viewer} ctx={ctx} onClose={() => { setViewer(null); void loadTray(); }}
      onSeen={(id) => setTray((l) => (l || []).map((g) => ({ ...g, stories: g.stories.map((s) => (s.id === id ? { ...s, seen: true } : s)), unseen: g.stories.some((s) => s.id !== id && !s.seen) && g.unseen })))}
      onDeleted={() => void loadTray()} onCreate={() => { setViewer(null); setMaker(true); }} />}
    {maker && <StoryMaker ctx={ctx} onClose={() => setMaker(false)} onPosted={() => { setMaker(false); say("Your story is up for 24 hours."); void loadTray(); }} />}
    {sharing && <ActionSheet onClose={() => setSharing(null)} items={[
      { label: "Send in a message", icon: <Send size={20} />, onClick: () => (needProfile() ? null : setSendTo(sharing)) },
      { label: "Copy link", icon: <Link2 size={20} />, onClick: () => { void navigator.clipboard?.writeText(linkTo(`post/${sharing.id}`)).then(() => say("Link copied."), () => say(linkTo(`post/${sharing.id}`))); } },
      { label: "Share via…", icon: <Send size={20} />, onClick: () => void shareOrCopy(linkTo(`post/${sharing.id}`), "Pod+", say) },
    ]} />}
    {sendTo && <PeoplePicker ctx={ctx} title="Send to" onClose={() => setSendTo(null)} onPick={(p) => {
      const post = sendTo; setSendTo(null);
      api("/api/earshot/social/dm/with", { method: "POST", body: { handle: p.handle } }).then((b) => api(`/api/earshot/social/dm/${b.thread.id}/messages`, { method: "POST", body: { postId: post.id } })).then(() => say(`Sent to @${p.handle}.`)).catch((e) => say(e.message));
    }} />}
  </div>;
}

const NavBtn = ({ label, on, onClick, children }: { label: string; on?: boolean; onClick: () => void; children: ReactNode }) =>
  <button type="button" aria-label={label} aria-current={on ? "page" : undefined} onClick={onClick} className={`relative grid flex-1 place-items-center ${on ? "fg" : "muted"}`}>{children}</button>;
