// Arise WorkHub: the Goals board — LifeHub's goals, made for a classroom. A goal can be for one
// student, a group, the whole class or the teacher. It is tracked by steps to check off or by a
// number (read 20 books, 90% on time), has a due date, and keeps a running list of notes (what was
// tried, what worked, a parent's comment). The board filters by student, so every goal a student
// is part of is a tap away. IEP goals with data points stay in their own tracker below it.
import type { Workspace } from "./teacherHub";

export const GOAL_KINDS = ["academic", "reading", "math", "writing", "behavior", "social", "attendance", "class", "teacher"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const GOAL_KIND_INFO: Record<GoalKind, { label: string; emoji: string; color: string }> = {
  academic: { label: "Academic", emoji: "🎓", color: "#7566e8" }, reading: { label: "Reading", emoji: "📚", color: "#f59e72" }, math: { label: "Math", emoji: "➗", color: "#619ee6" },
  writing: { label: "Writing", emoji: "✏️", color: "#db77ac" }, behavior: { label: "Behavior", emoji: "🌟", color: "#e5b04f" }, social: { label: "Social-emotional", emoji: "💛", color: "#36b6a5" },
  attendance: { label: "Attendance", emoji: "🗓️", color: "#5fb35b" }, class: { label: "Whole class", emoji: "🏫", color: "#0ea5e9" }, teacher: { label: "My own", emoji: "🌱", color: "#64748b" },
};

export type BoardGoalNote = { id: string; date: string; text: string; /** The student it is about, when the goal has several. */ student?: string };
export type BoardGoal = {
  id: string;
  title: string;
  why: string;
  kind: GoalKind;
  /** The students it is for. Empty is a whole-class or teacher goal. */
  students: string[];
  due: string;
  track: "steps" | "number";
  steps: { id: string; title: string; done: boolean }[];
  target: number;
  current: number;
  unit: string;
  done: boolean;
  doneAt: string;
  createdAt: string;
  notes: BoardGoalNote[];
};

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const numIn = (v: unknown, lo: number, hi: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : 0; };

export function cleanBoardGoals(raw: unknown): BoardGoal[] {
  if (!Array.isArray(raw)) return [];
  const out: BoardGoal[] = [];
  for (const g of raw.slice(0, 500)) {
    if (!g || typeof g !== "object") continue;
    const id = s(g.id, 60), title = s(g.title, 160).trim();
    if (!id || !title) continue;
    out.push({
      id, title, why: s(g.why, 600), kind: (GOAL_KINDS as readonly string[]).includes(g.kind) ? g.kind : "academic",
      students: Array.isArray(g.students) ? [...new Set(g.students.map((x: unknown) => s(x, 80).trim()).filter(Boolean))].slice(0, 60) as string[] : [],
      due: day(g.due), track: g.track === "number" ? "number" : "steps",
      steps: Array.isArray(g.steps) ? g.steps.slice(0, 30).map((m: any) => ({ id: s(m?.id, 60) || Math.random().toString(36).slice(2), title: s(m?.title, 160), done: !!m?.done })).filter((m: any) => m.title.trim()) : [],
      target: numIn(g.target, 0, 1e7), current: numIn(g.current, -1e7, 1e7), unit: s(g.unit, 24),
      done: !!g.done, doneAt: s(g.doneAt, 40), createdAt: s(g.createdAt, 40),
      notes: Array.isArray(g.notes) ? g.notes.slice(-200).map((n: any) => ({ id: s(n?.id, 60), date: day(n?.date), text: s(n?.text, 2000).trim(), ...(s(n?.student, 80) ? { student: s(n.student, 80) } : {}) })).filter((n: BoardGoalNote) => n.id && n.text) : [],
    });
  }
  return out;
}

export const boardGoals = (w: Workspace): BoardGoal[] => cleanBoardGoals((w as any).boardGoals);
export const setBoardGoals = (w: Workspace, fn: (all: BoardGoal[]) => BoardGoal[]): Workspace => ({ ...w, boardGoals: fn(boardGoals(w)) } as Workspace);

export const goalProgress = (g: BoardGoal) => (g.done ? 1 : g.track === "steps" ? (g.steps.length ? g.steps.filter((m) => m.done).length / g.steps.length : 0) : g.target > 0 ? Math.max(0, Math.min(1, g.current / g.target)) : 0);

/** The goals to show: one student's (goals they are on), one kind, open or reached. */
export function filterGoals(goals: BoardGoal[], opts: { student?: string; kind?: GoalKind | ""; done?: boolean }): BoardGoal[] {
  const who = (opts.student || "").toLowerCase();
  return goals.filter((g) => (!who || g.students.some((x) => x.toLowerCase() === who)) && (!opts.kind || g.kind === opts.kind) && (opts.done === undefined || g.done === opts.done))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.title.localeCompare(b.title));
}

/** Ready-made goals to start from. */
export const GOAL_IDEAS: Partial<BoardGoal>[] = [
  { title: "Read 20 minutes every night", kind: "reading", track: "number", target: 20, unit: "nights" },
  { title: "Master multiplication facts 0–12", kind: "math", track: "steps", steps: ["0s, 1s, 2s", "5s and 10s", "3s and 4s", "6s and 7s", "8s and 9s", "11s and 12s", "Mixed facts in under 3 minutes"].map((t, i) => ({ id: `s${i}`, title: t, done: false })) },
  { title: "Turn in every assignment on time this quarter", kind: "academic", track: "number", target: 100, current: 0, unit: "%" },
  { title: "Use a calm-down strategy instead of leaving class", kind: "behavior", track: "number", target: 10, unit: "times" },
  { title: "Write a five-paragraph essay", kind: "writing", track: "steps", steps: ["Pick a topic", "Write a thesis", "Outline three reasons", "Draft", "Revise with a checklist", "Final copy"].map((t, i) => ({ id: `s${i}`, title: t, done: false })) },
  { title: "Join a group activity at recess", kind: "social", track: "number", target: 5, unit: "days" },
  { title: "Perfect attendance this month", kind: "attendance", track: "number", target: 20, unit: "days" },
  { title: "Class reads 500 books this year", kind: "class", track: "number", target: 500, unit: "books" },
];
