// Potty training: what the tracker counts, the timing it suggests from a child's own pattern,
// the readiness checklist, the two methods with research behind them (plus the popular 3-day
// plan), tips, troubleshooting, when to call the doctor, and the animated story "videos".
//
// Sources the guidance follows (also listed in the app):
//  - Choby & George, "Toilet Training", American Family Physician 2008;78(9):1059–64 (AAFP review).
//  - Blum, Taubman & Nemeth, Pediatrics 2003;111(4):810–4 — starting intensive training before
//    about 27 months didn't finish any sooner; it just took longer.
//  - Azrin & Foxx, "Toilet Training in Less Than a Day" (1974) — the intensive method.
//  - Brazelton, Pediatrics 1962 — the child-oriented method; American Academy of Pediatrics
//    (HealthyChildren.org) guidance on readiness and on night dryness.

export type PottyKind = "pee" | "poop" | "both" | "try" | "dry" | "acc-pee" | "acc-poop" | "night-dry" | "night-wet";
export type PottyLog = { id: string; kid: string; at: number; kind: PottyKind; note?: string };

export const KIND_INFO: Record<PottyKind, { label: string; emoji: string; good: boolean | null }> = {
  pee: { label: "Pee in the potty", emoji: "💧", good: true },
  poop: { label: "Poop in the potty", emoji: "💩", good: true },
  both: { label: "Pee + poop in the potty", emoji: "🌟", good: true },
  try: { label: "Sat and tried", emoji: "🪑", good: null },
  dry: { label: "Dry pants check", emoji: "👖", good: true },
  "acc-pee": { label: "Pee accident", emoji: "💦", good: false },
  "acc-poop": { label: "Poop accident", emoji: "🧻", good: false },
  "night-dry": { label: "Dry night", emoji: "🌙", good: true },
  "night-wet": { label: "Wet night", emoji: "🛏️", good: false },
};
export const isSuccess = (k: PottyKind) => k === "pee" || k === "poop" || k === "both";
export const isAccident = (k: PottyKind) => k === "acc-pee" || k === "acc-poop";
/** Successes and tries both earn a sticker: sitting and trying is the habit being built. */
export const earnsSticker = (k: PottyKind) => isSuccess(k) || k === "dry" || k === "night-dry";

const pad = (n: number) => String(n).padStart(2, "0");
export const dayOf = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export type DayStats = { successes: number; accidents: number; tries: number; dryChecks: number; rate: number | null };
/** One day for one child. Rate = potty successes ÷ (successes + accidents). */
export function dayStats(logs: PottyLog[], kid: string, day: string): DayStats {
  const l = logs.filter((x) => x.kid === kid && dayOf(x.at) === day);
  const successes = l.filter((x) => isSuccess(x.kind)).length, accidents = l.filter((x) => isAccident(x.kind)).length;
  return { successes, accidents, tries: l.filter((x) => x.kind === "try").length, dryChecks: l.filter((x) => x.kind === "dry").length, rate: successes + accidents ? successes / (successes + accidents) : null };
}
/** Time of the last daytime accident (or null). */
export const lastAccident = (logs: PottyLog[], kid: string) => logs.filter((x) => x.kid === kid && isAccident(x.kind)).reduce<number | null>((m, x) => (m === null || x.at > m ? x.at : m), null);
/** Days in a row, ending today or yesterday, with no daytime accident and at least one success. */
export function accidentFreeDays(logs: PottyLog[], kid: string, now = Date.now()): number {
  let n = 0; const d = new Date(now);
  // Today counts only if something good was logged; otherwise start from yesterday.
  const today = dayStats(logs, kid, dayOf(now));
  if (!(today.successes > 0 && today.accidents === 0)) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const s = dayStats(logs, kid, dayOf(d.getTime()));
    if (s.successes > 0 && s.accidents === 0) { n++; d.setDate(d.getDate() - 1); } else break;
  }
  return n;
}
export function dryNightsInARow(logs: PottyLog[], kid: string): number {
  const nights = logs.filter((x) => x.kid === kid && (x.kind === "night-dry" || x.kind === "night-wet")).sort((a, b) => b.at - a.at);
  let n = 0; for (const x of nights) { if (x.kind === "night-dry") n++; else break; } return n;
}
/** When in the day the child usually goes (pees and accidents), by hour, over the last `days`. */
export function hourPattern(logs: PottyLog[], kid: string, now = Date.now(), days = 14): number[] {
  const h = Array(24).fill(0); const since = now - days * 86_400_000;
  for (const x of logs) if (x.kid === kid && x.at >= since && (x.kind === "pee" || x.kind === "both" || x.kind === "acc-pee")) h[new Date(x.at).getHours()]++;
  return h;
}
/**
 * A reminder interval from the child's own rhythm: the typical (median) gap between pees on the
 * same day over the last week, minus 15 minutes so the reminder comes before the urge. Null until
 * there are at least 4 gaps to go on. Always between 30 and 150 minutes.
 */
