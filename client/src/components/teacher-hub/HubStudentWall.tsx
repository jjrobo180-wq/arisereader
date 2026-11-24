// Student wall: the teacher's posts, announcements and newsletters for families (whole class or chosen
// students, with photos), messages with each family, private family links that need no sign-in, the
// sharing switches for all five class-records plugins, a student look-up for staff, and the school
// overview for admins. Server: server/classRecords.ts.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Copy, ImagePlus, Link2, Megaphone, Newspaper, Pin, PinOff, Search, Send, Trash2, Pencil, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { HubModal } from "./HubModal";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { usePhoto, shrinkPhoto, shortDay, downloadCsv } from "@/lib/records";
import { useRecords, useRecordsSetup, PluginHead, Panel, Btn, Toggle, Avatar, Loading, ErrorNote, ink } from "./records/RecordsUI";
import { ChildRecords, type ChildView } from "@/components/records/ChildRecords";
import { POST_KINDS, POST_KIND_NAMES, RECORD_PLUGINS, PLUGIN_NAMES, audienceLabel, type Audience, type Message, type PostKind, type ShareSettings, type WallPost } from "@shared/classRecords";

type Tab = "wall" | "messages" | "links" | "sharing" | "lookup" | "school";
type Student = { id: number; name: string };
type Inbox = Array<{ studentId: number; last: Message; unread: number }>;
const MAX_PHOTOS = 8;

export function familyLinkUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/#/family?k=${token}`;
}

