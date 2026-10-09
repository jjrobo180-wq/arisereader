// A.R.I.S.E. To-Do · Family Hub: everything a household keeps beside its to-do lists.
// One sanitizer (cleanFamily) is shared by the page and the server, so whatever is stored
// always has the same safe shape, and old workspaces without family data simply get an empty hub.

export const FAMILY_SECTIONS = ["home", "tasks", "chores", "calendar", "behavior", "health", "polls", "trips", "money", "notes", "family"] as const;
export type FamilySection = typeof FAMILY_SECTIONS[number];
/** Sections that can be switched off. Home, Tasks and Family members always show. */
export const TOGGLEABLE: readonly FamilySection[] = ["chores", "calendar", "behavior", "health", "polls", "trips", "money", "notes"];

export type Member = { id: string; name: string; emoji: string; color: string; kind: "adult" | "kid" };
export type Chore = { id: string; title: string; memberId: string; rotation: string[]; days: number[]; points: number };
export type ChoreDone = { id: string; choreId: string; date: string; memberId: string; points: number };
export type BehaviorEntry = { id: string; memberId: string; date: string; points: number; note: string };
export type Reward = { id: string; title: string; cost: number };
export type Redemption = { id: string; memberId: string; title: string; cost: number; date: string };
export type FamilyCalendar = { id: string; name: string; color: string; show: boolean };
export type EventRepeat = "none" | "weekly" | "monthly" | "yearly";
export type FamilyEvent = {
  id: string; title: string; date: string; time: string; endTime: string; calendarId: string;
  memberIds: string[]; location: string; notes: string; repeat: EventRepeat;
};
export type TripStop = { id: string; date: string; time: string; title: string; cost: number };
export type PackItem = { id: string; item: string; memberId: string; packed: boolean };
export type Trip = {
  id: string; name: string; destination: string; start: string; end: string; budget: number;
  notes: string; stops: TripStop[]; packing: PackItem[];
};
export type PollKind = "dinner" | "weekend" | "other";
export type Poll = {
  id: string; question: string; kind: PollKind; options: { id: string; label: string }[];
  votes: Record<string, string>; closed: boolean; createdAt: string; closesOn: string;
};
export type Bill = { id: string; name: string; amount: number; dueDay: number; category: string; autopay: boolean; paid: string[] };
export type BudgetCategory = { id: string; name: string; limit: number };
export type Expense = { id: string; categoryId: string; amount: number; date: string; note: string };
export type Note = { id: string; title: string; body: string; color: string; pinned: boolean; updatedAt: string };
/* Food & fitness. Adults get calories, macros and weight; kids get healthy habits only. */
export type Meal = "breakfast" | "lunch" | "dinner" | "snacks";
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snacks"];
export type FoodEntry = { id: string; memberId: string; date: string; meal: Meal; name: string; servings: number; calories: number; protein: number; carbs: number; fat: number };
export type ExerciseEntry = { id: string; memberId: string; date: string; name: string; minutes: number; calories: number };
export type DayEntry = { id: string; memberId: string; date: string; water: number; steps: number; fruitVeg: number };
export type WeightEntry = { id: string; memberId: string; date: string; weight: number };
export type SavedFood = { id: string; name: string; serving: string; calories: number; protein: number; carbs: number; fat: number };
export type HealthGoals = { calories: number; proteinPct: number; carbsPct: number; fatPct: number; water: number; steps: number; goalWeight: number; activeMinutes: number; fruitVeg: number };
export type Health = { goals: Record<string, HealthGoals>; food: FoodEntry[]; exercise: ExerciseEntry[]; days: DayEntry[]; weights: WeightEntry[]; foods: SavedFood[] };
export const emptyHealth = (): Health => ({ goals: {}, food: [], exercise: [], days: [], weights: [], foods: [] });

export type Layers = { tasks: boolean; bills: boolean; trips: boolean; chores: boolean };

