// Cooked guided sessions: timed workouts the app talks you through, phase by phase. HIIT on the
// treadmill (speed and incline for each interval), Couch to 5K (the standard 9-week run/walk plan),
// yoga flows, mobility and stretching routines, breathing and guided meditation. Written for Cooked.

export type PhaseKind = "warm" | "work" | "rest" | "cool" | "pose" | "breathe-in" | "hold" | "breathe-out" | "still";
export type Phase = { name: string; secs: number; kind: PhaseKind; cue?: string; speed?: number; incline?: number; /** The exercise's how-to video (shared/fitVideos.ts), for the TV. */ video?: { id: string; title: string } };
export type SessionCategory = "hiit" | "c25k" | "yoga" | "meditation" | "mobility";
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
  { id: "yoga-bedtime", name: "Bedtime Yoga", category: "yoga", level: "Beginner", equipment: "Mat or bed", blurb: "Twelve slow minutes on the floor or in bed to switch off and sleep better.",
    phases: [pose("Seated breathing", 60, "Sit cross-legged. Slow breath in, longer breath out."), pose("Seated side stretch, left", 40, "Right hand down, left arm over your head."), pose("Seated side stretch, right", 40, "Switch sides. Breathe into your ribs."),
      pose("Seated forward fold", 60, "Legs long, fold from the hips. Let your back round."), pose("Child's pose", 75, "Knees wide, forehead down. Let your shoulders drop."), pose("Supine twist, left", 60, "Knees to the left, look right."),
      pose("Supine twist, right", 60, "Knees to the right, look left."), pose("Happy baby", 50, "Hold your feet, rock gently."), pose("Legs up the wall", 120, "Hips close to the wall, legs resting up it."), pose("Corpse pose", 150, "Lie still. Let your whole body get heavy.")] },
  { id: "yoga-power", name: "Power Flow", category: "yoga", level: "Intermediate", equipment: "Mat", blurb: "A strong 20-minute vinyasa: sun salutations, warriors and balance. You'll sweat.",
    phases: [pose("Mountain pose", 30, "Feet together, breathe in."), ...rep(3, [pose("Sun salutation A", 60, "Reach up, fold, halfway lift, plank, low push-up, upward dog, downward dog.")]),
      pose("Chair pose", 40, "Sit back, arms up. Weight in your heels."), pose("Warrior 1, right", 40, "Back heel down, hips forward."), pose("Warrior 2, right", 40, "Arms wide, front knee over the ankle."),
      pose("Reverse warrior, right", 30, "Back hand slides down your leg."), pose("Extended side angle, right", 40, "Forearm on your thigh, top arm long."), pose("Vinyasa", 30, "Plank, low push-up, upward dog, downward dog."),
      pose("Warrior 1, left", 40, "Back heel down, hips forward."), pose("Warrior 2, left", 40, "Arms wide, gaze over your front hand."), pose("Reverse warrior, left", 30, "Open your chest to the sky."),
      pose("Extended side angle, left", 40, "Long line from heel to fingertips."), pose("Crow pose practice", 45, "Knees on the backs of your arms. Lean forward slowly."), pose("Boat pose", 45, "Balance on your sit bones, chest up."),
      pose("Bridge pose", 45, "Press through your feet, lift your hips."), pose("Seated forward fold", 60, "Long spine, then let it round."), pose("Corpse pose", 120, "Rest. Let your heart rate come down.")] },
  { id: "yoga-flex", name: "Full-Body Flexibility", category: "yoga", level: "Beginner", equipment: "Mat", blurb: "Twenty minutes of long holds, head to toe. Do it a few times a week and feel the difference.",
    phases: [pose("Neck rolls", 45, "Slow half-circles, ear to chest to ear."), pose("Thread the needle, left", 45, "On all fours, slide your left arm under."), pose("Thread the needle, right", 45, "Switch arms."),
      pose("Downward dog", 60, "Pedal your heels."), pose("Low lunge, left", 60, "Hips sink forward."), pose("Half split, left", 60, "Shift back, front leg straight."), pose("Low lunge, right", 60, "Hips sink forward."),
      pose("Half split, right", 60, "Front toes up, fold over the leg."), pose("Pigeon, left", 90, "Front shin across, fold over it."), pose("Pigeon, right", 90, "Switch legs. Breathe into the hip."),
      pose("Seated wide-leg fold", 75, "Legs wide, walk your hands forward."), pose("Butterfly", 75, "Soles together, fold gently."), pose("Reclined hamstring stretch, left", 60, "Strap or hands behind the thigh."),
      pose("Reclined hamstring stretch, right", 60, "Keep the other leg long."), pose("Supine twist", 90, "Thirty seconds each side, then center."), pose("Corpse pose", 90, "Rest and breathe.")] },
  { id: "yoga-runner", name: "Runner's Yoga", category: "yoga", level: "Beginner", equipment: "Mat", blurb: "Calves, hamstrings, hips and quads after a run. Fifteen minutes.",
    phases: [pose("Downward dog", 60, "Pedal your feet, stretch your calves."), pose("Low lunge, left", 50, "Back knee down, hips forward."), pose("Lizard, left", 50, "Hands inside your front foot."), pose("Low lunge, right", 50, "Switch sides."),
      pose("Lizard, right", 50, "Stay soft in the hips."), pose("Half split, left", 50, "Front leg straight, fold over it."), pose("Half split, right", 50, "Breathe into the back of the leg."), pose("Low lunge quad stretch, left", 45, "Reach back for your back foot."),
      pose("Low lunge quad stretch, right", 45, "Switch sides."), pose("Figure four, left", 60, "On your back, ankle over knee."), pose("Figure four, right", 60, "Switch sides."), pose("Legs up the wall", 120, "Let your legs drain and rest.")] },
  { id: "yoga-core", name: "Core Flow", category: "yoga", level: "Intermediate", equipment: "Mat", blurb: "Twelve minutes of planks, boats and slow twists for a strong middle.",
    phases: [pose("Cat-cow", 45, "Warm up your spine."), pose("Bird dog, alternating", 60, "Opposite arm and leg, slow and steady."), pose("Plank", 45, "Long line from head to heels."), pose("Side plank, left", 30, "Stack your feet or drop a knee."),
      pose("Side plank, right", 30, "Lift your hips high."), pose("Forearm plank", 45, "Squeeze everything."), pose("Boat pose", 40, "Chest up, legs up."), pose("Low boat holds", 40, "Lower halfway, keep your back off the floor."),
      pose("Bicycle twists, slow", 60, "Elbow to opposite knee, five-second reps."), pose("Dead bug", 60, "Low back pressed down."), pose("Bridge pose", 45, "Squeeze your glutes."), pose("Child's pose", 60, "Rest.")] },
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
  { id: "med-478", name: "4-7-8 Breathing", category: "meditation", level: "Beginner", equipment: "None", blurb: "In for 4, hold for 7, out for 8. A slow rhythm that helps you fall asleep and calm down.",
    phases: [still("Settle", 20, "Tongue behind your top teeth. Sit or lie down."), ...rep(8, [P("Breathe in", 4, "breathe-in", { cue: "Quietly through your nose." }), P("Hold", 7, "hold"), P("Breathe out", 8, "breathe-out", { cue: "Out through your mouth, like a soft whoosh." })]), still("Rest", 30, "Breathe normally. Notice how you feel.")] },
  { id: "med-sigh", name: "Calm in 3 Minutes", category: "meditation", level: "Beginner", equipment: "None", blurb: "The physiological sigh: two breaths in, one long breath out. The fastest way to come down from stress.",
    phases: [still("Arrive", 10, "Wherever you are, just stop for a moment."), ...rep(16, [P("Breathe in", 3, "breathe-in", { cue: "A full breath in through the nose." }), P("Top it up", 1, "breathe-in", { cue: "One more short sniff." }), P("Breathe out", 7, "breathe-out", { cue: "Long and slow through the mouth." })])] },
  { id: "med-focus", name: "Focus Five", category: "meditation", level: "Beginner", equipment: "None", blurb: "Five minutes to clear your head before work, study or a big moment.",
    phases: [still("Settle", 30, "Sit tall. Feet on the floor."), ...box(6), still("One thing", 60, "Pick the one thing that matters next. Picture yourself starting it."), still("Count breaths", 60, "Count each breath out, one to ten, then start again."), still("Go", 20, "Open your eyes. Start.")] },
  { id: "med-coherent", name: "Coherent Breathing", category: "meditation", level: "Beginner", equipment: "None", blurb: "Five and a half seconds in, five and a half out, for ten minutes. Steady and balancing.",
    phases: [still("Settle", 20, "Sit comfortably. Relax your belly."), ...rep(52, [P("Breathe in", 5.5, "breathe-in"), P("Breathe out", 5.5, "breathe-out")]), still("Rest", 20, "Let your breath find its own pace.")] },
  { id: "med-gratitude", name: "Gratitude", category: "meditation", level: "Beginner", equipment: "None", blurb: "Six quiet minutes to notice what's going right.",
    phases: [still("Settle", 40, "Close your eyes. Breathe slowly."), still("A person", 80, "Think of someone who helped you lately. Picture their face."), still("Your body", 80, "Notice one thing your body did for you today."), still("Small things", 80, "Three small good things from this week."), still("Carry it", 60, "Take one of them with you into the rest of your day.")] },
];

