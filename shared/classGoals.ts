// Class Goal Board: a goal the whole class works toward (behavior, academics, whatever the teacher
// picks), a reward at the end (a pizza party, extra recess), and the points that get it there.
// One teacher keeps a small set of goals; one of them is shown on the classroom board.
//
// Everything that changes a goal is an "operation" (see Op). The same function, applyOp, runs in the
// browser (so a tap shows at once) and on the server (so the saved copy is the one every device
// agrees on), and an operation that arrives twice (a retry after a bad connection) counts once.
// The page is client/src/pages/ClassGoalBoard.tsx; the saving is server/classGoals.ts.

export const MAX_GOALS = 30;
export const MAX_ENTRIES = 400;          // log lines kept per goal; older ones fold into `base`
export const FOLD_OLDEST = 100;
export const MAX_CATEGORIES = 8;
export const MAX_TARGET = 10_000;
export const MAX_ADD = 500;
const APPLIED_KEPT = 80;

export type Category = { id: string; name: string; emoji: string; color: string };
export type Entry = { id: string; at: string; amount: number; categoryId: string; /** the name when it was added, if the category is later removed */ category: string; reason: string };
export type Reward = { name: string; emoji: string; /** "Friday after lunch" */ note: string };
export type Goal = {
  id: string;
  /** What the class is working on, in the teacher's words: "Quiet halls and finished homework". */
  title: string;
  /** Which class this is for, if the teacher has more than one: "Period 3". */
  className: string;
  reward: Reward;
  target: number;
  /** YYYY-MM-DD, or "" for no date. */
  startsOn: string;
  endsOn: string;
  categories: Category[];
  entries: Entry[];
  /** Points folded out of old log lines, by category id. */
  base: Record<string, number>;
  createdAt: string;
  /** When the teacher gave the reward ("" until then). */
  givenAt: string;
};
export type ClassGoals = { v: 1; rev: number; goals: Goal[]; boardId: string; applied: string[] };

export type GoalInput = Partial<{ title: string; className: string; reward: Partial<Reward>; target: number; startsOn: string; endsOn: string; categories: Array<Partial<Category>> }>;
export type Op = { opId: string; at: string } & (
  | { type: "goal.add"; id: string; goal: GoalInput }
  | { type: "goal.update"; id: string; patch: GoalInput }
  | { type: "goal.delete"; id: string }
  | { type: "points.add"; goalId: string; entryId: string; amount: number; categoryId: string; reason: string }
  | { type: "points.remove"; goalId: string; entryId: string }
  | { type: "board.set"; goalId: string }
  | { type: "reward.given"; goalId: string; given: boolean }
);

export const emptyClassGoals = (): ClassGoals => ({ v: 1, rev: 0, goals: [], boardId: "", applied: [] });

// ── What teachers pick from ──────────────────────────────────────────────────────────────────────

export const REWARD_IDEAS: Array<{ name: string; emoji: string }> = [
  { name: "Pizza party", emoji: "🍕" }, { name: "Ice cream party", emoji: "🍦" }, { name: "Popcorn and a movie", emoji: "🍿" },
  { name: "Extra recess", emoji: "🛝" }, { name: "Dance party", emoji: "🪩" }, { name: "Game time", emoji: "🎮" },
  { name: "Pajama day", emoji: "🧸" }, { name: "Donut breakfast", emoji: "🍩" }, { name: "Class picnic", emoji: "🧺" },
  { name: "Free choice time", emoji: "🎨" }, { name: "Homework pass", emoji: "🎟️" }, { name: "Sit where you like", emoji: "🛋️" },
  { name: "Cookie party", emoji: "🍪" }, { name: "Outdoor class", emoji: "🌳" }, { name: "Movie afternoon", emoji: "🎬" },
  { name: "Treasure box", emoji: "🏆" },
];

export const CATEGORY_COLORS = ["#FFC933", "#35D0A0", "#7B8CFF", "#FF6B57", "#FF8FC7", "#4FC3F7", "#B58CFF", "#9BE15D"] as const;
export const DEFAULT_CATEGORIES: Array<Omit<Category, "id">> = [
  { name: "Behavior", emoji: "🌟", color: CATEGORY_COLORS[0] },
  { name: "Academics", emoji: "📚", color: CATEGORY_COLORS[1] },
];
export const EXTRA_CATEGORY_IDEAS: Array<Omit<Category, "id">> = [
  { name: "Teamwork", emoji: "🤝", color: CATEGORY_COLORS[2] },
  { name: "Kindness", emoji: "💛", color: CATEGORY_COLORS[3] },
  { name: "Effort", emoji: "💪", color: CATEGORY_COLORS[4] },
  { name: "Hallway", emoji: "🚶", color: CATEGORY_COLORS[5] },
];
export const REASON_IDEAS: Record<string, string[]> = {
  behavior: ["Quiet in the hallway", "Ready to learn", "Kind words", "Great transition", "Cleaned up together"],
  academics: ["Everyone turned in homework", "Great discussion", "Quiz success", "Stayed on task", "Helped each other learn"],
  other: ["Great teamwork", "Respectful listening", "Doing the right thing"],
};
export const AMOUNTS = [1, 2, 5, 10] as const;

