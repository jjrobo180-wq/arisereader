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

/** Checks a task off. A repeating task isn't finished: its due date moves to the next time and it stays open. */
export function toggleTask(tasks: Task[], id: string, today: string): TaskToggle {
  let rolledTo: string | null = null;
  const next = tasks.map((t) => {
    if (t.id !== id) return t;
    if (!t.done && t.recurring) {
      const due = nextDue(t.dueDate, t.recurring, today);
      if (due) { rolledTo = due; return { ...t, dueDate: due, lastDone: today }; }
    }
    return { ...t, done: !t.done };
  });
  return { tasks: next, rolledTo };
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
  return tasks.map((t) => { if (t.id !== id) return t; const { priority: _drop, ...rest } = t; return { ...rest, ...changes }; });
}
