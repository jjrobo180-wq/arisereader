// A.R.I.S.E. To-Do reminders, sent to phones the same way as Teacher Hub reminders:
//  - A morning summary (7:00 to noon, once a day): tasks due or overdue, events, chores, bills, trips, polls.
//  - A heads-up 15 minutes before a family event or a task that has a time.
//  - A bill reminder the day before an unpaid bill is due (in the morning summary's window).
import { addDays, billDue, choreDueOn, choreDoneOn, cleanFamily, eventsOn, isOn } from "./familyHub";
import { localParts, EVENT_HEADS_UP_MINUTES, MORNING_FROM_HOUR, MORNING_UNTIL_HOUR, type HubReminder } from "./hubReminders";
import { pollOpen } from "./todoShare";

export const TODO_REMINDER_URL = "/#/to-do";
export type TodoReminder = HubReminder;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const toMinutes = (hm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const clock12 = (hm: string) => {
  const m = toMinutes(hm);
  if (m === null) return hm;
  const h = Math.floor(m / 60), min = m % 60;
  return `${h % 12 || 12}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Reminders due now that have not been sent yet (`sent` holds keys already sent; all start with "todo:"). */
export function dueTodoReminders(workspace: unknown, nowMs: number, timeZone: string, sent: Record<string, unknown> = {}): TodoReminder[] {
  const ws = (workspace && typeof workspace === "object" ? workspace : {}) as Record<string, any>;
  const family = cleanFamily(ws.family);
  const tasks: any[] = (Array.isArray(ws.tasks) ? ws.tasks : []).filter((t) => t && typeof t.title === "string" && !t.done);
  const { date, minutes } = localParts(nowMs, timeZone);
  const out: TodoReminder[] = [];
  const soon = (hm: string) => {
    const start = toMinutes(hm);
    return start !== null && minutes < start && start - minutes <= EVENT_HEADS_UP_MINUTES;
  };

  const events = isOn("calendar", family) ? eventsOn(family, date) : [];
  for (const e of events) {
    if (!e.time || !soon(e.time)) continue;
    const key = `todo:event:${e.id}:${date}:${e.time}`;
    if (sent[key]) continue;
    out.push({ key, title: e.title || "Event", body: `Starts at ${clock12(e.time)}${e.location ? ` · ${e.location}` : ""}`, url: TODO_REMINDER_URL });
  }
  for (const t of tasks) {
    if (t.due !== date || !t.time || !soon(t.time)) continue;
    const key = `todo:task:${t.id}:${date}:${t.time}`;
    if (sent[key]) continue;
    out.push({ key, title: String(t.title).slice(0, 120), body: `Due at ${clock12(t.time)}${t.assignee ? ` · ${t.assignee}` : ""}`, url: TODO_REMINDER_URL });
  }

  if (minutes >= MORNING_FROM_HOUR * 60 && minutes < MORNING_UNTIL_HOUR * 60) {
    const key = `todo:morning:${date}`;
    if (!sent[key]) {
      const due = tasks.filter((t) => typeof t.due === "string" && t.due && t.due <= date);
      const overdue = due.filter((t) => t.due < date).length;
      const chores = isOn("chores", family) ? family.chores.filter((c) => choreDueOn(c, date) && !choreDoneOn(family, c.id, date)).length : 0;
      const month = date.slice(0, 7);
      const bills = isOn("money", family) ? family.bills.filter((b) => !b.paid.includes(month) && billDue(b, month) === date) : [];
      const trips = isOn("trips", family) ? family.trips.filter((t) => t.start === date) : [];
      const polls = isOn("polls", family) ? family.polls.filter((p) => pollOpen(p, date) && p.closesOn === date) : [];
      const bits: string[] = [];
      if (due.length) bits.push(overdue ? `${plural(due.length, "task")} (${overdue} overdue)` : plural(due.length, "task"));
      if (events.length) bits.push(plural(events.length, "event"));
      if (chores) bits.push(plural(chores, "chore"));
      if (bills.length) bits.push(`${plural(bills.length, "bill")} due`);
      if (bits.length || trips.length || polls.length) {
        const first = events.find((e) => e.time);
        const extra = [
          first ? `First up: ${first.title} at ${clock12(first.time)}.` : "",
          trips.length ? `${trips.map((t) => t.name).join(", ")} starts today!` : "",
          polls.length ? `Vote closes today: ${polls[0].question}` : "",
        ].filter(Boolean).join(" ");
        out.push({ key, title: "Today in A.R.I.S.E. To-Do", body: [bits.length ? `${bits.join(", ")}.` : "", extra].filter(Boolean).join(" "), url: TODO_REMINDER_URL });
      }
    }
    // Tomorrow's unpaid bills, so there's a day to pay them (autopay ones look after themselves).
    if (isOn("money", family)) {
      const tomorrow = addDays(date, 1);
      const month = tomorrow.slice(0, 7);
      for (const b of family.bills) {
        if (b.autopay || b.paid.includes(month) || billDue(b, month) !== tomorrow) continue;
        const billKey = `todo:bill:${b.id}:${tomorrow}`;
        if (sent[billKey]) continue;
        out.push({ key: billKey, title: `${b.name} is due tomorrow`, body: b.amount ? `${money(b.amount)} · tap to mark it paid` : "Tap to mark it paid", url: TODO_REMINDER_URL });
      }
    }
  }
  return out;
}
