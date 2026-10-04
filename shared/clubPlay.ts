export const DAILY_PLAY_MS = 10 * 60 * 1000;
export const PLAY_LEASE_MS = 20_000;
export const CLUB_WORLD_PATHS = ['/games', '/city', '/club-arise/theater', '/neighborhood', '/my-home', '/board-game-world', '/halloread-mystery', '/ultimate-chess', '/paintball-arena', '/skybound-sprint', '/aurora-rally'];

export function clubDay(now: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function clubWeek(now: number) {
  const [year, month, day] = clubDay(now).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export type PlayRecord = { day: string; usedMs: number; paidUntil: number; sessions: Record<string, number> };
export type PlayAccess = {
  allowed: boolean;
  locked: boolean;
  unlimitedThisWeek: boolean;
  remainingMs: number;
  expiresAt: number;
  leaseUntil: number;
  serverNow: number;
  day: string;
  week: string;
  dailyMinutes: number;
  weeklyUnlimitedOnPass: boolean;
  passedThisWeek: number;
  closedByAdmin?: boolean;
  closedByTeacher?: boolean;
  closingHours?: {
    enabled: boolean;
    start: string;
    end: string;
    days: number[];
    timeZone: string;
  } | null;
  teacherClosingHours?: {
    enabled: boolean;
    start: string;
    end: string;
    days: number[];
    timeZone: string;
  } | null;
};

export function updatePlayRecord(
  previous: PlayRecord | null,
  now: number,
  sessionId?: string,
  leaving = false,
  locked = false,
  unlimitedThisWeek = false,
  weeklyUnlimitedOnPass = true,
  passedThisWeek = 0,
  dailyPlayMs = DAILY_PLAY_MS,
) {
  const day = clubDay(now);
  const week = clubWeek(now);
  const record: PlayRecord = previous?.day === day ? structuredClone(previous) : { day, usedMs: 0, paidUntil: 0, sessions: {} };

  for (const [id, until] of Object.entries(record.sessions)) if (until <= now) delete record.sessions[id];

  if (sessionId && leaving) {
    delete record.sessions[sessionId];
    if (!Object.keys(record.sessions).length && !unlimitedThisWeek) {
      record.usedMs = Math.max(0, record.usedMs - Math.max(0, record.paidUntil - now));
      record.paidUntil = 0;
    }
  } else if (sessionId && !locked) {
    record.sessions[sessionId] = now + PLAY_LEASE_MS + 10_000;
    if (!unlimitedThisWeek) {
      const unspent = Math.max(0, record.paidUntil - now);
      const reserve = Math.min(Math.max(0, dailyPlayMs - record.usedMs), Math.max(0, PLAY_LEASE_MS - unspent));
      record.usedMs += reserve;
      record.paidUntil = Math.max(now, record.paidUntil) + reserve;
    }
  }

  const remainingMs = unlimitedThisWeek
    ? 0
    : Math.max(0, dailyPlayMs - record.usedMs + Math.max(0, record.paidUntil - now));

  const access: PlayAccess = {
    allowed: !locked && (unlimitedThisWeek || (remainingMs > 0 && record.paidUntil > now)),
    locked,
    unlimitedThisWeek,
    remainingMs,
    expiresAt: unlimitedThisWeek ? 0 : now + remainingMs,
    leaseUntil: unlimitedThisWeek ? now + PLAY_LEASE_MS + 10_000 : record.paidUntil,
    serverNow: now,
    day,
    week,
    dailyMinutes: Math.round(dailyPlayMs / 60_000),
    weeklyUnlimitedOnPass,
    passedThisWeek,
  };
  return { record, access };
}
