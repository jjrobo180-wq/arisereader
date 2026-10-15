// Arise WorkHub: which phone reminders a teacher wants, and when.
// Saved with the workspace (so it follows the account to every device) and read by the server's
// reminder pass in shared/hubReminders.ts. Out of the box it is what WorkHub always sent: a morning
// summary any time from 7:00, and a heads-up 15 minutes before an event. The new heads-ups
// (timed to-dos, meetings) are on too, because they only ever fire for things with a start time.

export type HubNotify = {
  /** The morning summary: sent from this time ("HH:MM", 24-hour) for the next five hours, once a day. */
  morning: { on: boolean; time: string };
  /** A heads-up this many minutes before something with a start time. */
  headsUp: { on: boolean; minutes: number; events: boolean; tasks: boolean; meetings: boolean };
};

export const HUB_HEADS_UP_CHOICES = [5, 10, 15, 30, 60] as const;
export const HUB_MORNING_WINDOW_MINUTES = 5 * 60;

export const defaultHubNotify = (): HubNotify => ({
  morning: { on: true, time: "07:00" },
  headsUp: { on: true, minutes: 15, events: true, tasks: true, meetings: true },
});

const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const clock = (v: unknown, fallback: string) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);

/** Whatever was saved, made safe: anything missing or odd falls back to the default. */
export function cleanHubNotify(raw: unknown): HubNotify {
  const d = defaultHubNotify();
  const r = obj(raw), m = obj(r.morning), h = obj(r.headsUp);
  const minutes = Number(h.minutes);
  return {
    morning: { on: bool(m.on, d.morning.on), time: clock(m.time, d.morning.time) },
    headsUp: {
      on: bool(h.on, d.headsUp.on),
      minutes: (HUB_HEADS_UP_CHOICES as readonly number[]).includes(minutes) ? minutes : d.headsUp.minutes,
      events: bool(h.events, true), tasks: bool(h.tasks, true), meetings: bool(h.meetings, true),
    },
  };
}
