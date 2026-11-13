// Cooked: every reminder the iPhone sets on its own (local notifications), worked out in one place so
// the Notifications screen, the sleep schedule and the tests all agree. Fixed ids, so setting them again
// replaces the old ones:
//   100–106 workout days · 200–203 water · 300 weigh-in · 400 fast complete · 500 refuel (asked for after a workout)
//   600 wind down · 601 morning check-in · 602 bedtime · 700–703 meals · 704 food recap
// Medicine reminders (10000+) are set by the Medicine tracker and are never paused from here.
// Alerts from other people (trainer messages, buddies, groups) are sent by the server: see shared/fitPush.ts.

export type MealKey = "breakfast" | "lunch" | "dinner" | "snack";
export const MEALS: { key: MealKey; label: string; time: string; line: string }[] = [
  { key: "breakfast", label: "Breakfast", time: "07:30", line: "Breakfast time. Log what you eat to start the day on track." },
  { key: "lunch", label: "Lunch", time: "12:00", line: "Lunch time. Get some protein in and log it." },
  { key: "dinner", label: "Dinner", time: "18:00", line: "Dinner time. Log your meal in Cooked." },
  { key: "snack", label: "Snack", time: "15:30", line: "Snack check. Something with protein keeps you full till dinner." },
];

export type Reminders = {
  /** Every local reminder off for now (medicine stays on). */
  paused: boolean;
  workout: { on: boolean; hour: number; minute: number; days: number[] };
  water: boolean;
  weighIn: boolean;
  weighTime: string;
  fasting: boolean;
  food: { meals: Record<MealKey, { on: boolean; time: string }>; recap: { on: boolean; time: string } };
};

export const defaultReminders = (): Reminders => ({
  paused: false,
  workout: { on: false, hour: 18, minute: 0, days: [1, 2, 3, 4, 5] },
  water: false, weighIn: false, weighTime: "07:15", fasting: true,
  food: {
    meals: Object.fromEntries(MEALS.map((m) => [m.key, { on: false, time: m.time }])) as Reminders["food"]["meals"],
    recap: { on: false, time: "20:30" },
  },
});

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const time = (v: unknown, fb: string) => (typeof v === "string" && TIME.test(v) ? v : fb);

/** Saved settings, made safe (older saves had only workout, water, weigh-in and fasting). */
export function cleanReminders(raw: any): Reminders {
  const d = defaultReminders();
  if (!raw || typeof raw !== "object") return d;
  const w = raw.workout && typeof raw.workout === "object" ? raw.workout : {};
  const hour = Number(w.hour), minute = Number(w.minute);
  const meals = { ...d.food.meals };
  for (const m of MEALS) { const x = raw.food?.meals?.[m.key]; if (x && typeof x === "object") meals[m.key] = { on: x.on === true, time: time(x.time, m.time) }; }
  return {
    paused: raw.paused === true,
    workout: {
      on: w.on === true,
      hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : d.workout.hour,
      minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : d.workout.minute,
      days: Array.isArray(w.days) ? [...new Set((w.days as unknown[]).map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort() : d.workout.days,
    },
    water: raw.water === true,
    weighIn: raw.weighIn === true,
    weighTime: time(raw.weighTime, d.weighTime),
    fasting: raw.fasting !== false,
    food: { meals, recap: { on: raw.food?.recap?.on === true, time: time(raw.food?.recap?.time, d.food.recap.time) } },
  };
}

export type SleepRemind = { bed: string; wake: string; windDown: boolean; morning: boolean; bedtime: boolean };
export type LocalReminder = { id: number; title: string; body: string; on: { weekday?: number; hour: number; minute: number }; url?: string };

const hm = (t: string, shift = 0) => {
  const [h, m] = t.split(":").map(Number);
  const x = (((h * 60 + m + shift) % 1440) + 1440) % 1440;
  return { hour: Math.floor(x / 60), minute: x % 60 };
};
const WORKOUT_LINES = ["Time to train. Your workout's ready in Cooked.", "Don't break the streak. Get your session in.", "The bar won't lift itself. Let's go.", "Ten minutes beats zero. Start a workout."];

/** Every repeating reminder ids, so all of them can be cancelled before the new set is scheduled. */
export const REPEATING_IDS = [...[0, 1, 2, 3, 4, 5, 6].map((d) => 100 + d), 200, 201, 202, 203, 300, 600, 601, 602, 700, 701, 702, 703, 704];

/** The repeating reminders to schedule (none when paused). iOS weekdays: 1 = Sunday … 7 = Saturday. */
export function buildLocalReminders(r: Reminders, sleep?: SleepRemind | null): LocalReminder[] {
  if (r.paused) return [];
  const out: LocalReminder[] = [];
  if (r.workout.on) for (const d of r.workout.days) out.push({ id: 100 + d, title: "Cooked", body: WORKOUT_LINES[d % WORKOUT_LINES.length], on: { weekday: d + 1, hour: r.workout.hour, minute: r.workout.minute } });
  if (r.water) [10, 13, 16, 19].forEach((h, i) => out.push({ id: 200 + i, title: "Hydrate", body: "Drink a glass of water and log it.", on: { hour: h, minute: 0 } }));
  if (r.weighIn) out.push({ id: 300, title: "Weigh-in", body: "Step on the scale before breakfast and log it.", on: hm(r.weighTime) });
  MEALS.forEach((m, i) => { const s = r.food.meals[m.key]; if (s.on) out.push({ id: 700 + i, title: m.label, body: m.line, on: hm(s.time), url: "arisefit://do/meal" }); });
  if (r.food.recap.on) out.push({ id: 704, title: "Log your day", body: "Anything you ate that isn't logged yet? Add it before bed.", on: hm(r.food.recap.time), url: "arisefit://do/meal" });
  if (sleep && TIME.test(sleep.bed) && TIME.test(sleep.wake)) {
    if (sleep.windDown) out.push({ id: 600, title: "Time to wind down", body: "Bedtime in 30 minutes. Dim the lights, put the phone down, or try a breathing session.", on: hm(sleep.bed, -30), url: "arisefit://do/sleep-start" });
    if (sleep.bedtime) out.push({ id: 602, title: "Bedtime", body: "Lights out. Tap to start tracking tonight's sleep.", on: hm(sleep.bed), url: "arisefit://do/sleep-start" });
    if (sleep.morning) out.push({ id: 601, title: "Good morning", body: "How did you sleep? Tap to check in.", on: hm(sleep.wake, 15), url: "arisefit://do/sleep" });
  }
  return out;
}
