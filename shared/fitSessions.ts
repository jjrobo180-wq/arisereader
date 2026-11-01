// Arise Fit guided sessions: timed workouts the app talks you through, phase by phase. HIIT on the
// treadmill (speed and incline for each interval), Couch to 5K (the standard 9-week run/walk plan),
// yoga flows and guided meditation. Written for Arise Fit.

export type PhaseKind = "warm" | "work" | "rest" | "cool" | "pose" | "breathe-in" | "hold" | "breathe-out" | "still";
export type Phase = { name: string; secs: number; kind: PhaseKind; cue?: string; speed?: number; incline?: number };
export type SessionCategory = "hiit" | "c25k" | "yoga" | "meditation";
export type Session = { id: string; name: string; category: SessionCategory; blurb: string; level: "Beginner" | "Intermediate" | "Advanced"; equipment: string; phases: Phase[]; week?: number; day?: number };

export const sessionSecs = (s: Session) => s.phases.reduce((t, p) => t + p.secs, 0);
export const sessionMins = (s: Session) => Math.round(sessionSecs(s) / 60);

const P = (name: string, secs: number, kind: PhaseKind, extra: Omit<Partial<Phase>, "name" | "secs" | "kind"> = {}): Phase => ({ name, secs, kind, ...extra });
const rep = (n: number, ps: Phase[]) => Array.from({ length: n }, () => ps).flat();
const warmWalk = (mins = 5, speed?: number) => P("Warm-up walk", mins * 60, "warm", { cue: "Brisk walk. Loosen up, breathe easy.", ...(speed ? { speed } : {}) });
const coolWalk = (mins = 5, speed?: number) => P("Cool-down walk", mins * 60, "cool", { cue: "Slow it down. Let your heart rate come back.", ...(speed ? { speed } : {}) });

// ——— HIIT treadmill ————————————————————————————————————————————————————————————————————————————
const HIIT: Session[] = [
  { id: "hiit-30-30", name: "30/30 Sprints", category: "hiit", level: "Intermediate", equipment: "Treadmill", blurb: "Twelve rounds of 30 seconds hard, 30 seconds easy. 20 minutes, done.",
    phases: [warmWalk(4, 3.5), P("Jog", 60, "warm", { speed: 5.5, cue: "Easy jog to get ready." }), ...rep(12, [P("Sprint", 30, "work", { speed: 9, cue: "Go hard. Drive your arms." }), P("Recover", 30, "rest", { speed: 3.5, cue: "Walk it off. Breathe." })]), coolWalk(3, 3)] },
  { id: "hiit-ladder", name: "Sprint Ladder", category: "hiit", level: "Advanced", equipment: "Treadmill", blurb: "Sprints climb from 20 to 60 seconds and back down. Brutal and fast.",
    phases: [warmWalk(4, 3.5), P("Jog", 120, "warm", { speed: 5.5 }), ...[20, 30, 45, 60, 45, 30, 20].flatMap((s) => [P(`Sprint ${s}s`, s, "work", { speed: 9.5, cue: "Full effort." }), P("Recover", 60, "rest", { speed: 3.5 })]), coolWalk(4, 3)] },
  { id: "hiit-hills", name: "Hill Repeats", category: "hiit", level: "Intermediate", equipment: "Treadmill", blurb: "Power-walk and run up steep grades. Legs and lungs.",
    phases: [warmWalk(5, 3.5), ...rep(8, [P("Hill run", 60, "work", { speed: 6, incline: 8, cue: "Short strides, lean into the hill." }), P("Flat walk", 90, "rest", { speed: 3.2, incline: 1 })]), coolWalk(4, 3)] },
  { id: "hiit-tabata", name: "Treadmill Tabata", category: "hiit", level: "Advanced", equipment: "Treadmill", blurb: "Classic Tabata: 20 seconds all-out, 10 seconds off, eight rounds, twice.",
    phases: [warmWalk(5, 3.5), ...rep(8, [P("All out", 20, "work", { speed: 10, cue: "Everything you've got." }), P("Rest", 10, "rest", { speed: 3, cue: "Straddle the belt if you need to." })]), P("Walk", 120, "rest", { speed: 3.2 }), ...rep(8, [P("All out", 20, "work", { speed: 10 }), P("Rest", 10, "rest", { speed: 3 })]), coolWalk(4, 3)] },
  { id: "hiit-12-3-30", name: "12-3-30 Climb", category: "hiit", level: "Beginner", equipment: "Treadmill", blurb: "12% incline, 3 mph, 30 minutes. Low impact, serious burn.",
    phases: [P("Ramp up", 180, "warm", { speed: 3, incline: 4, cue: "Find your stride before the climb." }), P("The climb", 30 * 60, "work", { speed: 3, incline: 12, cue: "Hands off the rails. Stand tall." }), P("Ramp down", 180, "cool", { speed: 2.8, incline: 2 })] },
  { id: "hiit-pyramid", name: "Speed Pyramid", category: "hiit", level: "Intermediate", equipment: "Treadmill", blurb: "Speed steps up every minute to the peak, then back down.",
    phases: [warmWalk(4, 3.5), ...[5, 5.5, 6, 6.5, 7, 7.5, 8, 7.5, 7, 6.5, 6, 5.5].map((sp) => P(`${sp} mph`, 60, sp >= 7 ? "work" : "rest", { speed: sp })), coolWalk(4, 3)] },
];