export function suggestInterval(logs: PottyLog[], kid: string, now = Date.now()): number | null {
  const since = now - 7 * 86_400_000;
  const pees = logs.filter((x) => x.kid === kid && x.at >= since && (x.kind === "pee" || x.kind === "both" || x.kind === "acc-pee")).sort((a, b) => a.at - b.at);
  const gaps: number[] = [];
  for (let i = 1; i < pees.length; i++) if (dayOf(pees[i].at) === dayOf(pees[i - 1].at)) { const g = (pees[i].at - pees[i - 1].at) / 60_000; if (g >= 10 && g <= 300) gaps.push(g); }
  if (gaps.length < 4) return null;
  gaps.sort((a, b) => a - b);
  const mid = gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2;
  return Math.max(30, Math.min(150, Math.round((mid - 15) / 5) * 5));
}

// ─── Readiness ───
export const READINESS: { id: string; sign: string; why: string }[] = [
  { id: "dry2h", sign: "Stays dry for about 2 hours, or wakes up dry from naps", why: "Shows the bladder can hold urine long enough to make it to the potty." },
  { id: "regular", sign: "Poops at fairly regular, predictable times", why: "Makes it easy to time potty sits — often 15–30 minutes after a meal." },
  { id: "signals", sign: "Tells you, or shows you (hides, squats, goes quiet), when peeing or pooping", why: "Awareness of the feeling is the first skill training builds on." },
  { id: "interest", sign: "Is curious about the toilet or follows you into the bathroom", why: "Copying grown-ups is one of the strongest motivators at this age." },
  { id: "dislikes", sign: "Doesn't like being in a wet or dirty diaper", why: "Discomfort gives a natural reason to use the potty." },
  { id: "pants", sign: "Can pull pants down and up (with a little help)", why: "Independence makes the potty quicker and boosts confidence." },
  { id: "follows", sign: "Follows simple two-step directions (\"get your book and sit down\")", why: "Training is a sequence of steps the child has to follow." },
  { id: "sits", sign: "Can walk to the bathroom and sit still for a few minutes", why: "Needed for sits of 3–5 minutes." },
  { id: "words", sign: "Has words (or signs) for pee and poop", why: "Lets the child ask, and lets you talk about it." },
  { id: "wants", sign: "Wants to wear underwear or asks to use the potty", why: "Interest from the child is the best predictor of a quick, calm training." },
];
export function readinessVerdict(checked: number, total = READINESS.length): { title: string; text: string; tone: "go" | "soon" | "wait" } {
  const p = checked / total;
  if (p >= 0.7) return { tone: "go", title: "Looks ready!", text: "Most signs are there. Pick a calm week (no new baby, move or new daycare) and choose a method below." };
  if (p >= 0.4) return { tone: "soon", title: "Getting close", text: "Some signs are there. Start the easy groundwork now: a potty in the bathroom, sitting on it clothed, reading potty books and watching the stories. Check again in a few weeks." };
  return { tone: "wait", title: "Not quite yet — and that's normal", text: "Starting before a child is ready usually makes training take longer, not finish sooner. Keep it relaxed: talk about the potty, let them watch, and check again in a month." };
}

