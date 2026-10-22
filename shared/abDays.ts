// A and B days for the 2026-27 school year (from the CGMS all-in-one calendar). Only days the sheet gives a
// letter to are here; holidays, breaks and PD days with no letter are left out on purpose, so nothing is guessed.
// The same list is copied into client/public/ab-day.html for the home-screen widget, which cannot import code.

export type AbLetter = "A" | "B";

export const AB_DAYS: Record<string, AbLetter> = {
  "2026-08-13":"A", "2026-08-14":"B", "2026-08-17":"A", "2026-08-18":"B",
  "2026-08-19":"A", "2026-08-20":"B", "2026-08-21":"A", "2026-08-24":"B",
  "2026-08-25":"A", "2026-08-26":"B", "2026-08-27":"A", "2026-08-28":"B",
  "2026-08-31":"A", "2026-09-01":"B", "2026-09-02":"B", "2026-09-03":"A",
  "2026-09-04":"B", "2026-09-08":"A", "2026-09-09":"B", "2026-09-10":"A",
  "2026-09-11":"B", "2026-09-14":"A", "2026-09-15":"B", "2026-09-16":"A",
  "2026-09-17":"B", "2026-09-18":"A", "2026-09-21":"B", "2026-09-22":"A",
  "2026-09-23":"B", "2026-09-24":"A", "2026-09-28":"B", "2026-10-01":"A",
  "2026-10-02":"B", "2026-10-05":"A", "2026-10-06":"B", "2026-10-07":"A",
  "2026-10-15":"B", "2026-10-16":"A", "2026-10-19":"B", "2026-10-20":"A",
  "2026-10-21":"B", "2026-10-22":"A", "2026-10-23":"B", "2026-10-26":"A",
  "2026-10-27":"B", "2026-10-28":"A", "2026-10-29":"B", "2026-11-02":"A",
  "2026-11-03":"B", "2026-11-04":"A", "2026-11-05":"B", "2026-11-06":"A",
  "2026-11-09":"B", "2026-11-10":"A", "2026-11-11":"B", "2026-11-12":"A",
  "2026-11-13":"B", "2026-11-16":"A", "2026-11-17":"B", "2026-11-18":"A",
  "2026-11-19":"B", "2026-11-20":"A", "2026-11-30":"B", "2026-12-01":"A",
  "2026-12-02":"B", "2026-12-03":"A", "2026-12-04":"B", "2026-12-07":"A",
  "2026-12-10":"B", "2026-12-11":"A", "2026-12-14":"B", "2026-12-15":"A",
  "2026-12-16":"B", "2026-12-17":"A", "2027-01-05":"A", "2027-01-06":"B",
  "2027-01-07":"A", "2027-01-08":"B", "2027-01-11":"A", "2027-01-12":"B",
  "2027-01-13":"A", "2027-01-14":"B", "2027-01-15":"A", "2027-01-19":"B",
  "2027-01-20":"A", "2027-01-21":"B", "2027-01-22":"A", "2027-01-25":"B",
  "2027-01-26":"A", "2027-01-27":"B", "2027-01-28":"A", "2027-01-29":"B",
  "2027-02-01":"A", "2027-02-02":"B", "2027-02-04":"A", "2027-02-05":"B",
  "2027-02-08":"A", "2027-02-09":"B", "2027-02-10":"A", "2027-02-11":"B",
  "2027-02-12":"A", "2027-02-18":"A", "2027-02-19":"B", "2027-02-22":"A",
  "2027-02-23":"B", "2027-02-24":"A", "2027-02-25":"B", "2027-03-01":"A",
  "2027-03-02":"B", "2027-03-03":"A", "2027-03-04":"B", "2027-03-05":"A",
  "2027-03-08":"B", "2027-03-09":"A", "2027-03-10":"B", "2027-03-11":"A",
  "2027-03-12":"B", "2027-03-15":"A", "2027-03-16":"B", "2027-03-17":"A",
  "2027-03-18":"B", "2027-03-19":"A", "2027-03-22":"B", "2027-03-23":"A",
  "2027-03-24":"B", "2027-03-25":"A", "2027-03-26":"B", "2027-04-05":"A",
  "2027-04-06":"B", "2027-04-07":"A", "2027-04-08":"B", "2027-04-09":"A",
  "2027-04-12":"B", "2027-04-13":"A", "2027-04-15":"B", "2027-04-16":"A",
  "2027-04-19":"B", "2027-04-20":"A", "2027-04-21":"B", "2027-04-22":"A",
  "2027-04-23":"B", "2027-04-26":"A", "2027-04-27":"B", "2027-04-28":"A",
  "2027-04-29":"B", "2027-04-30":"A", "2027-05-03":"B", "2027-05-04":"A",
  "2027-05-05":"B", "2027-05-06":"A", "2027-05-07":"B", "2027-05-10":"A",
  "2027-05-11":"B", "2027-05-12":"A", "2027-05-13":"A", "2027-05-14":"B",
  "2027-05-17":"A", "2027-05-18":"B", "2027-05-19":"A", "2027-05-20":"B",
  "2027-05-21":"A", "2027-05-25":"A", "2027-05-26":"B", "2027-05-27":"B",
};

/** Marks the all-day events this feature adds, so they can be found and removed without touching anything else. */
export const AB_NOTE = "A/B day schedule (added by Arise)";

export const abLetterOn = (date: string): AbLetter | null => AB_DAYS[date] ?? null;

/** The next days that have a letter, starting at `from` (included), up to `count`. */
export function upcomingAb(from: string, count: number): { date: string; letter: AbLetter }[] {
  return Object.keys(AB_DAYS).sort().filter((d) => d >= from).slice(0, Math.max(0, count)).map((date) => ({ date, letter: AB_DAYS[date] }));
}

type AbEvent = { id: string; title: string; date: string; start: string; end: string; location: string; notes: string };
type WithEvents = { events: any[] };

export const isAbEvent = (e: { notes?: string; calendarId?: string }) => e.notes === AB_NOTE && !e.calendarId;

export const abOnCalendar = (ws: WithEvents): boolean => ws.events.some(isAbEvent);

/** Puts an all-day "A Day" / "B Day" on every day with a letter. Running it twice never doubles them up, and days
 *  the teacher already has an event for with that same title are left alone. `from` leaves out days before it. */
export function addAbDays<T extends WithEvents>(ws: T, makeId: () => string, from = ""): T {
  const have = new Set(ws.events.filter(isAbEvent).map((e) => e.date));
  const fresh: AbEvent[] = Object.entries(AB_DAYS)
    .filter(([date]) => date >= from && !have.has(date))
    .map(([date, letter]) => ({ id: makeId(), title: `${letter} Day`, date, start: "", end: "", location: "", notes: AB_NOTE }));
  return fresh.length ? { ...ws, events: [...ws.events, ...fresh] } : ws;
}

/** Takes off only the events this feature added. */
export function removeAbDays<T extends WithEvents>(ws: T): T {
  return abOnCalendar(ws) ? { ...ws, events: ws.events.filter((e) => !isAbEvent(e)) } : ws;
}
