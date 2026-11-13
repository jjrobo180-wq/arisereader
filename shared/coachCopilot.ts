// Coach Copilot (November 2026): each week Cooked PT reads every client's plan and Cooked data (by consent)
// and says who needs you, who's slipping and who deserves a shout-out, with a reply drafted for each. Plus two
// plan tools: move missed workouts forward ("reflow"), and next targets from what they actually lifted ("progress").
// Everything here is plain math, so it works without AI; server/coachCopilot.ts can add AI wording on top.
import type { Assigned, ClientSide, Coaching } from "./coach";
import { fromKg, type FitData, type Units, type Workout } from "./fit";

export type Flag = { kind: string; level: "urgent" | "watch" | "win"; text: string };
export type ClientFacts = {
  name: string; workoutsDone: number; workoutsDue: number; habitsDone: number; habitsDue: number;
  daysSinceWorkout: number | null; missed: number; upcoming: number;
  weightChangeKg: number | null; foodDays: number; avgKcal: number | null; kcalTarget: number | null;
  unread: number; daysSinceClientMsg: number | null; checkinDue: boolean; newPRs: string[]; units: Units;
  /** False when the client doesn't share workouts: then "no workout logged" can't be known. */
  sharesWorkouts: boolean;
};

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const back = (now: Date, n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return day(d); };
const between = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 864e5);
const doneIds = (w: Workout[] | undefined) => new Set((w ?? []).filter((x) => x.programId === "coach").map((x) => x.dayId));

export function clientFacts(i: { name: string; coaching: Coaching; side: ClientSide; fit: FitData | null; unread: number; lastClientMsg?: string | null; kcalTarget?: number | null; checkinDue?: boolean; sharesWorkouts?: boolean }, now = new Date()): ClientFacts {
  const today = day(now), wk = back(now, 6);
  const fit = i.fit; const done = doneIds(fit?.workouts);
  const isDone = (a: Assigned) => !!a.done || done.has(a.id);
  const due = i.coaching.assigned.filter((a) => a.date >= wk && a.date <= today);
  let hDone = 0, hDue = 0;
  for (let k = 0; k < 7; k++) { const d = new Date(now); d.setDate(d.getDate() - k); const key = day(d); for (const h of i.coaching.habits) if (!h.days.length || h.days.includes(d.getDay())) { hDue++; if (i.side.habitLog[key]?.includes(h.id)) hDone++; } }
  const workouts = fit?.workouts ?? [];
  const last = workouts.length ? workouts.reduce((t, w) => (w.date > t ? w.date : t), "") : "";
  const weights = (fit?.weights ?? []).filter((w) => w.date >= back(now, 14)).sort((a, b) => a.date.localeCompare(b.date));
  const foods = (fit?.foods ?? []).filter((f) => f.date >= wk && f.date <= today);
  const byDay = new Map<string, number>(); for (const f of foods) byDay.set(f.date, (byDay.get(f.date) ?? 0) + f.kcal * f.servings);
  const kcals = [...byDay.values()].filter((k) => k > 300);
  return {
    name: i.name, workoutsDone: due.filter(isDone).length, workoutsDue: due.length, habitsDone: hDone, habitsDue: hDue,
    daysSinceWorkout: last ? between(last, today) : null,
    missed: due.filter((a) => a.date < today && !isDone(a)).length,
    upcoming: i.coaching.assigned.filter((a) => a.date > today && a.date <= back(now, -7)).length,
    weightChangeKg: weights.length >= 2 ? Math.round((weights[weights.length - 1].kg - weights[0].kg) * 10) / 10 : null,
    foodDays: byDay.size, avgKcal: kcals.length ? Math.round(kcals.reduce((t, k) => t + k, 0) / kcals.length) : null, kcalTarget: i.kcalTarget ?? null,
    unread: i.unread, daysSinceClientMsg: i.lastClientMsg ? between(i.lastClientMsg.slice(0, 10), today) : null,
    checkinDue: !!i.checkinDue, newPRs: newPRs(workouts, now), units: fit?.profile.units ?? "lb", sharesWorkouts: i.sharesWorkouts !== false,
  };
}

/** Exercises where this week's best set beat everything before it. */
export function newPRs(workouts: Workout[], now = new Date()): string[] {
  const wk = back(now, 6); const best = new Map<string, number>(); const recent = new Map<string, { name: string; e: number }>();
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) for (const ex of w.exercises) for (const s of ex.sets) {
    if (!s.done || s.warm || s.reps <= 0 || s.weight <= 0 || s.reps > 12) continue;
    const e = s.weight * (1 + s.reps / 30);
    if (w.date >= wk) { const before = best.get(ex.exId) ?? 0; if (before > 0 && e > before * 1.005 && e > (recent.get(ex.exId)?.e ?? 0)) recent.set(ex.exId, { name: ex.name, e }); }
    else best.set(ex.exId, Math.max(best.get(ex.exId) ?? 0, e));
  }
  return [...recent.values()].map((x) => x.name).slice(0, 3);
}

