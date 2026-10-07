// Deleting from the Hub without regret: every delete can be taken back for a few seconds, and
// deleting a student can also clear what the other tabs kept under that student's name.
import { STUDENT_LISTS, type Workspace } from "./teacherHub";

/** Rows taken out of one list, and where each one was. */
export type DeletedPart = { key: keyof Workspace; rows: Array<{ row: any; index: number }> };
export type Deleted = {
  /** For the "Deleted ..." message. */
  label: string;
  parts: DeletedPart[];
};

const WHAT: Partial<Record<keyof Workspace, string>> = {
  students: "student", meetings: "meeting", lessons: "lesson", tasks: "to-do", notes: "note",
  ariseRecords: "reading record", behavior: "behavior entry", attendance: "attendance entry",
  assignments: "assignment", gradeScores: "score", parentLogs: "contact log", schedules: "schedule block",
  emails: "email", events: "event", guides: "IEP guide", spedContacts: "contact", guideLinks: "link",
};

const clip = (value: string, max = 40) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** A row's name for "Deleted meeting “Jordan · Annual IEP”". */
function titleOf(key: keyof Workspace, row: any): string {
  const parts = (...values: unknown[]) => values.map((v) => String(v ?? "").trim()).filter(Boolean).join(" · ");
  switch (key) {
    case "students": return String(row.name ?? "");
    case "meetings": return parts(row.student, row.type);
    case "tasks": case "lessons": case "assignments": case "events": return String(row.title ?? "");
    case "notes": return parts(row.student, row.type);
    case "ariseRecords": return parts(row.student, row.book);
    case "behavior": return parts(row.student, row.reason);
    case "attendance": return parts(row.student, row.date);
    case "parentLogs": return parts(row.student, row.guardian);
    case "schedules": return parts(row.student, row.label);
    case "emails": return String(row.subject ?? "");
    case "guides": return parts(row.student, row.kind);
    case "spedContacts": return String(row.name ?? "");
    case "guideLinks": return String(row.label ?? "");
    default: return "";
  }
}

const foldName = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function take(workspace: Workspace, key: keyof Workspace, match: (row: any) => boolean): { next: Workspace; part: DeletedPart | null } {
  const list = workspace[key];
  if (!Array.isArray(list)) return { next: workspace, part: null };
  const rows: DeletedPart["rows"] = [];
  const kept: any[] = [];
  list.forEach((row: any, index: number) => {
    if (match(row)) rows.push({ row, index });
    else kept.push(row);
  });
  if (!rows.length) return { next: workspace, part: null };
  return { next: { ...workspace, [key]: kept } as Workspace, part: { key, rows } };
}

/**
 * Takes one row out. Deleting an assignment takes its scores with it, because a score with no
 * assignment can never be seen again. Returns null when there is no such row.
 */
export function deleteRow(workspace: Workspace, key: keyof Workspace, rowId: string): { workspace: Workspace; deleted: Deleted } | null {
  const main = take(workspace, key, (row) => row?.id === rowId);
  if (!main.part) return null;
  let next = main.next;
  const parts = [main.part];
  if (key === "assignments") {
    const scores = take(next, "gradeScores", (row) => row?.assignmentId === rowId);
    if (scores.part) { next = scores.next; parts.push(scores.part); }
  }
  const row = main.part.rows[0].row;
  const title = clip(titleOf(key, row));
  const what = WHAT[key] || "item";
  const extra = parts.length > 1 ? ` and its ${parts[1].rows.length === 1 ? "score" : `${parts[1].rows.length} scores`}` : "";
  return { workspace: next, deleted: { label: `Deleted ${what}${title ? ` “${title}”` : ""}${extra}`, parts } };
}

/** Puts deleted rows back where they were. A row that is already back is not added twice. */
export function undoDelete(workspace: Workspace, deleted: Deleted): Workspace {
  let next = workspace;
  for (const part of deleted.parts) {
    const current = next[part.key];
    if (!Array.isArray(current)) continue;
    const list = [...current];
    const have = new Set(list.map((row: any) => row?.id));
    for (const { row, index } of [...part.rows].sort((a, b) => a.index - b.index)) {
      if (have.has(row?.id)) continue;
      list.splice(Math.min(index, list.length), 0, row);
      have.add(row?.id);
    }
    next = { ...next, [part.key]: list } as Workspace;
  }
  return next;
}

/** True when two students on the caseload have this name, so rows filed under it can't be told apart. */
function nameShared(workspace: Workspace, name: string): boolean {
  const wanted = foldName(name);
  return workspace.students.filter((s) => foldName(s.name) === wanted).length > 1;
}

/** How many rows in the other tabs are filed under this student's name. */
export function studentRecordCount(workspace: Workspace, name: string): number {
  if (!foldName(name) || nameShared(workspace, name)) return 0;
  const wanted = foldName(name);
  let count = 0;
  for (const key of STUDENT_LISTS) for (const row of workspace[key] as Array<{ student?: string }>) if (foldName(row.student) === wanted) count++;
  return count;
}

/** Deletes every row in the other tabs that is filed under this student's name. */
export function deleteStudentRecords(workspace: Workspace, name: string): { workspace: Workspace; deleted: Deleted } | null {
  if (!studentRecordCount(workspace, name)) return null;
  const wanted = foldName(name);
  let next = workspace;
  const parts: DeletedPart[] = [];
  let total = 0;
  for (const key of STUDENT_LISTS) {
    const taken = take(next, key, (row) => foldName(row?.student) === wanted);
    if (taken.part) { next = taken.next; parts.push(taken.part); total += taken.part.rows.length; }
  }
  return { workspace: next, deleted: { label: `Deleted ${total} ${total === 1 ? "record" : "records"} for ${clip(name)}`, parts } };
}
