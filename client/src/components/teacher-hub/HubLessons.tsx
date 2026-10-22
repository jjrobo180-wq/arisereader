// Arise WorkHub's Lesson Planner (the "Lessons" screen).
//
// Plan by class (period/block), each with its own students, in a week grid, a day, a month, a
// year-ahead view, a searchable list, or by student (who mastered it, who needs a reteach).
// An AI helper builds ideas and full plans, finds state standards, makes worksheets with answer
// keys and PowerPoints, and plans whole units ahead. See shared/lessonPlanner.ts for the rules.
import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, CloudSnow, FileStack, LayoutGrid, List, Plus, RotateCcw, Search,
  Settings2, Sparkles, Trash2, Users, X, BookCheck, CalendarClock,
} from "lucide-react";
import type { Workspace } from "@shared/teacherHub";
import { cleanDriveFiles } from "@shared/driveApp";
import { blockName, schoolBlocks } from "@shared/hubBlocks";
import {
  CHECK_LABEL, CLASS_COLORS, US_STATES, weekdayOf, GRADES, LESSON_STATUSES, LESSON_SUBJECTS, STATUS_LABEL, WEEKDAYS, addDays, addMonths, bumpLessons, classOf, cleanClasses,
  cleanLessons, copyLesson, meetsOn, monthWeeks, needsReteach, nextMeetings, planFullness, schoolWeek, standardCode, studentRecords,
  type LessonClass, type LessonPlan, type LessonStatus, type UnitLesson,
} from "@shared/lessonPlanner";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { HubModal } from "./HubModal";
import HubLessonEditor from "./HubLessonEditor";
import { WorksheetMaker } from "./HubWorksheet";
import { COLOR, NO_CLASS, STATUS_STYLE, Segmented, Spinner, aiBtn, askLessonAi, smallBtn } from "./HubLessonParts";

type View = "week" | "day" | "month" | "year" | "list" | "students";
const VIEWS: View[] = ["week", "day", "month", "year", "list", "students"];
type ListSort = "date" | "newest" | "title" | "status" | "class";
const LIST_SORTS: { id: ListSort; label: string }[] = [
  { id: "date", label: "Date (soonest first)" }, { id: "newest", label: "Date (latest first)" }, { id: "title", label: "A to Z" }, { id: "status", label: "Status" }, { id: "class", label: "Class" },
];

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const nice = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", opts) : "No date");