// ─── Methods ───
export type Method = { id: string; name: string; also: string; summary: string; bestFor: string; evidence: string; steps: string[]; plan?: { day: string; tasks: string[] }[] };
export const METHODS: Method[] = [
  {
    id: "child", name: "Child-oriented (gradual)", also: "Brazelton method · recommended by the AAP",
    summary: "Go at the child's pace in small steps over weeks. Lots of praise, no pressure or punishment. The approach most pediatric groups recommend.",
    bestFor: "Most families, younger toddlers (from about 18 months), busy schedules and daycare, children who resist being pushed.",
    evidence: "In Brazelton's 1962 study of about 1,170 children, the average child was dry in the day at about 28½ months, with very few problems; a later study found 61% trained by 36 months and 98% by 48 months. Judged effective in reviews (AAFP 2008).",
    steps: [
      "Put a child-size potty (or a seat + footstool) in the bathroom and let your child get used to it.",
      "Week 1: sit on the potty with clothes on, once a day — after breakfast is easy. Read a book or watch a story.",
      "Week 2: sit with diaper off. If something happens, celebrate! If not, praise the sitting.",
      "Empty a dirty diaper into the potty and let them flush and wave bye-bye, so they see where poop goes.",
      "Offer sits at natural times: on waking, after meals (when the body is most likely to poop), before bath, before bed.",
      "When they're interested, try short bare-bottom or underwear times at home, with the potty close by.",
      "Move to underwear in the day when they're using the potty most of the time. Keep night-time diapers for now.",
      "Accidents: stay calm, 'Pee goes in the potty — let's try next time', and have them help clean up.",
    ],
  },
  {
    id: "intensive", name: "Intensive (\"in less than a day\")", also: "Azrin–Foxx method",
    summary: "A focused, parent-led day using a doll that 'goes potty', lots of drinks, frequent prompts, pants checks and immediate rewards.",
    bestFor: "Children who are clearly ready (usually over 2–2½), a parent who can give one full, calm day at home.",
    evidence: "In the original study children trained in about 4 hours on average, with few accidents afterwards; reviews found 74–100% success. Little benefit before about 27 months (Blum 2003). Rated effective by AAFP 2008, with weaker evidence than for most medicine.",
    steps: [
      "Prepare: a potty, a doll that can 'pee' (or one you pour water from), lots of favourite drinks, small treats and stickers, and underwear.",
      "Have the doll use the potty first. Your child helps it pull down pants, sit, 'pee', empty the potty and get praised.",
      "Give plenty to drink so there are many chances to practise.",
      "Every 15 minutes: ask 'Do you need to pee?' and guide a sit if they say yes.",
      "Every few minutes check pants: 'Are you dry? Great job keeping your pants dry!' — praise and a tiny treat for dry pants.",
      "When they pee in the potty: big praise, a sticker, empty and flush together.",
      "Accidents: calm 'No — pee goes in the potty', then practise walking to the potty from where the accident happened a few times (gently, never as punishment).",
      "As they succeed, stretch the prompts out and let them go on their own.",
    ],
    plan: [
      { day: "Training day", tasks: ["Morning: doll demonstration", "Drinks offered often", "Prompt every 15 min", "Dry-pants check every 5 min", "Reward each potty pee right away", "Practice trips after accidents", "Stretch prompts to 30–60 min by afternoon"] },
      { day: "Next days", tasks: ["Praise dry pants a few times a day", "Remind before leaving the house", "Rewards only for potty, not for dry checks", "Keep night diapers"] },
    ],
  },
  {
    id: "threeday", name: "3-day plan", also: "Popular 'bare-bottom' weekend plan",
    summary: "Three days at home, mostly bare-bottom, watching closely and rushing to the potty at the first sign. A popular parenting plan based on the same ideas as the intensive method.",
    bestFor: "Children over about 2 who show most readiness signs, a family that can stay home for a long weekend.",
    evidence: "Widely used by families; it hasn't been studied in trials the way the two methods above have. It borrows their main ingredients: lots of practice, quick praise and calm handling of accidents.",
    steps: [
      "Pick 3 days at home. Tell your child the day before: 'Tomorrow we say bye-bye diapers!'",
      "Day 1: bare-bottom (or just a shirt), lots of drinks, watch closely. At the first sign of peeing, calmly scoop them to the potty.",
      "Use the reminder timer every 20–30 minutes plus at waking, after meals and before naps.",
      "Day 2: same, and add loose pants with no underwear. Try a short trip outside right after a potty visit.",
      "Day 3: underwear on. Remind less often and let them start to tell you.",
      "Keep diapers or pull-ups for nap and night until they're waking dry.",
    ],
    plan: [
      { day: "Day 1", tasks: ["Bare-bottom at home", "Drinks all day", "Potty timer every 20–30 min", "Sit after waking and every meal", "Sticker for every potty", "Calm, quick clean-ups"] },
      { day: "Day 2", tasks: ["Loose pants, no underwear", "Timer every 30–45 min", "Short outing right after a potty", "Praise when they tell you"] },
      { day: "Day 3", tasks: ["Underwear on", "Timer every 45–60 min", "Let them lead more", "Potty before leaving any place"] },
    ],
  },
  {
    id: "timed", name: "Scheduled sits", also: "Good for daycare, older kids and kids with special needs",
    summary: "Short potty sits at set times every day, whether or not the child says they need to go, plus praise for sitting and for success.",
    bestFor: "Children who don't notice the urge yet, kids who are busy playing, school or daycare routines, and many children with developmental delays.",
    evidence: "Scheduled sits are part of both the intensive method and most clinic programmes. Using the child's own pattern (see Insights) makes the timing more accurate.",
    steps: [
      "Log a few days first (even in diapers) so you can see when they usually go.",
      "Set the reminder a little before those times, or every 60–90 minutes.",
      "Sits last 3–5 minutes — use the sit timer and a story so it isn't boring.",
      "Always sit after waking and 15–30 minutes after meals.",
      "Praise sitting; give stickers for successes.",
      "As successes grow, space the reminders out and encourage your child to tell you.",
    ],
  },
];

