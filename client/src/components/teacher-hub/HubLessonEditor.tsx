// One lesson, open to plan: the basics, the full plan with the AI helper, its standards, its files
// (worksheets, PowerPoints, answer keys), how each student did, and the teacher's reflection.
// Every change is kept as it's typed (the Hub saves a moment later), so nothing is lost by closing.
import { useMemo, useState } from "react";
import { BookCheck, CalendarPlus, Check, ClipboardList, Copy, FileStack, Lightbulb, NotebookPen, Printer, RotateCcw, Sparkles, Trash2, UserPlus, Users, Wand2 } from "lucide-react";
import type { DriveFile } from "@shared/driveApp";
import { schoolBlocks, blockName, type SchoolBlock } from "@shared/hubBlocks";
import {
  CHECKS, CHECK_LABEL, LESSON_STATUSES, PLAN_FIELDS, PLAN_LABEL, STATUS_LABEL, addDays, classOf, needsReteach, planFullness, rosterOf,
  type LessonCheck, type LessonClass, type LessonIdea, type LessonPlan, type PlanFields, type StudentMark,
} from "@shared/lessonPlanner";
import { printHtml } from "@/lib/lessonExport";
import { HubModal } from "./HubModal";
import { COLOR, NO_CLASS, STATUS_STYLE, Segmented, Spinner, StandardsPicker, MaterialSlots, aiBtn, askLessonAi, smallBtn } from "./HubLessonParts";

type Tab = "plan" | "standards" | "files" | "students" | "reflect";

const CHECK_STYLE: Record<LessonCheck, { on: string; off: string }> = {
  mastered: { on: "bg-emerald-600 text-white border-emerald-600", off: "border-slate-200 text-slate-600 hover:bg-emerald-50" },
  good: { on: "bg-sky-600 text-white border-sky-600", off: "border-slate-200 text-slate-600 hover:bg-sky-50" },
  reteach: { on: "bg-rose-600 text-white border-rose-600", off: "border-slate-200 text-slate-600 hover:bg-rose-50" },
  absent: { on: "bg-slate-600 text-white border-slate-600", off: "border-slate-200 text-slate-600 hover:bg-slate-100" },
};

const PLACEHOLDER: Partial<Record<(typeof PLAN_FIELDS)[number], string>> = {
  objective: "Students will be able to…",
  hook: "Warm-up (5 min): …",
  iDo: "Model it: what you'll say, show and think aloud",
  weDo: "Practice together: problems, prompts, who answers",
  youDo: "Students work on their own or in pairs",
  closure: "Exit ticket: 1-3 quick questions",
  vocabulary: "Words to teach",
  differentiation: "IEP / ELL supports, small group, extension",
  assessment: "How you'll know who got it",
  homework: "Homework or extension",
  materials: "What to print, prep or pull out",
};

