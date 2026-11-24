// One child's class records, as families, staff and admins see them (server/classRecords.ts, childView):
// the wall, grades, attendance, behavior, hall passes and messages, each from every teacher who shares it.
// The family page (pages/FamilyPortal.tsx) and the WorkHub student look-up both use this.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Megaphone, Newspaper, Pin, Send } from "lucide-react";
import { usePhoto, shortDay } from "@/lib/records";
import { minutesOut } from "@shared/classBehavior";
import { ATTENDANCE_NAMES, POST_KIND_NAMES, type AttendanceMark, type AttendanceStatus, type Message, type PostKind } from "@shared/classRecords";

export type ChildView = {
  child: { id: number; name: string; first: string };
  teachers: Array<{
    teacher: { id: number; name: string }; shown: Record<string, boolean>;
    grades?: { percent: number | null; letter: string; categories: Array<{ id: string; name: string; weight: number; percent: number | null }>; missing: Array<{ id: string; title: string; due: string }>; work: Array<{ id: string; title: string; category: string; points: number; due: string; score?: number | null; missing?: boolean; excused?: boolean; late?: boolean; comment?: string }> } | null;
    attendance?: { present: number; tardy: number; absent: number; excused: number; days: number; rate: number | null; last: Array<{ day: string } & AttendanceMark> } | null;
    wall?: Array<{ id: string; teacherId: number; kind: PostKind; title: string; body: string; photos: string[]; pinned: boolean; createdAt: string; editedAt?: string; teacherName: string }>;
    messages?: { messages: Message[]; unread: number };
  }>;
  behavior: { totals: { all: number; week: number; today: number; pos: number; neg: number }; recent: Array<{ id: string; points: number; label: string; note: string; at: string; teacher: string }> } | null;
  passes: Array<{ id: string; place: string; status: string; limit: number; outAt: string | null; backAt: string | null; teacher: string }> | null;
  serverNow: number;
};
export type Section = "wall" | "grades" | "attendance" | "behavior" | "passes" | "messages";
export const SECTION_NAMES: Record<Section, string> = { wall: "Wall", grades: "Grades", attendance: "Attendance", behavior: "Behavior", passes: "Hall passes", messages: "Messages" };

const ink = "text-slate-900 dark:text-white";
const card = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[.03]";
const pctTone = (p: number | null) => (p === null ? "text-slate-500" : p >= 80 ? "text-emerald-700" : p >= 70 ? "text-amber-700" : "text-rose-700");
const DOT: Record<AttendanceStatus, string> = { present: "bg-emerald-500", tardy: "bg-amber-500", absent: "bg-rose-500", excused: "bg-sky-500" };

/** Which sections have anything to show, in order. */
export function sectionsOf(v: ChildView, withMessages: boolean): Section[] {
  const out: Section[] = [];
  if (v.teachers.some((t) => t.wall?.length)) out.push("wall");
  if (v.teachers.some((t) => t.grades)) out.push("grades");
  if (v.teachers.some((t) => t.attendance)) out.push("attendance");
  if (v.behavior) out.push("behavior");
  if (v.passes) out.push("passes");
  if (withMessages && v.teachers.length) out.push("messages");
  return out;
}

function Photo({ teacherId, name, token, link, onOpen }: { teacherId: number; name: string; token?: string | null; link?: string | null; onOpen: (url: string) => void }) {
  const url = usePhoto(teacherId, name, token, link);
  return url ? <button type="button" onClick={() => onOpen(url)} className="block overflow-hidden rounded-xl bg-slate-100"><img src={url} alt="" className="aspect-square w-full object-cover transition hover:scale-[1.02]" /></button>
    : <div className="aspect-square w-full animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" aria-hidden="true" />;
}

