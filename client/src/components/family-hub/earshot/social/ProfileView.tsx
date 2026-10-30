// Profiles: cover and profile photo, name, bio, where they are, their site, when they joined,
// following/followers, people you both know, favorite podcasts, and tabs (Posts, Media, Clips,
// Podcasts; Likes and Saved on your own). Follow, Message, Share, Block. Plus Edit profile (photo
// and cover uploads) and the followers / following lists.
import { useEffect, useRef, useState } from "react";
import { Ban, CalendarDays, Camera, Flag, LifeBuoy, Link2, Loader2, Mail, MapPin, MoreHorizontal, Plus, Search, Share, ShieldCheck, X } from "lucide-react";
import { hiRes } from "@shared/earshot";
import {
  ActionSheet, Avatar, Empty, FollowButton, NeedSignIn, PillButton, Sentinel, Sheet, Spinner, TopBar, Verified, RichText, compactCount, linkTo, shareOrCopy, uploadMedia, usePaged,
  type Person, type Post, type Profile, type ProfileData, type SCtx,
} from "./kit";
import { PostCard, PostSkeleton } from "./PostCard";
import { Grid, PersonRow, TabBtn } from "./Explore";
import { ReportSheet, RulesAgree, policyLinks } from "./Rules";

type Tab = "posts" | "media" | "clips" | "podcast" | "likes" | "saved";
const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 17);
export const coverBg = (handle: string) => { const h = hue(handle || "x"); return `linear-gradient(120deg, hsl(${h} 45% 30%), hsl(${(h + 50) % 360} 55% 20%))`; };
const joinedOn = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); return Number.isNaN(+d) ? "" : `Joined ${d.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`; };

