// What Arise To Duo's Apple Watch app shows (native/duo-watch), and what's done on it, applied back.
// The watch has a Life / Work switch: the Life part comes from LifeHub (AriseTodo.tsx), the Work part from
// WorkHub (TeacherHub.tsx). Each hub sends its own part; client/src/lib/watch.ts keeps the other hub's
// last part so the watch always has both. Kept small: the phone hands the watch one JSON object of at
// most 64 KB (Apple's limit), so every list is capped and every text is cut short.
import { addDays, choreDoneOn, choreDueOn, choreOwner, eventsOn, isOn, toggleChore, type Family } from "./familyHub";
import { dosesOn, markDose } from "./pills";
import { billStatus, monthPicture, payBill, safeToSpend, type PlanBill } from "./moneyPlan";
import { WEEK, K_SLOTS, cell, dishName, planStart, type Kitchen } from "./kitchen";
import { toggleTask, saveTask } from "./hubTasks";
import { expandEvents } from "./hubRepeat";
import type { Workspace } from "./teacherHub";

export type WatchHub = "life" | "work";
export type WatchTask = { id: string; title: string; due: string; time: string; done: boolean; list: string };
export type WatchAct = { type: string; hub?: string; [field: string]: unknown };

const cut = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const shortDay = (d: string) => d.slice(0, 10);

/** Open tasks (soonest first) and the ones done today, for either hub. */
function taskList(open: WatchTask[], done: WatchTask[]): WatchTask[] {
  const soon = open.filter((t) => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (a.time || "99").localeCompare(b.time || "99")).slice(0, 60);
  return [...soon, ...done.slice(-15)];
}

type LifeTask = { id: string; title: string; due?: string; time?: string; done?: boolean; archived?: boolean; listId: string; doneAt?: string };

