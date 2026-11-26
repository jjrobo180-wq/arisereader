// Google in Arise To Do: Classroom, Docs, Calendar and Gmail (rules: shared/googleConnect.ts; server:
// server/googleConnect.ts). Each part connects on its own. Classroom assignments come into the to-do list by
// themselves while the Hub is open; the rest are here, under Tasks, and recent Docs show on Home.
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CalendarPlus, ExternalLink, FileText, Loader2, Mail, RefreshCw, School, Search } from "lucide-react";
import {
  FEATURE_INFO, GOOGLE_FEATURES, attachDoc, classroomSummary, mergeClassroom, taskFromMail,
  type CalendarEvent, type ClassroomItem, type GoogleFeature, type GoogleFile, type GoogleTask, type MailItem,
} from "@shared/googleConnect";
import type { Workspace } from "@shared/teacherHub";
import { api } from "./HubAvailability";
import { Card, Field, GhostButton, PrimaryButton, Select, TextArea } from "./ui";
import { isNativeApp, openOutside } from "@/lib/nativeApp";

type SetWorkspace = Dispatch<SetStateAction<Workspace>>;
type Status = { configured: boolean; connected: boolean; email: string; features: GoogleFeature[] };
type ClassInfo = { id: string; name: string; section: string; link: string };

/** Whether Google is set up and which parts are connected; checked again whenever the app comes back to the front
 *  (connecting happens in a browser tab, and in the iPhone app in Safari). */
export function useGoogleStatus(token: string | null) {
  const [status, setStatus] = useState<Status | null>(null);
  const check = useCallback(async () => {
    if (!token) return;
    try { setStatus(await api(token, "GET", "/api/google/status")); } catch { /* keep what we had */ }
  }, [token]);
  useEffect(() => {
    void check();
    const again = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => { document.removeEventListener("visibilitychange", again); window.removeEventListener("focus", again); };
  }, [check]);
  return { status, check };
}

/** Brings Classroom assignments into the to-do list when the Hub opens and every 15 minutes while it's open. */
export function useClassroomSync(enabled: boolean, token: string | null, setWorkspace: SetWorkspace, makeId: () => string, tell: (text: string) => void) {
  const busy = useRef(false);
  const pull = useRef(async (): Promise<string> => "");
  pull.current = async () => {
    if (!token || busy.current) return "";
    busy.current = true;
    try {
      const { items } = (await api(token, "GET", "/api/google/classroom/assignments")) as { items: ClassroomItem[] };
      let summary = "";
      setWorkspace((p) => {
        const r = mergeClassroom(p.tasks as GoogleTask[], items || [], makeId);
        summary = classroomSummary(r.added, r.updated);
        return r.added || r.updated ? { ...p, tasks: r.tasks } : p;
      });
      if (summary) tell(summary);
      return summary || "Classroom is up to date.";
    } catch (e: any) { return e?.message || "Couldn't reach Classroom."; } finally { busy.current = false; }
  };
  useEffect(() => {
    if (!enabled || !token) return;
    void pull.current();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void pull.current(); }, 15 * 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, token]);
  return () => pull.current();
}

async function connect(token: string | null, feature: GoogleFeature, setNote: (s: string) => void) {
  try {
    const app = isNativeApp();
    const { url } = await api(token, "POST", "/api/google/connect", { feature, app, returnTo: app ? "/" : `${window.location.pathname}${window.location.search.replace(/[?&]google=connected/, "")}` });
    if (app) { openOutside(url); setNote("Finish in Safari, then come back here."); }
    else window.location.href = url;
  } catch (e: any) { setNote(e?.message || "Couldn't start connecting."); }
}

const KIND_LABEL: Record<GoogleFile["kind"], string> = { doc: "Doc", sheet: "Sheet", slides: "Slides", pdf: "PDF", file: "File" };
const open = (url: string) => (isNativeApp() ? openOutside(url) : window.open(url, "_blank", "noopener"));
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };

