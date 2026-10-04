// Prizes that parents, teachers and schools put up for their own readers.
//
// A.R.I.S.E. gives no prizes itself. A parent adds a prize for their child
// (Free plan). A teacher adds one for their class or their whole school
// (Premium). The reader sees them next to the leaderboards and rewards.
import { blockedWord } from "./study/sets";

export const PRIZE_LIMITS = {
  title: 60,
  how: 200,
  /** The most quizzes a prize can ask for. */
  quizGoal: 200,
  perFamily: 12,
  perClass: 20,
  perSchool: 40,
  /** One teacher can put up this many prizes for the whole school at once. */
  perTeacherAtSchool: 8,
  /** A prize stays on the reader's page this many days after it ends or is given. */
  showDaysAfter: 14,
  /** How far ahead an end date can be. */
  maxDaysAhead: 400,
} as const;

export type PrizeScope = "family" | "class" | "school";

export type PrizeWinner = {
  /** null means everyone the prize was for. */
  studentId: number | null;
  name: string;
  at: string;
  /** The site's day it was given (YYYY-MM-DD). */
  day?: string;
};

export type Prize = {
  id: string;
  scope: PrizeScope;
  /** The parent's id, the teacher's id, or the school's id. */
  ownerId: number;
  /** The person who added it. */
  byId: number;
  byName: string;
  title: string;
  /** How to win it, in the giver's words. */
  how: string;
  /** Library quizzes to pass after the prize was added. 0 means the giver decides. */
  quizGoal: number;
  /** Last day to win it (YYYY-MM-DD), or null for no end date. */
  endsOn: string | null;
  /** Family prizes: which children. null means all of the parent's children. */
  studentIds: number[] | null;
  createdAt: string;
  won: PrizeWinner | null;
};

export type PrizeDraft = Pick<Prize, "scope" | "title" | "how" | "quizGoal" | "endsOn" | "studentIds">;

/** What a reader sees. */
export type PrizeView = {
  id: string;
  scope: PrizeScope;
  /** The giver's name: "Dana", "Ms. Rivera". */
  by: string;
  /** The giver and, for a school prize, the school: "Ms. Rivera at Cedar Grove Middle". */
  from: string;
  title: string;
  how: string;
  quizGoal: number;
  /** Quizzes this reader has passed toward the goal, when there is one. */
  passed: number | null;
  endsOn: string | null;
  /**
   * open: still to be won. reached: this reader hit the quiz goal.
   * ended: the last day has passed and it has not been given yet.
   * yours: this reader won it. won: someone else did.
   */
  state: "open" | "reached" | "ended" | "yours" | "won";
  winner: string | null;
};

export class PrizeError extends Error {}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Characters that take up no space on screen. Left in, "s\u200Bhit" would get past the word check and still read as the word.
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g;
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\t\n\r]/g, " ").replace(INVISIBLE, "").replace(/\s+/g, " ").trim().slice(0, max);

/** A real calendar day written as YYYY-MM-DD. */
export function validDay(day: unknown): day is string {
  if (typeof day !== "string" || !DAY_RE.test(day)) return false;
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === day;
}
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function prizeId(scope: PrizeScope, ownerId: number, unique: string): string {
  return `${scope[0]}${ownerId}-${unique}`;
}
/** Which list a prize id belongs to. */
export function parsePrizeId(id: unknown): { scope: PrizeScope; ownerId: number } | null {
  const m = /^([fcs])(\d{1,12})-[a-z0-9]{6,40}$/.exec(String(id || ""));
  if (!m) return null;
  const ownerId = Number(m[2]);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) return null;
  return { scope: m[1] === "f" ? "family" : m[1] === "c" ? "class" : "school", ownerId };
}

/**
 * Checks what a parent or teacher typed. `today` is the site's day (YYYY-MM-DD).
 * A parent's prize is always a family prize; a teacher picks class or school.
 */
