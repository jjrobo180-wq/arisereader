// Arise Fit: what to expect after a workout. Which muscles will likely be sore and when, how much
// protein and carbs to eat and by when, how much to drink, and plain facts on creatine and pre-workout.
// General guidance for healthy adults, not medical advice: the app says so where it shows this.
import { CATALOG_BY_ID, type FitData, type Workout } from "./fit";

export type Soreness = { muscle: string; sets: number; level: "light" | "moderate" | "strong"; isNew: boolean };
export type Debrief = {
  sore: Soreness[];
  /** When soreness usually peaks, in plain words. */
  peak: string;
  protein: { lo: number; hi: number };
  carbs: { lo: number; hi: number } | null;
  /** Eat by (ms). */
  eatBy: number;
  waterMl: number;
  tips: string[];
};

const NAME: Record<string, string> = { chest: "Chest", back: "Back", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Core", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves", "full body": "Full body" };

export function debrief(w: Workout, data: Pick<FitData, "workouts" | "profile" | "weights">, now = Date.now()): Debrief {
  // Sets per muscle: the main muscle counts a whole set, helpers half.
  const sets = new Map<string, number>();
  const fresh = new Set<string>();
  const month = now - 28 * 864e5;
  const before = data.workouts.filter((x) => x.id !== w.id && Date.parse(x.date) >= month);
  for (const e of w.exercises) {
    const ex = CATALOG_BY_ID.get(e.exId);
    if (!ex || ex.muscle === "cardio") continue;
    const n = e.sets.filter((s) => s.done !== false && !s.warm).length;
    sets.set(ex.muscle, (sets.get(ex.muscle) ?? 0) + n);
    for (const m of ex.also) if (m !== "cardio") sets.set(m, (sets.get(m) ?? 0) + n / 2);
    if (!before.some((x) => x.exercises.some((y) => y.exId === e.exId))) fresh.add(ex.muscle);
  }
  const sore: Soreness[] = [...sets.entries()].filter(([m, n]) => n >= 2 && NAME[m])
    .map(([m, n]) => {
      const isNew = fresh.has(m);
      const score = n + (isNew ? 4 : 0);
      return { muscle: NAME[m], sets: Math.round(n), level: (score >= 12 ? "strong" : score >= 6 ? "moderate" : "light") as Soreness["level"], isNew };
    })
    .sort((a, b) => b.sets - a.sets).slice(0, 6);
  const kg = [...(data.weights ?? [])].sort((a, b) => a.date.localeCompare(b.date)).pop()?.kg;
  // About 0.3 g of protein per kg after training (20–40 g for most people).
  const protein = kg ? { lo: Math.max(20, Math.round(kg * 0.25)), hi: Math.min(50, Math.round(kg * 0.4)) } : { lo: 25, hi: 40 };
  const mins = w.secs / 60;
  const goal = data.profile.goal;
  // Carbs refill what a long or hard session used; less when the goal is losing fat.
  const carbs = !kg ? (goal === "lose" ? { lo: 20, hi: 40 } : { lo: 40, hi: 80 }) : goal === "lose" ? { lo: Math.round(kg * 0.3), hi: Math.round(kg * 0.5) } : { lo: Math.round(kg * (mins >= 60 ? 0.8 : 0.5)), hi: Math.round(kg * (mins >= 60 ? 1.2 : 0.8)) };
  const waterMl = Math.round(Math.max(400, Math.min(1500, mins * 12)) / 50) * 50;
  const strong = sore.some((s) => s.level === "strong");
  const tips = [
    strong ? "Expect real soreness tomorrow and the day after. Easy walking and light stretching help it fade faster than resting completely." : "Mild soreness is normal. Moving around lightly tomorrow helps.",
    "Sleep 7 to 9 hours tonight: it's when your muscles rebuild.",
    ...(sore.some((s) => s.isNew) ? ["You did some new exercises, so those muscles may be sorer than usual. That fades as you repeat them."] : []),
    "Sharp pain, swelling, or pain in a joint isn't normal soreness. Rest it, and see a doctor if it doesn't improve.",
  ];
  return { sore, peak: strong ? "24 to 72 hours, worst around day 2" : "24 to 48 hours", protein, carbs: carbs.hi > 0 ? carbs : null, eatBy: now + 2 * 3600_000, waterMl, tips };
}

/** Plain facts about two supplements people ask about. */
export const SUPPLEMENTS = [
  {
    id: "creatine", name: "Creatine", e: "🧪",
    lead: "The most researched supplement for strength. It helps you do a rep or two more and build muscle a little faster.",
    points: [
      "Take 3 to 5 g of creatine monohydrate every day. The time of day doesn't matter; taking it every day does.",
      "No loading phase is needed. It takes about 3 to 4 weeks to fully build up.",
      "You may gain 1 to 3 lb of water in your muscles. That's normal, not fat.",
      "Look for a product that's third-party tested (NSF Certified for Sport or Informed Sport).",
      "Talk to a doctor first if you have kidney problems, are pregnant, or are under 18.",
    ],
  },
  {
    id: "preworkout", name: "Pre-workout", e: "⚡",
    lead: "Mostly caffeine. It can help you feel more alert and push a bit harder, but food and sleep matter more.",
    points: [
      "Have it 30 to 60 minutes before training. A cup or two of coffee works the same way for most people.",
      "Most adults should stay under 400 mg of caffeine a day from everything combined. Check the label: some scoops have 300 mg.",
      "Skip it within about 6 hours of bedtime, or it can hurt your sleep (and your recovery).",
      "Tingling skin is beta-alanine. It's harmless.",
      "Skip it if you're under 18, pregnant, or have heart problems or high blood pressure.",
      "A carb snack 1 to 2 hours before (a banana, toast, oatmeal) gives energy without any caffeine.",
    ],
  },
] as const;