export function Wall({ v, token, link }: { v: ChildView; token?: string | null; link?: string | null }) {
  const [big, setBig] = useState<string | null>(null);
  const posts = v.teachers.flatMap((t) => t.wall ?? []).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  if (!posts.length) return <p className="text-sm text-slate-500">Nothing on the wall yet.</p>;
  return <>
    <ul className="space-y-4">{posts.map((p) => (
      <li key={p.id} className={`${card} ${p.kind === "announcement" ? "border-amber-300 dark:border-amber-400/40" : ""}`}>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          {p.kind === "announcement" ? <Megaphone className="h-4 w-4 text-amber-600" /> : p.kind === "newsletter" ? <Newspaper className="h-4 w-4 text-[#6e5ae0]" /> : null}
          <span className={p.kind === "announcement" ? "text-amber-700" : p.kind === "newsletter" ? "text-[#5b47d6]" : ""}>{p.kind !== "post" ? POST_KIND_NAMES[p.kind] : p.teacherName}</span>
          {p.kind !== "post" && <span>· {p.teacherName}</span>}
          <span>· {shortDay(p.createdAt, true)}</span>
          {p.pinned && <span className="ml-auto inline-flex items-center gap-1"><Pin className="h-3.5 w-3.5" />Pinned</span>}
        </div>
        {p.title && <h3 className={`mt-2 text-lg font-bold leading-snug ${ink}`}>{p.title}</h3>}
        {p.body && <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 dark:text-white/80">{p.body}</p>}
        {p.photos.length > 0 && <div className={`mt-3 grid gap-2 ${p.photos.length === 1 ? "grid-cols-1" : p.photos.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>{p.photos.map((f) => <Photo key={f} teacherId={p.teacherId} name={f} token={token} link={link} onOpen={setBig} />)}</div>}
      </li>
    ))}</ul>
    {big && <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-[900] flex items-center justify-center bg-black/85 p-4" onClick={() => setBig(null)}><img src={big} alt="" className="max-h-full max-w-full rounded-lg" /></div>}
  </>;
}

export function Grades({ v }: { v: ChildView }) {
  const rows = v.teachers.filter((t) => t.grades);
  if (!rows.length) return <p className="text-sm text-slate-500">No grades yet.</p>;
  return <div className="space-y-4">{rows.map((t) => { const g = t.grades!; return (
    <section key={t.teacher.id} className={card} aria-label={`Grades from ${t.teacher.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-semibold text-slate-500">{t.teacher.name}</p><p className={`text-3xl font-bold tabular-nums ${pctTone(g.percent)}`}>{g.percent === null ? "No grade yet" : `${g.percent}%`}<span className="ml-2 text-xl">{g.letter}</span></p></div>
        {g.missing.length > 0 && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{g.missing.length} missing</p>}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">{g.categories.filter((c) => c.weight > 0).map((c) => <li key={c.id} className="text-slate-600 dark:text-white/70">{c.name}: <span className={`font-semibold ${pctTone(c.percent)}`}>{c.percent === null ? "—" : `${c.percent}%`}</span></li>)}</ul>
      <ul className="mt-4 divide-y divide-slate-100 dark:divide-white/10">{g.work.map((w) => (
        <li key={w.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
          <span className="min-w-0 flex-1"><span className={`block font-semibold ${ink}`}>{w.title}</span><span className="text-xs text-slate-500">{w.category}{w.due ? ` · due ${shortDay(w.due)}` : ""}</span>{w.comment && <span className="mt-1 block text-[13px] text-slate-600 dark:text-white/70">{t.teacher.name.split(" ").slice(-1)[0]}: “{w.comment}”</span>}</span>
          <span className={`font-semibold tabular-nums ${w.missing ? "text-rose-700" : w.excused ? "text-sky-700" : ink}`}>{w.missing ? "Missing" : w.excused ? "Excused" : typeof w.score === "number" ? `${w.score} / ${w.points}` : "Not graded"}{w.late ? " · late" : ""}</span>
        </li>
      ))}</ul>
    </section>
  ); })}</div>;
}

export function Attendance({ v }: { v: ChildView }) {
  const rows = v.teachers.filter((t) => t.attendance);
  if (!rows.length) return <p className="text-sm text-slate-500">No attendance yet.</p>;
  return <div className="space-y-4">{rows.map((t) => { const a = t.attendance!; return (
    <section key={t.teacher.id} className={card} aria-label={`Attendance with ${t.teacher.name}`}>
      <p className="text-sm font-semibold text-slate-500">{t.teacher.name} · last 120 days</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${a.rate === null ? "text-slate-500" : a.rate >= 95 ? "text-emerald-700" : a.rate >= 90 ? "text-amber-700" : "text-rose-700"}`}>{a.rate === null ? "—" : `${a.rate}%`} <span className="text-base font-semibold text-slate-500">attendance</span></p>
      <dl className="mt-4 grid grid-cols-4 gap-2 text-center">{(["present", "tardy", "absent", "excused"] as const).map((k) => <div key={k} className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/5"><dt className="text-xs text-slate-500">{ATTENDANCE_NAMES[k]}</dt><dd className={`text-lg font-bold tabular-nums ${ink}`}>{a[k]}</dd></div>)}</dl>
      {a.last.length > 0 && <ul className="mt-4 divide-y divide-slate-100 text-sm dark:divide-white/10">{a.last.slice(0, 15).map((m) => <li key={m.day} className="flex items-center gap-3 py-2"><span className={`h-2 w-2 rounded-full ${DOT[m.status]}`} /><span className={`w-24 font-semibold ${ink}`}>{shortDay(m.day)}</span><span className="text-slate-600 dark:text-white/70">{ATTENDANCE_NAMES[m.status]}{m.minutesLate ? ` · ${m.minutesLate} min late` : ""}{m.note ? ` · ${m.note}` : ""}</span></li>)}</ul>}
    </section>
  ); })}</div>;
}

export function Behavior({ v }: { v: ChildView }) {
  if (!v.behavior) return null;
  const b = v.behavior, sign = (n: number) => (n > 0 ? `+${n}` : String(n));
  const rate = b.totals.pos + b.totals.neg ? Math.round((100 * b.totals.pos) / (b.totals.pos + b.totals.neg)) : 100;
  return <section className={card}>
    <dl className="grid grid-cols-3 gap-2 text-center">{[["Today", sign(b.totals.today)], ["This week", sign(b.totals.week)], ["Positive", `${rate}%`]].map(([k, val]) => <div key={k} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5"><dt className="text-xs text-slate-500">{k}</dt><dd className={`text-xl font-bold tabular-nums ${ink}`}>{val}</dd></div>)}</dl>
    {b.recent.length ? <ul className="mt-4 divide-y divide-slate-100 text-sm dark:divide-white/10">{b.recent.map((e) => <li key={e.id} className="flex gap-3 py-2.5">
      <span className={`w-9 text-right font-bold tabular-nums ${e.points > 0 ? "text-emerald-700" : e.points < 0 ? "text-rose-700" : "text-slate-500"}`}>{sign(e.points)}</span>
      <span className="min-w-0 flex-1"><span className={`font-semibold ${ink}`}>{e.label}</span>{e.note && <span className="text-slate-600 dark:text-white/70"> · {e.note}</span>}<span className="block text-xs text-slate-500">{e.teacher} · {shortDay(e.at, true)}</span></span>
    </li>)}</ul> : <p className="mt-4 text-sm text-slate-500">Nothing yet.</p>}
  </section>;
}

export function Passes({ v }: { v: ChildView }) {
  if (!v.passes) return null;
  return <section className={card}>{v.passes.length ? <ul className="divide-y divide-slate-100 text-sm dark:divide-white/10">{v.passes.map((p) => { const m = minutesOut({ out_at: p.outAt, back_at: p.backAt }, v.serverNow); return (
    <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
      <span className="min-w-0 flex-1"><span className={`font-semibold ${ink}`}>{p.place}</span><span className="block text-xs text-slate-500">{p.teacher} · {p.outAt ? shortDay(p.outAt, true) : ""}</span></span>
      <span className={`tabular-nums ${m > p.limit ? "font-semibold text-rose-700" : "text-slate-600 dark:text-white/70"}`}>{p.status === "out" ? "Out now" : `${Math.round(m)} min`}{m > p.limit ? ` (limit ${p.limit})` : ""}</span>
    </li>
  ); })}</ul> : <p className="text-sm text-slate-500">No hall passes in the last 60 days.</p>}</section>;
}

/** Talking with each teacher about this child. `send` is left out where messages are read-only. */
export function Messages({ v, send, markRead, needName }: { v: ChildView; send?: (teacherId: number, body: string, name?: string) => Promise<void>; markRead?: (teacherId: number) => void; needName?: boolean }) {
  const teachers = v.teachers.filter((t) => t.messages);
  const [tid, setTid] = useState(() => teachers.find((t) => t.messages!.unread)?.teacher.id ?? teachers[0]?.teacher.id);
  const t = teachers.find((x) => x.teacher.id === tid);
  const [body, setBody] = useState("");
  const [name, setName] = useState(() => { try { return localStorage.getItem("family-link-name") || ""; } catch { return ""; } });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (tid && t?.messages?.unread) markRead?.(tid); end.current?.scrollIntoView({ block: "end" }); }, [tid, t?.messages?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!teachers.length) return <p className="text-sm text-slate-500">No teachers to message yet.</p>;
  return <section className={`${card} p-0`}>
    {teachers.length > 1 && <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2 dark:border-white/10">{teachers.map((x) => (
      <button key={x.teacher.id} type="button" onClick={() => setTid(x.teacher.id)} aria-pressed={x.teacher.id === tid} className={`min-h-10 shrink-0 rounded-xl px-3 text-sm font-semibold ${x.teacher.id === tid ? "bg-[#f4f2ff] text-[#5b47d6]" : "text-slate-600"}`}>{x.teacher.name}{x.messages!.unread ? <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[11px] text-white">{x.messages!.unread}</span> : null}</button>
    ))}</div>}
    <div className="max-h-[50vh] space-y-3 overflow-y-auto p-4">
      {t?.messages?.messages.length ? t.messages.messages.map((m) => (
        <div key={m.id} className={`flex ${m.from === "family" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ${m.from === "family" ? "rounded-br-md bg-[#6e5ae0] text-white" : "rounded-bl-md bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white"}`}>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className={`mt-1 text-[11px] ${m.from === "family" ? "text-white/75" : "text-slate-500"}`}>{m.authorName} · {shortDay(m.at, true)}</p>
          </div>
        </div>
      )) : <p className="py-6 text-center text-sm text-slate-500">No messages with {t?.teacher.name} yet.{send ? " Say hello below." : ""}</p>}
      <div ref={end} />
    </div>
    {send && t && <form className="space-y-2 border-t border-slate-100 p-3 dark:border-white/10" onSubmit={async (e) => {
      e.preventDefault(); if (!body.trim() || busy) return;
      if (needName && !name.trim()) { setErr("Add your name so the teacher knows who's writing."); return; }
      setBusy(true); setErr("");
      try { await send(t.teacher.id, body.trim(), needName ? name.trim() : undefined); setBody(""); try { if (needName) localStorage.setItem("family-link-name", name.trim()); } catch { /* fine */ } }
      catch (x: any) { setErr(x.message); } finally { setBusy(false); }
    }}>
      {needName && <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Your name (for example, Maria, Mom)" aria-label="Your name" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white" />}
      <div className="flex gap-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={2} placeholder={`Message ${t.teacher.name}`} aria-label={`Message ${t.teacher.name}`} className="min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white" />
        <button type="submit" disabled={!body.trim() || busy} aria-label="Send" className="inline-flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl bg-[#6e5ae0] text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
      </div>
      {err && <p className="text-sm text-rose-700" role="alert">{err}</p>}
    </form>}
  </section>;
}

/** The whole child view with section tabs (staff and admins use it read-only). */
export function ChildRecords({ v, token, link, send, markRead, needName, head }: { v: ChildView; token?: string | null; link?: string | null; send?: (teacherId: number, body: string, name?: string) => Promise<void>; markRead?: (teacherId: number) => void; needName?: boolean; head?: ReactNode }) {
  const withMessages = v.teachers.some((t) => t.messages);
  const sections = useMemo(() => sectionsOf(v, withMessages), [v, withMessages]);
  const [sec, setSec] = useState<Section>(sections[0] ?? "wall");
  useEffect(() => { if (!sections.includes(sec) && sections[0]) setSec(sections[0]); }, [sections, sec]);
  const unread = v.teachers.reduce((n, t) => n + (t.messages?.unread ?? 0), 0);
  return <div className="space-y-4">
    {head}
    {sections.length ? <>
      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 [scrollbar-width:none] dark:border-white/10" aria-label={`${v.child.first}'s records`}>
        {sections.map((s) => <button key={s} type="button" onClick={() => setSec(s)} aria-current={sec === s ? "page" : undefined} className={`-mb-px min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold ${sec === s ? "border-[#6e5ae0] text-slate-900 dark:text-white" : "border-transparent text-slate-500"}`}>{SECTION_NAMES[s]}{s === "messages" && unread ? <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{unread}</span> : null}</button>)}
      </nav>
      {sec === "wall" && <Wall v={v} token={token} link={link} />}
      {sec === "grades" && <Grades v={v} />}
      {sec === "attendance" && <Attendance v={v} />}
      {sec === "behavior" && <Behavior v={v} />}
      {sec === "passes" && <Passes v={v} />}
      {sec === "messages" && <Messages v={v} send={send} markRead={markRead} needName={needName} />}
    </> : <p className={`${card} text-sm text-slate-500`}>Nothing is shared here yet. Teachers choose what to share, and it shows up as soon as they do.</p>}
  </div>;
}
