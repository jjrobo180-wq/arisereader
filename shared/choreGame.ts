// What makes the Chores plugin rewarding (client/src/components/family-hub/Chores.tsx): XP and levels, the day
// streak, badges, how fresh each room is, and the "instead of scrolling" quick session. All of it is worked out
// from the chores and their done list (shared/familyHub.ts), so it's the same on every device and nothing extra
// is saved. Kind by design: a day with nothing due never breaks a streak, and nothing is taken away for a
// missed day.
import { addDays, choreDueOn, daysBetween, fromDay, type Chore, type ChoreDone } from "./familyHub";
import { choreInterval } from "./choreCatalog";

type Data = { chores: Chore[]; choreDone: ChoreDone[] };

/** XP for one chore done: 10, plus a point for each minute it takes (up to 100). */
export const xpFor = (c: Pick<Chore, "mins"> | undefined) => Math.min(100, 10 + Math.max(0, Math.round(c?.mins || 0)));

const doneFor = (d: Data, memberId?: string) => (memberId ? d.choreDone.filter((x) => x.memberId === memberId) : d.choreDone);

export function totalXp(d: Data, memberId?: string): number {
  const byId = new Map(d.chores.map((c) => [c.id, c]));
  return doneFor(d, memberId).reduce((s, x) => s + xpFor(byId.get(x.choreId)), 0);
}

export const LEVEL_TITLES = ["Fresh Start", "Tidy Rookie", "Clean Streaker", "Home Keeper", "Order Builder", "Sparkle Pro", "Home Hero", "Calm Master", "House Legend", "Domestic Icon"];
/** XP needed to go from level n to n+1: 100, 150, 200… */
const stepFor = (level: number) => 100 + (level - 1) * 50;
export function levelOf(xp: number): { level: number; title: string; into: number; need: number; next: number } {
  let level = 1, rest = Math.max(0, xp);
  while (rest >= stepFor(level) && level < 999) { rest -= stepFor(level); level += 1; }
  return { level, title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3))], into: rest, need: stepFor(level), next: stepFor(level) - rest };
}

const countOn = (d: Data, date: string, memberId?: string) => doneFor(d, memberId).filter((x) => x.date === date).length;
const anyDue = (d: Data, date: string) => d.chores.some((c) => choreDueOn(c, date, d.choreDone));

/**
 * Days in a row with at least one chore done. Today counts once something's done; until then the streak from
 * yesterday is still alive. Days with nothing due are skipped, never broken.
 */
export function streak(d: Data, today: string, memberId?: string): { days: number; aliveToday: boolean } {
  const aliveToday = countOn(d, today, memberId) > 0;
  let days = aliveToday ? 1 : 0;
  for (let i = 1; i < 1000; i++) {
    const date = addDays(today, -i);
    if (countOn(d, date, memberId) > 0) days += 1;
    else if (anyDue(d, date)) break;
    else if (!d.choreDone.some((x) => x.date < date)) break;
  }
  return { days, aliveToday };
}

/** The longest streak in the last year or so. */
export function bestStreak(d: Data, today: string, memberId?: string): number {
  const dates = new Set(doneFor(d, memberId).map((x) => x.date));
  if (!dates.size) return 0;
  let best = 0, run = 0;
  for (let i = 400; i >= 0; i--) {
    const date = addDays(today, -i);
    if (dates.has(date)) { run += 1; best = Math.max(best, run); } else if (anyDue(d, date)) run = 0;
  }
  return best;
}

/** Every chore due that day was done (and at least one was due). */
export function perfectDay(d: Data, date: string): boolean {
  const due = d.chores.filter((c) => choreDueOn(c, date, d.choreDone));
  return due.length > 0 && due.every((c) => d.choreDone.some((x) => x.choreId === c.id && x.date === date));
}

export const lastDone = (d: Data, choreId: string) => d.choreDone.reduce((m, x) => (x.choreId === choreId && x.date > m ? x.date : m), "");

/** How fresh a chore is: 1 when it's been done within its usual gap, sliding to 0 as it goes overdue. */
export function freshness(d: Data, c: Chore, today: string): number {
  const since = daysBetween(lastDone(d, c.id) || c.start || today, today), gap = Math.max(1, choreInterval(c));
  if (since <= gap) return 1;
  return Math.max(0, 1 - (since - gap) / (gap * 1.5));
}

/** Each room or area's freshness (the average of its chores), stalest first. */
export function rooms(d: Data, today: string): { cat: string; fresh: number; chores: number; stale: Chore[] }[] {
  const groups = new Map<string, Chore[]>();
  for (const c of d.chores) { const k = c.cat || "other"; groups.set(k, [...(groups.get(k) || []), c]); }
  return [...groups].map(([cat, list]) => {
    const scores = list.map((c) => freshness(d, c, today));
    return { cat, fresh: scores.reduce((s, x) => s + x, 0) / scores.length, chores: list.length, stale: list.filter((_, i) => scores[i] < 1) };
  }).sort((a, b) => a.fresh - b.fresh);
}

/** The whole home's freshness, 0–100. */
export const homeScore = (d: Data, today: string) => (d.chores.length ? Math.round((d.chores.reduce((s, c) => s + freshness(d, c, today), 0) / d.chores.length) * 100) : 100);

