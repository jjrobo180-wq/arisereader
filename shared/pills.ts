// Pill reminders for the LifeHub: which doses are due on a day, taking or skipping one (which also
// counts down the supply), how many were taken lately, and when it's time to refill.
import type { Family, Pill, PillDose } from "./familyHub";

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const doseId = (pillId: string, date: string, time: string) => `${pillId}:${date}:${time}`;

/** Does this pill have doses on this day? */
export function scheduledOn(p: Pill, date: string): boolean {
  if (!p.active) return false;
  if (p.start && date < p.start) return false;
  if (p.end && date > p.end) return false;
  return p.days.includes(weekday(date));
}

export type DueDose = { pill: Pill; date: string; time: string; id: string; status: "taken" | "skipped" | null; at: string };

/** Every dose due on a day, in time order, with whether it was taken or skipped. */
export function dosesOn(family: Pick<Family, "pills" | "pillDoses">, date: string, memberId?: string): DueDose[] {
  const done = new Map(family.pillDoses.filter((d) => d.date === date).map((d) => [d.id, d]));
  const out: DueDose[] = [];
  for (const p of family.pills) {
    if ((memberId && p.memberId !== memberId) || !scheduledOn(p, date)) continue;
    for (const time of p.times) {
      const id = doseId(p.id, date, time), d = done.get(id);
      out.push({ pill: p, date, time, id, status: d?.status ?? null, at: d?.at ?? "" });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.pill.name.localeCompare(b.pill.name));
}

/** Marks a dose taken or skipped (or clears it with null). Taking one uses up `perDose` from the supply; undoing gives it back. */
export function markDose<F extends Pick<Family, "pills" | "pillDoses">>(family: F, pillId: string, date: string, time: string, status: "taken" | "skipped" | null, at: string): F {
  const id = doseId(pillId, date, time);
  const before = family.pillDoses.find((d) => d.id === id)?.status ?? null;
  if (before === status) return family;
  const doses: PillDose[] = family.pillDoses.filter((d) => d.id !== id);
  if (status) doses.push({ id, pillId, date, time, status, at });
  const change = (before === "taken" ? 1 : 0) - (status === "taken" ? 1 : 0); // +1 gives back, -1 uses one
  const pills = change === 0 ? family.pills : family.pills.map((p) => p.id === pillId && p.supply !== null ? { ...p, supply: Math.max(0, p.supply + change * p.perDose) } : p);
  return { ...family, pills, pillDoses: doses.slice(-12000) };
}

/** Taken out of scheduled over the last `days` days up to and including `today` (doses still to come today don't count against it). */
export function adherence(family: Pick<Family, "pills" | "pillDoses">, pill: Pill, today: string, days = 7, nowTime = "23:59"): { taken: number; due: number } {
  let taken = 0, due = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    for (const x of dosesOn({ pills: [pill], pillDoses: family.pillDoses }, date)) {
      if (date === today && x.time > nowTime && !x.status) continue;
      due++; if (x.status === "taken") taken++;
    }
  }
  return { taken, due };
}

/** About how many days the supply lasts at this schedule (null when supply isn't tracked). */
export function daysOfSupply(p: Pill): number | null {
  if (p.supply === null) return null;
  const perWeek = p.days.length * p.times.length * p.perDose;
  return perWeek ? Math.floor((p.supply / perWeek) * 7) : null;
}
export const needsRefill = (p: Pill) => p.active && p.supply !== null && p.supply <= p.refillAt;
