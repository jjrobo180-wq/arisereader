// What the LifeHub cycle tracker teaches: the four phases (with tips and foods), a daily insight for
// each day of the cycle, how to read discharge, and short readings. General education for teens
// and adults, written to be plain and calm. Not medical advice.

export type PhaseId = "period" | "follicular" | "fertile" | "luteal";

export type PhaseGuide = {
  id: PhaseId; name: string; days: string; color: string;
  happening: string; feel: string;
  tips: string[]; eat: string[]; limit: string[]; move: string;
};

export const PHASE_GUIDE: Record<PhaseId, PhaseGuide> = {
  period: {
    id: "period", name: "Period (menstrual phase)", days: "About days 1–5", color: "#e0566b",
    happening: "Estrogen and progesterone are at their lowest, so the lining of the uterus sheds. That's the bleeding.",
    feel: "Cramps, low energy, lower back aches and wanting to stay in are all common.",
    tips: [
      "Heat helps cramps: a heating pad or warm bath relaxes the uterus muscle.",
      "Change pads or tampons every 4 to 8 hours; never leave a tampon in longer than 8.",
      "Sleep a little more if you can. Your body is doing real work.",
      "Keep a spare pad or tampon in your bag for next month.",
      "Soaking through a pad or tampon every hour for a few hours is a reason to call a doctor.",
    ],
    eat: ["Iron: spinach, beans, lentils, lean red meat, fortified cereal", "Vitamin C with iron (oranges, strawberries, peppers) to absorb it", "Warm soups and teas, like ginger tea for cramps", "Water and water-rich fruit to ease bloating", "Dark chocolate in small amounts (magnesium)"],
    limit: ["Very salty snacks (more bloating)", "Lots of caffeine (can tighten cramps and hurt sleep)", "Alcohol", "Very sugary drinks (energy crashes)"],
    move: "Gentle movement: walking, stretching or easy yoga often makes cramps better, not worse.",
  },
  follicular: {
    id: "follicular", name: "Follicular phase", days: "After your period until the fertile window", color: "#8b7cf6",
    happening: "Estrogen rises as an egg gets ready in the ovary, and the uterus lining rebuilds.",
    feel: "Many people feel more energy, a brighter mood and more motivation.",
    tips: [
      "Good days to start something new, plan your month or try a harder workout.",
      "Skin is often at its clearest now.",
      "Notice your discharge: it usually starts dry or sticky, then gets creamier.",
    ],
    eat: ["Protein at every meal (eggs, yogurt, chicken, tofu, beans)", "Fresh vegetables and fruit", "Whole grains like oats and brown rice", "Fermented foods like yogurt or kefir"],
    limit: ["Skipping breakfast on busy days", "Lots of ultra-processed snacks"],
    move: "Energy is usually up: a good time for running, dancing, sports or strength training.",
  },
  fertile: {
    id: "fertile", name: "Fertile window and ovulation", days: "About 5 days before ovulation to 1 day after", color: "#2fa58f",
    happening: "Estrogen peaks and an LH surge releases an egg (ovulation). Pregnancy is most likely these days.",
    feel: "Some people feel their most energetic and social. A one-sided twinge in the lower belly (mittelschmerz) is common.",
    tips: [
      "Clear, stretchy discharge like raw egg white is a sign you're close to ovulation.",
      "Basal body temperature rises about 0.3–0.5 °F after ovulation, not before.",
      "Ovulation tests turn positive 1–2 days before you ovulate.",
      "This tracker can't be used as birth control.",
    ],
    eat: ["Fiber: vegetables, fruit, beans and whole grains", "Healthy fats: avocado, nuts, seeds, olive oil", "Plenty of water"],
    limit: ["Too much alcohol", "Heavy fried foods if you feel bloated"],
    move: "A great time for your hardest workouts if you feel strong.",
  },
  luteal: {
    id: "luteal", name: "Luteal phase", days: "After ovulation until your next period (about 14 days)", color: "#e59b3a",
    happening: "Progesterone rises to prepare the uterus. If there's no pregnancy, it falls near the end and your period starts.",
    feel: "Early on many feel calm. In the last week, PMS can bring bloating, cravings, tender breasts, acne and mood swings.",
    tips: [
      "Cravings are real: plan a satisfying snack instead of fighting them.",
      "Keep a regular bedtime; sleep is easier to lose this week.",
      "Write down mood changes. If they're severe every month, it's worth talking to a doctor (PMDD).",
      "Pack period supplies in the last few days.",
    ],
    eat: ["Complex carbs: oats, sweet potato, brown rice (steadier mood and fewer crashes)", "Magnesium: pumpkin seeds, almonds, leafy greens, dark chocolate", "Calcium: yogurt, milk, fortified drinks (can ease PMS)", "Bananas and potatoes (potassium for bloating)"],
    limit: ["Salty chips and fast food (bloating)", "Lots of caffeine (anxiety, sore breasts)", "Big sugary snacks (mood dips)", "Alcohol"],
    move: "Steady movement like walking, swimming, pilates or yoga. Go easier in the last few days if you're tired.",
  },
};