// ——— Mobility and stretching ————————————————————————————————————————————————————————————————————
const hold = (name: string, secs: number, cue: string) => P(name, secs, "pose", { cue });
const MOBILITY: Session[] = [
  { id: "mob-desk", name: "Desk Reset", category: "mobility", level: "Beginner", equipment: "A chair", blurb: "Six minutes for your neck, shoulders, back and hips after sitting. Do it right at your desk.",
    phases: [hold("Chin tucks", 30, "Slide your chin straight back, then relax."), hold("Neck side stretch, left", 30, "Ear toward your shoulder."), hold("Neck side stretch, right", 30, "Switch sides."), hold("Shoulder rolls", 30, "Big slow circles back."),
      hold("Chest opener", 40, "Hands behind you, lift your chest."), hold("Seated twist, left", 30, "Hold the chair back, turn from your ribs."), hold("Seated twist, right", 30, "Switch sides."), hold("Seated figure four, left", 40, "Ankle on knee, lean forward."),
      hold("Seated figure four, right", 40, "Switch legs."), hold("Standing hip flexor stretch, left", 30, "Step back, tuck your hips."), hold("Standing hip flexor stretch, right", 30, "Switch sides."), hold("Reach up", 20, "Arms up, stretch tall.")] },
  { id: "mob-hips", name: "Hips & Ankles", category: "mobility", level: "Beginner", equipment: "Mat", blurb: "Ten minutes to squat deeper and walk easier.",
    phases: [hold("90/90 switches", 60, "Sit with both knees bent at 90. Rock the knees side to side."), hold("90/90 hold, left", 45, "Tall chest, lean over the front shin."), hold("90/90 hold, right", 45, "Switch sides."),
      hold("Deep squat hold", 60, "Heels down, elbows push your knees out."), hold("Ankle rocks, left", 40, "Knee travels over your toes, heel stays down."), hold("Ankle rocks, right", 40, "Switch sides."),
      hold("Frog rocks", 60, "Knees wide, rock your hips back and forward."), hold("Couch stretch, left", 60, "Back knee against the wall or couch, tuck your hips."), hold("Couch stretch, right", 60, "Switch sides."), hold("Happy baby", 45, "Rock gently.")] },
  { id: "mob-shoulders", name: "Shoulder Rescue", category: "mobility", level: "Beginner", equipment: "Mat, a band if you have one", blurb: "Eight minutes for tight shoulders and a stiff upper back. Great before pressing.",
    phases: [hold("Arm circles", 40, "Small to big, both directions."), hold("Wall slides", 60, "Back to the wall, slide your arms up and down."), hold("Thread the needle, left", 45, "On all fours, arm slides under."), hold("Thread the needle, right", 45, "Switch arms."),
      hold("Puppy pose", 60, "Hips over knees, chest sinks to the floor."), hold("Doorway chest stretch", 45, "Forearm on a door frame, step through."), hold("Sleeper stretch, left", 40, "On your side, gently press the forearm down."), hold("Sleeper stretch, right", 40, "Switch sides."),
      hold("Band pull-aparts or reverse flys", 45, "Squeeze your shoulder blades together."), hold("Child's pose", 45, "Walk your hands long.")] },
  { id: "mob-back", name: "Low Back Relief", category: "mobility", level: "Beginner", equipment: "Mat", blurb: "Eight easy minutes when your lower back is tight. Gentle, no strain.",
    phases: [hold("Knees to chest", 45, "Hug and rock side to side."), hold("Pelvic tilts", 45, "Small, slow movements."), hold("Cat-cow", 60, "With your breath."), hold("Bird dog", 60, "Opposite arm and leg, slowly."), hold("Glute bridge", 45, "Lift and lower slowly."),
      hold("Supine twist, left", 45, "Knees to the left."), hold("Supine twist, right", 45, "Knees to the right."), hold("Child's pose", 60, "Breathe into your low back."), hold("Sphinx pose", 45, "Forearms down, chest lifts gently.")] },
  { id: "mob-full", name: "Full-Body Stretch", category: "mobility", level: "Beginner", equipment: "Mat", blurb: "Fifteen minutes, every major muscle. The cool-down you keep meaning to do.",
    phases: [hold("Neck stretch", 40, "Each side for twenty seconds."), hold("Cross-body shoulder, left", 30, "Pull the arm across your chest."), hold("Cross-body shoulder, right", 30, "Switch arms."), hold("Triceps stretch", 40, "Twenty seconds each arm."),
      hold("Standing quad stretch, left", 30, "Hold your foot behind you."), hold("Standing quad stretch, right", 30, "Switch legs."), hold("Standing forward fold", 45, "Soft knees."), hold("Calf stretch, left", 30, "Hands on a wall, back leg straight."),
      hold("Calf stretch, right", 30, "Switch legs."), hold("Low lunge, left", 45, "Hips forward."), hold("Low lunge, right", 45, "Switch sides."), hold("Pigeon, left", 60, "Fold forward if it feels good."), hold("Pigeon, right", 60, "Switch sides."),
      hold("Seated hamstring stretch", 60, "Both legs long, reach for your feet."), hold("Butterfly", 45, "Soles together."), hold("Supine twist", 60, "Thirty seconds each side."), hold("Rest", 30, "Lie still and breathe.")] },
  { id: "mob-prerun", name: "Pre-Run Warm-Up", category: "mobility", level: "Beginner", equipment: "None", blurb: "Five minutes of moving stretches so your first mile feels good.",
    phases: [hold("March in place", 40, "High knees, swing your arms."), hold("Leg swings, front to back", 40, "Twenty each leg, hold something for balance."), hold("Leg swings, side to side", 40, "Twenty each leg."),
      hold("Walking lunges with a twist", 50, "Lunge, turn over the front knee."), hold("Hip circles", 30, "Hands on hips, big circles."), hold("Butt kicks", 30, "Quick and light."), hold("A-skips", 30, "Skip with a high knee."), hold("Strides", 40, "Three short build-ups to a fast run.")] },
  { id: "mob-postlift", name: "Post-Lift Cool-Down", category: "mobility", level: "Beginner", equipment: "Mat", blurb: "Seven minutes after training to bring your heart rate down and loosen what you worked.",
    phases: [hold("Easy walk", 60, "Slow walk, deep breaths."), hold("Doorway chest stretch", 40, "Open the front of your shoulders."), hold("Lat stretch on a rack", 40, "Hold the rack, sit back, round your back."), hold("Couch stretch, left", 45, "Back knee against a bench."),
      hold("Couch stretch, right", 45, "Switch sides."), hold("Hamstring stretch", 45, "One leg up on a bench, fold over it."), hold("Child's pose", 45, "Arms long."), hold("Box breathing", 60, "Four in, four hold, four out, four hold.")] },
];

export const SESSIONS: Session[] = [...HIIT, ...C25K, ...YOGA, ...MEDITATION, ...MOBILITY];
export const SESSION_BY_ID = new Map(SESSIONS.map((s) => [s.id, s]));
export const sessionsIn = (c: SessionCategory) => SESSIONS.filter((s) => s.category === c);

/** The next Couch to 5K run: the first one not done yet, in order. */
export function nextC25K(doneIds: Iterable<string>): Session | undefined {
  const done = new Set(doneIds);
  return C25K.find((s) => !done.has(s.id));
}
