// A.R.I.S.E. To-Do reminders, sent to phones the same way as Teacher Hub reminders.
// What is sent, when and how often follows the person's choices in family.notify (shared/todoNotify.ts):
//  - A morning summary (from the chosen time to noon, once a day): tasks, events, chores, bills, trips, polls.
//  - A heads-up a few minutes before a family event or a task that has a time.
//  - A bill reminder the day before an unpaid bill is due (in the morning summary's window).
//  - Water reminders, spread evenly over the day, as many as chosen (skipped once the water goal is met).
//  - Meal reminders to log breakfast, lunch, dinner or snacks (skipped when that meal is logged).
//  - Workout and weigh-in reminders on the chosen days, a mood check-in, and an evening recap.
//  - News headlines, as many a day as chosen. These carry `news`; the server fills in the headline.
// Nothing is sent during quiet hours.
import { addDays, billDue, choreDueOn, choreDoneOn, cleanFamily, eventsOn, isOn, type Meal } from "./familyHub";
import { localParts, MORNING_UNTIL_HOUR, type HubReminder } from "./hubReminders";
import { pollOpen } from "./todoShare";
import { inQuiet, spreadTimes, toMinutes as clockMinutes, SEND_WINDOW_MINUTES, type Weekday } from "./todoNotify";
import { caloriesLeft, dayTotals, goalsFor, healthPeople, ME_ID } from "./familyHealth";

