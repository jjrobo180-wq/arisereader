// Arise Fit: your gym. The equipment a gym really has (gear), what every exercise needs, typical
// equipment for the big gym chains, and a short guide to each machine (what it works, how to set it up,
// common mistakes). Used by "My gym" (workouts built only from what you have), "Scan a machine" (a
// machine's QR code or a photo of it) and swapping exercises during a workout.
import { CATALOG, CATALOG_BY_ID, type CatalogExercise, type Muscle } from "./fit";

export type GearKind = "free" | "machine" | "cable" | "cardio" | "station" | "small";
export type Gear = {
  id: string; name: string; kind: GearKind; e: string;
  /** Muscles it mainly trains. */
  works: Muscle[];
  /** Setting it up and using it, in order. */
  how: string[];
  /** Mistakes people make on it. */
  avoid: string[];
  /** Other names, for reading QR codes and photos ("seated leg press", "leg-press"). */
  aka: string[];
};

const G = (id: string, name: string, kind: GearKind, e: string, works: Muscle[], how: string[], avoid: string[], aka: string[] = []): Gear => ({ id, name, kind, e, works, how, avoid, aka });

export const GEAR: Gear[] = [
  // Free weights and racks
  G("dumbbells", "Dumbbells", "free", "🏋️", ["full body"], ["Pick a weight you can lift for every rep with good form.", "Lift them off the rack with a straight back, close to your body.", "Put them back on the rack when you're done."], ["Dropping them on the floor between sets.", "Swinging the weight instead of controlling it."], ["dumbbell", "db", "free weights"]),
  G("barbell", "Barbell and plates", "free", "🏋️", ["full body"], ["Load the same plates on each side and add collars.", "An Olympic bar weighs 45 lb (20 kg) on its own."], ["Uneven plates.", "Skipping the collars."], ["olympic bar", "plates", "bar"]),
  G("squat-rack", "Squat rack / power rack", "station", "🏗️", ["quads", "glutes", "back"], ["Set the J-hooks at mid-chest height.", "Set the safety bars just below the bottom of your squat.", "Step under the bar, unrack it and take two steps back."], ["Training heavy without the safety bars set.", "Curling in the squat rack when people are waiting."], ["power rack", "squat cage", "rack", "half rack"]),
  G("bench", "Bench (flat or adjustable)", "station", "🪑", ["chest"], ["Set the back pad flat or at the incline you need.", "Feet flat on the floor, head and hips on the pad."], ["Bouncing off the pad.", "Lifting your hips off the bench to press more."], ["flat bench", "adjustable bench", "incline bench", "utility bench"]),
  G("smith-machine", "Smith machine", "machine", "🏗️", ["quads", "chest", "shoulders", "glutes"], ["Set the safety stops just below where the bar will go.", "Unrack by twisting the bar's hooks off the pegs.", "The bar moves straight up and down: place your feet so that path feels natural.", "Twist the bar back onto the pegs to rack it."], ["Feet directly under the bar on squats (put them slightly forward).", "Forgetting the bar itself weighs something (usually 15–25 lb)."], ["smith", "smith rack"]),
  G("kettlebells", "Kettlebells", "free", "🔔", ["full body"], ["Hike it back between your legs and snap your hips forward on swings.", "Grip the handle firmly, wrists straight."], ["Squatting a swing instead of hinging.", "Lifting with your arms instead of your hips."], ["kettlebell", "kb"]),
  G("ez-bar", "EZ curl bar", "free", "〰️", ["biceps", "triceps"], ["Hold the angled grips: it's easier on your wrists.", "Use it for curls and skull crushers."], ["Swinging your back to lift it."], ["ez bar", "curl bar"]),
  // Selectorized machines
  G("chest-press", "Chest press machine", "machine", "💪", ["chest", "triceps", "shoulders"], ["Set the seat so the handles line up with the middle of your chest.", "Pick the weight with the pin.", "Press the handles out until your arms are almost straight, then come back slowly."], ["Seat too low (it strains your shoulders).", "Locking your elbows hard at the top."], ["seated chest press", "chest press", "vertical press"]),
  G("pec-deck", "Pec deck / chest fly machine", "machine", "🦋", ["chest", "shoulders"], ["Set the seat so the handles are at chest height.", "Slight bend in your elbows, kept the same the whole time.", "Bring the handles together in front of you and squeeze, then open slowly."], ["Bending and straightening your arms (that turns it into a press).", "Letting the weights slam."], ["pec fly", "chest fly", "fly machine", "rear delt fly machine", "reverse fly"]),
  G("shoulder-press", "Shoulder press machine", "machine", "🙆", ["shoulders", "triceps"], ["Set the seat so the handles start at shoulder height.", "Press straight up without arching your lower back.", "Lower slowly until your hands are at shoulder height."], ["Arching your back off the pad.", "Seat so low your elbows drop below your shoulders."], ["overhead press machine", "seated shoulder press", "military press machine"]),
  G("lateral-raise-machine", "Lateral raise machine", "machine", "🙆", ["shoulders"], ["Line your shoulders up with the machine's pivot.", "Raise your elbows out to the side to shoulder height.", "Lower slowly."], ["Shrugging your shoulders up to your ears."], ["lateral raise", "side raise machine", "deltoid raise"]),
  G("lat-pulldown", "Lat pulldown", "cable", "⬇️", ["back", "biceps"], ["Set the knee pad so your thighs are locked in.", "Grip the bar a little wider than your shoulders.", "Pull the bar to your upper chest, leading with your elbows.", "Let it rise slowly until your arms are straight."], ["Leaning far back and yanking.", "Pulling the bar behind your neck."], ["pulldown", "lat pull down", "lat pull"]),
  G("seated-row", "Seated row machine", "machine", "🚣", ["back", "biceps"], ["Set the chest pad so you can just reach the handles with straight arms.", "Pull the handles to your ribs, squeezing your shoulder blades together.", "Let your arms straighten slowly."], ["Rocking your body to move the weight.", "Shrugging instead of pulling back."], ["seated row", "low row", "row machine", "mid row"]),
  G("assisted-pullup", "Assisted pull-up / dip machine", "machine", "🧗", ["back", "biceps", "triceps", "chest"], ["More weight on the stack means more help (it makes it easier).", "Kneel or stand on the platform.", "Pull up until your chin clears the handles, or dip until your upper arms are level."], ["Picking too little help and cutting reps short.", "Swinging."], ["assisted pull up", "assisted dip", "gravitron", "assisted chin"]),
  G("leg-press", "Leg press", "machine", "🦵", ["quads", "glutes", "hamstrings"], ["Sit with your back flat on the pad.", "Feet shoulder-width in the middle of the platform.", "Release the safety handles and lower until your knees reach about 90°.", "Push through your whole foot, without locking your knees."], ["Locking your knees out at the top.", "Lowering so far your lower back lifts off the pad."], ["seated leg press", "leg press machine", "45 degree leg press", "sled"]),
  G("hack-squat", "Hack squat machine", "machine", "🦵", ["quads", "glutes"], ["Shoulders under the pads, back flat on the pad.", "Feet shoulder-width on the platform.", "Release the safeties and squat until your thighs are about parallel."], ["Heels lifting off the platform.", "Knees caving in."], ["hack squat"]),
  G("leg-extension", "Leg extension", "machine", "🦵", ["quads"], ["Line your knees up with the machine's pivot.", "Set the ankle pad just above your feet.", "Straighten your legs, squeeze, and lower slowly."], ["Kicking the weight up fast.", "Seat set so your knees are out of line with the pivot."], ["leg extension", "quad extension", "knee extension"]),
  G("leg-curl-seated", "Seated leg curl", "machine", "🦵", ["hamstrings"], ["Line your knees up with the pivot and lock the thigh pad down.", "Ankle pad on the back of your lower legs.", "Curl your heels down and back, then let them up slowly."], ["Thigh pad left loose, so your hips lift.", "Rushing the way back."], ["seated leg curl", "seated hamstring curl"]),
  G("leg-curl-lying", "Lying leg curl", "machine", "🦵", ["hamstrings"], ["Lie face down with your knees just off the end of the pad.", "Ankle pad just above your heels.", "Curl your heels toward your glutes, then lower slowly."], ["Hips lifting off the pad.", "Swinging the weight."], ["lying leg curl", "prone leg curl", "hamstring curl"]),
  G("hip-abductor", "Hip abductor / adductor", "machine", "🦋", ["glutes"], ["Set the pads on the outside of your knees (abductor) or the inside (adductor).", "Push your knees out (or squeeze them in) and return slowly."], ["Using momentum.", "Starting with the range set too wide for you."], ["abductor", "adductor", "hip abduction", "inner thigh", "outer thigh"]),
  G("glute-machine", "Glute kickback / hip thrust machine", "machine", "🍑", ["glutes", "hamstrings"], ["Set the pad on your hips (hip thrust) or behind your knee (kickback).", "Drive through your heel and squeeze your glutes at the top.", "Lower slowly."], ["Arching your lower back instead of using your glutes."], ["glute kickback", "glute drive", "hip thrust machine", "glute bridge machine"]),
  G("calf-raise-machine", "Calf raise machine", "machine", "🦶", ["calves"], ["Balls of your feet on the edge, heels hanging off.", "Rise as high as you can, pause, then lower your heels below the edge."], ["Bouncing at the bottom.", "Bending your knees to help."], ["standing calf raise", "calf raise", "seated calf raise", "calf machine"]),
  G("preacher-curl", "Preacher curl / biceps machine", "machine", "💪", ["biceps"], ["Set the seat so your armpits rest on top of the pad.", "Curl the handles up, then lower until your arms are almost straight."], ["Lifting your elbows off the pad.", "Dropping the weight at the bottom."], ["preacher curl", "biceps curl machine", "arm curl"]),
  G("triceps-machine", "Triceps extension / dip machine", "machine", "💪", ["triceps"], ["Set the seat so your elbows line up with the pivot (extension) or the handles are at your sides (dip).", "Straighten your arms fully, then come back slowly."], ["Flaring your elbows out wide."], ["triceps extension", "triceps press", "seated dip", "tricep"]),
  G("ab-crunch-machine", "Ab crunch machine", "machine", "🧱", ["abs"], ["Set the seat so the pads sit on your shoulders.", "Curl your chest toward your hips, then return slowly."], ["Pulling with your arms.", "Using too much weight and rocking."], ["abdominal crunch", "ab machine", "abdominal"]),
  G("back-extension", "Back extension / Roman chair", "station", "↩️", ["back", "glutes", "hamstrings"], ["Set the pad just below your hip bones.", "Lower your upper body, then lift until your body is straight."], ["Swinging up past straight and arching your back."], ["roman chair", "hyperextension", "back extension", "lower back"]),
  G("cable-station", "Cable machine / functional trainer", "cable", "🧵", ["full body"], ["Set the pulley height for the exercise.", "Clip on the right handle (rope, bar or single handle).", "Step away until the weight lifts off the stack before starting."], ["Letting the stack slam between reps.", "Standing so close the weight never lifts."], ["cable crossover", "functional trainer", "cable", "crossover", "pulley"]),
  G("t-bar-row", "T-bar row", "station", "🚣", ["back", "biceps"], ["Chest on the pad (if it has one), back flat.", "Pull the handles toward your chest, squeezing your shoulder blades.", "Lower until your arms are straight."], ["Rounding your back."], ["t bar", "t-bar"]),
  // Stations and small equipment
  G("pull-up-bar", "Pull-up bar", "station", "🧗", ["back", "biceps", "abs"], ["Grip just wider than your shoulders.", "Pull until your chin is over the bar, then lower all the way."], ["Kipping or swinging.", "Half reps."], ["pull up bar", "chin up bar", "pullup"]),
  G("dip-station", "Dip station / captain's chair", "station", "⬇️", ["triceps", "chest", "abs"], ["Hold the handles with straight arms.", "Dips: lower until your upper arms are level, then press up.", "Leg raises: back against the pad, lift your knees or legs."], ["Going so deep your shoulders hurt.", "Swinging your legs."], ["dip bars", "captain's chair", "vkr", "knee raise station", "power tower"]),
  G("bands", "Resistance bands", "small", "🎗️", ["full body"], ["Anchor the band securely or stand on it.", "Move slowly both ways: the band pulls hardest at the end."], ["Using a band with nicks or tears."], ["resistance band", "band", "loop band"]),
  G("ab-wheel", "Ab wheel", "small", "🛞", ["abs"], ["Kneel, hands on the wheel under your shoulders.", "Roll out only as far as you can keep your back flat, then pull back."], ["Letting your lower back sag."], ["ab roller"]),
  G("plyo-box", "Plyo box / step", "small", "📦", ["quads", "glutes"], ["Start with a low box.", "Land softly with bent knees and step down."], ["Jumping down instead of stepping."], ["box", "step", "plyo"]),
  G("jump-rope", "Jump rope", "small", "🪢", ["cardio", "calves"], ["Handles at hip height, turn the rope with your wrists.", "Small jumps on the balls of your feet."], ["Jumping too high."], ["skipping rope", "rope"]),
  G("trx", "Suspension trainer (TRX)", "small", "🪢", ["full body"], ["Anchor it high and securely.", "The more you lean, the harder it gets."], ["Letting the straps rub your arms."], ["suspension", "trx straps"]),
  G("medicine-ball", "Medicine ball / slam ball", "small", "⚫", ["abs", "full body"], ["Hold it at your chest.", "Slams: lift overhead, slam down in front of you, catch the bounce."], ["Rounding your back to pick it up."], ["med ball", "slam ball", "wall ball"]),
  // Cardio
  G("treadmill", "Treadmill", "cardio", "🏃", ["cardio"], ["Clip the safety key to your clothes.", "Start slow, then raise speed or incline.", "Stand on the side rails before starting and stopping."], ["Holding the handrails while walking on an incline."], ["treadmill", "running machine"]),
  G("bike", "Exercise bike", "cardio", "🚴", ["cardio", "quads"], ["Set the seat so your knee is slightly bent at the bottom of the pedal stroke.", "Turn up the resistance for hills."], ["Seat too low (it strains your knees)."], ["stationary bike", "spin bike", "recumbent bike", "cycle", "air bike", "assault bike"]),
  G("rower", "Rowing machine", "cardio", "🚣", ["cardio", "back", "quads"], ["Strap your feet in across the widest part.", "Push with your legs, lean back slightly, then pull the handle to your ribs.", "Return in reverse: arms, body, then legs."], ["Pulling with your arms first.", "Bending your knees before your arms are out of the way."], ["rower", "erg", "concept2", "row erg"]),
  G("elliptical", "Elliptical", "cardio", "🏃", ["cardio"], ["Step on, hold the handles, and stride.", "Raise the resistance or incline to work harder."], ["Leaning hard on the handles."], ["cross trainer", "arc trainer"]),
  G("stair-climber", "Stair climber", "cardio", "🪜", ["cardio", "glutes", "quads"], ["Stand tall and step the whole foot onto each step.", "Hold the rails lightly for balance only."], ["Leaning on the rails and taking half steps."], ["stairmaster", "step mill", "stairs", "stepper"]),
];
export const GEAR_BY_ID = new Map(GEAR.map((g) => [g.id, g]));

