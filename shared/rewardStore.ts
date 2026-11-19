// The Arise Reader Reward Store: students earn Reward Points by passing library quizzes and cash them in for
// gift cards, food, money (always sent to a parent) or perks their parent sets up (free to you).
//
// The money side is built so the store can't cost more than you decide:
//   - 2,500 Reward Points are worth $1 of what a reward costs you, and every paid reward is priced 20% above that.
//   - Points are only earned, never bought, and only from real quiz passes (the first pass of each book).
//   - A day's earning is capped, points expire a year after they're earned, and each student can cash out at most
//     a set amount of paid rewards a month.
//   - Paid rewards need a parent's OK and go to the parent's email. They're only for students on a paid family plan.
//   - The whole store has a monthly budget: once this month's paid rewards reach it, paid rewards show
//     "Restocking" until next month. A budget of $0 keeps paid rewards closed.
//
// Pure, so it's tested. Server: server/rewardStore.ts.

/** What 1 dollar of reward cost is worth in Reward Points. */
export const POINTS_PER_DOLLAR = 2500;
/** Paid rewards are priced this much above cost (it covers the slack and makes saving feel earned). */
export const MARKUP = 1.2;
/** Reward Points for each book point a passed quiz earns (a 5-point book → 200, a 30-point book → 1,200). */
export const POINTS_PER_BOOK_POINT = 40;
/** A passed Beginners lesson. */
export const POINTS_PER_BEGINNERS_PASS = 100;
/** The most Reward Points one day can earn. */
export const DAILY_CAP = 1500;
/** Points expire this many days after they're earned. */
export const EXPIRE_DAYS = 365;

export type RewardKind = "gift" | "food" | "money" | "perk";
export const REWARD_KINDS: { id: RewardKind; label: string }[] = [
  { id: "gift", label: "Gift cards" }, { id: "food", label: "Food" }, { id: "money", label: "Money" }, { id: "perk", label: "From your family" },
];

/** Something in the store. Paid rewards (gift, food, money) are the admin's; perks are a parent's own. */
export type RewardItem = {
  id: string;
  kind: RewardKind;
  title: string;
  /** What it costs you, in cents (0 for a perk: the parent gives it). */
  costCents: number;
  points: number;
  /** One line under the title. */
  detail: string;
  active: boolean;
  /** Tremendous product id, to send it automatically (left empty, you send it by hand from the admin queue). */
  tremendousProduct?: string;
};

/** The store's settings (the admin's). */
export type StoreConfig = {
  /** Most you'll spend on paid rewards in a month, in cents. 0 keeps paid rewards closed. */
  budgetCents: number;
  /** Most paid rewards one student can cash out in a month, in cents. */
  studentCapCents: number;
  /** Quiz passes from this day on earn points (YYYY-MM-DD). Empty: from the day the store is first saved. */
  startedOn: string;
};
export const DEFAULT_CONFIG: StoreConfig = { budgetCents: 0, studentCapCents: 1000, startedOn: "" };

export type RequestStatus = "waiting" | "approved" | "sent" | "declined" | "canceled";
export type RewardRequest = {
  id: string;
  studentId: number;
  studentName: string;
  itemId: string;
  kind: RewardKind;
  title: string;
  points: number;
  costCents: number;
  /** A perk: the parent who offers it (and gives it). */
  perkParentId?: number;
  status: RequestStatus;
  at: string;
  /** Who said yes or no (a parent), and where a paid reward goes. */
  parentId?: number;
  parentName?: string;
  sendTo?: string;
  decidedAt?: string;
  sentAt?: string;
  /** What was sent (an order number, a note), for the record. */
  note?: string;
};

export const LIMITS = { title: 60, detail: 120, perks: 20, catalog: 40, note: 200, requests: 5000 } as const;

/** What a reward is priced at: its cost in points plus the markup, rounded up to the next 500. */
export function pointsFor(costCents: number): number {
  const raw = (Math.max(0, costCents) / 100) * POINTS_PER_DOLLAR * MARKUP;
  return Math.max(500, Math.ceil(raw / 500) * 500);
}