export type Family = {
  members: Member[];
  sections: Partial<Record<FamilySection, boolean>>;
  layers: Layers;
  chorePointsCount: boolean;
  chores: Chore[];
  choreDone: ChoreDone[];
  behavior: BehaviorEntry[];
  rewards: Reward[];
  redemptions: Redemption[];
  calendars: FamilyCalendar[];
  events: FamilyEvent[];
  trips: Trip[];
  polls: Poll[];
  bills: Bill[];
  budget: BudgetCategory[];
  expenses: Expense[];
  income: number;
  notes: Note[];
  health: Health;
};

export const MEMBER_COLORS = ["#7566e8", "#f59e72", "#36b6a5", "#619ee6", "#db77ac", "#e5b04f", "#5fb35b", "#e0645a"];
export const NOTE_COLORS = ["#fff7d6", "#e9f7ef", "#e8f1fd", "#fde8ef", "#f1ecff", "#ffffff"];

export const DEFAULT_CALENDARS: FamilyCalendar[] = [
  { id: "family", name: "Family", color: "#7566e8", show: true },
  { id: "school", name: "School", color: "#619ee6", show: true },
  { id: "activities", name: "Sports & activities", color: "#36b6a5", show: true },
  { id: "appointments", name: "Appointments", color: "#f59e72", show: true },
];
export const DEFAULT_REWARDS: Reward[] = [
  { id: "r-screen", title: "30 min extra screen time", cost: 10 },
  { id: "r-dessert", title: "Pick dessert", cost: 15 },
  { id: "r-movie", title: "Choose family movie", cost: 20 },
  { id: "r-outing", title: "Special outing", cost: 50 },
];
export const DEFAULT_BUDGET: BudgetCategory[] = [
  { id: "b-groceries", name: "Groceries", limit: 0 },
  { id: "b-dining", name: "Eating out", limit: 0 },
  { id: "b-kids", name: "Kids & school", limit: 0 },
  { id: "b-fun", name: "Fun & activities", limit: 0 },
  { id: "b-gas", name: "Gas & transport", limit: 0 },
];

export const emptyFamily = (): Family => ({
  members: [], sections: {}, layers: { tasks: true, bills: true, trips: true, chores: false }, chorePointsCount: true,
  chores: [], choreDone: [], behavior: [], rewards: DEFAULT_REWARDS.map((r) => ({ ...r })), redemptions: [],
  calendars: DEFAULT_CALENDARS.map((c) => ({ ...c })), events: [], trips: [], polls: [],
  bills: [], budget: DEFAULT_BUDGET.map((b) => ({ ...b })), expenses: [], income: 0, notes: [], health: emptyHealth(),
});

/* ---------------- sanitizing ---------------- */
const obj = (v: unknown): Record<string, any> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : null);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, min: number, max: number, fallback = 0) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : fallback;
};
const int = (v: unknown, min: number, max: number, fallback = 0) => Math.round(num(v, min, max, fallback));
const bool = (v: unknown, fallback = false) => (typeof v === "boolean" ? v : fallback);
export const isDay = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const day = (v: unknown) => (isDay(v) ? v : "");
const clock = (v: unknown) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "");
const color = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const id = (v: unknown) => str(v, 100);
/** Keeps up to `max` rows that clean up with an id, without repeating an id: the first ones,
 *  or for logs (`newest`) the most recent ones, since logs grow at the end. */
