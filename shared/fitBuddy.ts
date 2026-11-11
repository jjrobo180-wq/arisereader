// Cooked: workout buddies. Two people who don't know each other are matched on what they're after, set
// a weekly goal together, and keep each other going: they see each other's weekly count, and can only
// send preset messages. No names, no photos, no typing to each other: an emoji avatar, a made-up gamertag
// and a handful of ready-made messages, so there's nothing to be rude with, nothing to share by accident.
// (Friends you already know use workout circles, shared/fitCircle.ts.) Adults only.
import { cleanFit, type Workout } from "./fit";

export const AVATARS = ["🦊", "🐺", "🦁", "🐯", "🐻", "🐼", "🦅", "🦉", "🐉", "🦄", "🐙", "🦈", "🐢", "🦍", "🐆", "🦬", "🔥", "⚡", "🚀", "🎯", "🏆", "🛡️", "⚔️", "🌟"];
export type Focus = "strength" | "lose" | "consistency" | "cardio";
export const FOCUS: Record<Focus, string> = { strength: "Getting stronger", lose: "Losing weight", consistency: "Staying consistent", cardio: "Cardio and endurance" };
export type Mode = "coop" | "duel";
export const MODE: Record<Mode, { name: string; blurb: string }> = {
  coop: { name: "Team up", blurb: "We both hit our goal each week" },
  duel: { name: "Friendly duel", blurb: "Who trains more this week?" },
};
export const LEVEL = ["", "Just starting", "Some experience", "Experienced"] as const;

export type BuddyProfile = { tag: string; avatar: string; focus: Focus; level: 1 | 2 | 3; perWeek: number; mode: Mode; /** Minutes ahead of UTC. */ tz: number; at: number };
export type Goal = { perWeek: number; mode: Mode };
export type Pair = { buddy: number; since: number; goal: Goal; proposal?: Goal & { by: number } };
export type Msg = { kind: string; from: "them"; at: number };

/** Everything people can say to each other. */
export const PRESETS: { id: string; e: string; text: string }[] = [
  { id: "gg", e: "🎮", text: "GG!" },
  { id: "nice", e: "💪", text: "Nice work!" },
  { id: "letsgo", e: "🔥", text: "Let's train today" },
  { id: "yougot", e: "🙌", text: "You've got this" },
  { id: "checkin", e: "👀", text: "How's your week going?" },
  { id: "rest", e: "😴", text: "Rest day, back tomorrow" },
  { id: "late", e: "⏰", text: "Running late, still training" },
  { id: "beat", e: "😏", text: "Catch me if you can" },
  { id: "proud", e: "🏆", text: "Proud of you" },
  { id: "rematch", e: "🔁", text: "Rematch next week?" },
  { id: "thanks", e: "🙏", text: "Thanks for the push" },
  { id: "busy", e: "🧳", text: "Busy week, back soon" },
];
export const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));
export const REPORT_REASONS = [
  { id: "inappropriate", text: "Inappropriate" },
  { id: "inactive", text: "Never trains or answers" },
  { id: "pressure", text: "Pushy or uncomfortable" },
  { id: "other", text: "Something else" },
] as const;

const ADJ = ["Swift", "Iron", "Steady", "Bold", "Mighty", "Calm", "Fierce", "Lucky", "Sunny", "Brave", "Quick", "Chill", "Nimble", "Rugged", "Bright"];
const NOUN = ["Falcon", "Lifter", "Runner", "Otter", "Panda", "Tiger", "Wolf", "Comet", "Ranger", "Titan", "Sprinter", "Kodiak", "Phoenix", "Badger", "Raven"];
export const makeTag = (rand: () => number = Math.random) => `${ADJ[Math.floor(rand() * ADJ.length)]}${NOUN[Math.floor(rand() * NOUN.length)]}${String(Math.floor(rand() * 90) + 10)}`;