// ——— Couch to 5K: the standard 9 weeks, three runs a week, each with a 5-minute walk either side ——
const run = (m: number) => P("Run", Math.round(m * 60), "work", { cue: "Run at a pace you could still talk at." });
const walk = (m: number) => P("Walk", Math.round(m * 60), "rest", { cue: "Walk briskly and get your breath back." });
const C25K_WEEKS: Phase[][][] = [
  [rep(8, [run(1), walk(1.5)])],
  [rep(6, [run(1.5), walk(2)])],
  [rep(2, [run(1.5), walk(1.5), run(3), walk(3)])],
  [[run(3), walk(1.5), run(5), walk(2.5), run(3), walk(1.5), run(5)]],
  [rep(3, [run(5), walk(3)]), [run(8), walk(5), run(8)], [run(20)]],
  [[run(5), walk(3), run(8), walk(3), run(5)], [run(10), walk(3), run(10)], [run(25)]],
  [[run(25)]],
  [[run(28)]],
  [[run(30)]],
];
const C25K: Session[] = C25K_WEEKS.flatMap((days, w) => [0, 1, 2].map((d) => {
  const core = days[Math.min(d, days.length - 1)];
  return { id: `c25k-w${w + 1}d${d + 1}`, name: `Week ${w + 1} · Run ${d + 1}`, category: "c25k" as const, week: w + 1, day: d + 1, level: "Beginner" as const, equipment: "Outside or treadmill",
    blurb: w === 8 && d === 2 ? "The big one: 30 minutes nonstop. That's a 5K." : core.length === 1 ? `${Math.round(core[0].secs / 60)} minutes running, nonstop.` : `${core.filter((p) => p.kind === "work").length} runs with walks between.`,
    phases: [warmWalk(5), ...core, coolWalk(5)] };
}));

// ——— Yoga ————————————————————————————————————————————————————————————————————————————————————————
const pose = (name: string, secs: number, cue: string) => P(name, secs, "pose", { cue });
const YOGA: Session[] = [
  { id: "yoga-lifter", name: "Lifter's Recovery", category: "yoga", level: "Beginner", equipment: "Mat", blurb: "Open up hips, hamstrings, chest and shoulders after heavy lifting.",
    phases: [pose("Child's pose", 60, "Knees wide, arms long, sink your hips back."), pose("Cat-cow", 60, "Round and arch with your breath."), pose("Downward dog", 45, "Push the floor away, heels toward the ground."), pose("Low lunge, left", 45, "Back knee down, hips forward."), pose("Low lunge, right", 45, "Switch sides."), pose("Pigeon, left", 60, "Square your hips, fold forward if you can."), pose("Pigeon, right", 60, "Switch sides."), pose("Seated forward fold", 60, "Hinge from the hips, long spine."), pose("Thread the needle, left", 40, "Shoulder and ear to the floor."), pose("Thread the needle, right", 40, "Switch sides."), pose("Supine twist, left", 45, "Knees to the side, look the other way."), pose("Supine twist, right", 45, "Switch sides."), pose("Corpse pose", 90, "Lie still. Let everything go heavy.")] },
  { id: "yoga-morning", name: "Morning Mobility", category: "yoga", level: "Beginner", equipment: "Mat", blurb: "Ten minutes to wake up stiff joints before the day.",
    phases: [pose("Mountain pose", 30, "Stand tall, breathe deep."), pose("Forward fold", 40, "Soft knees, let your head hang."), pose("Halfway lift", 20, "Flat back, hands on shins."), pose("Plank", 30, "Strong line from head to heels."), pose("Cobra", 30, "Lift the chest, shoulders down."), pose("Downward dog", 45, "Pedal your feet."), pose("World's greatest stretch, left", 40, "Lunge, elbow down, then reach up."), pose("World's greatest stretch, right", 40, "Switch sides."), pose("Warrior II, left", 40, "Front knee over ankle, arms wide."), pose("Warrior II, right", 40, "Switch sides."), pose("Chair pose", 30, "Sit back, arms up."), pose("Standing breath", 45, "Arms up as you breathe in, down as you breathe out.")] },
  { id: "yoga-hips", name: "Hip Opener", category: "yoga", level: "Intermediate", equipment: "Mat", blurb: "Tight hips from sitting and squatting, unlocked.",
    phases: [pose("Butterfly", 60, "Soles together, knees fall open."), pose("Frog", 60, "Knees wide, ease your hips back."), pose("Lizard, left", 50, "Forearms inside the front foot."), pose("Lizard, right", 50, "Switch sides."), pose("90/90, left", 50, "Both knees at right angles, sit tall."), pose("90/90, right", 50, "Switch sides."), pose("Deep squat", 60, "Heels down, elbows push knees out."), pose("Happy baby", 60, "Hold your feet, rock gently."), pose("Figure four, left", 45, "Ankle over knee, pull the leg in."), pose("Figure four, right", 45, "Switch sides."), pose("Corpse pose", 60, "Rest.")] },
  { id: "yoga-back", name: "Back Relief", category: "yoga", level: "Beginner", equipment: "Mat", blurb: "Gentle moves for a tight or sore lower back.",
    phases: [pose("Knees to chest", 60, "Hug both knees, rock side to side."), pose("Pelvic tilts", 45, "Flatten then arch your lower back, slowly."), pose("Cat-cow", 60, "Move with your breath."), pose("Child's pose", 60, "Breathe into your lower back."), pose("Sphinx", 60, "On forearms, relax your glutes."), pose("Supine twist, left", 50, "Let the knees drop."), pose("Supine twist, right", 50, "Switch sides."), pose("Bridge", 40, "Lift hips, squeeze glutes."), pose("Corpse pose", 90, "Rest.")] },
];

