// Earshot/Podscroll social: profiles, a feed of what people share, bookmarks, and podcasts people make
// themselves (upload a file or record one right here). Shared by both apps (server/podcastSocial.ts),
// so it imports nothing from the Arise app itself.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Flag, Heart, Loader2, Mic, MoreHorizontal, Play, Plus, Send, Share2, Square, Trash2, Upload, UserPlus, X } from "lucide-react";
import { clock, durationWords, hiRes, type PodEpisode, type PodShow } from "@shared/earshot";

const ACCENT = "#ff8a3d";
type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
export type Profile = { handle: string; name: string; bio: string; avatar: string };
type PostEpisode = { id: string; showId: string; show: string; title: string; art: string; audio: string; secs: number; date: string; about?: string };
type Post = { id: string; kind: "share" | "bookmark" | "own"; caption: string; at: string; episode: PostEpisode; author: Profile; likes: number; liked: boolean; mine: boolean };

const ago = (iso: string) => { const d = (Date.now() - Date.parse(iso)) / 1000; if (!Number.isFinite(d)) return ""; if (d < 60) return "now"; if (d < 3600) return `${Math.floor(d / 60)}m`; if (d < 86400) return `${Math.floor(d / 3600)}h`; if (d < 86400 * 7) return `${Math.floor(d / 86400)}d`; return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
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

// ===========================================================================
// The Social tab
// ===========================================================================
export function SocialTab({ api, say, onPlay }: { api: Api; say: (m: string) => void; onPlay: (show: PodShow, ep: PodEpisode) => void }) {
  const [me, setMe] = useState<{ profile: Profile | null; followers?: number; following?: number; avatars: string[] } | null>(null);
  const [setupMsg, setSetupMsg] = useState("");
  const [tab, setTab] = useState<"all" | "following">("all");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const loadMe = useCallback(() => api("/api/earshot/social/me").then((b) => { setMe(b); setSetupMsg(""); }).catch((e) => setSetupMsg(e?.message || "Social didn't load.")), [api]);
  const loadFeed = useCallback(() => { setPosts(null); api(`/api/earshot/social/feed?tab=${tab}`).then((b) => setPosts(b.posts || [])).catch((e) => { setPosts([]); setSetupMsg(e?.message || ""); }); }, [api, tab]);
  useEffect(() => { void loadMe(); }, [loadMe]);
  useEffect(() => { loadFeed(); }, [loadFeed]);

  if (setupMsg && !me) return <div className="grid h-full place-items-center p-6 pt-16 text-center"><div><p className="text-lg font-black">Social</p><p className="mt-1 max-w-xs text-sm text-white/60">{setupMsg}</p><button type="button" onClick={() => { void loadMe(); loadFeed(); }} className="mt-4 min-h-11 rounded-full px-5 font-black text-[#24160a]" style={{ background: ACCENT }}>Try again</button></div></div>;
  if (!me) return <div className="grid h-full place-items-center"><Loader2 className="animate-spin" /></div>;
  return <div className="relative h-full"><div className="h-full overflow-y-auto px-4 pb-10 pt-16 [scrollbar-width:none]">
    {me.profile ? <div className="flex items-center gap-3 rounded-3xl bg-white/5 p-3">
      <button type="button" onClick={() => setPerson(me.profile!.handle)} className="grid h-14 w-14 flex-none place-items-center rounded-full bg-white/10 text-3xl">{me.profile.avatar}</button>
      <button type="button" onClick={() => setPerson(me.profile!.handle)} className="min-w-0 flex-1 text-left"><b className="block truncate">{me.profile.name}</b><span className="block truncate text-xs text-white/55">@{me.profile.handle} · {me.followers ?? 0} followers · {me.following ?? 0} following</span></button>
      <button type="button" onClick={() => setEditing(true)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">Edit</button>
    </div> : <div className="rounded-[28px] p-px" style={{ background: "linear-gradient(135deg,rgba(255,138,61,.9),rgba(217,70,239,.7))" }}><div className="rounded-[27px] bg-[#141018] p-4">
      <b className="block text-lg font-black">Join the listening crowd</b>
      <p className="mt-1 text-sm text-white/60">Make a profile to share episodes, show your bookmarks, follow people, and post your own podcast.</p>
      <button type="button" onClick={() => setEditing(true)} className="mt-3 min-h-11 rounded-full px-5 font-black text-[#24160a]" style={{ background: ACCENT }}>Make my profile</button>
    </div></div>}

    <button type="button" onClick={() => (me.profile ? setUploading(true) : setEditing(true))} className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white/5 px-4 text-left ring-1 ring-white/10">
      <span className="grid h-10 w-10 place-items-center rounded-full text-[#24160a]" style={{ background: ACCENT }}><Mic size={20} /></span>
      <span><b className="block text-sm">Make your own podcast</b><span className="block text-xs text-white/55">Record here or upload an episode. It goes on your page for everyone.</span></span>
    </button>

    <div className="mt-5 flex items-center justify-between">
      <div className="flex rounded-full bg-white/10 p-0.5">{([["all", "Everyone"], ["following", "Following"]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={tab === v} onClick={() => setTab(v)} className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold ${tab === v ? "bg-white text-[#120e14]" : "text-white/70"}`}>{l}</button>)}</div>
      <button type="button" onClick={loadFeed} className="text-xs font-bold text-white/55">Refresh</button>
    </div>
    <div className="mt-3 flex flex-col gap-3">
      {!posts && <div className="grid place-items-center py-10"><Loader2 className="animate-spin" /></div>}
      {posts && !posts.length && <p className="py-10 text-center text-sm text-white/55">{tab === "following" ? "Follow people to see what they share here." : "Nothing shared yet. Be the first: tap Share on any episode and Post to your profile."}</p>}
      {posts?.map((p) => <PostCard key={p.id} post={p} api={api} say={say} onPlay={onPlay} onPerson={setPerson} onGone={() => setPosts((list) => (list || []).filter((x) => x.id !== p.id))} />)}
    </div>
    </div>

    {editing && <ProfileEditor api={api} say={say} initial={me.profile} avatars={me.avatars} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void loadMe(); }} />}
    {uploading && <UploadSheet api={api} say={say} onClose={() => setUploading(false)} onDone={() => { setUploading(false); loadFeed(); }} />}
    {person && <PersonPage api={api} say={say} handle={person} onClose={() => setPerson(null)} onPlay={onPlay} onPerson={setPerson} />}
  </div>;
}

function PostCard({ post: p, api, say, onPlay, onPerson, onGone }: { post: Post; api: Api; say: (m: string) => void; onPlay: (show: PodShow, ep: PodEpisode) => void; onPerson: (h: string) => void; onGone: () => void }) {
  const [liked, setLiked] = useState(p.liked);
  const [likes, setLikes] = useState(p.likes);
  const [menu, setMenu] = useState(false);
  const ep = toEpisode(p.episode, p.author.name);
  const like = () => { const on = !liked; setLiked(on); setLikes((n) => Math.max(0, n + (on ? 1 : -1))); api(`/api/earshot/social/posts/${p.id}/like`, { method: "POST", body: { on } }).catch(() => {}); };
  return <article className="overflow-hidden rounded-3xl bg-white/[.04] ring-1 ring-white/10">
    <div className="flex items-center gap-2.5 px-3 pt-3">
      <button type="button" onClick={() => onPerson(p.author.handle)} className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/10 text-lg">{p.author.avatar}</button>
      <button type="button" onClick={() => onPerson(p.author.handle)} className="min-w-0 flex-1 text-left leading-tight"><b className="block truncate text-sm">{p.author.name}</b><span className="block truncate text-[11px] text-white/50">@{p.author.handle} · {p.kind === "own" ? "posted an episode" : p.kind === "bookmark" ? "bookmarked" : "shared"} · {ago(p.at)}</span></button>
      <div className="relative"><button type="button" onClick={() => setMenu((m) => !m)} aria-label="More" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><MoreHorizontal size={18} /></button>
        {menu && <div className="absolute right-0 top-9 z-10 w-40 overflow-hidden rounded-2xl bg-[#262030] text-sm shadow-xl ring-1 ring-white/10">
          {p.mine ? <button type="button" onClick={() => api(`/api/earshot/social/posts/${p.id}`, { method: "DELETE" }).then(() => { say("Deleted."); onGone(); }).catch((e) => say(e.message))} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-rose-300 hover:bg-white/5"><Trash2 size={15} />Delete</button>
            : <button type="button" onClick={() => api(`/api/earshot/social/posts/${p.id}/report`, { method: "POST" }).then(() => { say("Reported. Thanks for keeping it friendly."); onGone(); }).catch((e) => say(e.message))} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5"><Flag size={15} />Report</button>}
        </div>}
      </div>
    </div>
    {p.caption && <p className="whitespace-pre-wrap px-3 pt-2 text-sm leading-relaxed">{p.caption}</p>}
    <button type="button" onClick={() => onPlay(toShow(p.episode, p.author.name), ep)} className="mx-3 mt-2.5 grid w-[calc(100%-1.5rem)] grid-cols-[84px_1fr_auto] items-center gap-3 rounded-2xl bg-black/25 p-2 text-left">
      <img src={hiRes(ep.art, 300)} alt="" referrerPolicy="no-referrer" className="h-[84px] w-[84px] rounded-xl object-cover" />
      <span className="min-w-0"><b className="line-clamp-2 block text-sm leading-snug">{ep.title}</b><span className="mt-0.5 line-clamp-1 block text-xs text-white/55">{ep.show}</span>{ep.secs > 0 && <span className="block text-[11px] text-white/40">{durationWords(ep.secs)}</span>}</span>
      <span className="grid h-10 w-10 place-items-center rounded-full text-[#24160a]" style={{ background: ACCENT }}><Play size={18} fill="currentColor" /></span>
    </button>
    <div className="flex items-center gap-4 px-4 py-2.5">
      <button type="button" onClick={like} aria-pressed={liked} className="flex items-center gap-1.5 text-sm font-bold"><Heart size={19} className={liked ? "fill-rose-500 text-rose-500" : ""} />{likes || ""}</button>
    </div>
  </article>;
}

// ===========================================================================
// Someone's page
// ===========================================================================
function PersonPage({ api, say, handle, onClose, onPlay, onPerson }: { api: Api; say: (m: string) => void; handle: string; onClose: () => void; onPlay: (show: PodShow, ep: PodEpisode) => void; onPerson: (h: string) => void }) {
  const [data, setData] = useState<{ profile: Profile; me: boolean; followers: number; following: number; followed: boolean; posts: Post[] } | null>(null);
  const [err, setErr] = useState("");
  const [which, setWhich] = useState<"own" | "share" | "bookmark">("own");
  useEffect(() => { setData(null); api(`/api/earshot/social/u/${handle}`).then((b) => { setData(b); const own = (b.posts || []).some((p: Post) => p.kind === "own"); setWhich(own ? "own" : "share"); }).catch((e) => setErr(e?.message || "That profile didn't load.")); }, [api, handle]);
  const follow = () => { if (!data) return; const on = !data.followed; setData({ ...data, followed: on, followers: data.followers + (on ? 1 : -1) }); api("/api/earshot/social/follow", { method: "POST", body: { handle, on } }).catch((e) => say(e.message)); };
  const list = (data?.posts || []).filter((p) => p.kind === which);
  return <div className="absolute inset-0 z-40 overflow-y-auto bg-[#120e14] [scrollbar-width:none]" role="dialog" aria-label={`@${handle}`}>
    <div className="relative px-5 pb-5 pt-14 text-center" style={{ background: "linear-gradient(180deg,rgba(255,138,61,.25),transparent)" }}>
      <button type="button" onClick={onClose} aria-label="Back" className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/40"><ChevronLeft size={22} /></button>
      {!data && !err && <Loader2 className="mx-auto mt-10 animate-spin" />}
      {err && <p className="mt-10 text-sm text-white/60">{err}</p>}
      {data && <>
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white/10 text-5xl ring-4 ring-white/10">{data.profile.avatar}</div>
        <h2 className="mt-3 text-2xl font-black">{data.profile.name}</h2>
        <p className="text-sm text-white/55">@{data.profile.handle}</p>
        {data.profile.bio && <p className="mx-auto mt-2 max-w-sm text-sm text-white/75">{data.profile.bio}</p>}
        <p className="mt-2 text-xs text-white/55"><b className="text-white">{data.followers}</b> followers · <b className="text-white">{data.following}</b> following</p>
        {!data.me && <button type="button" onClick={follow} className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-black ${data.followed ? "bg-white/12" : "text-[#24160a]"}`} style={data.followed ? undefined : { background: ACCENT }}><UserPlus size={16} />{data.followed ? "Following" : "Follow"}</button>}
      </>}
    </div>
    {data && <div className="px-4 pb-10">
      <div className="flex gap-1.5">{([["own", "Their podcast"], ["share", "Shared"], ["bookmark", "Bookmarks"]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={which === v} onClick={() => setWhich(v)} className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold ${which === v ? "bg-white text-[#120e14]" : "bg-white/10 text-white/70"}`}>{data.me && v === "own" ? "My podcast" : l} {(data.posts || []).filter((p) => p.kind === v).length || ""}</button>)}</div>
      <div className="mt-3 flex flex-col gap-3">
        {!list.length && <p className="py-8 text-center text-sm text-white/55">{which === "own" ? "No episodes yet." : which === "bookmark" ? "No bookmarks yet." : "Nothing shared yet."}</p>}
        {which === "bookmark" ? <div className="grid grid-cols-3 gap-2.5">{list.map((p) => { const ep = toEpisode(p.episode); return <button key={p.id} type="button" onClick={() => onPlay(toShow(p.episode), ep)} className="text-left"><img src={hiRes(ep.art, 300)} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl object-cover" /><b className="mt-1 line-clamp-2 block text-xs leading-tight">{ep.title}</b></button>; })}</div>
          : list.map((p) => <PostCard key={p.id} post={p} api={api} say={say} onPlay={onPlay} onPerson={onPerson} onGone={() => setData((d) => (d ? { ...d, posts: d.posts.filter((x) => x.id !== p.id) } : d))} />)}
      </div>
    </div>}
  </div>;
}

// ===========================================================================
// Profile, sharing, uploading
// ===========================================================================
function ProfileEditor({ api, say, initial, avatars, onClose, onSaved }: { api: Api; say: (m: string) => void; initial: Profile | null; avatars: string[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [avatar, setAvatar] = useState(initial?.avatar ?? avatars[0] ?? "🎧");
  const [busy, setBusy] = useState(false);
  const save = () => { setBusy(true); api("/api/earshot/social/me", { method: "POST", body: { name, handle, bio, avatar } }).then(() => { say(initial ? "Profile saved." : "Welcome! Your profile is live."); onSaved(); }).catch((e) => say(e.message)).finally(() => setBusy(false)); };
  return <Sheet title={initial ? "Edit profile" : "Make your profile"} onClose={onClose}>
    <div className="overflow-y-auto px-4 pb-5">
      <div className="flex flex-wrap gap-1.5">{avatars.map((a) => <button key={a} type="button" aria-pressed={avatar === a} onClick={() => setAvatar(a)} className={`grid h-11 w-11 place-items-center rounded-full text-2xl ${avatar === a ? "bg-white/25 ring-2 ring-[#ff8a3d]" : "bg-white/5"}`}>{a}</button>)}</div>
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name or a nickname" className={inputCls} /></Field>
      <Field label="Username"><div className="flex items-center rounded-xl border border-white/10 bg-black/30 pl-3"><span className="text-white/45">@</span><input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))} placeholder="podfan_22" className="min-h-11 w-full bg-transparent px-1 text-base outline-none" /></div></Field>
      <Field label="Bio"><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={2} placeholder="What do you love listening to?" className={`${inputCls} py-2`} /></Field>
      <p className="mt-2 text-xs text-white/45">Your profile, what you share, your bookmarks and your episodes are public.</p>
      <button type="button" onClick={save} disabled={busy || !name.trim() || handle.length < 3} className="mt-4 min-h-12 w-full rounded-full font-black text-[#24160a] disabled:opacity-40" style={{ background: ACCENT }}>{busy ? "Saving…" : "Save"}</button>
    </div>
  </Sheet>;
}

/** Share: post it to your profile, or send the link anywhere. */
export function ShareSheet({ api, say, ep, onLink, onClose, social }: { api: Api; say: (m: string) => void; ep: PodEpisode; onLink: () => void; onClose: () => void; social: boolean }) {
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const post = () => { setBusy(true); api("/api/earshot/social/posts", { method: "POST", body: { episode: postEpisodeOf(ep), caption } }).then(() => { say("Posted to your profile."); onClose(); }).catch((e) => say(e?.needProfile || /profile first/i.test(e?.message || "") ? "Make your profile in the Social tab first." : e.message)).finally(() => setBusy(false)); };
  return <Sheet title="Share" onClose={onClose}>
    <div className="px-4 pb-5">
      <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5"><img src={hiRes(ep.art, 200)} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-lg object-cover" /><span className="min-w-0"><b className="line-clamp-1 block text-sm">{ep.title}</b><span className="line-clamp-1 block text-xs text-white/55">{ep.show}</span></span></div>
      {social && <><textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={280} rows={3} placeholder="Say why it's worth a listen…" className={`${inputCls} mt-3 py-2`} />
        <button type="button" onClick={post} disabled={busy} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-black text-[#24160a] disabled:opacity-50" style={{ background: ACCENT }}><Send size={17} />{busy ? "Posting…" : "Post to my profile"}</button></>}
      <button type="button" onClick={() => { onClose(); onLink(); }} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 font-bold"><Share2 size={17} />Send a link</button>
    </div>
  </Sheet>;
}

function UploadSheet({ api, say, onClose, onDone }: { api: Api; say: (m: string) => void; onClose: () => void; onDone: () => void }) {
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
        {rec ? <button type="button" onClick={stop} className="col-span-2 flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-rose-600/90 font-black"><Square size={22} fill="currentColor" />Stop · {clock(recSecs)}</button>
          : <><button type="button" onClick={record} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl font-black text-[#24160a]" style={{ background: ACCENT }}><Mic size={24} />Record</button>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-white/10 font-black"><Upload size={22} />Upload a file<input type="file" accept="audio/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></>}
      </div> : <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Mic size={18} /></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{file.name}</b><span className="text-xs text-white/55">{secs ? durationWords(secs) : ""} · {(file.size / 1024 / 1024).toFixed(1)} MB</span></span><button type="button" onClick={() => setFile(null)} aria-label="Remove" className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X size={15} /></button></div>}
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Episode 1: Why I started this" className={inputCls} /></Field>
      <Field label="What it's about"><textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={1200} rows={3} className={`${inputCls} py-2`} /></Field>
      <Field label="Cover (optional)"><label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 px-3 text-sm text-white/70"><Plus size={16} />{art ? art.name : "Add a square image"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setArt(e.target.files?.[0] ?? null)} /></label></Field>
      {!art && title.trim() && <img src={madeArt(title)} alt="Cover preview" className="mt-2 h-24 w-24 rounded-xl" />}
      <p className="mt-3 text-xs text-white/45">Up to 100 MB. Everyone can find and play it on your page. Only post things you made or have the rights to.</p>
      <button type="button" onClick={publish} disabled={!file || !title.trim() || !!step || !!rec} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full font-black text-[#24160a] disabled:opacity-40" style={{ background: ACCENT }}>{step ? <><Loader2 className="animate-spin" size={18} />{step}</> : "Publish"}</button>
    </div>
  </Sheet>;
}

const inputCls = "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base outline-none focus:border-[#ff8a3d]";
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="mt-3 block"><span className="mb-1 block text-xs font-bold text-white/60">{label}</span>{children}</label>;
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="absolute inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
    <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="flex max-h-[90%] w-full flex-col rounded-t-3xl bg-[#1c1620] pt-2 shadow-2xl">
      <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-white/20" />
      <div className="flex items-center justify-between px-4 pb-2"><h3 className="text-lg font-black">{title}</h3><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X size={18} /></button></div>
      {children}
    </div>
  </div>;
}
