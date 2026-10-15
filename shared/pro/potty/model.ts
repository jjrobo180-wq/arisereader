// Potty Training: the saved data, what each log entry means, and everything worked out from the
// log — daily numbers, streaks, the child's own rhythm (how long between pees, how soon after a
// drink they pee, how soon after a meal they poop), predicted pee and poop windows, health flags,
// a daily potty schedule, and whether the child looks ready for the next stage.
//
// The timing rules come from published guidance, then give way to the child's own data:
//  - Toddlers usually pee every 1.5–2 hours (ERIC, the UK children's bladder & bowel charity).
//  - Poops are most likely 15–30 minutes after a meal (the gastrocolic reflex) — University of
//    Vermont Continence Project; Children's Hospital of Philadelphia "I-SIT" instructions.
//  - Sits last about 1 minute per year of age, up to 10 minutes (CHOP I-SIT).
//  - 6–8 drinks a day, none in the hour before bed (ERIC).
//  - Peeing more than once an hour, or going 5–6 hours without, is worth raising with a doctor
//    (University of Vermont Continence Project).

export type Kind =
  | "pee" | "poop" | "both" | "try" | "dry"
  | "acc-pee" | "acc-poop"
  | "diaper-wet" | "diaper-dirty"
  | "nap-dry" | "nap-wet" | "night-dry" | "night-wet"
  | "food" | "drink" | "note";
export type Init = "self" | "prompted" | "schedule" | "";
export type Place = "home" | "daycare" | "out" | "";
/** What was drunk: a bottle (breast milk or formula), juice, and the usual others. */
export type DrinkType = "bottle" | "juice" | "water" | "milk" | "smoothie" | "other";
export const DRINK_TYPES: { id: DrinkType; label: string; emoji: string }[] = [
  { id: "bottle", label: "Bottle", emoji: "🍼" }, { id: "juice", label: "Juice", emoji: "🧃" }, { id: "water", label: "Water", emoji: "💧" },
  { id: "milk", label: "Milk", emoji: "🥛" }, { id: "smoothie", label: "Smoothie", emoji: "🥤" }, { id: "other", label: "Other", emoji: "🥤" },
];
export const drinkInfo = (t?: DrinkType | "") => DRINK_TYPES.find((d) => d.id === t);
/** Entries made before drink types existed carried the type in the note ("Juice, Water"). */
export function drinkTypeOf(e: { kind: string; drink?: DrinkType; note?: string }): DrinkType | undefined {
  if (e.kind !== "drink") return undefined;
  if (e.drink) return e.drink;
  const n = (e.note || "").toLowerCase();
  return DRINK_TYPES.find((d) => n.includes(d.id))?.id;
}
export type Entry = {
  id: string; kid: string; at: number; kind: Kind;
  /** Who started a potty trip: the child (told you / went alone), you asked, or the schedule/timer. */
  init?: Init;
  /** Bristol stool type 1–7 for a poop. */
  bristol?: number;
  /** Drink size in millilitres. */
  ml?: number;
  /** Drinks: bottle, juice, water… */
  drink?: DrinkType;
  /** Food: a snack or a meal. */
  size?: "snack" | "meal";
  where?: Place;
  pain?: boolean;
  note?: string;
};

export type KindInfo = { label: string; short: string; emoji: string; color: string; group: "potty" | "accident" | "diaper" | "sleep" | "intake" | "other" };
export const KINDS: Record<Kind, KindInfo> = {
  pee: { label: "Pee in the potty", short: "Pee", emoji: "💧", color: "#3D8BFD", group: "potty" },
  poop: { label: "Poop in the potty", short: "Poop", emoji: "💩", color: "#9A6B47", group: "potty" },
  both: { label: "Pee and poop in the potty", short: "Both", emoji: "🌟", color: "#7C5CFF", group: "potty" },
  try: { label: "Sat and tried", short: "Tried", emoji: "🪑", color: "#94A3B8", group: "potty" },
  dry: { label: "Dry pants check", short: "Dry", emoji: "✅", color: "#22A06B", group: "potty" },
  "acc-pee": { label: "Pee accident", short: "Pee accident", emoji: "💦", color: "#E26D5A", group: "accident" },
  "acc-poop": { label: "Poop accident", short: "Poop accident", emoji: "🧻", color: "#C2553F", group: "accident" },
  "diaper-wet": { label: "Wet diaper", short: "Wet diaper", emoji: "🩲", color: "#7FB2FF", group: "diaper" },
  "diaper-dirty": { label: "Poop in diaper", short: "Diaper poop", emoji: "🟤", color: "#B8916E", group: "diaper" },
  "nap-dry": { label: "Dry nap", short: "Dry nap", emoji: "😴", color: "#5B5FC7", group: "sleep" },
  "nap-wet": { label: "Wet nap", short: "Wet nap", emoji: "🛌", color: "#9496D9", group: "sleep" },
  "night-dry": { label: "Dry night", short: "Dry night", emoji: "🌙", color: "#3F43A8", group: "sleep" },
  "night-wet": { label: "Wet night", short: "Wet night", emoji: "🛏️", color: "#8486C9", group: "sleep" },
  food: { label: "Food", short: "Food", emoji: "🍽️", color: "#43A047", group: "intake" },
  drink: { label: "Drink", short: "Drink", emoji: "🥤", color: "#17A2B8", group: "intake" },
  note: { label: "Note", short: "Note", emoji: "📝", color: "#64748B", group: "other" },
};
export const isSuccess = (k: Kind) => k === "pee" || k === "poop" || k === "both";
export const isAccident = (k: Kind) => k === "acc-pee" || k === "acc-poop";
/** Every time urine came out, wherever it went — the bladder's own rhythm. */
export const isPeeEvent = (k: Kind) => k === "pee" || k === "both" || k === "acc-pee" || k === "diaper-wet";
/** Every poop, wherever it went — the bowel's rhythm (diaper poops count: that's the point of logging them). */
export const isPoopEvent = (k: Kind) => k === "poop" || k === "both" || k === "acc-poop" || k === "diaper-dirty";
export const earnsSticker = (k: Kind) => isSuccess(k) || k === "dry" || k === "night-dry" || k === "nap-dry";