const clamp = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
export function cleanPrefs(raw: any): Omit<BuddyProfile, "tag" | "at"> {
  return {
    avatar: AVATARS.includes(String(raw?.avatar)) ? String(raw.avatar) : AVATARS[0],
    focus: (["strength", "lose", "consistency", "cardio"] as const).includes(raw?.focus) ? raw.focus : "consistency",
    level: clamp(raw?.level, 1, 3, 1) as 1 | 2 | 3,
    perWeek: clamp(raw?.perWeek, 1, 7, 3),
    mode: raw?.mode === "duel" ? "duel" : "coop",
    tz: clamp(raw?.tz, -720, 840, 0),
  };
}

/** Adults only, going by the birth year in their Cooked profile. */
export function adultCheck(profile: { birthYear?: number } | undefined, now = new Date()): { ok: boolean; why: string } {
  const y = Number(profile?.birthYear);
  if (!Number.isFinite(y) || y < 1900) return { ok: false, why: "Add your birth year in Settings first. Workout buddies are for people 18 and over." };
  return now.getFullYear() - y >= 18 ? { ok: true, why: "" } : { ok: false, why: "Workout buddies are for people 18 and over." };
}

/** How well two people fit. Higher is better; null means never (a different time zone far away). */
export function matchScore(a: BuddyProfile, b: BuddyProfile): number | null {
  const tz = Math.abs(a.tz - b.tz) / 60;
  if (tz > 9) return null;
  return (a.focus === b.focus ? 4 : 0) + (a.mode === b.mode ? 2 : 0) - Math.abs(a.perWeek - b.perWeek) * 2 - Math.abs(a.level - b.level) * 2 - Math.round(tz / 3);
}
/** The best waiting person for `me`, if anyone is close enough. */
export function bestMatch<T extends { id: number; p: BuddyProfile }>(me: BuddyProfile, queue: T[]): T | null {
  let best: T | null = null, bestScore = -7;
  for (const q of queue) { const s = matchScore(me, q.p); if (s != null && s > bestScore) { best = q; bestScore = s; } }
  return best;
}
/** The goal two people start with: in between what each asked for. */
export const startingGoal = (a: BuddyProfile, b: BuddyProfile): Goal => ({ perWeek: Math.max(1, Math.round((a.perWeek + b.perWeek) / 2)), mode: a.mode === b.mode ? a.mode : "coop" });

// ——— Weeks ———————————————————————————————————————————————————————————————————
// Weeks run Monday to Sunday in UTC, the same for both people, so a "week" is the same week for both.
const WEEK = 7 * 864e5;
export const weekStart = (t: number) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); return d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5; };
/** Workouts in each of the last `n` weeks (oldest first, this week last). */
export function weeklyCounts(workouts: Pick<Workout, "date" | "exercises">[], now = Date.now(), n = 6): number[] {
  const start = weekStart(now) - (n - 1) * WEEK;
  const out = Array<number>(n).fill(0);
  for (const w of workouts) {
    if (!w.exercises?.length) continue;
    const t = Date.parse(w.date); if (!Number.isFinite(t) || t < start || t >= weekStart(now) + WEEK) continue;
    out[Math.floor((t - start) / WEEK)]++;
  }
  return out;
}
/** Full weeks in a row (before this one) that both met the goal; and a duel record over the weeks both trained. */
export function buddyRecord(mine: number[], theirs: number[], goal: Goal) {
  let streak = 0;
  for (let i = mine.length - 2; i >= 0; i--) { if (mine[i] >= goal.perWeek && theirs[i] >= goal.perWeek) streak++; else break; }
  let won = 0, lost = 0, tied = 0;
  for (let i = 0; i < mine.length - 1; i++) { if (mine[i] === 0 && theirs[i] === 0) continue; if (mine[i] > theirs[i]) won++; else if (mine[i] < theirs[i]) lost++; else tied++; }
  return { streak, won, lost, tied };
}
export const countsFrom = (raw: unknown, now = Date.now(), n = 6) => weeklyCounts(cleanFit(raw).workouts, now, n);