export function ProfileScreen({ handle, ctx, onBack, onEdit, onPeople, onChanged }: {
  handle: string; ctx: SCtx; onBack?: () => void; onEdit: () => void; onPeople: (handle: string, which: "followers" | "following") => void; onChanged?: () => void;
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("posts");
  const [menu, setMenu] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const load = () => ctx.api(`/api/earshot/social/profile/${encodeURIComponent(handle)}`).then((b) => { setData(b); setErr(""); }).catch((e) => setErr(e?.message || "That profile didn't load."));
  useEffect(() => { setData(null); setTab("posts"); void load(); }, [handle, ctx.me?.handle, ctx.me?.photo, ctx.me?.cover, ctx.me?.name, ctx.me?.bio]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = usePaged<Post, string>((c) => ctx.api(`/api/earshot/social/profile/${encodeURIComponent(handle)}/posts?tab=${tab}${c ? `&before=${encodeURIComponent(c)}` : ""}`).then((b) => ({ items: b.posts || [], next: b.next ?? null })), [handle, tab]);

  if (err) return <div><TopBar onBack={onBack} title="Profile" /><Empty title="This account doesn't exist" text="Try searching for another." /></div>;
  if (!data) return <div><TopBar onBack={onBack} /><div className="elev2 aspect-[3/1] max-h-[200px] w-full" /><Spinner /></div>;
  const p = data.profile, me = data.me;
  const follow = () => {
    if (ctx.needProfile()) return;
    const on = !data.followed;
    setData({ ...data, followed: on, followers: Math.max(0, data.followers + (on ? 1 : -1)) });
    ctx.api("/api/earshot/social/follow", { method: "POST", body: { handle: p.handle, on } }).then(() => onChanged?.()).catch((e) => { ctx.say(e.message); void load(); });
  };
  const block = (on: boolean) => ctx.api("/api/earshot/social/block", { method: "POST", body: { handle: p.handle, on } })
    .then(() => { ctx.say(on ? `You blocked @${p.handle}.` : `@${p.handle} is unblocked.`); void load(); list.reset(); }).catch((e) => ctx.say(e.message));
  const share = () => shareOrCopy(linkTo(`u/${p.handle}`), `${p.name} (@${p.handle}) on Pod+`, ctx.say);
  const tabs: [Tab, string][] = [["posts", "Posts"], ["media", "Media"], ["clips", "Clips"], ["podcast", "Podcasts"], ...(me ? [["likes", "Likes"], ["saved", "Saved"]] as [Tab, string][] : [])];
  const empty: Record<Tab, [string, string]> = {
    posts: me ? ["You haven't posted yet", "When you post, it'll show up here."] : [`@${p.handle} hasn't posted`, "When they do, their posts will show up here."],
    media: ["No photos or videos yet", me ? "Photos and videos you post will show up here." : "When they post photos or videos, they'll show up here."],
    clips: ["No clips yet", "Clip a moment while an episode plays: tap Share, then Clip a moment."],
    podcast: ["No episodes yet", me ? "Publish your own podcast from Create." : "Episodes they publish will show up here."],
    likes: ["You haven't liked any posts yet", "Tap the heart on any post. Only you can see your likes."],
    saved: ["Save posts for later", "Tap the bookmark on any post. Only you can see what you've saved."],
  };

  return <div className="min-h-full min-w-0 overflow-x-hidden pb-8">
    <TopBar onBack={onBack} title={<span className="flex items-center gap-1">{p.name}{p.verified && <Verified size={18} />}</span>} sub={`${compactCount(data.posts)} ${data.posts === 1 ? "post" : "posts"}`}
      right={!onBack && me ? <button type="button" onClick={() => setMenu(true)} aria-label="More" className="hov grid h-10 w-10 place-items-center rounded-full"><MoreHorizontal size={20} /></button> : undefined} />
    <div className="sx-profile-cover relative h-32 w-full overflow-hidden sm:h-40" style={{ background: coverBg(p.handle) }}>
      {p.cover && <img src={p.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
    </div>
    <div className="px-4 sm:px-6">
      <div className="flex items-start justify-between gap-2">
        <div className="relative -mt-11 flex-none sm:-mt-12"><Avatar p={p} size={84} ring="0 0 0 4px var(--surface)" /></div>
        <div className="flex min-w-0 flex-wrap justify-end gap-2 pt-3">
          {me ? <>
            <button type="button" onClick={share} aria-label="Share profile" className="btn-line grid h-9 w-9 place-items-center rounded-full"><Share size={17} /></button>
            <PillButton kind="line" onClick={onEdit}>Edit profile</PillButton>
          </> : <>
            <button type="button" onClick={() => setMenu(true)} aria-label="More" className="btn-line grid h-9 w-9 place-items-center rounded-full"><MoreHorizontal size={18} /></button>
            {!data.blocked && <button type="button" onClick={() => ctx.openChatWith(p.handle)} aria-label={`Message @${p.handle}`} className="btn-line grid h-9 w-9 place-items-center rounded-full"><Mail size={17} /></button>}
            {data.blocked ? <PillButton kind="line" className="!text-[#f4212e]" onClick={() => block(false)}>Blocked</PillButton> : <FollowButton on={data.followed} followsYou={data.followsYou} onToggle={follow} />}
          </>}
        </div>
      </div>
      <div className="mt-2">
        <h1 className="flex items-center gap-1 text-[22px] font-extrabold leading-tight">{p.name}{p.verified && <Verified size={20} />}</h1>
        <p className="muted flex items-center gap-2 text-[15px]">@{p.handle}{data.followsYou && <span className="elev2 rounded px-1.5 py-px text-[12px] font-semibold">Follows you</span>}</p>
      </div>
      {p.bio && <p className="mt-3 text-[15px] leading-snug"><RichText text={p.bio} onMention={ctx.openProfile} onTag={ctx.openTag} /></p>}
      <div className="muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
        {p.location && <span className="flex items-center gap-1"><MapPin size={16} />{p.location}</span>}
        {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer nofollow ugc" className="link flex items-center gap-1 hover:underline"><Link2 size={16} className="muted" />{p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 40)}</a>}
        {joinedOn(p.joined) && <span className="flex items-center gap-1"><CalendarDays size={16} />{joinedOn(p.joined)}</span>}
      </div>
      <div className="mt-3 flex gap-5 text-[15px]">
        <button type="button" onClick={() => onPeople(p.handle, "following")} className="hover:underline"><b>{compactCount(data.following)}</b> <span className="muted">Following</span></button>
        <button type="button" onClick={() => onPeople(p.handle, "followers")} className="hover:underline"><b>{compactCount(data.followers)}</b> <span className="muted">{data.followers === 1 ? "Follower" : "Followers"}</span></button>
      </div>
      {!me && data.mutualCount > 0 && <button type="button" onClick={() => onPeople(p.handle, "followers")} className="muted mt-3 flex items-center gap-2 text-left text-[13px]">
        <span className="flex -space-x-2">{data.mutuals.map((m) => <Avatar key={m.handle} p={m} size={20} ring="0 0 0 2px var(--bg)" />)}</span>
        <span>Followed by {data.mutuals.map((m) => m.name).slice(0, 2).join(", ")}{data.mutualCount > 2 ? ` and ${data.mutualCount - 2} ${data.mutualCount - 2 === 1 ? "other" : "others"} you follow` : ""}</span>
      </button>}
      {data.favorites.length > 0 && <div className="mt-4">
        <p className="text-[13px] font-bold uppercase tracking-wide muted">Favorite podcasts</p>
        <div className="noscroll -mx-4 mt-2 flex gap-3 overflow-x-auto px-4">{data.favorites.map((s) => <div key={s.id} className="w-[76px] flex-none" title={s.name}>
          <img src={hiRes(s.art, 200)} alt="" referrerPolicy="no-referrer" className="elev2 aspect-square w-full rounded-xl object-cover" />
          <p className="mt-1 line-clamp-2 text-[12px] leading-tight">{s.name}</p>
        </div>)}</div>
      </div>}
    </div>

    {data.blocked ? <Empty title={`You blocked @${p.handle}`} text="They can't follow you, message you or see your posts." action={<PillButton onClick={() => block(false)}>Unblock</PillButton>} /> : <>
      <div className="glass noscroll sticky top-[53px] z-10 mt-3 flex overflow-x-auto border-b line" role="tablist">{tabs.map(([t, l]) => <TabBtn key={t} on={tab === t} onClick={() => setTab(t)}>{l}</TabBtn>)}</div>
      {!list.items && (tab === "media" ? <Spinner /> : <><PostSkeleton /><PostSkeleton /></>)}
      {list.err && <div role="alert" className="border-b line px-5 py-7 text-center"><p className="text-[15px] font-semibold">Posts could not be loaded.</p><p className="muted mt-1 text-[13px]">{list.err}</p><PillButton kind="line" className="mt-3" onClick={list.reset}>Try again</PillButton></div>}
      {list.items && tab === "media" && list.items.length > 0 && <div className="pt-0.5"><Grid posts={list.items} onOpen={(x) => ctx.openPost(x)} /></div>}
      {list.items && tab !== "media" && list.items.map((x) => <PostCard key={x.id} post={x} ctx={ctx} onChange={(np) => list.patch(x.id, () => np)} onGone={() => list.patch(x.id, () => null)} />)}
      {list.items && !list.items.length && !list.err && <Empty title={empty[tab][0]} text={empty[tab][1]} action={me && tab === "posts" ? <PillButton kind="accent" onClick={() => ctx.compose()}>Write a post</PillButton> : undefined} />}
      {list.items && list.items.length > 0 && <Sentinel onSeen={list.more} done={list.done} />}
    </>}

    {menu && <ActionSheet onClose={() => setMenu(false)} items={me ? [
      { label: "Share profile", icon: <Share size={18} />, onClick: share },
      { label: "Blocked accounts", icon: <Ban size={18} />, onClick: () => setBlockedOpen(true) },
      { label: "Community rules", icon: <ShieldCheck size={18} />, onClick: () => window.open(policyLinks().rules, "_blank", "noopener") },
      { label: "Privacy Policy", icon: <ShieldCheck size={18} />, onClick: () => window.open(policyLinks().privacy, "_blank", "noopener") },
      { label: "Contact support", icon: <LifeBuoy size={18} />, onClick: () => window.open(policyLinks().support, "_blank", "noopener") },
    ] : [
      { label: "Share profile", icon: <Share size={18} />, onClick: share },
      data.blocked ? { label: `Unblock @${p.handle}`, icon: <Ban size={18} />, onClick: () => block(false) } : { label: `Block @${p.handle}`, icon: <Ban size={18} />, danger: true, onClick: () => block(true) },
      { label: `Report @${p.handle}`, icon: <Flag size={18} />, danger: true, onClick: () => setReporting(true) },
    ]} />}
    {reporting && <ReportSheet api={ctx.api} path={`/api/earshot/social/profile/${encodeURIComponent(p.handle)}/report`} what="account" onClose={() => setReporting(false)} onDone={(m) => ctx.say(m)} />}
    {blockedOpen && <BlockedSheet ctx={ctx} onClose={() => setBlockedOpen(false)} />}
  </div>;
}

function BlockedSheet({ ctx, onClose }: { ctx: SCtx; onClose: () => void }) {
  const [people, setPeople] = useState<Profile[] | null>(null);
  useEffect(() => { ctx.api("/api/earshot/social/blocked").then((b) => setPeople(b.people || [])).catch(() => setPeople([])); }, [ctx]);
  const unblock = (h: string) => ctx.api("/api/earshot/social/block", { method: "POST", body: { handle: h, on: false } }).then(() => { setPeople((l) => (l || []).filter((x) => x.handle !== h)); ctx.say(`@${h} is unblocked.`); }).catch((e) => ctx.say(e.message));
  return <Sheet title="Blocked accounts" onClose={onClose}>
    <div className="overflow-y-auto">{!people ? <Spinner /> : !people.length ? <p className="muted px-6 py-10 text-center text-[15px]">You haven't blocked anyone.</p>
      : people.map((x) => <div key={x.handle} className="flex items-center gap-3 px-4 py-3"><Avatar p={x} size={40} /><div className="min-w-0 flex-1"><b className="block truncate text-[15px]">{x.name}</b><span className="muted block truncate text-[14px]">@{x.handle}</span></div><PillButton small kind="line" onClick={() => unblock(x.handle)}>Unblock</PillButton></div>)}</div>
  </Sheet>;
}

/** Followers / Following, with tabs to switch. */
export function PeopleScreen({ handle, which: start, ctx, onBack }: { handle: string; which: "followers" | "following"; ctx: SCtx; onBack: () => void }) {
  const [which, setWhich] = useState(start);
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => { setPeople(null); ctx.api(`/api/earshot/social/profile/${encodeURIComponent(handle)}/${which}`).then((b) => setPeople(b.people || [])).catch(() => setPeople([])); }, [handle, which, ctx]);
  const follow = (x: Person) => {
    if (ctx.needProfile()) return;
    const on = !x.followed;
    setPeople((l) => (l || []).map((y) => (y.handle === x.handle ? { ...y, followed: on } : y)));
    ctx.api("/api/earshot/social/follow", { method: "POST", body: { handle: x.handle, on } }).catch((e) => ctx.say(e.message));
  };
  return <div className="min-h-full">
    <TopBar onBack={onBack} title={`@${handle}`} />
    <div className="flex border-b line" role="tablist"><TabBtn on={which === "followers"} onClick={() => setWhich("followers")}>Followers</TabBtn><TabBtn on={which === "following"} onClick={() => setWhich("following")}>Following</TabBtn></div>
    {!people ? <Spinner /> : !people.length
      ? <Empty title={which === "followers" ? "No followers yet" : "Not following anyone yet"} text={which === "followers" ? "When people follow this account, they'll show up here." : "When this account follows people, they'll show up here."} />
      : people.map((x) => <PersonRow key={x.handle} p={x} ctx={ctx} onOpen={() => ctx.openProfile(x.handle)} onFollow={() => follow(x)} />)}
  </div>;
}

/** Make or edit your profile: photo, cover, name, username, bio, location, website, favorite podcasts. */
export function EditProfile({ ctx, initial, onClose, onSaved }: { ctx: SCtx; initial: Profile | null; onClose: () => void; onSaved: (p: Profile) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [photo, setPhoto] = useState(initial?.photo ?? "");
  const [cover, setCover] = useState(initial?.cover ?? "");
  /** A new profile needs the community rules agreed to (App Review Guideline 1.2). */
  const [agreed, setAgreed] = useState(!!initial);
  const [up, setUp] = useState<"" | "photo" | "cover">("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<any>(null);
  const [favs, setFavs] = useState<{ id: string; name: string; art: string; author?: string }[]>([]);
  const [finding, setFinding] = useState(false);
  const favsChanged = useRef(false);
  const photoIn = useRef<HTMLInputElement>(null), coverIn = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!initial) return;
    ctx.api("/api/earshot/social/me").then((b) => { setPage(b.page || null); const w = (b.page?.widgets || []).find((x: any) => x?.type === "top8"); setFavs(w?.shows || []); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (file: File | undefined, which: "photo" | "cover") => {
    if (!file) return;
    if (!/^image\//.test(file.type)) return ctx.say("Pick a photo.");
    setUp(which);
    const go = () => uploadMedia(ctx.api, file, () => {});
    try {
      let m; try { m = await go(); } catch (e) { if (e instanceof NeedSignIn && (await ctx.signIn())) m = await go(); else throw e; }
      (which === "photo" ? setPhoto : setCover)(m.url);
    } catch (e: any) { if (!(e instanceof NeedSignIn)) ctx.say(e?.message || "That didn't upload."); else ctx.say("Sign in with your email to add photos."); }
    finally { setUp(""); }
  };
  const save = async () => {
    const h = handle.trim().toLowerCase().replace(/^@/, "");
    if (!name.trim()) return ctx.say("Add your name.");
    if (!/^[a-z0-9_]{3,20}$/.test(h)) return ctx.say("Usernames are 3-20 letters, numbers or _.");
    if (!agreed) return ctx.say("Agree to the community rules first.");
    setBusy(true);
    try {
      const b = await ctx.api("/api/earshot/social/me", { method: "POST", body: { agreed: true, handle: h, name: name.trim(), bio: bio.trim(), avatar: initial?.avatar || "🎧", photo, cover, website: website.trim(), location: location.trim() } });
      if (favsChanged.current) {
        const widgets = [...(page?.widgets || []).filter((w: any) => w?.type !== "top8"), { id: "w-top8", type: "top8", col: "main", shows: favs }];
        await ctx.api("/api/earshot/social/me/page", { method: "POST", body: { page: { ...(page || {}), widgets } } }).catch(() => {});
      }
      ctx.say(initial ? "Profile saved." : "Welcome to Pod+ Social!");
      onSaved(b.profile);
    } catch (e: any) { ctx.say(e?.message || "That didn't save."); }
    finally { setBusy(false); }
  };
  const field = "elev w-full rounded-xl px-3.5 py-3 text-[15px] outline-none ring-1 ring-transparent focus:ring-[color:var(--link)]";
  const me: Profile = { handle: handle || "you", name: name || "You", bio, avatar: "", photo };

  return <Sheet onClose={onClose} full wide>
    <div className="flex flex-none items-center gap-2 border-b line px-3 py-2">
      <button type="button" onClick={onClose} aria-label="Close" className="hov grid h-9 w-9 place-items-center rounded-full"><X size={20} /></button>
      <h3 className="flex-1 text-[17px] font-bold">{initial ? "Edit profile" : "Create your profile"}</h3>
      <PillButton onClick={save} disabled={busy || !!up || !agreed}>{busy ? <Loader2 size={16} className="animate-spin" /> : initial ? "Save" : "Create"}</PillButton>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto pb-8">
      <div className="relative aspect-[3/1] w-full overflow-hidden" style={{ background: coverBg(handle) }}>
        {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/30">
          <button type="button" onClick={() => coverIn.current?.click()} aria-label="Change cover photo" className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white hover:bg-black/70">{up === "cover" ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}</button>
          {cover && <button type="button" onClick={() => setCover("")} aria-label="Remove cover photo" className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white hover:bg-black/70"><X size={20} /></button>}
        </div>
      </div>
      <div className="px-4">
        <div className="relative -mt-10 w-fit">
          <Avatar p={me} size={84} ring="0 0 0 4px var(--bg)" />
          <button type="button" onClick={() => photoIn.current?.click()} aria-label="Change profile photo" className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white">{up === "photo" ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}</button>
        </div>
        {photo && <button type="button" onClick={() => setPhoto("")} className="link mt-1 text-[13px] font-semibold">Remove photo</button>}
        <input ref={photoIn} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0], "photo"); e.target.value = ""; }} />
        <input ref={coverIn} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0], "cover"); e.target.value = ""; }} />
        <label className="mt-4 block"><span className="muted mb-1 block text-[13px] font-semibold">Name</span><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={field} placeholder="Your name" /></label>
        <label className="mt-3 block"><span className="muted mb-1 block text-[13px] font-semibold">Username</span>
          <span className={`${field} flex items-center gap-0.5`}><span className="muted">@</span><input value={handle} maxLength={20} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} className="min-w-0 flex-1 bg-transparent outline-none" placeholder="username" autoCapitalize="none" /></span></label>
        <label className="mt-3 block"><span className="muted mb-1 flex justify-between text-[13px] font-semibold"><span>Bio</span><span>{bio.length}/160</span></span><textarea value={bio} maxLength={160} rows={3} onChange={(e) => setBio(e.target.value)} className={`${field} resize-none`} placeholder="What you're into" /></label>
        <label className="mt-3 block"><span className="muted mb-1 block text-[13px] font-semibold">Location</span><input value={location} maxLength={40} onChange={(e) => setLocation(e.target.value)} className={field} placeholder="City, state" /></label>
        <label className="mt-3 block"><span className="muted mb-1 block text-[13px] font-semibold">Website</span><input value={website} maxLength={100} onChange={(e) => setWebsite(e.target.value)} className={field} placeholder="yoursite.com" inputMode="url" autoCapitalize="none" /></label>
        {!initial && <RulesAgree agreed={agreed} onChange={setAgreed} />}
        {initial && <div className="mt-5">
          <div className="flex items-center justify-between"><span className="text-[15px] font-bold">Favorite podcasts</span>{favs.length < 8 && <button type="button" onClick={() => setFinding(true)} className="link flex items-center gap-1 text-[14px] font-bold"><Plus size={16} />Add</button>}</div>
          {!favs.length && <p className="muted mt-1 text-[14px]">Show up to 8 favorite shows on your profile.</p>}
          <div className="mt-2 grid grid-cols-4 gap-3">{favs.map((s) => <div key={s.id} className="relative">
            <img src={hiRes(s.art, 200)} alt="" referrerPolicy="no-referrer" className="elev2 aspect-square w-full rounded-xl object-cover" />
            <button type="button" onClick={() => { favsChanged.current = true; setFavs((l) => l.filter((x) => x.id !== s.id)); }} aria-label={`Remove ${s.name}`} className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/80 text-white"><X size={13} /></button>
            <p className="mt-1 line-clamp-2 text-[11px] leading-tight">{s.name}</p>
          </div>)}</div>
        </div>}
      </div>
    </div>
    {finding && <ShowFinder ctx={ctx} onClose={() => setFinding(false)} onPick={(s) => { favsChanged.current = true; setFavs((l) => (l.some((x) => x.id === s.id) ? l : [...l, s].slice(0, 8))); setFinding(false); }} />}
  </Sheet>;
}

function ShowFinder({ ctx, onPick, onClose }: { ctx: SCtx; onPick: (s: { id: string; name: string; art: string; author?: string }) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [shows, setShows] = useState<any[] | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setShows(null); return; }
    let live = true;
    const t = setTimeout(() => ctx.api(`/api/earshot/search?q=${encodeURIComponent(q.trim())}`).then((b) => { if (live) setShows(b.shows || []); }).catch(() => { if (live) setShows([]); }), 300);
    return () => { live = false; clearTimeout(t); };
  }, [q, ctx]);
  return <Sheet title="Add a favorite podcast" onClose={onClose} full>
    <div className="px-4 py-3"><label className="elev flex min-h-11 items-center gap-2 rounded-full px-4"><Search size={18} className="muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search podcasts" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" /></label></div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {shows === null ? <p className="muted px-6 py-8 text-center text-[15px]">Type a podcast's name.</p> : !shows.length ? <p className="muted px-6 py-8 text-center text-[15px]">No podcasts found.</p>
        : shows.slice(0, 25).map((s) => <button key={s.id} type="button" onClick={() => onPick({ id: String(s.id), name: s.name, art: s.art, author: s.author })} className="hov flex w-full items-center gap-3 px-4 py-2.5 text-left">
          <img src={hiRes(s.art, 120)} alt="" referrerPolicy="no-referrer" className="elev2 h-12 w-12 flex-none rounded-lg object-cover" />
          <span className="min-w-0"><b className="block truncate text-[15px]">{s.name}</b><span className="muted block truncate text-[13px]">{s.author}</span></span>
        </button>)}
    </div>
  </Sheet>;
}