// ——— Meditation —————————————————————————————————————————————————————————————————————————————————
const box = (rounds: number) => rep(rounds, [P("Breathe in", 4, "breathe-in", { cue: "In through the nose." }), P("Hold", 4, "hold"), P("Breathe out", 4, "breathe-out", { cue: "Slow out through the mouth." }), P("Hold", 4, "hold")]);
const still = (name: string, secs: number, cue: string) => P(name, secs, "still", { cue });
const MEDITATION: Session[] = [
  { id: "med-box", name: "Box Breathing", category: "meditation", level: "Beginner", equipment: "None", blurb: "The technique Navy SEALs use to stay calm under pressure. 4 in, 4 hold, 4 out, 4 hold.",
    phases: [still("Settle", 20, "Sit tall. Shoulders down. Eyes closed or soft."), ...box(18), still("Return", 20, "Let your breath go back to normal.")] },
  { id: "med-prelift", name: "Pre-Lift Focus", category: "meditation", level: "Beginner", equipment: "None", blurb: "Three minutes to lock in before a heavy session.",
    phases: [still("Arrive", 20, "Feet flat. Hands on your knees."), ...box(5), still("See the lift", 45, "Picture your first working set. Every rep clean and strong."), still("Own it", 35, "Tell yourself what you're about to do. Then go do it.")] },
  { id: "med-scan", name: "Body Scan", category: "meditation", level: "Beginner", equipment: "None", blurb: "Ten minutes, head to toe, to drop tension and recover.",
    phases: [still("Settle", 45, "Lie or sit comfortably. Breathe naturally."), still("Head and face", 60, "Unclench your jaw. Relax your forehead."), still("Neck and shoulders", 75, "Let your shoulders drop away from your ears."), still("Arms and hands", 60, "Heavy arms. Open hands."), still("Chest and back", 75, "Notice your breath moving your ribs."), still("Stomach and hips", 60, "Soften your belly."), still("Legs", 75, "Thighs, knees, calves: let them go heavy."), still("Feet", 45, "Feel the weight of your heels."), still("Whole body", 90, "Feel your whole body at once, still and calm."), still("Return", 30, "Wiggle your fingers and toes. Open your eyes.")] },
  { id: "med-sleep", name: "Sleep Wind-Down", category: "meditation", level: "Beginner", equipment: "None", blurb: "Long exhales to switch off and fall asleep faster.",
    phases: [still("Get comfortable", 30, "Lie down, lights low."), ...rep(30, [P("Breathe in", 4, "breathe-in"), P("Breathe out", 8, "breathe-out", { cue: "Long, slow exhale." })]), still("Drift", 120, "No more counting. Just rest.")] },
  { id: "med-stoic", name: "Stoic Reset", category: "meditation", level: "Intermediate", equipment: "None", blurb: "Seven minutes to separate what you control from what you don't.",
    phases: [still("Settle", 40, "Sit tall. Breathe slow."), still("What's on you", 90, "Name what's weighing on you right now."), still("Sort it", 90, "Which parts can you control? Which can't you?"), still("Let go", 90, "Breathe out what you can't control."), still("Commit", 90, "Pick one thing you control and will act on today."), ...box(3)] },
];

export const SESSIONS: Session[] = [...HIIT, ...C25K, ...YOGA, ...MEDITATION];
export const SESSION_BY_ID = new Map(SESSIONS.map((s) => [s.id, s]));
export const sessionsIn = (c: SessionCategory) => SESSIONS.filter((s) => s.category === c);

/** The next Couch to 5K run: the first one not done yet, in order. */
export function nextC25K(doneIds: Iterable<string>): Session | undefined {
  const done = new Set(doneIds);
  return C25K.find((s) => !done.has(s.id));
}
