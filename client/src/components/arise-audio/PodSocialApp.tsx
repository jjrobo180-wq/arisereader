// Podster Social, a Premium plugin of its own in To Duo (it was a page inside Podster until Nov 15, 2026).
// The same posts, people and profiles as Podster Social (server/podcastSocial.ts), drawn with To Duo's own
// cards: For you and Following feeds, posting, likes, comments, finding people, and reporting or blocking
// anyone. A shared episode opens in the Podcasts plugin.
import { useCallback, useEffect, useState } from "react";
import { Ban, Flag, Heart, Loader2, MessageCircle, MoreHorizontal, Play, Repeat2, Search, Send, UserPlus, Users } from "lucide-react";
import { duoAppHash, superAppOf } from "@shared/superApps";
import { RULES, REPORT_REASONS, policyLinks } from "@/components/family-hub/earshot/social/Rules";
import { ago, artOf, compact, shown, type Comment, type Person, type Post, type Profile } from "@/components/family-hub/earshot/EarshotSocial";
import { Empty, Modal, inputClass, plain, primary } from "@/components/family-hub/ui";
import { PageStrip, SuperHead } from "@/components/super-apps/SuperShell";
import { usePodApi, type PodApi } from "./podApi";

function Avatar({ p, size = 40 }: { p: Pick<Profile, "handle" | "name">; size?: number }) {
  const h = [...(p.handle || p.name || "?")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 11);
  const letters = (p.name || p.handle || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join("").toUpperCase() || "?";
  return <span className="grid shrink-0 select-none place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: `hsl(${h} 45% 52%)` }}>{letters}</span>;
}

/** Opens a shared episode in the Podcasts plugin (#/…?go=podcasts&s=…&e=…, handled by AriseTodo). */
const openEpisode = (showId: string, id: string) => {
  const route = window.location.hash.replace(/^#/, "").split("?")[0] || "/lifehub";
  window.location.hash = `${route}?${duoAppHash("podcasts", { s: showId, e: id }).split("?")[1]}`;
};

type Ctx = { api: PodApi; say: (m: string) => void; me: Profile | null; needProfile: () => void; hide: (handle: string) => void };

function Comments({ post, ctx, onClose, onCount }: { post: Post; ctx: Ctx; onClose: () => void; onCount: (n: number) => void }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { ctx.api(`/api/earshot/social/posts/${post.id}/comments`).then((b) => setList(b.comments || [])).catch(() => setList([])); }, [ctx, post.id]);
  const send = () => {
    if (!ctx.me) return ctx.needProfile();
    setBusy(true);
    ctx.api(`/api/earshot/social/posts/${post.id}/comments`, { method: "POST", body: { body } })
      .then((b) => { const next = [...(list || []), b.comment].filter(Boolean); setList(next); onCount(next.length); setBody(""); })
      .catch((e) => ctx.say(e.message)).finally(() => setBusy(false));
  };
  return <Modal title="Comments" eyebrow="Podster Social" onClose={onClose}>
    {!list ? <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-violet-600" /></div>
      : !list.length ? <p className="py-6 text-center text-sm text-slate-500">No comments yet. Say something.</p>
      : <ul className="space-y-3">{list.map((c) => <li key={c.id} className="flex gap-2.5"><Avatar p={c.author} size={32} />
        <span className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3 py-2"><span className="block text-xs font-bold text-slate-800">{c.author.name} <span className="font-medium text-slate-400">@{c.author.handle} · {ago(c.at)}</span></span><span className="block whitespace-pre-wrap text-sm text-slate-700">{c.body}</span></span>
      </li>)}</ul>}
    <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) send(); }} className="mt-4 flex gap-2">
      <input value={body} onChange={(e) => setBody(e.target.value.slice(0, 500))} placeholder="Add a comment…" aria-label="Comment" className={inputClass} />
      <button type="submit" disabled={busy || !body.trim()} className={primary} aria-label="Send"><Send size={16} /></button>
    </form>
  </Modal>;
}