// ——— What each exercise needs ———————————————————————————————————————————————————————————————————
/** Each list is one way to do the exercise (all of that gear needed); any one way is enough. [] = needs nothing. */
type Need = string[][];
const NEEDS: Record<string, Need> = {
  "bench-press": [["barbell", "bench"], ["smith-machine", "bench"]],
  "incline-bench": [["barbell", "bench"], ["smith-machine", "bench"]],
  "close-grip-bench": [["barbell", "bench"], ["smith-machine", "bench"]],
  "db-bench": [["dumbbells", "bench"]], "db-incline": [["dumbbells", "bench"]], "db-fly": [["dumbbells", "bench"]],
  "cable-fly": [["cable-station"]], "machine-chest-press": [["chest-press"], ["smith-machine", "bench"]], "pec-deck": [["pec-deck"], ["cable-station"]],
  dip: [["dip-station"], ["assisted-pullup"]], "bench-dip": [["bench"]],
  deadlift: [["barbell"]], "rack-pull": [["barbell", "squat-rack"]], "sumo-deadlift": [["barbell"]], rdl: [["barbell"], ["smith-machine"]], "good-morning": [["barbell", "squat-rack"]],
  "pull-up": [["pull-up-bar"], ["assisted-pullup"]], "chin-up": [["pull-up-bar"], ["assisted-pullup"]],
  "lat-pulldown": [["lat-pulldown"], ["cable-station"]], "seated-cable-row": [["seated-row"], ["cable-station"]],
  "barbell-row": [["barbell"], ["smith-machine"]], "t-bar-row": [["t-bar-row"], ["barbell"]], "inverted-row": [["smith-machine"], ["barbell", "squat-rack"], ["trx"]],
  "face-pull": [["cable-station"], ["bands"]], "back-extension": [["back-extension"]],
  ohp: [["barbell"], ["smith-machine"], ["shoulder-press"]], "upright-row": [["barbell"], ["ez-bar"], ["cable-station"]],
  "cable-lateral": [["cable-station"], ["lateral-raise-machine"]],
  "barbell-curl": [["barbell"], ["ez-bar"]], "preacher-curl": [["preacher-curl"], ["ez-bar", "bench"]], "cable-curl": [["cable-station"], ["lat-pulldown"]],
  "triceps-pushdown": [["cable-station"], ["lat-pulldown"], ["triceps-machine"]], "skull-crusher": [["barbell", "bench"], ["ez-bar", "bench"], ["dumbbells", "bench"]],
  "incline-curl": [["dumbbells", "bench"]],
  "back-squat": [["barbell", "squat-rack"], ["smith-machine"]], "front-squat": [["barbell", "squat-rack"], ["smith-machine"]],
  "leg-press": [["leg-press"]], "hack-squat": [["hack-squat"], ["smith-machine"]], "leg-extension": [["leg-extension"]],
  "leg-curl": [["leg-curl-lying"], ["leg-curl-seated"]], "seated-leg-curl": [["leg-curl-seated"], ["leg-curl-lying"]],
  "hip-thrust": [["barbell", "bench"], ["glute-machine"], ["smith-machine", "bench"]], "cable-kickback": [["cable-station"], ["glute-machine"]],
  "hip-abduction": [["hip-abductor"], ["bands"]], "calf-raise": [["calf-raise-machine"], ["smith-machine"], ["leg-press"]], "seated-calf": [["calf-raise-machine"]],
  "bulgarian-split-squat": [["bench"], ["dumbbells"]], "step-up": [["plyo-box"], ["bench"]],
  "hanging-leg-raise": [["pull-up-bar"], ["dip-station"]], "cable-crunch": [["cable-station"], ["lat-pulldown"], ["ab-crunch-machine"]], "ab-wheel": [["ab-wheel"]],
  "box-jump": [["plyo-box"]], "jump-rope": [["jump-rope"]],
  "clean-press": [["barbell"]], "power-clean": [["barbell"]],
  run: [["treadmill"]], "walk-incline": [["treadmill"]], bike: [["bike"]], rower: [["rower"]], elliptical: [["elliptical"]], stairs: [["stair-climber"]],
};
const BY_EQUIPMENT: Record<string, Need> = {
  barbell: [["barbell"]], dumbbell: [["dumbbells"]], kettlebell: [["kettlebells"], ["dumbbells"]], band: [["bands"]], cable: [["cable-station"]],
  bench: [["bench"]], "pull-up bar": [["pull-up-bar"]], machine: [["smith-machine"]], "cardio machine": [["treadmill"]], other: [], bodyweight: [],
};
/** Moves people usually do with weights that are fine without (lunges, split squats). */
const ALSO_BODYWEIGHT = new Set(["lunge", "bulgarian-split-squat", "step-up", "goblet-squat", "kb-goblet-squat"]);
export function needsOf(exId: string): Need {
  const ex = CATALOG_BY_ID.get(exId);
  if (!ex) return [];
  const need = NEEDS[exId] ?? BY_EQUIPMENT[ex.equipment] ?? [];
  return ALSO_BODYWEIGHT.has(exId) ? [...need, []] : need;
}
/** Can this exercise be done with this gear? */
export function canDo(exId: string, gear: Iterable<string>): boolean {
  const have = gear instanceof Set ? gear : new Set(gear);
  const need = needsOf(exId);
  return need.length === 0 || need.some((way) => way.every((g) => have.has(g)));
}
/** Exercises done on a piece of gear (the ones that name it), best known first. */
export function exercisesOn(gearId: string): CatalogExercise[] {
  return CATALOG.filter((e) => needsOf(e.id).some((way) => way.includes(gearId)));
}

