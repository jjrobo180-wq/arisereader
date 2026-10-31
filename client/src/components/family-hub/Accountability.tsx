// Accountability (an Arise To Duo app; shared/accountability.ts, server/accountability.ts): a space
// you share with your partner or family. Ask for something once or on repeat, they're nudged until
// it's done, and they check it off with a photo or video, an AI worksheet, or a quiz your child took.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BadgeCheck, Bell, Camera, Check, ChevronLeft, ClipboardList, Copy, Hand, ListChecks, Loader2, Pencil, Plus, Printer, RotateCcw, Share2, Sparkles, Star, Trash2, Users, Video, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import {
  NAG_CHOICES, addDays, builtinQuiz, builtinWorksheet, checkinFor, dueOn, isDone, localNow, minutesOf, newId, personStats, repeatWords, scoreQuiz, streak, timeWords,
  type AcctTask, type Checkin, type Proof, type ProofKind, type Quiz, type Repeat, type Space, type TaskKind, type Worksheet, type WsItem,
} from "@shared/accountability";
import type { SectionProps } from "./ui";

const TEAL = "#0d9488";
type Data = { me: number; spaces: Space[]; tasks: AcctTask[]; checkins: Checkin[] };
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
const SPACE_KEY = "arise-acct-space";
const hashParam = (k: string) => { const h = window.location.hash, q = h.indexOf("?"); return q < 0 ? "" : new URLSearchParams(h.slice(q + 1)).get(k) || ""; };
const dropHashParam = (k: string) => { try { const h = window.location.hash, q = h.indexOf("?"); if (q < 0) return; const p = new URLSearchParams(h.slice(q + 1)); p.delete(k); const r = p.toString(); window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${h.slice(0, q)}${r ? `?${r}` : ""}`); } catch { /* fine */ } };

function useApi() {
  const { token } = useAuth();
  return useCallback(async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
    const res = await fetch(`${API_BASE}/api/accountability${path}`, { method: init?.method || "GET", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
    const b = await res.json().catch(() => null);
    if (!res.ok) { const e: any = new Error(b?.message || "Accountability can't be reached right now."); e.status = res.status; e.builtin = b?.builtin; throw e; }
    return b as T;
  }, [token]);
}

// ---------------- little pieces ----------------
const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition active:scale-[.98] disabled:opacity-50";
const tealBtn = `${btn} bg-[#0d9488] text-white shadow-[0_6px_18px_#0d948840] hover:bg-[#0f766e]`;
const ghostBtn = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const field = "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100";
const COLORS = ["#0d9488", "#7c3aed", "#e11d48", "#ea580c", "#2563eb", "#ca8a04", "#16a34a", "#db2777"];
const colorOf = (space: Space, userId: number) => COLORS[Math.max(0, space.members.findIndex((m) => m.userId === userId)) % COLORS.length];

function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return <span className="grid shrink-0 place-items-center rounded-full font-black text-white ring-2 ring-white" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>{(name || "?").trim().charAt(0).toUpperCase()}</span>;
}
function Ring({ value, total, color, size = 64 }: { value: number; total: number; color: string; size?: number }) {
  const r = size / 2 - 6, c = 2 * Math.PI * r, pct = total ? value / total : 0;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
    <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef2f7" strokeWidth={7} fill="none" />
    <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
    <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.24} fontWeight={900} fill="#1e293b">{total ? `${value}/${total}` : "—"}</text>
  </svg>;
}
function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <div className="fixed inset-0 z-[500] flex items-end justify-center bg-[#0f172a]/60 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[94dvh] w-full overflow-y-auto overscroll-contain rounded-t-[1.75rem] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[1.75rem] ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black text-slate-900">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600"><X size={18} /></button></div>
      {children}
    </div>
  </div>;
}
function Chips<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="flex flex-wrap gap-2">{options.map(([v, label]) => <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={value === v} className={`min-h-10 rounded-full px-3.5 text-sm font-bold transition ${value === v ? "bg-[#0d9488] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>)}</div>;
}
const Lbl = ({ t, children }: { t: string; children: ReactNode }) => <div className="space-y-1.5"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{t}</p>{children}</div>;

// ---------------- the app ----------------
export default function Accountability({ say }: SectionProps) {
  const api = useApi();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [spaceId, setSpaceId] = useState(() => { try { return localStorage.getItem(SPACE_KEY) || ""; } catch { return ""; } });
  const [tab, setTab] = useState<"today" | "tasks" | "activity">("today");
  const [sheet, setSheet] = useState<null | { kind: "new" } | { kind: "edit"; task: AcctTask } | { kind: "do"; task: AcctTask } | { kind: "task"; task: AcctTask } | { kind: "invite" } | { kind: "start" } | { kind: "join"; code?: string } | { kind: "review"; checkin: Checkin }>(null);
  const [kid, setKid] = useState<AcctTask | null>(null);

  const load = useCallback(async () => {
    try { const d = await api<Data>(`?tz=${encodeURIComponent(TZ)}`); setData(d); setError(""); return d; }
    catch (e: any) { setError(e.message); return null; }
  }, [api]);
  useEffect(() => { void load(); const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30_000); const f = () => { if (document.visibilityState === "visible") void load(); }; document.addEventListener("visibilitychange", f); return () => { clearInterval(t); document.removeEventListener("visibilitychange", f); }; }, [load]);

  const space = data?.spaces.find((s) => s.id === spaceId) ?? data?.spaces[0] ?? null;
  useEffect(() => { if (space && space.id !== spaceId) setSpaceId(space.id); if (space) { try { localStorage.setItem(SPACE_KEY, space.id); } catch { /* fine */ } } }, [space?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = localNow(Date.now(), TZ).day;
  const nowMin = localNow(Date.now(), TZ).minutes;
  const me = data?.me ?? 0;
  const tasks = useMemo(() => (data?.tasks ?? []).filter((t) => t.spaceId === space?.id), [data, space?.id]);
  const checkins = useMemo(() => (data?.checkins ?? []).filter((c) => c.spaceId === space?.id), [data, space?.id]);
  const nameOf = (id: number) => (id === me ? "You" : space?.members.find((m) => m.userId === id)?.name || "Someone");

  // An invite link (#/lifehub?go=accountability&join=CODE) or a tapped notification (…&task=ID).
  useEffect(() => {
    const code = hashParam("join");
    if (code) { dropHashParam("join"); setSheet({ kind: "join", code }); }
  }, []);
  useEffect(() => {
    if (!data) return;
    const id = hashParam("task"); if (!id) return;
    dropHashParam("task");
    const t = data.tasks.find((x) => x.id === id);
    if (t) { setSpaceId(t.spaceId); setSheet(t.assignee === data.me && !isDone(checkinFor(data.checkins, t.id, today)) ? { kind: "do", task: t } : { kind: "task", task: t }); }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>, done?: string) => { try { await fn(); if (done) say(done); await load(); return true; } catch (e: any) { say(e.message); return false; } };

  if (!data) return <div className="grid min-h-[50vh] place-items-center text-slate-500">{error ? <div className="text-center"><p className="font-bold">{error}</p><button type="button" onClick={() => void load()} className={`${ghostBtn} mt-3`}>Try again</button></div> : <Loader2 className="animate-spin" />}</div>;

  // ---- no space yet ----
  if (!space) return <div className="mx-auto max-w-xl space-y-5 pb-24" data-testid="acct-welcome">
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0d9488] via-[#0f766e] to-[#4338ca] p-7 text-white shadow-xl">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" /><div className="absolute -bottom-12 right-16 h-28 w-28 rounded-full bg-white/10" />
      <BadgeCheck size={40} className="relative" />
      <h1 className="relative mt-4 text-3xl font-black leading-tight">Keep each other on track.</h1>
      <p className="relative mt-2 text-[15px] leading-6 text-white/85">Share a space with your partner or family. Ask for something, they get reminded until it's done, and they check it off with a photo, a video, a worksheet or a quiz.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => setSheet({ kind: "start" })} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-teal-300" data-testid="acct-start"><Plus className="text-teal-600" /><p className="mt-3 font-black">Start a space</p><p className="text-sm text-slate-500">Then invite your partner</p></button>
      <button type="button" onClick={() => setSheet({ kind: "join" })} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-teal-300" data-testid="acct-join"><Users className="text-violet-600" /><p className="mt-3 font-black">I have an invite code</p><p className="text-sm text-slate-500">Join someone's space</p></button>
    </div>
    {sheet?.kind === "start" && <StartSheet onClose={() => setSheet(null)} onDone={async (name, myName) => { const ok = await act(async () => { const r = await api<{ id: string }>("/spaces", { method: "POST", body: { name, myName, tz: TZ } }); setSpaceId(r.id); }); if (ok) setSheet({ kind: "invite" }); }} />}
    {sheet?.kind === "join" && <JoinSheet code={sheet.code} onClose={() => setSheet(null)} onDone={async (code, myName) => { const ok = await act(async () => { const r = await api<{ id: string }>("/join", { method: "POST", body: { code, myName, tz: TZ } }); setSpaceId(r.id); }, "You're in!"); if (ok) setSheet(null); }} />}
  </div>;

  // ---- the dashboard ----
  const todays = tasks.filter((t) => dueOn(t, today));
  const forMe = todays.filter((t) => t.assignee === me);
  const iAsked = todays.filter((t) => t.assignee !== me && t.createdBy === me);
  const toReview = checkins.filter((c) => c.status === "done" && c.by !== me && tasks.find((t) => t.id === c.taskId)?.review);
  const members = [...space.members].sort((a, b) => (a.userId === me ? -1 : b.userId === me ? 1 : 0));

  return <div className="mx-auto max-w-3xl space-y-5 pb-28" data-testid="acct-app">
    {/* header */}
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0d9488] via-[#0f766e] to-[#4338ca] p-5 text-white shadow-xl sm:p-6">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-white/70">Accountability</p><h1 className="mt-1 truncate text-2xl font-black">{space.name}</h1>
          <div className="mt-3 flex -space-x-2">{space.members.map((m) => <Avatar key={m.userId} name={m.name} color={colorOf(space, m.userId)} size={32} />)}</div></div>
        <button type="button" onClick={() => setSheet({ kind: "invite" })} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-bold backdrop-blur hover:bg-white/25" data-testid="acct-invite"><Share2 size={15} />Invite</button>
      </div>
      {data.spaces.length > 1 && <div className="relative mt-4 flex gap-2 overflow-x-auto [scrollbar-width:none]">{data.spaces.map((s) => <button key={s.id} type="button" onClick={() => setSpaceId(s.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${s.id === space.id ? "bg-white text-teal-800" : "bg-white/15 text-white"}`}>{s.name}</button>)}<button type="button" onClick={() => setSheet({ kind: "start" })} className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">+ New</button></div>}
    </div>

    <button type="button" onClick={() => setSheet({ kind: "new" })} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-[#0d9488] text-base font-black text-white shadow-[0_12px_30px_#0d948844] transition active:scale-[.98]" data-testid="acct-ask"><Plus size={22} strokeWidth={3} />Ask for something</button>

    {/* everyone's progress */}
    <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none]" data-testid="acct-dashboard">
      {members.map((m) => {
        const st = personStats(m.userId, tasks, checkins, today), color = colorOf(space, m.userId);
        return <div key={m.userId} className="min-w-[15.5rem] flex-1 snap-start rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_8px_28px_#0f172a0d]">
          <div className="flex items-center gap-3"><Ring value={st.todayDone} total={st.todayDue} color={color} />
            <div className="min-w-0"><p className="truncate font-black text-slate-900">{m.userId === me ? "You" : m.name}</p><p className="text-xs font-semibold text-slate-500">today{st.todayDue && st.todayDone === st.todayDue ? " · all done 🎉" : ""}</p><p className="mt-1 text-xs font-bold" style={{ color }}>{st.rate}% this week</p></div></div>
          <div className="mt-3 flex h-10 items-end gap-1.5" aria-label="Last 7 days">{st.week.map((d) => <div key={d.day} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-md bg-slate-100" style={{ height: 30 }}><div className="w-full rounded-md" style={{ height: `${d.due ? (d.done / d.due) * 100 : 0}%`, marginTop: `${d.due ? 30 - (d.done / d.due) * 30 : 30}px`, background: color }} /></div><span className="text-[9px] font-bold text-slate-400">{"SMTWTFS"[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</span></div>)}</div>
        </div>;
      })}
    </div>

    {toReview.length > 0 && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4" data-testid="acct-review">
      <p className="flex items-center gap-2 font-black text-amber-900"><Star size={17} className="fill-amber-400 text-amber-500" />Ready for you to check ({toReview.length})</p>
      <div className="mt-3 space-y-2">{toReview.slice(0, 6).map((c) => { const t = tasks.find((x) => x.id === c.taskId)!; return <button key={c.id} type="button" onClick={() => setSheet({ kind: "review", checkin: c })} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm"><Avatar name={nameOf(c.by)} color={colorOf(space, c.by)} size={30} /><span className="min-w-0 flex-1"><span className="block truncate font-bold">{t.title}</span><span className="text-xs text-slate-500">{nameOf(c.by)} · {c.day === today ? "today" : c.day}{c.score ? ` · ${c.score.right}/${c.score.total} right` : ""}{c.proof.length ? ` · ${c.proof.length} ${c.proof.some((p) => p.type === "video") ? "video" : "photo"}` : ""}</span></span><span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950">Look</span></button>; })}</div>
    </div>}

    <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">{([["today", "Today"], ["tasks", "All tasks"], ["activity", "Activity"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`min-h-10 flex-1 rounded-xl text-sm font-bold ${tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{l}</button>)}</div>

    {tab === "today" && <div className="space-y-5">
      <TaskGroup title="For you" empty="Nothing for you today." tasks={forMe} render={(t) => <TaskRow key={t.id} t={t} c={checkinFor(checkins, t.id, today)} mine nowMin={nowMin} who={nameOf(t.createdBy)} color={colorOf(space, t.createdBy)} streak={streak(t, checkins, today)} onOpen={() => setSheet({ kind: "task", task: t })} onCheck={() => (t.kind === "quiz" ? setKid(t) : setSheet({ kind: "do", task: t }))} />} />
      <TaskGroup title="You asked" empty="Tap Ask to give someone something to do." tasks={iAsked} render={(t) => <TaskRow key={t.id} t={t} c={checkinFor(checkins, t.id, today)} nowMin={nowMin} who={nameOf(t.assignee)} color={colorOf(space, t.assignee)} streak={streak(t, checkins, today)} onOpen={() => setSheet({ kind: "task", task: t })}
        onPoke={() => void act(() => api(`/tasks/${t.id}/poke`, { method: "POST", body: {} }), `Nudged ${nameOf(t.assignee)} 👋`)} />} />
    </div>}
    {tab === "tasks" && <div className="space-y-2.5" data-testid="acct-all">{tasks.length ? tasks.map((t) => <button key={t.id} type="button" onClick={() => setSheet({ kind: "task", task: t })} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-sm"><KindIcon kind={t.kind} /><span className="min-w-0 flex-1"><span className="block truncate font-bold">{t.title}</span><span className="text-xs text-slate-500">{nameOf(t.assignee)} · {repeatWords(t.repeat)} · by {timeWords(t.due)}</span></span>{streak(t, checkins, today) > 1 && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-black text-orange-600">🔥 {streak(t, checkins, today)}</span>}</button>) : <Empty text="No tasks yet. Tap Ask to make the first one." />}</div>}
    {tab === "activity" && <Activity checkins={checkins} tasks={tasks} nameOf={nameOf} colorFor={(id) => colorOf(space, id)} onOpen={(c) => setSheet(c.by !== me && c.status === "done" ? { kind: "review", checkin: c } : { kind: "task", task: tasks.find((t) => t.id === c.taskId)! })} />}

    <p className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><Bell size={14} className="mt-0.5 shrink-0" />Reminders come as notifications from Arise To Duo. Turn them on in Notifications, on every phone in this space.</p>


    {sheet?.kind === "invite" && <InviteSheet space={space} onClose={() => setSheet(null)} onNewCode={() => void act(() => api(`/spaces/${space.id}`, { method: "PATCH", body: { newCode: true } }), "New code made. The old one no longer works.")} say={say} />}
    {sheet?.kind === "start" && <StartSheet onClose={() => setSheet(null)} onDone={async (name, myName) => { const ok = await act(async () => { const r = await api<{ id: string }>("/spaces", { method: "POST", body: { name, myName, tz: TZ } }); setSpaceId(r.id); }); if (ok) setSheet({ kind: "invite" }); }} />}
    {sheet?.kind === "join" && <JoinSheet code={sheet.code} onClose={() => setSheet(null)} onDone={async (code, myName) => { const ok = await act(async () => { const r = await api<{ id: string }>("/join", { method: "POST", body: { code, myName, tz: TZ } }); setSpaceId(r.id); }, "You're in!"); if (ok) setSheet(null); }} />}
    {(sheet?.kind === "new" || sheet?.kind === "edit") && <TaskEditor space={space} me={me} task={sheet.kind === "edit" ? sheet.task : null} api={api} say={say} onClose={() => setSheet(null)}
      onSave={async (task) => { const ok = await act(() => sheet.kind === "edit" ? api(`/tasks/${sheet.task.id}`, { method: "PUT", body: { task } }) : api("/tasks", { method: "POST", body: { spaceId: space.id, task } }), sheet.kind === "edit" ? "Saved." : task.assignee === me ? "Added." : `Sent to ${nameOf(task.assignee)}. They'll be reminded until it's done.`); if (ok) setSheet(null); }} />}
    {sheet?.kind === "do" && <DoSheet task={sheet.task} spaceId={space.id} today={today} api={api} say={say} asker={nameOf(sheet.task.createdBy)} onClose={() => setSheet(null)} onKid={() => { setKid(sheet.task); setSheet(null); }}
      onDone={async (body) => { const ok = await act(() => api("/checkins", { method: "POST", body: { taskId: sheet.task.id, day: today, ...body } }), sheet.task.createdBy === me ? "Checked off ✓" : `Checked off ✓ ${nameOf(sheet.task.createdBy)} will see it.`); if (ok) setSheet(null); }} />}
    {sheet?.kind === "task" && <TaskSheet task={sheet.task} me={me} space={space} checkins={checkins} today={today} api={api} nameOf={nameOf} onClose={() => setSheet(null)}
      onEdit={() => setSheet({ kind: "edit", task: sheet.task })} onDo={() => (sheet.task.kind === "quiz" ? (setKid(sheet.task), setSheet(null)) : setSheet({ kind: "do", task: sheet.task }))}
      onReview={(c) => setSheet({ kind: "review", checkin: c })}
      onDelete={() => { if (window.confirm(`Remove “${sheet.task.title}”?`)) void act(() => api(`/tasks/${sheet.task.id}`, { method: "DELETE" }), "Removed.").then((ok) => ok && setSheet(null)); }} />}
    {sheet?.kind === "review" && <ReviewSheet checkin={sheet.checkin} task={tasks.find((t) => t.id === sheet.checkin.taskId)} who={nameOf(sheet.checkin.by)} api={api} onClose={() => setSheet(null)}
      onReview={async (status, feedback) => { const ok = await act(() => api(`/checkins/${sheet.checkin.id}/review`, { method: "POST", body: { status, feedback } }), status === "approved" ? "Approved ⭐" : "Sent back for a redo."); if (ok) setSheet(null); }} />}
    {kid?.quiz && <KidQuiz quiz={kid.quiz} onClose={() => setKid(null)} onFinish={async (answers) => { const ok = await act(() => api("/checkins", { method: "POST", body: { taskId: kid.id, day: today, answers, note: "" } }), kid.createdBy === me ? "Quiz saved ✓" : `Quiz sent to ${nameOf(kid.createdBy)} ✓`); if (ok) setKid(null); }} />}
  </div>;
}