/** A short thought for each day of the phase, in order (it repeats if the phase is longer). */
const DAILY: Record<PhaseId, string[]> = {
  period: [
    "Day one counts from the first day of real bleeding, not spotting. That's how cycle length is measured.",
    "Flow is usually heaviest on days 1–2. Cramps often ease after that.",
    "If cramps stop you from going to school or work, that's worth mentioning to a doctor. You don't have to just put up with it.",
    "Iron lost in your period comes back with food: beans, greens and meat, plus vitamin C to absorb it.",
    "Most periods last 3–7 days. Lighter flow near the end is normal.",
    "Brown blood at the end of a period is just older blood. It's normal.",
    "Feeling tired? Low iron can add to it. A short walk outside can help more than you'd think.",
  ],
  follicular: [
    "Your period is over and estrogen is rising. Many people notice more energy from here.",
    "Strength gains can come easier in this phase. Try adding a little to your workouts.",
    "This is often a good week for focus: big projects, tests and planning.",
    "Discharge may start out dry or sticky and get creamier as the days go on.",
    "Social plans often feel easier now. Your mood can be brighter as estrogen climbs.",
    "Fuel up with protein and colorful vegetables to support the energy boost.",
    "Ovulation is getting closer. Watch for wetter, clearer discharge.",
  ],
  fertile: [
    "You're in the fertile window: the days pregnancy is most likely.",
    "Clear, slippery, stretchy discharge (like raw egg white) is the classic sign ovulation is near.",
    "An ovulation test detects the LH surge that comes 1–2 days before an egg is released.",
    "A twinge on one side of the lower belly around now can be ovulation itself.",
    "After ovulation, basal temperature rises and stays up until your next period.",
    "Many people feel confident and social around ovulation as estrogen peaks.",
    "The egg lives about a day; sperm can live up to 5. That's why the window is about 6 days.",
  ],
  luteal: [
    "Ovulation has likely passed. Progesterone is rising and may make you feel calmer at first.",
    "Discharge usually gets thicker and less after ovulation.",
    "Your body uses a little more energy now, so feeling hungrier is normal.",
    "Magnesium-rich snacks like nuts and seeds can help with PMS.",
    "Sleep can get lighter this week. Keep screens out of bed if you can.",
    "Breasts can feel tender or full in this phase. A comfortable bra helps.",
    "Mood dipping? Progesterone and estrogen drop near the end. Be kind to yourself.",
    "Spotting a few days before your period can happen. Write it down so you can see the pattern.",
    "Bloating? Go easy on salt and drink more water, which helps your body let go of extra fluid.",
    "Your period may start in the next few days. Pack supplies.",
    "Cravings for sweets are common now. Pair them with protein so the energy lasts.",
    "Exercise, even a walk, can lower PMS symptoms like low mood and bloating.",
    "If PMS really disrupts your life every month, ask a doctor about PMDD. There is help.",
    "Almost there. Your cycle starts over on the first day of bleeding.",
  ],
};

export function dailyInsight(phase: PhaseId, dayInPhase: number): string {
  const list = DAILY[phase];
  return list[Math.max(0, dayInPhase - 1) % list.length];
}

export type DischargeId = "none" | "dry" | "sticky" | "creamy" | "watery" | "eggwhite" | "spotting" | "unusual";
export const DISCHARGE: { id: DischargeId; label: string; means: string }[] = [
  { id: "dry", label: "Dry", means: "Little or none, common just after a period and late in the cycle." },
  { id: "sticky", label: "Sticky", means: "Thick, pasty, white or cloudy. Common early in the cycle." },
  { id: "creamy", label: "Creamy", means: "White and lotion-like. Estrogen is rising." },
  { id: "watery", label: "Watery", means: "Clear and wet. Getting close to the fertile window." },
  { id: "eggwhite", label: "Egg white", means: "Clear, slippery and stretchy. The most fertile kind, around ovulation." },
  { id: "spotting", label: "Spotting", means: "Pink or brown streaks. Can happen around ovulation or before a period." },
  { id: "unusual", label: "Unusual", means: "Green, gray, yellow, chunky, itchy or a strong fishy smell can mean an infection. See a doctor." },
];

export const EXTRA_SYMPTOMS = ["Cramps", "Headache", "Bloating", "Tender breasts", "Acne", "Back pain", "Tired", "Cravings", "Moody", "Anxious", "Trouble sleeping", "Nausea",
  "Dizzy", "Diarrhea", "Constipation", "Hot flashes", "Ovulation pain", "Pelvic pain", "Itching", "Hair or skin changes", "Sad", "Irritable"];

