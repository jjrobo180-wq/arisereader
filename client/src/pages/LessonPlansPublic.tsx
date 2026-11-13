// The page a school opens from a teacher's lesson plan link (no sign-in): the week's lessons, class by class,
// in the teacher's own words, with their worksheets and links. Read only. See shared/lessonShare.ts.
import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, FileText, Printer } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import type { SharePlans, ShareLesson } from "@shared/lessonShare";

const DOT: Record<string, string> = { teal: "bg-teal-500", sky: "bg-sky-500", violet: "bg-violet-500", rose: "bg-rose-500", amber: "bg-amber-500", emerald: "bg-emerald-500", indigo: "bg-indigo-500", orange: "bg-orange-500", slate: "bg-slate-500" };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const at = (s: string) => new Date(`${s}T12:00:00`);
const plus = (s: string, n: number) => { const d = at(s); d.setDate(d.getDate() + n); return ymd(d); };
const monday = (s: string) => { const d = at(s); const w = d.getDay(); return plus(s, w === 0 ? -6 : 1 - w); };
const nice = (s: string, o: Intl.DateTimeFormatOptions) => at(s).toLocaleDateString("en-US", o);

export default function LessonPlansPublic() {
  const [, params] = useRoute("/plans/:token");
  const token = params?.token || "";
  const [week, setWeek] = useState(() => monday(ymd(new Date())));
  const [data, setData] = useState<SharePlans | null>(null);
  const [error, setError] = useState("");
  const [cls, setCls] = useState("");
  useEffect(() => {
    let live = true; setError("");
    fetch(`${API_BASE}/api/public/lesson-plans/${encodeURIComponent(token)}?from=${plus(week, -28)}&to=${plus(week, 34)}`)
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || "These lesson plans couldn't be opened."); return d; })
      .then((d) => live && setData(d)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [token, week]);
  useEffect(() => { document.title = data ? `Lesson plans · ${data.teacher}` : "Lesson plans"; }, [data]);
  const days = [0, 1, 2, 3, 4].map((i) => plus(week, i));
  const classOf = (id?: string) => data?.classes.find((c) => c.id === id);
  const shown = useMemo(() => (data?.lessons ?? []).filter((l) => l.date >= days[0] && l.date <= days[4] && (!cls || l.classId === cls)), [data, week, cls]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <main className="grid min-h-[100dvh] place-items-center bg-[#f7f7f5] px-6 text-center"><div><BookOpen className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 text-base font-semibold text-slate-900">{error}</p></div></main>;
  return <main className="min-h-[100dvh] bg-[#f7f7f5] px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] text-slate-900 print:bg-white print:p-0" data-testid="lesson-plans-public">
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Lesson plans</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">{data?.teacher ?? "…"}</h1>
        </div>
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 print:hidden"><Printer className="h-4 w-4" />Print</button>
      </header>
      <div className="mt-5 flex items-center gap-2 print:hidden">
        <button type="button" onClick={() => setWeek(plus(week, -7))} aria-label="Week before" className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-slate-200 hover:bg-slate-50"><ChevronLeft className="h-5 w-5" /></button>
        <p className="min-w-0 flex-1 text-center text-[15px] font-semibold">{nice(days[0], { month: "long", day: "numeric" })} – {nice(days[4], { month: days[0].slice(5, 7) === days[4].slice(5, 7) ? undefined : "long", day: "numeric", year: "numeric" })}</p>
        <button type="button" onClick={() => setWeek(plus(week, 7))} aria-label="Week after" className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-slate-200 hover:bg-slate-50"><ChevronRight className="h-5 w-5" /></button>
      </div>
      {data && data.classes.length > 1 && <div className="mt-4 flex flex-wrap gap-2 print:hidden" role="group" aria-label="Class">
        {[{ id: "", name: "All classes", color: "" }, ...data.classes].map((c) => <button key={c.id || "all"} type="button" onClick={() => setCls(c.id)} aria-pressed={cls === c.id} className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium ring-1 ${cls === c.id ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>{c.color && <span className={`h-2 w-2 rounded-full ${DOT[c.color] ?? "bg-slate-400"}`} />}{c.name}</button>)}
      </div>}
      {!data ? <p className="mt-10 text-center text-sm text-slate-500">Loading…</p> : <div className="mt-6 space-y-8">
        {days.map((d) => { const list = shown.filter((l) => l.date === d); return <section key={d} aria-label={nice(d, { weekday: "long" })}>
          <h2 className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">{nice(d, { weekday: "long", month: "short", day: "numeric" })}</h2>
          {list.length ? <div className="mt-2 space-y-3">{list.map((l) => <LessonCard key={l.id} l={l} cls={classOf(l.classId)} token={token} />)}</div> : <p className="mt-2 text-sm text-slate-400">No lesson planned.</p>}
        </section>; })}
      </div>}
      <footer className="mt-14 text-center text-xs text-slate-400 print:hidden">Shared from Arise To Duo · read only</footer>
    </div>
  </main>;
}

function LessonCard({ l, cls, token }: { l: ShareLesson; cls?: { name: string; color: string; room?: string; teacher?: string; grade?: string; subject?: string }; token: string }) {
  const meta = [cls?.name, cls?.grade ? `Grade ${cls.grade}` : "", l.subject || cls?.subject, l.minutes ? `${l.minutes} min` : "", cls?.room ? `Room ${cls.room}` : ""].filter(Boolean);
  return <article className="break-inside-avoid rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 print:ring-slate-300" data-testid="public-lesson">
    <div className="flex items-start gap-3">
      <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[cls?.color ?? ""] ?? "bg-slate-300"}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <h3 className="text-[17px] font-semibold leading-snug tracking-tight">{l.title}</h3>
        <p className="mt-0.5 text-sm text-slate-500">{meta.join(" · ")}{l.unit ? ` · Unit: ${l.unit}` : ""}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${l.status === "Taught" ? "bg-emerald-50 text-emerald-700" : l.status === "Ready" ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600"}`}>{l.status}</span>
    </div>
    {l.parts.length > 0 && <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      {l.parts.map((p) => <div key={p.label}><dt className="text-[11px] font-semibold uppercase tracking-[.1em] text-slate-400">{p.label}</dt><dd className="mt-0.5 whitespace-pre-wrap text-[15px] leading-7 text-slate-800">{p.text}</dd></div>)}
    </dl>}
    {l.standards.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{l.standards.map((s) => <span key={s} className="rounded-md bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200">{s}</span>)}</div>}
    {l.materials.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-slate-400">Materials</p>
      <ul className="mt-2 space-y-2">{l.materials.map((m) => {
        const href = m.file ? `${API_BASE}/api/public/lesson-plans/${encodeURIComponent(token)}/file/${encodeURIComponent(l.id)}/${encodeURIComponent(m.id)}` : m.url;
        return <li key={m.id}>
          {href ? <a href={href} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-slate-200 hover:bg-slate-50"><FileText className="h-4 w-4 shrink-0 text-slate-400" /><span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{m.name}</span><span className="shrink-0 text-xs text-slate-400">{m.kindLabel}</span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" /></a>
            : <div className="rounded-xl px-3 py-2 ring-1 ring-slate-200"><p className="text-sm font-medium text-slate-800">{m.name} <span className="font-normal text-slate-400">· {m.kindLabel}</span></p></div>}
          {m.text && <p className="mt-1.5 whitespace-pre-wrap px-3 text-sm leading-6 text-slate-700">{m.text}</p>}
        </li>; })}</ul>
    </div>}
  </article>;
}