// ——— Gyms ————————————————————————————————————————————————————————————————————————————————————————
export type GymType = { id: string; name: string; e: string; blurb: string; gear: string[]; scan?: boolean };
const ALL = GEAR.map((g) => g.id);
const without = (...ids: string[]) => ALL.filter((g) => !ids.includes(g));
const MACHINES = ["chest-press", "pec-deck", "shoulder-press", "lateral-raise-machine", "lat-pulldown", "seated-row", "assisted-pullup", "leg-press", "leg-extension", "leg-curl-seated", "leg-curl-lying", "hip-abductor", "calf-raise-machine", "preacher-curl", "triceps-machine", "ab-crunch-machine"];
const CARDIO = ["treadmill", "bike", "elliptical", "stair-climber", "rower"];
/** Typical equipment by gym. Every location differs, so people adjust their own list. */
export const GYM_TYPES: GymType[] = [
  { id: "planet-fitness", name: "Planet Fitness", e: "🟣", blurb: "Lots of machines, Smith machines, dumbbells and cardio. Most locations have no barbells or squat racks.",
    gear: ["dumbbells", "bench", "smith-machine", ...MACHINES, "glute-machine", "back-extension", "cable-station", "pull-up-bar", "dip-station", "ab-wheel", "plyo-box", "bands", ...CARDIO] },
  { id: "la-fitness", name: "LA Fitness", e: "🔵", blurb: "A full gym: racks, barbells, dumbbells, machines and cardio.", gear: without("trx") },
  { id: "24-hour", name: "24 Hour Fitness", e: "🔵", blurb: "A full gym: racks, barbells, dumbbells, machines and cardio.", gear: ALL },
  { id: "golds", name: "Gold's Gym", e: "🟡", blurb: "A full gym with plenty of free weights and racks.", gear: ALL },
  { id: "crunch", name: "Crunch Fitness", e: "🟠", blurb: "A full gym: racks, barbells, dumbbells, machines and cardio.", gear: ALL },
  { id: "anytime", name: "Anytime Fitness", e: "🟣", blurb: "Smaller clubs: dumbbells, a rack or two, the main machines and cardio.", gear: without("t-bar-row", "hack-squat", "glute-machine", "lateral-raise-machine") },
  { id: "ymca", name: "YMCA", e: "🔴", blurb: "Machines, dumbbells, cardio and usually a rack or two.", gear: without("t-bar-row", "hack-squat", "glute-machine") },
  { id: "lifetime", name: "Life Time", e: "⚫", blurb: "A full premium gym.", gear: ALL },
  { id: "other-gym", name: "Another gym", e: "🏢", blurb: "Start with a full gym and switch off what yours doesn't have.", gear: ALL },
  { id: "apartment", name: "Apartment gym", e: "🏢", blurb: "Take photos and we'll find your equipment, or tick it off yourself.", gear: ["dumbbells", "bench", "treadmill", "elliptical", "bike"], scan: true },
  { id: "home", name: "Home gym", e: "🏠", blurb: "Take photos and we'll find your equipment, or tick it off yourself.", gear: ["dumbbells", "bands"], scan: true },
  { id: "hotel", name: "Hotel gym", e: "🏨", blurb: "Usually dumbbells, a bench and cardio.", gear: ["dumbbells", "bench", "treadmill", "bike", "elliptical"], scan: true },
  { id: "none", name: "No equipment", e: "🤸", blurb: "Bodyweight workouts anywhere.", gear: [] },
];
export const GYM_BY_ID = new Map(GYM_TYPES.map((g) => [g.id, g]));
export type MyGym = { type: string; name?: string; gear: string[] };
/** A saved gym, made safe to keep. */
export function cleanGym(raw: any): MyGym | undefined {
  if (!raw || typeof raw !== "object" || !GYM_BY_ID.has(String(raw.type))) return undefined;
  const gear = [...new Set((Array.isArray(raw.gear) ? raw.gear : []).map(String).filter((g: string) => GEAR_BY_ID.has(g)))] as string[];
  return { type: String(raw.type), ...(raw.name ? { name: String(raw.name).slice(0, 60) } : {}), gear };
}
export const gymLabel = (g: MyGym) => g.name || GYM_BY_ID.get(g.type)?.name || "My gym";

