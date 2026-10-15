// What LifeHub's notification bell lists besides the account's own notifications: what needs doing today.
// Built from the family's own data so it can be tested; the bell shows it in the same dropdown as Reader's.
import { addDays, billDue, billState, choreDoneOn, choreDueOn, daysBetween, eventsOn, isOn, type Family } from "./familyHub";
import type { FeedItem } from "./notifications";

export type LifeTask = { id: string; title: string; due: string; time: string; done: boolean };

const clock12 = (t: string) => { const [h, m] = t.split(":").map(Number); return Number.isFinite(h) ? `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}` : ""; };
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const hm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const MAX = 14;

/** Keys of these items start with "life:" so the bell knows they are kept on this device, not on the server. */
export function lifeAlerts(family: Family, tasks: LifeTask[], today: string, nowMs: number, pillsDue = 0): FeedItem[] {
  const nowIso = new Date(nowMs).toISOString();
  const out: FeedItem[] = [];
  const on = (s: Parameters<typeof isOn>[0]) => isOn(s, family);
  const go = (type: string) => ({ type: `life:${type}`, id: 0 });

  for (const t of tasks.filter((x) => !x.done && x.due && x.due <= today).sort((a, b) => (a.due + a.time).localeCompare(b.due + b.time))) {
    const late = t.due < today || (!!t.time && t.time < hm(nowMs));
    out.push({
      key: `life:task:${t.id}`, kind: "action", category: late ? "report" : "request", title: t.title || "Task",
      body: t.due < today ? `Overdue since ${new Date(`${t.due}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : t.time ? `Due today at ${clock12(t.time)}` : "Due today",
      createdAt: nowIso, target: go("tasks"),
    });
  }

  if (on("calendar")) {
    for (const e of eventsOn(family, today, true).filter((x) => x.time && x.time >= hm(nowMs) && x.time <= hm(nowMs + 3 * 3_600_000)).slice(0, 3)) {
      out.push({ key: `life:event:${e.id}:${today}`, kind: "action", category: "message", title: `${e.title || "Event"} at ${clock12(e.time)}`, body: e.location || "Coming up in the next few hours", createdAt: nowIso, target: go("calendar") });
    }
  }

  if (on("money")) {
    const month = today.slice(0, 7), next = addDays(`${month}-28`, 7).slice(0, 7);
    for (const x of family.bills.flatMap((b) => [month, next].map((m) => ({ b, m, due: billDue(b, m), state: billState(b, m, today) })))
      .filter((x) => x.state !== "paid" && daysBetween(today, x.due) <= 3 && daysBetween(today, x.due) >= -30).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4)) {
      const d = daysBetween(today, x.due);
      out.push({ key: `life:bill:${x.b.id}:${x.m}`, kind: "action", category: d < 0 ? "report" : "grade_change", title: `${x.b.name}: $${x.b.amount.toFixed(2)}`, body: d < 0 ? `Late by ${-d} ${plural(-d, "day")}` : d === 0 ? "Due today" : `Due in ${d} ${plural(d, "day")}`, createdAt: nowIso, target: go("money") });
    }
  }

  if (on("chores")) {
    const left = family.chores.filter((c) => choreDueOn(c, today) && !choreDoneOn(family, c.id, today));
    if (left.length) out.push({ key: `life:chores:${today}`, kind: "action", category: "club", title: `${left.length} ${plural(left.length, "chore")} left today`, body: left.slice(0, 3).map((c) => c.title).join(", "), createdAt: nowIso, target: go("chores") });
  }

  if (pillsDue > 0 && on("pills")) out.push({ key: `life:pills:${today}`, kind: "action", category: "assessment", title: `${pillsDue} ${plural(pillsDue, "dose")} to take`, body: "Tap to mark them taken", createdAt: nowIso, target: go("pills") });

  return out.slice(0, MAX);
}
