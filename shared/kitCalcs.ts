// The math behind the Plugin Kit's newer calculators, kept apart from the screens so it can be tested.
// Every function takes plain numbers or text and returns null when there isn't enough to work with.

const finite = (n: number) => Number.isFinite(n);
const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

/** Two sizes or brands, by price per unit. */
export function unitPrice(priceA: number, sizeA: number, priceB: number, sizeB: number) {
  if (!(priceA > 0 && sizeA > 0)) return null;
  const a = priceA / sizeA;
  if (!(priceB > 0 && sizeB > 0)) return { a, b: null, better: null as "A" | "B" | "same" | null, savePct: 0 };
  const b = priceB / sizeB;
  const better = Math.abs(a - b) < 1e-9 ? "same" : a < b ? "A" : "B";
  const savePct = better === "same" ? 0 : (Math.abs(a - b) / Math.max(a, b)) * 100;
  return { a, b, better: better as "A" | "B" | "same", savePct };
}

/** Gas for a drive. */
export function fuelCost(miles: number, mpg: number, pricePerGallon: number, roundTrip: boolean, people: number) {
  if (!(miles > 0 && mpg > 0 && pricePerGallon > 0)) return null;
  const total = miles * (roundTrip ? 2 : 1);
  const gallons = total / mpg;
  const cost = gallons * pricePerGallon;
  const split = Math.max(1, Math.floor(people) || 1);
  return { miles: total, gallons, cost, perPerson: cost / split, people: split };
}

/** Hourly pay to weekly, monthly and yearly, before taxes. */
export function payFromHourly(hourly: number, hoursPerWeek: number, weeksPerYear: number) {
  if (!(hourly > 0 && hoursPerWeek > 0 && weeksPerYear > 0)) return null;
  const weekly = hourly * hoursPerWeek, yearly = weekly * weeksPerYear;
  return { weekly, monthly: yearly / 12, yearly };
}

/** A yearly salary to an hourly rate, before taxes. */
export function hourlyFromSalary(salary: number, hoursPerWeek: number, weeksPerYear: number) {
  if (!(salary > 0 && hoursPerWeek > 0 && weeksPerYear > 0)) return null;
  return salary / (hoursPerWeek * weeksPerYear);
}

/** Days between two YYYY-MM-DD dates (to minus from). */
export function dayGap(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  return finite(a) && finite(b) ? Math.round((b - a) / 86_400_000) : null;
}

/** How much to save each week and month to reach a goal by a date. */
export function savingsPlan(goal: number, have: number, today: string, by: string) {
  if (!(goal > 0)) return null;
  const left = Math.max(0, goal - Math.max(0, have || 0));
  const days = dayGap(today, by);
  if (days === null) return null;
  if (left === 0) return { left, days, perWeek: 0, perMonth: 0, done: true, late: false };
  if (days <= 0) return { left, days, perWeek: left, perMonth: left, done: false, late: true };
  return { left, days, perWeek: left / Math.max(1, days / 7), perMonth: left / Math.max(1, days / 30.44), done: false, late: false };
}

/** "6:45 AM" from minutes after midnight (wraps past midnight). */
export function clock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** When to be in bed to get this much sleep before a wake-up time ("06:30"). */
export function bedtimeFor(wake: string, sleepHours: number, fallAsleepMinutes: number) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(wake);
  if (!m || !(sleepHours > 0 && sleepHours <= 16)) return null;
  const wakeMin = Number(m[1]) * 60 + Number(m[2]);
  if (Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const settle = Math.max(0, Math.min(120, fallAsleepMinutes || 0));
  const bed = wakeMin - sleepHours * 60 - settle;
  return { bed: clock(bed), wake: clock(wakeMin), options: [7, 8, 9, 10].map((h) => ({ hours: h, bed: clock(wakeMin - h * 60 - settle) })) };
}

/** Numbers from pasted text: commas, spaces, tabs or new lines between them. */
export function numbersIn(text: string): number[] {
  return String(text || "").split(/[\s,;]+/).map((s) => s.replace(/%$/, "")).filter((s) => s !== "").map(Number).filter(finite);
}

/** Average, median, high and low of a list of scores. */
export function scoreStats(text: string) {
  const list = numbersIn(text);
  if (!list.length) return null;
  const sorted = [...list].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const mean = list.reduce((s, n) => s + n, 0) / list.length;
  return { count: list.length, mean, median, min: sorted[0], max: sorted[sorted.length - 1] };
}

/**
 * A weighted grade from lines like "Tests 40 88": the last two numbers on each line are the
 * category's weight (percent) and the student's score in it (percent).
 */
export function weightedGrade(text: string) {
  const rows: { label: string; weight: number; score: number }[] = [];
  for (const line of String(text || "").split("\n")) {
    const nums = line.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 2) continue;
    const weight = Number(nums[nums.length - 2]), score = Number(nums[nums.length - 1]);
    if (!(weight > 0) || !finite(score)) continue;
    const label = line.slice(0, line.indexOf(nums[nums.length - 2])).replace(/[,:\-–]+\s*$/, "").trim() || `Category ${rows.length + 1}`;
    rows.push({ label, weight, score });
  }
  if (!rows.length) return null;
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const grade = rows.reduce((s, r) => s + r.weight * r.score, 0) / totalWeight;
  return { rows, totalWeight, grade, weightsAdd: Math.abs(totalWeight - 100) < 0.01 };
}

export const letterFor = (pct: number) => (pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F");

/** Attendance rate. Missing 10% or more of school days is the common definition of chronic absence. */
export function attendanceRate(daysEnrolled: number, daysAbsent: number) {
  if (!(daysEnrolled > 0) || daysAbsent < 0 || daysAbsent > daysEnrolled) return null;
  const rate = ((daysEnrolled - daysAbsent) / daysEnrolled) * 100;
  return { rate, present: daysEnrolled - daysAbsent, missedPct: 100 - rate, chronic: daysAbsent / daysEnrolled >= 0.1 };
}

/** IEP service minutes: per week, per month (about 4 weeks) and per school year, and what's still owed. */
export function serviceMinutes(minutesPerSession: number, sessionsPerWeek: number, schoolWeeks: number, weeksSoFar: number, delivered: number) {
  if (!(minutesPerSession > 0 && sessionsPerWeek > 0)) return null;
  const weekly = minutesPerSession * sessionsPerWeek;
  const weeks = schoolWeeks > 0 ? schoolWeeks : 36;
  const expected = weeksSoFar > 0 ? weekly * weeksSoFar : null;
  return { weekly, monthly: weekly * 4, yearly: weekly * weeks, weeks, expected, owed: expected !== null && delivered >= 0 ? Math.max(0, expected - delivered) : null };
}

/** The score needed on a final worth `finalWeight` percent to finish with `target` percent. */
export function finalNeeded(current: number, finalWeight: number, target: number) {
  if (!(finalWeight > 0 && finalWeight < 100) || !finite(current) || !finite(target)) return null;
  const w = finalWeight / 100;
  const needed = (target - current * (1 - w)) / w;
  return { needed: round(needed, 1), possible: needed <= 100, already: needed <= 0 };
}
