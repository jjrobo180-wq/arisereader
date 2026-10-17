import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, Edit3, ExternalLink, Eye, Loader2, Megaphone, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type Kind = "new" | "upcoming";
type Status = "draft" | "published";
type Post = {
  id: string; title: string; summary: string; body: string; kind: Kind;
  status: Status; featured: boolean; imageUrl: string; linkUrl: string;
  createdAt: string; updatedAt: string; publishedAt: string | null;
};
type Draft = Pick<Post, "title" | "summary" | "body" | "kind" | "status" | "featured" | "imageUrl" | "linkUrl">;
const blank = (kind: Kind = "new"): Draft => ({ title: "", summary: "", body: "", kind, status: "draft", featured: false, imageUrl: "", linkUrl: "" });
const date = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";
const readingTime = (body: string) => Math.max(1, Math.ceil(body.split(/\s+/).length / 200));

function ArticleBody({ body }: { body: string }) {
  return <div className="space-y-5 text-[15px] sm:text-base leading-8 text-slate-600">
    {body.split(/\n+/).map((line, i) => {
      const value = line.trim();
      if (!value) return null;
      if (value.startsWith("## ")) return <h2 key={i} className="pt-4 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">{value.slice(3)}</h2>;
      if (value.startsWith("### ")) return <h3 key={i} className="pt-2 text-lg font-extrabold text-slate-900">{value.slice(4)}</h3>;
      if (/^[-*] /.test(value)) return <p key={i} className="flex gap-3"><span aria-hidden="true" className="text-indigo-500">•</span><span>{value.slice(2)}</span></p>;
      return <p key={i}>{value}</p>;
    })}
  </div>;
}