export const BRISTOL: { type: number; look: string; means: string; tone: "hard" | "ideal" | "soft" }[] = [
  { type: 1, look: "Separate hard lumps, like nuts", means: "Constipated", tone: "hard" },
  { type: 2, look: "Sausage-shaped but lumpy", means: "Constipated", tone: "hard" },
  { type: 3, look: "Sausage with cracks on the surface", means: "Normal", tone: "ideal" },
  { type: 4, look: "Smooth and soft, like a sausage or snake", means: "Ideal", tone: "ideal" },
  { type: 5, look: "Soft blobs with clear-cut edges", means: "A little soft", tone: "soft" },
  { type: 6, look: "Fluffy, mushy pieces with ragged edges", means: "Loose", tone: "soft" },
  { type: 7, look: "Watery, no solid pieces", means: "Diarrhea", tone: "soft" },
];

// ─── Children ───
export type NeedId = "autism" | "down" | "cp" | "spina" | "delay" | "adhd" | "speech" | "sensory" | "vision" | "hearing" | "medical";
export type Comms = "words" | "few-words" | "signs" | "pictures" | "device" | "none";
export type Meal = { id: string; label: string; time: string };
export type Nap = { id: string; from: string; to: string };
export type Routine = { wake: string; bed: string; meals: Meal[]; naps: Nap[]; daycare: boolean; daycareDays: number[]; daycareFrom: string; daycareTo: string };
export type Child = {
  id: string; name: string; avatar: string;
  /** Birth month "YYYY-MM" (or a full date). Empty if not given. */
  birth: string;
  sex: "boy" | "girl" | "";
  needs: NeedId[]; comms: Comms;
  stage: StageId; method: MethodId; start: string;
  goal: number; prize: string; tryStickers: boolean;
  /** Reminder interval in minutes (0 = use the app's suggestion). */
  interval: number;
  routine: Routine;
  words: { pee: string; poop: string; potty: string };
};
export type StageId = "ready" | "sits" | "launch" | "habit" | "self" | "poop" | "outings" | "naps" | "nights" | "independent";
export type MethodId = "child" | "intensive" | "threeday" | "scheduled" | "data";

export const blankRoutine = (): Routine => ({
  wake: "07:00", bed: "19:30",
  meals: [{ id: "m1", label: "Breakfast", time: "07:30" }, { id: "m2", label: "Morning snack", time: "10:00" }, { id: "m3", label: "Lunch", time: "11:45" }, { id: "m4", label: "Afternoon snack", time: "15:00" }, { id: "m5", label: "Dinner", time: "17:30" }],
  naps: [{ id: "n1", from: "12:45", to: "14:30" }],
  daycare: false, daycareDays: [1, 2, 3, 4, 5], daycareFrom: "08:30", daycareTo: "16:30",
});
export const blankChild = (id: string, n = 0): Child => ({
  id, name: "", avatar: ["🧒", "👧", "👦", "👶", "🦁", "🐻", "🐰", "🦄"][n % 8], birth: "", sex: "", needs: [], comms: "words",
  stage: "ready", method: "child", start: "", goal: 10, prize: "Pick a new book", tryStickers: true, interval: 0,
  routine: blankRoutine(), words: { pee: "pee", poop: "poop", potty: "potty" },
});

// ─── Saved data ───
export type Sticker = { id: string; kid: string; s: string; at: number };
export type Prize = { id: string; kid: string; at: number; prize: string };
export type Experiment = { id: string; kid: string; strategy: string; title: string; start: string; days: number; status: "trying" | "worked" | "partly" | "didnt" | "stopped"; notes: string; ended?: string };
export type ChatMsg = { id: string; role: "me" | "coach"; text: string; steps?: string[]; tryNext?: string[]; doctor?: string; at: number };
export type SchedItem = { id: string; time: string; kind: "sit" | "prompt" | "drink" | "meal" | "routine" | "sleep" | "note"; label: string; why: string };
export type SavedSchedule = { kid: string; made: string; source: "builder" | "ai"; title: string; items: SchedItem[]; tips: string[] };
export type MyVideo = { id: string; yt: string; title: string; audience: "kids" | "parents"; added: number };
export type VisualStep = { id: string; emoji: string; label: string; on: boolean };
export type PottyData = {
  v: 2;
  kids: Child[]; cur: string;
  logs: Entry[]; stickers: Sticker[]; prizes: Prize[];
  ready: Record<string, string[]>;
  /** Checked program steps per child: "stage:index". */
  done: Record<string, string[]>;
  experiments: Experiment[];
  chats: Record<string, ChatMsg[]>;
  schedules: Record<string, SavedSchedule>;
  myVideos: MyVideo[]; favVideos: string[]; sitVideo: string;
  visual: Record<string, VisualStep[]>;
  story: Record<string, { title: string; pages: { text: string; emoji: string }[] }>;
  sensory: Record<string, string[]>;
  read: string[];
  timer: { kid: string; endAt: number; minutes: number } | null;
  /** Today's schedule running as reminders, for one child. */
  schedRun: { kid: string; day: string } | null;
  voice: boolean; units: "oz" | "ml";
};
export const DEFAULT_DATA: PottyData = {
  v: 2, kids: [], cur: "", logs: [], stickers: [], prizes: [], ready: {}, done: {}, experiments: [], chats: {}, schedules: {},
  myVideos: [], favVideos: [], sitVideo: "", visual: {}, story: {}, sensory: {}, read: [], timer: null, schedRun: null, voice: true, units: "oz",
};

