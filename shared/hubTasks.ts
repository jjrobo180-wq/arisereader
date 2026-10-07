// Teacher Hub: sorting, filtering and repeating to-dos.
import { addDays, addMonths, dueState } from "./hubDates";
import type { Task } from "./teacherHub";

export type TaskFilter = "open" | "done" | "all";
export type TaskSort = "due" | "priority" | "newest" | "name";

export const TASK_SORTS: { id: TaskSort; label: string }[] = [
  { id: "due", label: "Due date" },
  { id: "priority", label: "Most important" },
  { id: "newest", label: "Newest first" },
  { id: "name", label: "A to Z" },
];

/** Tasks to show: filtered, then sorted. Done tasks always sink to the bottom of "All". Ties keep the saved order (newest last in the list). */
export function arrangeTasks(tasks: Task[], filter: TaskFilter, sort: TaskSort, search = ""): Task[] {
  const q = search.trim().toLowerCase();
  const indexed = tasks.map((task, index) => ({ task, index }))
    .filter(({ task }) => (filter === "all" || (filter === "done") === !!task.done) && (!q || task.title.toLowerCase().includes(q)));
  const due = (t: Task) => (t.dueDate ? t.dueDate : "9999-99-99");
  const high = (t: Task) => (t.priority === "high" ? 0 : 1);
  indexed.sort((a, b) => {
    if (!!a.task.done !== !!b.task.done) return a.task.done ? 1 : -1;
    let c = 0;
    if (sort === "due") c = due(a.task).localeCompare(due(b.task)) || high(a.task) - high(b.task);
    else if (sort === "priority") c = high(a.task) - high(b.task) || due(a.task).localeCompare(due(b.task));
    else if (sort === "newest") c = b.index - a.index;
    else c = a.task.title.localeCompare(b.task.title, undefined, { sensitivity: "base" });
    return c || a.index - b.index;
  });
  return indexed.map((x) => x.task);
}

export function taskCounts(tasks: Task[], today: string) {
  const open = tasks.filter((t) => !t.done);
  return { open: open.length, done: tasks.length - open.length, overdue: open.filter((t) => dueState(t.dueDate, today) === "overdue").length, today: open.filter((t) => dueState(t.dueDate, today) === "today").length };
}

/** The next due date for a repeating task: stays on its rhythm and lands after `today`. "" when it doesn't repeat. */
export function nextDue(dueDate: string, recurring: string, today: string): string {
  const step = { Daily: (d: string, n: number) => addDays(d, n), Weekly: (d: string, n: number) => addDays(d, 7 * n), Monthly: (d: string, n: number) => addMonths(d, n), Quarterly: (d: string, n: number) => addMonths(d, 3 * n) }[recurring as "Daily"];
  if (!step) return "";
  const base = dueDate || today;
  for (let n = 1; n <= 800; n++) {
    const next = step(base, n);
    if (next > today) return next;
  }
  return "";
}

export type TaskToggle = { tasks: Task[]; rolledTo: string | null };

/** How long a checked-off to-do is kept in view with an Undo: a day. */
export const UNDO_TASK_MS = 24 * 60 * 60 * 1000;

/**
 * Checks a task off. A repeating task isn't finished: its due date moves to the next time and it stays open.
 * `at` is the moment it happened (an ISO time); with it, the to-do can be offered back for a day.
 */
export function toggleTask(tasks: Task[], id: string, today: string, at?: string): TaskToggle {
  let rolledTo: string | null = null;
  const next = tasks.map((t) => {
    if (t.id !== id) return t;
    if (!t.done && t.recurring) {
      const due = nextDue(t.dueDate, t.recurring, today);
      if (due) {
        rolledTo = due;
        const { rolled: _was, ...rest } = t;
        return { ...rest, dueDate: due, lastDone: today, ...(at ? { rolled: { dueDate: t.dueDate, ...(t.lastDone ? { lastDone: t.lastDone } : {}), at } } : {}) };
      }
    }
    const { doneAt: _when, ...rest } = t;
    return t.done ? { ...rest, done: false } : { ...rest, done: true, ...(at ? { doneAt: at } : {}) };
  });
  return { tasks: next, rolledTo };
}

const within = (at: string | undefined, nowMs: number) => { const t = Date.parse(at || ""); return Number.isFinite(t) && nowMs - t < UNDO_TASK_MS && t <= nowMs + 60_000; };

/** Checked off in the last day (or, for a repeating to-do, moved on to its next time in the last day). Newest first. */
export function recentlyDone(tasks: Task[], nowMs: number): Task[] {
  const when = (t: Task) => Date.parse((t.done ? t.doneAt : t.rolled?.at) || "") || 0;
  return tasks.filter((t) => (t.done ? within(t.doneAt, nowMs) : within(t.rolled?.at, nowMs))).sort((a, b) => when(b) - when(a));
}

/**
 * Takes a check mark back. A finished to-do is open again; a repeating one goes back to the due date
 * it had before it moved on (for up to a day). Anything else is left as it is.
 */
export function undoTask(tasks: Task[], id: string, nowMs: number): Task[] {
  const task = tasks.find((t) => t.id === id);
  if (!task || (!task.done && !within(task.rolled?.at, nowMs))) return tasks;
  return tasks.map((t) => {
    if (t.id !== id) return t;
    if (t.done) { const { doneAt: _when, ...rest } = t; return { ...rest, done: false }; }
    const { rolled, lastDone: _last, ...rest } = t;
    return { ...rest, dueDate: rolled!.dueDate, ...(rolled!.lastDone ? { lastDone: rolled!.lastDone } : {}) };
  });
}

/** The boxes of the to-do pop-up. */
export type TaskFields = { title: string; dueDate: string; recurring: string; priority: boolean };

/**
 * Saves the to-do pop-up. A new to-do goes at the end. An edited one stays the same to-do: same place,
 * same check mark, same "last done". Nothing changes when the name is empty or the to-do is gone.
 */
export function saveTask(tasks: Task[], id: string | null, fields: TaskFields, makeId: () => string): Task[] {
  const title = fields.title.trim().slice(0, 200).trim();
  if (!title) return tasks;
  const changes = { title, dueDate: fields.dueDate, recurring: fields.recurring, ...(fields.priority ? { priority: "high" as const } : {}) };
  if (!id) return [...tasks, { id: makeId(), ...changes, done: false }];
  if (!tasks.some((t) => t.id === id)) return tasks;
  // A repeating to-do's "where it was" only makes sense while its due date and rhythm are untouched.
  return tasks.map((t) => { if (t.id !== id) return t; const { priority: _drop, rolled, ...rest } = t; return { ...rest, ...changes, ...(rolled && t.dueDate === changes.dueDate && t.recurring === changes.recurring ? { rolled } : {}) }; });
}