export const TODO_REMINDER_URL = "/#/to-do";
export type TodoReminder = HubReminder & { news?: { topic: string; place: string; index: number } };
const MEAL_WORD: Record<Meal, string> = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snacks: "snacks" };

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
  const prefs = family.notify;
  const { date, minutes } = localParts(nowMs, timeZone);
  const out: TodoReminder[] = [];
  if (inQuiet(prefs, minutes)) return out;
  const soon = (hm: string) => {
    const start = toMinutes(hm);
    return prefs.headsUp.on && start !== null && minutes < start && start - minutes <= prefs.headsUp.minutes;
  };
  /** A scheduled time has come, and it's not so long ago that the reminder would be stale. */
  const now = (hm: string) => { const at = clockMinutes(hm); return minutes >= at && minutes < at + SEND_WINDOW_MINUTES; };
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() as Weekday;

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

  const morningFrom = clockMinutes(prefs.morning.time);
  const morningUntil = Math.max(MORNING_UNTIL_HOUR * 60, morningFrom + SEND_WINDOW_MINUTES);
  if (minutes >= morningFrom && minutes < morningUntil) {
    const key = `todo:morning:${date}`;
    if (prefs.morning.on && !sent[key]) {
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
    if (prefs.bills.on && isOn("money", family)) {
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

  /* ---- food & fitness, mood, news and the evening recap ---- */
  const people = healthPeople(family, "");
  const member = people.find((m) => m.id === prefs.memberId) || people.find((m) => m.kind === "adult") || people[0]
    || { id: ME_ID, name: "Me", emoji: "", color: "", kind: "adult" as const };
  const health = family.health;
  const healthOn = isOn("health", family);
  const totals = dayTotals(health, member.id, date);
  const goals = goalsFor(health, member);
  const kid = member.kind === "kid";
  const forWho = people.length > 1 ? ` for ${member.name}` : "";

  if (healthOn && prefs.water.on) {
    spreadTimes(prefs.water.from, prefs.water.until, prefs.water.perDay).forEach((at, i) => {
      const key = `todo:water:${date}:${i}`;
      if (sent[key] || !now(at)) return;
      if (prefs.water.skipWhenMet && goals.water > 0 && totals.water >= goals.water) return;
      const left = Math.max(0, goals.water - totals.water);
      out.push({ key, title: "Time for some water 💧", body: totals.water
        ? `${totals.water} of ${goals.water} cups so far${forWho}.${left ? ` ${left} to go.` : " Goal reached!"} Tap to log a cup.`
        : `Nothing logged yet today${forWho}. Tap to log a cup.`, url: TODO_REMINDER_URL });
    });
  }
  if (healthOn && prefs.meals.on) {
    for (const meal of prefs.meals.which) {
      const key = `todo:meal:${meal}:${date}`;
      if (sent[key] || !now(prefs.meals.times[meal])) continue;
      if (prefs.meals.skipIfLogged && health.food.some((f) => f.memberId === member.id && f.date === date && f.meal === meal)) continue;
      out.push({ key, title: `Log your ${MEAL_WORD[meal]}`, body: kid ? `What did ${member.name} have for ${MEAL_WORD[meal]}?` : `Add ${MEAL_WORD[meal]} to the food diary${forWho} while it's fresh.`, url: TODO_REMINDER_URL });
    }
  }
  if (healthOn && prefs.workout.on && prefs.workout.days.includes(weekday)) {
    const key = `todo:workout:${date}`;
    const moved = health.exercise.some((x) => x.memberId === member.id && x.date === date);
    if (!sent[key] && now(prefs.workout.time) && !(prefs.workout.skipIfLogged && moved)) {
      out.push({ key, title: "Time to move 🏃", body: goals.activeMinutes ? `${totals.minutes} of ${goals.activeMinutes} active minutes today. A walk counts!` : "A walk, a ride or a workout. Log it when you're done.", url: TODO_REMINDER_URL });
    }
  }
  if (healthOn && !kid && prefs.weighIn.on && prefs.weighIn.days.includes(weekday)) {
    const key = `todo:weigh:${date}`;
    if (!sent[key] && now(prefs.weighIn.time) && !health.weights.some((w) => w.memberId === member.id && w.date === date)) {
      out.push({ key, title: "Weigh-in day ⚖️", body: goals.goalWeight ? `Log today's weight to see your progress toward ${goals.goalWeight} lb.` : "Log today's weight to keep your chart up to date.", url: TODO_REMINDER_URL });
    }
  }
  if (isOn("mood", family) && prefs.mood.on) {
    const key = `todo:mood:${date}`;
    if (!sent[key] && now(prefs.mood.time) && !family.moods.some((m) => m.memberId === member.id && m.date === date)) {
      out.push({ key, title: "How was today?", body: "Take five seconds to log your mood.", url: TODO_REMINDER_URL });
    }
  }
  if (prefs.news.on) {
    spreadTimes(prefs.news.from, prefs.news.until, prefs.news.perDay).forEach((at, index) => {
      const key = `todo:news:${date}:${index}`;
      if (sent[key] || !now(at)) return;
      out.push({ key, title: "News", body: "", url: TODO_REMINDER_URL, news: { topic: prefs.news.topic, place: family.news.place, index } });
    });
  }
  if (prefs.evening.on) {
    const key = `todo:evening:${date}`;
    if (!sent[key] && now(prefs.evening.time)) {
      const all: any[] = Array.isArray(ws.tasks) ? ws.tasks : [];
      const doneToday = all.filter((t) => t && t.done && typeof t.completedAt === "string" && t.completedAt.slice(0, 10) === date).length;
      const stillDue = tasks.filter((t) => typeof t.due === "string" && t.due && t.due <= date).length;
      const bits: string[] = [];
      bits.push(doneToday ? `${plural(doneToday, "task")} done` : "No tasks checked off yet");
      if (stillDue) bits.push(`${stillDue} still due`);
      if (healthOn && !kid && totals.items) bits.push(`${Math.round(caloriesLeft(goals.calories, totals)).toLocaleString("en-US")} calories left`);
      if (healthOn && totals.water) bits.push(`${totals.water} of ${goals.water} cups of water`);
      out.push({ key, title: "Your day in A.R.I.S.E. To-Do", body: `${bits.join(" · ")}.`, url: TODO_REMINDER_URL });
    }
  }
  return out;
}
