// Pod+ Social: the app. Home (stories, For You / Following / Clips), Search & Explore, Create,
// Messages and your Profile, each tab with its own stack of screens (profiles, posts, hashtags,
// followers, chats, notifications). Server: server/podcastSocial.ts + server/podcastSocialPlus.ts.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, Clapperboard, Compass, Hash, Home, Image as ImageIcon, Link2, Mail, Mic, PenSquare, Plus, Search, Send, TrendingUp, User } from "lucide-react";
import type { PodEpisode, PodShow } from "@shared/earshot";
import { ClipsFeed, useClipAudio, type Ctx as OldCtx } from "../EarshotSocial";
import { ActionSheet, Avatar, Empty, PillButton, SX_CSS, Sentinel, linkTo, shareOrCopy, usePaged, type Api, type Counts, type Person, type Post, type Profile, type SCtx, type Thread, type TrayItem } from "./kit";
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
  const [discover, setDiscover] = useState<{ tags: { tag: string; posts: number }[]; people: Person[]; posts: Post[] } | null>(null);
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
  useEffect(() => {
    let active = true;
    api("/api/earshot/social/explore").then((data) => {
      if (active) setDiscover({ tags: data.tags || [], people: data.people || [], posts: data.posts || [] });
    }).catch(() => { if (active) setDiscover({ tags: [], people: [], posts: [] }); });
    return () => { active = false; };
  }, [api]);

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

  const toggleFollow = (p: Person) => {
    if (needProfile()) return;
    const on = !p.followed;
    setDiscover((d) => d ? { ...d, people: d.people.map((x) => x.handle === p.handle ? { ...x, followed: on } : x) } : d);
    void api("/api/earshot/social/follow", { method: "POST", body: { handle: p.handle, on } }).catch((e) => {
      setDiscover((d) => d ? { ...d, people: d.people.map((x) => x.handle === p.handle ? { ...x, followed: !on } : x) } : d);
      say(e.message);
    });
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

  const home = <div className="sx-home">
    <header className="sx-feed-header glass">
      <div className="sx-feed-title-row">
        <button type="button" onClick={() => (me ? goTab("me") : setEdit(true))} aria-label="Your profile" className="sx-mobile-avatar">
          {me ? <Avatar p={me} size={34} /> : <span className="elev grid h-8 w-8 place-items-center rounded-full"><User size={16} /></span>}
        </button>
        <div className="sx-feed-heading">
          <span className="sx-mobile-brand">Pod<span className="accent">+</span><small>SOCIAL</small></span>
          <h1 className="sx-desktop-heading">Home</h1>
          <p className="sx-desktop-subheading">Conversations worth being part of.</p>
        </div>
        <button type="button" onClick={() => push({ k: "activity" })} aria-label={counts.notes ? `Notifications, ${counts.notes} unread` : "Notifications"} className="sx-header-alert">
          <Bell size={20} />{counts.notes > 0 && <span className="sx-count">{counts.notes > 99 ? "99+" : counts.notes}</span>}
        </button>
      </div>
      <div className="sx-feed-tabs" role="tablist">
        {([["foryou", "For you"], ["following", "Following"], ["clips", "Clips"]] as const).map(([v, l]) =>
          <button key={v} type="button" role="tab" aria-selected={feed === v} onClick={() => (feed === v ? list.reset() : setFeed(v))} className={feed === v ? "sx-feed-tab sx-feed-tab-active" : "sx-feed-tab"}>{l}</button>
        )}
      </div>
    </header>
    {feed === "clips" ? <div className="ps-dark flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col bg-black text-white"><ClipsFeed posts={clips as any} ctx={oldCtx} setup={false} onRefresh={() => setClips(null)} /></div> : <>
      <StoryTray tray={tray} me={me ?? null} onOpen={(i) => setViewer(i)} onCreate={() => (needProfile() ? null : setMaker(true))} />
      {me ? <div className="sx-composer-row">
        <Avatar p={me} size={42} />
        <button type="button" onClick={() => setCompose({})} className="sx-composer-prompt">What's on your mind?</button>
        <button type="button" onClick={() => setCompose({})} className="sx-composer-media" aria-label="Create a photo or video post"><ImageIcon size={19} /></button>
      </div> : me === null && <div className="sx-join">
        <p className="sx-join-eyebrow">YOUR COMMUNITY STARTS HERE</p>
        <p className="text-[19px] font-semibold">Your voice belongs in the conversation.</p>
        <p className="muted mt-2 text-[14px] leading-relaxed">Create a profile to share posts, follow creators and connect with people who listen like you do.</p>
        <PillButton kind="accent" className="mt-4" onClick={() => setEdit(true)}>Join Pod+ Social</PillButton>
      </div>}
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

  return <div className={night ? "sx ps-dark sx-social-root" : "sx ps-dark sx-social-root sx-light"} style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
    <style>{SX_CSS}</style>
    <div className="sx-workspace">
      <aside className="sx-left-sidebar" aria-label="Social navigation">
        <div className="sx-brand" aria-label="Pod Plus Social">
          <span className="sx-brand-word">pod<span>+</span></span>
          <span className="sx-brand-tag">SOCIAL</span>
        </div>
        <div className="sx-sidebar-menu">
          <button type="button" className={tab === "home" ? "sx-side-link sx-side-link-active" : "sx-side-link"} aria-current={tab === "home" ? "page" : undefined} onClick={() => goTab("home")}><Home size={22} strokeWidth={tab === "home" ? 2.4 : 1.8} /><span>Home</span></button>
          <button type="button" className={tab === "search" ? "sx-side-link sx-side-link-active" : "sx-side-link"} aria-current={tab === "search" ? "page" : undefined} onClick={() => goTab("search")}><Compass size={22} strokeWidth={tab === "search" ? 2.4 : 1.8} /><span>Explore</span></button>
          <button type="button" className={tab === "messages" ? "sx-side-link sx-side-link-active" : "sx-side-link"} aria-current={tab === "messages" ? "page" : undefined} onClick={() => goTab("messages")}><Mail size={22} strokeWidth={tab === "messages" ? 2.4 : 1.8} /><span>Messages</span>{counts.dms + counts.requests > 0 && <span className="sx-side-badge">{counts.dms + counts.requests}</span>}</button>
          <button type="button" className="sx-side-link" onClick={() => push({ k: "activity" }, "home")}><Bell size={22} strokeWidth={1.8} /><span>Notifications</span>{counts.notes > 0 && <span className="sx-side-badge">{counts.notes}</span>}</button>
          <button type="button" className={tab === "me" ? "sx-side-link sx-side-link-active" : "sx-side-link"} aria-current={tab === "me" ? "page" : undefined} onClick={() => goTab("me")}><User size={22} strokeWidth={1.8} /><span>Profile</span></button>
        </div>
        <button type="button" onClick={() => (needProfile() ? null : setCreate(true))} className="sx-side-create"><Plus size={19} /><span>Create post</span></button>
        <div className="sx-side-bottom">
          <span className="sx-side-bottom-label">YOUR ACCOUNT</span>
          <button type="button" className="sx-account-row" onClick={() => (me ? goTab("me") : setEdit(true))}>
            {me ? <Avatar p={me} size={40} /> : <span className="elev grid h-10 w-10 place-items-center rounded-full"><User size={20} /></span>}
            <span className="sx-account-copy"><strong>{me?.name || "Create your profile"}</strong><small>{me ? `@${me.handle}` : "Join the conversation"}</small></span>
          </button>
        </div>
      </aside>
      <main className="sx-main-column" aria-label="Pod+ social feed">
        <div className="sx-screens">
          {(["home", "search", "messages", "me"] as Tab[]).filter((t) => seenTabs.has(t)).map((t) => {
            const layers = [{ key: `${t}:root`, node: roots[t] }, ...stacks[t].map((s, i) => ({ key: `${t}:${i}:${s.k}`, node: screen(s) }))];
            return layers.map((l, i) => {
              const top = t === tab && i === layers.length - 1;
              return <div key={l.key} ref={(el) => { if (el) scrollers.current.set(l.key, el); else scrollers.current.delete(l.key); }} aria-hidden={!top}
                className="sx-scroll-layer bg noscroll" style={{ visibility: top ? "visible" : "hidden", zIndex: top ? 2 : 1 }}>
                <div className="sx-content-layer">{l.node}</div>
              </div>;
            });
          })}
        </div>
      </main>
      <aside className="sx-right-sidebar" aria-label="Discover on Pod+">
        <button type="button" className="sx-discovery-search" onClick={() => goTab("search")}><Search size={18} /><span>Search Pod+ Social</span></button>
        <section className="sx-discovery-card">
          <div className="sx-panel-heading"><TrendingUp size={18} /><h2>What's happening</h2></div>
          {discover === null ? <p className="sx-discovery-muted">Loading conversations...</p> : discover.tags.length ? discover.tags.slice(0, 5).map((t, i) =>
            <button key={t.tag} type="button" className="sx-trend" onClick={() => push({ k: "tag", tag: t.tag }, "home")}>
              <span className="sx-trend-kicker">Trending in Pod+ · {i + 1}</span>
              <strong>#{t.tag}</strong>
              <span className="sx-trend-meta">{t.posts.toLocaleString()} posts</span>
            </button>
          ) : <div className="sx-discovery-muted">New conversations will appear here as the community grows.</div>}
          <button type="button" className="sx-see-more" onClick={() => goTab("search")}>Explore conversations <span aria-hidden="true">→</span></button>
        </section>
        <section className="sx-discovery-card">
          <div className="sx-panel-heading"><User size={18} /><h2>Who to follow</h2></div>
          {discover === null ? <p className="sx-discovery-muted">Finding people...</p> : discover.people.length ? discover.people.slice(0, 4).map((p) =>
            <div key={p.handle} className="sx-follow-row">
              <Avatar p={p} size={42} onClick={() => push({ k: "profile", handle: p.handle }, "home")} />
              <button type="button" className="sx-follow-info" onClick={() => push({ k: "profile", handle: p.handle }, "home")}>
                <strong>{p.name}{p.verified ? <span className="sx-official-mark" aria-label="Verified official account">✓</span> : null}</strong>
                <small>@{p.handle}</small>
                {p.handle === "jjrobo180" && <span className="sx-official-hint">Official Pod+ account</span>}
              </button>
              <button type="button" className={p.followed ? "sx-follow-action sx-followed" : "sx-follow-action"} aria-label={p.followed ? `Unfollow @${p.handle}` : `Follow @${p.handle}`} onClick={() => toggleFollow(p)}>{p.followed ? "Following" : "Follow"}</button>
            </div>
          ) : <p className="sx-discovery-muted">Creators and listeners will appear here.</p>}
          <button type="button" className="sx-see-more" onClick={() => goTab("search")}>Discover more people <span aria-hidden="true">→</span></button>
        </section>
        <p className="sx-right-footer">Pod+ Social · Your community, your conversations.</p>
      </aside>
    </div>

    {tab === "home" && !stacks.home.length && feed !== "clips" && <button type="button" onClick={() => ctx.compose()} aria-label="Post"
      className="sx-mobile-fab bg-accent"><PenSquare size={22} /></button>}

    <nav className="sx-mobile-nav glass" aria-label="Social">
      <NavBtn label="Home" on={tab === "home"} onClick={() => goTab("home")}><Home size={24} strokeWidth={tab === "home" ? 2.6 : 1.8} /></NavBtn>
      <NavBtn label="Explore" on={tab === "search"} onClick={() => goTab("search")}><Search size={24} strokeWidth={tab === "search" ? 2.6 : 1.8} /></NavBtn>
      <NavBtn label="Create" onClick={() => (needProfile() ? null : setCreate(true))}><span className="sx-mobile-create"><Plus size={23} strokeWidth={2.6} /></span></NavBtn>
      <NavBtn label={counts.dms ? `Messages, ${counts.dms} unread` : "Messages"} on={tab === "messages"} onClick={() => goTab("messages")}>
        <Mail size={24} strokeWidth={tab === "messages" ? 2.6 : 1.8} />{counts.dms + counts.requests > 0 && <span className="sx-mobile-badge">{counts.dms + counts.requests}</span>}
      </NavBtn>
      <NavBtn label="Profile" on={tab === "me"} onClick={() => goTab("me")}>{me ? <Avatar p={me} size={28} ring={tab === "me" ? "0 0 0 2px var(--fg)" : undefined} /> : <User size={24} strokeWidth={1.8} />}</NavBtn>
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