/** Chores done on each of the last 7 days, oldest first. */
export const lastWeek = (d: Data, today: string, memberId?: string) =>
  Array.from({ length: 7 }, (_, i) => { const date = addDays(today, i - 6); return { date, count: countOn(d, date, memberId) }; });

/**
 * The quick session: today's chores still to do (then anything overdue), quickest and stalest first, that fit in
 * the minutes chosen. Always at least one chore when there's anything to do.
 */
export function quickQueue(d: Data, today: string, minutes: number): Chore[] {
  const doneToday = new Set(d.choreDone.filter((x) => x.date === today).map((x) => x.choreId));
  const due = d.chores.filter((c) => choreDueOn(c, today, d.choreDone) && !doneToday.has(c.id));
  const stale = d.chores.filter((c) => !due.includes(c) && !doneToday.has(c.id) && freshness(d, c, today) < 1);
  const rank = (c: Chore) => freshness(d, c, today) * 2 + (c.mins || 10) / 30;
  const pool = [...due.sort((a, b) => rank(a) - rank(b)), ...stale.sort((a, b) => rank(a) - rank(b))];
  const out: Chore[] = [];
  let left = minutes;
  for (const c of pool) {
    const m = c.mins || 10;
    if (m <= left || !out.length) { out.push(c); left -= m; }
    if (left <= 0) break;
  }
  return out;
}

export type Badge = { id: string; name: string; emoji: string; blurb: string; have: number; goal: number; earned: boolean };

/** Every badge, earned or with how close it is. */
export function badges(d: Data, today: string, memberId?: string): Badge[] {
  const done = doneFor(d, memberId);
  const byId = new Map(d.chores.map((c) => [c.id, c]));
  const n = done.length;
  const mins = done.reduce((s, x) => s + (byId.get(x.choreId)?.mins || 10), 0);
  const cats = new Set(done.map((x) => byId.get(x.choreId)?.cat).filter(Boolean));
  const quick = done.filter((x) => (byId.get(x.choreId)?.mins || 10) <= 5).length;
  const big = done.filter((x) => { const c = byId.get(x.choreId); return c && (c.unit === "month" || (c.mins || 0) >= 30); }).length;
  const weekend = done.filter((x) => [0, 6].includes(fromDay(x.date).getDay())).length;
  const best = Math.max(bestStreak(d, today, memberId), streak(d, today, memberId).days);
  const dates = [...new Set(done.map((x) => x.date))];
  const perfect = dates.filter((date) => perfectDay(d, date)).length;
  const lvl = levelOf(totalXp(d, memberId)).level;
  const b = (id: string, name: string, emoji: string, blurb: string, have: number, goal: number): Badge => ({ id, name, emoji, blurb, have: Math.min(have, goal), goal, earned: have >= goal });
  return [
    b("first", "First Step", "👣", "Finish your first chore.", n, 1),
    b("ten", "Getting Into It", "🔟", "Finish 10 chores.", n, 10),
    b("fifty", "Momentum", "🚀", "Finish 50 chores.", n, 50),
    b("hundred", "Century", "💯", "Finish 100 chores.", n, 100),
    b("fivehundred", "Unstoppable", "🏔️", "Finish 500 chores.", n, 500),
    b("thousand", "Legendary Home", "👑", "Finish 1,000 chores.", n, 1000),
    b("streak3", "On a Roll", "🔥", "A 3-day streak.", best, 3),
    b("streak7", "Week Warrior", "⚔️", "A 7-day streak.", best, 7),
    b("streak30", "Habit Formed", "🧠", "A 30-day streak.", best, 30),
    b("streak100", "Iron Will", "🛡️", "A 100-day streak.", best, 100),
    b("perfect1", "Clean Sweep", "🧹", "Do every chore due in a day.", perfect, 1),
    b("perfect10", "Perfectionist", "💎", "10 days with every chore done.", perfect, 10),
    b("perfect50", "Flawless", "🌟", "50 days with every chore done.", perfect, 50),
    b("rooms3", "Room Hopper", "🚪", "Do chores in 3 different areas.", cats.size, 3),
    b("rooms8", "Whole Home", "🏡", "Do chores in 8 different areas.", cats.size, 8),
    b("quick25", "Quick Hands", "⚡", "25 chores of 5 minutes or less.", quick, 25),
    b("big10", "Heavy Lifter", "🏋️", "10 big jobs (monthly, or 30 minutes and up).", big, 10),
    b("hours10", "Ten Hours In", "⏳", "10 hours of chores done.", Math.floor(mins / 60), 10),
    b("hours50", "Dedicated", "🕰️", "50 hours of chores done.", Math.floor(mins / 60), 50),
    b("weekend20", "Weekend Warrior", "🎉", "20 chores done on weekends.", weekend, 20),
    b("level5", "Level 5", "🥉", "Reach level 5.", lvl, 5),
    b("level10", "Level 10", "🥈", "Reach level 10.", lvl, 10),
    b("level25", "Level 25", "🥇", "Reach level 25.", lvl, 25),
  ];
}

/** Minutes of chores still to do today. */
export const minutesLeft = (d: Data, today: string) =>
  d.chores.filter((c) => choreDueOn(c, today, d.choreDone) && !d.choreDone.some((x) => x.choreId === c.id && x.date === today)).reduce((s, c) => s + (c.mins || 10), 0);
