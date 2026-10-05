// The admin Stats tab: sign-ups and growth, sign-ins, visits, quizzes, points and reading
// checks, counted by day in the school's time zone.
//
// Visits: the app used to know only when someone signed in, and a sign-in lasts for weeks,
// so a student who used the app every day looked like they came once. The presence tracker
// notes the first and last time each person used the app each day (at most one save every
// half minute, stored in settings as activity_day_YYYY-MM-DD, so no new table is needed).
import type { Express, RequestHandler } from "express";
import {
  ONLINE_WINDOW_MS, QUIET_AFTER_DAYS, STATS_TIME_ZONE, isStatsRange,
  type AdminStats, type StatsBucket, type StatsDelta, type StatsPerson, type StatsRange, type StatsRole,
} from "../shared/adminStats";

const DAY_MS = 86_400_000;
export const ACTIVITY_KEY_PREFIX = "activity_day_";

export const isDemoUsername = (username: unknown) => {
  const u = String(username || "").toLowerCase();
  return u.startsWith("sample") || u === "tutorial-eye" || u === "admin-preview";
};

// ─── Dates in the school's time zone ─────────────────────────────────────────

const formatters = new Map<string, Intl.DateTimeFormat>();
const zoneMemo = new Map<string, { day: string; hour: number }>();

/** The local calendar day (YYYY-MM-DD) and hour (0-23) of a moment. */
export function zoneParts(ms: number, timeZone = STATS_TIME_ZONE): { day: string; hour: number } {
  // Time zones in use change their offset only on the hour, so one lookup covers a whole UTC hour.
  const memoKey = `${timeZone}|${Math.floor(ms / 3_600_000)}`;
  const hit = zoneMemo.get(memoKey);
  if (hit) return hit;
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
    formatters.set(timeZone, f);
  }
  const parts: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) parts[p.type] = p.value;
  const out = { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
  if (zoneMemo.size > 20_000) zoneMemo.clear();
  zoneMemo.set(memoKey, out);
  return out;
}
export const dayKey = (ms: number, timeZone = STATS_TIME_ZONE) => zoneParts(ms, timeZone).day;

const dayIndex = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
const fromIndex = (i: number) => new Date(i * DAY_MS).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => fromIndex(dayIndex(day) + n);
export const daysBetween = (a: string, b: string) => dayIndex(b) - dayIndex(a);
/** Monday = 0 … Sunday = 6. */
export const weekdayOf = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
export const weekStart = (day: string) => addDays(day, -weekdayOf(day));

// ─── Presence: who used the app, and when, each day ──────────────────────────

type DayMap = Record<string, [number, number]>;

export function parseActivityDay(raw: string | null | undefined): DayMap {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: DayMap = {};
    for (const [id, pair] of Object.entries(v)) {
      if (Array.isArray(pair) && pair.length === 2 && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))) {
        out[id] = [Number(pair[0]), Number(pair[1])];
      }
    }
    return out;
  } catch {
    return {};
  }
}

export type PresenceUser = { id?: unknown; isAdmin?: unknown; role?: unknown; username?: unknown };

export type PresenceDeps = {
  /** Must throw when the database can't be read, so a day's visits are never overwritten with nothing. */
  readSetting: (key: string) => Promise<string>;
  upsertSetting: (key: string, value: string) => Promise<void>;
  now?: () => number;
  timeZone?: string;
  /** How often one person's visit is noted again (default 5 minutes). */
  throttleMs?: number;
  /** How long changes wait before they're saved together (default 30 seconds). */
  flushDelayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  log?: (message: string) => void;
};

