// The Tasks page's looks (components/teacher-hub/TaskLooks.tsx): the same to-dos and lists, shown six ways,
// switched with one tap at the top of the page. Picked from the Tasks prototypes (Nov 23, 2026): 1 List,
// 2 Today, 3 Lists (tiles), 4 Minimal, 6 Board and 10 Notes, plus the Original screen. What's here is
// the sorting each look needs, so it can be tested on its own.
import { dueState } from "./hubDates";
import type { Task } from "./teacherHub";

export const TASK_LOOKS = ["calm", "today", "tiles", "minimal", "board", "notes", "classic"] as const;
export type TaskLook = (typeof TASK_LOOKS)[number];

export const TASK_LOOK_INFO: Record<TaskLook, { name: string; blurb: string }> = {
  calm: { name: "List", blurb: "Today, Upcoming or All, with your lists under it" },
  today: { name: "Today", blurb: "Today's date, how far along you are, then what's late, today and next" },
  tiles: { name: "Lists", blurb: "A big tile for each list, in dark" },
  minimal: { name: "Minimal", blurb: "One top bar and a plain list" },
  board: { name: "Board", blurb: "A column for each list" },
  notes: { name: "Notes", blurb: "Each to-do as a sticky note" },
  classic: { name: "Original", blurb: "The page as it was, with numbers along the top" },
};

type Row = Pick<Task, "id" | "title" | "dueDate" | "done"> & Partial<Pick<Task, "dueTime" | "listId" | "archived" | "doneAt" | "priority">>;
type List = { id: string; name: string; color: string };

const open = <T extends Row>(tasks: T[]) => tasks.filter((t) => !t.archived && !t.done);
const byDue = <T extends Row>(a: T, b: T) => `${a.dueDate || "9999"}${a.dueTime || "99"}`.localeCompare(`${b.dueDate || "9999"}${b.dueTime || "99"}`) || a.title.localeCompare(b.title);
const inList = (listId: string) => <T extends Row>(t: T) => listId === "all" || (t.listId || "") === listId;

/** The Today look: what's late, what's today, what's next (the coming week) and anything finished today. */
export function dayGroups<T extends Row>(tasks: T[], today: string, listId = "all", soonDays = 7) {
  const mine = tasks.filter((t) => !t.archived).filter(inList(listId));
  const limit = new Date(`${today}T12:00:00`); limit.setDate(limit.getDate() + soonDays);
  const until = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, "0")}-${String(limit.getDate()).padStart(2, "0")}`;
  const undone = open(mine);
  return {
    overdue: undone.filter((t) => dueState(t.dueDate, today) === "overdue").sort(byDue),
    today: undone.filter((t) => t.dueDate === today).sort(byDue),
    soon: undone.filter((t) => t.dueDate > today && t.dueDate <= until).sort(byDue),
    someday: undone.filter((t) => !t.dueDate).sort(byDue),
    doneToday: mine.filter((t) => t.done && (t.doneAt || "").slice(0, 10) === today),
  };
}

/** "1 of 3 done" for today: today's and late to-dos, and the ones finished today. */
export function todayProgress<T extends Row>(tasks: T[], today: string, listId = "all") {
  const g = dayGroups(tasks, today, listId);
  const left = g.overdue.length + g.today.length;
  return { done: g.doneToday.length, total: left + g.doneToday.length };
}

/** The Lists look: a tile for Today and one for each list (and "No list" when some to-dos have none). */
export function listTiles<T extends Row>(tasks: T[], lists: List[], today: string) {
  const undone = open(tasks).sort(byDue);
  const late = (xs: T[]) => xs.filter((t) => dueState(t.dueDate, today) === "overdue").length;
  const dueNow = undone.filter((t) => t.dueDate && t.dueDate <= today);
  const tiles = [{ id: "today", name: "Today", color: "", count: dueNow.length, late: late(dueNow), next: dueNow[0] as T | undefined }];
  for (const l of lists) { const xs = undone.filter((t) => t.listId === l.id); tiles.push({ id: l.id, name: l.name, color: l.color, count: xs.length, late: late(xs), next: xs[0] }); }
  const loose = undone.filter((t) => !t.listId || !lists.some((l) => l.id === t.listId));
  if (loose.length) tiles.push({ id: "", name: "No list", color: "#94a3b8", count: loose.length, late: late(loose), next: loose[0] });
  return tiles;
}

/** The Board look: a column for each list, in the lists' order, then "No list" when it has any. */
export function boardColumns<T extends Row>(tasks: T[], lists: List[]) {
  const undone = open(tasks).sort(byDue);
  const cols = lists.map((l) => ({ id: l.id, name: l.name, color: l.color, tasks: undone.filter((t) => t.listId === l.id) }));
  const loose = undone.filter((t) => !t.listId || !lists.some((l) => l.id === t.listId));
  return loose.length ? [...cols, { id: "", name: "No list", color: "#94a3b8", tasks: loose }] : cols;
}

/** A light tint of a list's color for a note or a column (mixed toward white). */
export function tint(hex: string, amount = 0.82): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#f1f5f9";
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, "0");
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/** Each note's small tilt in the Notes look: the same to-do always leans the same way. */
export function noteTilt(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return [-2, 1.5, -1, 2, -1.5, 1][Math.abs(h) % 6];
}

/** Dark or white text, whichever reads better on a color (for the Lists look's tiles). */
export function textOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#12111c";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast with near-black (#12111c, L≈0.006) against white (L=1): pick the larger.
  return (L + 0.05) / 0.056 >= 1.05 / (L + 0.05) ? "#12111c" : "#ffffff";
}
