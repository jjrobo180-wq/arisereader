// Arise WorkHub: minutes for a whole class with one touch.
// The minutes page lists each class the teacher sees: a block, or a half of a block, with whose class it is.
// Tapping one opens a pop-up with every student in it ticked. The teacher unticks anyone who did not show
// up, and one save logs the minutes for the rest and marks the unticked ones "Student absent".
// The pop-up is client/src/components/teacher-hub/HubClassMinutes.tsx.
import { blockName, cleanPart, cleanTeacher, groupText, partRank, type BlockPart, type SchoolBlock } from "./hubBlocks";
import { WEEK_DAYS, cleanDayGuide, sessionLog, weekDayOf } from "./hubProgress";
import { cleanSubject } from "./hubSubjects";
import type { ServiceLog, ServicePlan } from "./teacherHub";

/** What an unticked student is marked with. */
export const ABSENT_REASON = "Student absent";

/** One student in a class: one of their services that meets there. */
export type ClassStudent = {
  planId: string; student: string; kind: string;
  /** Their usual minutes on the day being logged (the day guide's, or its first day's). 0 when the service is counted by the week only. */
  minutes: number;
  /** Their service asks for minutes on that day (or is counted by the week, so any day will do). */
  due: boolean;
  subject: string;
  part?: BlockPart; teacher?: string;
  /** Minutes already logged for this service on that day. */
  logged: number;
  /** Already marked "did not meet" on that day. */
  notMet: boolean;
};

/** One class: a block, or a half of it, with whose class it is. */
export type ClassGroup = {
  key: string;
  /** The block's id, or "" for services that name a class and no block. */
  block: string;
  /** "Block 2", or "No block". */
  title: string;
  /** "1st half · Ms. Lee", or "" for the whole block with no class named. */
  label: string;
  part?: BlockPart; teacher?: string;
  students: ClassStudent[];
};

const fold = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** A plan's usual minutes on a date, and whether that day is one of its days. */
export function usualOn(plan: Pick<ServicePlan, "days">, date: string): { minutes: number; due: boolean } {
  const guide = cleanDayGuide(plan.days);
  const days = WEEK_DAYS.filter((d) => guide[d]);
  if (!days.length) return { minutes: 0, due: true };
  const day = weekDayOf(date);
  if (day && guide[day]) return { minutes: guide[day]!, due: true };
  return { minutes: guide[days[0]]!, due: false };
}

/**
 * The classes the teacher sees, in the order of the day: each block (its whole block, then the 1st half, then the 2nd,
 * then by teacher), and last the services that name a class but no block. A service in no block and no class is in none.
 * `plans` are the plans as they count; `logs` are used to show who is already logged on `date`.
 */
export function classGroups(plans: ServicePlan[], blocks: SchoolBlock[], logs: ServiceLog[], date: string): ClassGroup[] {
  const groups = new Map<string, ClassGroup & { rank: number }>();
  const order = (id: string) => { const i = blocks.findIndex((b) => b.id === id); return i < 0 ? blocks.length : i; };
  for (const p of plans) {
    const block = p.block && blocks.some((b) => b.id === p.block) ? p.block : "";
    const part = block ? cleanPart(p.part) : undefined;
    const teacher = cleanTeacher(p.teacher) || undefined;
    if (!block && !teacher) continue;
    const key = `${block}|${part || ""}|${fold(teacher)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key, block, title: blockName(blocks, block) || "No block", label: groupText({ part, teacher }),
        ...(part ? { part } : {}), ...(teacher ? { teacher } : {}), students: [],
        rank: order(block) * 10 + partRank(part),
      });
    }
    const mine = logs.filter((l) => fold(l.student) === fold(p.student) && l.kind === p.kind && l.date === date);
    groups.get(key)!.students.push({
      planId: p.id, student: p.student, kind: p.kind, ...usualOn(p, date), subject: cleanSubject(p.subject),
      ...(part ? { part } : {}), ...(teacher ? { teacher } : {}),
      logged: mine.filter((l) => !l.notMet).reduce((n, l) => n + (Number(l.minutes) || 0), 0),
      notMet: mine.some((l) => l.notMet),
    });
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank || (a.teacher || "").localeCompare(b.teacher || ""))
    .map(({ rank: _rank, ...g }) => ({ ...g, students: g.students.sort((x, y) => x.student.localeCompare(y.student) || x.kind.localeCompare(y.kind)) }));
}

/** A student is waiting to be logged on the day: nothing logged yet and not marked "did not meet". */
export const waiting = (s: Pick<ClassStudent, "logged" | "notMet">): boolean => !s.logged && !s.notMet;

/** The students to tick when the pop-up opens: everyone still waiting whose service is due that day. */
export const startPicks = (group: ClassGroup): string[] => group.students.filter((s) => waiting(s) && s.due).map((s) => s.planId);

export type ClassSave = {
  /** The day the minutes were given. */
  date: string;
  /** Minutes for everyone ticked. "" uses each student's usual minutes. */
  minutes: string;
  /** Mark the unticked students who are still waiting as "Student absent". */
  absent: boolean;
  note?: string;
};

export type ClassResult = {
  logs: Omit<ServiceLog, "id">[];
  /** How many were logged, and how many marked absent. */
  given: number; absent: number;
  /** Ticked students with no minutes to log (no usual minutes, and none typed). */
  missing: string[];
};

/**
 * What one save does for a class: a session for each ticked student still waiting, with the minutes typed or
 * their usual minutes, and (with `absent`) "Student absent" for the unticked ones still waiting.
 * Each record keeps the class's block, half and teacher, and the service's subject.
 */
export function classLogs(group: ClassGroup, picked: string[], save: ClassSave): ClassResult {
  const out: ClassResult = { logs: [], given: 0, absent: 0, missing: [] };
  const typed = String(save.minutes ?? "").trim();
  const note = String(save.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  for (const s of group.students) {
    if (!waiting(s)) continue;
    const place = { ...(group.block ? { block: group.block } : {}), ...(s.part ? { part: s.part } : {}), ...(s.teacher ? { teacher: s.teacher } : {}), ...(s.subject ? { subject: s.subject } : {}) };
    if (picked.includes(s.planId)) {
      const session = sessionLog({ student: s.student, kind: s.kind, date: save.date, minutes: typed || (s.minutes ? String(s.minutes) : ""), note });
      if (!session || session.minutes <= 0) { out.missing.push(s.student); continue; }
      out.logs.push({ ...session, ...place });
      out.given++;
    } else if (save.absent && s.due) {
      out.logs.push({ student: s.student, date: save.date, kind: s.kind, minutes: 0, note: ABSENT_REASON, notMet: true, ...place });
      out.absent++;
    }
  }
  return out;
}

/** "Logged 4 students · 1 absent": what a save did. */
export function classSavedText(result: Pick<ClassResult, "given" | "absent">, title: string): string {
  const people = (n: number) => `${n} ${n === 1 ? "student" : "students"}`;
  const parts = [result.given ? `Logged ${people(result.given)}` : "", result.absent ? `${result.absent} marked absent` : ""].filter(Boolean);
  return parts.length ? `${title}: ${parts.join(" · ")}.` : "";
}