export default function GoogleCard({ token, workspace, setWorkspace, makeId, syncClassroom, status, check }: {
  token: string | null; workspace: Workspace; setWorkspace: SetWorkspace; makeId: () => string;
  syncClassroom: () => Promise<string>; status: Status | null; check: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  if (!status) return null;
  const on = new Set(status.features);
  return (
    <div data-plugin-anchor="google" className="mt-4 space-y-4">
      <Card title="Google" right={status.connected ? <span className="max-w-[12rem] truncate rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{status.email || "Connected"}</span> : undefined}>
        {!status.configured ? (
          <p className="text-sm leading-6 text-slate-600">Google Classroom, Docs, Calendar and Gmail can connect here once the site owner adds the site's Google sign-in keys (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Render).</p>
        ) : <>
          <p className="text-sm text-slate-600">Connect only the parts you want. Google asks you to allow each one.</p>
          <ul className="mt-3 divide-y divide-slate-100">
            {GOOGLE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1"><div className="font-semibold text-slate-900">{FEATURE_INFO[f].name}</div><p className="text-sm text-slate-600">{FEATURE_INFO[f].does}</p></div>
                {on.has(f) ? <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">On</span>
                  : <PrimaryButton onClick={() => void connect(token, f, setNote)}>Connect</PrimaryButton>}
              </li>
            ))}
          </ul>
          {note && <p className="mt-2 text-sm font-medium text-slate-700" role="status">{note}</p>}
          {status.connected && <div className="mt-2"><GhostButton onClick={() => { void api(token, "POST", "/api/google/disconnect").then(check).then(() => setNote("Google is disconnected. To-dos already brought in stay.")); }}>Disconnect Google</GhostButton></div>}
        </>}
      </Card>
      {on.has("classroom") && <ClassroomPanel token={token} sync={syncClassroom} canPost={on.has("classroomPost")} />}
      {on.has("docs") && <DocsPanel token={token} workspace={workspace} setWorkspace={setWorkspace} />}
      {on.has("calendar") && <CalendarPanel token={token} workspace={workspace} />}
      {on.has("gmail") && <GmailPanel token={token} setWorkspace={setWorkspace} makeId={makeId} />}
    </div>
  );
}

function Busy({ on }: { on: boolean }) { return on ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null; }