export function createPresenceTracker(deps: PresenceDeps) {
  const now = deps.now ?? Date.now;
  const tz = deps.timeZone ?? STATS_TIME_ZONE;
  const throttle = deps.throttleMs ?? 5 * 60_000;
  const flushDelay = deps.flushDelayMs ?? 30_000;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => { const t = setTimeout(fn, ms); (t as any).unref?.(); return t; });
  const log = deps.log ?? ((m: string) => console.error(m));

  let pending = new Map<string, Map<number, [number, number]>>();
  const noted = new Map<number, number>(); // last moment saved (or queued) for each person
  const seen = new Map<number, number>(); // last moment heard from each person, for "online now"
  let timer: unknown = null;
  let chain: Promise<void> = Promise.resolve();

  const merge = (into: Map<number, [number, number]>, id: number, first: number, last: number) => {
    const cur = into.get(id);
    into.set(id, cur ? [Math.min(cur[0], first), Math.max(cur[1], last)] : [first, last]);
  };
  const schedule = () => {
    if (timer) return;
    timer = setTimer(() => { timer = null; void flush(); }, flushDelay);
  };

  /** Notes that someone used the app. Cheap enough to call on every request; never throws. */
  function touch(user: PresenceUser | null | undefined) {
    try {
      const id = Number(user?.id);
      if (!Number.isSafeInteger(id) || id < 1 || user?.isAdmin === true || user?.role === "admin" || isDemoUsername(user?.username)) return;
      const t = now();
      seen.set(id, t);
      const prev = noted.get(id);
      const day = dayKey(t, tz);
      if (prev !== undefined && t - prev < throttle && dayKey(prev, tz) === day) return;
      noted.set(id, t);
      let m = pending.get(day);
      if (!m) pending.set(day, (m = new Map()));
      merge(m, id, t, t);
      schedule();
    } catch {
      /* noting a visit must never break a request */
    }
  }

  /** Saves everything noted so far. Saves run one at a time; a failed save is retried later. */
  function flush(): Promise<void> {
    chain = chain.then(async () => {
      const batch = pending;
      pending = new Map();
      for (const [day, entries] of batch) {
        const key = ACTIVITY_KEY_PREFIX + day;
        try {
          const stored = parseActivityDay(await deps.readSetting(key));
          for (const [id, [first, last]] of entries) {
            const cur = stored[String(id)];
            stored[String(id)] = cur ? [Math.min(cur[0], first), Math.max(cur[1], last)] : [first, last];
          }
          await deps.upsertSetting(key, JSON.stringify(stored));
        } catch (e: any) {
          let m = pending.get(day);
          if (!m) pending.set(day, (m = new Map()));
          for (const [id, [first, last]] of entries) merge(m, id, first, last);
          log(`[stats] could not save visits for ${day}: ${e?.message || e}`);
          schedule();
        }
      }
    });
    return chain;
  }

  /** Visits noted but not saved yet, by day. */
  function unsaved(): Record<string, DayMap> {
    const out: Record<string, DayMap> = {};
    for (const [day, entries] of pending) {
      out[day] = {};
      for (const [id, pair] of entries) out[day][String(id)] = [pair[0], pair[1]];
    }
    return out;
  }

  /** When each person was last heard from by this server. */
  function lastSeen(): Map<number, number> {
    return new Map(seen);
  }

  return { touch, flush, unsaved, lastSeen };
}
export type PresenceTracker = ReturnType<typeof createPresenceTracker>;

// ─── Building the numbers ────────────────────────────────────────────────────

export type StatsInput = {
  users: { id: number; username: string; displayName: string; role: string; isAdmin: boolean; createdAt: string; schoolId: number | null; archived: boolean }[];
  schools: { id: number; name: string }[];
  grades: Record<string, string>;
  sessions: { userId: number; at: string }[];
  loginLogs: { userId: number; at: string; device: string | null }[];
  activityDays: Record<string, DayMap>;
  bookQuizzes: { userId: number; at: string; score: number; total: number; points: number }[];
  eyeGazeQuizzes: { userId: number; at: string; score: number; total: number }[];
  readingChecks: { userId: number; at: string; score: number; total: number; level: string | null }[];
  growthChecks: { userId: number; at: string; raw: number; max: number; scaled: number | null }[];
  pointAwards: { userId: number; at: string; points: number; reason: string }[];
  feedEvents: { userId: number; at: string; type: string }[];
  games: { userIds: number[]; at: string }[];
  messages: { userId: number; at: string }[];
  liveJoins: { userId: number; at: string }[];
};

type Person = StatsPerson & { createdDay: string; schoolId: number | null };

const RANGE_DAYS: Record<Exclude<StatsRange, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };
const passMark = (total: number) => Math.ceil(total * 0.7);
const pct = (score: number, total: number) => (total > 0 ? Math.round((score / total) * 100) : null);
const ms = (iso: string) => Date.parse(iso);
const roleOf = (role: string): StatsRole => (role === "teacher" ? "teacher" : role === "parent" ? "parent" : "student");

function gradeOrder(g: string) {
  if (g === "Not set") return 1000;
  if (/^k/i.test(g)) return 0;
  const n = parseInt(g, 10);
  return Number.isFinite(n) ? n : 500;
}