// ——— Reading a machine's QR code or label ——————————————————————————————————————————————————————————
const norm = (s: string) => s.toLowerCase().replace(/%20|[-_+./=?&#:]+/g, " ").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
/**
 * Which machine a QR code (or any text: a label, a URL) is about. Gym chains put QR codes on their
 * machines that open their own app; the code's text usually names the machine, so it's matched against
 * every machine's names. Arise Fit's own tags read "arisefit:gear:<id>". null when nothing matches.
 */
export function gearFromText(text: string): Gear | null {
  const own = /arisefit:gear:([a-z0-9-]+)/i.exec(text);
  if (own && GEAR_BY_ID.has(own[1].toLowerCase())) return GEAR_BY_ID.get(own[1].toLowerCase())!;
  const t = ` ${norm(text)} `;
  let best: { g: Gear; len: number } | null = null;
  for (const g of GEAR) {
    for (const name of [g.name.split(/[/(]/)[0], ...g.aka, g.id]) {
      const n = norm(name);
      if (n.length >= 3 && t.includes(` ${n} `) && (!best || n.length > best.len)) best = { g, len: n.length };
    }
  }
  return best?.g ?? null;
}

/** For the AI: the machine list it must choose from. */
export const GEAR_PROMPT_LIST = GEAR.map((g) => `${g.id}: ${g.name}${g.aka.length ? ` (also called ${g.aka.slice(0, 3).join(", ")})` : ""}`).join("\n");
/** Keeps only real gear ids from an AI answer. */
export const cleanGearIds = (ids: unknown): string[] => [...new Set((Array.isArray(ids) ? ids : []).map((x) => String(x).toLowerCase().trim()).filter((x) => GEAR_BY_ID.has(x)))];