export default function HubStudentWall() {
  const { user } = useAuth();
  const isAdmin = !!(user?.isAdmin || user?.role === "admin");
  const tabs: Tab[] = ["wall", "messages", "links", "sharing", "lookup", ...(isAdmin ? (["school"] as Tab[]) : [])];
  const [tab, setTab] = useSavedChoice<Tab>("hub-wall-tab", "wall", tabs);
  const req = useRecords();
  const { setup, setSetup, error: setupError, reload, saveShare } = useRecordsSetup();
  const [data, setData] = useState<{ posts: WallPost[]; students: Student[]; inbox: Inbox } | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => req("/api/records/wall").then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)), [req]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30000); return () => window.clearInterval(id); }, [load]);
  const waiting = data?.inbox.reduce((n, t) => n + t.unread, 0) ?? 0;
  const names: Record<Tab, string> = { wall: "Wall", messages: "Messages", links: "Family links", sharing: "Sharing", lookup: "Look up a student", school: "School overview" };

  return (
    <div className="space-y-5" data-testid="hub-student-wall">
      <PluginHead title="Student wall" blurb="Posts, announcements and newsletters for families, and messages with them." shared={setup?.share.parents.wall}
        tabs={tabs.map((id) => ({ id, label: names[id], count: id === "messages" ? waiting : undefined }))} tab={tab} setTab={setTab} />
      <ErrorNote text={error || setupError} retry={() => { void load(); void reload(); }} />
      {tab === "wall" && (data ? <WallTab posts={data.posts} students={data.students} shared={!!setup?.share.parents.wall} onChange={load} /> : !error && <Loading />)}
      {tab === "messages" && (data ? <MessagesTab students={data.students} inbox={data.inbox} onChange={load} /> : !error && <Loading />)}
      {tab === "links" && (setup ? <LinksTab students={setup.students} links={setup.links} onLinks={(links) => setSetup((s) => (s ? { ...s, links } : s))} /> : !setupError && <Loading />)}
      {tab === "sharing" && (setup ? <SharingTab share={setup.share} onChange={saveShare} /> : !setupError && <Loading />)}
      {tab === "lookup" && <LookupTab />}
      {tab === "school" && isAdmin && <SchoolTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ wall */

function TeacherPhoto({ teacherId, name, onRemove }: { teacherId: number; name: string; onRemove?: () => void }) {
  const { token } = useAuth();
  const url = usePhoto(teacherId, name, token);
  return <div className="relative">
    {url ? <img src={url} alt="" className="aspect-square w-full rounded-xl object-cover" /> : <div className="aspect-square w-full animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />}
    {onRemove && <button type="button" onClick={onRemove} aria-label="Remove photo" className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"><X className="h-4 w-4" /></button>}
  </div>;
}

function WallTab({ posts, students, shared, onChange }: { posts: WallPost[]; students: Student[]; shared: boolean; onChange: () => void }) {
  const req = useRecords();
  const [editing, setEditing] = useState<WallPost | "new" | null>(null);
  const [kind, setKind] = useState<PostKind | "all">("all");
  const [err, setErr] = useState("");
  const list = posts.filter((p) => kind === "all" || p.kind === kind);
  const act = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); onChange(); } catch (e: any) { setErr(e.message); } };

  return <div className="space-y-4">
    {!shared && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">The wall isn't shared with families yet, so only you and admins see these posts. Turn it on under Sharing.</p>}
    <div className="flex flex-wrap items-center gap-2">
      <Btn kind="primary" onClick={() => setEditing("new")} testid="wall-new">New post</Btn>
      <div className="ml-auto flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/10" role="group" aria-label="Show">
        {(["all", ...POST_KINDS] as const).map((k) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${kind === k ? "bg-white text-slate-900 shadow-sm dark:bg-white/20 dark:text-white" : "text-slate-600 dark:text-white/70"}`}>{k === "all" ? "All" : `${POST_KIND_NAMES[k]}s`}</button>)}
      </div>
    </div>
    <ErrorNote text={err} />
    {list.length ? <ul className="space-y-3">{list.map((p) => (
      <li key={p.id}><Panel className={p.kind === "announcement" ? "border-amber-300" : ""}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          {p.kind === "announcement" && <Megaphone className="h-4 w-4 text-amber-600" />}{p.kind === "newsletter" && <Newspaper className="h-4 w-4 text-[#6e5ae0]" />}
          <span>{POST_KIND_NAMES[p.kind]}</span><span>· {shortDay(p.createdAt, true)}{p.editedAt ? " · edited" : ""}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-white/10 dark:text-white/80">{audienceLabel(p.audience, (id) => students.find((s) => s.id === id)?.name ?? "A student")}</span>
          {p.pinned && <span className="inline-flex items-center gap-1 text-[#5b47d6]"><Pin className="h-3.5 w-3.5" />Pinned</span>}
          <span className="ml-auto flex gap-1">
            <IconBtn label={p.pinned ? "Unpin" : "Pin to top"} onClick={() => act(() => req(`/api/records/wall/${p.id}`, { method: "PUT", body: { pinned: !p.pinned } }))}>{p.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</IconBtn>
            <IconBtn label="Edit" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></IconBtn>
            <IconBtn label="Delete" onClick={() => { if (window.confirm("Delete this post and its photos? Families won't see it anymore.")) void act(() => req(`/api/records/wall/${p.id}`, { method: "DELETE" })); }}><Trash2 className="h-4 w-4" /></IconBtn>
          </span>
        </div>
        {p.title && <h3 className={`mt-2 text-lg font-bold ${ink}`}>{p.title}</h3>}
        {p.body && <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 dark:text-white/80">{p.body}</p>}
        {p.photos.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{p.photos.map((f) => <TeacherPhoto key={f} teacherId={p.teacherId} name={f} />)}</div>}
      </Panel></li>
    ))}</ul> : <Panel><p className="text-sm text-slate-500">{posts.length ? "Nothing of this kind yet." : "No posts yet. Share a photo from class, an announcement for families, or a newsletter."}</p></Panel>}
    {editing && <Composer post={editing === "new" ? null : editing} students={students} shared={shared} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChange(); }} />}
  </div>;
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white">{children}</button>;
}

function Composer({ post, students, shared, onClose, onSaved }: { post: WallPost | null; students: Student[]; shared: boolean; onClose: () => void; onSaved: () => void }) {
  const req = useRecords();
  const { user } = useAuth();
  const [kind, setKind] = useState<PostKind>(post?.kind ?? "post");
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [audience, setAudience] = useState<Audience>(post?.audience ?? { kind: "class" });
  const [photos, setPhotos] = useState<string[]>(post?.photos ?? []);
  const [pinned, setPinned] = useState(post?.pinned ?? false);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [err, setErr] = useState("");
  const [find, setFind] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const picked = audience.kind === "students" ? audience.ids : [];
  const toggleKid = (id: number) => setAudience({ kind: "students", ids: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    const list = [...files].slice(0, room);
    if (files.length > room) setErr(`A post holds ${MAX_PHOTOS} photos at most.`); else setErr("");
    setUploading((n) => n + list.length);
    for (const f of list) {
      try { const blob = await shrinkPhoto(f); const r = await req<{ photo: string }>("/api/records/photos", { method: "POST", raw: blob }); setPhotos((p) => [...p, r.photo].slice(0, MAX_PHOTOS)); }
      catch (e: any) { setErr(e.message); }
      finally { setUploading((n) => n - 1); }
    }
  };
  const save = async () => {
    if (audience.kind === "students" && !audience.ids.length) { setErr("Pick at least one student, or choose the whole class."); return; }
    if (kind !== "post" && !title.trim()) { setErr(`Give the ${POST_KIND_NAMES[kind].toLowerCase()} a title.`); return; }
    if (!title.trim() && !body.trim() && !photos.length) { setErr("Write something or add a photo."); return; }
    setBusy(true); setErr("");
    try {
      const payload = { kind, title, body, audience, photos, pinned, notify };
      if (post) await req(`/api/records/wall/${post.id}`, { method: "PUT", body: payload }); else await req("/api/records/wall", { method: "POST", body: payload });
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const input = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white";

  return <HubModal title={post ? "Edit post" : "New post"} onClose={onClose} size="lg">
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/10" role="radiogroup" aria-label="Kind">
        {POST_KINDS.map((k) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-10 rounded-lg text-sm font-semibold ${kind === k ? "bg-white text-slate-900 shadow-sm dark:bg-white/20 dark:text-white" : "text-slate-600 dark:text-white/70"}`}>{POST_KIND_NAMES[k]}</button>)}
      </div>
      <p className="-mt-2 text-xs text-slate-500">{kind === "post" ? "Everyday moments from class, with photos." : kind === "announcement" ? "Something families need to know. Stands out on their page." : "A longer letter home. Room for 12,000 characters."}</p>
      <label className="block"><span className="text-sm font-semibold text-slate-700 dark:text-white/80">Title{kind === "post" ? " (optional)" : ""}</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className={`${input} mt-1`} data-testid="wall-title" /></label>
      <label className="block"><span className="text-sm font-semibold text-slate-700 dark:text-white/80">Message</span><textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={kind === "newsletter" ? 12000 : 4000} rows={kind === "newsletter" ? 10 : 5} className={`${input} mt-1 py-2.5`} data-testid="wall-body" /></label>

      <div>
        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-700 dark:text-white/80">Photos</span><span className="text-xs text-slate-500">{photos.length} of {MAX_PHOTOS}</span></div>
        <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {photos.map((f) => <TeacherPhoto key={f} teacherId={Number(user?.id)} name={f} onRemove={() => setPhotos((p) => p.filter((x) => x !== f))} />)}
          {Array.from({ length: uploading }).map((_, i) => <div key={`u${i}`} className="aspect-square animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />)}
          {photos.length + uploading < MAX_PHOTOS && <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-[#6e5ae0] hover:text-[#5b47d6]"><ImagePlus className="h-5 w-5" />Add</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        <p className="mt-1 text-xs text-slate-500">Only families who can see this post can open its photos.</p>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-700 dark:text-white/80">Who it's for</legend>
        <div className="mt-2 flex gap-2">
          <Btn kind={audience.kind === "class" ? "primary" : "plain"} onClick={() => setAudience({ kind: "class" })}>Whole class</Btn>
          <Btn kind={audience.kind === "students" ? "primary" : "plain"} onClick={() => setAudience({ kind: "students", ids: picked })}>Chosen students{picked.length ? ` (${picked.length})` : ""}</Btn>
        </div>
        {audience.kind === "students" && <div className="mt-3 rounded-xl border border-slate-200 p-2 dark:border-white/10">
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a student" aria-label="Find a student" className={`${input} mb-2 min-h-10`} />
          <ul className="max-h-56 overflow-y-auto">{students.filter((s) => s.name.toLowerCase().includes(find.toLowerCase())).map((s) => (
            <li key={s.id}><label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-slate-50 dark:hover:bg-white/5"><input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggleKid(s.id)} className="h-4 w-4 accent-[#6e5ae0]" /><Avatar id={s.id} name={s.name} size={28} /><span className={`text-sm font-medium ${ink}`}>{s.name}</span></label></li>
          ))}</ul>
          <div className="mt-2 flex gap-2 text-sm"><button type="button" className="font-semibold text-[#5b47d6]" onClick={() => setAudience({ kind: "students", ids: students.map((s) => s.id) })}>Select all</button><button type="button" className="font-semibold text-slate-500" onClick={() => setAudience({ kind: "students", ids: [] })}>Clear</button></div>
        </div>}
      </fieldset>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4 dark:divide-white/10 dark:border-white/10">
        <label className="flex items-center justify-between gap-3 py-3"><span className="text-sm font-semibold text-slate-700 dark:text-white/80">Pin to the top</span><Toggle on={pinned} onChange={setPinned} label="Pin to the top" /></label>
        {!post && <label className="flex items-center justify-between gap-3 py-3"><span className="text-sm"><span className="block font-semibold text-slate-700 dark:text-white/80">Notify families</span>{!shared && <span className="text-xs text-slate-500">The wall isn't shared yet, so no one is notified.</span>}</span><Toggle on={notify && shared} disabled={!shared} onChange={setNotify} label="Notify families" /></label>}
      </div>
      <ErrorNote text={err} />
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={save} disabled={busy || uploading > 0} testid="wall-save">{busy ? "Saving…" : post ? "Save" : "Post"}</Btn></div>
    </div>
  </HubModal>;
}

/* ------------------------------------------------------------------ messages */

function MessagesTab({ students, inbox, onChange }: { students: Student[]; inbox: Inbox; onChange: () => void }) {
  const req = useRecords();
  const [sid, setSid] = useState<number | null>(inbox[0]?.studentId ?? null);
  const [find, setFind] = useState("");
  const [thread, setThread] = useState<{ messages: Message[] } | null>(null);
  const [meta, setMeta] = useState<{ parents: number; link: boolean } | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const open = useCallback(async (id: number) => {
    setSid(id); setThread(null); setErr("");
    try { const r = await req(`/api/records/messages/${id}`); setThread(r.thread); setMeta({ parents: r.parents, link: r.link }); onChange(); } catch (e: any) { setErr(e.message); }
  }, [req, onChange]);
  useEffect(() => { if (sid) void open(sid); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [thread?.messages.length]);
  const send = async () => {
    if (!sid || !body.trim()) return; setBusy(true); setErr("");
    try { const r = await req(`/api/records/messages/${sid}`, { method: "POST", body: { body: body.trim() } }); setThread(r.thread); setBody(""); onChange(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const withThread = new Set(inbox.map((t) => t.studentId));
  const others = students.filter((s) => !withThread.has(s.id) && s.name.toLowerCase().includes(find.toLowerCase()));
  const kid = sid ? byId.get(sid) : null;

  return <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
    <Panel className="p-2">
      <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Message a family" aria-label="Find a student's family" className="mb-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white" />
      <ul className="max-h-[60vh] overflow-y-auto">
        {inbox.filter((t) => (byId.get(t.studentId)?.name ?? "").toLowerCase().includes(find.toLowerCase())).map((t) => { const s = byId.get(t.studentId); if (!s) return null; return (
          <li key={t.studentId}><button type="button" onClick={() => open(t.studentId)} aria-current={sid === t.studentId ? "true" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left ${sid === t.studentId ? "bg-[#f4f2ff] dark:bg-white/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}>
            <Avatar id={s.id} name={s.name} />
            <span className="min-w-0 flex-1"><span className={`flex items-center gap-2 text-sm font-semibold ${ink}`}><span className="truncate">{s.name}</span><span className="ml-auto shrink-0 text-xs font-normal text-slate-500">{shortDay(t.last.at)}</span></span><span className={`block truncate text-sm ${t.unread ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500"}`}>{t.last.from === "teacher" ? "You: " : ""}{t.last.body}</span></span>
            {t.unread > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{t.unread}</span>}
          </button></li>
        ); })}
        {others.length > 0 && <li className="px-2.5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Start a conversation</li>}
        {others.map((s) => <li key={s.id}><button type="button" onClick={() => open(s.id)} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left ${sid === s.id ? "bg-[#f4f2ff] dark:bg-white/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}><Avatar id={s.id} name={s.name} size={30} /><span className={`text-sm ${ink}`}>{s.name}</span></button></li>)}
      </ul>
    </Panel>
    <Panel className="flex min-h-[420px] flex-col p-0">
      {kid ? <>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10"><Avatar id={kid.id} name={kid.name} /><div><p className={`font-semibold ${ink}`}>{kid.name}'s family</p>{meta && <p className="text-xs text-slate-500">{meta.parents ? `${meta.parents} parent account${meta.parents === 1 ? "" : "s"}` : "No parent account yet"}{meta.link ? " · family link on" : ""}{!meta.parents && !meta.link ? " · make a family link so they can read this" : ""}</p>}</div></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: "55vh" }}>
          {!thread ? <Loading /> : thread.messages.length ? thread.messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === "teacher" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ${m.from === "teacher" ? "rounded-br-md bg-[#6e5ae0] text-white" : "rounded-bl-md bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white"}`}><p className="whitespace-pre-wrap">{m.body}</p><p className={`mt-1 text-[11px] ${m.from === "teacher" ? "text-white/75" : "text-slate-500"}`}>{m.authorName} · {shortDay(m.at, true)}</p></div></div>
          )) : <p className="py-8 text-center text-sm text-slate-500">No messages yet. Families are notified when you write.</p>}
          <div ref={end} />
        </div>
        <form className="flex gap-2 border-t border-slate-100 p-3 dark:border-white/10" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} maxLength={2000} rows={2} placeholder={`Write to ${kid.name.split(" ")[0]}'s family`} aria-label="Message" className="min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white" data-testid="msg-body" />
          <button type="submit" disabled={busy || !body.trim()} aria-label="Send" className="inline-flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl bg-[#6e5ae0] text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </form>
        {err && <div className="px-3 pb-3"><ErrorNote text={err} /></div>}
      </> : <p className="m-auto p-8 text-center text-sm text-slate-500">Pick a student to message their family.</p>}
    </Panel>
  </div>;
}

/* ------------------------------------------------------------------ family links */

function LinksTab({ students, links, onLinks }: { students: Student[]; links: Record<string, { token: string; at: string } | null>; onLinks: (l: Record<string, { token: string; at: string } | null>) => void }) {
  const req = useRecords();
  const [busy, setBusy] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const make = async (sid: number, again: boolean) => {
    if (again && !window.confirm("Make a new link? The old link stops working right away.")) return;
    setBusy(sid); setErr("");
    try { const r = await req(`/api/records/links/${sid}`, { method: "POST" }); onLinks({ ...links, [sid]: r.link }); } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };
  const off = async (sid: number) => {
    if (!window.confirm("Turn this link off? The family won't be able to open the page with it.")) return;
    setBusy(sid); setErr("");
    try { await req(`/api/records/links/${sid}`, { method: "DELETE" }); onLinks({ ...links, [sid]: null }); } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };
  const copy = async (sid: number, token: string) => { try { await navigator.clipboard.writeText(familyLinkUrl(token)); setCopied(sid); window.setTimeout(() => setCopied(null), 2000); } catch { window.prompt("Copy this link", familyLinkUrl(token)); } };
  const on = students.filter((s) => links[s.id]);
  return <div className="space-y-4">
    <Panel>
      <h3 className={`font-bold ${ink}`}>Family links</h3>
      <p className="mt-1 text-sm text-slate-500">For families who don't want an account. The link opens their child's page with everything you share, and lets them message you. Anyone with the link can see it, so send it only to the family. Make a new one any time and the old one stops working.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn onClick={() => downloadCsv("family-links.csv", [["Student", "Link"], ...on.map((s) => [s.name, familyLinkUrl(links[s.id]!.token)])])} disabled={!on.length}>Download links (CSV)</Btn>
        <span className="self-center text-sm text-slate-500">{on.length} of {students.length} on</span>
      </div>
    </Panel>
    <ErrorNote text={err} />
    <Panel className="p-0"><ul className="divide-y divide-slate-100 dark:divide-white/10">{students.map((s) => { const l = links[s.id]; return (
      <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
        <Avatar id={s.id} name={s.name} />
        <span className="min-w-0 flex-1"><span className={`block font-semibold ${ink}`}>{s.name}</span><span className="block text-xs text-slate-500">{l ? `Made ${shortDay(l.at)}` : "No link"}</span></span>
        {l ? <>
          <Btn kind="primary" onClick={() => copy(s.id, l.token)} testid={`link-copy-${s.id}`}><Copy className="h-4 w-4" />{copied === s.id ? "Copied" : "Copy link"}</Btn>
          <Btn onClick={() => make(s.id, true)} disabled={busy === s.id} title="Make a new link"><RefreshCw className="h-4 w-4" />New</Btn>
          <Btn kind="danger" onClick={() => off(s.id)} disabled={busy === s.id}>Turn off</Btn>
        </> : <Btn onClick={() => make(s.id, false)} disabled={busy === s.id} testid={`link-make-${s.id}`}><Link2 className="h-4 w-4" />Make link</Btn>}
      </li>
    ); })}</ul>{!students.length && <p className="p-5 text-sm text-slate-500">No students yet.</p>}</Panel>
  </div>;
}

/* ------------------------------------------------------------------ sharing */

function SharingTab({ share, onChange }: { share: ShareSettings; onChange: (s: ShareSettings) => void }) {
  const set = (side: "parents" | "staff", p: (typeof RECORD_PLUGINS)[number], v: boolean) => onChange({ ...share, [side]: { ...share[side], [p]: v } });
  return <Panel>
    <h3 className={`font-bold ${ink}`}>What you share</h3>
    <p className="mt-1 text-sm text-slate-500">Families see only their own child, on the family page or their family link. Staff at your school can look your students up. Admins always see everything. Changes take effect right away.</p>
    <table className="mt-4 w-full text-sm">
      <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-2 font-semibold">Plugin</th><th className="w-24 py-2 text-center font-semibold">Families</th><th className="w-24 py-2 text-center font-semibold">Staff</th></tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-white/10">{RECORD_PLUGINS.map((p) => (
        <tr key={p}><td className={`py-3 font-semibold ${ink}`}>{PLUGIN_NAMES[p]}</td>
          <td className="py-3 text-center"><span className="inline-flex"><Toggle on={share.parents[p]} onChange={(v) => set("parents", p, v)} label={`Share ${PLUGIN_NAMES[p]} with families`} /></span></td>
          <td className="py-3 text-center"><span className="inline-flex"><Toggle on={share.staff[p]} onChange={(v) => set("staff", p, v)} label={`Share ${PLUGIN_NAMES[p]} with staff`} /></span></td></tr>
      ))}</tbody>
    </table>
    <p className="mt-3 text-xs text-slate-500">Messages are always between you and the family; other staff never see them.</p>
  </Panel>;
}

/* ------------------------------------------------------------------ staff look-up */

function StudentView({ sid, onBack }: { sid: number; onBack: () => void }) {
  const req = useRecords();
  const { token } = useAuth();
  const [v, setV] = useState<ChildView | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { setV(null); req(`/api/records/student/${sid}`).then(setV).catch((e) => setErr(e.message)); }, [sid, req]);
  return <div className="space-y-4">
    <Btn onClick={onBack}>Back</Btn>
    <ErrorNote text={err} />
    {v ? <ChildRecords v={v} token={token} head={<div className="flex items-center gap-3"><Avatar id={v.child.id} name={v.child.name} size={44} /><div><h3 className={`text-xl font-bold ${ink}`}>{v.child.name}</h3><p className="text-sm text-slate-500">{v.teachers.map((t) => t.teacher.name).join(", ") || "No teachers"}</p></div></div>} /> : !err && <Loading />}
  </div>;
}

function LookupTab() {
  const req = useRecords();
  const [list, setList] = useState<Array<{ id: number; name: string; teachers: string[] }> | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sid, setSid] = useState<number | null>(null);
  useEffect(() => { req("/api/records/school/students").then((r) => setList(r.students)).catch((e) => setErr(e.message)); }, [req]);
  if (sid) return <StudentView sid={sid} onBack={() => setSid(null)} />;
  const shown = (list ?? []).filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.teachers.some((t) => t.toLowerCase().includes(q.toLowerCase())));
  return <div className="space-y-4">
    <Panel>
      <p className="text-sm text-slate-500">Any student at your school, with what their teachers share with staff.</p>
      <label className="relative mt-3 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Student or teacher name" aria-label="Find a student" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white" /></label>
    </Panel>
    <ErrorNote text={err} />
    {list ? <Panel className="p-0"><ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto dark:divide-white/10">{shown.slice(0, 200).map((s) => (
      <li key={s.id}><button type="button" onClick={() => setSid(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5"><Avatar id={s.id} name={s.name} /><span className="min-w-0"><span className={`block font-semibold ${ink}`}>{s.name}</span><span className="block truncate text-xs text-slate-500">{s.teachers.join(", ")}</span></span></button></li>
    ))}</ul>{!shown.length && <p className="p-5 text-sm text-slate-500">{list.length ? "No one matches." : "No students at your school yet. Your account needs a school for look-ups."}</p>}</Panel> : !err && <Loading />}
  </div>;
}

/* ------------------------------------------------------------------ admin */

type OverviewRow = { teacher: { id: number; name: string }; students: number; share: ShareSettings; attendanceRate: number | null; absences: number; gradeAverage: number | null; missing: number; assignments: number; posts: number; familyMessages: number; waiting: number; links: number };

function SchoolTab() {
  const req = useRecords();
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<OverviewRow | null>(null);
  const [kids, setKids] = useState<Student[] | null>(null);
  const [sid, setSid] = useState<number | null>(null);
  useEffect(() => { req("/api/records/admin/overview").then((r) => setRows(r.teachers)).catch((e) => setErr(e.message)); }, [req]);
  useEffect(() => { if (!open) return; setKids(null); req(`/api/records/admin/teacher/${open.teacher.id}`).then((r) => setKids(r.students)).catch((e) => setErr(e.message)); }, [open, req]);
  if (sid) return <StudentView sid={sid} onBack={() => setSid(null)} />;
  const sum = (k: keyof OverviewRow) => (rows ?? []).reduce((n, r) => n + (Number(r[k]) || 0), 0);
  const fmt = (n: number | null) => (n === null ? "—" : `${n}%`);
  return <div className="space-y-4">
    <ErrorNote text={err} />
    {rows ? <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Teachers", rows.length], ["Students", sum("students")], ["Absences (30 days)", sum("absences")], ["Family messages waiting", sum("waiting")]].map(([k, v]) => <Panel key={String(k)} className="p-4"><p className="text-xs font-semibold text-slate-500">{k}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${ink}`}>{v}</p></Panel>)}</div>
      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">{["Teacher", "Students", "Attendance", "Grade avg", "Missing", "Posts", "Family msgs", "Waiting", "Links", "Shared with families"].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">{rows.map((r) => (
            <tr key={r.teacher.id} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${open?.teacher.id === r.teacher.id ? "bg-[#f4f2ff] dark:bg-white/10" : ""}`} onClick={() => setOpen(r)}>
              <td className={`px-3 py-2.5 font-semibold ${ink}`}>{r.teacher.name}</td><td className="px-3 tabular-nums">{r.students}</td><td className="px-3 tabular-nums">{fmt(r.attendanceRate)}</td><td className="px-3 tabular-nums">{fmt(r.gradeAverage)}</td>
              <td className={`px-3 tabular-nums ${r.missing ? "text-rose-700" : ""}`}>{r.missing}</td><td className="px-3 tabular-nums">{r.posts}</td><td className="px-3 tabular-nums">{r.familyMessages}</td><td className={`px-3 tabular-nums ${r.waiting ? "font-semibold text-rose-700" : ""}`}>{r.waiting}</td><td className="px-3 tabular-nums">{r.links}</td>
              <td className="px-3 text-xs text-slate-600 dark:text-white/70">{RECORD_PLUGINS.filter((p) => r.share.parents[p]).map((p) => PLUGIN_NAMES[p]).join(", ") || "Nothing"}</td>
            </tr>
          ))}</tbody>
        </table>
        {!rows.length && <p className="p-5 text-sm text-slate-500">No teachers with classes at your school yet.</p>}
      </Panel>
      <div className="flex justify-end"><Btn onClick={() => downloadCsv("school-overview.csv", [["Teacher", "Students", "Attendance %", "Grade average %", "Missing", "Assignments", "Posts (30 days)", "Family messages (30 days)", "Waiting", "Family links"], ...rows.map((r) => [r.teacher.name, r.students, r.attendanceRate, r.gradeAverage, r.missing, r.assignments, r.posts, r.familyMessages, r.waiting, r.links])])} disabled={!rows.length}>Download CSV</Btn></div>
      {open && <Panel>
        <div className="flex items-center justify-between"><h3 className={`font-bold ${ink}`}>{open.teacher.name}'s students</h3><IconBtn label="Close" onClick={() => setOpen(null)}><X className="h-4 w-4" /></IconBtn></div>
        {kids ? <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{kids.map((k) => <li key={k.id}><button type="button" onClick={() => setSid(k.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"><Avatar id={k.id} name={k.name} size={30} /><span className={`text-sm font-medium ${ink}`}>{k.name}</span></button></li>)}</ul> : <Loading />}
      </Panel>}
    </> : !err && <Loading />}
  </div>;
}