export function lessonPlanHtml(l: LessonPlan, cls: LessonClass | undefined, blocks: SchoolBlock[]): string {
  const h = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const rows = PLAN_FIELDS.filter((k) => k !== "title" && (l as any)[k]?.trim()).map((k) => `<tr><th>${h(PLAN_LABEL[k])}</th><td>${h((l as any)[k])}</td></tr>`).join("");
  const meta = [cls?.name, cls && blockName(blocks, cls.block), l.date && new Date(`${l.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }), l.minutes && `${l.minutes} min`, l.unit && `Unit: ${l.unit}`].filter(Boolean).join(" · ");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${h(l.title)}</title><style>body{font-family:Calibri,Segoe UI,Arial,sans-serif;max-width:7.5in;margin:0 auto;padding:16px;color:#111827;font-size:11.5pt}h1{margin:0 0 4px;font-size:20pt}.meta{color:#4b5563;margin-bottom:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d1d5db;padding:8px;vertical-align:top;text-align:left}th{width:28%;background:#f3f4f6}ul{margin:4px 0;padding-left:18px}.files{margin-top:12px;color:#374151}</style></head><body><h1>${h(l.title)}</h1><div class="meta">${h(meta)}</div>${l.summary ? `<p>${h(l.summary)}</p>` : ""}${l.standards?.length ? `<p><b>Standards</b></p><ul>${l.standards.map((s) => `<li>${h(s)}</li>`).join("")}</ul>` : ""}<table>${rows}</table>${l.files?.length ? `<div class="files"><b>Files:</b> ${l.files.map((f) => h(f.name)).join(", ")}</div>` : ""}</body></html>`;
}

export default function HubLessonEditor({
  lesson, lessons, classes, caseload, state, onState, token, makeId, drive, blocks, onChange, onDelete, onDuplicate, onPlanReteach, onClose, say,
}: {
  lesson: LessonPlan;
  lessons: LessonPlan[];
  classes: LessonClass[];
  /** Names on the teacher's caseload, to add a student who isn't on the roster. */
  caseload: string[];
  state: string;
  onState: (s: string) => void;
  token: string | null;
  makeId: () => string;
  drive: DriveFile[];
  blocks: SchoolBlock[];
  onChange: (next: LessonPlan) => void;
  onDelete: () => void;
  onDuplicate: (date: string, classId: string) => void;
  onPlanReteach: (students: string[]) => void;
  onClose: () => void;
  say: (text: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("plan");
  const [ai, setAi] = useState({ open: !planFullness(lesson).done, topic: lesson.title === "Untitled lesson" ? "" : lesson.title, notes: "", busy: "", error: "", ideas: null as LessonIdea[] | null, replace: false });
  const [dup, setDup] = useState<{ date: string; classId: string } | null>(null);
  const [extra, setExtra] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cls = classOf(lesson, classes);
  const color = cls ? COLOR[cls.color] : NO_CLASS;
  const roster = rosterOf(lesson, classes);
  const marks = lesson.marks || {};
  const set = (changes: Partial<LessonPlan>) => onChange({ ...lesson, ...changes });
  const fullness = planFullness(lesson);
  const reteachNow = needsReteach(lesson, lessons);
  const recentStandards = useMemo(() => {
    const out: string[] = [];
    for (const l of [...lessons].sort((a, b) => (b.date || "").localeCompare(a.date || ""))) for (const s of l.standards || []) if (!out.includes(s)) out.push(s);
    return out;
  }, [lessons]);
  const allBlocks = blocks.length ? blocks : schoolBlocks({});

  const aiContext = () => ({
    grade: cls?.grade || "",
    subject: cls?.subject || lesson.subject || "",
    state,
    topic: ai.topic || lesson.title,
    notes: ai.notes,
    minutes: lesson.minutes || 45,
    standards: lesson.standards || [],
    lesson: Object.fromEntries(PLAN_FIELDS.map((k) => [k, (lesson as any)[k] || ""]).filter(([k, v]) => v && !(k === "title" && v === "Untitled lesson"))),
  });

  function applyPlan(plan: PlanFields, replace: boolean) {
    const next: Partial<LessonPlan> = {};
    for (const k of PLAN_FIELDS) {
      const v = plan[k];
      if (!v) continue;
      const have = ((lesson as any)[k] || "").trim();
      if (k === "title") { if (replace || !have || have === "Untitled lesson") next.title = v; continue; }
      if (replace || !have) (next as any)[k] = v;
    }
    if (plan.standards?.length) next.standards = Array.from(new Set([...(lesson.standards || []), ...plan.standards]));
    if (plan.minutes && !lesson.minutes) next.minutes = plan.minutes;
    if (lesson.status === "idea") next.status = "draft";
    set(next);
  }

  async function run(mode: "ideas" | "build" | "reteach", topicOverride?: string) {
    if (!(topicOverride || ai.topic.trim() || lesson.objective.trim() || (lesson.title && lesson.title !== "Untitled lesson"))) { setAi({ ...ai, error: "Type a topic or skill first (e.g. “main idea”, “adding fractions with unlike denominators”)." }); return; }
    setAi((p) => ({ ...p, busy: mode === "ideas" ? "Thinking up ideas…" : "Writing your full lesson plan…", error: "" }));
    try {
      const reteachOf = lesson.reteachOf ? lessons.find((l) => l.id === lesson.reteachOf) : undefined;
      const data = await askLessonAi(token, {
        ...aiContext(),
        ...(topicOverride ? { topic: topicOverride } : {}),
        mode, count: 6,
        ...(mode === "reteach" ? { students: lesson.forStudents?.length || 0, lesson: { ...aiContext().lesson, ...(reteachOf ? { objective: reteachOf.objective, title: reteachOf.title } : {}) } } : {}),
      });
      if (mode === "ideas") setAi((p) => ({ ...p, busy: "", ideas: data.ideas }));
      else { applyPlan(data.plan, ai.replace); setAi((p) => ({ ...p, busy: "", ideas: null, open: false })); say("Lesson plan filled in. Read it over and make it yours."); }
    } catch (e: any) { setAi((p) => ({ ...p, busy: "", error: e.message })); }
  }

  function mark(name: string, changes: Partial<StudentMark>) {
    const m = { ...(marks[name] || {}), ...changes };
    const next = { ...marks };
    if (!m.status && !m.score && !m.note) delete next[name]; else next[name] = m;
    set({ marks: next });
  }
  const markedCount = roster.filter((n) => marks[n]?.status).length;
  const counts = CHECKS.map((c) => ({ c, n: roster.filter((n) => marks[n]?.status === c).length }));

  const tabs: { id: Tab; label: React.ReactNode }[] = [
    { id: "plan", label: <><ClipboardList className="h-4 w-4" /> Plan</> },
    { id: "standards", label: <><BookCheck className="h-4 w-4" /> Standards{lesson.standards?.length ? ` (${lesson.standards.length})` : ""}</> },
    { id: "files", label: <><FileStack className="h-4 w-4" /> Files{lesson.files?.length ? ` (${lesson.files.length})` : ""}</> },
    { id: "students", label: <><Users className="h-4 w-4" /> Students{markedCount ? ` (${markedCount}/${roster.length})` : ""}</> },
    { id: "reflect", label: <><NotebookPen className="h-4 w-4" /> Notes</> },
  ];

  return (
    <HubModal title={lesson.title || "Lesson"} label="Lesson plan" onClose={onClose} size="lg" footer={
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => { if (!printHtml(lessonPlanHtml(lesson, cls, allBlocks))) say("Allow pop-ups for this site to print."); }}><Printer className="h-4 w-4" /> Print plan</button>
          <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => setDup(dup ? null : { date: lesson.date ? addDays(lesson.date, 7) : "", classId: cls?.id || "" })}><Copy className="h-4 w-4" /> Copy to…</button>
          {confirmDelete
            ? <button type="button" className={smallBtn + " min-h-10 border-rose-300 bg-rose-50 px-3 text-rose-700"} onClick={onDelete}><Trash2 className="h-4 w-4" /> Yes, delete</button>
            : <button type="button" className={smallBtn + " min-h-10 px-3 text-slate-500 hover:text-rose-600"} onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> Delete</button>}
        </div>
        <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Check className="h-4 w-4" /> Done</button>
      </div>
    }>
      <div className={`-mx-1 mb-4 rounded-2xl border-l-4 ${color.bar} bg-white px-1`}>
        <div className="grid gap-2 px-2 sm:grid-cols-6">
          <label className="sm:col-span-6"><span className="sr-only">Lesson title</span>
            <input value={lesson.title === "Untitled lesson" ? "" : lesson.title} onChange={(e) => set({ title: e.target.value || "Untitled lesson" })} placeholder="Lesson title" className="min-h-11 w-full rounded-xl border border-transparent bg-transparent px-1 text-xl font-bold text-slate-900 outline-none focus:border-slate-200 focus:bg-white" data-autofocus />
          </label>
          <select aria-label="Class" value={cls?.id || ""} onChange={(e) => { const c = classes.find((x) => x.id === e.target.value); set({ classId: e.target.value || undefined, group: c?.name || "", subject: c?.subject || lesson.subject }); }} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm sm:col-span-2">
            <option value="">No class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.block ? ` · ${blockName(allBlocks, c.block)}` : ""}</option>)}
          </select>
          <input type="date" aria-label="Date" value={lesson.date} onChange={(e) => set({ date: e.target.value })} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm sm:col-span-2" />
          <label className="flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-600">
            <input type="number" min={5} max={240} aria-label="Minutes" value={lesson.minutes || ""} placeholder="45" onChange={(e) => set({ minutes: Number(e.target.value) || undefined })} className="w-12 bg-transparent outline-none" /> min
          </label>
          <select aria-label="Status" value={lesson.status || "draft"} onChange={(e) => set({ status: e.target.value as any })} className={`min-h-10 rounded-xl border-0 px-2 text-sm font-semibold ${STATUS_STYLE[lesson.status || "draft"]}`}>
            {LESSON_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <input aria-label="Unit" value={lesson.unit || ""} onChange={(e) => set({ unit: e.target.value })} placeholder="Unit (e.g. Unit 3: Fractions)" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm sm:col-span-4" />
          <div className="flex items-center gap-2 text-xs text-slate-500 sm:col-span-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${(fullness.done / fullness.of) * 100}%` }} /></div>
            {fullness.done}/{fullness.of} planned
          </div>
        </div>
        {lesson.reteachOf && <p className="mt-2 px-2 text-xs font-semibold text-rose-700"><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Reteach{lesson.forStudents?.length ? ` for ${lesson.forStudents.join(", ")}` : ""}</p>}
      </div>

      {dup && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <label className="text-xs font-semibold text-slate-500">Copy to class<select value={dup.classId} onChange={(e) => setDup({ ...dup, classId: e.target.value })} className="mt-1 block min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm font-normal text-slate-800"><option value="">No class</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-500">On<input type="date" value={dup.date} onChange={(e) => setDup({ ...dup, date: e.target.value })} className="mt-1 block min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm font-normal text-slate-800" /></label>
          <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => { onDuplicate(dup.date, dup.classId); setDup(null); }}><CalendarPlus className="h-4 w-4" /> Make a copy</button>
          <span className="text-xs text-slate-500">Great for teaching the same lesson to another period.</span>
        </div>
      )}

      <Segmented label="Lesson sections" value={tab} onChange={setTab} options={tabs} />

      <div className="mt-4">
        {tab === "plan" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 ring-1 ring-violet-100">
              <button type="button" onClick={() => setAi({ ...ai, open: !ai.open })} className="flex w-full items-center justify-between gap-2 text-left">
                <span className="flex items-center gap-2 text-sm font-semibold text-violet-900"><Sparkles className="h-4 w-4" /> AI lesson helper</span>
                <span className="text-xs font-medium text-violet-700">{ai.open ? "Hide" : "Ideas & full plans"}</span>
              </button>
              {ai.open && (
                <div className="mt-3 space-y-2">
                  <input value={ai.topic} onChange={(e) => setAi({ ...ai, topic: e.target.value })} placeholder="What's the lesson about? e.g. finding the main idea in nonfiction" className="min-h-10 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm outline-none focus:border-violet-400" />
                  <textarea value={ai.notes} onChange={(e) => setAi({ ...ai, notes: e.target.value })} rows={2} placeholder="Anything to know? (small group of 6, co-taught, needs movement, using the novel Wonder, no tech…)" className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400" />
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={!!ai.busy} onClick={() => void run("ideas")} className={smallBtn + " min-h-10 border-violet-200 px-3 text-violet-800"}><Lightbulb className="h-4 w-4" /> Give me ideas</button>
                    <button type="button" disabled={!!ai.busy} onClick={() => void run(lesson.reteachOf ? "reteach" : "build")} className={aiBtn}><Wand2 className="h-4 w-4" /> {lesson.reteachOf ? "Build reteach lesson" : "Build the full plan"}</button>
                    <label className="flex items-center gap-1.5 text-xs text-violet-900"><input type="checkbox" checked={ai.replace} onChange={(e) => setAi({ ...ai, replace: e.target.checked })} /> Rewrite parts I already filled in</label>
                  </div>
                  {ai.busy && <div className="text-sm text-violet-800"><Spinner label={ai.busy} /></div>}
                  {ai.error && <p className="text-sm text-rose-700">{ai.error}</p>}
                  {ai.ideas && (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {ai.ideas.map((idea) => (
                        <li key={idea.title} className="flex flex-col rounded-xl bg-white p-3 ring-1 ring-violet-100">
                          <div className="font-semibold text-slate-900">{idea.title}</div>
                          <p className="mt-1 text-sm text-slate-600">{idea.summary}</p>
                          {idea.activity && <p className="mt-1 text-xs text-slate-500"><b>Activity:</b> {idea.activity}</p>}
                          <button type="button" disabled={!!ai.busy} onClick={() => { set({ title: idea.title }); setAi((p) => ({ ...p, topic: idea.title, notes: `${p.notes}\nUse this idea: ${idea.summary} ${idea.activity}`.trim() })); void run("build", `${idea.title}: ${idea.summary} ${idea.activity}`); }} className={smallBtn + " mt-2 self-start border-violet-200 text-violet-800"}><Wand2 className="h-3.5 w-3.5" /> Build this one</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {lesson.summary && (
              <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Overview</span>
                <textarea value={lesson.summary} onChange={(e) => set({ summary: e.target.value })} rows={2} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              </label>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {PLAN_FIELDS.filter((k) => k !== "title").map((k) => {
                const wide = k === "objective" || k === "iDo" || k === "weDo" || k === "youDo";
                return (
                  <label key={k} className={`block ${wide ? "md:col-span-2" : ""}`}>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{PLAN_LABEL[k]}</span>
                    <textarea value={(lesson as any)[k] || ""} onChange={(e) => set({ [k]: e.target.value } as any)} placeholder={PLACEHOLDER[k]} rows={k === "objective" ? 2 : wide ? 5 : 3}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {tab === "standards" && (
          <StandardsPicker token={token} chosen={lesson.standards || []} onChange={(standards) => set({ standards })} state={state} onState={onState}
            grade={cls?.grade || ""} subject={cls?.subject || lesson.subject || ""} topic={lesson.objective || (lesson.title !== "Untitled lesson" ? lesson.title : "")} recent={recentStandards} />
        )}

        {tab === "files" && (
          <MaterialSlots token={token} files={lesson.files || []} onChange={(files) => set({ files })} makeId={makeId} drive={drive} lessonTitle={lesson.title} color={cls?.color || "teal"} className={cls?.name || ""} aiContext={aiContext} say={say} />
        )}

        {tab === "students" && (
          <div className="space-y-3">
            {!roster.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{cls ? `${cls.name} has no students yet. Add them in Classes, or add one below.` : "Pick a class for this lesson to bring in its students, or add students below."}</p>}
            {roster.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {counts.map(({ c, n }) => <span key={c} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${n ? CHECK_STYLE[c].on : "border-slate-200 text-slate-400"}`}>{CHECK_LABEL[c]}: {n}</span>)}
                <button type="button" className={smallBtn} onClick={() => { const next = { ...marks }; for (const n of roster) if (!next[n]?.status) next[n] = { ...(next[n] || {}), status: "good" }; set({ marks: next, status: "taught" }); }}>Mark the rest “Did good”</button>
              </div>
            )}
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {roster.map((name) => {
                const m = marks[name] || {};
                return (
                  <li key={name} className="grid gap-2 p-3 lg:grid-cols-[minmax(0,10rem)_auto_1fr] lg:items-center">
                    <div className="truncate font-medium text-slate-900">{name}</div>
                    <div className="flex flex-wrap gap-1">
                      {CHECKS.map((c) => (
                        <button key={c} type="button" aria-pressed={m.status === c} onClick={() => mark(name, { status: m.status === c ? undefined : c })} className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${m.status === c ? CHECK_STYLE[c].on : CHECK_STYLE[c].off}`}>{CHECK_LABEL[c]}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={m.score || ""} onChange={(e) => mark(name, { score: e.target.value })} placeholder="Score" aria-label={`${name} score`} className="min-h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm" />
                      <input value={m.note || ""} onChange={(e) => mark(name, { note: e.target.value })} placeholder="Note (what they missed, what helped)" aria-label={`${name} note`} className="min-h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-sm" />
                    </div>
                  </li>
                );
              })}
            </ul>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = extra.trim(); if (!n) return; if (!roster.includes(n)) set({ forStudents: [...roster, n] }); setExtra(""); }}>
              <input list="lesson-caseload" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add a student to this lesson" className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
              <datalist id="lesson-caseload">{caseload.filter((n) => !roster.includes(n)).map((n) => <option key={n} value={n} />)}</datalist>
              <button type="submit" className={smallBtn + " min-h-10 px-3"}><UserPlus className="h-4 w-4" /> Add</button>
            </form>
            {reteachNow.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-200">
                <div className="text-sm text-rose-900"><b>{reteachNow.length} need a reteach:</b> {reteachNow.join(", ")}</div>
                <button type="button" onClick={() => onPlanReteach(reteachNow)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-700"><RotateCcw className="h-4 w-4" /> Plan a reteach</button>
              </div>
            )}
          </div>
        )}

        {tab === "reflect" && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">How did it go? What would you change next time?</span>
            <textarea value={lesson.reflection || ""} onChange={(e) => set({ reflection: e.target.value })} rows={8} placeholder="Ran out of time on the we do… the partner activity worked great… start with the vocabulary next time…" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6" />
          </label>
        )}
      </div>
    </HubModal>
  );
}
