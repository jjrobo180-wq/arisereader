// How the all-time Arise Reader totals read on the home page and the sign-in screen.
export type ReaderTotals = { quizzes: number; points: number; since: string | null };

/** "1,666": whole numbers with thousands separators. */
export function formatTotal(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** "September 8, 2026" from "2026-09-08" (a plain date, so no time zone can move the day); "" when it isn't one. */
export function sinceLabel(since: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(since || "");
  if (!m) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}