export default function WhatsNew({ embedded = false }: { embedded?: boolean }) {
  const { user, token, adminPreviewMode } = useAuth();
  const canEdit = user?.isAdmin === true && !adminPreviewMode;
  const todo = /^(www\.)?arisetodo\.com$/i.test(window.location.hostname);
  const home = todo ? "/" : "/#/";
  const signIn = todo ? "/app#/signin" : "/#/signin";
  const readerTheme = !todo;
  const accent = todo ? "#5576ed" : "#6e57d9";
  const wash = todo ? "linear-gradient(125deg,#e3faf5 0%,#edf0ff 56%,#f5ecff 100%)" : "linear-gradient(125deg,#eeeaff 0%,#f6f0ff 60%,#fff2ea 100%)";
  const title = todo ? "A.R.I.S.E. To-Do" : "A.R.I.S.E. Reader";
  const [posts, setPosts] = useState<Post[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.hash.split("?")[1] || "").get("post"));
  const [editor, setEditor] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [adminView, setAdminView] = useState(false);
  const [authNotice, setAuthNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const publicResponse = await fetch(`${API_BASE}/api/whats-new`, { cache: "no-store" });
      if (!publicResponse.ok) throw new Error("The updates couldn't load. Please try again.");
      const publicResult = await publicResponse.json();
      setPosts(Array.isArray(publicResult.posts) ? publicResult.posts : []);
      if (canEdit && token) {
        const adminResponse = await fetch(`${API_BASE}/api/admin/whats-new`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (adminResponse.ok) {
          const adminResult = await adminResponse.json();
          setAllPosts(Array.isArray(adminResult.posts) ? adminResult.posts : []);
        } else {
          setAllPosts([]);
        }
      } else setAllPosts([]);
      setLoadError("");
    } catch (err: any) { setLoadError(err?.message || "Unable to load updates."); }
    finally { setLoading(false); }
  }, [canEdit, token]);

  useEffect(() => { void load(); }, [load]);

  const visiblePosts = useMemo(() => (adminView && canEdit ? allPosts : posts)
    .filter(post => filter === "all" || post.kind === filter)
    .filter(post => !query.trim() || (post.title + " " + post.summary + " " + post.body).toLowerCase().includes(query.trim().toLowerCase())),
    [allPosts, posts, adminView, canEdit, filter, query]);
  const current = (adminView && canEdit ? allPosts : posts).find(post => post.id === selectedId) || null;

  function openPost(id: string) {
    setSelectedId(id);
    window.location.hash = `/updates?post=${encodeURIComponent(id)}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function backToList() {
    setSelectedId(null);
    window.location.hash = "/updates";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function startEditor(post?: Post) {
    setEditor(post ? {
      title: post.title, summary: post.summary, body: post.body, kind: post.kind, status: post.status,
      featured: post.featured, imageUrl: post.imageUrl, linkUrl: post.linkUrl,
    } : blank());
    setEditingId(post?.id || null);
    setExpectedUpdatedAt(post?.updatedAt || "");
    setMessage("");
  }
  function patch(field: keyof Draft, value: string | boolean) {
    setEditor(prev => prev ? { ...prev, [field]: value } : prev);
  }
  async function save(status: Status) {
    if (!editor || !token) return;
    if (!editor.title.trim() || !editor.body.trim()) { setMessage("Please add a title and article before saving."); return; }
    setBusy(true); setMessage("");
    try {
      const url = editingId ? `${API_BASE}/api/admin/whats-new/${encodeURIComponent(editingId)}` : `${API_BASE}/api/admin/whats-new`;
      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...editor, status, ...(editingId ? { expectedUpdatedAt } : {}) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Could not save your post.");
      }
      setEditor(null); setAdminView(true); await load();
      setMessage(status === "published" ? "Published to both websites." : "Draft saved privately.");
    } catch (error: any) { setMessage(error?.message || "Unable to save."); }
    finally { setBusy(false); }
  }
  async function remove(post: Post) {
    if (!token || !window.confirm(`Permanently delete "${post.title}" from both websites?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/admin/whats-new/${encodeURIComponent(post.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not delete the post.");
      if (selectedId === post.id) backToList();
      await load();
      setMessage("Post deleted from both websites.");
    } catch (error: any) { setMessage(error.message || "Unable to delete."); }
    finally { setBusy(false); }
  }
  const buttonStyle = { background: accent };
  const badge = (kind: Kind) => kind === "new" ? "What's new" : "Coming soon";
  const accentTag = (kind: Kind) => kind === "new"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
    : "bg-violet-50 text-violet-700 ring-violet-100";

  return <main className="min-h-screen bg-[#fafbfe] text-slate-900" style={{ fontFamily: "'DM Sans',system-ui,sans-serif" }}>
    {!embedded && <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-7">
        <a href={home} className="flex min-w-0 items-center gap-3 font-extrabold tracking-tight text-slate-900" aria-label={`Return to ${title}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-md" style={{ background: todo ? "linear-gradient(135deg,#16bcb0,#6880ec,#9464df)" : "linear-gradient(135deg,#6455da,#9275f5)" }}>
            {todo ? <CheckCircle2 size={21} /> : <BookOpen size={21} />}
          </span>
          <span className="truncate text-sm sm:text-lg">A.R.I.S.E. <span style={{ color: accent }}>{todo ? "To-Do" : "Reader"}</span></span>
        </a>
        <div className="flex items-center gap-2">
          {!user && <a href={signIn} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-extrabold text-indigo-700 sm:text-sm">Admin sign in</a>}
          {user && !canEdit && <a href={signIn} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-extrabold text-indigo-700 sm:text-sm">Switch to admin</a>}
          {canEdit && <button type="button" onClick={() => { backToList(); setAdminView(v => !v); setFilter("all"); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 sm:text-sm">{adminView ? "Public view" : "Manage posts"}</button>}
          <a href={home} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-extrabold text-white sm:text-sm" style={buttonStyle}><ArrowLeft size={15} /> <span className="hidden min-[370px]:inline">Website</span></a>
        </div>
      </div>
    </header>}

    {!selectedId ? <>
      {!embedded && <section className="relative overflow-hidden border-b border-slate-200/60" style={{ background: wash }}>
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-7 sm:py-20">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/75 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.17em] text-slate-600 shadow-sm"><Sparkles size={14} style={{ color: accent }} /> The A.R.I.S.E. journal</div>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.12] tracking-[-.055em] text-slate-950 sm:text-6xl">What's new <span style={{ color: accent }}>&amp; upcoming.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">The latest releases, ideas in progress, and stories shaping A.R.I.S.E. Reader and A.R.I.S.E. To-Do. One place to see what we're building next.</p>
          <div className="mt-7 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600"><span className="rounded-full bg-white/80 px-3 py-2">News &amp; announcements</span><span className="rounded-full bg-white/80 px-3 py-2">Product improvements</span><span className="rounded-full bg-white/80 px-3 py-2">Coming soon</span></div>
        </div>
      </section>}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-7 sm:py-14">
        {embedded && <div className="mb-7"><h1 className="text-2xl font-black tracking-tight sm:text-3xl">News &amp; updates</h1><p className="mt-2 text-sm text-slate-600">Write once, publish to A.R.I.S.E. Reader and A.R.I.S.E. To-Do together.</p></div>}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{adminView && canEdit ? "Editorial dashboard" : "The latest from A.R.I.S.E."}</h2>
            <p className="mt-1 text-sm text-slate-500">{adminView && canEdit ? "Create once. Publish simultaneously on both websites." : "Follow along as we keep making A.R.I.S.E. better."}</p>
          </div>
          {canEdit && <button onClick={() => { setAdminView(true); startEditor(); }} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold text-white shadow-lg" style={buttonStyle}><Plus size={18} /> New post</button>}
        </div>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter updates">
            {([{ key: "all", label: "All updates" }, { key: "new", label: "What's new" }, { key: "upcoming", label: "Upcoming" }] as const).map(option =>
              <button key={option.key} type="button" onClick={() => setFilter(option.key)} className={`rounded-full px-4 py-2.5 text-xs font-extrabold transition sm:text-sm ${filter === option.key ? "text-white shadow" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} style={filter === option.key ? buttonStyle : undefined}>{option.label}</button>)}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-500 sm:w-64"><Search size={16} /><input className="min-w-0 w-full border-0 bg-transparent text-sm text-slate-900 outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search announcements" aria-label="Search announcements" /></label>
        </div>
        {!canEdit && <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-slate-600">Own this website? Sign in with your A.R.I.S.E. administrator account to write and publish announcements.</p><a href={signIn} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white">Admin sign in</a></div>}
        {message && <p role="status" className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">{message}</p>}
        {loading ? <div className="flex items-center gap-3 py-16 text-slate-500"><Loader2 className="animate-spin" size={20} /> Loading announcements...</div> :
         loadError ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{loadError} <button className="ml-2 underline" onClick={() => void load()}>Try again</button></div> :
         !visiblePosts.length ? <div className="rounded-[26px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Megaphone size={30} /></div><h3 className="text-xl font-black">More to share soon</h3><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">Announcements are being prepared. Check back for new features, improvements, and upcoming projects.</p>{canEdit && adminView && <button onClick={() => startEditor()} className="mt-5 rounded-xl px-5 py-3 text-sm font-bold text-white" style={buttonStyle}>Write the first post</button>}</div> :
         <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
           {visiblePosts.map(post => <article key={post.id} className="group flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_8px_32px_rgba(27,43,85,.045)] transition hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(27,43,85,.10)]">
             <button type="button" onClick={() => openPost(post.id)} className="block w-full text-left">
               <div className="relative flex h-44 items-center justify-center overflow-hidden" style={{ background: readerTheme ? "linear-gradient(125deg,#ebe6ff,#e0d9ff,#ffe9eb)" : "linear-gradient(125deg,#def9f4,#dee7ff,#f2e9ff)" }}>
                 {post.imageUrl ? <img src={post.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/70 shadow-lg" style={{ color: accent }}>{post.kind === "new" ? <Sparkles size={32} /> : <Clock3 size={32} />}</span>}
                 {post.featured && <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-700">Featured</span>}
               </div>
               <div className="px-6 pt-6">
                 <div className="mb-4 flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold ring-1 ${accentTag(post.kind)}`}>{badge(post.kind)}</span>{adminView && post.status === "draft" && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-800">Draft</span>}</div>
                 <h3 className="text-xl font-black leading-snug tracking-[-.04em] text-slate-900">{post.title}</h3>
                 <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-500">{post.summary}</p>
               </div>
             </button>
             <div className="mt-auto flex items-center justify-between gap-2 px-6 pb-6 pt-6 text-xs font-bold text-slate-500">
               <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{date(post.publishedAt || post.createdAt)}</span>
               <button onClick={() => openPost(post.id)} className="inline-flex items-center gap-1 hover:underline" style={{ color: accent }}>Read story <ArrowRight size={14} /></button>
             </div>
             {canEdit && adminView && <div className="flex gap-2 border-t border-slate-100 px-6 py-3">
               <button type="button" onClick={() => startEditor(post)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"><Edit3 size={14} /> Edit</button>
               <button type="button" disabled={busy} onClick={() => void remove(post)} className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50"><Trash2 size={14} /> Delete</button>
             </div>}
           </article>)}
         </div>}
      </div>
    </> : <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
      <button type="button" onClick={backToList} className="mb-9 inline-flex items-center gap-2 text-sm font-extrabold text-slate-600 hover:text-indigo-700"><ArrowLeft size={16} /> All updates</button>
      {current ? <article>
        <div className="mb-5 flex flex-wrap gap-3"><span className={`rounded-full px-3 py-2 text-xs font-extrabold ${accentTag(current.kind)}`}>{badge(current.kind)}</span>{current.featured && <span className="rounded-full bg-violet-50 px-3 py-2 text-xs font-extrabold text-violet-700">Featured</span>}</div>
        <h1 className="text-4xl font-black leading-tight tracking-[-.055em] text-slate-950 sm:text-5xl">{current.title}</h1>
        <p className="mt-5 text-lg leading-8 text-slate-500">{current.summary}</p>
        <div className="mt-6 flex flex-wrap items-center gap-5 border-b border-slate-200 pb-7 text-xs font-semibold text-slate-500"><span className="inline-flex items-center gap-2"><CalendarDays size={15} />{date(current.publishedAt || current.createdAt)}</span><span className="inline-flex items-center gap-2"><Clock3 size={15} />{readingTime(current.body)} min read</span></div>
        {current.imageUrl && <img src={current.imageUrl} alt="" className="my-8 w-full rounded-3xl object-cover" />}
        <div className="py-9"><ArticleBody body={current.body} /></div>
        {current.linkUrl && <a href={current.linkUrl} target={current.linkUrl.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-extrabold text-white" style={buttonStyle}>Learn more <ExternalLink size={16} /></a>}
        {canEdit && <button onClick={() => startEditor(current)} className="ml-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-extrabold"><Edit3 size={16} /> Edit post</button>}
      </article> : <div className="rounded-xl bg-white p-10 text-center"><h2 className="font-black text-xl">This article isn't available.</h2><p className="mt-2 text-sm text-slate-500">It may have been unpublished or removed.</p></div>}
    </div>}

    {!embedded && <footer className="border-t border-slate-200 bg-white px-5 py-9 text-center text-xs font-semibold text-slate-500"><p>A.R.I.S.E. Reader + A.R.I.S.E. To-Do · Made to help people grow.</p><div className="mt-3 flex flex-wrap justify-center gap-5"><a href="https://www.arisereader.com/" className="hover:underline">Explore Reader</a><a href="https://arisetodo.com/" className="hover:underline">Explore To-Do</a></div></footer>}

    {editor && canEdit && <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={editingId ? "Edit announcement" : "New announcement"}>
      <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-white shadow-2xl sm:my-10">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-5 sm:px-8"><div><p className="text-xs font-black uppercase tracking-widest text-indigo-600">Shared across both websites</p><h2 className="mt-1 text-xl font-black">{editingId ? "Edit announcement" : "Write an announcement"}</h2></div><button type="button" onClick={() => setEditor(null)} className="rounded-xl border border-slate-200 p-2" aria-label="Close editor"><X size={20} /></button></div>
        <form onSubmit={e => { e.preventDefault(); void save(editor.status); }} className="space-y-5 p-5 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-extrabold text-slate-700">Category<select value={editor.kind} onChange={e => patch("kind", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium"><option value="new">What's new (released)</option><option value="upcoming">Upcoming (planned)</option></select></label>
            <label className="flex items-end gap-3 rounded-xl border border-slate-200 p-4 text-sm font-bold text-slate-700"><input type="checkbox" checked={editor.featured} onChange={e => patch("featured", e.target.checked)} className="h-5 w-5 accent-indigo-600" /> Feature this post first</label>
          </div>
          <label className="block text-sm font-extrabold text-slate-700">Post title<input required maxLength={160} value={editor.title} onChange={e => patch("title", e.target.value)} placeholder="What's changing?" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium outline-indigo-500" /></label>
          <label className="block text-sm font-extrabold text-slate-700">Short summary<textarea value={editor.summary} onChange={e => patch("summary", e.target.value)} rows={2} maxLength={320} placeholder="A short introduction for the homepage cards…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 font-medium outline-indigo-500" /></label>
          <label className="block text-sm font-extrabold text-slate-700">Article content<textarea required maxLength={16000} value={editor.body} onChange={e => patch("body", e.target.value)} rows={10} placeholder={"Tell everyone what's new, why it matters, or what's next.\n\n## Section heading\nWrite a paragraph or use - for a bullet."} className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 font-medium leading-7 outline-indigo-500" /><span className="mt-1 block text-xs font-medium text-slate-400">Paragraphs use blank lines. Use ## for headings and - for bullets. Your text is displayed safely without raw HTML.</span></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-extrabold text-slate-700">Cover image URL <span className="font-normal text-slate-400">(optional)</span><input type="url" value={editor.imageUrl} onChange={e => patch("imageUrl", e.target.value)} placeholder="https://…" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium outline-indigo-500" /></label>
            <label className="block text-sm font-extrabold text-slate-700">Learn more URL <span className="font-normal text-slate-400">(optional)</span><input value={editor.linkUrl} onChange={e => patch("linkUrl", e.target.value)} placeholder="https://… or /page" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium outline-indigo-500" /></label>
          </div>
          {message && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">{message}</p>}
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={() => setEditor(null)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">Cancel</button><button type="button" disabled={busy} onClick={() => void save("draft")} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-extrabold text-indigo-800 disabled:opacity-60"><Eye size={16} /> Save draft</button><button type="button" disabled={busy} onClick={() => void save("published")} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60" style={buttonStyle}>{busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Publish to both</button></div>
        </form>
      </div>
    </div>}
  </main>;
}