export default function HubLessons({ workspace, setWorkspace, token, makeId, say }: {
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  token: string | null;
  makeId: () => string;
  say: (text: string) => void;
}) {
  const today = localToday();
  const lessons = useMemo(() => cleanLessons(workspace.lessons), [workspace.lessons]);
  const classes = useMemo(() => cleanClasses((workspace as any).lessonClasses), [(workspace as any).lessonClasses]);
  const state = String((workspace as any).lessonState || "");
  const blocks = schoolBlocks(workspace);
  const drive = cleanDriveFiles((workspace as any).drive);
  const caseload = workspace.students.map((s) => s.name);

  const [view, setView] = useSavedChoice<View>("hub-lessons-view", "week", VIEWS);
  const [classFilter, setClassFilter] = useSavedChoice<string>("hub-lessons-class", "");
  const [listSort, setListSort] = useSavedChoice<ListSort>("hub-lessons-sort", "date", LIST_SORTS.map((s) => s.id));
  const [statusFilter, setStatusFilter] = useSavedChoice<"" | LessonStatus>("hub-lessons-status", "", ["", ...LESSON_STATUSES]);
  const [cursor, setCursor] = useState(today);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [classesOpen, setClassesOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [makerOpen, setMakerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeClass = classes.find((c) => c.id === classFilter);
  const shownClasses = activeClass ? [activeClass] : classes;
  const inScope = (l: LessonPlan) => !activeClass || classOf(l, classes)?.id === activeClass.id;

  // ─── Changing things ───
  const setLessons = (fn: (all: LessonPlan[]) => LessonPlan[]) => setWorkspace((p) => ({ ...p, lessons: fn(cleanLessons(p.lessons)) as any }));
  const setClasses = (fn: (all: LessonClass[]) => LessonClass[]) => setWorkspace((p) => ({ ...p, lessonClasses: fn(cleanClasses((p as any).lessonClasses)) } as any));
  const setState = (s: string) => setWorkspace((p) => ({ ...p, lessonState: s } as any));
  const saveLesson = (l: LessonPlan) => setLessons((all) => all.map((x) => (x.id === l.id ? l : x)));

  function newLesson(date = cursor, classId = activeClass?.id || "", extra: Partial<LessonPlan> = {}) {
    const c = classes.find((x) => x.id === classId);
    const l: LessonPlan = { id: makeId(), title: "Untitled lesson", subject: c?.subject || "", group: c?.name || "", date, objective: "", materials: "", status: "draft", standards: [], files: [], marks: {}, ...(classId ? { classId } : {}), ...extra };
    setLessons((all) => [l, ...all]);
    setFresh(l.id);
    setOpenId(l.id);
    return l;
  }
  function closeEditor() {
    const l = lessons.find((x) => x.id === openId);
    // A new lesson closed without anything in it isn't kept.
    if (l && fresh === l.id && l.title === "Untitled lesson" && !planFullness(l).done && !l.summary) setLessons((all) => all.filter((x) => x.id !== l.id));
    setOpenId(null); setFresh(null);
  }
  function planReteach(of: LessonPlan, students: string[]) {
    const c = classOf(of, classes);
    const date = c ? nextMeetings(c, addDays(of.date > today ? of.date : today, 1), 1)[0] : addDays(today, 1);
    const l = copyLesson(of, makeId(), {
      title: `${of.title} — reteach`, date, status: "draft", reteachOf: of.id, forStudents: students, files: [], hook: "", iDo: "", weDo: "", youDo: "", closure: "", reflection: undefined,
    });
    setLessons((all) => [l, ...all]);
    setFresh(null);
    setOpenId(l.id);
    say(`Reteach lesson made for ${students.length} student${students.length === 1 ? "" : "s"}. Use “Build reteach lesson” to fill it in.`);
  }

  const opened = lessons.find((l) => l.id === openId);

  // ─── The header ───
  const step = view === "month" ? (n: number) => setCursor(addMonths(cursor, n)) : view === "year" ? (n: number) => setCursor(addMonths(cursor, n * 3)) : view === "day" ? (n: number) => {
    let d = addDays(cursor, n);
    while (["Sat", "Sun"].includes(weekdayOf(d))) d = addDays(d, n);
    setCursor(d);
  } : (n: number) => setCursor(addDays(cursor, n * 7));
  const rangeLabel = view === "week" ? (() => { const w = schoolWeek(cursor); return `${nice(w[0], { month: "short", day: "numeric" })} – ${nice(w[4], { month: "short", day: "numeric", year: "numeric" })}`; })()
    : view === "day" ? nice(cursor, { weekday: "long", month: "long", day: "numeric" })
    : view === "month" ? nice(cursor, { month: "long", year: "numeric" })
    : view === "year" ? `${nice(`${cursor.slice(0, 7)}-01`, { month: "short", year: "numeric" })} – ${nice(addMonths(cursor, 9), { month: "short", year: "numeric" })}` : "";

  const upcoming = lessons.filter((l) => inScope(l) && l.date >= today && l.date <= addDays(today, 6));
  const notReady = upcoming.filter((l) => l.status !== "ready" && l.status !== "taught");
  const openReteaches = useMemo(() => studentRecords(lessons, classes, activeClass?.id || "").reduce((n, r) => n + (r.openReteach.length ? 1 : 0), 0), [lessons, classes, activeClass]);

  return (
    <div className="space-y-4 text-slate-900" data-testid="lesson-planner">
      {/* Stats + main actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => newLesson()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> New lesson</button>
        <button type="button" onClick={() => setUnitOpen(true)} className={aiBtn + " min-h-11"}><Sparkles className="h-4 w-4" /> Plan a unit with AI</button>
        <button type="button" onClick={() => setMakerOpen(true)} className={smallBtn + " min-h-11 px-3 text-sm"}><FileStack className="h-4 w-4" /> Worksheet maker</button>
        <button type="button" onClick={() => setClassesOpen(true)} className={smallBtn + " min-h-11 px-3 text-sm"}><Settings2 className="h-4 w-4" /> Classes & periods</button>
        <button type="button" onClick={() => setShiftOpen(true)} className={smallBtn + " min-h-11 px-3 text-sm"} title="Snow day, assembly, ran long — push lessons back"><CloudSnow className="h-4 w-4" /> Shift lessons</button>
        <div className="ml-auto flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{upcoming.length} this week</span>
          {notReady.length > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">{notReady.length} not ready yet</span>}
          {openReteaches > 0 && <button type="button" onClick={() => setView("students")} className="rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-800 hover:bg-rose-200">{openReteaches} student{openReteaches === 1 ? "" : "s"} need a reteach</button>}
        </div>
      </div>

      {!classes.length && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-teal-300 bg-teal-50/60 p-4">
          <div className="min-w-0">
            <div className="font-semibold text-teal-950">Start by adding your classes</div>
            <p className="text-sm text-teal-900/80">Add each period or block you teach, with its students. Then plan each one in its own row, week by week.</p>
          </div>
          <button type="button" onClick={() => setClassesOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"><Plus className="h-4 w-4" /> Add classes</button>
        </div>
      )}

      {/* View + class pickers */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented label="View" value={view} onChange={setView} options={[
          { id: "week", label: <><LayoutGrid className="h-4 w-4" /> Week</> },
          { id: "day", label: <><CalendarDays className="h-4 w-4" /> Day</> },
          { id: "month", label: <><CalendarRange className="h-4 w-4" /> Month</> },
          { id: "year", label: <><CalendarClock className="h-4 w-4" /> Plan ahead</> },
          { id: "list", label: <><List className="h-4 w-4" /> List</> },
          { id: "students", label: <><Users className="h-4 w-4" /> Students</> },
        ]} />
        {classes.length > 0 && (
          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
            <button type="button" onClick={() => setClassFilter("")} className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${!activeClass ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>All classes</button>
            {classes.map((c) => (
              <button key={c.id} type="button" onClick={() => setClassFilter(c.id)} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${activeClass?.id === c.id ? `${COLOR[c.color].chip} ring-2 ${COLOR[c.color].ring}` : "border-slate-200 bg-white text-slate-600"}`}>
                <span className={`h-2 w-2 rounded-full ${COLOR[c.color].dot}`} />{c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {(view === "week" || view === "day" || view === "month" || view === "year") && (
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Back" onClick={() => step(-1)} className={smallBtn + " min-h-10 min-w-10"}><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(today)} className={smallBtn + " min-h-10 px-3"}>Today</button>
          <button type="button" aria-label="Forward" onClick={() => step(1)} className={smallBtn + " min-h-10 min-w-10"}><ChevronRight className="h-4 w-4" /></button>
          <div className="ml-1 min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 sm:text-base">{rangeLabel}</div>
          <input type="date" aria-label="Jump to a date" value={cursor} onChange={(e) => e.target.value && setCursor(e.target.value)} className="hidden min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm sm:block" />
        </div>
      )}

      {view === "week" && <WeekView week={schoolWeek(cursor)} today={today} classes={shownClasses} allClasses={classes} lessons={lessons.filter(inScope)} blocks={blocks} onOpen={setOpenId} onNew={newLesson} showUnassigned={!activeClass} />}
      {view === "day" && <DayView day={cursor} today={today} classes={shownClasses} allClasses={classes} lessons={lessons.filter(inScope)} blocks={blocks} onOpen={setOpenId} onNew={newLesson} showUnassigned={!activeClass} />}
      {view === "month" && <MonthView cursor={cursor} today={today} classes={classes} lessons={lessons.filter(inScope)} onOpen={setOpenId} onNew={(d) => newLesson(d)} onDay={(d) => { setCursor(d); setView("day"); }} />}
      {view === "year" && <YearView cursor={cursor} classes={classes} lessons={lessons.filter(inScope)} onOpen={setOpenId} onMonth={(d) => { setCursor(d); setView("month"); }} onUnit={() => setUnitOpen(true)} />}
      {view === "list" && (
        <ListView lessons={lessons.filter(inScope)} classes={classes} search={search} setSearch={setSearch} sort={listSort} setSort={setListSort} status={statusFilter} setStatus={setStatusFilter} today={today} onOpen={setOpenId} />
      )}
      {view === "students" && <StudentsView lessons={lessons} classes={classes} classId={activeClass?.id || ""} onOpen={setOpenId} onReteach={planReteach} onPickClass={setClassFilter} />}

      {opened && (
        <HubLessonEditor
          key={opened.id}
          lesson={opened} lessons={lessons} classes={classes} caseload={caseload} state={state} onState={setState} token={token} makeId={makeId} drive={drive} blocks={blocks}
          onChange={saveLesson}
          onDelete={() => { setLessons((all) => all.filter((x) => x.id !== opened.id)); setOpenId(null); say("Lesson deleted."); }}
          onDuplicate={(date, classId) => { const c = classes.find((x) => x.id === classId); const copy = copyLesson(opened, makeId(), { date, classId: classId || undefined, group: c?.name || "" }); setLessons((all) => [copy, ...all]); say(`Copied to ${c?.name || "no class"}${date ? `, ${nice(date)}` : ""}.`); }}
          onPlanReteach={(students) => planReteach(opened, students)}
          onClose={closeEditor}
          say={say}
        />
      )}
      {classesOpen && <ClassesManager classes={classes} setClasses={setClasses} caseload={caseload} blocks={blocks} makeId={makeId} lessons={lessons} onClose={() => setClassesOpen(false)} />}
      {unitOpen && <UnitPlanner token={token} classes={classes} lessons={lessons} state={state} onState={setState} defaultClass={activeClass?.id || classes[0]?.id || ""} today={today}
        onAdd={(made) => { setLessons((all) => [...made, ...all]); say(`${made.length} lessons added to your plan.`); setView("year"); }} onClose={() => setUnitOpen(false)} makeId={makeId} />}
      {makerOpen && <WorksheetMaker token={token} state={state} className={activeClass?.name || ""}
        lessons={[...lessons].filter((l) => !l.date || l.date >= addDays(today, -30)).sort((a, b) => (a.date || "9").localeCompare(b.date || "9")).slice(0, 200).map((l) => ({ id: l.id, label: `${l.date ? nice(l.date, { month: "short", day: "numeric" }) + " · " : ""}${l.title}${classOf(l, classes) ? ` (${classOf(l, classes)!.name})` : ""}` }))}
        onSave={(lessonId, ws) => { const pair = makeId(), at = new Date().toISOString(); setLessons((all) => all.map((l) => l.id !== lessonId ? l : { ...l, files: [...(l.files || []), { id: makeId(), kind: "worksheet", name: ws.title, worksheet: ws, addedAt: at, pair }, { id: makeId(), kind: "answerKey", name: `${ws.title} — answer key`, worksheet: ws, addedAt: at, pair }] })); say("Worksheet and answer key saved to the lesson."); }}
        onClose={() => setMakerOpen(false)} />}
      {shiftOpen && <ShiftLessons classes={classes} today={today} onShift={(classIds, from, by) => {
        setLessons((all) => classIds.reduce((acc, id) => bumpLessons(acc, classes, id, from, by), all));
        say(`Lessons moved ${by > 0 ? "later" : "earlier"} by ${Math.abs(by)} class day${Math.abs(by) === 1 ? "" : "s"}.`);
        setShiftOpen(false);
      }} onClose={() => setShiftOpen(false)} />}
    </div>
  );
}

// ─── A lesson card ──────────────────────────────────────────────────────────

function LessonCard({ l, classes, onOpen, compact }: { l: LessonPlan; classes: LessonClass[]; onOpen: (id: string) => void; compact?: boolean }) {
  const c = classOf(l, classes);
  const color = c ? COLOR[c.color] : NO_CLASS;
  const full = planFullness(l);
  const reteach = Object.values(l.marks || {}).filter((m) => m.status === "reteach").length;
  const marked = Object.values(l.marks || {}).filter((m) => m.status).length;
  return (
    <button type="button" onClick={() => onOpen(l.id)} className={`group w-full rounded-xl border border-slate-200 border-l-4 ${color.bar} bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md`} data-testid="lesson-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900">{l.reteachOf && <RotateCcw className="mr-1 inline h-3.5 w-3.5 text-rose-600" />}{l.title}</div>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[l.status || "draft"]}`}>{l.status === "ready" ? "Ready" : STATUS_LABEL[l.status || "draft"]}</span>
      </div>
      {!compact && l.objective && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{l.objective}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {(l.standards || []).slice(0, compact ? 1 : 3).map((s) => <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{standardCode(s)}</span>)}
        {!!l.files?.length && <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"><FileStack className="h-3 w-3" />{l.files.length}</span>}
        {marked > 0 && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">✓ {marked}</span>}
        {reteach > 0 && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">{reteach} reteach</span>}
        {!compact && <span className="ml-auto text-[10px] text-slate-400">{full.done}/{full.of}</span>}
      </div>
    </button>
  );
}

// ─── Week ───────────────────────────────────────────────────────────────────

function WeekView({ week, today, classes, allClasses, lessons, blocks, onOpen, onNew, showUnassigned }: {
  week: string[]; today: string; classes: LessonClass[]; allClasses: LessonClass[]; lessons: LessonPlan[]; blocks: ReturnType<typeof schoolBlocks>;
  onOpen: (id: string) => void; onNew: (date: string, classId: string) => void; showUnassigned: boolean;
}) {
  const loose = lessons.filter((l) => !classOf(l, allClasses) && week.includes(l.date));
  const rows: { c: LessonClass | null }[] = [...classes.map((c) => ({ c })), ...(showUnassigned && (loose.length || !classes.length) ? [{ c: null }] : [])];
  return (
    <>
    {/* On a phone the week reads top to bottom, a day at a time, each class inside it. */}
    <div className="space-y-3 md:hidden" data-testid="lesson-week-phone">
      {week.map((d) => (
        <section key={d} className={`rounded-2xl border bg-white p-3 ${d === today ? "border-teal-300 ring-1 ring-teal-200" : "border-slate-200"}`}>
          <div className={`mb-2 text-sm font-semibold ${d === today ? "text-teal-800" : "text-slate-700"}`}>{nice(d, { weekday: "long", month: "short", day: "numeric" })}{d === today ? " · Today" : ""}</div>
          <div className="space-y-2">
            {rows.map(({ c }) => {
              const here = lessons.filter((l) => l.date === d && (c ? classOf(l, allClasses)?.id === c.id : !classOf(l, allClasses)));
              if (c && !meetsOn(c, d) && !here.length) return null;
              const color = c ? COLOR[c.color] : NO_CLASS;
              return (
                <div key={c?.id || "none"} className="flex items-start gap-2">
                  <span className={`mt-3 h-2.5 w-2.5 shrink-0 rounded-full ${color.dot}`} title={c?.name || "No class"} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className={`text-[11px] font-semibold ${color.text}`}>{c?.name || "No class"}</div>
                    {here.map((l) => <LessonCard key={l.id} l={l} classes={allClasses} onOpen={onOpen} />)}
                    {!here.length && <button type="button" onClick={() => onNew(d, c?.id || "")} className="flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 text-xs font-medium text-slate-400"><Plus className="h-3.5 w-3.5" /> Plan</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
      <div className="grid min-w-[860px]" style={{ gridTemplateColumns: "150px repeat(5, minmax(0, 1fr))" }}>
        <div className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50" />
        {week.map((d) => (
          <div key={d} className={`border-b border-l border-slate-200 px-2 py-2 text-center text-xs font-semibold ${d === today ? "bg-teal-50 text-teal-800" : "bg-slate-50 text-slate-500"}`}>
            {nice(d, { weekday: "short" })} <span className={`ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full ${d === today ? "bg-teal-600 px-1.5 text-white" : ""}`}>{d.slice(8).replace(/^0/, "")}</span>
          </div>
        ))}
        {rows.map(({ c }) => (
          <Row key={c?.id || "none"} c={c} week={week} today={today} lessons={lessons.filter((l) => (c ? classOf(l, allClasses)?.id === c.id : !classOf(l, allClasses)))} classes={allClasses} blocks={blocks} onOpen={onOpen} onNew={onNew} />
        ))}
      </div>
    </div>
    </>
  );
}

function Row({ c, week, today, lessons, classes, blocks, onOpen, onNew }: { c: LessonClass | null; week: string[]; today: string; lessons: LessonPlan[]; classes: LessonClass[]; blocks: ReturnType<typeof schoolBlocks>; onOpen: (id: string) => void; onNew: (date: string, classId: string) => void }) {
  const color = c ? COLOR[c.color] : NO_CLASS;
  return (
    <>
      <div className={`sticky left-0 z-10 border-b border-slate-200 ${color.soft} px-3 py-2`}>
        <div className={`flex items-center gap-1.5 text-sm font-semibold ${color.text}`}><span className={`mt-1 h-2.5 w-2.5 shrink-0 self-start rounded-full ${color.dot}`} /><span className="leading-tight [overflow-wrap:anywhere]">{c?.name || "No class"}</span></div>
        {c && <div className="mt-0.5 text-[11px] text-slate-500">{[blockName(blocks, c.block), c.grade && `Gr ${c.grade}`, c.students.length && `${c.students.length} students`].filter(Boolean).join(" · ")}</div>}
      </div>
      {week.map((d) => {
        const here = lessons.filter((l) => l.date === d);
        const meets = !c || meetsOn(c, d);
        return (
          <div key={d} className={`min-h-[96px] space-y-1.5 border-b border-l border-slate-200 p-1.5 ${d === today ? "bg-teal-50/30" : ""} ${!meets ? "bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_6px,#f1f5f9_6px,#f1f5f9_12px)]" : ""}`}>
            {here.map((l) => <LessonCard key={l.id} l={l} classes={classes} onOpen={onOpen} compact />)}
            {meets && (
              <button type="button" onClick={() => onNew(d, c?.id || "")} aria-label={`Add a lesson${c ? ` for ${c.name}` : ""} on ${nice(d)}`} className={`flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 text-xs font-medium text-slate-400 transition hover:border-slate-400 hover:text-slate-700 ${here.length ? "min-h-7" : "min-h-[80px]"}`}>
                <Plus className="h-3.5 w-3.5" />{here.length ? "" : "Plan"}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Day ────────────────────────────────────────────────────────────────────

function DayView({ day, today, classes, allClasses, lessons, blocks, onOpen, onNew, showUnassigned }: {
  day: string; today: string; classes: LessonClass[]; allClasses: LessonClass[]; lessons: LessonPlan[]; blocks: ReturnType<typeof schoolBlocks>;
  onOpen: (id: string) => void; onNew: (date: string, classId: string) => void; showUnassigned: boolean;
}) {
  const order = (c: LessonClass) => { const i = blocks.findIndex((b) => b.id === c.block); return i < 0 ? 99 : i; };
  const sorted = [...classes].sort((a, b) => order(a) - order(b));
  const loose = lessons.filter((l) => l.date === day && !classOf(l, allClasses));
  return (
    <div className="space-y-3">
      {day === today && <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Today</div>}
      {sorted.map((c) => {
        const here = lessons.filter((l) => l.date === day && classOf(l, allClasses)?.id === c.id);
        const meets = meetsOn(c, day);
        return (
          <section key={c.id} className={`rounded-2xl border border-slate-200 border-l-4 ${COLOR[c.color].bar} bg-white p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-500">{[blockName(blocks, c.block), c.room && `Room ${c.room}`, c.students.length && `${c.students.length} students`].filter(Boolean).join(" · ") || " "}</div>
              </div>
              {meets ? <button type="button" onClick={() => onNew(day, c.id)} className={smallBtn}><Plus className="h-3.5 w-3.5" /> Lesson</button> : <span className="text-xs text-slate-400">Doesn't meet today</span>}
            </div>
            {here.length ? <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">{here.map((l) => <DayLesson key={l.id} l={l} lessons={lessons} onOpen={onOpen} />)}</div> : meets && <p className="mt-3 text-sm text-slate-400">Nothing planned yet.</p>}
          </section>
        );
      })}
      {showUnassigned && (loose.length > 0 || !classes.length) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between"><div className="font-semibold text-slate-900">No class</div><button type="button" onClick={() => onNew(day, "")} className={smallBtn}><Plus className="h-3.5 w-3.5" /> Lesson</button></div>
          {loose.length ? <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">{loose.map((l) => <DayLesson key={l.id} l={l} lessons={lessons} onOpen={onOpen} />)}</div> : <p className="mt-3 text-sm text-slate-400">Nothing planned.</p>}
        </section>
      )}
    </div>
  );
}

function DayLesson({ l, lessons, onOpen }: { l: LessonPlan; lessons: LessonPlan[]; onOpen: (id: string) => void }) {
  const reteach = needsReteach(l, lessons);
  return (
    <button type="button" onClick={() => onOpen(l.id)} className="rounded-xl bg-slate-50 p-3 text-left ring-1 ring-slate-200 transition hover:bg-white hover:shadow-sm">
      <div className="flex items-start justify-between gap-2"><div className="font-semibold text-slate-900">{l.title}</div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[l.status || "draft"]}`}>{STATUS_LABEL[l.status || "draft"]}</span></div>
      {l.objective && <p className="mt-1 text-sm text-slate-600">{l.objective}</p>}
      {l.hook && <p className="mt-1 line-clamp-2 text-xs text-slate-500"><b>Warm-up:</b> {l.hook}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {(l.standards || []).map((s) => <span key={s} className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200">{standardCode(s)}</span>)}
        {(l.files || []).map((f) => <span key={f.id} className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200">📎 {f.name}</span>)}
      </div>
      {reteach.length > 0 && <p className="mt-2 text-xs font-semibold text-rose-700">Needs reteach: {reteach.join(", ")}</p>}
    </button>
  );
}

// ─── Month ──────────────────────────────────────────────────────────────────

function MonthView({ cursor, today, classes, lessons, onOpen, onNew, onDay }: { cursor: string; today: string; classes: LessonClass[]; lessons: LessonPlan[]; onOpen: (id: string) => void; onNew: (d: string) => void; onDay: (d: string) => void }) {
  const month = cursor.slice(0, 7);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <div className="grid min-w-[720px] grid-cols-5">
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => <div key={d} className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-500">{d}</div>)}
        {monthWeeks(cursor).flat().map((d) => {
          const here = lessons.filter((l) => l.date === d).sort((a, b) => (classOf(a, classes)?.name || "").localeCompare(classOf(b, classes)?.name || ""));
          const out = d.slice(0, 7) !== month;
          return (
            <div key={d} className={`group min-h-[110px] border-b border-l border-slate-100 p-1.5 first:border-l-0 ${out ? "bg-slate-50/60" : ""}`}>
              <div className="mb-1 flex items-center justify-between">
                <button type="button" onClick={() => onDay(d)} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${d === today ? "bg-teal-600 text-white" : out ? "text-slate-300" : "text-slate-600 hover:bg-slate-100"}`}>{Number(d.slice(8))}</button>
                <button type="button" aria-label={`Add a lesson on ${nice(d)}`} onClick={() => onNew(d)} className="rounded p-0.5 text-slate-300 opacity-0 transition hover:text-slate-700 group-hover:opacity-100 focus:opacity-100"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <div className="space-y-1">
                {here.slice(0, 4).map((l) => {
                  const c = classOf(l, classes);
                  const color = c ? COLOR[c.color] : NO_CLASS;
                  return <button key={l.id} type="button" onClick={() => onOpen(l.id)} title={`${c?.name ? `${c.name}: ` : ""}${l.title}`} className={`block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium ${color.chip}`}>{l.title}</button>;
                })}
                {here.length > 4 && <button type="button" onClick={() => onDay(d)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800">+{here.length - 4} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Plan ahead (10 months) ─────────────────────────────────────────────────

function YearView({ cursor, classes, lessons, onOpen, onMonth, onUnit }: { cursor: string; classes: LessonClass[]; lessons: LessonPlan[]; onOpen: (id: string) => void; onMonth: (d: string) => void; onUnit: () => void }) {
  const months = Array.from({ length: 10 }, (_, i) => addMonths(cursor, i));
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Your plan, months ahead, grouped by unit. Tap a month to open it, or a lesson to plan it.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {months.map((m) => {
          const key = m.slice(0, 7);
          const here = lessons.filter((l) => l.date.startsWith(key)).sort((a, b) => a.date.localeCompare(b.date));
          const units = new Map<string, LessonPlan[]>();
          for (const l of here) { const u = l.unit || "Other lessons"; units.set(u, [...(units.get(u) || []), l]); }
          const ready = here.filter((l) => l.status === "ready" || l.status === "taught").length;
          return (
            <section key={key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3">
              <button type="button" onClick={() => onMonth(m)} className="flex items-center justify-between gap-2 text-left">
                <span className="font-semibold text-slate-900">{nice(`${key}-01`, { month: "long", year: "numeric" })}</span>
                <span className="text-xs text-slate-500">{here.length ? `${ready}/${here.length} ready` : "Empty"}</span>
              </button>
              {here.length > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(ready / here.length) * 100}%` }} /></div>}
              <div className="mt-2 flex-1 space-y-2">
                {[...units.entries()].map(([u, ls]) => (
                  <div key={u}>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{u} · {ls.length}</div>
                    <ul className="mt-1 space-y-0.5">
                      {ls.slice(0, 6).map((l) => {
                        const c = classOf(l, classes);
                        return (
                          <li key={l.id}><button type="button" onClick={() => onOpen(l.id)} className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs hover:bg-slate-50">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${c ? COLOR[c.color].dot : "bg-slate-300"}`} />
                            <span className="w-12 shrink-0 text-slate-400">{nice(l.date, { month: "numeric", day: "numeric" })}</span>
                            <span className="truncate text-slate-700">{l.title}</span>
                          </button></li>
                        );
                      })}
                      {ls.length > 6 && <li className="px-1 text-[11px] text-slate-400">+{ls.length - 6} more</li>}
                    </ul>
                  </div>
                ))}
                {!here.length && <button type="button" onClick={onUnit} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900"><Sparkles className="h-3.5 w-3.5" /> Plan a unit here</button>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─── List ───────────────────────────────────────────────────────────────────

function ListView({ lessons, classes, search, setSearch, sort, setSort, status, setStatus, today, onOpen }: {
  lessons: LessonPlan[]; classes: LessonClass[]; search: string; setSearch: (s: string) => void; sort: ListSort; setSort: (s: ListSort) => void;
  status: "" | LessonStatus; setStatus: (s: "" | LessonStatus) => void; today: string; onOpen: (id: string) => void;
}) {
  const q = search.trim().toLowerCase();
  const rank: Record<string, number> = { idea: 0, draft: 1, ready: 2, taught: 3 };
  const shown = lessons
    .filter((l) => !status || (l.status || "draft") === status)
    .filter((l) => !q || [l.title, l.objective, l.unit, ...(l.standards || []), classOf(l, classes)?.name].join(" ").toLowerCase().includes(q))
    .sort((a, b) => sort === "title" ? a.title.localeCompare(b.title)
      : sort === "status" ? rank[a.status || "draft"] - rank[b.status || "draft"] || (a.date || "9").localeCompare(b.date || "9")
      : sort === "class" ? (classOf(a, classes)?.name || "~").localeCompare(classOf(b, classes)?.name || "~") || (a.date || "9").localeCompare(b.date || "9")
      : sort === "newest" ? (b.date || "").localeCompare(a.date || "")
      : (a.date || "9999").localeCompare(b.date || "9999"));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lessons, standards, units" className="min-h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm" /></div>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm"><option value="">Every status</option>{LESSON_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        <select aria-label="Sort lessons" value={sort} onChange={(e) => setSort(e.target.value as ListSort)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm">{LIST_SORTS.map((s) => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}</select>
      </div>
      {shown.length ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {shown.map((l) => {
            const c = classOf(l, classes);
            return (
              <li key={l.id}>
                <button type="button" onClick={() => onOpen(l.id)} className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c ? COLOR[c.color].dot : "bg-slate-300"}`} />
                  <span className={`w-24 shrink-0 text-xs ${l.date && l.date < today && l.status !== "taught" ? "font-semibold text-amber-700" : "text-slate-500"}`}>{nice(l.date)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{l.title}</span><span className="block truncate text-xs text-slate-500">{[c?.name || l.group, l.unit, (l.standards || []).map(standardCode).join(", ")].filter(Boolean).join(" · ")}</span></span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[l.status || "draft"]}`}>{STATUS_LABEL[l.status || "draft"]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">{lessons.length ? "No lessons match." : "No lessons yet. Tap “New lesson” or plan a whole unit with AI."}</p>}
    </div>
  );
}

// ─── Students: who's got it, who needs a reteach ────────────────────────────

function StudentsView({ lessons, classes, classId, onOpen, onReteach, onPickClass }: { lessons: LessonPlan[]; classes: LessonClass[]; classId: string; onOpen: (id: string) => void; onReteach: (l: LessonPlan, students: string[]) => void; onPickClass: (id: string) => void }) {
  const records = useMemo(() => studentRecords(lessons, classes, classId), [lessons, classes, classId]);
  const [open, setOpen] = useState<string | null>(null);
  // Reteach groups: every lesson with students still needing it, with who.
  const groups = useMemo(() => {
    const scoped = lessons.filter((l) => !classId || classOf(l, classes)?.id === classId);
    return scoped.map((l) => ({ l, who: needsReteach(l, lessons) })).filter((g) => g.who.length).sort((a, b) => (b.l.date || "").localeCompare(a.l.date || ""));
  }, [lessons, classes, classId]);
  if (!records.length) return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
      {classes.length ? "No students yet. Add students to a class, then check them off on each lesson's Students tab." : "Add your classes and their students first."}
      {classes.length > 0 && !classId && <div className="mt-3 flex flex-wrap justify-center gap-1.5">{classes.map((c) => <button key={c.id} type="button" onClick={() => onPickClass(c.id)} className={smallBtn}>{c.name}</button>)}</div>}
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Student</th><th className="px-2 py-2 text-center">{CHECK_LABEL.mastered}</th><th className="px-2 py-2 text-center">{CHECK_LABEL.good}</th><th className="px-2 py-2 text-center">{CHECK_LABEL.reteach}</th><th className="px-2 py-2 text-center">{CHECK_LABEL.absent}</th><th className="px-3 py-2">Open reteach</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((r) => (
              <Fragment key={r.name}>
                <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === r.name ? null : r.name)}>
                  <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                  <td className="px-2 py-2 text-center text-emerald-700">{r.counts.mastered || "–"}</td>
                  <td className="px-2 py-2 text-center text-sky-700">{r.counts.good || "–"}</td>
                  <td className="px-2 py-2 text-center text-rose-700">{r.counts.reteach || "–"}</td>
                  <td className="px-2 py-2 text-center text-slate-500">{r.counts.absent || "–"}</td>
                  <td className="px-3 py-2">{r.openReteach.length ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800"><AlertTriangle className="h-3 w-3" />{r.openReteach.length}</span> : r.history.length ? <span className="text-xs text-emerald-700">On track</span> : <span className="text-xs text-slate-400">Not checked yet</span>}</td>
                </tr>
                {open === r.name && (
                  <tr><td colSpan={6} className="bg-slate-50 px-3 py-2">
                    {r.history.length ? <ul className="space-y-1">{r.history.slice(0, 12).map((h) => (
                      <li key={h.lessonId} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="w-20 text-slate-400">{nice(h.date, { month: "short", day: "numeric" })}</span>
                        <button type="button" onClick={() => onOpen(h.lessonId)} className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2">{h.title}</button>
                        {h.mark.status && <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">{CHECK_LABEL[h.mark.status]}</span>}
                        {h.mark.score && <span className="text-slate-500">{h.mark.score}</span>}
                        {h.mark.note && <span className="text-slate-500">“{h.mark.note}”</span>}
                      </li>
                    ))}</ul> : <span className="text-xs text-slate-500">Not checked on any lesson yet.</span>}
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="space-y-2">
        <div className="text-sm font-semibold text-slate-900">Reteach groups</div>
        {groups.length ? groups.map(({ l, who }) => (
          <div key={l.id} className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3">
            <button type="button" onClick={() => onOpen(l.id)} className="text-left text-sm font-semibold text-slate-900 hover:underline">{l.title}</button>
            <div className="text-xs text-slate-500">{nice(l.date)}{l.standards?.length ? ` · ${l.standards.map(standardCode).join(", ")}` : ""}</div>
            <div className="mt-1 text-sm text-rose-900">{who.join(", ")}</div>
            <button type="button" onClick={() => onReteach(l, who)} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700"><RotateCcw className="h-3.5 w-3.5" /> Plan reteach</button>
          </div>
        )) : <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900">Nobody is waiting on a reteach. 🎉</p>}
      </aside>
    </div>
  );
}

// ─── Classes & periods ──────────────────────────────────────────────────────

function ClassesManager({ classes, setClasses, caseload, blocks, makeId, lessons, onClose }: {
  classes: LessonClass[]; setClasses: (fn: (all: LessonClass[]) => LessonClass[]) => void; caseload: string[]; blocks: ReturnType<typeof schoolBlocks>; makeId: () => string; lessons: LessonPlan[]; onClose: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(classes[0]?.id || null);
  const [paste, setPaste] = useState("");
  const [typed, setTyped] = useState("");
  const editing = classes.find((c) => c.id === editId);
  const update = (changes: Partial<LessonClass>) => editing && setClasses((all) => all.map((c) => (c.id === editing.id ? { ...c, ...changes } : c)));
  function add() {
    const used = new Set(classes.map((c) => c.color));
    const color = CLASS_COLORS.find((c) => !used.has(c)) || "teal";
    const freeBlock = blocks.find((b) => !classes.some((c) => c.block === b.id));
    const c: LessonClass = { id: makeId(), name: freeBlock ? `${freeBlock.name}` : `Class ${classes.length + 1}`, block: freeBlock?.id || "", subject: "", grade: "", color, days: [], room: "", students: [] };
    setClasses((all) => [...all, c]);
    setEditId(c.id);
  }
  const addStudents = (names: string[]) => editing && update({ students: Array.from(new Set([...editing.students, ...names.map((n) => n.trim()).filter(Boolean)])) });
  const lessonCount = (id: string) => lessons.filter((l) => l.classId === id).length;
  return (
    <HubModal title="Classes & periods" onClose={onClose} size="lg" footer={<div className="flex justify-end"><button type="button" onClick={onClose} className="inline-flex min-h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Done</button></div>}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[14rem_1fr]">
        <div className="space-y-1.5">
          {classes.map((c) => (
            <button key={c.id} type="button" onClick={() => setEditId(c.id)} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${c.id === editId ? `${COLOR[c.color].chip} ring-2 ${COLOR[c.color].ring}` : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLOR[c.color].dot}`} />
              <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
              <span className="text-xs text-slate-500">{c.students.length}</span>
            </button>
          ))}
          <button type="button" onClick={add} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Plus className="h-4 w-4" /> Add a class</button>
        </div>
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Name<input value={editing.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Period 2 – 7th Grade ELA" className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900" /></label>
              <label className="text-xs font-semibold text-slate-500">Block / period<select value={editing.block} onChange={(e) => update({ block: e.target.value })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900"><option value="">None</option>{blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              <label className="text-xs font-semibold text-slate-500">Room<input value={editing.room} onChange={(e) => update({ room: e.target.value })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900" /></label>
              <label className="text-xs font-semibold text-slate-500">Subject<select value={editing.subject} onChange={(e) => update({ subject: e.target.value })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900"><option value="">Pick one</option>{LESSON_SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="text-xs font-semibold text-slate-500">Grade<select value={editing.grade} onChange={(e) => update({ grade: e.target.value })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900"><option value="">Pick one</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}<option value="Mixed">Mixed grades</option></select></label>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">Meets on <span className="font-normal">(none picked = every day)</span></div>
              <div className="flex flex-wrap gap-1.5">{WEEKDAYS.map((d) => { const on = editing.days.includes(d); return <button key={d} type="button" aria-pressed={on} onClick={() => update({ days: on ? editing.days.filter((x) => x !== d) : [...editing.days, d] })} className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>{d}</button>; })}</div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">Color</div>
              <div className="flex flex-wrap gap-1.5">{CLASS_COLORS.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={editing.color === c} onClick={() => update({ color: c })} className={`h-8 w-8 rounded-full ${COLOR[c].dot} ${editing.color === c ? "ring-2 ring-offset-2 ring-slate-900" : ""}`} />)}</div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500"><span>Students ({editing.students.length})</span>{editing.students.length > 0 && <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => update({ students: [] })}>Clear all</button>}</div>
              <div className="flex flex-wrap gap-1.5">
                {editing.students.map((n) => <span key={n} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 text-xs font-medium text-slate-700">{n}<button type="button" aria-label={`Remove ${n}`} onClick={() => update({ students: editing.students.filter((x) => x !== n) })} className="rounded-full p-0.5 hover:bg-slate-200"><X className="h-3 w-3" /></button></span>)}
              </div>
              {caseload.filter((n) => !editing.students.includes(n)).length > 0 && (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500"><span>From your caseload — tap to add</span><button type="button" className="font-semibold text-teal-700" onClick={() => addStudents(caseload)}>Add all</button></div>
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">{caseload.filter((n) => !editing.students.includes(n)).map((n) => <button key={n} type="button" onClick={() => addStudents([n])} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"><Plus className="h-3 w-3" />{n}</button>)}</div>
                </div>
              )}
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addStudents([typed]); setTyped(""); }}>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type a student's name" className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
                <button type="submit" className={smallBtn + " min-h-10 px-3"}><Plus className="h-4 w-4" /> Add</button>
              </form>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-slate-500">Paste a whole class list</summary>
                <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} placeholder={"One name per line (or separated by commas)\nAva Moore\nBen Diaz"} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <button type="button" className={smallBtn} onClick={() => { addStudents(paste.split(/[\n,;\t]+/)); setPaste(""); }}>Add these</button>
              </details>
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button type="button" onClick={() => { if (!confirm(`Remove ${editing.name}?${lessonCount(editing.id) ? ` Its ${lessonCount(editing.id)} lessons stay, under "No class".` : ""}`)) return; setClasses((all) => all.filter((c) => c.id !== editing.id)); setEditId(null); }} className={smallBtn + " text-slate-500 hover:text-rose-600"}><Trash2 className="h-3.5 w-3.5" /> Remove class</button>
            </div>
          </div>
        ) : <p className="text-sm text-slate-500">Add a class for each period or block you teach.</p>}
      </div>
    </HubModal>
  );
}

// ─── Plan a unit ahead with AI ──────────────────────────────────────────────

function UnitPlanner({ token, classes, lessons, state, onState, defaultClass, today, onAdd, onClose, makeId }: {
  token: string | null; classes: LessonClass[]; lessons: LessonPlan[]; state: string; onState: (s: string) => void; defaultClass: string; today: string;
  onAdd: (made: LessonPlan[]) => void; onClose: () => void; makeId: () => string;
}) {
  const [f, setF] = useState({ classId: defaultClass, topic: "", count: 10, start: today, minutes: 45, notes: "", skipTaken: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ unit: string; lessons: UnitLesson[] } | null>(null);
  const [off, setOff] = useState<Set<number>>(new Set());
  const c = classes.find((x) => x.id === f.classId);

  const taken = useMemo(() => new Set(f.skipTaken ? lessons.filter((l) => (c ? classOf(l, classes)?.id === c.id : !classOf(l, classes))).map((l) => l.date) : []), [lessons, classes, c, f.skipTaken]);
  const dates = useMemo(() => (result ? nextMeetings(c || { days: [] }, f.start, result.lessons.length, taken) : []), [result, c, f.start, taken]);

  async function go() {
    if (!f.topic.trim()) { setError("Type what the unit is about."); return; }
    setBusy(true); setError("");
    try {
      const data = await askLessonAi(token, { mode: "unit", topic: f.topic, count: f.count, grade: c?.grade || "", subject: c?.subject || "", state, minutes: f.minutes, notes: f.notes });
      setResult(data); setOff(new Set());
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  function add() {
    if (!result) return;
    const made: LessonPlan[] = [];
    result.lessons.forEach((u, i) => {
      if (off.has(i)) return;
      made.push({ id: makeId(), title: u.title, subject: c?.subject || "", group: c?.name || "", date: dates[i] || "", objective: u.objective, materials: "", summary: u.summary, unit: result.unit || f.topic, status: "idea", standards: u.standards, files: [], marks: {}, minutes: f.minutes, ...(c ? { classId: c.id } : {}) });
    });
    onAdd(made);
    onClose();
  }
  return (
    <HubModal title="Plan a unit with AI" onClose={onClose} size="lg" footer={result ? (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={smallBtn + " min-h-10 px-3"} onClick={() => setResult(null)}>Start over</button>
        <button type="button" onClick={add} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add {result.lessons.length - off.size} lessons to my plan</button>
      </div>
    ) : undefined}>
      {!result ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Tell the AI what the unit covers. It writes the lessons in teaching order and puts them on the days your class meets, so you can plan weeks or months ahead and fill in each one later.</p>
          <label className="block text-xs font-semibold text-slate-500">Unit topic<input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="e.g. Adding and subtracting fractions with unlike denominators" className="mt-1 block min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900" autoFocus /></label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <label className="text-xs font-semibold text-slate-500 sm:col-span-2">Class<select value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900"><option value="">No class</option>{classes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-500">Starting<input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500">Lessons<input type="number" min={2} max={30} value={f.count} onChange={(e) => setF({ ...f, count: Number(e.target.value) || 10 })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-900" /></label>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">State standards<select value={state} onChange={(e) => onState(e.target.value)} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900"><option value="">Common Core / national</option>{US_STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-500">Minutes per lesson<input type="number" min={10} max={240} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) || 45 })} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-900" /></label>
          </div>
          <label className="block text-xs font-semibold text-slate-500">Anything else? <span className="font-normal">(optional)</span><textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} placeholder="Co-taught inclusion class, several students below grade level, end with a project…" className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900" /></label>
          {c && <p className="text-xs text-slate-500">{c.name} meets {c.days.length ? c.days.join(", ") : "every school day"}.</p>}
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <button type="button" disabled={busy} onClick={() => void go()} className={aiBtn + " min-h-11"}>{busy ? <Spinner label="Planning the unit…" /> : <><Sparkles className="h-4 w-4" /> Plan it</>}</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</div><div className="font-semibold text-slate-900">{result.unit || f.topic}</div></div>
            <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={f.skipTaken} onChange={(e) => setF({ ...f, skipTaken: e.target.checked })} /> Skip days that already have a lesson</label>
          </div>
          <ol className="space-y-1.5">
            {result.lessons.map((u, i) => (
              <li key={i} className={`flex gap-3 rounded-xl border p-3 ${off.has(i) ? "border-slate-100 opacity-50" : "border-slate-200 bg-white"}`}>
                <input type="checkbox" checked={!off.has(i)} onChange={() => { const n = new Set(off); n.has(i) ? n.delete(i) : n.add(i); setOff(n); }} className="mt-1" aria-label={`Include ${u.title}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2"><span className="text-xs font-semibold text-slate-400">{i + 1}.</span><span className="font-semibold text-slate-900">{u.title}</span><span className="text-xs text-teal-700">{nice(dates[i])}</span></div>
                  <p className="text-sm text-slate-600">{u.objective}</p>
                  {u.summary && <p className="mt-0.5 text-xs text-slate-500">{u.summary}</p>}
                  {u.standards.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{u.standards.map((s) => <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600" title={s}><BookCheck className="mr-0.5 inline h-3 w-3" />{standardCode(s)}</span>)}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </HubModal>
  );
}

// ─── Shift lessons (snow day, assembly, ran long) ───────────────────────────

function ShiftLessons({ classes, today, onShift, onClose }: { classes: LessonClass[]; today: string; onShift: (classIds: string[], from: string, by: number) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(classes.map((c) => c.id)));
  const [from, setFrom] = useState(today);
  const [by, setBy] = useState(1);
  return (
    <HubModal title="Shift lessons" onClose={onClose} footer={<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={smallBtn + " min-h-10 px-3"}>Cancel</button><button type="button" disabled={!picked.size || !by} onClick={() => onShift([...picked], from, by)} className="inline-flex min-h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50">Move lessons</button></div>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Snow day, assembly, or a lesson ran long? Move every lesson from a day on back (or forward) by class days. They keep their order and land only on days each class meets.</p>
        {!classes.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Add your classes first — lessons are shifted class by class.</p>}
        <div className="flex flex-wrap gap-1.5">{classes.map((c) => { const on = picked.has(c.id); return <button key={c.id} type="button" aria-pressed={on} onClick={() => { const n = new Set(picked); on ? n.delete(c.id) : n.add(c.id); setPicked(n); }} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${on ? COLOR[c.color].chip : "border-slate-200 text-slate-400"}`}><span className={`h-2 w-2 rounded-full ${COLOR[c.color].dot}`} />{c.name}</button>; })}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">Starting with lessons on<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-900" /></label>
          <label className="text-xs font-semibold text-slate-500">Move by<select value={by} onChange={(e) => setBy(Number(e.target.value))} className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} class day{n > 1 ? "s" : ""} later</option>)}{[-1, -2].map((n) => <option key={n} value={n}>{-n} class day{n < -1 ? "s" : ""} earlier</option>)}</select></label>
        </div>
      </div>
    </HubModal>
  );
}