// ─── Tips, troubleshooting, doctor ───
export const TIPS: { title: string; items: string[] }[] = [
  { title: "Setting up", items: ["Feet flat: a footstool (or child potty) lets them push and relax — it makes pooping much easier.", "Clothes they can pull down fast: elastic waists, no buttons or overalls.", "Let them pick underwear with a favourite colour or design — 'keep them dry' becomes their goal.", "Put a potty where they play for the first days."] },
  { title: "Words and attitude", items: ["Use simple, positive words for pee and poop. Never say poop is 'gross' or 'yucky' — it can make kids afraid to let it out.", "Praise the effort ('You sat and tried!'), not just the result.", "Never punish or shame accidents — it's linked to holding and longer training.", "Let them see you or a sibling use the toilet; children copy what they see."] },
  { title: "Timing that works with the body", items: ["The body naturally pushes poop along 15–30 minutes after eating — perfect sit time.", "Sit right after waking up from sleep or naps.", "Offer the potty before leaving the house, before bath and before bed.", "Watch for the signs: going quiet, hiding, squatting, holding themselves, wiggling."] },
  { title: "Motivation", items: ["Stickers for every success (and, early on, for trying).", "A small prize at a set number of stickers — let your child pick it in advance.", "A potty song or dance after success makes it a celebration.", "Let them flush and wave bye-bye if they like it — or skip flushing if the noise scares them."] },
  { title: "Out and about", items: ["Go before leaving and on arrival.", "Pack a bag: 2 changes of clothes, wipes, a plastic bag, and a portable potty or fold-up seat.", "Big automatic toilets can scare kids — cover the sensor with a sticky note or your hand.", "Teach daycare your words and your routine so it's the same everywhere."] },
  { title: "Boys", items: ["Most boys learn sitting down first — they can stand later once pooping on the potty is solid.", "Teach them to point down while sitting to avoid spraying.", "For standing, a cereal 'target' in the toilet makes aiming a game."] },
  { title: "Hygiene", items: ["Girls: wipe front to back.", "Wash hands every time — use the 20-second handwashing story.", "Flushable wipes can clog pipes; put them in the bin."] },
];
export const TROUBLE: { problem: string; help: string[] }[] = [
  { problem: "Refuses to sit or says 'no'", help: ["Take a break for 2–3 weeks with no pressure, then try again — this is very common.", "Offer choices instead of commands: 'Big potty or little potty?', 'Before or after your snack?'", "Make sitting fun: a special potty-only book, toy or story."] },
  { problem: "Pees on the potty but won't poop there", help: ["Very common. Let them poop in a diaper, but in the bathroom — then move the diaper onto the potty, then cut a hole in it.", "Praise pooping in the diaper too; keep it positive.", "Check for constipation (hard or painful poops) — that's the usual cause."] },
  { problem: "Holding in poop / constipation", help: ["Treat constipation first: water, fruit and vegetables, whole grains, and less milk if they drink a lot.", "A footstool and a relaxed position help a lot.", "Go back to diapers for a while if needed — taking pressure off breaks the cycle.", "Talk to your pediatrician — they may suggest a gentle stool softener for a while."] },
  { problem: "Was trained, now has accidents again", help: ["Regression is normal after big changes: a new baby, move, new school, illness.", "Go back to reminders and stickers for a week or two.", "If it comes with pain, burning, much more peeing, or thirst, see your doctor."] },
  { problem: "Too busy playing to stop", help: ["Use the timer: when it rings, everyone takes a potty break together.", "Let them bring a toy (that won't fall in!).", "Keep the potty close to play for now."] },
  { problem: "Afraid of the toilet or the flush", help: ["Use a child potty or a seat with a footstool so they feel secure.", "Flush after they've left the room until they're ready.", "Watch 'Poop Goes Bye-Bye' together."] },
  { problem: "Dry in the day, wet at night", help: ["Normal — night dryness depends on hormones and sleep, not effort, and often comes months or years later.", "Wetting the bed isn't considered a problem until about age 5–6 (and it's common later too).", "Use pull-ups or a mattress protector without shame; log dry nights so you can see when they start."] },
];
export const DOCTOR: string[] = [
  "Pain or burning when peeing, or peeing much more often than usual",
  "Blood in the pee or poop, or poops that are hard, painful or very large",
  "Holding in poop for days, or soiling underwear after being trained",
  "Fever, tummy pain or vomiting with accidents",
  "Being very thirsty and peeing a lot",
  "Was dry for months and suddenly isn't, with no big change at home",
  "Not making progress with daytime training by around age 4, or delays in other areas",
];
export const SOURCES: { title: string; url: string }[] = [
  { title: "Choby & George, Toilet Training — American Family Physician (2008)", url: "https://www.aafp.org/pubs/afp/issues/2008/1101/p1059.html" },
  { title: "Blum, Taubman & Nemeth, Age at initiation of toilet training — Pediatrics (2003)", url: "https://pubmed.ncbi.nlm.nih.gov/12671117/" },
  { title: "HealthyChildren.org (American Academy of Pediatrics): Toilet Training", url: "https://www.healthychildren.org/English/ages-stages/toddler/toilet-training/Pages/default.aspx" },
];

