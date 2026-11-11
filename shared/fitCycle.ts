// Cooked "Period tracker" plugin: log flow and symptoms by day, see the cycle day, the next period and
// the fertile window. Predictions reuse LifeHub's calendar method (shared/familyCycle.ts); they are
// estimates for planning, not birth control or medical advice. Kept with a person's Cooked data.
import { cycleSummary, SYMPTOMS, type CycleSummary } from "./familyCycle";
import { FLOWS, type CycleLog, type Flow } from "./familyHub";

export { SYMPTOMS, FLOWS };
export type CycleEntry = { date: string; flow: Flow; symptoms: string[]; note: string };
export type FitCycle = { entries: CycleEntry[]; /** Remind me a couple of days before the next period. */ remind: boolean };

const isDay = (k: unknown): k is string => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);

export function cleanCycle(raw: any): FitCycle | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const seen = new Set<string>();
  const entries: CycleEntry[] = (Array.isArray(raw.entries) ? raw.entries : []).filter((e: any) => isDay(e?.date)).map((e: any): CycleEntry => ({
    date: e.date, flow: (["none", ...FLOWS] as string[]).includes(e.flow) ? e.flow : "none",
    symptoms: (Array.isArray(e.symptoms) ? e.symptoms : []).filter((s: unknown): s is string => typeof s === "string" && SYMPTOMS.includes(s)).slice(0, 12),
    note: typeof e.note === "string" ? e.note.trim().slice(0, 300) : "",
  })).filter((e: CycleEntry) => (seen.has(e.date) ? false : (seen.add(e.date), true))).filter(entryUsed).sort((a: CycleEntry, b: CycleEntry) => a.date.localeCompare(b.date)).slice(-1500);
  return entries.length || raw.remind ? { entries, remind: !!raw.remind } : undefined;
}

export const entryUsed = (e: CycleEntry) => e.flow !== "none" || e.symptoms.length > 0 || !!e.note;

/** Save one day's entry (an empty one removes the day). */
export function setEntry(c: FitCycle | undefined, entry: CycleEntry): FitCycle {
  const cur = c ?? { entries: [], remind: false };
  const rest = cur.entries.filter((e) => e.date !== entry.date);
  return { ...cur, entries: (entryUsed(entry) ? [...rest, entry] : rest).sort((a, b) => a.date.localeCompare(b.date)) };
}

export const entryOn = (c: FitCycle | undefined, day: string): CycleEntry => c?.entries.find((e) => e.date === day) ?? { date: day, flow: "none", symptoms: [], note: "" };

/** The cycle so far: length, the next period and the fertile window. */
export function summaryOf(c: FitCycle | undefined, today: string): CycleSummary {
  const logs: CycleLog[] = (c?.entries ?? []).map((e) => ({ id: e.date, memberId: "me", date: e.date, flow: e.flow, symptoms: e.symptoms, note: e.note }));
  return cycleSummary(logs, "me", today);
}
