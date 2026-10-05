// Months as the school sees them: they start at midnight Mountain Time, not
// midnight in London or wherever a reader's computer happens to be. The monthly
// leaderboard, its countdown and the server's monthly totals all use these, so a
// quiz finished at 11:30 pm on the 31st counts in the month the countdown showed.

export const SCHOOL_TIME_ZONE = "America/Denver";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** When a month ("YYYY-MM") starts in the school's time zone, as a time. */
export function monthStartMs(yearMonth: string, timeZone = SCHOOL_TIME_ZONE): number {
  const [y, m] = yearMonth.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, 1);
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(new Date(utcMidnight)).find((p) => p.type === "timeZoneName")?.value || "GMT";
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offsetMin = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0)) : 0;
  return utcMidnight - offsetMin * 60_000;
}

/** The month after "YYYY-MM". */
export function nextYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** The month before "YYYY-MM". */
export function previousYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** The school's month ("YYYY-MM") at a moment in time. */
export function schoolYearMonth(ms: number = Date.now(), timeZone = SCHOOL_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

/** When a month ends: midnight Mountain Time on the 1st of the next month. */
export const monthEndMs = (yearMonth: string, timeZone = SCHOOL_TIME_ZONE) => monthStartMs(nextYearMonth(yearMonth), timeZone);

/** "October 2026". */
export function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${MONTHS[m - 1] ?? ""} ${y}`;
}

/** This month and the ones before it, newest first. */
export function recentSchoolMonths(count: number, ms: number = Date.now()): string[] {
  const out = [schoolYearMonth(ms)];
  while (out.length < count) out.push(previousYearMonth(out[out.length - 1]));
  return out;
}

/** Days, hours, minutes and seconds in a span of time (never below zero). */
export function timeLeft(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86_400), hours: Math.floor((s % 86_400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}
