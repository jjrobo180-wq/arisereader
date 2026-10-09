// Cycle tracker for the A.R.I.S.E. To-Do: periods from logged flow days, averages and predictions.
// Predictions use the usual calendar method (ovulation about 14 days before the next period).
// They're estimates for planning, not birth control or medical advice.
import { addDays, daysBetween, type CycleLog } from "./familyHub";

export type Period = { start: string; end: string; days: number };
export const SYMPTOMS = ["Cramps", "Headache", "Bloating", "Tender breasts", "Acne", "Back pain", "Tired", "Cravings", "Moody", "Anxious", "Trouble sleeping", "Nausea"];
export const DEFAULT_CYCLE = 28;
export const DEFAULT_PERIOD = 5;

/** Flow days (not spotting) grouped into periods; a gap of up to one day still counts as the same period. */
export function periodsOf(logs: CycleLog[], memberId: string): Period[] {
  const days = [...new Set(logs.filter((l) => l.memberId === memberId && l.flow !== "none" && l.flow !== "spotting").map((l) => l.date))].sort();
  const out: Period[] = [];
  for (const d of days) {
    const last = out[out.length - 1];
    if (last && daysBetween(last.end, d) <= 2) { last.end = d; last.days = daysBetween(last.start, d) + 1; }
    else out.push({ start: d, end: d, days: 1 });
  }
  return out;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export type CycleSummary = {
  periods: Period[]; cycleLength: number; periodLength: number; fromHistory: boolean; regular: boolean | null;
  lastStart: string | null; dayOfCycle: number | null; nextStart: string | null; daysUntil: number | null; late: number;
  ovulation: string | null; fertileStart: string | null; fertileEnd: string | null;
  phase: "period" | "follicular" | "fertile" | "luteal" | null; onPeriod: boolean;
};

export function cycleSummary(logs: CycleLog[], memberId: string, today: string): CycleSummary {
  const periods = periodsOf(logs, memberId);
  const gaps: number[] = [];
  for (let i = 1; i < periods.length; i++) { const g = daysBetween(periods[i - 1].start, periods[i].start); if (g >= 15 && g <= 60) gaps.push(g); }
  const recent = gaps.slice(-6);
  const cycleLength = recent.length ? Math.round(avg(recent)) : DEFAULT_CYCLE;
  const lens = periods.slice(-6).map((p) => p.days).filter((d) => d >= 2 && d <= 10);
  const periodLength = lens.length ? Math.round(avg(lens)) : DEFAULT_PERIOD;
  const regular = recent.length >= 3 ? Math.max(...recent) - Math.min(...recent) <= 7 : null;
  const last = periods[periods.length - 1];
  const base: CycleSummary = { periods, cycleLength, periodLength, fromHistory: recent.length > 0, regular, lastStart: last?.start ?? null, dayOfCycle: null, nextStart: null, daysUntil: null, late: 0, ovulation: null, fertileStart: null, fertileEnd: null, phase: null, onPeriod: false };
  if (!last || last.start > today) return base;
  const dayOfCycle = daysBetween(last.start, today) + 1;
  const expected = addDays(last.start, cycleLength);
  // A period that hasn't come yet is "late"; the next one is still predicted from the expected date.
  const late = today > expected ? daysBetween(expected, today) : 0;
  const nextStart = late ? today : expected;
  const ovulation = addDays(expected, -14);
  const onPeriod = today <= addDays(last.end, 0) || (today <= addDays(last.start, periodLength - 1) && daysBetween(last.end, today) <= 1);
  const fertileStart = addDays(ovulation, -5), fertileEnd = addDays(ovulation, 1);
  const phase = onPeriod ? "period" : today >= fertileStart && today <= fertileEnd ? "fertile" : today < fertileStart ? "follicular" : "luteal";
  return { ...base, dayOfCycle, nextStart, daysUntil: late ? 0 : daysBetween(today, expected), late, ovulation, fertileStart, fertileEnd, phase, onPeriod };
}

/** Predicted days for the calendar: the next few periods and fertile windows after the last logged period. */
export function predictedDays(s: CycleSummary, horizonDays = 120): { period: Set<string>; fertile: Set<string>; ovulation: Set<string> } {
  const period = new Set<string>(), fertile = new Set<string>(), ovulation = new Set<string>();
  if (!s.lastStart) return { period, fertile, ovulation };
  for (let k = 1; k <= Math.ceil(horizonDays / s.cycleLength) + 1; k++) {
    const start = addDays(s.lastStart, s.cycleLength * k);
    for (let i = 0; i < s.periodLength; i++) period.add(addDays(start, i));
    const ov = addDays(start, -14);
    ovulation.add(ov);
    for (let i = -5; i <= 1; i++) fertile.add(addDays(ov, i));
  }
  return { period, fertile, ovulation };
}
