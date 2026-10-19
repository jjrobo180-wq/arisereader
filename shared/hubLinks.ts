// Arise WorkHub: everything connected. A reminder, note, goal or meeting can be linked to anything
// else in the Hub (a Drive file, a student, a goal, a meeting, a note, a reminder, a lesson, a goal
// quiz), and every item can show what it is connected to:
//   • what it links to, and what links to it (both directions, from one stored list), and
//   • what belongs to the same student, found by name, so an IEP meeting pulls in that student's
//     goals, notes, reminders, files and quiz scores without anyone linking them by hand.
// Only the outgoing links are stored (`links` on the item); everything else is worked out here.
import type { DriveFile } from "./driveApp";
import type { Goal, Meeting, NoteItem, Task, Workspace } from "./teacherHub";

export const LINK_KINDS = ["file", "student", "goal", "meeting", "note", "task", "lesson", "quiz"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export type HubLink = { kind: LinkKind; id: string };
/** The kinds of item that keep their own `links`. */
export type LinkHolder = "task" | "note" | "goal" | "meeting";
export const LINK_HOLDERS: readonly LinkHolder[] = ["task", "note", "goal", "meeting"];
export const MAX_LINKS = 30;

export const KIND_LABEL: Record<LinkKind, string> = { file: "Drive files", student: "Students", goal: "Goals", meeting: "Meetings", note: "Notes", task: "Reminders", lesson: "Lessons", quiz: "Goal quizzes" };
export const KIND_ONE: Record<LinkKind, string> = { file: "File", student: "Student", goal: "Goal", meeting: "Meeting", note: "Note", task: "Reminder", lesson: "Lesson", quiz: "Quiz" };

/** A quiz made from a student's goals (see server/goalQuiz.ts): taken on A.R.I.S.E. Reader, its score comes back here. */
export type GoalQuiz = {
  /** The quiz's id on A.R.I.S.E. Reader (custom quiz id), as text. */
  id: string;
  title: string;
  /** The caseload student it is for. */
  student: string;
  /** The Reader account it was given to. */
  readerUserId?: number;
  goalIds: string[];
  createdAt: string;
  /** Attempts already turned into goal data points, so each is added once. */
  recorded?: string[];
  /** The student's finished attempts, as last fetched from the Reader. */
  results?: GoalQuizResult[];
};
export type GoalQuizResult = { attemptId: string; score: number; total: number; completedAt: string };
export const quizPercent = (r: Pick<GoalQuizResult, "score" | "total">) => (r.total > 0 ? Math.round((r.score / r.total) * 100) : 0);

/**
 * Fresh results from the Reader folded into the Hub: each quiz keeps its student's finished attempts,
 * and each new attempt becomes a data point on the quiz's goals that are measured in percent (once).
 */
export function applyQuizResults(w: Workspace, rows: { attemptId: string; quizId: string; userId: number; score: number; total: number; completedAt: string | null }[], makeId: () => string): Workspace {
  const quizzes = goalQuizzes(w);
  if (!quizzes.length) return w;
  let goals = w.goals, changed = false;
  const nextQuizzes = quizzes.map((q) => {
    const mine = rows.filter((r) => r.quizId === q.id && (!q.readerUserId || r.userId === q.readerUserId))
      .map((r) => ({ attemptId: r.attemptId, score: r.score, total: r.total, completedAt: String(r.completedAt || "") }));
    const results = [...(q.results || []).filter((x) => !mine.some((m) => m.attemptId === x.attemptId)), ...mine];
    const recorded = new Set(q.recorded || []);
    for (const r of mine) {
      if (recorded.has(r.attemptId)) continue;
      recorded.add(r.attemptId);
      const day = (r.completedAt || "").slice(0, 10);
      goals = goals.map((g) => q.goalIds.includes(g.id) && percentGoal(g)
        ? { ...g, points: [...g.points, { id: makeId(), date: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date().toISOString().slice(0, 10), value: quizPercent(r), note: `Goal quiz: ${q.title}` }] }
        : g);
    }
    const same = results.length === (q.results || []).length && recorded.size === (q.recorded || []).length;
    if (same) return q;
    changed = true;
    return { ...q, results, recorded: [...recorded] };
  });
  return changed ? ({ ...w, goals, goalQuizzes: nextQuizzes } as Workspace) : w;
}

export type Linkable = { kind: LinkKind; id: string; label: string; sub: string; student: string };

const fold = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const key = (l: { kind: string; id: string }) => `${l.kind}:${l.id}`;

/** Links as saved: known kinds only, each once, at most MAX_LINKS. */
export function cleanLinks(raw: unknown): HubLink[] {
  if (!Array.isArray(raw)) return [];
  const out: HubLink[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const kind = (r as any).kind, id = String((r as any).id ?? "").slice(0, 80);
    if (!LINK_KINDS.includes(kind) || !id) continue;
    const k = key({ kind, id });
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ kind, id });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

const files = (w: Workspace): DriveFile[] => (Array.isArray((w as any).drive) ? (w as any).drive : []);
export const goalQuizzes = (w: Workspace): GoalQuiz[] => (Array.isArray((w as any).goalQuizzes) ? (w as any).goalQuizzes : []);
/** A note's name, the way the notes board shows it (same as hubNotes.noteHeading, kept here to avoid an import loop). */
const noteHeading = (n: Pick<NoteItem, "student" | "type" | "title">) => String(n.title || "").trim() || (n.student ? `${n.student} · ${n.type}` : n.type || "Note");
const goalLabel = (g: Goal) => `${g.area || "Goal"}: ${g.text}`.slice(0, 120);

/** Everything in the Hub that can be linked, with a name and a line under it. */
export function linkables(w: Workspace): Linkable[] {
  const out: Linkable[] = [];
  for (const f of files(w)) out.push({ kind: "file", id: f.id, label: f.name, sub: "Drive", student: "" });
  for (const s of w.students || []) out.push({ kind: "student", id: s.id, label: s.name, sub: [s.grade && `Grade ${s.grade}`, "Caseload"].filter(Boolean).join(" · "), student: s.name });
  for (const g of w.goals || []) out.push({ kind: "goal", id: g.id, label: goalLabel(g), sub: g.student, student: g.student });
  for (const m of w.meetings || []) out.push({ kind: "meeting", id: m.id, label: `${m.type}${m.student ? ` · ${m.student}` : ""}`, sub: m.date || "No date", student: m.student });
  for (const n of w.notes || []) out.push({ kind: "note", id: n.id, label: noteHeading(n), sub: n.date || "Note", student: n.student });
  for (const t of w.tasks || []) if (!t.archived) out.push({ kind: "task", id: t.id, label: t.title, sub: t.done ? "Done" : t.dueDate ? `Due ${t.dueDate}` : "Reminder", student: "" });
  for (const l of w.lessons || []) out.push({ kind: "lesson", id: l.id, label: l.title, sub: [l.group, l.date].filter(Boolean).join(" · ") || "Lesson", student: "" });
  for (const q of goalQuizzes(w)) out.push({ kind: "quiz", id: q.id, label: q.title, sub: q.student, student: q.student });
  return out;
}

/** The thing a link points at, or null when it has since been deleted. */
export function resolveLink(w: Workspace, link: HubLink, all = linkables(w)): Linkable | null {
  return all.find((x) => x.kind === link.kind && x.id === link.id) ?? null;
}

function holderList(w: Workspace, kind: LinkHolder): (Task | NoteItem | Goal | Meeting)[] {
  return kind === "task" ? w.tasks : kind === "note" ? w.notes : kind === "goal" ? w.goals : w.meetings;
}
const holderKey: Record<LinkHolder, keyof Workspace> = { task: "tasks", note: "notes", goal: "goals", meeting: "meetings" };

/** An item's own links (only reminders, notes, goals and meetings keep them). */
export function linksOf(w: Workspace, kind: LinkKind, id: string): HubLink[] {
  if (!(LINK_HOLDERS as readonly string[]).includes(kind)) return [];
  const item = holderList(w, kind as LinkHolder).find((x) => x.id === id) as { links?: unknown } | undefined;
  return cleanLinks(item?.links);
}

/** The Hub with an item's links replaced. Nothing changes when the item is gone. */
export function setLinks(w: Workspace, kind: LinkHolder, id: string, links: HubLink[]): Workspace {
  const list = holderList(w, kind);
  if (!list.some((x) => x.id === id)) return w;
  const clean = cleanLinks(links).filter((l) => !(l.kind === kind && l.id === id));
  return { ...w, [holderKey[kind]]: list.map((x) => (x.id === id ? { ...x, links: clean } : x)) } as Workspace;
}

/** Adds one link to an item, keeping the others. */
export const addLink = (w: Workspace, kind: LinkHolder, id: string, link: HubLink): Workspace => setLinks(w, kind, id, [...linksOf(w, kind, id), link]);

/** The student an item is about: a goal's, meeting's or note's student, a quiz's, or a student it links to. */
export function studentOf(w: Workspace, kind: LinkKind, id: string, all = linkables(w)): string {
  const self = all.find((x) => x.kind === kind && x.id === id);
  if (self?.student) return self.student;
  const linked = linksOf(w, kind, id).find((l) => l.kind === "student");
  if (linked) return resolveLink(w, linked, all)?.student ?? "";
  if (kind === "task") {
    const t = w.tasks.find((x) => x.id === id);
    if (t) return mentionedStudents(w, `${t.title} ${t.notes || ""}`)[0] ?? "";
  }
  return "";
}

/** Caseload students named in some text: a full name, or a first name only one student has. */
export function mentionedStudents(w: Workspace, text: string): string[] {
  const hay = ` ${fold(text).replace(/[^a-z0-9' -]+/g, " ")} `;
  const names = (w.students || []).map((s) => s.name).filter(Boolean);
  const firsts = new Map<string, number>();
  for (const n of names) { const f = fold(n).split(" ")[0]; firsts.set(f, (firsts.get(f) || 0) + 1); }
  const out: string[] = [];
  for (const n of names) {
    const full = fold(n), first = full.split(" ")[0];
    if (hay.includes(` ${full} `) || (first.length >= 3 && firsts.get(first) === 1 && hay.includes(` ${first} `))) out.push(n);
  }
  return out;
}

export type Connection = Linkable & { why: "links to" | "linked from" | "same student" };

/**
 * Everything connected to one item: what it links to, what links to it, and (when it is about a
 * student, or is a student) everything else filed under that student. Each thing shows once, with
 * the strongest reason it is here.
 */
export function connections(w: Workspace, kind: LinkKind, id: string): Connection[] {
  const all = linkables(w);
  const out = new Map<string, Connection>();
  const put = (x: Linkable | null, why: Connection["why"]) => {
    if (!x || (x.kind === kind && x.id === id)) return;
    if (!out.has(key(x))) out.set(key(x), { ...x, why });
  };
  for (const l of linksOf(w, kind, id)) put(resolveLink(w, l, all), "links to");
  for (const h of LINK_HOLDERS) for (const item of holderList(w, h)) {
    if (cleanLinks((item as any).links).some((l) => l.kind === kind && l.id === id)) put(all.find((x) => x.kind === h && x.id === item.id) ?? null, "linked from");
  }
  const student = kind === "student" ? (w.students.find((s) => s.id === id)?.name ?? "") : studentOf(w, kind, id, all);
  if (student) {
    const s = fold(student);
    for (const x of all) {
      if (x.kind === "student" ? fold(x.label) === s : fold(x.student) === s) put(x, "same student");
    }
    // Reminders about the student: they mention the student, or link to the student.
    const sid = w.students.find((x) => fold(x.name) === s)?.id;
    for (const t of w.tasks) {
      if (t.archived) continue;
      const about = mentionedStudents(w, `${t.title} ${t.notes || ""}`).some((n) => fold(n) === s) || cleanLinks((t as any).links).some((l) => l.kind === "student" && l.id === sid);
      if (about) put(all.find((x) => x.kind === "task" && x.id === t.id) ?? null, "same student");
    }
    // Files linked from anything about the student.
    for (const c of [...out.values()]) for (const l of linksOf(w, c.kind, c.id)) if (l.kind === "file") put(resolveLink(w, l, all), "same student");
  }
  const order: LinkKind[] = ["student", "goal", "meeting", "task", "file", "quiz", "note", "lesson"];
  return [...out.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.label.localeCompare(b.label));
}

/** Smart suggestions while linking: the students a title names, their goals when it's about progress or goals, and Drive files sharing its words. */
export function suggestLinks(w: Workspace, text: string, already: HubLink[] = [], self?: { kind: LinkKind; id: string }): Linkable[] {
  const all = linkables(w);
  const have = new Set([...already.map(key), ...(self ? [key(self)] : [])]);
  const out: Linkable[] = [];
  const push = (x?: Linkable | null) => { if (x && !have.has(key(x)) && !out.some((o) => key(o) === key(x))) out.push(x); };
  const names = mentionedStudents(w, text);
  const lower = fold(text);
  const aboutGoals = /\b(progress|monitor|goal|iep|data|probe|benchmark|assess)/.test(lower);
  const aboutMeeting = /\b(iep|meeting|annual|reeval|conference)/.test(lower);
  for (const n of names) {
    push(all.find((x) => x.kind === "student" && fold(x.label) === fold(n)));
    if (aboutGoals) for (const g of all.filter((x) => x.kind === "goal" && fold(x.student) === fold(n))) push(g);
    if (aboutMeeting) for (const m of all.filter((x) => x.kind === "meeting" && fold(x.student) === fold(n))) push(m);
  }
  const words = lower.split(/[^a-z0-9]+/).filter((x) => x.length >= 4 && !["with", "from", "that", "this", "have", "need", "today"].includes(x));
  for (const f of all.filter((x) => x.kind === "file")) {
    const name = fold(f.label);
    if (words.some((wd) => name.includes(wd)) || names.some((n) => name.includes(fold(n).split(" ")[0]))) push(f);
  }
  return out.slice(0, 8);
}

/** A goal quiz's score turned into a goal data point when the goal is measured in percent. */
export const percentGoal = (g: Pick<Goal, "unit">) => /%|percent|accura/i.test(g.unit || "");
