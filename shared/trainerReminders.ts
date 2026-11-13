// Cooked PT: reminders the trainer's iPhone sets on its own: before each booked session, and a daily
// "plan your day". Ids 20000–20099 sessions, 20100 daily plan. Alerts from clients (messages, check-ins)
// come from the server: see shared/fitPush.ts.

export type TrainerReminders = { paused: boolean; before: 0 | 15 | 30 | 60; daily: { on: boolean; time: string } };
export const defaultTrainerReminders = (): TrainerReminders => ({ paused: false, before: 30, daily: { on: false, time: "07:00" } });
export const BEFORE_CHOICES = [0, 15, 30, 60] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function cleanTrainerReminders(raw: any): TrainerReminders {
  const d = defaultTrainerReminders();
  if (!raw || typeof raw !== "object") return d;
  return {
    paused: raw.paused === true,
    before: (BEFORE_CHOICES as readonly number[]).includes(Number(raw.before)) ? (Number(raw.before) as TrainerReminders["before"]) : d.before,
    daily: { on: raw.daily?.on === true, time: typeof raw.daily?.time === "string" && TIME.test(raw.daily.time) ? raw.daily.time : d.daily.time },
  };
}

export const TRAINER_IDS = [...Array.from({ length: 100 }, (_, i) => 20000 + i), 20100];
export type Appt = { at: string; mins: number; client: string; place?: string };
export type TrainerNote = { id: number; title: string; body: string; at?: string; on?: { hour: number; minute: number } };

/** The reminders to set: one before each upcoming session (the next 100), and the daily plan. */
export function buildTrainerReminders(r: TrainerReminders, appts: Appt[], now: number): TrainerNote[] {
  if (r.paused) return [];
  const out: TrainerNote[] = [];
  if (r.before > 0) {
    const coming = appts.map((a) => ({ ...a, t: Date.parse(a.at) - r.before * 60_000 })).filter((a) => Number.isFinite(a.t) && a.t > now + 60_000).sort((a, b) => a.t - b.t).slice(0, 100);
    coming.forEach((a, i) => out.push({ id: 20000 + i, title: `Session in ${r.before} min`, body: `${a.client}${a.mins ? ` · ${a.mins} min` : ""}${a.place ? ` · ${a.place}` : ""}`, at: new Date(a.t).toISOString() }));
  }
  if (r.daily.on) { const [hour, minute] = r.daily.time.split(":").map(Number); out.push({ id: 20100, title: "Plan your day", body: "See today's sessions, check-ins and messages in Cooked PT.", on: { hour, minute } }); }
  return out;
}