const Empty = ({ text }: { text: string }) => <p className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-400">{text}</p>;
function KindIcon({ kind }: { kind: TaskKind }) {
  const [Icon, bg, fg] = kind === "worksheet" ? [ClipboardList, "#ede9fe", "#7c3aed"] : kind === "quiz" ? [Sparkles, "#fef3c7", "#d97706"] : [ListChecks, "#ccfbf1", TEAL];
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: bg, color: fg }}><Icon size={19} /></span>;
}
function TaskGroup({ title, empty, tasks, render }: { title: string; empty: string; tasks: AcctTask[]; render: (t: AcctTask) => ReactNode }) {
  return <section><h2 className="mb-2.5 px-1 text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2>{tasks.length ? <div className="space-y-2.5">{tasks.map(render)}</div> : <Empty text={empty} />}</section>;
}
function TaskRow({ t, c, mine, nowMin, who, color, streak: run, onOpen, onCheck, onPoke }: { t: AcctTask; c?: Checkin; mine?: boolean; nowMin: number; who: string; color: string; streak: number; onOpen: () => void; onCheck?: () => void; onPoke?: () => void }) {
  const done = isDone(c), late = !done && nowMin > minutesOf(t.due);
  const status = c?.status === "approved" ? ["Approved", "bg-emerald-100 text-emerald-700"] : c?.status === "done" ? [t.review ? "Waiting for OK" : "Done", t.review ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"] : c?.status === "redo" ? ["Redo", "bg-rose-100 text-rose-700"] : late ? ["Overdue", "bg-rose-50 text-rose-600"] : [`By ${timeWords(t.due)}`, "bg-slate-100 text-slate-600"];
  return <div className={`flex items-center gap-3 rounded-3xl border bg-white p-3.5 shadow-[0_6px_20px_#0f172a0a] transition ${done ? "border-emerald-100" : late ? "border-rose-100" : "border-slate-100"}`} data-testid="acct-row">
    {mine ? <button type="button" onClick={done ? onOpen : onCheck} aria-label={done ? "Done" : `Check off ${t.title}`} className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px] transition active:scale-90 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-teal-500 hover:text-teal-500"}`} data-testid="acct-check"><Check size={24} strokeWidth={3.5} /></button>
      : <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-500 text-white" : "bg-slate-100"}`}>{done ? <Check size={24} strokeWidth={3.5} /> : <Avatar name={who} color={color} size={40} />}</span>}
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
      <span className={`block truncate text-[15px] font-black ${done ? "text-slate-400 line-through decoration-2" : "text-slate-900"}`}>{t.title}</span>
      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
        <span className={`rounded-full px-2 py-0.5 ${status[1]}`}>{status[0]}</span>
        {t.kind !== "task" && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">{t.kind === "quiz" ? "Quiz" : "Worksheet"}</span>}
        {t.proof !== "none" && t.kind === "task" && <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">{t.proof === "video" ? <Video size={11} /> : <Camera size={11} />}{t.proof === "video" ? "Video" : t.proof === "photo" ? "Photo" : "Proof"}</span>}
        {run > 1 && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-600">🔥 {run}</span>}
        <span className="text-slate-400">{mine ? `from ${who}` : who}</span>
      </span>
    </button>
    {onPoke && !done && <button type="button" onClick={onPoke} aria-label={`Nudge ${who}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100" data-testid="acct-poke"><Hand size={18} /></button>}
  </div>;
}

function useProofUrls(api: ReturnType<typeof useApi>, proofs: Proof[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = proofs.map((p) => p.path).join("|");
  useEffect(() => { if (!proofs.length) return; api<{ urls: Record<string, string> }>("/proof-urls", { method: "POST", body: { paths: proofs.map((p) => p.path) } }).then((b) => setUrls(b.urls)).catch(() => {}); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
}
function ProofView({ proofs, api }: { proofs: Proof[]; api: ReturnType<typeof useApi> }) {
  const urls = useProofUrls(api, proofs);
  if (!proofs.length) return null;
  return <div className="grid grid-cols-2 gap-2">{proofs.map((p) => <div key={p.path} className="overflow-hidden rounded-2xl bg-slate-100">{!urls[p.path] ? <div className="grid aspect-square place-items-center"><Loader2 className="animate-spin text-slate-400" /></div> : p.type === "video" ? <video src={urls[p.path]} controls playsInline className="aspect-square w-full bg-black object-contain" /> : <a href={urls[p.path]} target="_blank" rel="noreferrer"><img src={urls[p.path]} alt="Proof" className="aspect-square w-full object-cover" /></a>}</div>)}</div>;
}

function Activity({ checkins, tasks, nameOf, colorFor, onOpen }: { checkins: Checkin[]; tasks: AcctTask[]; nameOf: (id: number) => string; colorFor: (id: number) => string; onOpen: (c: Checkin) => void }) {
  const list = checkins.filter((c) => tasks.some((t) => t.id === c.taskId)).slice(0, 60);
  if (!list.length) return <Empty text="Check-ins show up here." />;
  return <div className="space-y-2.5" data-testid="acct-activity">{list.map((c) => { const t = tasks.find((x) => x.id === c.taskId)!; return <button key={c.id} type="button" onClick={() => onOpen(c)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm">
    <Avatar name={nameOf(c.by)} color={colorFor(c.by)} size={34} />
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold"><span className="text-slate-500">{nameOf(c.by)} · </span>{t.title}</span><span className="text-xs text-slate-400">{new Date(c.at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}{c.score ? ` · ${c.score.right}/${c.score.total}` : ""}{c.proof.length ? ` · 📎${c.proof.length}` : ""}</span></span>
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${c.status === "approved" ? "bg-emerald-100 text-emerald-700" : c.status === "redo" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>{c.status === "approved" ? "⭐ OK" : c.status === "redo" ? "Redo" : "New"}</span>
  </button>; })}</div>;
}

// ---------------- sheets ----------------
function StartSheet({ onClose, onDone }: { onClose: () => void; onDone: (name: string, myName: string) => Promise<void> }) {
  const [name, setName] = useState("Our family"); const [me, setMe] = useState(""); const [busy, setBusy] = useState(false);
  return <Sheet title="Start a space" onClose={onClose}><div className="space-y-4">
    <Lbl t="Space name"><input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Lbl>
    <Lbl t="Your name (what they'll see)"><input className={field} value={me} onChange={(e) => setMe(e.target.value)} placeholder="Dad, Mom, Jay…" maxLength={40} /></Lbl>
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onDone(name, me); setBusy(false); }} className={`${tealBtn} w-full`} data-testid="acct-start-go">{busy ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}Start it</button>
  </div></Sheet>;
}
function JoinSheet({ code: start, onClose, onDone }: { code?: string; onClose: () => void; onDone: (code: string, myName: string) => Promise<void> }) {
  const [code, setCode] = useState(start || ""); const [me, setMe] = useState(""); const [busy, setBusy] = useState(false);
  return <Sheet title="Join a space" onClose={onClose}><div className="space-y-4">
    <Lbl t="Invite code"><input className={`${field} text-center font-mono text-2xl font-black uppercase tracking-[.3em]`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={8} autoCapitalize="characters" data-testid="acct-code" /></Lbl>
    <Lbl t="Your name (what they'll see)"><input className={field} value={me} onChange={(e) => setMe(e.target.value)} placeholder="Mom, Dad, Sam…" maxLength={40} /></Lbl>
    <button type="button" disabled={busy || code.replace(/\W/g, "").length < 6} onClick={async () => { setBusy(true); await onDone(code, me); setBusy(false); }} className={`${tealBtn} w-full`} data-testid="acct-join-go">{busy ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />}Join</button>
  </div></Sheet>;
}
function InviteSheet({ space, onClose, onNewCode, say }: { space: Space; onClose: () => void; onNewCode: () => void; say: (m: string) => void }) {
  const link = `https://arisetodo.com/#/lifehub?go=accountability&join=${space.code}`;
  const text = `Join me in “${space.name}” on Arise To Duo Accountability so we can keep each other on track. Open ${link} or enter code ${space.code} in Accountability.`;
  const share = async () => { try { if (navigator.share) { await navigator.share({ title: "Join me on Accountability", text }); return; } } catch (e: any) { if (e?.name === "AbortError") return; } try { await navigator.clipboard.writeText(text); say("Invite copied. Paste it in a text."); } catch { say(`Your code is ${space.code}`); } };
  return <Sheet title="Invite your partner" onClose={onClose}><div className="space-y-5 text-center" data-testid="acct-invite-sheet">
    <p className="text-sm text-slate-500">They open Arise To Duo, go to Accountability and enter this code (or tap your link).</p>
    <p className="rounded-3xl bg-gradient-to-br from-teal-50 to-violet-50 py-6 font-mono text-4xl font-black tracking-[.3em] text-slate-900" data-testid="acct-code-big">{space.code}</p>
    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void share()} className={tealBtn}><Share2 size={17} />Send invite</button><button type="button" onClick={() => { navigator.clipboard?.writeText(space.code).then(() => say("Code copied."), () => say(space.code)); }} className={ghostBtn}><Copy size={17} />Copy code</button></div>
    <div className="text-left"><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">In this space</p><div className="flex flex-wrap gap-2">{space.members.map((m) => <span key={m.userId} className="flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-3 text-sm font-bold"><Avatar name={m.name} color={colorOf(space, m.userId)} size={26} />{m.name}</span>)}</div></div>
    <button type="button" onClick={onNewCode} className="text-xs font-bold text-slate-400 underline">Make a new code</button>
  </div></Sheet>;
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
function TaskEditor({ space, me, task, api, say, onClose, onSave }: { space: Space; me: number; task: AcctTask | null; api: ReturnType<typeof useApi>; say: (m: string) => void; onClose: () => void; onSave: (t: any) => Promise<void> }) {
  const other = space.members.find((m) => m.userId !== me)?.userId ?? me;
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "task");
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [assignee, setAssignee] = useState(task?.assignee ?? other);
  const [repeat, setRepeat] = useState<Repeat>(task?.repeat ?? { every: "daily", days: [], date: localNow(Date.now(), TZ).day });
  const [due, setDue] = useState(task?.due ?? "15:00");
  const [nag, setNag] = useState(task?.nag ?? 60);
  const [proof, setProof] = useState<ProofKind>(task?.proof ?? "photo");
  const [review, setReview] = useState(task?.review ?? true);
  const [ws, setWs] = useState<Worksheet | null>(task?.worksheet ?? null);
  const [quiz, setQuiz] = useState<Quiz | null>(task?.quiz ?? null);
  const [topic, setTopic] = useState(""); const [age, setAge] = useState(""); const [count, setCount] = useState(8);
  const [making, setMaking] = useState(false); const [busy, setBusy] = useState(false);
  const make = async () => {
    if (!topic.trim()) { say("What should it be about?"); return; }
    setMaking(true);
    const ask = { topic, age, count, extra: "" };
    try {
      if (kind === "worksheet") { const b = await api<{ worksheet: Worksheet }>("/ai/worksheet", { method: "POST", body: ask }); setWs(b.worksheet); }
      else { const b = await api<{ quiz: Quiz }>("/ai/quiz", { method: "POST", body: ask }); setQuiz(b.quiz); }
    } catch {
      // The AI isn't available (set up, busy, or none left on this plan): the built-in maker does it.
      if (kind === "worksheet") setWs(builtinWorksheet(ask)); else setQuiz(builtinQuiz(ask));
      say("Made with the built-in maker. Edit anything you like.");
    }
    if (!title.trim()) setTitle(`${kind === "quiz" ? "Quiz" : "Worksheet"}: ${topic.trim()}`.slice(0, 120));
    setMaking(false);
  };
  const canSave = title.trim() && (kind === "task" || (kind === "worksheet" ? ws?.items.length : quiz?.questions.length));
  return <Sheet title={task ? "Change it" : "Ask for something"} onClose={onClose} wide><div className="space-y-5" data-testid="acct-editor">
    {!task && <div className="grid grid-cols-3 gap-2">{([["task", "To-do", ListChecks], ["worksheet", "AI worksheet", ClipboardList], ["quiz", "Kid quiz", Sparkles]] as const).map(([k, l, I]) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-sm font-black transition ${kind === k ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-100 text-slate-500"}`} data-testid={`acct-kind-${k}`}><I size={22} />{l}</button>)}</div>}
    {kind !== "task" && <div className="space-y-3 rounded-3xl bg-gradient-to-br from-violet-50 to-teal-50 p-4">
      <p className="flex items-center gap-2 text-sm font-black text-violet-800"><Sparkles size={16} />{kind === "quiz" ? "AI makes a quick quiz your child takes on the phone" : "AI makes a worksheet they can fill in, edit or print"}</p>
      <input className={field} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={kind === "quiz" ? "Letter sounds, counting to 10, colors…" : "ABCs, adding to 10, the solar system…"} data-testid="acct-topic" />
      <div className="grid grid-cols-2 gap-2"><input className={field} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age or grade (4, K, 2nd…)" /><select className={field} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n} {kind === "quiz" ? "questions" : "items"}</option>)}</select></div>
      <button type="button" onClick={() => void make()} disabled={making} className={`${btn} w-full bg-violet-600 text-white hover:bg-violet-700`} data-testid="acct-make">{making ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}{(kind === "worksheet" ? ws : quiz) ? "Make a new one" : "Create with AI"}</button>
    </div>}
    {kind === "worksheet" && ws && <WorksheetEditor ws={ws} onChange={setWs} />}
    {kind === "quiz" && quiz && <QuizEditor quiz={quiz} onChange={setQuiz} />}
    <Lbl t="What"><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Teach Ava her ABCs" maxLength={120} data-testid="acct-title" /></Lbl>
    <Lbl t="For"><div className="flex flex-wrap gap-2">{space.members.map((m) => <button key={m.userId} type="button" onClick={() => setAssignee(m.userId)} aria-pressed={assignee === m.userId} className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-sm font-bold transition ${assignee === m.userId ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}><Avatar name={m.name} color={colorOf(space, m.userId)} size={30} />{m.userId === me ? "Me" : m.name}</button>)}</div>{space.members.length < 2 && <p className="text-xs text-slate-400">Invite your partner to ask them for things.</p>}</Lbl>
    <Lbl t="When"><Chips value={repeat.every} options={[["once", "Once"], ["daily", "Every day"], ["weekdays", "Weekdays"], ["weekly", "Pick days"]]} onChange={(every) => setRepeat((r) => ({ ...r, every, days: every === "weekly" && !r.days.length ? [1, 3, 5] : r.days }))} />
      {repeat.every === "weekly" && <div className="flex gap-1.5">{DAYS.map((d, i) => <button key={i} type="button" onClick={() => setRepeat((r) => ({ ...r, days: r.days.includes(i) ? r.days.filter((x) => x !== i) : [...r.days, i].sort() }))} className={`h-10 w-10 rounded-full text-sm font-black ${repeat.days.includes(i) ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"}`}>{d}</button>)}</div>}
      {repeat.every === "once" && <input type="date" className={field} value={repeat.date} onChange={(e) => setRepeat((r) => ({ ...r, date: e.target.value }))} />}</Lbl>
    <div className="grid grid-cols-2 gap-3"><Lbl t="Done by"><input type="time" className={field} value={due} onChange={(e) => setDue(e.target.value || "17:00")} /></Lbl>
      <Lbl t="Remind every"><select className={field} value={nag} onChange={(e) => setNag(Number(e.target.value))}>{NAG_CHOICES.map((n) => <option key={n} value={n}>{n === 0 ? "No reminders" : n < 60 ? `${n} minutes` : n === 60 ? "Hour" : `${n / 60} hours`}</option>)}</select></Lbl></div>
    {kind === "task" && <Lbl t="Proof when it's done"><Chips value={proof} options={[["none", "Just a check"], ["photo", "Photo"], ["video", "Video"], ["either", "Photo or video"]]} onChange={setProof} /></Lbl>}
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3.5"><span><span className="block text-sm font-black">I'll approve it</span><span className="text-xs text-slate-500">Look at it and OK it, or ask for a redo</span></span><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} className="h-6 w-6 accent-teal-600" /></label>
    <Lbl t="Notes (optional)"><textarea className={`${field} min-h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Use the flash cards on the fridge" maxLength={1000} /></Lbl>
    <p className="text-xs text-slate-400">Reminders go out from {timeWords(due)} until it's checked off, between 7am and 9:30pm.</p>
    <button type="button" disabled={!canSave || busy} onClick={async () => { setBusy(true); await onSave({ title, notes, kind, assignee, repeat, due, nag, proof: kind === "task" ? proof : "none", review, worksheet: kind === "worksheet" ? ws : null, quiz: kind === "quiz" ? quiz : null }); setBusy(false); }} className={`${tealBtn} w-full text-base`} data-testid="acct-save">{busy ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} strokeWidth={3} />}{task ? "Save" : assignee === me ? "Add it" : "Send it"}</button>
  </div></Sheet>;
}

function WorksheetEditor({ ws, onChange, answers, onAnswer }: { ws: Worksheet; onChange?: (w: Worksheet) => void; answers?: Record<string, string>; onAnswer?: (id: string, v: string) => void }) {
  const edit = (id: string, patch: Partial<WsItem>) => onChange?.({ ...ws, items: ws.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  return <div className="space-y-3 rounded-3xl border-2 border-dashed border-violet-200 bg-white p-4" data-testid="acct-worksheet">
    {onChange ? <input className={`${field} text-lg font-black`} value={ws.title} onChange={(e) => onChange({ ...ws, title: e.target.value })} /> : <h3 className="text-lg font-black">{ws.title}</h3>}
    {onChange ? <input className={field} value={ws.instructions} onChange={(e) => onChange({ ...ws, instructions: e.target.value })} placeholder="Instructions" /> : ws.instructions && <p className="text-sm text-slate-500">{ws.instructions}</p>}
    <ol className="space-y-3">{ws.items.map((it, i) => <li key={it.id} className="rounded-2xl bg-slate-50 p-3">
      <div className="flex items-start gap-2"><span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-black text-white">{i + 1}</span>
        <div className="min-w-0 flex-1 space-y-2">
          {onChange ? <textarea className={`${field} min-h-11 py-2`} value={it.prompt} onChange={(e) => edit(it.id, { prompt: e.target.value })} /> : <p className={`font-bold ${it.kind === "trace" ? "font-serif text-3xl tracking-[.3em] text-slate-300 [-webkit-text-stroke:1px_#64748b]" : ""}`}>{it.kind === "trace" ? it.prompt.replace(/^Trace:\s*/i, "") : it.prompt}</p>}
          {it.kind === "choice" && <div className="flex flex-wrap gap-2">{it.choices.map((c, k) => onChange ? <input key={k} className={`${field} w-28`} value={c} onChange={(e) => edit(it.id, { choices: it.choices.map((x, j) => (j === k ? e.target.value : x)) })} /> : <button key={k} type="button" onClick={() => onAnswer?.(it.id, c)} className={`min-h-10 rounded-full px-4 text-sm font-bold ${answers?.[it.id] === c ? "bg-violet-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{c}</button>)}</div>}
          {onAnswer && it.kind !== "choice" && (it.kind === "draw" || it.kind === "trace" ? <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={answers?.[it.id] === "done"} onChange={(e) => onAnswer(it.id, e.target.checked ? "done" : "")} className="h-5 w-5 accent-violet-600" />{it.kind === "draw" ? "Drew it (on paper)" : "Traced it"}</label> : <input className={field} value={answers?.[it.id] || ""} onChange={(e) => onAnswer(it.id, e.target.value)} placeholder="Answer" />)}
          {onChange && it.answer && <p className="text-xs text-slate-400">Answer: {it.answer}</p>}
        </div>
        {onChange && <button type="button" onClick={() => onChange({ ...ws, items: ws.items.filter((x) => x.id !== it.id) })} aria-label="Remove" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={16} /></button>}
      </div></li>)}</ol>
    {onChange && <button type="button" onClick={() => onChange({ ...ws, items: [...ws.items, { id: newId(), kind: "short", prompt: "New question", choices: [], answer: "" }] })} className={`${ghostBtn} w-full`}><Plus size={16} />Add an item</button>}
  </div>;
}
function QuizEditor({ quiz, onChange }: { quiz: Quiz; onChange: (q: Quiz) => void }) {
  return <div className="space-y-3 rounded-3xl border-2 border-dashed border-amber-200 bg-white p-4" data-testid="acct-quiz-edit">
    <input className={`${field} text-lg font-black`} value={quiz.title} onChange={(e) => onChange({ ...quiz, title: e.target.value })} />
    {quiz.questions.map((q, i) => <div key={q.id} className="rounded-2xl bg-amber-50/60 p-3"><div className="flex items-center gap-2"><span className="text-2xl">{q.emoji || "❓"}</span><input className={field} value={q.prompt} onChange={(e) => onChange({ ...quiz, questions: quiz.questions.map((x) => (x.id === q.id ? { ...x, prompt: e.target.value } : x)) })} /><button type="button" onClick={() => onChange({ ...quiz, questions: quiz.questions.filter((x) => x.id !== q.id) })} aria-label={`Remove question ${i + 1}`} className="rounded-lg p-2 text-slate-400 hover:text-rose-500"><Trash2 size={16} /></button></div>
      <div className="mt-2 grid grid-cols-2 gap-2">{q.choices.map((c, k) => <div key={k} className={`flex items-center gap-1 rounded-xl border-2 ${q.answer === k ? "border-emerald-400 bg-emerald-50" : "border-slate-100 bg-white"}`}><button type="button" onClick={() => onChange({ ...quiz, questions: quiz.questions.map((x) => (x.id === q.id ? { ...x, answer: k } : x)) })} aria-label="Make this the right answer" className={`ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full ${q.answer === k ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-300"}`}><Check size={14} strokeWidth={3} /></button><input className="min-h-10 w-full min-w-0 bg-transparent px-1 text-sm font-bold outline-none" value={c} onChange={(e) => onChange({ ...quiz, questions: quiz.questions.map((x) => (x.id === q.id ? { ...x, choices: x.choices.map((y, j) => (j === k ? e.target.value : y)) } : x)) })} /></div>)}</div></div>)}
    <p className="text-xs text-slate-400">Tap the circle to set the right answer.</p>
  </div>;
}

async function shrinkPhoto(f: File): Promise<Blob> {
  if (!f.type.startsWith("image/") || f.size < 600_000) return f;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob((b) => r(b || f), "image/jpeg", 0.85));
  } catch { return f; }
}

function DoSheet({ task, spaceId, today, api, say, asker, onClose, onKid, onDone }: { task: AcctTask; spaceId: string; today: string; api: ReturnType<typeof useApi>; say: (m: string) => void; asker: string; onClose: () => void; onKid: () => void; onDone: (b: { note: string; proof: Proof[]; answers: Record<string, string> }) => Promise<void> }) {
  const [note, setNote] = useState(""); const [proof, setProof] = useState<(Proof & { preview: string })[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ws, setWs] = useState<Worksheet | null>(task.worksheet);
  const [editing, setEditing] = useState(false);
  const [up, setUp] = useState(""); const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const accept = task.proof === "video" ? "video/*" : task.proof === "photo" ? "image/*" : "image/*,video/*";
  const add = async (files: FileList | null) => {
    for (const f0 of Array.from(files || []).slice(0, 6 - proof.length)) {
      try {
        const isVideo = f0.type.startsWith("video/");
        const body = isVideo ? f0 : await shrinkPhoto(f0);
        const type = (isVideo ? f0.type || "video/mp4" : body.type || "image/jpeg").split(";")[0];
        setUp(isVideo ? "Uploading video…" : "Uploading photo…");
        const u = await api<{ url: string; path: string; kind: "photo" | "video" }>("/upload-url", { method: "POST", body: { spaceId, type, size: body.size } });
        const r = await fetch(u.url, { method: "PUT", headers: { "Content-Type": type, "x-upsert": "false" }, body });
        if (!r.ok) throw new Error("The upload didn't go through. Try again.");
        setProof((p) => [...p, { path: u.path, type: u.kind, preview: URL.createObjectURL(body) }]);
      } catch (e: any) { say(e.message || "That didn't upload."); }
    }
    setUp("");
  };
  const needs = task.kind === "task" && task.proof !== "none" && !proof.length;
  return <Sheet title={task.title} onClose={onClose} wide><div className="space-y-4" data-testid="acct-do">
    <p className="text-sm text-slate-500">{asker === "You" ? "Your own to-do" : `${asker} asked`} · {repeatWords(task.repeat)} · by {timeWords(task.due)}</p>
    {task.notes && <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{task.notes}</p>}
    {task.kind === "quiz" && <button type="button" onClick={onKid} className={`${btn} w-full bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-lg text-white`}><Sparkles />Hand the phone to your child</button>}
    {task.kind === "worksheet" && ws && <>
      <div className="flex gap-2"><button type="button" onClick={() => setEditing((x) => !x)} className={ghostBtn}><Pencil size={15} />{editing ? "Done editing" : "Edit worksheet"}</button><button type="button" onClick={() => printWorksheet(ws)} className={ghostBtn}><Printer size={15} />Print</button></div>
      {editing ? <WorksheetEditor ws={ws} onChange={setWs} /> : <WorksheetEditor ws={ws} answers={answers} onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />}
    </>}
    {task.kind !== "quiz" && <div className="space-y-2">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{task.kind === "worksheet" ? "Photo of the paper (optional)" : task.proof === "none" ? "Photo or video (optional)" : task.proof === "video" ? "Add a video" : task.proof === "photo" ? "Add a photo" : "Add a photo or video"}</p>
      <div className="grid grid-cols-3 gap-2">
        {proof.map((p) => <div key={p.path} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100">{p.type === "video" ? <video src={p.preview} className="h-full w-full object-cover" muted playsInline /> : <img src={p.preview} alt="" className="h-full w-full object-cover" />}<button type="button" onClick={() => setProof((x) => x.filter((y) => y.path !== p.path))} aria-label="Remove" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><X size={14} /></button></div>)}
        {proof.length < 6 && <button type="button" onClick={() => input.current?.click()} disabled={!!up} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 text-sm font-black text-teal-700" data-testid="acct-add-proof">{up ? <Loader2 className="animate-spin" /> : task.proof === "video" ? <Video /> : <Camera />}{up ? "…" : "Add"}</button>}
      </div>
      {up && <p className="text-xs font-bold text-teal-700">{up}</p>}
      <input ref={input} type="file" accept={accept} multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
    </div>}
    {task.kind !== "quiz" && <textarea className={`${field} min-h-16 py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note (optional): how it went" />}
    {task.kind !== "quiz" && <button type="button" disabled={busy || !!up || needs} onClick={async () => { setBusy(true); const extra = task.kind === "worksheet" && ws && JSON.stringify(ws) !== JSON.stringify(task.worksheet) ? { ...answers, edited: "yes" } : answers; await onDone({ note, proof: proof.map(({ path, type }) => ({ path, type })), answers: extra }); setBusy(false); }} className={`${tealBtn} w-full py-4 text-base`} data-testid="acct-submit">{busy ? <Loader2 className="animate-spin" size={18} /> : <Check size={20} strokeWidth={3} />}{needs ? (task.proof === "video" ? "Add a video first" : "Add a photo first") : asker === "You" ? "Check it off" : `Check off and send to ${asker}`}</button>}
    <p className="text-center text-xs text-slate-400">For {today}</p>
  </div></Sheet>;
}

function printWorksheet(ws: Worksheet) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(ws.title)}</title><style>body{font-family:-apple-system,system-ui,sans-serif;padding:32px;color:#111}h1{margin:0 0 4px}p{color:#555}li{margin:22px 0;font-size:20px}.t{font-size:54px;letter-spacing:.3em;color:#ddd;-webkit-text-stroke:1.5px #888;font-family:Georgia,serif}.line{border-bottom:2px solid #bbb;height:34px;margin-top:8px}.box{border:2px dashed #bbb;height:180px;border-radius:12px;margin-top:8px}.c{display:inline-block;border:2px solid #999;border-radius:20px;padding:4px 16px;margin:6px 8px 0 0}</style><h1>${esc(ws.title)}</h1><p>Name: ________________ &nbsp; Date: __________</p><p>${esc(ws.instructions)}</p><ol>${ws.items.map((it) => `<li>${it.kind === "trace" ? `<div class="t">${esc(it.prompt.replace(/^Trace:\s*/i, ""))}</div>` : esc(it.prompt)}${it.kind === "choice" ? `<div>${it.choices.map((c) => `<span class="c">${esc(c)}</span>`).join("")}</div>` : it.kind === "draw" ? '<div class="box"></div>' : it.kind === "short" ? '<div class="line"></div>' : ""}</li>`).join("")}</ol><script>setTimeout(()=>print(),300)</script>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); return; }
  const f = document.createElement("iframe"); f.style.cssText = "position:fixed;width:0;height:0;border:0"; document.body.appendChild(f);
  f.contentDocument!.write(html.replace("<script>setTimeout(()=>print(),300)</script>", "")); f.contentDocument!.close(); setTimeout(() => { f.contentWindow?.print(); setTimeout(() => f.remove(), 2000); }, 300);
}

function TaskSheet({ task, me, space, checkins, today, api, nameOf, onClose, onEdit, onDo, onReview, onDelete }: { task: AcctTask; me: number; space: Space; checkins: Checkin[]; today: string; api: ReturnType<typeof useApi>; nameOf: (id: number) => string; onClose: () => void; onEdit: () => void; onDo: () => void; onReview: (c: Checkin) => void; onDelete: () => void }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const mine = checkins.filter((c) => c.taskId === task.id).slice(0, 10);
  const todayC = checkinFor(checkins, task.id, today);
  return <Sheet title={task.title} onClose={onClose} wide><div className="space-y-5" data-testid="acct-task">
    <div className="flex flex-wrap items-center gap-2 text-sm"><KindIcon kind={task.kind} /><span className="font-bold text-slate-700">{nameOf(task.assignee)}</span><span className="text-slate-400">· {repeatWords(task.repeat)} · by {timeWords(task.due)}{task.nag ? ` · reminders every ${task.nag < 60 ? `${task.nag} min` : `${task.nag / 60} h`}` : ""}</span></div>
    {task.notes && <p className="rounded-2xl bg-slate-50 p-3 text-sm">{task.notes}</p>}
    <div><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Last 2 weeks</p><div className="grid grid-cols-7 gap-1.5">{days.map((d) => { const due = dueOn(task, d), c = checkinFor(checkins, task.id, d), ok = isDone(c); return <div key={d} title={d} className={`grid aspect-square place-items-center rounded-xl text-[11px] font-black ${!due ? "bg-slate-50 text-slate-300" : ok ? "bg-emerald-500 text-white" : d === today ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300" : d < today ? "bg-rose-100 text-rose-500" : "bg-slate-100 text-slate-400"}`}>{ok ? <Check size={15} strokeWidth={3.5} /> : Number(d.slice(8))}</div>; })}</div></div>
    {task.assignee === me && !isDone(todayC) && dueOn(task, today) && <button type="button" onClick={onDo} className={`${tealBtn} w-full`}><Check size={18} strokeWidth={3} />{task.kind === "quiz" ? "Start the quiz" : "Check it off"}</button>}
    {mine.length > 0 && <div className="space-y-3"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Check-ins</p>{mine.map((c) => <div key={c.id} className="rounded-2xl border border-slate-100 p-3">
      <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{nameOf(c.by)} · {c.day}{c.score ? ` · ${c.score.right}/${c.score.total} right` : ""}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${c.status === "approved" ? "bg-emerald-100 text-emerald-700" : c.status === "redo" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>{c.status === "approved" ? "Approved" : c.status === "redo" ? "Redo" : "Waiting"}</span></div>
      {c.note && <p className="mt-1 text-sm text-slate-600">{c.note}</p>}{c.feedback && <p className="mt-1 text-sm italic text-slate-500">“{c.feedback}”</p>}
      <div className="mt-2"><ProofView proofs={c.proof} api={api} /></div>
      {c.status === "done" && c.by !== me && <button type="button" onClick={() => onReview(c)} className={`${ghostBtn} mt-2 w-full`}>Approve or ask for a redo</button>}
    </div>)}</div>}
    {(task.createdBy === me || task.assignee === me) && <div className="flex gap-2"><button type="button" onClick={onEdit} className={`${ghostBtn} flex-1`}><Pencil size={15} />Change</button><button type="button" onClick={onDelete} className={`${btn} border border-rose-100 bg-rose-50 text-rose-600`}><Trash2 size={15} />Remove</button></div>}
    <p className="text-center text-xs text-slate-400">In {space.name}</p>
  </div></Sheet>;
}

function ReviewSheet({ checkin, task, who, api, onClose, onReview }: { checkin: Checkin; task?: AcctTask; who: string; api: ReturnType<typeof useApi>; onClose: () => void; onReview: (status: "approved" | "redo", feedback: string) => Promise<void> }) {
  const [feedback, setFeedback] = useState(""); const [busy, setBusy] = useState(false);
  const go = async (s: "approved" | "redo") => { setBusy(true); await onReview(s, feedback); setBusy(false); };
  return <Sheet title={task?.title || "Check-in"} onClose={onClose} wide><div className="space-y-4" data-testid="acct-review-sheet">
    <p className="text-sm text-slate-500">{who} checked this off {new Date(checkin.at).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}</p>
    {checkin.score && <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center"><p className="text-4xl font-black text-orange-600">{checkin.score.right}/{checkin.score.total}</p><p className="text-sm font-bold text-orange-800">right on the quiz {"⭐".repeat(Math.max(1, Math.round((checkin.score.right / Math.max(1, checkin.score.total)) * 3)))}</p></div>}
    {task?.kind === "quiz" && task.quiz && <ul className="space-y-1.5">{task.quiz.questions.map((q) => { const pick = Number(checkin.answers[q.id]); const right = pick === q.answer; return <li key={q.id} className={`flex items-center gap-2 rounded-xl p-2 text-sm ${right ? "bg-emerald-50" : "bg-rose-50"}`}><span>{q.emoji}</span><span className="min-w-0 flex-1 truncate">{q.prompt}</span><span className="font-bold">{Number.isInteger(pick) ? q.choices[pick] : "—"}</span>{right ? <Check size={15} className="text-emerald-600" /> : <X size={15} className="text-rose-500" />}</li>; })}</ul>}
    {task?.kind === "worksheet" && task.worksheet && <ul className="space-y-1.5">{task.worksheet.items.map((it, i) => <li key={it.id} className="rounded-xl bg-slate-50 p-2 text-sm"><span className="font-bold">{i + 1}. {it.prompt}</span><span className="block text-slate-600">→ {checkin.answers[it.id] || "—"}{it.answer ? <span className="text-slate-400"> (answer: {it.answer})</span> : null}</span></li>)}</ul>}
    {checkin.note && <p className="rounded-2xl bg-slate-50 p-3 text-sm">“{checkin.note}”</p>}
    <ProofView proofs={checkin.proof} api={api} />
    <textarea className={`${field} min-h-16 py-2`} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Say something (optional): Great job!" />
    <div className="grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => void go("redo")} className={`${btn} border border-rose-200 bg-rose-50 text-rose-700`} data-testid="acct-redo"><RotateCcw size={17} />Redo</button><button type="button" disabled={busy} onClick={() => void go("approved")} className={`${btn} bg-emerald-500 text-white hover:bg-emerald-600`} data-testid="acct-approve"><Star size={17} className="fill-white" />Approve</button></div>
  </div></Sheet>;
}

// ---------------- the quiz a child takes ----------------
const KID_COLORS = ["from-sky-400 to-blue-500", "from-pink-400 to-rose-500", "from-lime-400 to-green-500", "from-amber-400 to-orange-500"];
function KidQuiz({ quiz, onClose, onFinish }: { quiz: Quiz; onClose: () => void; onFinish: (answers: Record<string, string>) => Promise<void> }) {
  const [i, setI] = useState(0); const [answers, setAnswers] = useState<Record<string, string>>({}); const [picked, setPicked] = useState<number | null>(null); const [busy, setBusy] = useState(false);
  const q = quiz.questions[i]; const done = i >= quiz.questions.length;
  const score = scoreQuiz(quiz, answers);
  const pick = (k: number) => {
    if (picked !== null) return;
    setPicked(k); setAnswers((a) => ({ ...a, [q.id]: String(k) }));
    setTimeout(() => { setPicked(null); setI((x) => x + 1); }, k === q.answer ? 900 : 1500);
  };
  return <div className="fixed inset-0 z-[600] flex flex-col bg-gradient-to-b from-[#fff7ed] to-[#eef2ff] pb-[env(safe-area-inset-bottom)] pt-[max(env(safe-area-inset-top),12px)]" data-testid="acct-kid">
    <div className="flex items-center gap-3 px-4"><button type="button" onClick={onClose} aria-label="Close the quiz" className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-500 shadow"><ChevronLeft /></button>
      <div className="flex flex-1 gap-1.5">{quiz.questions.map((x, k) => <span key={x.id} className={`h-2.5 flex-1 rounded-full ${k < i ? (Number(answers[x.id]) === x.answer ? "bg-emerald-400" : "bg-rose-300") : k === i ? "bg-orange-400" : "bg-white"}`} />)}</div></div>
    {!done ? <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 text-center">
      <div className="text-[96px] leading-none" style={{ animation: "kidpop .4s ease" }} key={q.id}>{q.emoji || "⭐"}</div>
      <style>{"@keyframes kidpop{from{transform:scale(.5);opacity:0}to{transform:none;opacity:1}}"}</style>
      <h2 className="max-w-md text-3xl font-black leading-tight text-slate-800">{q.prompt}</h2>
      <div className="grid w-full max-w-md grid-cols-2 gap-3">{q.choices.map((c, k) => <button key={k} type="button" onClick={() => pick(k)} className={`min-h-24 rounded-3xl bg-gradient-to-br ${KID_COLORS[k % 4]} px-3 text-2xl font-black text-white shadow-lg transition active:scale-95 ${picked !== null && k === q.answer ? "ring-8 ring-emerald-300" : picked === k ? "opacity-60 ring-8 ring-rose-300" : picked !== null ? "opacity-40" : ""}`} data-testid="acct-kid-choice">{c}{picked !== null && k === q.answer && " ✓"}</button>)}</div>
      {picked !== null && <p className="text-2xl font-black">{picked === q.answer ? "🎉 Yes!" : "Nice try! 💪"}</p>}
    </div> : <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="text-7xl">{score.right === score.total ? "🏆" : score.right >= score.total / 2 ? "🌟" : "💪"}</div>
      <h2 className="text-4xl font-black text-slate-800">{score.right} out of {score.total}!</h2>
      <p className="text-2xl">{"⭐".repeat(Math.max(1, Math.round((score.right / Math.max(1, score.total)) * 3)))}</p>
      <p className="text-lg font-bold text-slate-500">Great work! Give the phone back to your grown-up.</p>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onFinish(answers); setBusy(false); }} className={`${tealBtn} px-8 py-4 text-lg`} data-testid="acct-kid-send">{busy ? <Loader2 className="animate-spin" /> : <Check strokeWidth={3} />}Save and send</button>
    </div>}
  </div>;
}