// ── Cleaning ─────────────────────────────────────────────────────────────────────────────────────

export const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{4,48}$/.test(v);
/** Category ids are short ("c1", "c2") for the starter ones, so they may be shorter than other ids. */
export const isCategoryId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,48}$/.test(v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const wholeNumber = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
export const isDay = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const day = (v: unknown) => (isDay(v) ? v : "");
const isoOr = (v: unknown, fallback: string) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : fallback);
const color = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback);

export function cleanCategories(input: unknown, existing: Category[] = []): Category[] {
  const list = Array.isArray(input) ? input : [];
  const out: Category[] = [];
  const used = new Set<string>();
  for (const raw of list.slice(0, MAX_CATEGORIES)) {
    const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Category>;
    const name = text(c.name, 24);
    if (!name) continue;
    let id = isCategoryId(c.id) && !used.has(c.id) ? c.id : "";
    if (!id) { let n = out.length + 1; while (used.has(`c${n}`) || existing.some((e) => e.id === `c${n}` && e.name !== name)) n++; id = `c${n}`; }
    used.add(id);
    out.push({ id, name, emoji: text(c.emoji, 8) || "⭐", color: color(c.color, CATEGORY_COLORS[out.length % CATEGORY_COLORS.length]) });
  }
  return out.length ? out : DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: `c${i + 1}` }));
}

function cleanDates(startsOn: string, endsOn: string): { startsOn: string; endsOn: string } {
  return endsOn && startsOn && endsOn < startsOn ? { startsOn, endsOn: startsOn } : { startsOn, endsOn };
}

/** A goal built from whatever the page sent: every field limited, nothing missing. */
export function cleanGoal(id: string, input: GoalInput, at: string, previous?: Goal): Goal {
  const p = previous;
  const reward = { ...(p?.reward ?? { name: "", emoji: "🎉", note: "" }), ...(input.reward ?? {}) };
  const dates = cleanDates(
    input.startsOn !== undefined ? day(input.startsOn) : p?.startsOn ?? "",
    input.endsOn !== undefined ? day(input.endsOn) : p?.endsOn ?? "",
  );
  return {
    id,
    title: input.title !== undefined ? text(input.title, 80) : p?.title ?? "",
    className: input.className !== undefined ? text(input.className, 40) : p?.className ?? "",
    reward: { name: text(reward.name, 50) || "Class reward", emoji: text(reward.emoji, 8) || "🎉", note: text(reward.note, 80) },
    target: input.target !== undefined ? wholeNumber(input.target, 1, MAX_TARGET, p?.target ?? 50) : p?.target ?? 50,
    ...dates,
    categories: input.categories !== undefined ? cleanCategories(input.categories, p?.categories) : p?.categories ?? cleanCategories(undefined),
    entries: p?.entries ?? [],
    base: p?.base ?? {},
    createdAt: p?.createdAt ?? at,
    givenAt: p?.givenAt ?? "",
  };
}

function cleanEntry(raw: any): Entry | null {
  if (!raw || typeof raw !== "object" || !isId(raw.id)) return null;
  const n = Number(raw.amount);
  if (!Number.isFinite(n) || n < 1) return null;
  const amount = wholeNumber(n, 1, MAX_ADD, 0);
  return { id: raw.id, at: isoOr(raw.at, new Date(0).toISOString()), amount, categoryId: isCategoryId(raw.categoryId) ? raw.categoryId : "", category: text(raw.category, 24), reason: text(raw.reason, 80) };
}