/** LifeHub's part: tasks, calendar, chores, groceries, habits, medicine, bills and money, meals, countdowns, notes. */
export function lifeWatchPart(f: Family, tasks: LifeTask[], lists: { id: string; name: string }[], today: string): Record<string, unknown> {
  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? "";
  const live = tasks.filter((t) => !t.archived);
  const mk = (t: LifeTask): WatchTask => ({ id: t.id, title: cut(t.title, 120), due: t.due || "", time: t.time || "", done: !!t.done, list: cut(listName(t.listId), 30) });
  const out: Record<string, unknown> = {
    tasks: taskList(live.filter((t) => !t.done).map(mk), live.filter((t) => t.done).map(mk)),
    features: [] as string[],
  };
  const features = out.features as string[];
  if (isOn("calendar", f)) {
    features.push("calendar");
    out.events = [0, 1, 2, 3, 4, 5, 6].flatMap((n) => { const day = addDays(today, n); return eventsOn(f, day, true).map((e) => ({ date: day, title: cut(e.title, 80), time: e.time || "", location: cut(e.location, 60) })); }).slice(0, 30);
  }
  if (isOn("chores", f)) {
    features.push("chores");
    const member = new Map(f.members.map((m) => [m.id, m]));
    out.chores = f.chores.filter((c) => choreDueOn(c, today)).slice(0, 30).map((c) => { const who = member.get(choreOwner(c, today)); return { id: c.id, title: cut(c.title, 80), who: cut(who?.name, 30), emoji: who?.emoji || "", points: c.points, done: !!choreDoneOn(f, c.id, today) }; });
  }
  if (isOn("grocery", f)) {
    features.push("grocery");
    const items = [...f.groceries].sort((a, b) => Number(a.checked) - Number(b.checked) || a.aisle.localeCompare(b.aisle));
    out.groceries = items.slice(0, 80).map((g) => ({ id: g.id, name: cut(g.name, 60), qty: cut(g.qty, 20), aisle: cut(g.aisle, 24), done: !!g.checked }));
  }
  if (isOn("habits", f)) {
    features.push("habits");
    out.habits = f.habits.slice(0, 20).map((h) => {
      let streak = 0;
      for (let d = h.days.includes(today) ? today : addDays(today, -1); h.days.includes(d); d = addDays(d, -1)) streak++;
      return { id: h.id, name: cut(h.name, 50), emoji: h.emoji || "", done: h.days.includes(today), streak };
    });
  }
  if (isOn("pills", f)) {
    features.push("pills");
    const member = new Map(f.members.map((m) => [m.id, m]));
    out.pills = dosesOn(f, today).slice(0, 30).map((d) => ({ pillId: d.pill.id, name: cut(d.pill.name, 50), dose: cut(d.pill.dose, 30), time: d.time, who: cut(member.get(d.pill.memberId)?.name, 30), status: d.status ?? "" }));
  }
  if (isOn("money", f)) {
    features.push("money");
    const month = today.slice(0, 7);
    const bills = f.bills as PlanBill[];
    const pic = monthPicture(f.money, bills, f.expenses, f.budget, month, today);
    const safe = f.money.style === "paycheck" ? safeToSpend(f.money, bills, f.expenses, month, today) : null;
    out.money = safe
      ? { label: "Safe to spend", amount: safe.amount, until: safe.until, spent: pic.spent, budgeted: pic.budgeted, billsLeft: pic.billsLeft }
      : { label: "Left this month", amount: pic.leftover, until: "", spent: pic.spent, budgeted: pic.budgeted, billsLeft: pic.billsLeft };
    out.bills = bills.map((b) => ({ b, s: billStatus(f.money, b, month, today) }))
      .filter((x) => x.s.owed > 0)
      .sort((a, z) => Number(a.s.state === "paid") - Number(z.s.state === "paid") || (a.s.nextDue || "9").localeCompare(z.s.nextDue || "9"))
      .slice(0, 25)
      .map(({ b, s }) => ({ id: b.id, name: cut(b.name, 50), left: s.left, owed: s.owed, due: s.nextDue, state: s.state, autopay: !!b.autopay, next: s.nextAmount }));
  }
  const meals = kitchenToday(f.kitchen, today);
  if (meals.length) { features.push("meals"); out.meals = meals; }
  if (isOn("countdowns", f)) {
    features.push("countdowns");
    out.countdowns = f.countdowns.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 15).map((c) => ({ id: c.id, title: cut(c.title, 60), date: c.date, emoji: c.emoji || "", days: daysBetween(today, c.date) }));
  }
  if (isOn("notes", f)) {
    features.push("notes");
    out.notes = f.notes.filter((n) => !n.locked).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20).map((n) => ({ id: n.id, title: cut(n.title || n.body.split("\n")[0] || "Note", 60), text: cut(n.body, 500), at: n.updatedAt }));
  }
  return out;
}

/** Today's planned meals from the Kitchen app (breakfast, lunch, dinner, snacks, dessert). */
function kitchenToday(k: Kitchen | undefined, today: string): { slot: string; dishes: string[] }[] {
  if (!k?.setup) return [];
  const start = planStart(k, today);
  const offset = daysBetween(start, today);
  const weeks = k.weeks === 2 || k.weeks === 4 ? k.weeks : 1;
  if (offset < 0 || offset >= weeks * 7) return [];
  const day = WEEK[offset % 7], wk = Math.floor(offset / 7);
  return K_SLOTS.map((s) => ({ slot: s.label, dishes: (k.week[cell(day, s.id, wk)] ?? []).map((m) => cut(dishName(k, m.dish), 50)) })).filter((m) => m.dishes.length);
}

/** WorkHub's part: to-dos and the week's calendar, and recent notes. */
export function workWatchPart(w: Workspace, today: string): Record<string, unknown> {
  const lists = (w as any).taskLists as { id: string; name: string }[] | undefined;
  const listName = (id?: string) => (id && lists?.find((l) => l.id === id)?.name) || "";
  const live = w.tasks.filter((t) => !t.archived);
  const mk = (t: Workspace["tasks"][number]): WatchTask => ({ id: t.id, title: cut(t.title, 120), due: shortDay(t.dueDate || ""), time: t.dueTime || "", done: !!t.done, list: cut(listName(t.listId), 30) });
  const end = addDays(today, 6);
  const events = expandEvents(w.events, today, end).filter((e) => e.date >= today && e.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""))
    .slice(0, 30).map((e) => ({ date: e.date, title: cut(e.title, 80), time: e.start || "", location: cut(e.location, 60) }));
  const notes = [...w.notes].filter((n) => !n.locked).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 20)
    .map((n) => ({ id: n.id, title: cut(n.title || n.student || n.type || "Note", 60), text: cut(n.body, 500), at: n.date }));
  return { tasks: taskList(live.filter((t) => !t.done).map(mk), live.filter((t) => t.done).map(mk)), events, notes, features: ["calendar", "notes"] };
}