/** What the coach should know, most urgent first. */
export function flags(f: ClientFacts): Flag[] {
  const out: Flag[] = []; const first = f.name.split(" ")[0];
  if (f.unread > 0) out.push({ kind: "unread", level: "urgent", text: `${f.unread} unread message${f.unread === 1 ? "" : "s"} from ${first}` });
  if (f.daysSinceWorkout !== null && f.daysSinceWorkout >= 7) out.push({ kind: "quiet", level: "urgent", text: `No workout in ${f.daysSinceWorkout} days` });
  else if (f.daysSinceWorkout === null && f.workoutsDue > 0 && f.sharesWorkouts) out.push({ kind: "quiet", level: "urgent", text: "Hasn't logged a workout yet" });
  if (f.missed >= 2) out.push({ kind: "missed", level: "watch", text: `Missed ${f.missed} of ${f.workoutsDue} workouts this week` });
  if (f.workoutsDue === 0 && f.upcoming === 0) out.push({ kind: "noplan", level: "watch", text: "Nothing on the plan for this week or next" });
  else if (f.upcoming === 0) out.push({ kind: "planEnds", level: "watch", text: "Plan runs out this week" });
  if (f.habitsDue >= 5 && f.habitsDone / f.habitsDue < 0.4) out.push({ kind: "habits", level: "watch", text: `Habits ${f.habitsDone} of ${f.habitsDue} this week` });
  if (f.kcalTarget && f.avgKcal && f.foodDays >= 3 && Math.abs(f.avgKcal - f.kcalTarget) / f.kcalTarget > 0.2) out.push({ kind: "kcal", level: "watch", text: `Eating about ${f.avgKcal} kcal a day, target ${f.kcalTarget}` });
  if (f.weightChangeKg !== null && Math.abs(f.weightChangeKg) >= 1.5) { const w = Math.round(Math.abs(fromKg(f.weightChangeKg, f.units)) * 10) / 10; out.push({ kind: "weight", level: "watch", text: `Weight ${f.weightChangeKg < 0 ? "down" : "up"} ${w} ${f.units} in 2 weeks` }); }
  if (f.checkinDue) out.push({ kind: "checkin", level: "watch", text: "Check-in due today" });
  if (f.workoutsDue >= 2 && f.workoutsDone === f.workoutsDue) out.push({ kind: "perfect", level: "win", text: `Hit all ${f.workoutsDue} workouts this week` });
  if (f.newPRs.length) out.push({ kind: "pr", level: "win", text: `New best on ${f.newPRs.join(", ")}` });
  if (f.weightChangeKg !== null && f.weightChangeKg <= -0.4 && f.weightChangeKg > -1.5) out.push({ kind: "steady", level: "win", text: "Weight trending down steadily" });
  const rank = { urgent: 0, watch: 1, win: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** A ready-to-send message for the most important thing (the coach edits before sending). */
export function draftFor(f: ClientFacts, fl: Flag[] = flags(f)): string {
  const n = f.name.split(" ")[0]; const top = fl[0]?.kind;
  switch (top) {
    case "unread": return `Hey ${n}, sorry for the wait! Reading your message now.`;
    case "quiet": return `Hey ${n}, haven't seen a workout from you in a bit. Everything okay? If the week got crazy, let's make the plan fit it. What days work for you?`;
    case "missed": return `Hey ${n}, I noticed a few workouts slipped this week. No stress. Want me to move them to days that suit you better, or shorten them?`;
    case "noplan": case "planEnds": return `Hey ${n}, your next block is coming. Anything you want more (or less) of?`;
    case "habits": return `Hey ${n}, how are the daily habits going? If one isn't working, tell me and we'll swap it for something easier to stick with.`;
    case "kcal": return `Hey ${n}, looking at your food log, your calories are a bit off target. Want to go over a couple of easy swaps?`;
    case "weight": return `Hey ${n}, I saw your weight moved quite a bit these two weeks. How are you feeling, and how's sleep and hunger?`;
    case "checkin": return `Hey ${n}, your check-in is due today. It takes 2 minutes and helps me adjust your plan.`;
    case "perfect": return `${n}, you hit every workout this week. That's exactly how results happen. Proud of you!`;
    case "pr": return `${n}, new personal best on ${f.newPRs[0]}! Keep it rolling.`;
    case "steady": return `${n}, your weight is coming down steady, which is exactly the pace we want. Keep doing what you're doing.`;
    default: return `Hey ${n}, checking in. How's the week going?`;
  }
}
export const score = (fl: Flag[]) => fl.reduce((t, f) => t + (f.level === "urgent" ? 10 : f.level === "watch" ? 3 : 0), 0);

// ── Plan tools ────────────────────────────────────────────────────────────────────────────────────────────
export type Move = { id: string; name: string; from: string; to: string };
/** Moves workouts missed in the last week to the next free days (one a day, keeping their order). */
export function reflow(c: Coaching, workouts: Workout[] | undefined, now = new Date(), opts: { days?: number[] } = {}): { assigned: Assigned[]; moves: Move[] } {
  const today = day(now); const done = doneIds(workouts);
  const missed = c.assigned.filter((a) => a.date < today && a.date >= back(now, 7) && !a.done && !done.has(a.id)).sort((a, b) => a.date.localeCompare(b.date));
  const taken = new Set(c.assigned.filter((a) => a.date >= today).map((a) => a.date));
  const moves: Move[] = [];
  let k = 0;
  for (const a of missed) {
    let to = ""; for (; k < 60; k++) { const d = new Date(now); d.setDate(d.getDate() + k); const key = day(d); if (!taken.has(key) && (!opts.days?.length || opts.days.includes(d.getDay()))) { to = key; k++; break; } }
    if (!to) break; taken.add(to); moves.push({ id: a.id, name: a.name, from: a.date, to });
  }
  const at = new Map(moves.map((m) => [m.id, m.to]));
  return { assigned: c.assigned.map((a) => (at.has(a.id) ? { ...a, date: at.get(a.id)! } : a)).sort((a, b) => a.date.localeCompare(b.date)), moves };
}

export type Bump = { id: string; date: string; exId: string; name: string; last: string; next: string };
const repRange = (r: string): [number, number] | null => { const m = /^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/.exec(r.trim()); if (!m) return null; const lo = Number(m[1]); return [lo, m[2] ? Number(m[2]) : lo]; };
/** Next targets for upcoming workouts from the last time each lift was done: all reps hit at the top → add weight;
 *  short of the bottom → stay; otherwise add a rep. Written into each exercise's note. */
export function progress(c: Coaching, workouts: Workout[] | undefined, units: Units, now = new Date()): { assigned: Assigned[]; bumps: Bump[] } {
  const today = day(now), end = back(now, -14);
  const lastOf = new Map<string, { w: number; reps: number[] }>();
  for (const w of [...(workouts ?? [])].sort((a, b) => a.date.localeCompare(b.date))) for (const ex of w.exercises) {
    const sets = ex.sets.filter((s) => s.done && !s.warm && s.reps > 0 && s.weight > 0);
    if (!sets.length) continue;
    const top = Math.max(...sets.map((s) => s.weight));
    lastOf.set(ex.exId, { w: top, reps: sets.filter((s) => s.weight === top).map((s) => s.reps) });
  }
  const step = units === "kg" ? 2.5 : 5; const show = (kg: number) => Math.round(fromKg(kg, units) / step) * step;
  const bumps: Bump[] = [];
  const assigned = c.assigned.map((a) => {
    if (a.date < today || a.date > end || a.done) return a;
    let changed = false;
    const items = a.items.map((it) => {
      const last = lastOf.get(it.exId); const range = repRange(it.reps);
      if (!last || !range) return it;
      const [lo, hi] = range; const wDisp = show(last.w);
      const lastTxt = `${wDisp} ${units} × ${last.reps.join(", ")}`;
      const hitTop = last.reps.length >= Math.min(it.sets, 2) && last.reps.every((r) => r >= hi);
      const short = last.reps.some((r) => r < lo);
      const next = hitTop ? `${Math.max(wDisp + step, Math.round(wDisp * 1.025 / step) * step)} ${units}` : short ? `${wDisp} ${units} again` : `${wDisp} ${units}, one more rep`;
      const note = `Target ${next} (last time ${lastTxt})`;
      if ((it.note ?? "").startsWith("Target ")) { if (it.note === note) return it; }
      changed = true; bumps.push({ id: a.id, date: a.date, exId: it.exId, name: it.name, last: lastTxt, next });
      const rest = (it.note ?? "").replace(/^Target [^)]*\)\s*·?\s*/, "");
      return { ...it, note: rest ? `${note} · ${rest}` : note };
    });
    return changed ? { ...a, items } : a;
  });
  return { assigned, bumps };
}
