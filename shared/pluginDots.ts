// Red dots on plugins (Nov 25, 2026): a plugin shows a red dot while something in it is waiting to be tracked today
// (water, a meal, a workout, a dose, a habit, a chore...), and the dot goes away once it's done. Built from the same
// check-ins as the task list (shared/dailyCheckins.ts), so a plugin is "waiting" exactly when its check-in is open.
// A check-in with a time waits from that time; one without a time (water) waits all day until it's done.
import type { Checkin } from "./dailyCheckins";

const mins = (hm: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; };

/** How many things are waiting, by plugin section ("cooked", "habits"...) and, inside Health & Fitness, by part
 *  ("fit:water", "fit:food"...). The task list itself ("tasks") isn't counted: it has its own number. */
export function pendingDots(rows: readonly Checkin[], minute: number): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (k: string) => { out[k] = (out[k] ?? 0) + 1; };
  for (const c of rows as (Checkin & { hidden?: boolean; open?: { section?: string; app?: string } })[]) {
    if (c.done || c.hidden) continue;
    const at = c.time ? mins(c.time) : -1;
    if (at >= 0 && at > minute) continue;
    const section = c.open?.section;
    if (!section || section === "tasks") continue;
    add(section);
    if (section === "cooked" && c.open?.app) add(`fit:${c.open.app}`);
  }
  return out;
}
