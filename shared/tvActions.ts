// What the Apple TV app (native/duo-tv) can change: check a to-do off (or back on), add one, and check off
// a chore, on the LifeHub side or the WorkHub side. Pure, so it's tested; server/tvLink.ts saves the result
// the same careful way the phone does (only over the copy it read, tried again if another device saved).
import { choreDueOn, cleanFamily, toggleChore } from "./familyHub";
import { saveTask, toggleTask } from "./hubTasks";

export type TvAction =
  | { action: "toggle"; id: string; undoCreated?: string }
  | { action: "add"; title: string; due?: string }
  | { action: "chore"; id: string };

/** The request body, checked: anything else is null (and the TV gets a 400). */
export function readTvAction(body: any): TvAction | null {
  const a = body && typeof body === "object" ? body : {};
  const id = typeof a.id === "string" ? a.id.slice(0, 120) : "";
  if (a.action === "toggle" && id) return { action: "toggle", id, ...(typeof a.undoCreated === "string" && a.undoCreated ? { undoCreated: a.undoCreated.slice(0, 120) } : {}) };
  if (a.action === "chore" && id) return { action: "chore", id };
  if (a.action === "add" && typeof a.title === "string" && a.title.trim()) {
    const due = typeof a.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : "";
    return { action: "add", title: a.title.trim().replace(/\s+/g, " ").slice(0, 300), due };
  }
  return null;
}

type Repeat = "none" | "daily" | "weekly" | "monthly";
/** The next date of a repeating task (the phone's nextDate in AriseTodo.tsx). */
export function nextRepeat(due: string, repeat: Repeat): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || repeat === "none") return "";
  const [y, m, d] = due.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  if (repeat === "daily") date.setUTCDate(date.getUTCDate() + 1);
  else if (repeat === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else if (repeat === "monthly") {
    const last = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
    date.setUTCDate(1); date.setUTCMonth(m); date.setUTCDate(Math.min(d, last));
  } else return "";
  return date.toISOString().slice(0, 10);
}

export type TvResult = { workspace: Record<string, any>; created?: string; message: string } | { error: string };

/** LifeHub (arise_todo_workspaces): tasks and the family's chores. */
export function applyLifeTv(ws: Record<string, any>, a: TvAction, today: string, now: string, makeId: () => string): TvResult {
  const tasks: any[] = Array.isArray(ws.tasks) ? ws.tasks : [];
  if (a.action === "toggle") {
    const t = tasks.find((x) => x && String(x.id) === a.id);
    if (!t) return { error: "That task isn't there any more." };
    const finished = !t.done;
    let next = tasks.map((x) => (x === t ? { ...x, done: finished, completedAt: finished ? now : undefined } : x));
    let created: string | undefined;
    if (finished && t.repeat && t.repeat !== "none" && t.due) {
      const due = nextRepeat(String(t.due), t.repeat);
      if (due) { created = makeId(); next.push({ ...t, id: created, due, done: false, completedAt: undefined, createdAt: now }); }
    }
    // Undo of a repeating task: the next copy made when it was checked off goes again.
    if (!finished && a.undoCreated) next = next.filter((x) => !(x && String(x.id) === a.undoCreated && !x.done));
    return { workspace: { ...ws, tasks: next }, created, message: finished ? `Done: ${t.title}` : `Back on the list: ${t.title}` };
  }
  if (a.action === "add") {
    const lists: any[] = Array.isArray(ws.lists) ? ws.lists : [];
    const id = makeId();
    const task = { id, title: a.title, notes: "", listId: lists[0]?.id != null ? String(lists[0].id) : "", assignee: "", due: a.due || "", time: "", priority: "normal", repeat: "none", done: false, createdAt: now };
    return { workspace: { ...ws, tasks: [...tasks, task] }, created: id, message: `Added: ${a.title}` };
  }
  // A chore, on the family's chore chart.
  if (!ws.family) return { error: "Chores aren't set up yet." };
  const family = cleanFamily(ws.family);
  const c = family.chores.find((x) => x.id === a.id);
  if (!c || !choreDueOn(c, today)) return { error: "That chore isn't on today's chart." };
  return { workspace: { ...ws, family: toggleChore(family, c, today, makeId) }, message: `Chore: ${c.title}` };
}

/** WorkHub (teacher_hub_workspaces): to-dos. */
export function applyWorkTv(ws: Record<string, any>, a: TvAction, today: string, now: string, makeId: () => string): TvResult {
  const tasks: any[] = Array.isArray(ws.tasks) ? ws.tasks : [];
  if (a.action === "toggle") {
    const t = tasks.find((x) => x && String(x.id) === a.id);
    if (!t) return { error: "That to-do isn't there any more." };
    const r = toggleTask(tasks, a.id, today, now) as { tasks: any[] };
    let next = r.tasks;
    const created = next.find((x) => !tasks.some((o) => o.id === x.id))?.id;
    if (t.done && a.undoCreated) next = next.filter((x) => !(String(x.id) === a.undoCreated && !x.done));
    return { workspace: { ...ws, tasks: next }, created, message: t.done ? `Back on the list: ${t.title}` : `Done: ${t.title}` };
  }
  if (a.action === "add") {
    const next = saveTask(tasks, null, { title: a.title, dueDate: a.due || "", recurring: "", priority: false }, makeId);
    const created = next.find((x: any) => !tasks.some((o) => o.id === x.id))?.id;
    return { workspace: { ...ws, tasks: next }, created, message: `Added: ${a.title}` };
  }
  return { error: "WorkHub has no chores." };
}