export function buildAdminStats(
  input: StatsInput,
  opts: { range: StatsRange; now: number; timeZone?: string; heardFrom?: Map<number, number> },
): AdminStats {
  const tz = opts.timeZone ?? STATS_TIME_ZONE;
  const now = opts.now;
  const local = (iso: string | number) => zoneParts(typeof iso === "number" ? iso : ms(iso), tz);
  const today = local(now).day;

  // who counts: no admins, sample accounts or archived profiles
  const schoolName = new Map(input.schools.map((s) => [s.id, s.name]));
  const people = new Map<number, Person>();
  for (const u of input.users) {
    if (u.isAdmin || u.role === "admin" || u.archived || isDemoUsername(u.username) || !Number.isFinite(ms(u.createdAt))) continue;
    people.set(u.id, {
      userId: u.id, name: u.displayName || u.username || `User ${u.id}`, role: roleOf(u.role),
      school: u.schoolId ? schoolName.get(u.schoolId) ?? null : null, schoolId: u.schoolId, createdDay: local(u.createdAt).day,
    });
  }
  const isStudent = (id: number) => people.get(id)?.role === "student";
  const valid = <T extends { userId: number; at: string }>(rows: T[]) => rows.filter((r) => people.has(r.userId) && Number.isFinite(ms(r.at)));

  // sign-ins: the sign-in log, plus older sign-ins still on record (a session made within 10 seconds of a logged one is the same sign-in)
  const logs = valid(input.loginLogs);
  const logTimes = new Map<number, number[]>();
  for (const l of logs) (logTimes.get(l.userId) ?? logTimes.set(l.userId, []).get(l.userId)!).push(ms(l.at));
  const logins: { userId: number; at: number; device: string | null }[] = logs.map((l) => ({ userId: l.userId, at: ms(l.at), device: l.device || null }));
  for (const s of valid(input.sessions)) {
    const t = ms(s.at);
    if (!(logTimes.get(s.userId) ?? []).some((x) => Math.abs(x - t) < 10_000)) logins.push({ userId: s.userId, at: t, device: null });
  }
  logins.sort((a, b) => b.at - a.at);

  const bookQuizzes = valid(input.bookQuizzes);
  const eyeQuizzes = valid(input.eyeGazeQuizzes);
  const readingChecks = valid(input.readingChecks);
  const growthChecks = valid(input.growthChecks);
  const awards = valid(input.pointAwards);
  const feed = valid(input.feedEvents);
  const messages = valid(input.messages);
  const live = valid(input.liveJoins);

  // the range shown
  let from: string;
  if (opts.range === "all") {
    let earliest = today;
    for (const p of people.values()) if (p.createdDay < earliest) earliest = p.createdDay;
    for (const l of logins) { const d = local(l.at).day; if (d < earliest) earliest = d; }
    from = earliest < addDays(today, -730) ? addDays(today, -730) : earliest;
  } else {
    from = addDays(today, -(RANGE_DAYS[opts.range] - 1));
  }
  const span = daysBetween(from, today) + 1;
  const prev = opts.range === "all" ? null : { from: addDays(from, -span), to: addDays(from, -1) };
  const inRange = (day: string) => day >= from && day <= today;
  const inPrev = (day: string) => !!prev && day >= prev.from && day <= prev.to;
  const bucket: "day" | "week" = span > 120 ? "week" : "day";
  const bucketOf = (day: string) => (bucket === "week" ? weekStart(day) : day);

  // activity: who did anything, on which days and in which hours
  const activeDays = new Map<number, Set<string>>();
  const studentHours = new Set<string>();
  const lastSeen = new Map<number, number>();
  const note = (userId: number, at: number, hourly = true) => {
    if (!people.has(userId) || !Number.isFinite(at)) return;
    const { day, hour } = local(at);
    (activeDays.get(userId) ?? activeDays.set(userId, new Set()).get(userId)!).add(day);
    if (at > (lastSeen.get(userId) ?? 0)) lastSeen.set(userId, at);
    if (hourly && isStudent(userId)) studentHours.add(`${userId}|${day}|${hour}`);
  };
  let visitsSince: string | null = null;
  for (const [day, entries] of Object.entries(input.activityDays)) {
    if (!visitsSince || day < visitsSince) visitsSince = day;
    for (const [id, [first, last]] of Object.entries(entries)) { note(Number(id), first); note(Number(id), last); }
  }
  for (const l of logins) note(l.userId, l.at);
  for (const q of bookQuizzes) note(q.userId, ms(q.at));
  for (const q of eyeQuizzes) note(q.userId, ms(q.at));
  for (const r of readingChecks) note(r.userId, ms(r.at));
  for (const g of growthChecks) note(g.userId, ms(g.at));
  for (const f of feed) note(f.userId, ms(f.at));
  for (const m of messages) note(m.userId, ms(m.at));
  for (const j of live) note(j.userId, ms(j.at));
  for (const a of awards) if (/quick challenge/i.test(a.reason)) note(a.userId, ms(a.at));
  for (const g of input.games) for (const id of g.userIds) note(id, ms(g.at));
  for (const [id, at] of opts.heardFrom ?? []) {
    if (!people.has(id)) continue;
    if (at > (lastSeen.get(id) ?? 0)) lastSeen.set(id, at);
    (activeDays.get(id) ?? activeDays.set(id, new Set()).get(id)!).add(local(at).day);
  }

  // chart points
  const keys: string[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) { const k = bucketOf(d); if (keys[keys.length - 1] !== k) keys.push(k); }
  const buckets = new Map<string, StatsBucket>(keys.map((k) => [k, {
    key: k, newStudents: 0, newTeachers: 0, newParents: 0, totalStudents: 0, totalTeachers: 0, totalParents: 0,
    studentLogins: 0, staffLogins: 0, activeStudents: 0, bookQuizzes: 0, eyeGazeQuizzes: 0, assessments: 0, passed: 0, points: 0, feedViews: 0,
  }]));
  const at = (day: string) => (inRange(day) ? buckets.get(bucketOf(day)) : undefined);

  const created = [...people.values()].map((p) => ({ role: p.role, day: p.createdDay })).sort((a, b) => (a.day < b.day ? -1 : 1));
  for (const k of keys) {
    const b = buckets.get(k)!;
    const end = bucket === "week" ? (addDays(k, 6) < today ? addDays(k, 6) : today) : k;
    for (const c of created) {
      if (c.day > end) break;
      if (c.role === "student") b.totalStudents++; else if (c.role === "teacher") b.totalTeachers++; else b.totalParents++;
    }
  }
  for (const p of people.values()) {
    const b = at(p.createdDay);
    if (b) { if (p.role === "student") b.newStudents++; else if (p.role === "teacher") b.newTeachers++; else b.newParents++; }
  }
  for (const l of logins) { const b = at(local(l.at).day); if (b) { if (isStudent(l.userId)) b.studentLogins++; else b.staffLogins++; } }
  const activeInBucket = new Map<string, Set<number>>();
  for (const [id, days] of activeDays) {
    if (!isStudent(id)) continue;
    for (const d of days) {
      if (!inRange(d)) continue;
      const k = bucketOf(d);
      (activeInBucket.get(k) ?? activeInBucket.set(k, new Set()).get(k)!).add(id);
    }
  }
  for (const [k, set] of activeInBucket) { const b = buckets.get(k); if (b) b.activeStudents = set.size; }
  for (const q of bookQuizzes) {
    const b = at(local(q.at).day);
    if (!b) continue;
    b.bookQuizzes++;
    if (q.total > 0 && q.score >= passMark(q.total)) b.passed++;
    b.points += q.points;
  }
  for (const q of eyeQuizzes) { const b = at(local(q.at).day); if (b) { b.eyeGazeQuizzes++; if (q.total > 0 && q.score >= passMark(q.total)) b.passed++; } }
  for (const r of [...readingChecks, ...growthChecks]) { const b = at(local(r.at).day); if (b) b.assessments++; }
  for (const a of awards) { const b = at(local(a.at).day); if (b) b.points += a.points; }
  for (const f of feed) if (f.type === "view") { const b = at(local(f.at).day); if (b) b.feedViews++; }
  for (const b of buckets.values()) b.points = Math.round(b.points * 10) / 10;

  // totals for the range, and the same span just before it
  const count = <T,>(rows: T[], dayOf: (r: T) => string, test: (d: string) => boolean) => rows.reduce((n, r) => n + (test(dayOf(r)) ? 1 : 0), 0);
  const delta = (fn: (test: (d: string) => boolean) => number): StatsDelta => ({ now: fn(inRange), before: prev ? fn(inPrev) : null });
  const all = [...people.values()];
  const byRole = (role: StatsRole) => all.filter((p) => p.role === role);
  const activeWhere = (role: StatsRole, test: (d: string) => boolean) =>
    [...activeDays].filter(([id, days]) => people.get(id)?.role === role && [...days].some(test)).length;
  const quizRows = [...bookQuizzes, ...eyeQuizzes, ...readingChecks, ...growthChecks];
  const graded = [...bookQuizzes, ...eyeQuizzes].filter((q) => inRange(local(q.at).day) && q.total > 0);
  const passed = graded.filter((q) => q.score >= passMark(q.total)).length;
  const pointsWhere = (test: (d: string) => boolean) => Math.round(
    (bookQuizzes.reduce((s, q) => s + (test(local(q.at).day) ? q.points : 0), 0) + awards.reduce((s, a) => s + (test(local(a.at).day) ? a.points : 0), 0)) * 10,
  ) / 10;
  const onlineCutoff = now - ONLINE_WINDOW_MS;
  const online = [...lastSeen].filter(([, t]) => t >= onlineCutoff && t <= now + 60_000).sort((a, b) => b[1] - a[1]);

  // when students use the app
  const hours = new Array(24).fill(0);
  for (const key of studentHours) {
    const [, day, hour] = key.split("|");
    if (inRange(day)) hours[Number(hour)]++;
  }
  const weekdays = new Array(7).fill(0);
  for (const [id, days] of activeDays) if (isStudent(id)) for (const d of days) if (inRange(d)) weekdays[weekdayOf(d)]++;

  // devices people sign in on
  const deviceCount = new Map<string, number>();
  for (const l of logins) {
    if (!l.device || !inRange(local(l.at).day)) continue;
    const name = l.device.split(" · ")[0] || l.device;
    deviceCount.set(name, (deviceCount.get(name) ?? 0) + 1);
  }
  const deviceList = [...deviceCount].map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count);
  const devices = deviceList.length > 6
    ? [...deviceList.slice(0, 5), { name: "Other", count: deviceList.slice(5).reduce((s, d) => s + d.count, 0) }]
    : deviceList;

  // schools and grades
  const schoolRows = new Map<number | null, { id: number | null; name: string; students: number; teachers: number; activeStudents: number }>();
  for (const p of all) {
    if (p.role === "parent") continue;
    const id = p.schoolId && schoolName.has(p.schoolId) ? p.schoolId : null;
    const row = schoolRows.get(id) ?? schoolRows.set(id, { id, name: id ? schoolName.get(id)! : "No school", students: 0, teachers: 0, activeStudents: 0 }).get(id)!;
    if (p.role === "student") {
      row.students++;
      if ([...(activeDays.get(p.userId) ?? [])].some(inRange)) row.activeStudents++;
    } else row.teachers++;
  }
  const schools = [...schoolRows.values()].sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.students - a.students || a.name.localeCompare(b.name)));
  const gradeCount = new Map<string, number>();
  for (const p of byRole("student")) {
    const g = String(input.grades[String(p.userId)] || "").trim() || "Not set";
    gradeCount.set(g, (gradeCount.get(g) ?? 0) + 1);
  }
  const grades = [...gradeCount].map(([grade, students]) => ({ grade, students })).sort((a, b) => gradeOrder(a.grade) - gradeOrder(b.grade) || a.grade.localeCompare(b.grade));

  // people lists
  const person = (id: number): StatsPerson => { const p = people.get(id)!; return { userId: p.userId, name: p.name, role: p.role, school: p.school }; };
  const iso = (t: number | undefined) => (t ? new Date(t).toISOString() : null);
  const perUser = new Map<number, { logins: number; quizzes: number; passed: number; points: number }>();
  const tally = (id: number) => perUser.get(id) ?? perUser.set(id, { logins: 0, quizzes: 0, passed: 0, points: 0 }).get(id)!;
  for (const l of logins) if (inRange(local(l.at).day)) tally(l.userId).logins++;
  for (const q of quizRows) if (inRange(local(q.at).day)) tally(q.userId).quizzes++;
  for (const q of graded) if (q.score >= passMark(q.total)) tally(q.userId).passed++;
  for (const q of bookQuizzes) if (inRange(local(q.at).day)) tally(q.userId).points += q.points;
  for (const a of awards) if (inRange(local(a.at).day)) tally(a.userId).points += a.points;
  const studentRows = byRole("student").map((p) => {
    const id = p.userId;
    const t = perUser.get(id) ?? { logins: 0, quizzes: 0, passed: 0, points: 0 };
    const days = [...(activeDays.get(id) ?? [])].filter(inRange).length;
    return { ...person(id), activeDays: days, logins: t.logins, quizzes: t.quizzes, passed: t.passed, points: Math.round(t.points * 10) / 10, lastSeen: iso(lastSeen.get(id)), createdDay: p.createdDay };
  });
  const topStudents = studentRows
    .filter((s) => s.activeDays > 0 || s.quizzes > 0 || s.points > 0)
    .sort((a, b) => b.activeDays - a.activeDays || b.quizzes - a.quizzes || b.points - a.points || b.logins - a.logins || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map(({ createdDay: _c, ...s }) => s);
  const quietCutoff = now - QUIET_AFTER_DAYS * DAY_MS;
  const quiet = studentRows
    .filter((s) => (s.lastSeen ? ms(s.lastSeen) < quietCutoff : daysBetween(s.createdDay, today) >= QUIET_AFTER_DAYS))
    .sort((a, b) => (a.lastSeen === b.lastSeen ? a.name.localeCompare(b.name) : !a.lastSeen ? -1 : !b.lastSeen ? 1 : ms(a.lastSeen) - ms(b.lastSeen)));

  // reading checks
  const checks = [
    ...readingChecks.map((r) => ({ userId: r.userId, at: r.at, kind: "Reading check" as const, percent: pct(r.score, r.total), detail: [`${r.score}/${r.total}`, r.level && `reading level ${r.level}`].filter(Boolean).join(" · ") })),
    ...growthChecks.map((g) => ({ userId: g.userId, at: g.at, kind: "Growth Check" as const, percent: pct(g.raw, g.max), detail: [`${g.raw}/${g.max}`, g.scaled != null && `ARISE score ${g.scaled}`].filter(Boolean).join(" · ") })),
  ].filter((c) => inRange(local(c.at).day)).sort((a, b) => ms(b.at) - ms(a.at));
  const scored = checks.filter((c) => c.percent !== null);

  return {
    range: opts.range,
    bucket,
    from,
    to: today,
    timeZone: tz,
    generatedAt: new Date(now).toISOString(),
    visitsSince,
    totals: {
      students: byRole("student").length,
      teachers: byRole("teacher").length,
      parents: byRole("parent").length,
      schools: input.schools.length,
      newStudents: delta((t) => count(byRole("student"), (p) => p.createdDay, t)),
      newTeachers: delta((t) => count(byRole("teacher"), (p) => p.createdDay, t)),
      newParents: delta((t) => count(byRole("parent"), (p) => p.createdDay, t)),
      activeStudents: delta((t) => activeWhere("student", t)),
      activeTeachers: activeWhere("teacher", inRange),
      activeParents: activeWhere("parent", inRange),
      activeToday: activeWhere("student", (d) => d === today),
      onlineNow: online.length,
      logins: delta((t) => count(logins, (l) => local(l.at).day, t)),
      quizzes: delta((t) => count(quizRows, (q) => local(q.at).day, t)),
      passed,
      passRate: graded.length ? Math.round((passed / graded.length) * 100) : null,
      points: delta(pointsWhere),
      feedViews: count(feed.filter((f) => f.type === "view"), (f) => local(f.at).day, inRange),
    },
    buckets: keys.map((k) => buckets.get(k)!),
    hours,
    weekdays,
    devices,
    schools,
    grades,
    onlineNow: online.map(([id, t]) => ({ ...person(id), lastSeen: new Date(t).toISOString() })),
    recentLogins: logins.slice(0, 30).map((l) => ({ ...person(l.userId), at: new Date(l.at).toISOString(), device: l.device })),
    topStudents,
    quietStudents: quiet.slice(0, 25).map((s) => ({
      userId: s.userId, name: s.name, role: s.role, school: s.school, lastSeen: s.lastSeen,
      daysAway: s.lastSeen ? Math.floor((now - ms(s.lastSeen)) / DAY_MS) : null,
    })),
    quietCount: quiet.length,
    reading: {
      assessments: checks.length,
      averagePercent: scored.length ? Math.round(scored.reduce((s, c) => s + (c.percent ?? 0), 0) / scored.length) : null,
      recent: checks.slice(0, 8).map((c) => ({ ...person(c.userId), at: c.at, kind: c.kind, percent: c.percent, detail: c.detail })),
    },
  };
}