export type Reading = { id: string; title: string; minutes: number; paragraphs: string[] };
export const READINGS: Reading[] = [
  { id: "cycle-vs-period", title: "Cycle vs. period: what's the difference?", minutes: 2, paragraphs: [
    "Your period is the few days you bleed. Your cycle is the whole repeating loop, from the first day of one period to the day before the next one starts.",
    "So if your period starts on the 1st and the next one on the 29th, your period might last 5 days but your cycle is 28 days long.",
    "A cycle has four phases: the period, the follicular phase (getting an egg ready), ovulation (the egg is released) and the luteal phase (the body prepares for a possible pregnancy). If there's no pregnancy, the next period starts and the cycle begins again.",
    "Typical cycles for adults are 21 to 35 days. For teens, cycles from 21 to 45 days are normal in the first few years after periods start. Periods usually last 2 to 7 days.",
  ] },
  { id: "phases", title: "The four phases and how they can feel", minutes: 3, paragraphs: [
    "Period: hormones are low and the uterus lining sheds. Energy is often lower and cramps are common.",
    "Follicular phase: estrogen climbs. Many people feel more energy, better focus and a lifted mood.",
    "Ovulation: around the middle of the cycle an egg is released. Discharge becomes clear and stretchy and some people feel a twinge on one side.",
    "Luteal phase: progesterone rises. In the last week, PMS can bring cravings, bloating, tender breasts, acne and mood swings. Everyone is different, and tracking shows you your own pattern.",
  ] },
  { id: "discharge", title: "Understanding discharge", minutes: 2, paragraphs: [
    "Discharge is normal and healthy: it keeps the vagina clean and changes through your cycle.",
    "After your period it's often dry or sticky, then creamy, then watery, and around ovulation it's clear and stretchy like raw egg white. After ovulation it gets thicker and less again.",
    "Call a doctor if discharge is green, gray or yellow, chunky like cottage cheese, smells strongly or fishy, or comes with itching, burning or pain. Those can be signs of an infection that's easy to treat.",
  ] },
  { id: "normal-period", title: "What's a normal period?", minutes: 2, paragraphs: [
    "Most periods last 2 to 7 days and come every 21 to 35 days (21 to 45 in the first years for teens).",
    "Losing a few tablespoons of blood over a period is typical. Clots smaller than a quarter are usually normal.",
    "Talk to a doctor if you soak a pad or tampon every hour for several hours, bleed longer than 7 days, have pain that pain relievers don't help, skip periods for 3 months (and aren't pregnant), or bleed between periods often.",
  ] },
  { id: "ovulation", title: "Signs of ovulation", minutes: 2, paragraphs: [
    "Egg-white discharge is the most noticeable sign. It helps sperm travel, which is why it shows up at the most fertile time.",
    "Ovulation tests (LH strips) turn positive 1 to 2 days before ovulation.",
    "Basal body temperature, taken as soon as you wake up before getting out of bed, rises a little after ovulation and stays up until your next period. It confirms ovulation happened rather than predicting it.",
    "Logging these together makes predictions more accurate. None of them is birth control.",
  ] },
  { id: "pms", title: "PMS and PMDD", minutes: 2, paragraphs: [
    "PMS is a group of symptoms in the week or two before a period: bloating, cravings, breast tenderness, headaches, acne, tiredness and mood changes. Most people have some.",
    "Regular movement, steady meals with complex carbs, less salt and caffeine, and good sleep help many people.",
    "PMDD is a more severe form where mood changes like deep sadness, anxiety or anger seriously get in the way of life every month. It's a real medical condition and treatments help. Tell a doctor if this sounds like you.",
  ] },
  { id: "iron", title: "Iron, energy and your period", minutes: 1, paragraphs: [
    "Every period you lose some iron. If you don't get enough back, you can feel tired, dizzy, short of breath or look pale.",
    "Iron-rich foods include red meat, chicken, fish, beans, lentils, spinach, tofu and fortified cereal. Vitamin C (citrus, berries, peppers) helps your body absorb plant iron. Tea and coffee with meals make it harder.",
    "If you feel tired all the time and have heavy periods, a simple blood test can check your iron.",
  ] },
  { id: "doctor", title: "When to see a doctor", minutes: 1, paragraphs: [
    "No period by age 15, or no period for 3 months in a row (and not pregnant).",
    "Very heavy bleeding, bleeding longer than 7 days, or pain that keeps you from daily life.",
    "Bleeding after sex or between periods, or discharge that looks or smells unusual.",
    "Mood changes before your period that feel unmanageable.",
    "Sudden fever, rash or feeling very sick while using a tampon (toxic shock is rare but serious). Remove the tampon and get help right away.",
  ] },
];