const item = (id: string, kind: RewardKind, title: string, costCents: number, detail: string): RewardItem => ({ id, kind, title, costCents, points: pointsFor(costCents), detail, active: true });
/** The starting catalog (the admin can change prices, add, hide and remove). */
export const DEFAULT_CATALOG: RewardItem[] = [
  item("amazon-5", "gift", "Amazon gift card · $5", 500, "Sent to your parent's email"),
  item("amazon-10", "gift", "Amazon gift card · $10", 1000, "Sent to your parent's email"),
  item("roblox-10", "gift", "Roblox gift card · $10", 1000, "Sent to your parent's email"),
  item("chickfila-5", "food", "Chick-fil-A · $5", 500, "An e-gift card, sent to your parent's email"),
  item("mcdonalds-5", "food", "McDonald's · $5", 500, "An e-gift card, sent to your parent's email"),
  item("paypal-5", "money", "$5 to your parent's PayPal", 525, "Your parent gets it for you"),
  item("venmo-5", "money", "$5 to your parent's Venmo", 525, "Your parent gets it for you"),
];
/** Ideas a parent can start from (free to give). */
export const PERK_IDEAS: RewardItem[] = [
  { id: "", kind: "perk", title: "30 minutes of extra screen time", costCents: 0, points: 2000, detail: "", active: true },
  { id: "", kind: "perk", title: "Pick what's for dinner", costCents: 0, points: 3000, detail: "", active: true },
  { id: "", kind: "perk", title: "Stay up 30 minutes later", costCents: 0, points: 4000, detail: "", active: true },
  { id: "", kind: "perk", title: "A trip for ice cream", costCents: 0, points: 6000, detail: "", active: true },
];

// ── Cleaning what comes in ──────────────────────────────────────────────────────────────────────────────────────

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number, fb: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb; };
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
const slug = (v: unknown) => str(v, 40).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");

export function cleanConfig(v: unknown): StoreConfig {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    budgetCents: int(o.budgetCents, 0, 10_000_000, DEFAULT_CONFIG.budgetCents),
    studentCapCents: int(o.studentCapCents, 0, 100_000, DEFAULT_CONFIG.studentCapCents),
    startedOn: isDay(o.startedOn) ? o.startedOn : "",
  };
}

/** One catalog item or perk, or null. Perks are always free to you; paid items always have a cost. */
export function cleanItem(v: unknown, perk = false): RewardItem | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const title = str(o.title, LIMITS.title);
  if (!title) return null;
  const kind: RewardKind = perk ? "perk" : o.kind === "food" || o.kind === "money" ? o.kind : "gift";
  const costCents = perk ? 0 : int(o.costCents, 1, 50_000, 0);
  if (!perk && !costCents) return null;
  // A paid reward is never cheaper than its cost in points (so the store can't lose money on one).
  const floor = perk ? 100 : pointsFor(costCents);
  const points = int(o.points, perk ? 100 : floor, 1_000_000, perk ? 1000 : floor);
  const id = slug(o.id) || `${kind}-${Math.random().toString(36).slice(2, 8)}`;
  const tp = str(o.tremendousProduct, 40);
  return { id, kind, title, costCents, points: Math.max(points, floor), detail: str(o.detail, LIMITS.detail), active: o.active !== false, ...(tp && !perk ? { tremendousProduct: tp } : {}) };
}
export function cleanCatalog(v: unknown, perk = false): RewardItem[] {
  const out: RewardItem[] = [];
  for (const x of Array.isArray(v) ? v : []) { const c = cleanItem(x, perk); if (c && !out.some((y) => y.id === c.id)) out.push(c); }
  return out.slice(0, perk ? LIMITS.perks : LIMITS.catalog);
}

// ── Earning and spending ────────────────────────────────────────────────────────────────────────────────────────

/** A quiz attempt as the server has it. */
export type AttemptLike = { bookId: number; pointsEarned: number; completedAt: string };
export type Earning = { day: string; points: number; what: string };

const dayOf = (iso: string) => (typeof iso === "string" ? iso.slice(0, 10) : "");
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Every Reward Point a student has earned, by day: the first pass of each library book (its book points × 40)
 * and each Beginners lesson pass (100), from the store's start day, with each day capped.
 */
export function earnings(attempts: AttemptLike[], beginnersPasses: number[], startedOn: string, titleOf: (bookId: number) => string = () => "a book"): Earning[] {
  const firstPass = new Map<number, AttemptLike>();
  for (const a of [...attempts].sort((x, y) => String(x.completedAt).localeCompare(String(y.completedAt)))) {
    if (!(a.pointsEarned > 0) || !isDay(dayOf(a.completedAt)) || firstPass.has(a.bookId)) continue;
    firstPass.set(a.bookId, a);
  }
  const raw: Earning[] = [];
  for (const a of firstPass.values()) {
    const day = dayOf(a.completedAt);
    if (startedOn && day < startedOn) continue;
    raw.push({ day, points: Math.round(a.pointsEarned * POINTS_PER_BOOK_POINT), what: `Passed the quiz for ${titleOf(a.bookId)}` });
  }
  for (const t of beginnersPasses) {
    if (!Number.isFinite(t)) continue;
    const day = new Date(t).toISOString().slice(0, 10);
    if (startedOn && day < startedOn) continue;
    raw.push({ day, points: POINTS_PER_BEGINNERS_PASS, what: "Passed a Beginners lesson" });
  }
  // The day's cap: what's over it isn't earned.
  raw.sort((a, b) => a.day.localeCompare(b.day));
  const used = new Map<string, number>();
  const out: Earning[] = [];
  for (const e of raw) {
    const room = DAILY_CAP - (used.get(e.day) ?? 0);
    if (room <= 0) continue;
    const p = Math.min(room, e.points);
    used.set(e.day, (used.get(e.day) ?? 0) + p);
    out.push({ ...e, points: p });
  }
  return out;
}

