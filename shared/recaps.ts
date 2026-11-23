// Recaps for LifeHub and FamilyHub: a "yesterday" or "last 7 days" look back for each app that's turned on
// (tasks done, chores, habits, sleep, spending, moods…). Each app's recap can be switched on or off, and the
// whole hub picks Yesterday or This week, in Family.recaps (cleaned by cleanRecaps). The Home screen shows
// them (client/src/components/family-hub/Recaps.tsx).
import type { Family, FamilySection } from "./familyHub";

export type RecapPeriod = "yesterday" | "week";
export type RecapPrefs = { on: boolean; period: RecapPeriod; off: string[] };
export const DEFAULT_RECAPS: RecapPrefs = { on: true, period: "yesterday", off: [] };

export function cleanRecaps(raw: unknown): RecapPrefs {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const off = Array.isArray(r.off) ? [...new Set(r.off.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)))].slice(0, 200) : [];
  return { on: r.on !== false, period: r.period === "week" ? "week" : "yesterday", off };
}

export type Recap = { id: FamilySection; title: string; lines: string[] };
type Task = { title: string; done: boolean; completedAt?: string; due?: string };

const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const money = (n: number) => `$${n.toFixed(2)}`;
const mins = (hm: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(hm || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const hours = (n: number) => `${Math.floor(n / 60)}h ${Math.round(n % 60)}m`;

/** The days a recap covers: yesterday, or the 7 days before today. */
export function recapRange(today: string, period: RecapPeriod): { from: string; to: string; label: string } {
  const to = addDays(today, -1);
  return period === "week" ? { from: addDays(today, -7), to, label: "Last 7 days" } : { from: to, to, label: "Yesterday" };
}

/** Every recap for the apps that are on (and whose recap isn't switched off). Apps with nothing to say are left out. */
export function buildRecaps(f: Family, tasks: Task[], today: string, prefs: RecapPrefs = DEFAULT_RECAPS, isOn: (id: FamilySection) => boolean = (id) => f.sections[id] !== false): Recap[] {
  if (!prefs.on) return [];
  const { from, to } = recapRange(today, prefs.period);
  const inRange = (d?: string) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
  const who = (id: string) => f.members.find((m) => m.id === id)?.name || "";
  const out: Recap[] = [];
  const add = (id: FamilySection, title: string, lines: (string | false | 0 | "" | undefined)[]) => {
    if (prefs.off.includes(id) || (id !== "tasks" && !isOn(id))) return;
    const keep = lines.filter((l): l is string => typeof l === "string" && !!l);
    if (keep.length) out.push({ id, title, lines: keep });
  };

  const done = tasks.filter((t) => t.done && inRange(t.completedAt));
  const missed = tasks.filter((t) => !t.done && t.due && t.due >= from && t.due <= to);
  add("tasks", "Tasks", [done.length && `${plural(done.length, "task")} checked off${done.length <= 3 ? `: ${done.map((t) => t.title).join(", ")}` : ""}`, missed.length && `${plural(missed.length, "task")} still open from then`]);

  const chores = (f.choreDone || []).filter((c) => inRange(c.date));
  const byWho = new Map<string, number>(); for (const c of chores) byWho.set(c.memberId, (byWho.get(c.memberId) || 0) + 1);
  add("chores", "Chores", [chores.length && `${plural(chores.length, "chore")} done`, ...[...byWho].map(([m, n]) => who(m) && `${who(m)}: ${n}`)]);

  const events = (f.events || []).filter((e: any) => inRange(e.date));
  add("calendar", "Calendar", [events.length && `${plural(events.length, "event")}${events.length <= 3 ? `: ${events.map((e: any) => e.title).join(", ")}` : ""}`]);

  const habits = (f.habits || []).map((h) => ({ h, n: h.days.filter((d) => inRange(d)).length })).filter((x) => x.n);
  add("habits", "Habits", habits.map(({ h, n }) => `${h.emoji ? `${h.emoji} ` : ""}${h.name}: ${prefs.period === "week" ? `${n} of 7 days` : "done"}`));

  const goals = (f.goals || []).filter((g) => g.done && inRange(g.doneAt));
  add("goals", "Goals", [goals.length && `Reached: ${goals.map((g) => g.title).join(", ")}`]);

  const behavior = (f.behavior || []).filter((b) => inRange(b.date));
  add("behavior", "Behavior", [behavior.length && `${plural(behavior.reduce((a, b) => a + b.points, 0), "point")} across ${plural(behavior.length, "entry", "entries")}`]);

  const doses = (f.pillDoses || []).filter((d) => inRange(d.date));
  const taken = doses.filter((d) => d.status === "taken").length, skipped = doses.length - taken;
  add("pills", "Pills", [doses.length && `${plural(taken, "dose")} taken${skipped ? `, ${skipped} skipped` : ""}`]);

  const moods = (f.moods || []).filter((m) => inRange(m.date));
  add("mood", "Mood", [moods.length && `${plural(moods.length, "check-in")}, average ${avg(moods.map((m) => m.mood)).toFixed(1)} of 5`]);

  const journal = (f.journal || []).filter((j) => inRange(j.date));
  add("journal", "Journal", [journal.length && `${plural(journal.length, "entry", "entries")} written`]);

  const grat = (f.gratitude || []).filter((g) => inRange(g.date));
  add("gratitude", "Gratitude", [grat.length && `${plural(grat.reduce((a, g) => a + g.items.length, 0), "thing")} you were grateful for`]);

  const med = (f.meditations || []).filter((m) => inRange(m.date));
  add("meditate", "Meditate", [med.length && `${plural(med.reduce((a, m) => a + m.minutes, 0), "minute")} of meditation`]);

  const focus = (f.focusLog || []).filter((m) => inRange(m.date));
  add("focus", "Focus", [focus.length && `${plural(focus.reduce((a, m) => a + m.minutes, 0), "minute")} focused`]);

  const sleep = (f.sleep || []).filter((s) => inRange(s.date)).map((s) => { const b = mins(s.bed), w = mins(s.wake); return { len: Number.isFinite(b) && Number.isFinite(w) ? (w - b + 1440) % 1440 : NaN, q: s.quality }; }).filter((s) => Number.isFinite(s.len));
  add("sleep", "Sleep", [sleep.length && `${prefs.period === "week" ? "Average " : ""}${hours(avg(sleep.map((s) => s.len)))} of sleep`]);

  const workouts = (f.workouts || []).filter((w) => inRange(w.date));
  add("workouts", "Workouts", [workouts.length && `${plural(workouts.length, "exercise")} logged${workouts.length <= 3 ? `: ${[...new Set(workouts.map((w) => w.exercise))].join(", ")}` : ""}`]);

  const spent = (f.expenses || []).filter((e) => inRange(e.date));
  add("money", "Money", [spent.length && `${money(spent.reduce((a, e) => a + e.amount, 0))} spent over ${plural(spent.length, "purchase")}`]);

  const meals = (f.meals || []).filter((m) => inRange(m.date));
  add("meals", "Meals", [meals.length && `${plural(meals.length, "meal")} planned`]);

  const miles = (f.mileage || []).filter((m) => inRange(m.date));
  add("mileage", "Mileage", [miles.length && `${miles.reduce((a, m) => a + m.miles, 0).toFixed(1)} miles over ${plural(miles.length, "trip")}`]);

  const allowance = (f.allowance || []).filter((a) => inRange(a.date));
  add("allowance", "Allowance", [allowance.length && `${money(allowance.reduce((a, x) => a + x.amount, 0))} in allowance`]);

  const cycle = (f.cycleLogs || []).filter((c) => inRange(c.date));
  add("cycle", "Cycle", [cycle.length && `${plural(cycle.length, "day")} logged`]);

  return out;
}

/** Which apps can have a recap (for the on/off list in settings). */
export const RECAP_APPS: { id: FamilySection; title: string }[] = [
  { id: "tasks", title: "Tasks" }, { id: "chores", title: "Chores" }, { id: "calendar", title: "Calendar" }, { id: "habits", title: "Habits" },
  { id: "goals", title: "Goals" }, { id: "behavior", title: "Behavior" }, { id: "pills", title: "Pills" }, { id: "mood", title: "Mood" },
  { id: "journal", title: "Journal" }, { id: "gratitude", title: "Gratitude" }, { id: "meditate", title: "Meditate" }, { id: "focus", title: "Focus" },
  { id: "sleep", title: "Sleep" }, { id: "workouts", title: "Workouts" }, { id: "money", title: "Money" }, { id: "meals", title: "Meals" },
  { id: "mileage", title: "Mileage" }, { id: "allowance", title: "Allowance" }, { id: "cycle", title: "Cycle" },
];