function rows<T extends { id: string }>(v: unknown, max: number, clean: (row: Record<string, any>) => T | null, newest = false): T[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const raw of newest ? v.slice(-max * 2) : v) {
    if (!newest && out.length >= max) break;
    const r = obj(raw);
    const row = r && clean(r);
    if (!row || !row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return newest ? out.slice(-max) : out;
}

export const LIMITS = { members: 20, chores: 300, choreDone: 8000, behavior: 8000, rewards: 60, redemptions: 3000, calendars: 30, events: 3000, trips: 100, polls: 300, bills: 200, budget: 60, expenses: 8000, notes: 1000, food: 12000, exercise: 6000, days: 8000, weights: 3000, foods: 500 };

export function cleanFamily(input: unknown): Family {
  const raw = obj(input);
  if (!raw) return emptyFamily();
  const base = emptyFamily();
  const members = rows(raw.members, LIMITS.members, (r) => {
    const name = str(r.name, 40).trim();
    return name ? { id: id(r.id), name, emoji: str(r.emoji, 8), color: color(r.color, MEMBER_COLORS[0]), kind: oneOf(r.kind, ["adult", "kid"] as const, "kid") } : null;
  });
  const sections: Partial<Record<FamilySection, boolean>> = {};
  const rawSections = obj(raw.sections) || {};
  for (const key of TOGGLEABLE) if (typeof rawSections[key] === "boolean") sections[key] = rawSections[key];
  const rawLayers = obj(raw.layers) || {};
  const layers: Layers = {
    tasks: bool(rawLayers.tasks, true), bills: bool(rawLayers.bills, true), trips: bool(rawLayers.trips, true), chores: bool(rawLayers.chores, false),
  };
  const ids = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && x && x.length <= 100))].slice(0, max) as string[] : []);
  const calendars = Array.isArray(raw.calendars)
    ? rows(raw.calendars, LIMITS.calendars, (r) => {
      const name = str(r.name, 40).trim();
      return name ? { id: id(r.id), name, color: color(r.color, "#7566e8"), show: bool(r.show, true) } : null;
    })
    : base.calendars;
  const budget = Array.isArray(raw.budget)
    ? rows(raw.budget, LIMITS.budget, (r) => {
      const name = str(r.name, 40).trim();
      return name ? { id: id(r.id), name, limit: num(r.limit, 0, 10_000_000) } : null;
    })
    : base.budget;
  return {
    members,
    sections,
    layers,
    chorePointsCount: bool(raw.chorePointsCount, true),
    chores: rows(raw.chores, LIMITS.chores, (r) => {
      const title = str(r.title, 120).trim();
      const days = Array.isArray(r.days) ? [...new Set(r.days.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort() as number[] : [];
      return title ? { id: id(r.id), title, memberId: id(r.memberId), rotation: ids(r.rotation, LIMITS.members), days, points: int(r.points, 0, 100, 1) } : null;
    }),
    choreDone: rows(raw.choreDone, LIMITS.choreDone, (r) => {
      const date = day(r.date);
      return date && r.choreId ? { id: id(r.id), choreId: id(r.choreId), date, memberId: id(r.memberId), points: int(r.points, 0, 100) } : null;
    }, true),
    behavior: rows(raw.behavior, LIMITS.behavior, (r) => {
      const date = day(r.date);
      return date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), date, points: int(r.points, -100, 100), note: str(r.note, 200) } : null;
    }, true),
    rewards: Array.isArray(raw.rewards)
      ? rows(raw.rewards, LIMITS.rewards, (r) => {
        const title = str(r.title, 80).trim();
        return title ? { id: id(r.id), title, cost: int(r.cost, 1, 10_000, 10) } : null;
      })
      : base.rewards,
    redemptions: rows(raw.redemptions, LIMITS.redemptions, (r) => {
      const date = day(r.date);
      return date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), title: str(r.title, 80), cost: int(r.cost, 0, 10_000), date } : null;
    }, true),
    calendars,
    events: rows(raw.events, LIMITS.events, (r) => {
      const title = str(r.title, 120).trim();
      const date = day(r.date);
      return title && date ? {
        id: id(r.id), title, date, time: clock(r.time), endTime: clock(r.endTime), calendarId: id(r.calendarId),
        memberIds: ids(r.memberIds, LIMITS.members), location: str(r.location, 160), notes: str(r.notes, 1000),
        repeat: oneOf(r.repeat, ["none", "weekly", "monthly", "yearly"] as const, "none"),
      } : null;
    }),
    trips: rows(raw.trips, LIMITS.trips, (r) => {
      const name = str(r.name, 100).trim();
      return name ? {
        id: id(r.id), name, destination: str(r.destination, 120), start: day(r.start), end: day(r.end),
        budget: num(r.budget, 0, 10_000_000), notes: str(r.notes, 3000),
        stops: rows(r.stops, 300, (s) => {
          const title = str(s.title, 160).trim();
          return title ? { id: id(s.id), date: day(s.date), time: clock(s.time), title, cost: num(s.cost, 0, 10_000_000) } : null;
        }),
        packing: rows(r.packing, 400, (p) => {
          const item = str(p.item, 100).trim();
          return item ? { id: id(p.id), item, memberId: id(p.memberId), packed: bool(p.packed) } : null;
        }),
      } : null;
    }),
    polls: rows(raw.polls, LIMITS.polls, (r) => {
      const question = str(r.question, 160).trim();
      const options = rows(r.options, 20, (o) => {
        const label = str(o.label, 100).trim();
        return label ? { id: id(o.id), label } : null;
      });
      const optionIds = new Set(options.map((o) => o.id));
      const votes: Record<string, string> = {};
      const rawVotes = obj(r.votes) || {};
      for (const [voter, choice] of Object.entries(rawVotes).slice(0, LIMITS.members)) {
        if (voter.length <= 100 && typeof choice === "string" && optionIds.has(choice)) votes[voter] = choice;
      }
      return question && options.length ? {
        id: id(r.id), question, kind: oneOf(r.kind, ["dinner", "weekend", "other"] as const, "other"), options, votes,
        closed: bool(r.closed), createdAt: str(r.createdAt, 40), closesOn: day(r.closesOn),
      } : null;
    }),
    bills: rows(raw.bills, LIMITS.bills, (r) => {
      const name = str(r.name, 80).trim();
      const paid = Array.isArray(r.paid) ? [...new Set(r.paid.filter((m: unknown) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)))].slice(-120) as string[] : [];
      return name ? { id: id(r.id), name, amount: num(r.amount, 0, 10_000_000), dueDay: int(r.dueDay, 1, 31, 1), category: str(r.category, 40), autopay: bool(r.autopay), paid } : null;
    }),
    budget,
    expenses: rows(raw.expenses, LIMITS.expenses, (r) => {
      const date = day(r.date);
      return date ? { id: id(r.id), categoryId: id(r.categoryId), amount: num(r.amount, 0, 10_000_000), date, note: str(r.note, 120) } : null;
    }, true),
    income: num(raw.income, 0, 100_000_000),
    notes: rows(raw.notes, LIMITS.notes, (r) => {
      const title = str(r.title, 120);
      const body = str(r.body, 5000);
      return title.trim() || body.trim() ? { id: id(r.id), title, body, color: color(r.color, NOTE_COLORS[0]), pinned: bool(r.pinned), updatedAt: str(r.updatedAt, 40) } : null;
    }),
    health: cleanHealth(raw.health),
  };
}

