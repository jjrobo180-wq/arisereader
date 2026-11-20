// The Week Planner plugin: Monday to Friday, what needs doing each day. Saved as Plugin Kit records
// (shared/pluginKit.ts), so it syncs with the hub like every other plugin:
//  - a task:          date = its day (YYYY-MM-DD), data { t: title, o: order, done?: true }
//  - a template line: date = "",          data { tpl: template name, day: 0-4, t, o }
//  - "don't ask":     date = a Monday,    data { kind: "skip" } (the carry-over offer was answered for that week)
// Tasks belong to a date, so every new week starts empty. Nothing comes along unless the person
// carries the unfinished ones over, copies a whole week, or puts in a template.
import type { KitRecord } from "./pluginKit";

export const WEEK_PLUGIN = "week-planner";
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

type Recs = KitRecord[];
type MakeId = () => string;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const at = (day: string) => new Date(`${day}T12:00:00Z`);

export function addDays(day: string, n: number): string { const d = at(day); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
/** The Monday of the week a day is in. Saturday and Sunday look ahead to the coming week. */
export function mondayOf(day: string): string {
  const w = at(day).getUTCDay(); // 0 Sunday … 6 Saturday
  return addDays(day, w === 0 ? 1 : w === 6 ? 2 : 1 - w);
}
/** Monday to Friday of the week starting on `monday`. */
export const weekDays = (monday: string) => [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
/** Which weekday (0 Monday … 4 Friday) a day is, or -1 for a weekend. */
export const weekdayIndex = (day: string) => { const w = at(day).getUTCDay(); return w >= 1 && w <= 5 ? w - 1 : -1; };

const mine = (r: KitRecord) => r.plugin === WEEK_PLUGIN;
const isTask = (r: KitRecord) => mine(r) && !!r.date && typeof r.data.t === "string" && r.data.kind === undefined;
const isTpl = (r: KitRecord) => mine(r) && !r.date && typeof r.data.tpl === "string";
const order = (a: KitRecord, b: KitRecord) => (Number(a.data.o) || 0) - (Number(b.data.o) || 0);

/** A day's tasks, in their order. */
export const tasksOn = (all: Recs, day: string) => all.filter((r) => isTask(r) && r.date === day).sort(order);
/** A week's tasks, by day. */
export const weekTasks = (all: Recs, monday: string) => weekDays(monday).map((d) => tasksOn(all, d));
export const weekCounts = (all: Recs, monday: string) => { const t = weekTasks(all, monday).flat(); return { total: t.length, done: t.filter((r) => r.data.done === true).length }; };

const nextOrder = (all: Recs, day: string) => tasksOn(all, day).reduce((m, r) => Math.max(m, Number(r.data.o) || 0), 0) + 1;

export function addTask(all: Recs, day: string, title: string, makeId: MakeId): Recs {
  const t = title.trim().slice(0, 300);
  if (!t) return all;
  return [...all, { id: makeId(), plugin: WEEK_PLUGIN, date: day, data: { t, o: nextOrder(all, day) } }];
}
export const editTask = (all: Recs, id: string, patch: { t?: string; done?: boolean }): Recs => all.map((r) => {
  if (r.id !== id) return r;
  const data = { ...r.data };
  if (patch.t !== undefined) data.t = patch.t.trim().slice(0, 300) || data.t;
  if (patch.done !== undefined) { if (patch.done) data.done = true; else delete data.done; }
  return { ...r, data };
});
export const removeTask = (all: Recs, id: string): Recs => all.filter((r) => r.id !== id);

/** Move a task to a day, before another task there (or to the end). The day's order is renumbered. */
export function moveTask(all: Recs, id: string, day: string, beforeId?: string): Recs {
  const moving = all.find((r) => r.id === id && isTask(r));
  if (!moving || beforeId === id) return all;
  const others = tasksOn(all, day).filter((r) => r.id !== id);
  const at = beforeId ? others.findIndex((r) => r.id === beforeId) : -1;
  const list = at < 0 ? [...others, moving] : [...others.slice(0, at), moving, ...others.slice(at)];
  const newOrder = new Map(list.map((r, i) => [r.id, i + 1]));
  return all.map((r) => (newOrder.has(r.id) ? { ...r, date: day, data: { ...r.data, o: newOrder.get(r.id)! } } : r));
}

/** The unfinished tasks of one week, moved to the same weekday of another. They leave the old week. */
export function carryUnfinished(all: Recs, fromMonday: string, toMonday: string): { records: Recs; moved: number } {
  let out = all, moved = 0;
  weekDays(fromMonday).forEach((day, i) => {
    for (const r of tasksOn(all, day)) if (r.data.done !== true) { out = moveTask(out, r.id, addDays(toMonday, i)); moved++; }
  });
  return { records: out, moved };
}

/** Every task of one week copied to another, unchecked. The old week keeps its own. */
export function copyWeek(all: Recs, fromMonday: string, toMonday: string, makeId: MakeId): { records: Recs; copied: number } {
  let out = all, copied = 0;
  weekDays(fromMonday).forEach((day, i) => { for (const r of tasksOn(all, day)) { out = addTask(out, addDays(toMonday, i), String(r.data.t), makeId); copied++; } });
  return { records: out, copied };
}

export const clearWeek = (all: Recs, monday: string): Recs => { const days = new Set(weekDays(monday)); return all.filter((r) => !(isTask(r) && days.has(r.date))); };

/** Saved templates, by name, with how many tasks each has. */
export function templates(all: Recs): { name: string; count: number }[] {
  const by = new Map<string, number>();
  for (const r of all) if (isTpl(r)) by.set(String(r.data.tpl), (by.get(String(r.data.tpl)) || 0) + 1);
  return [...by.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}
export const templateLines = (all: Recs, name: string) => all.filter((r) => isTpl(r) && r.data.tpl === name).sort((a, b) => (Number(a.data.day) - Number(b.data.day)) || order(a, b));

/** A week saved as a template (replacing one with the same name). Only the task names are kept. */
export function saveTemplate(all: Recs, name: string, monday: string, makeId: MakeId): Recs {
  const n = name.trim().slice(0, 60);
  if (!n) return all;
  const kept = deleteTemplate(all, n);
  const lines: KitRecord[] = [];
  weekTasks(all, monday).forEach((day, i) => day.forEach((r, k) => lines.push({ id: makeId(), plugin: WEEK_PLUGIN, date: "", data: { tpl: n, day: i, t: String(r.data.t), o: k + 1 } })));
  return [...kept, ...lines];
}
export const deleteTemplate = (all: Recs, name: string): Recs => all.filter((r) => !(isTpl(r) && r.data.tpl === name));

/** A template's tasks added to a week (after what's already there). */
export function applyTemplate(all: Recs, name: string, monday: string, makeId: MakeId): { records: Recs; added: number } {
  let out = all, added = 0;
  for (const l of templateLines(all, name)) { const d = Number(l.data.day); if (d >= 0 && d <= 4) { out = addTask(out, addDays(monday, d), String(l.data.t), makeId); added++; } }
  return { records: out, added };
}

/** A new week with nothing in it yet and unfinished tasks last week: offer to bring them along, once. */
export function carryOffer(all: Recs, monday: string): number {
  if (weekCounts(all, monday).total > 0) return 0;
  if (all.some((r) => mine(r) && r.date === monday && r.data.kind === "skip")) return 0;
  return weekTasks(all, addDays(monday, -7)).flat().filter((r) => r.data.done !== true).length;
}
export const skipOffer = (all: Recs, monday: string, makeId: MakeId): Recs => [...all, { id: makeId(), plugin: WEEK_PLUGIN, date: monday, data: { kind: "skip" } }];