/** The watch's whole payload: both hubs, and Life's fields at the top too (for watch apps from before the switch). */
export function watchPayload(parts: Partial<Record<WatchHub, Record<string, unknown>>>, today: string, name: string): Record<string, unknown> {
  const life = parts.life ?? {};
  const keep = (p: Record<string, unknown> | undefined) => (p ? { ...p } : undefined);
  return { today, name, ...life, hubs: { ...(parts.life ? { life: keep(parts.life) } : {}), ...(parts.work ? { work: keep(parts.work) } : {}) } };
}

/** Which hub a watch action is for (watch apps from before the switch only sent Life ones). */
export const actionHub = (a: WatchAct): WatchHub => (a.hub === "work" ? "work" : "life");

/** LifeHub actions that change the family (task ones are done by the page, which has its own undo and toasts). */
export function applyLifeWatch(f: Family, actions: WatchAct[], today: string, makeId: () => string, now = new Date().toISOString()): Family {
  let next = f;
  for (const a of actions) {
    const id = typeof a.id === "string" ? a.id : "";
    if (a.type === "chore" && id) {
      const c = next.chores.find((x) => x.id === id);
      if (c && choreDueOn(c, today)) next = toggleChore(next, c, today, makeId);
    } else if (a.type === "grocery" && id) {
      next = { ...next, groceries: next.groceries.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g)) };
    } else if (a.type === "grocery-add" && typeof a.name === "string" && a.name.trim()) {
      const name = a.name.trim().slice(0, 80);
      if (!next.groceries.some((g) => !g.checked && g.name.toLowerCase() === name.toLowerCase()))
        next = { ...next, groceries: [...next.groceries, { id: makeId(), name, qty: "", aisle: "", checked: false }] };
    } else if (a.type === "grocery-clear") {
      next = { ...next, groceries: next.groceries.filter((g) => !g.checked) };
    } else if (a.type === "habit" && id) {
      next = { ...next, habits: next.habits.map((h) => (h.id !== id ? h : { ...h, days: h.days.includes(today) ? h.days.filter((d) => d !== today) : [...h.days, today].sort() })) };
    } else if (a.type === "pill" && typeof a.pillId === "string" && typeof a.time === "string") {
      const status = a.status === "taken" || a.status === "skipped" ? a.status : null;
      next = markDose(next, a.pillId, today, a.time, status, now);
    } else if (a.type === "bill" && id) {
      const bills = next.bills as PlanBill[];
      const b = bills.find((x) => x.id === id);
      if (b) {
        const month = today.slice(0, 7);
        const s = billStatus(next.money, b, month, today);
        if (s.left > 0) { const r = payBill(next.money, bills, id, month, s.left, today, makeId()); next = { ...next, money: r.plan, bills: r.bills }; }
      }
    }
  }
  return next;
}

/** WorkHub actions: a to-do checked off or added on the watch. */
export function applyWorkWatch(w: Workspace, actions: WatchAct[], today: string, makeId: () => string, at = new Date().toISOString()): Workspace {
  let tasks = w.tasks;
  for (const a of actions) {
    if (a.type === "toggle" && typeof a.id === "string" && tasks.some((t) => t.id === a.id)) tasks = toggleTask(tasks, a.id, today, at).tasks;
    else if (a.type === "add" && typeof a.title === "string" && a.title.trim()) {
      const due = typeof a.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : "";
      tasks = saveTask(tasks, null, { title: a.title, dueDate: due, recurring: "", priority: false }, makeId);
    }
  }
  return tasks === w.tasks ? w : { ...w, tasks };
}