export function cleanHealth(input: unknown): Health {
  const raw = obj(input);
  if (!raw) return emptyHealth();
  const goals: Record<string, HealthGoals> = {};
  for (const [memberId, g] of Object.entries(obj(raw.goals) || {}).slice(0, LIMITS.members)) {
    const r = obj(g);
    if (!r || !memberId || memberId.length > 100) continue;
    goals[memberId] = {
      calories: int(r.calories, 0, 10000, 2000), proteinPct: int(r.proteinPct, 0, 100, 20), carbsPct: int(r.carbsPct, 0, 100, 50), fatPct: int(r.fatPct, 0, 100, 30),
      water: int(r.water, 0, 40, 8), steps: int(r.steps, 0, 100000, 8000), goalWeight: num(r.goalWeight, 0, 1500), activeMinutes: int(r.activeMinutes, 0, 600, 60), fruitVeg: int(r.fruitVeg, 0, 20, 5),
    };
  }
  const nutrition = (r: Record<string, any>) => ({ calories: num(r.calories, 0, 20000), protein: num(r.protein, 0, 2000), carbs: num(r.carbs, 0, 2000), fat: num(r.fat, 0, 2000) });
  return {
    goals,
    food: rows(raw.food, LIMITS.food, (r) => {
      const name = str(r.name, 100).trim();
      const date = day(r.date);
      return name && date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), date, meal: oneOf(r.meal, MEALS, "snacks"), name, servings: num(r.servings, 0.01, 100, 1), ...nutrition(r) } : null;
    }, true),
    exercise: rows(raw.exercise, LIMITS.exercise, (r) => {
      const name = str(r.name, 80).trim();
      const date = day(r.date);
      return name && date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), date, name, minutes: int(r.minutes, 0, 1440), calories: int(r.calories, 0, 10000) } : null;
    }, true),
    days: rows(raw.days, LIMITS.days, (r) => {
      const date = day(r.date);
      return date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), date, water: int(r.water, 0, 40), steps: int(r.steps, 0, 200000), fruitVeg: int(r.fruitVeg, 0, 30) } : null;
    }, true),
    weights: rows(raw.weights, LIMITS.weights, (r) => {
      const date = day(r.date);
      const weight = num(r.weight, 0, 1500);
      return date && r.memberId && weight > 0 ? { id: id(r.id), memberId: id(r.memberId), date, weight } : null;
    }, true),
    foods: rows(raw.foods, LIMITS.foods, (r) => {
      const name = str(r.name, 100).trim();
      return name ? { id: id(r.id), name, serving: str(r.serving, 60), ...nutrition(r) } : null;
    }),
  };
}