/** Whatever was saved, made safe to use. */
export function cleanClassGoals(raw: unknown): ClassGoals {
  let value: any = raw;
  if (typeof raw === "string") { try { value = JSON.parse(raw); } catch { return emptyClassGoals(); } }
  if (!value || typeof value !== "object") return emptyClassGoals();
  const seen = new Set<string>();
  const goals: Goal[] = [];
  for (const g of (Array.isArray(value.goals) ? value.goals : []).slice(0, MAX_GOALS)) {
    if (!g || typeof g !== "object" || !isId(g.id) || seen.has(g.id)) continue;
    seen.add(g.id);
    const base = cleanGoal(g.id, g, isoOr(g.createdAt, new Date(0).toISOString()));
    const ids = new Set<string>();
    const entries = (Array.isArray(g.entries) ? g.entries : []).map(cleanEntry).filter((e: Entry | null): e is Entry => !!e && !ids.has(e.id) && !!ids.add(e.id)).slice(-MAX_ENTRIES);
    const folded: Record<string, number> = {};
    if (g.base && typeof g.base === "object") for (const [k, v] of Object.entries(g.base)) if (isCategoryId(k)) folded[k] = wholeNumber(v, 0, 1_000_000, 0);
    goals.push({ ...base, entries, base: folded, givenAt: isoOr(g.givenAt, "") || "" });
  }
  const boardId = typeof value.boardId === "string" && goals.some((g) => g.id === value.boardId) ? value.boardId : "";
  const applied = (Array.isArray(value.applied) ? value.applied : []).filter(isId).slice(-APPLIED_KEPT);
  return { v: 1, rev: wholeNumber(value.rev, 0, Number.MAX_SAFE_INTEGER, 0), goals, boardId, applied };
}

// ── Reading a goal ───────────────────────────────────────────────────────────────────────────────

export type CategoryTotal = Category & { points: number };
export function totalsOf(goal: Goal): { points: number; byCategory: CategoryTotal[] } {
  const sums = new Map<string, number>();
  for (const [k, v] of Object.entries(goal.base)) sums.set(k, (sums.get(k) || 0) + v);
  const names = new Map<string, string>();
  for (const e of goal.entries) { sums.set(e.categoryId, (sums.get(e.categoryId) || 0) + e.amount); if (e.category) names.set(e.categoryId, e.category); }
  const byCategory: CategoryTotal[] = goal.categories.map((c) => ({ ...c, points: sums.get(c.id) || 0 }));
  let other = 0;
  for (const [k, v] of Array.from(sums)) if (!goal.categories.some((c) => c.id === k)) other += v;
  if (other) byCategory.push({ id: "other", name: "Other", emoji: "⭐", color: "#C7CBE6", points: other });
  return { points: byCategory.reduce((s, c) => s + c.points, 0), byCategory };
}

export type Phase = "upcoming" | "active" | "reached" | "given" | "ended";
export function phaseOf(goal: Goal, today: string): Phase {
  if (goal.givenAt) return "given";
  if (totalsOf(goal).points >= goal.target) return "reached";
  if (goal.endsOn && today > goal.endsOn) return "ended";
  if (goal.startsOn && today < goal.startsOn) return "upcoming";
  return "active";
}

export function progressOf(goal: Goal) {
  const { points, byCategory } = totalsOf(goal);
  const pct = Math.min(100, Math.floor((points / goal.target) * 100));
  return { points, target: goal.target, pct, remaining: Math.max(0, goal.target - points), byCategory };
}

export const MILESTONES = [25, 50, 75, 100] as const;
export const milestonesOf = (goal: Goal) => { const { points } = totalsOf(goal); return MILESTONES.map((m) => ({ pct: m, at: Math.ceil((goal.target * m) / 100), reached: points >= Math.ceil((goal.target * m) / 100) })); };

const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 86_400_000);
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);
/** Whole days from today to the last day: 0 on the last day, negative once it has passed, null with no end date. */
export const daysLeft = (goal: Goal, today: string): number | null => (goal.endsOn ? daysBetween(today, goal.endsOn) : null);
export function leftLabel(goal: Goal, today: string): string {
  const d = daysLeft(goal, today);
  if (d === null) return "";
  if (d < 0) return "Time's up";
  if (d === 0) return "Last day!";
  return d === 1 ? "1 day left" : `${d} days left`;
}

/** Monday-to-Friday days from `from` to `to`, both counted (0 when `to` is before `from`). */
export function schoolDays(from: string, to: string): number {
  if (!isDay(from) || !isDay(to) || to < from) return 0;
  let n = 0;
  const d = new Date(`${from}T12:00:00Z`);
  for (let i = 0, last = daysBetween(from, to); i <= last && i < 4000; i++) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; d.setUTCDate(d.getUTCDate() + 1); }
  return n;
}

/** Points per school day still needed, for the teacher (never shown on the board). */
export function paceOf(goal: Goal, today: string): { needPerDay: number; haveEnough: boolean } | null {
  const d = daysLeft(goal, today);
  const { remaining } = progressOf(goal);
  if (d === null || d < 0) return null;
  if (!remaining) return { needPerDay: 0, haveEnough: true };
  const days = Math.max(1, d + 1);
  return { needPerDay: Math.ceil(remaining / days), haveEnough: false };
}

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return ymd(d); };