// ─── Reading the database ────────────────────────────────────────────────────

type Db = { from: (table: string) => any };
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Every row of a query, a page at a time (the database hands back at most 1,000 rows per request). */
async function fetchAll<T>(make: (start: number, end: number) => Page<T>, pageSize = 1000, maxRows = 100_000): Promise<T[]> {
  const out: T[] = [];
  for (let start = 0; start < maxRows; start += pageSize) {
    const { data, error } = await make(start, start + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function loadStatsInput(db: Db, opts: { now: number; timeZone?: string }): Promise<StatsInput> {
  const tz = opts.timeZone ?? STATS_TIME_ZONE;
  // busy tables are read for the last year and a bit; the rest in full
  const since = new Date(opts.now - 400 * DAY_MS).toISOString();
  const firstVisitDay = dayKey(opts.now - 400 * DAY_MS, tz);
  const [
    users, schools, gradesRow, sessions, logRows, dayRows, attempts, eye, customEye, reading, growth, awards, feed, matches, messages, live,
  ] = await Promise.all([
    fetchAll<any>((a, b) => db.from("users").select("id, username, display_name, role, is_admin, created_at, school_id, archived_at").order("id").range(a, b)),
    fetchAll<any>((a, b) => db.from("schools").select("id, name").order("id").range(a, b)),
    db.from("settings").select("value").eq("key", "user_grades").maybeSingle(),
    fetchAll<any>((a, b) => db.from("sessions").select("user_id, created_at").gte("created_at", since).order("id").range(a, b)),
    fetchAll<any>((a, b) => db.from("settings").select("key, value").like("key", "login_log_%").order("key").range(a, b)),
    fetchAll<any>((a, b) => db.from("settings").select("key, value").like("key", `${ACTIVITY_KEY_PREFIX}%`).gte("key", ACTIVITY_KEY_PREFIX + firstVisitDay).order("key").range(a, b)),
    fetchAll<any>((a, b) => db.from("attempts").select("user_id, score, total, points_earned, completed_at").not("completed_at", "is", null).order("id").range(a, b)),
    fetchAll<any>((a, b) => db.from("eye_gaze_attempts").select("user_id, score, total, completed_at").not("completed_at", "is", null).order("id").range(a, b)),
    fetchAll<any>((a, b) => db.from("custom_eye_gaze_attempts").select("user_id, score, total, completed_at").not("completed_at", "is", null).order("id").range(a, b)),
    fetchAll<any>((a, b) => db.from("reading_assessment_attempts").select("user_id, score, total, completed_at, estimated_grade_level").not("completed_at", "is", null).order("id").range(a, b)),
    fetchAll<any>((a, b) => db.from("growth_check_attempts").select("student_id, raw_score, max_score, arise_reading_score, submitted_at").not("submitted_at", "is", null).order("id").range(a, b)),
    fetchAll<any>((a, b) => db.from("manual_point_awards").select("student_id, points, reason, created_at").order("id").range(a, b)),
    fetchAll<any>((a, b) => db.from("book_feed_events").select("user_id, event_type, created_at").gte("created_at", since).order("id").range(a, b)),
    fetchAll<any>((a, b) => db.from("club_arise_matches").select("player1_id, player2_id, updated_at").eq("status", "finished").gte("updated_at", since).order("updated_at").range(a, b)),
    fetchAll<any>((a, b) => db.from("messages").select("user_id, created_at").eq("sender_type", "student").gte("created_at", since).order("id").range(a, b)),
    fetchAll<any>((a, b) => db.from("live_players").select("user_id, joined_at").gte("joined_at", since).order("joined_at").range(a, b)),
  ]);
  if (gradesRow?.error) throw new Error(gradesRow.error.message);

  let grades: Record<string, string> = {};
  try { const v = JSON.parse(gradesRow?.data?.value || "{}"); if (v && typeof v === "object") grades = v; } catch { /* no grades */ }

  const loginLogs: StatsInput["loginLogs"] = [];
  for (const row of logRows) {
    const userId = Number(String(row.key).slice("login_log_".length));
    if (!Number.isSafeInteger(userId)) continue;
    try {
      const list = JSON.parse(row.value || "[]");
      if (Array.isArray(list)) for (const l of list) if (l?.at) loginLogs.push({ userId, at: String(l.at), device: l.device ? String(l.device) : null });
    } catch { /* skip a damaged log */ }
  }
  const activityDays: StatsInput["activityDays"] = {};
  for (const row of dayRows) activityDays[String(row.key).slice(ACTIVITY_KEY_PREFIX.length)] = parseActivityDay(row.value);

  return {
    users: users.map((u) => ({
      id: Number(u.id), username: String(u.username || ""), displayName: String(u.display_name || ""), role: String(u.role || "student"),
      isAdmin: u.is_admin === true, createdAt: String(u.created_at || ""), schoolId: u.school_id ? Number(u.school_id) : null, archived: !!u.archived_at,
    })),
    schools: schools.map((s) => ({ id: Number(s.id), name: String(s.name || "") })),
    grades,
    sessions: sessions.map((s) => ({ userId: Number(s.user_id), at: String(s.created_at) })),
    loginLogs,
    activityDays,
    bookQuizzes: attempts.map((a) => ({ userId: Number(a.user_id), at: String(a.completed_at), score: num(a.score), total: num(a.total), points: num(a.points_earned) })),
    eyeGazeQuizzes: [...eye, ...customEye].map((a) => ({ userId: Number(a.user_id), at: String(a.completed_at), score: num(a.score), total: num(a.total) })),
    readingChecks: reading.map((r) => ({ userId: Number(r.user_id), at: String(r.completed_at), score: num(r.score), total: num(r.total), level: r.estimated_grade_level ? String(r.estimated_grade_level) : null })),
    growthChecks: growth.map((g) => ({ userId: Number(g.student_id), at: String(g.submitted_at), raw: num(g.raw_score), max: num(g.max_score), scaled: g.arise_reading_score == null ? null : num(g.arise_reading_score) })),
    pointAwards: awards.map((w) => ({ userId: Number(w.student_id), at: String(w.created_at), points: num(w.points), reason: String(w.reason || "") })),
    feedEvents: feed.map((f) => ({ userId: Number(f.user_id), at: String(f.created_at), type: String(f.event_type || "") })),
    games: matches.map((m) => ({ userIds: [Number(m.player1_id), Number(m.player2_id)].filter((id) => id > 0), at: String(m.updated_at) })),
    messages: messages.map((m) => ({ userId: Number(m.user_id), at: String(m.created_at) })),
    liveJoins: live.map((j) => ({ userId: Number(j.user_id), at: String(j.joined_at) })),
  };
}

/** Folds visits this server noted but hasn't saved yet into what was read from the database. */
export function withUnsaved(input: StatsInput, unsaved: Record<string, DayMap>): StatsInput {
  const activityDays: StatsInput["activityDays"] = { ...input.activityDays };
  for (const [day, entries] of Object.entries(unsaved)) {
    const merged: DayMap = { ...(activityDays[day] ?? {}) };
    for (const [id, [first, last]] of Object.entries(entries)) {
      const cur = merged[id];
      merged[id] = cur ? [Math.min(cur[0], first), Math.max(cur[1], last)] : [first, last];
    }
    activityDays[day] = merged;
  }
  return { ...input, activityDays };
}

export function registerAdminStatsRoutes(
  app: Express,
  auth: RequestHandler,
  admin: RequestHandler,
  deps: { db: () => Db; presence: PresenceTracker; now?: () => number },
) {
  const now = deps.now ?? Date.now;
  // the numbers take a moment to gather, so the same range is reused for 30 seconds
  const cache = new Map<string, { at: number; stats: AdminStats }>();
  let loading: Promise<StatsInput> | null = null;

  app.get("/api/admin/stats", auth, admin, async (req: any, res: any) => {
    const range: StatsRange = isStatsRange(req.query?.range) ? req.query.range : "30d";
    res.set("Cache-Control", "no-store");
    const hit = cache.get(range);
    if (hit && now() - hit.at < 30_000 && req.query?.fresh !== "1") return res.json(hit.stats);
    try {
      // several ranges asked for at once share one trip to the database
      loading ??= loadStatsInput(deps.db(), { now: now() }).finally(() => { loading = null; });
      const input = withUnsaved(await loading, deps.presence.unsaved());
      const stats = buildAdminStats(input, { range, now: now(), heardFrom: deps.presence.lastSeen() });
      cache.set(range, { at: now(), stats });
      res.json(stats);
    } catch (e: any) {
      console.error("[stats]", e?.message || e);
      res.status(500).json({ message: "Could not load the stats. Try again in a moment." });
    }
  });
}