/* ---------------- dates ---------------- */
export const toDay = (d: Date) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
export const fromDay = (s: string) => new Date(`${s}T12:00:00`);
export const addDays = (s: string, n: number) => { const d = fromDay(s); d.setDate(d.getDate() + n); return toDay(d); };
export const weekStart = (s: string) => addDays(s, -fromDay(s).getDay());
export const monthKey = (s: string) => s.slice(0, 7);
export const daysBetween = (a: string, b: string) => Math.round((fromDay(b).getTime() - fromDay(a).getTime()) / 86_400_000);
export const isOn = (section: FamilySection, f: Family) => !TOGGLEABLE.includes(section) || f.sections[section] !== false;

/** Whether an event (or one of its repeats) falls on a day. */
export function occursOn(e: FamilyEvent, date: string): boolean {
  if (!isDay(date) || date < e.date) return false;
  if (date === e.date) return true;
  const a = fromDay(e.date), b = fromDay(date);
  if (e.repeat === "weekly") return a.getDay() === b.getDay();
  if (e.repeat === "monthly") {
    const last = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
    return b.getDate() === Math.min(a.getDate(), last);
  }
  if (e.repeat === "yearly") return a.getMonth() === b.getMonth() && (a.getDate() === b.getDate() || (a.getMonth() === 1 && a.getDate() === 29 && b.getDate() === 28 && new Date(b.getFullYear(), 1, 29).getMonth() !== 1));
  return false;
}
export const eventsOn = (f: Family, date: string, all = false) => {
  const shown = new Set(f.calendars.filter((c) => c.show).map((c) => c.id));
  return f.events.filter((e) => (all || shown.has(e.calendarId) || !f.calendars.some((c) => c.id === e.calendarId)) && occursOn(e, date))
    .sort((x, y) => (x.time || "99").localeCompare(y.time || "99"));
};