export type WindowPreset = "week" | "two-weeks" | "month" | "none";
/** The dates for a quick choice, counted from `today` (a YYYY-MM-DD). */
export function windowFor(preset: WindowPreset, today: string): { startsOn: string; endsOn: string } {
  if (preset === "none") return { startsOn: today, endsOn: "" };
  if (preset === "two-weeks") return { startsOn: today, endsOn: addDays(today, 13) };
  if (preset === "month") {
    const d = new Date(`${today}T12:00:00`);
    return { startsOn: today, endsOn: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }
  // This week: through Friday; on a weekend, through next Friday.
  const dow = new Date(`${today}T12:00:00`).getDay();
  const toFriday = dow === 6 ? 6 : dow === 0 ? 5 : 5 - dow;
  return { startsOn: today, endsOn: addDays(today, toFriday) };
}

export const newGoalInput = (today: string, preset: WindowPreset = "week"): GoalInput => ({
  title: "", className: "", reward: { ...REWARD_IDEAS[0], note: "" }, target: 50, ...windowFor(preset, today),
  categories: DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: `c${i + 1}` })),
});

// ── Changing it ──────────────────────────────────────────────────────────────────────────────────

function foldOld(goal: Goal): Goal {
  if (goal.entries.length <= MAX_ENTRIES) return goal;
  const old = goal.entries.slice(0, FOLD_OLDEST);
  const base = { ...goal.base };
  for (const e of old) base[e.categoryId] = (base[e.categoryId] || 0) + e.amount;
  return { ...goal, entries: goal.entries.slice(FOLD_OLDEST), base };
}

/**
 * The goals after one change. Returns the same object when nothing changed (a repeat of an operation
 * already applied, or one that doesn't make sense), so callers can tell.
 */
export function applyOp(state: ClassGoals, op: Op): ClassGoals {
  if (!op || !isId(op.opId) || state.applied.includes(op.opId)) return state;
  const at = isoOr(op.at, new Date().toISOString());
  const done = (next: Omit<ClassGoals, "v" | "rev" | "applied">): ClassGoals => {
    const goals = next.goals;
    const boardId = goals.some((g) => g.id === next.boardId) ? next.boardId : "";
    return { v: 1, rev: state.rev + 1, goals, boardId, applied: [...state.applied, op.opId].slice(-APPLIED_KEPT) };
  };
  const find = (id: unknown) => (isId(id) ? state.goals.find((g) => g.id === id) : undefined);
  const replace = (g: Goal) => state.goals.map((x) => (x.id === g.id ? g : x));

  switch (op.type) {
    case "goal.add": {
      if (!isId(op.id) || state.goals.length >= MAX_GOALS || find(op.id)) return state;
      const goal = cleanGoal(op.id, op.goal || {}, at);
      return done({ goals: [...state.goals, goal], boardId: state.boardId || goal.id });
    }
    case "goal.update": {
      const g = find(op.id);
      if (!g) return state;
      return done({ goals: replace({ ...cleanGoal(g.id, op.patch || {}, at, g) }), boardId: state.boardId });
    }
    case "goal.delete": {
      if (!find(op.id)) return state;
      const goals = state.goals.filter((g) => g.id !== op.id);
      return done({ goals, boardId: state.boardId === op.id ? goals[0]?.id ?? "" : state.boardId });
    }
    case "points.add": {
      const g = find(op.goalId);
      const asked = Number(op.amount);
      const amount = Number.isFinite(asked) && asked >= 1 ? wholeNumber(asked, 1, MAX_ADD, 0) : 0;
      if (!g || !amount || !isId(op.entryId) || g.entries.some((e) => e.id === op.entryId)) return state;
      const cat = g.categories.find((c) => c.id === op.categoryId) ?? g.categories[0];
      const entry: Entry = { id: op.entryId, at, amount, categoryId: cat.id, category: cat.name, reason: text(op.reason, 80) };
      return done({ goals: replace(foldOld({ ...g, entries: [...g.entries, entry] })), boardId: state.boardId });
    }
    case "points.remove": {
      const g = find(op.goalId);
      if (!g || !g.entries.some((e) => e.id === op.entryId)) return state;
      return done({ goals: replace({ ...g, entries: g.entries.filter((e) => e.id !== op.entryId) }), boardId: state.boardId });
    }
    case "board.set": {
      if (!find(op.goalId)) return state;
      return done({ goals: state.goals, boardId: op.goalId });
    }
    case "reward.given": {
      const g = find(op.goalId);
      if (!g) return state;
      return done({ goals: replace({ ...g, givenAt: op.given ? at : "" }), boardId: state.boardId });
    }
    default:
      return state;
  }
}

/** The goals with a list of not-yet-saved operations laid over them. */
export const applyAll = (state: ClassGoals, ops: Op[]): ClassGoals => ops.reduce(applyOp, state);