const STAGES: StageId[] = ["ready", "sits", "launch", "habit", "self", "poop", "outings", "naps", "nights", "independent"];
const METHODS: MethodId[] = ["child", "intensive", "threeday", "scheduled", "data"];
const KIND_IDS = Object.keys(KINDS) as Kind[];
const str = (v: unknown, d = "", max = 400) => (typeof v === "string" ? v.slice(0, max) : d);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});
const time = (v: unknown, d: string) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : d);

/** Makes saved data safe to use, and moves the first version of the app's data (v1) forward. */
export function cleanData(raw: unknown): PottyData {
  const r = obj(raw);
  const base = blankRoutine();
  const kids: Child[] = arr<any>(r.kids).filter((k) => k && typeof k.id === "string").map((k, i) => {
    const b = blankChild(k.id, i); const rt = obj(k.routine);
    return {
      ...b, name: str(k.name, "", 40), avatar: str(k.avatar, b.avatar, 8), birth: str(k.birth, "", 10),
      sex: k.sex === "boy" || k.sex === "girl" ? k.sex : "",
      needs: arr<string>(k.needs).filter((x) => typeof x === "string") as NeedId[],
      comms: (["words", "few-words", "signs", "pictures", "device", "none"] as Comms[]).includes(k.comms) ? k.comms : "words",
      // v1 had no stages: someone already using it was past the start.
      stage: STAGES.includes(k.stage) ? k.stage : (r.v === 2 ? "ready" : "launch"),
      method: METHODS.includes(k.method) ? k.method : k.method === "timed" ? "scheduled" : "child",
      start: str(k.start, "", 10), goal: Math.max(3, Math.min(40, num(k.goal, 10))), prize: str(k.prize, b.prize, 80),
      tryStickers: typeof k.tryStickers === "boolean" ? k.tryStickers : true, interval: Math.max(0, Math.min(240, num(k.interval, 0))),
      routine: {
        wake: time(rt.wake, base.wake), bed: time(rt.bed, base.bed),
        meals: rt.meals ? arr<any>(rt.meals).map((m, j) => ({ id: str(m.id, `m${j}`), label: str(m.label, "Meal", 30), time: time(m.time, "12:00") })) : base.meals,
        naps: rt.naps ? arr<any>(rt.naps).map((n, j) => ({ id: str(n.id, `n${j}`), from: time(n.from, "13:00"), to: time(n.to, "14:30") })) : base.naps,
        daycare: !!rt.daycare, daycareDays: rt.daycareDays ? arr<number>(rt.daycareDays).filter((d) => d >= 0 && d <= 6) : base.daycareDays,
        daycareFrom: time(rt.daycareFrom, base.daycareFrom), daycareTo: time(rt.daycareTo, base.daycareTo),
      },
      words: { pee: str(obj(k.words).pee, "pee", 20), poop: str(obj(k.words).poop, "poop", 20), potty: str(obj(k.words).potty, "potty", 20) },
    };
  });
  const logs: Entry[] = arr<any>(r.logs).filter((e) => e && typeof e.id === "string" && typeof e.kid === "string" && typeof e.at === "number" && KIND_IDS.includes(e.kind)).map((e) => {
    const out: Entry = { id: e.id, kid: e.kid, at: e.at, kind: e.kind };
    if (e.init === "self" || e.init === "prompted" || e.init === "schedule") out.init = e.init;
    if (typeof e.bristol === "number" && e.bristol >= 1 && e.bristol <= 7) out.bristol = Math.round(e.bristol);
    if (typeof e.ml === "number" && e.ml > 0) out.ml = Math.min(2000, Math.round(e.ml));
    if (e.size === "snack" || e.size === "meal") out.size = e.size;
    if (e.kind === "drink" && DRINK_TYPES.some((d) => d.id === e.drink)) out.drink = e.drink;
    if (e.where === "home" || e.where === "daycare" || e.where === "out") out.where = e.where;
    if (e.pain === true) out.pain = true;
    if (typeof e.note === "string" && e.note.trim()) out.note = e.note.slice(0, 500);
    return out;
  });
  const recordOf = <T>(v: unknown, f: (x: unknown) => T): Record<string, T> => Object.fromEntries(Object.entries(obj(v)).map(([k, x]) => [k, f(x)]));
  // v1 kept readiness as "ready" and program checks as "plan" (step keys from the old guide; dropped).
  return {
    v: 2, kids, cur: kids.some((k) => k.id === r.cur) ? r.cur : kids[0]?.id || "", logs,
    stickers: arr<any>(r.stickers).filter((s) => s && typeof s.s === "string"),
    prizes: arr<any>(r.prizes).filter((p) => p && typeof p.prize === "string"),
    ready: recordOf(r.ready, (x) => arr<string>(x).filter((s) => typeof s === "string")),
    done: recordOf(r.done, (x) => arr<string>(x).filter((s) => typeof s === "string")),
    experiments: arr<any>(r.experiments).filter((x) => x && typeof x.id === "string"),
    chats: recordOf(r.chats, (x) => arr<ChatMsg>(x).filter((m) => m && typeof m.text === "string").slice(-80)),
    schedules: recordOf(r.schedules, (x) => obj(x) as SavedSchedule),
    myVideos: arr<any>(r.myVideos).filter((v) => v && /^[\w-]{11}$/.test(v.yt)),
    favVideos: arr<string>(r.favVideos).filter((x) => typeof x === "string"),
    sitVideo: str(r.sitVideo, "", 40),
    visual: recordOf(r.visual, (x) => arr<VisualStep>(x).filter((s) => s && typeof s.label === "string")),
    story: recordOf(r.story, (x) => { const o = obj(x); return { title: str(o.title, "", 80), pages: arr<any>(o.pages).map((p) => ({ text: str(p.text, "", 300), emoji: str(p.emoji, "🙂", 8) })) }; }),
    sensory: recordOf(r.sensory, (x) => arr<string>(x).filter((s) => typeof s === "string")),
    read: arr<string>(r.read).filter((x) => typeof x === "string"),
    timer: r.timer && typeof r.timer.endAt === "number" ? { kid: str(r.timer.kid), endAt: r.timer.endAt, minutes: num(r.timer.minutes, 60) } : null,
    schedRun: r.schedRun && typeof r.schedRun.kid === "string" && typeof r.schedRun.day === "string" ? { kid: r.schedRun.kid, day: r.schedRun.day } : null,
    voice: typeof r.voice === "boolean" ? r.voice : true,
    units: r.units === "ml" ? "ml" : "oz",
  };
}