/* ---------------- chores ---------------- */
/** Who does a chore on a given day: its rotation turns over each week (Sunday), otherwise its one owner. */
export function choreOwner(c: Chore, date: string): string {
  if (!c.rotation.length) return c.memberId;
  const weeks = Math.floor(daysBetween("2024-01-07", weekStart(date)) / 7);
  return c.rotation[((weeks % c.rotation.length) + c.rotation.length) % c.rotation.length];
}
export const choreDueOn = (c: Chore, date: string) => !c.days.length || c.days.includes(fromDay(date).getDay());
export const choreDoneOn = (f: Family, choreId: string, date: string) => f.choreDone.find((d) => d.choreId === choreId && d.date === date);
export function toggleChore(f: Family, c: Chore, date: string, makeId: () => string): Family {
  const done = choreDoneOn(f, c.id, date);
  if (done) return { ...f, choreDone: f.choreDone.filter((d) => d.id !== done.id) };
  const entry = { id: makeId(), choreId: c.id, date, memberId: choreOwner(c, date), points: c.points };
  return { ...f, choreDone: [...f.choreDone, entry].slice(-LIMITS.choreDone) };
}

/* ---------------- rewards ---------------- */
export function starBalance(f: Family, memberId: string) {
  const behavior = f.behavior.filter((b) => b.memberId === memberId).reduce((s, b) => s + b.points, 0);
  const chores = f.chorePointsCount ? f.choreDone.filter((d) => d.memberId === memberId).reduce((s, d) => s + d.points, 0) : 0;
  const spent = f.redemptions.filter((r) => r.memberId === memberId).reduce((s, r) => s + r.cost, 0);
  return { behavior, chores, spent, balance: behavior + chores - spent };
}

/* ---------------- polls ---------------- */
export function tally(p: Poll) {
  const counts = new Map(p.options.map((o) => [o.id, 0]));
  for (const choice of Object.values(p.votes)) counts.set(choice, (counts.get(choice) || 0) + 1);
  const ranked = p.options.map((o) => ({ ...o, votes: counts.get(o.id) || 0 })).sort((a, b) => b.votes - a.votes);
  const top = ranked[0]?.votes || 0;
  return { ranked, total: Object.keys(p.votes).length, leaders: top ? ranked.filter((o) => o.votes === top) : [] };
}
export const POLL_TEMPLATES: Record<PollKind, { question: string; options: string[] }> = {
  dinner: { question: "What's for dinner?", options: ["Tacos", "Pasta", "Pizza night", "Breakfast for dinner", "Stir-fry"] },
  weekend: { question: "What should we do this weekend?", options: ["Park or hike", "Movie night", "Board games", "Visit family", "Bike ride"] },
  other: { question: "", options: ["", ""] },
};

/* ---------------- money ---------------- */
/** A bill's due date in a month ("2026-02" + day 31 → 2026-02-28). */
export function billDue(b: Bill, month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(b.dueDay, last)).padStart(2, "0")}`;
}
export function billState(b: Bill, month: string, today: string): "paid" | "late" | "soon" | "later" {
  if (b.paid.includes(month)) return "paid";
  const due = billDue(b, month);
  if (due < today) return "late";
  return daysBetween(today, due) <= 7 ? "soon" : "later";
}
export function monthSummary(f: Family, month: string) {
  const billsTotal = f.bills.reduce((s, b) => s + b.amount, 0);
  const billsPaid = f.bills.filter((b) => b.paid.includes(month)).reduce((s, b) => s + b.amount, 0);
  const spent = f.expenses.filter((e) => monthKey(e.date) === month).reduce((s, e) => s + e.amount, 0);
  const budgeted = f.budget.reduce((s, c) => s + c.limit, 0);
  return { billsTotal, billsPaid, billsLeft: billsTotal - billsPaid, spent, budgeted, leftover: f.income - billsTotal - spent };
}
export const spentIn = (f: Family, categoryId: string, month: string) =>
  f.expenses.filter((e) => e.categoryId === categoryId && monthKey(e.date) === month).reduce((s, e) => s + e.amount, 0);
export const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
