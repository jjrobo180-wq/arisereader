export const DAILY_PLAY_MS = 10 * 60 * 1000;
export const QUIZ_PLAY_MS = 10 * 60 * 1000;
export const PLAY_LEASE_MS = 20_000;
export const CLUB_WORLD_PATHS = ['/worlds', '/arise-arcade', '/club-arise', '/club-arise/theater', '/neighborhood', '/board-game-world', '/laser-royale'];
export function clubDay(now: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export type PlayRecord = { day: string; usedMs: number; paidUntil: number; sessions: Record<string, number> };
export type PlayAccess = { allowed: boolean; locked: boolean; remainingMs: number; expiresAt: number; leaseUntil: number; serverNow: number; day: string; bonusMinutes: number; minutesPerQuiz: number };
export function updatePlayRecord(previous: PlayRecord | null, now: number, quizzes: number, sessionId?: string, leaving = false, locked = false) {
  const day = clubDay(now);
  const record: PlayRecord = previous?.day === day ? structuredClone(previous) : { day, usedMs: 0, paidUntil: 0, sessions: {} };
  const total = DAILY_PLAY_MS + quizzes * QUIZ_PLAY_MS;
  for (const [id, until] of Object.entries(record.sessions)) if (until <= now) delete record.sessions[id];
  if (sessionId && leaving) {
    delete record.sessions[sessionId];
    if (!Object.keys(record.sessions).length) {
      record.usedMs = Math.max(0, record.usedMs - Math.max(0, record.paidUntil - now));
      record.paidUntil = 0;
    }
  } else if (sessionId && !locked) {
    record.sessions[sessionId] = now + PLAY_LEASE_MS + 10_000;
    const unspent = Math.max(0, record.paidUntil - now);
    const reserve = Math.min(Math.max(0, total - record.usedMs), Math.max(0, PLAY_LEASE_MS - unspent));
    record.usedMs += reserve;
    record.paidUntil = Math.max(now, record.paidUntil) + reserve;
  }
  const remainingMs = Math.max(0, total - record.usedMs + Math.max(0, record.paidUntil - now));
  const access: PlayAccess = { allowed: !locked && remainingMs > 0 && record.paidUntil > now, locked, remainingMs, expiresAt: now + remainingMs, leaseUntil: record.paidUntil, serverNow: now, day, bonusMinutes: quizzes * 10, minutesPerQuiz: 10 };
  return { record, access };
}