// ─── Dates and time ───
const pad = (n: number) => String(n).padStart(2, "0");
export const dayOf = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const hm = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const minsOf = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export const hmOf = (mins: number) => { const m = ((Math.round(mins) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
/** A clock time today (or on `day`) as a timestamp. */
export const atTime = (t: string, day = dayOf(Date.now())) => { const [y, mo, d] = day.split("-").map(Number); return new Date(y, mo - 1, d, Math.floor(minsOf(t) / 60), minsOf(t) % 60).getTime(); };
export const clock12 = (t: string) => { const m = minsOf(t); const h = Math.floor(m / 60); return `${h % 12 || 12}:${pad(m % 60)} ${h < 12 ? "AM" : "PM"}`; };
export const clockOf = (ms: number) => clock12(hm(ms));
export const addDay = (day: string, n: number) => { const [y, m, d] = day.split("-").map(Number); return dayOf(new Date(y, m - 1, d + n, 12).getTime()); };
export const daysBack = (n: number, end = dayOf(Date.now())) => Array.from({ length: n }, (_, i) => addDay(end, i - n + 1));

/** Age in whole months from a "YYYY-MM" or "YYYY-MM-DD" birth date (null if unknown). */
export function ageMonths(birth: string, now = Date.now()): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(birth);
  if (!m) return null;
  const d = new Date(now);
  const months = (d.getFullYear() - Number(m[1])) * 12 + (d.getMonth() + 1 - Number(m[2]));
  return months >= 0 && months < 240 ? months : null;
}
export const ageText = (months: number | null) => (months === null ? "" : months < 24 ? `${months} months` : months % 12 === 0 ? `${months / 12} years` : `${Math.floor(months / 12)} y ${months % 12} m`);
/** How long a sit lasts: about 1 minute per year of age, between 2 and 10 minutes (CHOP I-SIT). */
export const sitMinutes = (months: number | null) => (months === null ? 3 : Math.max(2, Math.min(10, Math.round(months / 12))));
/** The usual gap between pees when there's no data yet (ERIC: toddlers wee every 1.5–2 hours). */
export const defaultInterval = (months: number | null) => (months !== null && months < 24 ? 75 : months !== null && months >= 48 ? 120 : 90);

// ─── Numbers from the log ───
export type DayStats = { successes: number; pees: number; poops: number; accidents: number; tries: number; dry: number; self: number; prompted: number; diapers: number; drinksMl: number; drinks: number; meals: number; rate: number | null; selfRate: number | null };
export function dayStats(logs: Entry[], kid: string, day: string): DayStats {
  const l = logs.filter((x) => x.kid === kid && dayOf(x.at) === day);
  const successes = l.filter((x) => isSuccess(x.kind)); const accidents = l.filter((x) => isAccident(x.kind)).length;
  const self = successes.filter((x) => x.init === "self").length; const prompted = successes.filter((x) => x.init === "prompted" || x.init === "schedule").length;
  const drinks = l.filter((x) => x.kind === "drink");
  return {
    successes: successes.length, accidents, self, prompted,
    pees: l.filter((x) => isPeeEvent(x.kind)).length, poops: l.filter((x) => isPoopEvent(x.kind)).length,
    tries: l.filter((x) => x.kind === "try").length, dry: l.filter((x) => x.kind === "dry").length,
    diapers: l.filter((x) => x.kind === "diaper-wet" || x.kind === "diaper-dirty").length,
    drinks: drinks.length, drinksMl: drinks.reduce((s, x) => s + (x.ml || 0), 0), meals: l.filter((x) => x.kind === "food").length,
    rate: successes.length + accidents ? successes.length / (successes.length + accidents) : null,
    selfRate: self + prompted ? self / (self + prompted) : null,
  };
}
export function sumStats(logs: Entry[], kid: string, days: string[]) {
  const all = days.map((d) => dayStats(logs, kid, d));
  const s = all.reduce((a, x) => ({ successes: a.successes + x.successes, accidents: a.accidents + x.accidents, self: a.self + x.self, prompted: a.prompted + x.prompted, poops: a.poops + x.poops }), { successes: 0, accidents: 0, self: 0, prompted: 0, poops: 0 });
  return { ...s, rate: s.successes + s.accidents ? s.successes / (s.successes + s.accidents) : null, selfRate: s.self + s.prompted ? s.self / (s.self + s.prompted) : null, days: all };
}
/** Days in a row (ending today, or yesterday if nothing good is logged yet today) with potty wins and no daytime accident. */
export function accidentFreeDays(logs: Entry[], kid: string, now = Date.now()): number {
  let day = dayOf(now); const t = dayStats(logs, kid, day);
  if (!(t.successes > 0 && t.accidents === 0)) day = addDay(day, -1);
  let n = 0;
  for (let i = 0; i < 365; i++) { const s = dayStats(logs, kid, day); if (s.successes > 0 && s.accidents === 0) { n++; day = addDay(day, -1); } else break; }
  return n;
}
function inARow(logs: Entry[], kid: string, good: Kind, bad: Kind) {
  const l = logs.filter((x) => x.kid === kid && (x.kind === good || x.kind === bad)).sort((a, b) => b.at - a.at);
  let n = 0; for (const x of l) { if (x.kind === good) n++; else break; } return n;
}
export const dryNights = (logs: Entry[], kid: string) => inARow(logs, kid, "night-dry", "night-wet");
export const dryNaps = (logs: Entry[], kid: string) => inARow(logs, kid, "nap-dry", "nap-wet");

const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export type Rhythm = {
  /** Typical minutes between pees (same day), and how many gaps it's based on. */
  peeGap: number | null; peeGapN: number;
  /** Typical minutes from a drink of 90 ml+ to the next pee. */
  drinkToPee: number | null; drinkToPeeN: number;
  /** Typical minutes from eating to a poop (poops within 2½ hours of a meal or snack). */
  mealToPoop: number | null; mealToPoopN: number;
  /** Poops per day on days with any logging, over the window. */
  poopsPerDay: number | null;
  /** Hours (0–23) poops usually happen, most common first. */
  poopHours: number[];
  /** Pees by hour of day. */
  peeByHour: number[]; poopByHour: number[];
  daysWithData: number;
};
/** Learns this child's own rhythm from the last `days` days of the log. */
export function rhythm(logs: Entry[], kid: string, now = Date.now(), days = 14): Rhythm {
  const since = now - days * 86_400_000;
  const l = logs.filter((x) => x.kid === kid && x.at >= since && x.at <= now).sort((a, b) => a.at - b.at);
  const pees = l.filter((x) => isPeeEvent(x.kind)); const poops = l.filter((x) => isPoopEvent(x.kind));
  const gaps: number[] = [];
  for (let i = 1; i < pees.length; i++) if (dayOf(pees[i].at) === dayOf(pees[i - 1].at)) { const g = (pees[i].at - pees[i - 1].at) / 60_000; if (g >= 10 && g <= 300) gaps.push(g); }
  const dp: number[] = [];
  for (const d of l.filter((x) => x.kind === "drink" && (x.ml || 0) >= 90)) { const next = pees.find((p) => p.at > d.at); if (next) { const g = (next.at - d.at) / 60_000; if (g >= 10 && g <= 240) dp.push(g); } }
  const mp: number[] = [];
  for (const p of poops) { const meal = [...l].reverse().find((x) => x.kind === "food" && x.at <= p.at); if (meal) { const g = (p.at - meal.at) / 60_000; if (g >= 0 && g <= 150) mp.push(g); } }
  const peeByHour = Array(24).fill(0), poopByHour = Array(24).fill(0);
  for (const p of pees) peeByHour[new Date(p.at).getHours()]++;
  for (const p of poops) poopByHour[new Date(p.at).getHours()]++;
  const loggedDays = new Set(l.filter((x) => x.kind !== "note").map((x) => dayOf(x.at)));
  return {
    peeGap: gaps.length >= 4 ? Math.round(median(gaps)) : null, peeGapN: gaps.length,
    drinkToPee: dp.length >= 4 ? Math.round(median(dp)) : null, drinkToPeeN: dp.length,
    mealToPoop: mp.length >= 3 ? Math.round(median(mp)) : null, mealToPoopN: mp.length,
    poopsPerDay: loggedDays.size >= 3 ? Math.round((poops.length / loggedDays.size) * 10) / 10 : null,
    poopHours: poopByHour.map((n, h) => ({ n, h })).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).map((x) => x.h).slice(0, 3),
    peeByHour, poopByHour, daysWithData: loggedDays.size,
  };
}

// ─── Predictions ───
export type Window = { kind: "pee" | "poop"; from: number; to: number; center: number; confidence: "learning" | "good"; why: string };
/**
 * When the next pee and poop are likely. Pee: last pee plus the child's typical gap (or the
 * 1.5–2 hour toddler norm), brought forward by a recent big drink. Poop: 15–30 minutes after a
 * meal (or the child's own meal-to-poop time), or around the hour they usually go.
 */
export function predict(logs: Entry[], child: Child, now = Date.now()): Window[] {
  const r = rhythm(logs, child.id, now);
  const months = ageMonths(child.birth, now);
  const out: Window[] = [];
  const today = dayOf(now);
  const l = logs.filter((x) => x.kid === child.id && x.at <= now).sort((a, b) => a.at - b.at);
  // Pee
  const gap = r.peeGap ?? defaultInterval(months);
  const lastPee = [...l].reverse().find((x) => isPeeEvent(x.kind) && now - x.at < 8 * 3_600_000);
  const wake = atTime(child.routine.wake, today);
  const asleep = minsOf(hm(now)) >= minsOf(child.routine.bed) || minsOf(hm(now)) < minsOf(child.routine.wake);
  if (!asleep) {
    const from0 = lastPee ? lastPee.at : Math.max(wake, now - gap * 60_000 / 2);
    let center = from0 + gap * 60_000; const why: string[] = [];
    why.push(lastPee ? `last pee at ${clockOf(lastPee.at)}, and ${r.peeGap ? `${child.name || "your child"} usually goes every ${r.peeGap} min` : `toddlers usually go every ${Math.round(gap / 15) * 15} min`}` : "no pee logged yet today");
    const bigDrink = [...l].reverse().find((x) => x.kind === "drink" && (x.ml || 0) >= 90 && (!lastPee || x.at > lastPee.at));
    if (bigDrink) {
      const delay = r.drinkToPee ?? 60;
      const c = bigDrink.at + delay * 60_000;
      if (c < center) { center = Math.max(c, (lastPee?.at ?? bigDrink.at) + 30 * 60_000); why.push(`a drink at ${clockOf(bigDrink.at)} usually shows up ${r.drinkToPee ? `about ${delay} min later` : "within about an hour"}`); }
    }
    if (center < now) center = now + 5 * 60_000; // overdue: soon
    const half = Math.max(10, Math.round(gap * 0.15)) * 60_000;
    out.push({ kind: "pee", center, from: center - half, to: center + half, confidence: r.peeGap ? "good" : "learning", why: why.join("; ") });
  }
  // Poop
  const pooped = l.filter((x) => isPoopEvent(x.kind) && dayOf(x.at) === today).length;
  const perDay = r.poopsPerDay ?? 1;
  if (!asleep && pooped < Math.max(1, Math.round(perDay))) {
    const delay = r.mealToPoop; const span = delay ? [Math.max(5, delay - 10), delay + 10] : [15, 30];
    const cands: { at: number; why: string }[] = [];
    const lastFood = [...l].reverse().find((x) => x.kind === "food" && now - x.at < 150 * 60_000);
    if (lastFood) cands.push({ at: lastFood.at, why: `${lastFood.size === "snack" ? "snack" : "meal"} at ${clockOf(lastFood.at)}` });
    for (const m of child.routine.meals) { const t = atTime(m.time, today); if (t > now - 30 * 60_000 && (!lastFood || Math.abs(t - lastFood.at) > 45 * 60_000)) cands.push({ at: t, why: `${m.label.toLowerCase()} at ${clock12(m.time)}` }); }
    const windows = cands.map((c) => ({ from: c.at + span[0] * 60_000, to: c.at + span[1] * 60_000, why: `${c.why}; poops ${delay ? `usually come about ${delay} min after eating` : "are most likely 15–30 min after eating"}` })).filter((w) => w.to > now).sort((a, b) => a.from - b.from);
    // The hour they usually go, if it's still ahead today and the data is clear.
    const usual = r.poopHours[0];
    if (usual !== undefined && r.poopByHour[usual] >= 3) {
      const t = atTime(`${pad(usual)}:00`, today);
      if (t + 60 * 60_000 > now) windows.push({ from: Math.max(t, now), to: t + 60 * 60_000, why: `${child.name || "your child"} often poops around ${clock12(`${pad(usual)}:00`)}` });
      windows.sort((a, b) => a.from - b.from);
    }
    const w = windows[0];
    if (w) out.push({ kind: "poop", from: Math.max(w.from, now), to: w.to, center: (Math.max(w.from, now) + w.to) / 2, confidence: delay || usual !== undefined ? "good" : "learning", why: w.why });
  }
  return out;
}

// ─── Health flags ───
export type Flag = { level: "info" | "watch" | "doctor"; title: string; text: string; article?: string };
export function healthFlags(logs: Entry[], kid: string, now = Date.now()): Flag[] {
  const r = rhythm(logs, kid, now); const flags: Flag[] = [];
  const l = logs.filter((x) => x.kid === kid && x.at <= now);
  const poops = l.filter((x) => isPoopEvent(x.kind)).sort((a, b) => b.at - a.at);
  if (r.peeGap !== null && r.peeGapN >= 6 && r.peeGap < 60) flags.push({ level: "doctor", title: "Peeing more than once an hour", text: "Frequent peeing can come from constipation, a bladder infection or an overactive bladder. Mention it to your child's doctor, especially with burning, pain or new thirst.", article: "doctor" });
  if (r.peeGap !== null && r.peeGapN >= 4 && r.peeGap > 300) flags.push({ level: "watch", title: "Long gaps between pees", text: "Going 5–6 hours without peeing can mean not enough to drink, or a bladder that holds on too long. Offer more drinks and mention it to the doctor if it keeps happening.", article: "drinks" });
  if (poops.length) {
    const days = Math.floor((now - poops[0].at) / 86_400_000);
    if (days >= 3) flags.push({ level: "watch", title: `No poop logged for ${days} days`, text: "Three or more days without a poop can be the start of constipation, which makes potty training much harder. Offer water, fruit, vegetables and a relaxed sit after meals. If it keeps happening, talk to the doctor.", article: "constipation" });
  }
  const recent = poops.slice(0, 5).filter((p) => p.bristol);
  if (recent.filter((p) => (p.bristol || 4) <= 2).length >= 2) flags.push({ level: "watch", title: "Hard poops", text: "Two or more recent poops were type 1–2 on the stool chart (hard). Hard poops hurt, and children who've been hurt start holding on. Treat constipation before pushing on with training.", article: "constipation" });
  if (poops.slice(0, 5).some((p) => p.pain)) flags.push({ level: "doctor", title: "Painful poops", text: "Pain when pooping is the most common reason children start holding it in. Talk to your child's doctor about softening the poop.", article: "constipation" });
  if (recent.filter((p) => (p.bristol || 4) >= 6).length >= 3) flags.push({ level: "watch", title: "Loose poops", text: "Several loose poops in a row. Make sure your child drinks enough; if it lasts more than a few days, or comes with fever, blood or soiling, call the doctor.", article: "doctor" });
  if (r.daysWithData > 0 && r.daysWithData < 10) flags.push({ level: "info", title: `Learning ${r.daysWithData} of 10–14 days`, text: "Predictions get better as you log. Continence specialists collect 10–14 days of data before setting a schedule." });
  return flags;
}

// ─── Stage progress ───
export type Check = { id: string; text: string; met: boolean; detail: string };
/** What the log says about moving on from the current stage. */
export function stageChecks(stage: StageId, logs: Entry[], kid: string, readyCount: number, now = Date.now()): Check[] {
  const last3 = daysBack(3, dayOf(now)); const s3 = sumStats(logs, kid, last3);
  const pct = (x: number | null) => (x === null ? "no data yet" : `${Math.round(x * 100)}%`);
  const poops = logs.filter((x) => x.kid === kid && isPoopEvent(x.kind)).sort((a, b) => b.at - a.at).slice(0, 4);
  switch (stage) {
    case "ready": return [{ id: "signs", text: "Most readiness signs are there (6 of 10)", met: readyCount >= 6, detail: `${readyCount} of 10 checked` }];
    case "sits": { const sits = logs.filter((x) => x.kid === kid && (x.kind === "try" || isSuccess(x.kind)) && x.at > now - 7 * 86_400_000); const wins = sits.filter((x) => isSuccess(x.kind)).length; return [{ id: "sits", text: "Sits on the potty most days this week", met: new Set(sits.map((x) => dayOf(x.at))).size >= 4, detail: `${new Set(sits.map((x) => dayOf(x.at))).size} days with sits` }, { id: "wins", text: "Some pee or poop has gone in the potty", met: wins >= 3, detail: `${wins} this week` }]; }
    case "launch": { const good = s3.days.filter((d) => d.successes > 0 && d.rate !== null && d.rate >= 0.5).length; return [{ id: "half", text: "Half or more of pees in the potty on 2 of the last 3 days", met: good >= 2, detail: `${good} of 3 days` }]; }
    case "habit": return [{ id: "rate", text: "8 out of 10 in the potty over the last 3 days", met: (s3.rate ?? 0) >= 0.8, detail: pct(s3.rate) }, { id: "acc", text: "No more than 1 accident a day", met: s3.days.every((d) => d.accidents <= 1) && s3.successes > 0, detail: `${s3.accidents} in 3 days` }];
    case "self": return [{ id: "self", text: "Half of potty trips started by your child (last 3 days)", met: (s3.selfRate ?? 0) >= 0.5, detail: pct(s3.selfRate) }, { id: "rate", text: "Still 8 out of 10 in the potty", met: (s3.rate ?? 0) >= 0.8, detail: pct(s3.rate) }];
    case "poop": { const inPotty = poops.filter((p) => p.kind === "poop" || p.kind === "both").length; return [{ id: "poop", text: "3 of the last 4 poops in the potty", met: poops.length >= 4 && inPotty >= 3, detail: `${inPotty} of ${poops.length}` }]; }
    case "outings": { const out = logs.filter((x) => x.kid === kid && x.where === "out" && x.at > now - 14 * 86_400_000); const acc = out.filter((x) => isAccident(x.kind)).length; return [{ id: "out", text: "Potty trips logged while out, with no accidents", met: out.filter((x) => isSuccess(x.kind)).length >= 3 && acc === 0, detail: `${out.filter((x) => isSuccess(x.kind)).length} out, ${acc} accidents` }]; }
    case "naps": { const naps = logs.filter((x) => x.kid === kid && (x.kind === "nap-dry" || x.kind === "nap-wet")).sort((a, b) => b.at - a.at).slice(0, 7); const dry = naps.filter((x) => x.kind === "nap-dry").length; return [{ id: "naps", text: "5 of the last 7 naps dry", met: dry >= 5, detail: `${dry} of ${naps.length}` }]; }
    case "nights": { const n = dryNights(logs, kid); return [{ id: "nights", text: "7 dry nights in a row", met: n >= 7, detail: `${n} in a row` }]; }
    case "independent": return [{ id: "self", text: "Goes on their own most of the time", met: (s3.selfRate ?? 0) >= 0.8, detail: pct(s3.selfRate) }];
  }
}

// ─── A daily potty schedule from the routine ───
type Slot = { at: number; kind: SchedItem["kind"]; label: string; why: string };
/**
 * Builds a day: a sit on waking, a sit 15–30 minutes after each meal, sits before and after naps,
 * prompts at the child's interval in between, 6–8 drinks spread through the day with none in the
 * last hour before bed, and a last sit before bed. Earlier stages prompt more; later stages fade
 * to transition times only.
 */
export function buildSchedule(child: Child, opts: { interval?: number; months?: number | null; day?: number } = {}): SchedItem[] {
  const months = opts.months ?? ageMonths(child.birth);
  const sit = sitMinutes(months);
  const stage = child.stage;
  const base = opts.interval || child.interval || defaultInterval(months);
  const interval = stage === "launch" ? Math.min(base, 45) : stage === "sits" ? Math.max(base, 120) : base;
  const fade = stage === "self" || stage === "independent" || stage === "outings" || stage === "nights";
  const r = child.routine; const wake = minsOf(r.wake), bed = minsOf(r.bed);
  const dow = opts.day ?? new Date().getDay();
  const care = r.daycare && r.daycareDays.includes(dow) ? [minsOf(r.daycareFrom), minsOf(r.daycareTo)] : null;
  const slots: Slot[] = [];
  const add = (at: number, kind: Slot["kind"], label: string, why: string) => { if (at >= wake && at <= bed) slots.push({ at, kind, label, why }); };
  add(wake, "routine", "Wake up", "");
  add(wake + 5, "sit", `Potty sit (${sit} min)`, "Bladders are full after sleep — the easiest win of the day.");
  for (const m of r.meals) {
    const t = minsOf(m.time);
    add(t, "meal", `${m.label} + a drink`, "Offer a drink with every meal and snack.");
    if (!/snack/i.test(m.label) || stage === "poop" || stage === "sits") add(t + 20, "sit", `Potty sit after ${m.label.toLowerCase()} (${sit} min)`, "15–30 minutes after eating is when poops are most likely.");
  }
  for (const n of r.naps) {
    const a = minsOf(n.from), b = minsOf(n.to);
    add(a - 5, "sit", "Potty before nap", "Empty bladder before sleep.");
    add(a, "sleep", "Nap", "");
    add(b, "sit", "Potty on waking", "Right after waking is another reliable time.");
  }
  // Drinks between meals, up to 6–8 a day, none in the hour before bed.
  const mealTimes = r.meals.map((m) => minsOf(m.time));
  for (let t = wake + 90; t < bed - 60; t += 120) if (!mealTimes.some((m) => Math.abs(m - t) < 50)) add(t, "drink", "Drink of water", "6–8 drinks a day keeps poops soft and gives the bladder practice.");
  add(bed - 60, "note", "Last drink of the day", "No drinks in the hour before bed (ERIC).");
  add(bed - 15, "sit", "Last potty before bed", "Part of the bedtime routine, every night.");
  add(bed, "sleep", "Bedtime", "");
  // Prompts in the gaps, at the interval (fewer once the child is starting trips on their own).
  if (!fade) {
    const fixed = () => slots.filter((s) => s.kind === "sit" || s.kind === "sleep").map((s) => s.at).sort((a, b) => a - b);
    let guard = 0;
    for (let t = wake + 5 + interval; t < bed - 20 && guard++ < 40; t += interval) {
      const near = fixed().some((f) => Math.abs(f - t) < interval * 0.5);
      const napping = r.naps.some((n) => t > minsOf(n.from) - 10 && t < minsOf(n.to));
      if (!near && !napping) add(t, "prompt", stage === "launch" ? "Potty time" : "Potty break", stage === "launch" ? "Frequent trips in the first days build the habit fast." : "Timed to your child's usual gap between pees.");
    }
  } else {
    add(wake + 5, "note", "Let them lead", "From here, remind only at transition times — before leaving, before sleep, after meals.");
  }
  if (care) {
    const [a, b] = care;
    for (const s of slots) if (s.at > a && s.at < b && s.kind !== "routine") s.label = `${s.label} (at daycare)`;
    add(a - 10, "sit", "Potty before daycare drop-off", "Go before leaving, every time.");
    add(b, "note", "Pick-up: ask how the day went", "Ask staff for times of potty trips and accidents, and log them.");
  }
  return slots.sort((x, y) => x.at - y.at).map((s, i) => ({ id: `s${i}`, time: hmOf(s.at), kind: s.kind, label: s.label, why: s.why }));
}

/** A short summary of the child for the AI coach (no names of anyone else, no contact details). */
export function contextFor(child: Child, logs: Entry[], extras: { readiness: number; stageTitle: string; methodTitle: string; needLabels: string[]; now?: number }): string {
  const now = extras.now ?? Date.now();
  const months = ageMonths(child.birth, now); const r = rhythm(logs, child.id, now);
  const week = sumStats(logs, child.id, daysBack(7, dayOf(now)));
  const flags = healthFlags(logs, child.id, now).filter((f) => f.level !== "info").map((f) => f.title);
  const notes = logs.filter((x) => x.kid === child.id && x.note).sort((a, b) => b.at - a.at).slice(0, 5).map((x) => `${dayOf(x.at)} ${KINDS[x.kind].short}: ${x.note}`);
  return [
    `Child: ${child.name || "the child"}, ${months === null ? "age not given" : ageText(months)}${child.sex ? `, ${child.sex}` : ""}.`,
    `Stage: ${extras.stageTitle}. Method: ${extras.methodTitle}. Readiness signs: ${extras.readiness}/10.`,
    child.needs.length ? `Additional needs: ${extras.needLabels.join(", ")}. Communicates with: ${child.comms}.` : `Communicates with: ${child.comms}.`,
    `Their words: pee="${child.words.pee}", poop="${child.words.poop}", potty="${child.words.potty}".`,
    `Routine: wakes ${child.routine.wake}, bed ${child.routine.bed}, meals ${child.routine.meals.map((m) => `${m.label} ${m.time}`).join(", ")}, naps ${child.routine.naps.map((n) => `${n.from}-${n.to}`).join(", ") || "none"}${child.routine.daycare ? `, daycare ${child.routine.daycareFrom}-${child.routine.daycareTo}` : ""}.`,
    `Last 7 days: ${week.successes} potty successes, ${week.accidents} accidents, ${week.poops} poops, success rate ${week.rate === null ? "n/a" : Math.round(week.rate * 100) + "%"}, self-started ${week.selfRate === null ? "n/a" : Math.round(week.selfRate * 100) + "%"}.`,
    `Rhythm: pee every ${r.peeGap ?? "unknown"} min; drink-to-pee ${r.drinkToPee ?? "unknown"} min; meal-to-poop ${r.mealToPoop ?? "unknown"} min; poops/day ${r.poopsPerDay ?? "unknown"}; dry nights in a row ${dryNights(logs, child.id)}.`,
    flags.length ? `Flags: ${flags.join("; ")}.` : "",
    notes.length ? `Recent notes: ${notes.join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

/** YouTube links and bare ids → the 11-character video id. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/.exec(s);
  return m ? m[1] : null;
}
export const mlToOz = (ml: number) => Math.round((ml / 29.5735) * 10) / 10;
export const ozToMl = (oz: number) => Math.round(oz * 29.5735);