// ─── Stickers ───
export const STICKERS = ["⭐", "🌈", "🦄", "🚀", "🦖", "🐶", "🐱", "🦋", "🍦", "🎈", "🏆", "🐸", "🐬", "🌻", "🚒", "🦁", "🐼", "🍓", "🚂", "👑", "🐝", "🦊", "🌟", "🐙"];
export const PRIZE_IDEAS = ["Pick a new book", "Trip to the park", "Bubble bath party", "Pick dinner", "Small toy", "Extra bedtime story", "Baking cookies together", "Dance party", "Special outing with a grown-up", "New underwear set"];

// ─── Stories ("videos") ───
export type Anim = "bounce" | "wiggle" | "slide" | "pop" | "spin" | "float" | "shake" | "none";
export type Scene = { bg: string; actors: { e: string; a: Anim; x: number; y?: number; size?: number }[]; text: string; say?: string };
export type Story = { id: string; title: string; emoji: string; minutes: string; about: string; color: string; scenes: Scene[] };
const sky = "linear-gradient(180deg,#bae6fd,#e0f2fe)", bath = "linear-gradient(180deg,#e0e7ff,#f5f3ff)", sun = "linear-gradient(180deg,#fef3c7,#fde68a)", party = "linear-gradient(135deg,#fbcfe8,#c4b5fd,#a5f3fc)", night = "linear-gradient(180deg,#1e1b4b,#4338ca)", grass = "linear-gradient(180deg,#bbf7d0,#86efac)";
export const STORIES: Story[] = [
  { id: "benny", title: "Benny Bear's Big Kid Potty", emoji: "🐻", minutes: "2 min", color: "#b45309", about: "A bear learns the potty steps, from 'I need to go' to washing hands.", scenes: [
    { bg: grass, actors: [{ e: "🐻", a: "bounce", x: 50 }], text: "This is Benny Bear. Benny is getting big!" },
    { bg: grass, actors: [{ e: "🐻", a: "wiggle", x: 40 }, { e: "❓", a: "pop", x: 62, y: 30, size: 60 }], text: "Uh-oh. Benny feels something in his tummy. He needs to go!" },
    { bg: bath, actors: [{ e: "🐻", a: "slide", x: 30 }, { e: "🚽", a: "none", x: 70 }], text: "Benny walks to the potty. Step, step, step!" },
    { bg: bath, actors: [{ e: "👖", a: "float", x: 35 }, { e: "🐻", a: "none", x: 60 }], text: "He pulls down his pants. Down they go!" },
    { bg: bath, actors: [{ e: "🐻", a: "none", x: 50 }, { e: "🎵", a: "float", x: 72, y: 25, size: 50 }], text: "Benny sits on the potty. He waits… and relaxes…" },
    { bg: bath, actors: [{ e: "💧", a: "pop", x: 50, size: 80 }], text: "Pssss! Pee goes in the potty!", say: "Psssss! Pee goes in the potty!" },
    { bg: bath, actors: [{ e: "🧻", a: "spin", x: 40 }, { e: "🐻", a: "bounce", x: 62 }], text: "Wipe, pants up, and flush. Bye-bye, pee!" },
    { bg: bath, actors: [{ e: "🧼", a: "wiggle", x: 40 }, { e: "🙌", a: "shake", x: 62 }], text: "Wash, wash, wash those paws with soap and water." },
    { bg: party, actors: [{ e: "🐻", a: "bounce", x: 50 }, { e: "⭐", a: "spin", x: 25, y: 25 }, { e: "🎉", a: "pop", x: 75, y: 25 }], text: "Hooray, Benny! You used the potty like a big kid!", say: "Hooray Benny! You used the potty like a big kid! Now it's your turn!" },
  ] },
  { id: "song", title: "The Potty Song", emoji: "🎶", minutes: "1 min", color: "#db2777", about: "A sing-along to the potty — great while sitting.", scenes: [
    { bg: party, actors: [{ e: "🐥", a: "bounce", x: 30 }, { e: "🐸", a: "bounce", x: 70 }], text: "When I feel I've got to go…", say: "When I feel I've got to go," },
    { bg: party, actors: [{ e: "🚶", a: "slide", x: 50 }], text: "I don't wait, I don't go slow!", say: "I don't wait, I don't go slow!" },
    { bg: bath, actors: [{ e: "🚽", a: "wiggle", x: 50 }], text: "Pants go down and I sit tight…", say: "Pants go down and I sit tight," },
    { bg: bath, actors: [{ e: "💧", a: "pop", x: 40 }, { e: "💩", a: "pop", x: 60 }], text: "Pee and poop go in just right!", say: "Pee and poop go in just right!" },
    { bg: bath, actors: [{ e: "🧻", a: "spin", x: 35 }, { e: "🌊", a: "float", x: 65 }], text: "Wipe and flush and wave bye-bye…", say: "Wipe and flush and wave bye bye," },
    { bg: party, actors: [{ e: "🧼", a: "wiggle", x: 40 }, { e: "⭐", a: "spin", x: 60 }], text: "Wash my hands — and touch the sky!", say: "Wash my hands, and touch the sky!" },
    { bg: party, actors: [{ e: "🙌", a: "bounce", x: 50, size: 120 }], text: "Hands up high! Potty pro!", say: "Hands up high! I'm a potty pro!" },
  ] },
  { id: "hands", title: "Wash, Wash, Wash Your Hands", emoji: "🧼", minutes: "1 min", color: "#0891b2", about: "Five steps and a 20-second scrub.", scenes: [
    { bg: sky, actors: [{ e: "🚰", a: "none", x: 50 }], text: "Turn on the water and get your hands wet." },
    { bg: sky, actors: [{ e: "🧼", a: "wiggle", x: 50 }], text: "Add soap. Squish, squish!" },
    { bg: sky, actors: [{ e: "🫧", a: "float", x: 30 }, { e: "🙌", a: "shake", x: 55 }, { e: "🫧", a: "float", x: 78 }], text: "Scrub the fronts, the backs, between the fingers and under the nails.", say: "Scrub the fronts, the backs, between your fingers, and under your nails. Let's count to twenty! 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20!" },
    { bg: sky, actors: [{ e: "💦", a: "pop", x: 50 }], text: "Rinse the bubbles away." },
    { bg: sky, actors: [{ e: "🧺", a: "none", x: 40 }, { e: "✨", a: "spin", x: 62 }], text: "Dry with a towel. Sparkly clean hands!" },
  ] },
  { id: "poop", title: "Poop Goes Bye-Bye", emoji: "💩", minutes: "1 min", color: "#92400e", about: "For kids who are nervous about pooping on the potty.", scenes: [
    { bg: sun, actors: [{ e: "🍎", a: "bounce", x: 30 }, { e: "🥦", a: "bounce", x: 50 }, { e: "🍞", a: "bounce", x: 70 }], text: "Everybody eats yummy food." },
    { bg: sun, actors: [{ e: "😊", a: "wiggle", x: 50 }], text: "Our body keeps the good parts to help us grow big and strong." },
    { bg: sun, actors: [{ e: "💩", a: "pop", x: 50 }], text: "The parts our body doesn't need come out as poop. Everybody poops!", say: "The parts our body doesn't need come out as poop. Everybody poops! Even grown-ups, and puppies, and elephants!" },
    { bg: bath, actors: [{ e: "🦶", a: "none", x: 40 }, { e: "🪜", a: "none", x: 60 }], text: "Feet on the stool, lean forward, and blow like a balloon to help it out.", say: "Put your feet on the stool, lean forward, and blow, like you're blowing up a balloon. That helps the poop come out." },
    { bg: bath, actors: [{ e: "🌊", a: "float", x: 50 }, { e: "👋", a: "shake", x: 72, y: 30 }], text: "Flush! The poop goes on a water ride. Wave bye-bye, poop!" },
    { bg: party, actors: [{ e: "🎉", a: "pop", x: 35 }, { e: "⭐", a: "spin", x: 65 }], text: "You did it! Pooping in the potty is a big kid thing." },
  ] },
  { id: "oops", title: "Oops! That's Okay", emoji: "🐰", minutes: "1 min", color: "#16a34a", about: "A gentle story about accidents — nobody is in trouble.", scenes: [
    { bg: grass, actors: [{ e: "🐰", a: "bounce", x: 50 }], text: "Rosie Rabbit was playing a super fun game." },
    { bg: grass, actors: [{ e: "🐰", a: "shake", x: 50 }, { e: "💦", a: "pop", x: 65, y: 70, size: 50 }], text: "Oops! She was so busy, the pee came out in her pants." },
    { bg: grass, actors: [{ e: "🐰", a: "none", x: 40 }, { e: "🤗", a: "pop", x: 62 }], text: "\"That's okay,\" said Mama. \"Accidents happen when we're learning.\"" },
    { bg: bath, actors: [{ e: "👕", a: "float", x: 40 }, { e: "🐰", a: "none", x: 62 }], text: "Rosie helped put on dry clothes. Then she sat on the potty to finish." },
    { bg: grass, actors: [{ e: "🐰", a: "wiggle", x: 50 }, { e: "💡", a: "pop", x: 70, y: 25, size: 60 }], text: "Next time she felt the wiggle, Rosie stopped and ran to the potty!" },
    { bg: party, actors: [{ e: "🐰", a: "bounce", x: 50 }, { e: "⭐", a: "spin", x: 75, y: 25 }], text: "Every try makes you better. Keep going!" },
  ] },
  { id: "listen", title: "Listen to Your Body", emoji: "👂", minutes: "1 min", color: "#7c3aed", about: "Helps toddlers notice the 'I need to go' feeling.", scenes: [
    { bg: sky, actors: [{ e: "🦒", a: "bounce", x: 50 }], text: "Gigi Giraffe has a tummy that talks!" },
    { bg: sky, actors: [{ e: "🦒", a: "wiggle", x: 50 }], text: "When she needs to pee, she feels a little wiggle, down low.", say: "When she needs to pee, she feels a little wiggle, down low. Can you wiggle like Gigi?" },
    { bg: sky, actors: [{ e: "🦒", a: "shake", x: 50 }], text: "Sometimes she does a potty dance, or holds on tight." },
    { bg: sky, actors: [{ e: "🗣️", a: "pop", x: 50 }], text: "That's her body saying: \"Potty time!\"", say: "That's her body saying, potty time! What do you say? Potty time!" },
    { bg: bath, actors: [{ e: "🦒", a: "slide", x: 40 }, { e: "🚽", a: "none", x: 70 }], text: "So she stops playing and goes right away." },
    { bg: party, actors: [{ e: "🦒", a: "bounce", x: 50 }, { e: "🎉", a: "pop", x: 75, y: 25 }], text: "Listen to your body, and you'll make it every time!" },
  ] },
  { id: "night", title: "Goodnight, Potty", emoji: "🌙", minutes: "1 min", color: "#4338ca", about: "A calm bedtime routine story.", scenes: [
    { bg: night, actors: [{ e: "🦉", a: "float", x: 50 }], text: "Ollie Owl is getting ready for bed." },
    { bg: night, actors: [{ e: "🪥", a: "wiggle", x: 50 }], text: "Brush, brush, brush his teeth." },
    { bg: night, actors: [{ e: "🚽", a: "none", x: 50 }], text: "Last potty before bed — even if he doesn't feel like it." },
    { bg: night, actors: [{ e: "🛏️", a: "none", x: 50 }, { e: "⭐", a: "float", x: 25, y: 20, size: 40 }, { e: "⭐", a: "float", x: 78, y: 15, size: 30 }], text: "Snuggle in. If he wakes up and needs to go, he calls for help." },
    { bg: night, actors: [{ e: "🌙", a: "float", x: 50 }], text: "Goodnight, Ollie. Goodnight, potty. Sweet dreams!", say: "Goodnight Ollie. Goodnight potty. Sweet dreams." },
  ] },
];