// ——— Classroom ———
function ClassroomPanel({ token, sync, canPost }: { token: string | null; sync: () => Promise<string>; canPost: boolean }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [teaching, setTeaching] = useState<ClassInfo[]>([]);
  const [studentClasses, setStudentClasses] = useState<ClassInfo[]>([]);
  const [roster, setRoster] = useState<{ id: string; names: string[] } | null>(null);
  const [post, setPost] = useState({ course: "", kind: "announcement" as "announcement" | "assignment", title: "", text: "", due: "" });
  const load = async () => {
    try { const r = await api(token, "GET", "/api/google/classroom/assignments"); setTeaching(r.teacherClasses || []); setStudentClasses(r.studentClasses || []); } catch (e: any) { setNote(e?.message || ""); }
  };
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const showRoster = async (id: string) => {
    if (roster?.id === id) return setRoster(null);
    try { const r = await api(token, "GET", `/api/google/classroom/courses/${id}/students`); setRoster({ id, names: (r.students || []).map((s: any) => s.name) }); } catch (e: any) { setNote(e?.message || ""); }
  };
  const send = async () => {
    setBusy(true); setNote("");
    try {
      const dueAt = post.due ? new Date(post.due).toISOString() : "";
      const r = await api(token, "POST", `/api/google/classroom/courses/${post.course}/post`, { kind: post.kind, title: post.title, text: post.text, dueAt });
      setNote(post.kind === "assignment" ? "Assignment posted." : "Announcement posted."); setPost({ ...post, title: "", text: "", due: "" });
      if (r.link) open(r.link);
    } catch (e: any) { setNote(e?.message || "Couldn't post."); } finally { setBusy(false); }
  };
  return (
    <Card title="Google Classroom" right={<School className="h-5 w-5 text-slate-500" aria-hidden />}>
      <p className="text-sm text-slate-600">{studentClasses.length ? `Assignments from ${studentClasses.length} class${studentClasses.length === 1 ? "" : "es"} come into your to-dos on their own and check off when turned in.` : "Assignments from classes you're a student in come into your to-dos on their own."}</p>
      <div className="mt-3 flex flex-wrap gap-2"><PrimaryButton disabled={busy} onClick={() => { setBusy(true); void sync().then((s) => { setNote(s); setBusy(false); }); }}><Busy on={busy} /><RefreshCw className="h-4 w-4" aria-hidden />Sync now</PrimaryButton></div>
      {teaching.length > 0 && <div className="mt-4">
        <div className="text-sm font-semibold text-slate-900">Classes you teach</div>
        <ul className="mt-2 space-y-2">
          {teaching.map((c) => <li key={c.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate font-medium">{c.name}{c.section ? ` · ${c.section}` : ""}</span>
              <GhostButton onClick={() => void showRoster(c.id)}>{roster?.id === c.id ? "Hide students" : "Students"}</GhostButton>
              {c.link && <GhostButton onClick={() => open(c.link)}>Open</GhostButton>}</div>
            {roster?.id === c.id && <p className="mt-2 text-sm text-slate-700">{roster.names.length ? roster.names.join(", ") : "No students yet."}</p>}
          </li>)}
        </ul>
        {canPost && <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
          <div className="text-sm font-semibold text-slate-900">Post to a class</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select aria-label="Class" value={post.course} onChange={(e) => setPost({ ...post, course: e.target.value })}><option value="">Pick a class</option>{teaching.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            <Select aria-label="What to post" value={post.kind} onChange={(e) => setPost({ ...post, kind: e.target.value as any })}><option value="announcement">Announcement</option><option value="assignment">Assignment</option></Select>
          </div>
          {post.kind === "assignment" && <div className="grid gap-2 sm:grid-cols-2"><Field aria-label="Assignment title" placeholder="Title" value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} /><Field aria-label="Due" type="datetime-local" value={post.due} onChange={(e) => setPost({ ...post, due: e.target.value })} /></div>}
          <TextArea aria-label={post.kind === "assignment" ? "Instructions" : "Announcement"} placeholder={post.kind === "assignment" ? "Instructions (optional)" : "Write the announcement"} value={post.text} onChange={(e) => setPost({ ...post, text: e.target.value })} />
          <PrimaryButton disabled={busy || !post.course} onClick={() => void send()}><Busy on={busy} />Post</PrimaryButton>
        </div>}
      </div>}
      {note && <p className="mt-2 text-sm font-medium text-slate-700" role="status">{note}</p>}
    </Card>
  );
}

// ——— Docs ———
function DocsPanel({ token, workspace, setWorkspace }: { token: string | null; workspace: Workspace; setWorkspace: SetWorkspace }) {
  const [q, setQ] = useState("");
  const [files, setFiles] = useState<GoogleFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<GoogleFile | null>(null);
  const [taskId, setTaskId] = useState("");
  const [add, setAdd] = useState("");
  const [preview, setPreview] = useState("");
  const open_tasks = workspace.tasks.filter((t) => !t.done);
  const search = async (words = q) => { setBusy(true); try { setFiles((await api(token, "GET", `/api/google/drive/files?q=${encodeURIComponent(words)}`)).files || []); } catch (e: any) { setNote(e?.message || ""); } finally { setBusy(false); } };
  useEffect(() => { void search(""); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const attach = (file: GoogleFile, id: string) => setWorkspace((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, notes: attachDoc(t.notes, file) } : t)) }));
  const newDoc = async () => {
    const task = workspace.tasks.find((t) => t.id === taskId);
    if (!task) return setNote("Pick a to-do first.");
    setBusy(true);
    try { const { file } = await api(token, "POST", "/api/google/docs/create", { title: task.title, text: task.notes || "" }); attach(file, task.id); setNote(`Made "${file.name}" and attached it to the to-do.`); open(file.link); void search(q); }
    catch (e: any) { setNote(e?.message || "Couldn't make the Doc."); } finally { setBusy(false); }
  };
  const pick = async (f: GoogleFile) => {
    setPicked(picked?.id === f.id ? null : f); setPreview(""); setAdd("");
    if (f.kind === "doc" && picked?.id !== f.id) { try { setPreview(((await api(token, "GET", `/api/google/docs/${f.id}/text`)).text || "").slice(0, 1500)); } catch { /* opening still works */ } }
  };
  const append = async () => {
    if (!picked || !add.trim()) return;
    setBusy(true);
    try { await api(token, "POST", `/api/google/docs/${picked.id}/append`, { text: add }); setNote(`Added to "${picked.name}".`); setPreview((p) => `${p}\n${add}`.slice(-1500)); setAdd(""); }
    catch (e: any) { setNote(e?.message || "Couldn't add to the Doc."); } finally { setBusy(false); }
  };
  return (
    <Card title="Google Docs" right={<FileText className="h-5 w-5 text-slate-500" aria-hidden />}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <Field aria-label="Search your Docs" placeholder="Search your Docs, Sheets and Slides" value={q} onChange={(e) => setQ(e.target.value)} />
        <PrimaryButton type="submit" disabled={busy}><Busy on={busy} /><Search className="h-4 w-4" aria-hidden /><span className="sr-only sm:not-sr-only">Search</span></PrimaryButton>
      </form>
      <ul className="mt-3 space-y-2">
        {files.map((f) => <li key={f.id} className="rounded-xl border border-slate-200 p-3">
          <button type="button" onClick={() => void pick(f)} className="flex w-full items-center gap-2 text-left">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">{KIND_LABEL[f.kind]}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
          </button>
          {picked?.id === f.id && <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <PrimaryButton onClick={() => open(f.link)}><ExternalLink className="h-4 w-4" aria-hidden />Open to edit</PrimaryButton>
              <Select aria-label="Attach to a to-do" value="" onChange={(e) => { if (e.target.value) { attach(f, e.target.value); setNote(`Attached to the to-do.`); } }}>
                <option value="">Attach to a to-do…</option>{open_tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            </div>
            {preview && <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-sm text-slate-700">{preview}</pre>}
            {f.kind === "doc" && <div className="flex gap-2"><Field aria-label="Add to the end of the Doc" placeholder="Add a line to the end of this Doc" value={add} onChange={(e) => setAdd(e.target.value)} /><PrimaryButton disabled={busy || !add.trim()} onClick={() => void append()}>Add</PrimaryButton></div>}
          </div>}
        </li>)}
        {!files.length && !busy && <li className="text-sm text-slate-500">No Docs found.</li>}
      </ul>
      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <div className="text-sm font-semibold text-slate-900">Make a new Doc from a to-do</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Select aria-label="To-do" value={taskId} onChange={(e) => setTaskId(e.target.value)}><option value="">Pick a to-do</option>{open_tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Select>
          <PrimaryButton disabled={busy || !taskId} onClick={() => void newDoc()}><Busy on={busy} />Make Doc</PrimaryButton>
        </div>
      </div>
      {note && <p className="mt-2 text-sm font-medium text-slate-700" role="status">{note}</p>}
    </Card>
  );
}

/** Recent Docs on Home, once Docs is connected. */
export function GoogleRecentDocs({ token, status }: { token: string | null; status: Status | null }) {
  const [files, setFiles] = useState<GoogleFile[]>([]);
  const on = !!status?.features.includes("docs");
  useEffect(() => { if (on) void api(token, "GET", "/api/google/drive/files").then((r) => setFiles((r.files || []).slice(0, 6))).catch(() => {}); }, [on, token]);
  if (!on || !files.length) return null;
  return (
    <div className="mt-4"><Card title="Recent Docs">
      <ul className="grid gap-2 sm:grid-cols-2">
        {files.map((f) => <li key={f.id}><button type="button" onClick={() => open(f.link)} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-200 px-3 text-left hover:bg-slate-50">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">{KIND_LABEL[f.kind]}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span></button></li>)}
      </ul>
    </Card></div>
  );
}

// ——— Calendar ———
function CalendarPanel({ token, workspace }: { token: string | null; workspace: Workspace }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [taskId, setTaskId] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = () => api(token, "GET", "/api/google/calendar/events").then((r) => setEvents(r.events || [])).catch((e) => setNote(e?.message || ""));
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const dated = workspace.tasks.filter((t) => !t.done && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate));
  const push = async () => {
    const t = dated.find((x) => x.id === taskId) as GoogleTask | undefined;
    if (!t) return;
    setBusy(true);
    try { await api(token, "POST", "/api/google/calendar/events", { title: t.title, dueDate: t.dueDate, dueTime: t.dueTime || "", notes: t.notes || "", timeZone: tz() }); setNote("On your Google Calendar."); setTaskId(""); void load(); }
    catch (e: any) { setNote(e?.message || "Couldn't add it."); } finally { setBusy(false); }
  };
  const when = (e: CalendarEvent) => { const d = new Date(e.allDay ? `${e.start}T12:00:00` : e.start); return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, e.allDay ? { weekday: "short", month: "short", day: "numeric" } : { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""; };
  return (
    <Card title="Google Calendar" right={<CalendarPlus className="h-5 w-5 text-slate-500" aria-hidden />}>
      <ul className="space-y-1.5">
        {events.slice(0, 10).map((e) => <li key={e.id} className="flex gap-3 text-sm"><span className="w-36 shrink-0 text-slate-500">{when(e)}</span><span className="min-w-0 flex-1 truncate font-medium">{e.title}</span></li>)}
        {!events.length && <li className="text-sm text-slate-500">Nothing in the next 30 days.</li>}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Select aria-label="To-do to put on the calendar" value={taskId} onChange={(e) => setTaskId(e.target.value)}><option value="">Put a to-do on Google Calendar…</option>{dated.map((t) => <option key={t.id} value={t.id}>{t.title} · {t.dueDate}{(t as GoogleTask).dueTime ? ` ${(t as GoogleTask).dueTime}` : ""}</option>)}</Select>
        <PrimaryButton disabled={busy || !taskId} onClick={() => void push()}><Busy on={busy} />Add</PrimaryButton>
      </div>
      {note && <p className="mt-2 text-sm font-medium text-slate-700" role="status">{note}</p>}
    </Card>
  );
}

// ——— Gmail ———
function GmailPanel({ token, setWorkspace, makeId }: { token: string | null; setWorkspace: SetWorkspace; makeId: () => string }) {
  const [mail, setMail] = useState<MailItem[]>([]);
  const [q, setQ] = useState("");
  const [made, setMade] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const load = (words = q) => api(token, "GET", `/api/google/gmail/recent?q=${encodeURIComponent(words)}`).then((r) => setMail(r.mail || [])).catch((e) => setNote(e?.message || ""));
  useEffect(() => { void load(""); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const toTask = (m: MailItem) => {
    const t = taskFromMail(m);
    setWorkspace((p) => ({ ...p, tasks: [...p.tasks, { id: makeId(), title: t.title, notes: t.notes, dueDate: "", recurring: "", done: false }] }));
    setMade(new Set(made).add(m.id)); setNote("Made a to-do.");
  };
  return (
    <Card title="Gmail" right={<Mail className="h-5 w-5 text-slate-500" aria-hidden />}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void load(); }}>
        <Field aria-label="Search email" placeholder="Search your email" value={q} onChange={(e) => setQ(e.target.value)} />
        <PrimaryButton type="submit"><Search className="h-4 w-4" aria-hidden /><span className="sr-only">Search</span></PrimaryButton>
      </form>
      <ul className="mt-3 divide-y divide-slate-100">
        {mail.map((m) => <li key={m.id} className="flex items-start gap-3 py-2.5">
          <div className="min-w-0 flex-1"><div className="truncate font-medium">{m.subject}</div><div className="truncate text-sm text-slate-500">{m.from}</div></div>
          {made.has(m.id) ? <span className="shrink-0 text-sm font-semibold text-emerald-700">Added</span> : <GhostButton onClick={() => toTask(m)}>Make a to-do</GhostButton>}
        </li>)}
        {!mail.length && <li className="py-2 text-sm text-slate-500">No email found.</li>}
      </ul>
      {note && <p className="mt-2 text-sm font-medium text-slate-700" role="status">{note}</p>}
    </Card>
  );
}