export function normalizePrizeDraft(input: unknown, who: "parent" | "teacher", today: string): PrizeDraft {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const scope: PrizeScope = who === "parent" ? "family" : raw.scope === "school" ? "school" : "class";

  const title = clean(raw.title, PRIZE_LIMITS.title);
  if (title.length < 2) throw new PrizeError("Give the prize a name, like “Pizza night”.");
  const how = clean(raw.how, PRIZE_LIMITS.how);

  const goal = raw.quizGoal === undefined || raw.quizGoal === null || raw.quizGoal === "" ? 0 : Number(raw.quizGoal);
  if (!Number.isInteger(goal) || goal < 0 || goal > PRIZE_LIMITS.quizGoal) {
    throw new PrizeError(`The number of quizzes has to be a whole number from 1 to ${PRIZE_LIMITS.quizGoal}.`);
  }
  if (!how && !goal) throw new PrizeError("Say how to win it, or pick a number of quizzes to pass.");

  const bad = blockedWord(`${title} ${how}`);
  if (bad) throw new PrizeError(`Please pick different words. “${bad}” can't be used here.`);

  let endsOn: string | null = null;
  if (raw.endsOn !== undefined && raw.endsOn !== null && raw.endsOn !== "") {
    if (!validDay(raw.endsOn)) throw new PrizeError("Pick the last day from the calendar.");
    if (raw.endsOn < today) throw new PrizeError("The last day can't be in the past.");
    if (raw.endsOn > addDays(today, PRIZE_LIMITS.maxDaysAhead)) throw new PrizeError("Pick a last day within the next year.");
    endsOn = raw.endsOn;
  }

  let studentIds: number[] | null = null;
  if (scope === "family" && Array.isArray(raw.studentIds) && raw.studentIds.length) {
    const ids = Array.from(new Set(raw.studentIds.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0)));
    if (!ids.length) throw new PrizeError("Pick which child the prize is for.");
    studentIds = ids;
  }
  return { scope, title, how, quizGoal: goal, endsOn, studentIds };
}

/** The day a prize was given, or "" when the record doesn't say. */
export function givenDay(won: PrizeWinner): string {
  const day = won.day || String(won.at || "").slice(0, 10);
  return validDay(day) ? day : "";
}

/** Has the last day passed? */
export const prizeEnded = (prize: Pick<Prize, "endsOn">, today: string) => !!prize.endsOn && today > prize.endsOn;

/** Should a reader still see this prize? It drops off a while after it ends or is given. */
export function prizeShown(prize: Pick<Prize, "endsOn" | "won">, today: string): boolean {
  if (prize.won) {
    const wonDay = givenDay(prize.won);
    return !wonDay || today <= addDays(wonDay, PRIZE_LIMITS.showDaysAfter);
  }
  return !prize.endsOn || today <= addDays(prize.endsOn, PRIZE_LIMITS.showDaysAfter);
}

/** Is this family prize for this child? */
export const prizeCovers = (prize: Pick<Prize, "studentIds">, studentId: number) => !prize.studentIds || prize.studentIds.includes(studentId);

/**
 * How many of these passed quizzes count toward the prize: the ones passed
 * after it was added and no later than its last day. `dayOf` turns a time into
 * the site's day.
 */
export function quizzesToward(prize: Pick<Prize, "createdAt" | "endsOn">, passedAt: number[], dayOf: (ms: number) => string): number {
  const from = Date.parse(prize.createdAt);
  if (!Number.isFinite(from)) return 0;
  return passedAt.filter((t) => Number.isFinite(t) && t >= from && (!prize.endsOn || dayOf(t) <= prize.endsOn)).length;
}

/** The reader's view of one prize. */
export function viewPrize(prize: Prize, me: number, from: string, passed: number | null, today: string): PrizeView {
  const won = prize.won;
  const mine = !!won && (won.studentId === null || won.studentId === me);
  const count = prize.quizGoal > 0 ? Math.max(0, passed ?? 0) : null;
  const state: PrizeView["state"] = won
    ? (mine ? "yours" : "won")
    : prize.quizGoal > 0 && (count ?? 0) >= prize.quizGoal
      ? "reached"
      : prizeEnded(prize, today) ? "ended" : "open";
  return {
    id: prize.id, scope: prize.scope, by: prize.byName, from, title: prize.title, how: prize.how,
    quizGoal: prize.quizGoal, passed: count, endsOn: prize.endsOn, state,
    winner: won ? won.name : null,
  };
}

/** "Oct 31" style, for a YYYY-MM-DD day. */
export function prettyDay(day: string | null | undefined): string {
  if (!day || !validDay(day)) return "";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