function PostCard({ post: raw, ctx }: { post: Post; ctx: Ctx }) {
  const p = shown(raw);
  const [liked, setLiked] = useState(p.liked);
  const [likes, setLikes] = useState(p.likes);
  const [comments, setComments] = useState(p.comments);
  const [talk, setTalk] = useState(false);
  const [menu, setMenu] = useState<"" | "menu" | "report">("");
  const like = () => {
    if (!ctx.me) return ctx.needProfile();
    const on = !liked; setLiked(on); setLikes((n) => Math.max(0, n + (on ? 1 : -1)));
    ctx.api(`/api/earshot/social/posts/${p.id}/like`, { method: "POST", body: { on } }).catch(() => { setLiked(!on); setLikes((n) => Math.max(0, n + (on ? -1 : 1))); });
  };
  const report = (reason: string) => { setMenu(""); ctx.api(`/api/earshot/social/posts/${p.id}/report`, { method: "POST", body: { reason } }).then(() => { ctx.say("Thanks. We'll look at this post within 24 hours."); ctx.hide(`post:${p.id}`); }).catch((e) => ctx.say(e?.message || "That report didn't send. Try again.")); };
  const block = () => { setMenu(""); ctx.api("/api/earshot/social/block", { method: "POST", body: { handle: p.author.handle, on: true } }).then(() => { ctx.say(`You blocked @${p.author.handle}.`); ctx.hide(p.author.handle); }).catch((e) => ctx.say(e.message)); };
  const ep = p.episode;
  return <article className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08]" data-testid="podsocial-post">
    {raw !== p && <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-400"><Repeat2 size={13} />{raw.author.name} reposted</p>}
    <header className="flex items-start gap-3">
      <Avatar p={p.author} />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#232139]">{p.author.name}</p><p className="truncate text-xs font-medium text-slate-400">@{p.author.handle} · {ago(p.at)}</p></div>
      {!p.mine && <button type="button" onClick={() => setMenu("menu")} aria-label="More" className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><MoreHorizontal size={18} /></button>}
    </header>
    {p.caption && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-slate-800">{p.caption}</p>}
    {p.clip?.quote && <blockquote className="mt-3 rounded-2xl border-l-4 border-violet-400 bg-violet-50 px-3 py-2 text-sm italic text-violet-900">“{p.clip.quote}”</blockquote>}
    {ep && <button type="button" onClick={() => openEpisode(ep.showId, ep.id)} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-2.5 text-left hover:bg-slate-100">
      <img src={artOf(ep)} alt="" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded-xl bg-slate-200 object-cover" />
      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold uppercase tracking-wide text-slate-400">{ep.show}</span><span className="line-clamp-2 block text-sm font-bold text-slate-800">{ep.title}</span></span>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#6e5ae0] text-white"><Play size={14} fill="currentColor" className="translate-x-px" /></span>
    </button>}
    <footer className="mt-3 flex items-center gap-1 text-sm font-bold text-slate-500">
      <button type="button" onClick={like} aria-pressed={liked} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 hover:bg-rose-50 ${liked ? "text-rose-600" : ""}`}><Heart size={16} className={liked ? "fill-rose-500 text-rose-500" : ""} />{likes > 0 ? compact(likes) : "Like"}</button>
      <button type="button" onClick={() => setTalk(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 hover:bg-violet-50"><MessageCircle size={16} />{comments > 0 ? compact(comments) : "Comment"}</button>
    </footer>
    {talk && <Comments post={p} ctx={ctx} onClose={() => setTalk(false)} onCount={setComments} />}
    {menu && <Modal title={menu === "report" ? "Why are you reporting this?" : `@${p.author.handle}`} eyebrow="Podster Social" onClose={() => setMenu("")}>
      <div className="grid gap-2">{menu === "report"
        ? REPORT_REASONS.map((r) => <button key={r} type="button" onClick={() => report(r)} className={`${plain} justify-start`}><Flag size={16} />{r}</button>)
        : <><button type="button" onClick={() => setMenu("report")} className={`${plain} justify-start`}><Flag size={16} />Report this post</button>
          <button type="button" onClick={block} className={`${plain} justify-start text-rose-600`}><Ban size={16} />Block @{p.author.handle}</button></>}
      </div>
    </Modal>}
  </article>;
}

function MakeProfile({ api, say, onDone, onClose }: { api: PodApi; say: (m: string) => void; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const links = policyLinks();
  const save = () => { setBusy(true); api("/api/earshot/social/me", { method: "POST", body: { agreed, name, handle, bio: "", avatar: "🎧" } }).then(() => { say("Welcome! Your profile is live."); onDone(); }).catch((e) => say(e.message)).finally(() => setBusy(false)); };
  return <Modal title="Make your profile" eyebrow="Podster Social" onClose={onClose}>
    <div className="space-y-3">
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name or a nickname" className={inputClass} /></label>
      <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Username</span>
        <span className="flex items-center rounded-xl border border-slate-200 bg-white pl-3 focus-within:border-violet-400"><span className="text-slate-400">@</span><input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))} placeholder="podfan_22" className="min-h-11 w-full bg-transparent px-1 text-sm font-medium text-slate-800 outline-none" /></span></label>
      <p className="text-xs text-slate-500">Your profile and posts are public.</p>
      <div className="rounded-2xl bg-slate-50 p-3 text-[13px] leading-snug text-slate-600">
        <p className="font-bold text-slate-800">Community rules</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        <label className="mt-2 flex min-h-11 items-start gap-2 font-semibold text-slate-800"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[#6e5ae0]" /><span>I agree to the <a href={links.terms} target="_blank" rel="noreferrer" className="underline">Terms of Use</a> and community rules.</span></label>
      </div>
      <button type="button" onClick={save} disabled={busy || !name.trim() || handle.length < 3 || !agreed} className={`${primary} w-full min-h-12`}>{busy ? "Saving…" : "Save"}</button>
    </div>
  </Modal>;
}

function People({ api, say, me, needProfile }: { api: PodApi; say: (m: string) => void; me: Profile | null; needProfile: () => void }) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => { const t = setTimeout(() => { api(`/api/earshot/social/people?q=${encodeURIComponent(q.trim())}`).then((b) => setPeople(b.people || [])).catch(() => setPeople([])); }, 300); return () => clearTimeout(t); }, [api, q]);
  const follow = (p: Person) => {
    if (!me) return needProfile();
    const on = !p.followed;
    setPeople((l) => (l || []).map((x) => (x.handle === p.handle ? { ...x, followed: on } : x)));
    api("/api/earshot/social/follow", { method: "POST", body: { handle: p.handle, on } }).catch((e) => say(e.message));
  };
  return <div className="space-y-3">
    <label className="relative block"><span className="sr-only">Find people</span><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find people by name or @username" className={`${inputClass} pl-9`} /></label>
    {!people ? <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-violet-600" /></div>
      : !people.length ? <p className="py-8 text-center text-sm font-semibold text-slate-500">No one found.</p>
      : <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{people.map((p) => <div key={p.handle} className="flex items-center gap-3 rounded-[1.25rem] border border-[#e7e8f0] bg-white p-3">
        <Avatar p={p} />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#232139]">{p.name}</span><span className="block truncate text-xs text-slate-400">@{p.handle}{p.bio ? ` · ${p.bio}` : ""}</span></span>
        {me?.handle !== p.handle && <button type="button" onClick={() => follow(p)} className={p.followed ? plain : primary}>{p.followed ? "Following" : <><UserPlus size={15} />Follow</>}</button>}
      </div>)}</div>}
  </div>;
}

export default function PodSocialApp({ say, start }: { say: (m: string) => void; start?: string | null }) {
  const app = superAppOf("podsocial")!;
  const { api } = usePodApi();
  const [page, setPage] = useState(start && app.pages.some((p) => p.id === start) ? start : "foryou");
  const [me, setMe] = useState<Profile | null | undefined>(undefined);
  const [making, setMaking] = useState(false);
  const loadMe = useCallback(() => api("/api/earshot/social/me").then((b) => setMe(b.profile ?? null)).catch(() => setMe(null)), [api]);
  useEffect(() => { void loadMe(); }, [loadMe]);
  const needProfile = useCallback(() => setMaking(true), []);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const ctx: Ctx = { api, say, me: me ?? null, needProfile, hide: (k) => setHidden((s) => new Set(s).add(k)) };

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [next, setNext] = useState<string | number | null>(null);
  const [err, setErr] = useState("");
  const [more, setMore] = useState(false);
  const feedUrl = (c: string | number | null) => `/api/earshot/social/feed?tab=${page === "following" ? "following" : "foryou"}${c != null ? (page === "following" ? `&before=${encodeURIComponent(String(c))}` : `&page=${c}`) : ""}`;
  useEffect(() => {
    if (page === "people") return;
    let live = true;
    setPosts(null); setErr(""); setNext(null);
    api(feedUrl(null)).then((b) => { if (live) { setPosts(b.posts || []); setNext(b.next ?? null); } }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [api, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadMore = () => { if (next == null || more) return; setMore(true); api(feedUrl(next)).then((b) => { setPosts((l) => [...(l || []), ...(b.posts || [])]); setNext(b.next ?? null); }).catch(() => {}).finally(() => setMore(false)); };

  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const post = () => {
    if (!me) return needProfile();
    setPosting(true);
    api("/api/earshot/social/posts", { method: "POST", body: { kind: "text", caption: draft } })
      .then((b) => { setDraft(""); if (b?.post) setPosts((l) => [b.post, ...(l || [])]); say("Posted."); })
      .catch((e) => (e?.needProfile ? needProfile() : say(e.message))).finally(() => setPosting(false));
  };
  const visible = (posts || []).filter((x) => !hidden.has(`post:${shown(x).id}`) && !hidden.has(shown(x).author.handle));

  return <div data-testid="super-app-podsocial">
    <SuperHead app={app} right={me ? <span className="hidden items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 ring-1 ring-slate-200 sm:inline-flex"><Avatar p={me} size={30} /><span className="text-sm font-bold text-slate-700">@{me.handle}</span></span> : undefined} />
    <PageStrip app={app} pages={app.pages.map((p) => p.id)} current={page} onPick={setPage} />
    {page === "people" ? <People api={api} say={say} me={me ?? null} needProfile={needProfile} /> : <div className="mx-auto max-w-2xl space-y-3">
      <div className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-3 shadow-[0_8px_28px_#17152b08]">
        {me === null ? <div className="flex flex-wrap items-center justify-between gap-3 p-1"><p className="text-sm text-slate-600">Make a profile to post, like and comment. It uses your To Duo account.</p><button type="button" onClick={needProfile} className={primary} data-testid="podsocial-make-profile">Make your profile</button></div>
          : <div className="flex gap-3">{me && <Avatar p={me} />}
            <div className="min-w-0 flex-1">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 280))} rows={2} placeholder="What are you listening to?" aria-label="New post" className="block w-full resize-none bg-transparent py-2 text-[15px] text-slate-800 outline-none placeholder:text-slate-400" />
              <div className="flex items-center justify-between border-t border-slate-100 pt-2"><span className="text-xs tabular-nums text-slate-400">{280 - draft.length}</span>
                <button type="button" onClick={post} disabled={posting || !draft.trim()} className={primary}>{posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}Post</button></div>
            </div>
          </div>}
      </div>
      {err ? <div className="py-10 text-center"><p className="text-sm font-semibold text-slate-500">{err}</p></div>
        : !posts ? <div className="grid place-items-center py-14" role="status" aria-label="Loading posts"><Loader2 className="animate-spin text-violet-600" size={26} /></div>
        : !visible.length ? <Empty icon={<Users size={26} />} title={page === "following" ? "Nothing from people you follow yet" : "No posts yet"}>{page === "following" ? "Find people to follow on the People page." : "Be the first to post."}</Empty>
        : <>{visible.map((x) => <PostCard key={x.id} post={x} ctx={ctx} />)}
          {next != null && <button type="button" onClick={loadMore} className={`${plain} w-full`}>{more ? <Loader2 size={16} className="animate-spin" /> : null}Show more</button>}</>}
    </div>}
    {making && <MakeProfile api={api} say={say} onClose={() => setMaking(false)} onDone={() => { setMaking(false); void loadMe(); }} />}
  </div>;
}