/** Holds points: everything asked for that wasn't turned down or taken back. */
export const holdsPoints = (r: RewardRequest) => r.status !== "declined" && r.status !== "canceled";
/** Counts against the budget and the student's cap: a paid reward that wasn't turned down or taken back. */
export const costsMoney = (r: RewardRequest) => r.costCents > 0 && holdsPoints(r);

/** The balance: points earned in the last year, less what's been cashed out in that time (never below 0). */
export function balanceOf(earned: Earning[], requests: RewardRequest[], today: string): { balance: number; earned: number; spent: number; expiring: number } {
  const from = addDays(today, -EXPIRE_DAYS);
  const live = earned.filter((e) => e.day > from);
  const sum = live.reduce((a, e) => a + e.points, 0);
  const spent = requests.filter((r) => holdsPoints(r) && dayOf(r.at) > from).reduce((a, r) => a + r.points, 0);
  // Earned 11 months ago or more: gone within a month unless spent.
  const soon = addDays(from, 30);
  const expiring = Math.max(0, Math.min(sum - spent, live.filter((e) => e.day <= soon).reduce((a, e) => a + e.points, 0)));
  return { balance: Math.max(0, sum - spent), earned: sum, spent, expiring };
}

export const monthOf = (iso: string) => String(iso || "").slice(0, 7);

/** This month's paid rewards, in cents: the whole store's, and one student's. */
export function monthSpend(requests: RewardRequest[], month: string, studentId?: number): number {
  return requests.filter((r) => costsMoney(r) && monthOf(r.at) === month && (studentId == null || r.studentId === studentId)).reduce((a, r) => a + r.costCents, 0);
}

export type Availability = { ok: true } | { ok: false; why: "points" | "restocking" | "closed" | "cap" | "plan" | "parent" | "hidden" };
/** Can this student cash this in right now? */
export function canRedeem(x: { item: RewardItem; balance: number; config: StoreConfig; requests: RewardRequest[]; studentId: number; month: string; paidPlan: boolean; hasParent: boolean }): Availability {
  const { item: it } = x;
  if (!it.active) return { ok: false, why: "hidden" };
  if (it.costCents > 0) {
    if (!x.hasParent) return { ok: false, why: "parent" };
    if (!x.paidPlan) return { ok: false, why: "plan" };
    if (x.config.budgetCents <= 0) return { ok: false, why: "closed" };
    if (monthSpend(x.requests, x.month) + it.costCents > x.config.budgetCents) return { ok: false, why: "restocking" };
    if (monthSpend(x.requests, x.month, x.studentId) + it.costCents > x.config.studentCapCents) return { ok: false, why: "cap" };
  }
  if (x.balance < it.points) return { ok: false, why: "points" };
  return { ok: true };
}

export const WHY_WORDS: Record<Exclude<Availability, { ok: true }>["why"], string> = {
  points: "Keep reading",
  restocking: "Restocking: back next month",
  closed: "Coming soon",
  cap: "Monthly limit reached",
  plan: "Needs a family plan",
  parent: "Link a parent first",
  hidden: "Not available",
};

/** How far a student is from a reward, in words ("2,300 more points"). */
export const pointsWords = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString("en-US")} point${Math.round(n) === 1 ? "" : "s"}`;

/** A quick money summary for the admin: this month's paid rewards, what's left of the budget, and what's waiting. */
export function storeSummary(requests: RewardRequest[], config: StoreConfig, month: string) {
  const spent = monthSpend(requests, month);
  return {
    spentCents: spent,
    leftCents: Math.max(0, config.budgetCents - spent),
    toSend: requests.filter((r) => r.status === "approved" && r.costCents > 0).length,
    waitingParent: requests.filter((r) => r.status === "waiting").length,
  };
}
