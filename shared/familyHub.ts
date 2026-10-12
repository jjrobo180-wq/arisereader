// Arise LifeHub · Family Hub: everything a household keeps beside its to-do lists.
// One sanitizer (cleanFamily) is shared by the page and the server, so whatever is stored
// always has the same safe shape, and old workspaces without family data simply get an empty hub.

import { cleanLifeLayout, type LifeLayout } from "./lifeLayout";
import { cleanSpreadsheets, type Spreadsheet } from "./sheetsApp";
import { cleanDriveFiles, type DriveFile } from "./driveApp";
import { cleanNotify, defaultNotify, type NotifyPrefs } from "./todoNotify";
import { cleanWidgets, type WidgetItem } from "./widgets";
import { KIT_LIFE_IDS, cleanKit, type KitRecord } from "./pluginKit";

export const FAMILY_SECTIONS = ["home", "tasks", "goals", "chores", "calendar", "behavior", "health", "cycle", "mood", "polls", "trips", "money", "notes", "news", "pills", "journal", "countdowns", "grocery", "meditate", "bible", "quotes", "history", "trending", "randomizer", "relationships", "dictionary", "links", "habits", "gratitude", "focus", "bucket", "recipes", "meals", "upkeep", "plants", "birthdays", "gifts", "pets", "contacts", "subscriptions", "jars", "tips", "reading", "watchlist", "weather", "convert", "car", "wishlist", "restaurants", "learning", "projects", "loans", "cleaning", "checkups", "sleep", "workouts", "routines", "milestones", "ious", "allowance", "giftcards", "warranties", "mileage", "mortgage", "clocks", "timers", "medical", ...KIT_LIFE_IDS, "notifications", "reader", "family"] as const;
export type FamilySection = typeof FAMILY_SECTIONS[number];
/** Sections that can be switched off. Home, Tasks, Notifications and Family members always show. */
export const TOGGLEABLE: readonly FamilySection[] = ["goals", "chores", "calendar", "behavior", "health", "cycle", "pills", "mood", "polls", "trips", "money", "notes", "news", "journal", "countdowns", "grocery", "meditate", "bible", "quotes", "history", "trending", "randomizer", "relationships", "dictionary", "links", "habits", "gratitude", "focus", "bucket", "recipes", "meals", "upkeep", "plants", "birthdays", "gifts", "pets", "contacts", "subscriptions", "jars", "tips", "reading", "watchlist", "weather", "convert", "car", "wishlist", "restaurants", "learning", "projects", "loans", "cleaning", "checkups", "sleep", "workouts", "routines", "milestones", "ious", "allowance", "giftcards", "warranties", "mileage", "mortgage", "clocks", "timers", "medical", ...KIT_LIFE_IDS];
/** Sections added from the Plugin Store: off until the family adds them (the others start on). */
export const ADD_ON_SECTIONS: readonly FamilySection[] = ["journal", "countdowns", "grocery", "meditate", "bible", "quotes", "history", "trending", "randomizer", "relationships", "dictionary", "links", "habits", "gratitude", "focus", "bucket", "recipes", "meals", "upkeep", "plants", "birthdays", "gifts", "pets", "contacts", "subscriptions", "jars", "tips", "reading", "watchlist", "weather", "convert", "car", "wishlist", "restaurants", "learning", "projects", "loans", "cleaning", "checkups", "sleep", "workouts", "routines", "milestones", "ious", "allowance", "giftcards", "warranties", "mileage", "mortgage", "clocks", "timers", "medical", ...KIT_LIFE_IDS];

/** A family's `sectionOrder` (only the toggleable sections can be reordered) made safe to use:
 *  every toggleable section appears exactly once, keeping the saved order where valid and
 *  appending anything missing (new sections, or a section dropped from a stale save) at the end. */
export function cleanSectionOrder(v: unknown): FamilySection[] {
  const saved = Array.isArray(v) ? v.filter((s): s is FamilySection => TOGGLEABLE.includes(s as FamilySection)) : [];
  const seen = new Set(saved);
  return [...saved, ...TOGGLEABLE.filter((s) => !seen.has(s))];
}

/** The toggleable sections in the family's chosen order, each paired with its fixed spot in the
 *  menu (the section right before it). Rendering splices this block in after that anchor. */
export const orderedToggleable = (f: Pick<Family, "sectionOrder">): FamilySection[] => cleanSectionOrder(f.sectionOrder);

export type Member = { id: string; name: string; emoji: string; color: string; kind: "adult" | "kid" };
export type Chore = { id: string; title: string; memberId: string; rotation: string[]; days: number[]; points: number };
export type ChoreDone = { id: string; choreId: string; date: string; memberId: string; points: number };
export type BehaviorEntry = { id: string; memberId: string; date: string; points: number; note: string };
export type Reward = { id: string; title: string; cost: number };
export type Redemption = { id: string; memberId: string; title: string; cost: number; date: string };
export type FamilyCalendar = { id: string; name: string; color: string; show: boolean };
export type EventRepeat = "none" | "weekly" | "monthly" | "yearly";
export type FamilyEvent = {
  id: string; title: string; date: string; time: string; endTime: string; calendarId: string;
  memberIds: string[]; location: string; notes: string; repeat: EventRepeat;
};
export type TripStop = { id: string; date: string; time: string; title: string; cost: number };
export type PackItem = { id: string; item: string; memberId: string; packed: boolean };
export type Trip = {
  id: string; name: string; destination: string; start: string; end: string; budget: number;
  notes: string; stops: TripStop[]; packing: PackItem[];
};
export type PollKind = "dinner" | "weekend" | "other";
export type Poll = {
  id: string; question: string; kind: PollKind; options: { id: string; label: string }[];
  votes: Record<string, string>; closed: boolean; createdAt: string; closesOn: string;
};
export type Bill = { id: string; name: string; amount: number; dueDay: number; category: string; autopay: boolean; paid: string[] };
export type BudgetCategory = { id: string; name: string; limit: number };
export type Expense = { id: string; categoryId: string; amount: number; date: string; note: string };
export type Note = { id: string; title: string; body: string; color: string; pinned: boolean; updatedAt: string };
/* Food & fitness. Adults get calories, macros and weight; kids get healthy habits only. */
export type Meal = "breakfast" | "lunch" | "dinner" | "snacks";
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snacks"];
export type FoodEntry = { id: string; memberId: string; date: string; meal: Meal; name: string; servings: number; calories: number; protein: number; carbs: number; fat: number };
export type ExerciseEntry = { id: string; memberId: string; date: string; name: string; minutes: number; calories: number };
export type DayEntry = { id: string; memberId: string; date: string; water: number; steps: number; fruitVeg: number };
export type WeightEntry = { id: string; memberId: string; date: string; weight: number };
export type SavedFood = { id: string; name: string; serving: string; calories: number; protein: number; carbs: number; fat: number };
export type HealthGoals = { calories: number; proteinPct: number; carbsPct: number; fatPct: number; water: number; steps: number; goalWeight: number; activeMinutes: number; fruitVeg: number };
/** What an adult answers in the Food & fitness intake. Their calorie plan is worked out from it. */
export type Sex = "female" | "male";
export type GoalType = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very";
export type DietStyle = "balanced" | "highProtein" | "lowerCarb" | "lowerFat";
export type HealthProfile = {
  sex: Sex; birthYear: number; heightIn: number; weight: number; goal: GoalType; goalWeight: number;
  rate: number; activity: ActivityLevel; diet: DietStyle; createdAt: string;
};
export type Health = { profiles: Record<string, HealthProfile>; goals: Record<string, HealthGoals>; food: FoodEntry[]; exercise: ExerciseEntry[]; days: DayEntry[]; weights: WeightEntry[]; foods: SavedFood[] };
export const emptyHealth = (): Health => ({ profiles: {}, goals: {}, food: [], exercise: [], days: [], weights: [], foods: [] });

/* Cycle tracker */
export type Flow = "none" | "spotting" | "light" | "medium" | "heavy";
export const FLOWS: Flow[] = ["spotting", "light", "medium", "heavy"];
export type Discharge = "" | "dry" | "sticky" | "creamy" | "watery" | "eggwhite" | "spotting" | "unusual";
export type Energy = "" | "low" | "ok" | "high";
export type OvTest = "" | "negative" | "positive";
/** One day of the cycle tracker. `pain` 0–3 (none to severe), `temp` basal body temperature in °F (0 = not taken). */
export type CycleLog = { id: string; memberId: string; date: string; flow: Flow; symptoms: string[]; note: string; discharge?: Discharge; pain?: number; energy?: Energy; temp?: number; ovTest?: OvTest };
export const DISCHARGES: Discharge[] = ["dry", "sticky", "creamy", "watery", "eggwhite", "spotting", "unusual"];
/** Is there anything logged on this day besides "no flow"? */
export const cycleLogUsed = (l: CycleLog) => l.flow !== "none" || l.symptoms.length > 0 || !!l.note.trim() || !!l.discharge || !!l.pain || !!l.energy || !!l.temp || !!l.ovTest;

/* Pill reminders */
export type Pill = { id: string; memberId: string; name: string; dose: string; times: string[]; days: number[]; start: string; end: string; supply: number | null; perDose: number; refillAt: number; notes: string; color: string; active: boolean };
/** One scheduled dose that was taken or skipped (id = pillId:date:time). */
export type PillDose = { id: string; pillId: string; date: string; time: string; status: "taken" | "skipped"; at: string };
export const PILL_COLORS = ["#7566e8", "#e0566b", "#36b6a5", "#f59e72", "#619ee6", "#e5b04f"];
/* Mood tracker */
export type MoodEntry = { id: string; memberId: string; date: string; mood: number; tags: string[]; note: string };
/* Goals */
export type GoalCategory = "personal" | "health" | "money" | "family" | "career" | "learning" | "home";
export type Goal = {
  id: string; title: string; why: string; category: GoalCategory; memberId: string; due: string;
  kind: "steps" | "number"; target: number; current: number; unit: string;
  milestones: { id: string; title: string; done: boolean }[]; done: boolean; createdAt: string; doneAt: string;
};
/* Plugin Store add-ons */
export type JournalEntry = { id: string; date: string; title: string; body: string; mood: string; createdAt: string };
export type Countdown = { id: string; title: string; date: string; emoji: string; color: string };
export type GroceryItem = { id: string; name: string; qty: string; aisle: string; checked: boolean; /** Estimated cost in dollars, 0 when unknown. */ price?: number };
export type SavedVerse = { id: string; reference: string; text: string };
export type MeditationLog = { id: string; date: string; minutes: number; kind: string };
/** A sticky note on the Home screen: `x` is how far across (0 to 1), `y` how far down in pixels. */
export type Sticky = { id: string; text: string; color: string; x: number; y: number };
export type RandomList = { id: string; name: string; items: string[] };
export type SavedWord = { id: string; word: string; definition: string };
export type PageLink = { id: string; title: string; url: string; emoji: string };
/** The family's own link page (like a link tree), shareable with a link. */
export type LinkPage = { title: string; bio: string; links: PageLink[] };
export type Habit = { id: string; name: string; emoji: string; color: string; days: string[] };
export type GratitudeDay = { id: string; date: string; items: string[] };
export type FocusLog = { id: string; date: string; minutes: number };
export type Recipe = { id: string; title: string; ingredients: string[]; steps: string; tags: string; servings: number; minutes: number };
export type MealSlot = "breakfast" | "lunch" | "dinner";
export type PlannedMeal = { id: string; date: string; slot: MealSlot; text: string; recipeId: string; /** Estimated cost of this meal in dollars. */ cost?: number; /** Adult servings it feeds. */ serves?: number };
/** Something that needs doing every so often: home upkeep, plants, a car or a pet. */
export type CareKind = "upkeep" | "plants" | "car" | "pets" | "cleaning" | "checkups";
export type CareItem = { id: string; kind: CareKind; group: string; name: string; everyDays: number; lastDone: string; notes: string };
export type Birthday = { id: string; name: string; month: number; day: number; /** 0 when the year isn't known. */ year: number; kind: "birthday" | "anniversary" | "other" };
export type Contact = { id: string; name: string; role: string; phone: string; email: string; note: string; emergency: boolean };
export type Subscription = { id: string; name: string; amount: number; cycle: "weekly" | "monthly" | "yearly"; nextDate: string; category: string };
export type SavingsJar = { id: string; name: string; emoji: string; color: string; target: number; saved: number };
/** One item in a list with a status: a book, a show, a bucket-list dream or a gift idea. */
export type CollectionKind = "reading" | "watchlist" | "bucket" | "gifts" | "wishlist" | "restaurants" | "learning" | "projects" | "loans";
export type CollectionItem = { id: string; kind: CollectionKind; title: string; sub: string; status: string; rating: number; note: string; url: string; price: number; doneOn: string };
export type WeatherPrefs = { place: string; unit: "F" | "C" };
export type SleepEntry = { id: string; date: string; bed: string; wake: string; quality: number };
export type Workout = { id: string; date: string; exercise: string; sets: number; reps: number; weight: number; unit: "lb" | "kg" };
/** A checklist that starts fresh each day. `doneSteps` counts only on `doneDate`. */
export type Routine = { id: string; name: string; emoji: string; steps: { id: string; text: string }[]; doneDate: string; doneSteps: string[] };
export type Milestone = { id: string; who: string; title: string; date: string; note: string };
/** Money between you and someone else: positive, they owe you; negative, you owe them. */
export type Iou = { id: string; person: string; amount: number; note: string; date: string; settled: boolean };
export type AllowanceEntry = { id: string; who: string; amount: number; note: string; date: string };
export type GiftCard = { id: string; store: string; balance: number; expires: string; note: string };
export type Warranty = { id: string; item: string; store: string; bought: string; until: string; note: string };
export type MileageTrip = { id: string; date: string; miles: number; purpose: string; route: string };
export type MedicalCard = { id: string; person: string; bloodType: string; allergies: string; conditions: string; medications: string; doctor: string; insurance: string; notes: string };
/** Plugin Store add-ons that live on another screen rather than in the menu. */
/** Extras added from the Plugin Store: sticky notes on Home, and the AI assistant's chat button. */
export type Widgets = { stickies: boolean; chat?: boolean; board?: boolean };
/* News */
export type NewsPrefs = { topics: string[]; place: string };

/** `hub`: a teacher's Arise WorkHub calendar, read live from the Hub (nothing from it is copied here). */
export type Layers = { tasks: boolean; bills: boolean; trips: boolean; chores: boolean; hub: boolean };

export type Family = {
  members: Member[];
  sections: Partial<Record<FamilySection, boolean>>;
  /** The order the toggleable sections show in the menu, left to right / top to bottom. See cleanSectionOrder. */
  sectionOrder: FamilySection[];
  layers: Layers;
  chorePointsCount: boolean;
  chores: Chore[];
  choreDone: ChoreDone[];
  behavior: BehaviorEntry[];
  rewards: Reward[];
  redemptions: Redemption[];
  calendars: FamilyCalendar[];
  events: FamilyEvent[];
  trips: Trip[];
  polls: Poll[];
  bills: Bill[];
  budget: BudgetCategory[];
  expenses: Expense[];
  income: number;
  notes: Note[];
  health: Health;
  cycleLogs: CycleLog[];
  pills: Pill[];
  pillDoses: PillDose[];
  moods: MoodEntry[];
  goals: Goal[];
  news: NewsPrefs;
  /** Which phone notifications to send, when, and how many (see shared/todoNotify.ts). */
  notify: NotifyPrefs;
  journal: JournalEntry[];
  countdowns: Countdown[];
  groceries: GroceryItem[];
  savedVerses: SavedVerse[];
  meditations: MeditationLog[];
  /** Ids of quotes saved from the daily quote (see shared/lifePlugins.ts). */
  savedQuotes: string[];
  widgets: Widgets;
  /** The widgets on Home's Widgets board (see shared/widgets.ts). */
  widgetBoard?: WidgetItem[];
  /** How the family arranged the hub in Customize (see shared/lifeLayout.ts). Not set: the usual layout. */
  layout?: LifeLayout;
  stickies: Sticky[];
  randomLists: RandomList[];
  savedWords: SavedWord[];
  linkPage: LinkPage;
  habits: Habit[];
  gratitude: GratitudeDay[];
  focusLog: FocusLog[];
  recipes: Recipe[];
  meals: PlannedMeal[];
  care: CareItem[];
  birthdays: Birthday[];
  contacts: Contact[];
  subscriptions: Subscription[];
  jars: SavingsJar[];
  collections: CollectionItem[];
  weather: WeatherPrefs;
  sleep: SleepEntry[];
  workouts: Workout[];
  routines: Routine[];
  milestones: Milestone[];
  ious: Iou[];
  allowance: AllowanceEntry[];
  giftCards: GiftCard[];
  warranties: Warranty[];
  mileage: MileageTrip[];
  /** Dollars per mile for the Mileage log. */
  mileageRate: number;
  /** Time zones for the World clock (IANA names, like America/New_York). */
  clocks: string[];
  medical: MedicalCard[];
  /** Records for the Plugin Kit's LifeHub plugins (see shared/pluginKit.ts). */
  kit: KitRecord[];
  /** Kit plugins added from WorkHub's shelf (App Store). LifeHub's own kit plugins are menu
   *  sections instead; these are the crossed-over ones, opened like the Notes/Sheets apps. */
  kitInstalled?: string[];
  /** Notes-app plugins (see shared/notesApp.ts) added from the App Store that aren't built into
   *  LifeHub, by their plugin id ("life-work-notes" for Work Notes). Each keeps its own notes in
   *  notesApps, separate from LifeHub's own built-in Notes (above) and from each other. */
  notesInstalled: string[];
  notesApps: Record<string, Note[]>;
  /** The Sheets app (App Store add-on, shared/sheetsApp.ts), bolted on the same loose way as a
   *  Notes-app install: not a typed field most of this file knows about, just a plugin id in
   *  notesInstalled-style and its data read/saved through sheetsApp.ts's own helpers. */
  sheetsInstalled: string[];
  sheets: Record<string, Spreadsheet[]>;
  /** The Drive app (App Store add-on, shared/driveApp.ts): camera-roll photos uploaded to cloud
   *  storage. Metadata only lives here; the image bytes live in object storage (see server/routes.ts). */
  driveInstalled: boolean;
  drive: DriveFile[];
  /** The Drop app (App Store add-on, shared/dropApp.ts): an AirDrop-style file hand-off. Just an
   *  install flag — a drop itself isn't family state (see shared/dropApp.ts for why), so nothing
   *  else about it lives here. */
  dropInstalled: boolean;
  /** The Daily Brief is OFF only when this is true: it ships on, so replacing its old header button
   *  with an App Store app took it away from nobody. */
  briefOff?: boolean;
};

export const MEMBER_COLORS = ["#7566e8", "#f59e72", "#36b6a5", "#619ee6", "#db77ac", "#e5b04f", "#5fb35b", "#e0645a"];
export const NOTE_COLORS = ["#fff7d6", "#e9f7ef", "#e8f1fd", "#fde8ef", "#f1ecff", "#ffffff"];

export const DEFAULT_CALENDARS: FamilyCalendar[] = [
  { id: "family", name: "Family", color: "#7566e8", show: true },
  { id: "school", name: "School", color: "#619ee6", show: true },
  { id: "activities", name: "Sports & activities", color: "#36b6a5", show: true },
  { id: "appointments", name: "Appointments", color: "#f59e72", show: true },
];
export const DEFAULT_REWARDS: Reward[] = [
  { id: "r-screen", title: "30 min extra screen time", cost: 10 },
  { id: "r-dessert", title: "Pick dessert", cost: 15 },
  { id: "r-movie", title: "Choose family movie", cost: 20 },
  { id: "r-outing", title: "Special outing", cost: 50 },
];
export const DEFAULT_BUDGET: BudgetCategory[] = [
  { id: "b-groceries", name: "Groceries", limit: 0 },
  { id: "b-dining", name: "Eating out", limit: 0 },
  { id: "b-kids", name: "Kids & school", limit: 0 },
  { id: "b-fun", name: "Fun & activities", limit: 0 },
  { id: "b-gas", name: "Gas & transport", limit: 0 },
];

export const emptyFamily = (): Family => ({
  members: [], sections: {}, sectionOrder: [...TOGGLEABLE], layers: { tasks: true, bills: true, trips: true, chores: false, hub: false }, chorePointsCount: true,
  chores: [], choreDone: [], behavior: [], rewards: DEFAULT_REWARDS.map((r) => ({ ...r })), redemptions: [],
  calendars: DEFAULT_CALENDARS.map((c) => ({ ...c })), events: [], trips: [], polls: [],
  bills: [], budget: DEFAULT_BUDGET.map((b) => ({ ...b })), expenses: [], income: 0, notes: [], health: emptyHealth(), cycleLogs: [], pills: [], pillDoses: [], moods: [], goals: [], news: { topics: ["top", "local", "NATION"], place: "" },
  notify: defaultNotify(),
  journal: [], countdowns: [], groceries: [], savedVerses: [], meditations: [], savedQuotes: [],
  widgets: { stickies: false }, stickies: [], randomLists: [], savedWords: [], linkPage: { title: "", bio: "", links: [] },
  habits: [], gratitude: [], focusLog: [], recipes: [], meals: [], care: [], birthdays: [], contacts: [], subscriptions: [], jars: [], collections: [], weather: { place: "", unit: "F" },
  sleep: [], workouts: [], routines: [], milestones: [], ious: [], allowance: [], giftCards: [], warranties: [], mileage: [], mileageRate: 0.7, clocks: [], medical: [], kit: [], kitInstalled: [],
  notesInstalled: [], notesApps: {},
  sheetsInstalled: [], sheets: {}, driveInstalled: false, drive: [], dropInstalled: false, briefOff: false,
});

/* ---------------- sanitizing ---------------- */
const obj = (v: unknown): Record<string, any> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : null);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, min: number, max: number, fallback = 0) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : fallback;
};
const int = (v: unknown, min: number, max: number, fallback = 0) => Math.round(num(v, min, max, fallback));
const bool = (v: unknown, fallback = false) => (typeof v === "boolean" ? v : fallback);
export const isDay = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const day = (v: unknown) => (isDay(v) ? v : "");
const clock = (v: unknown) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "");
const color = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const id = (v: unknown) => str(v, 100);
/** Keeps up to `max` rows that clean up with an id, without repeating an id: the first ones,
 *  or for logs (`newest`) the most recent ones, since logs grow at the end. */
function rows<T extends { id: string }>(v: unknown, max: number, clean: (row: Record<string, any>) => T | null, newest = false): T[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const raw of newest ? v.slice(-max * 2) : v) {
    if (!newest && out.length >= max) break;
    const r = obj(raw);
    const row = r && clean(r);
    if (!row || !row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return newest ? out.slice(-max) : out;
}

export const LIMITS = { members: 20, chores: 300, choreDone: 8000, behavior: 8000, rewards: 60, redemptions: 3000, calendars: 30, events: 3000, trips: 100, polls: 300, bills: 200, budget: 60, expenses: 8000, notes: 1000, food: 12000, exercise: 6000, days: 8000, weights: 3000, foods: 500, cycleLogs: 6000, moods: 6000, goals: 300, pills: 60, pillDoses: 12000, journal: 3000, countdowns: 100, groceries: 300, savedVerses: 300, meditations: 6000, savedQuotes: 300, stickies: 60, randomLists: 50, savedWords: 1000, links: 60, habits: 40, gratitude: 3000, focusLog: 6000, recipes: 500, meals: 2000, care: 300, birthdays: 300, contacts: 200, subscriptions: 100, jars: 40, collections: 3000, sleep: 3000, workouts: 8000, routines: 20, milestones: 1000, ious: 1000, allowance: 5000, giftCards: 200, warranties: 500, mileage: 5000, clocks: 12, medical: 20 };

export function cleanFamily(input: unknown): Family {
  const raw = obj(input);
  if (!raw) return emptyFamily();
  const base = emptyFamily();
  const members = rows(raw.members, LIMITS.members, (r) => {
    const name = str(r.name, 40).trim();
    return name ? { id: id(r.id), name, emoji: str(r.emoji, 8), color: color(r.color, MEMBER_COLORS[0]), kind: oneOf(r.kind, ["adult", "kid"] as const, "kid") } : null;
  });
  const sections: Partial<Record<FamilySection, boolean>> = {};
  const rawSections = obj(raw.sections) || {};
  for (const key of TOGGLEABLE) if (typeof rawSections[key] === "boolean") sections[key] = rawSections[key];
  const rawLayers = obj(raw.layers) || {};
  const layers: Layers = {
    tasks: bool(rawLayers.tasks, true), bills: bool(rawLayers.bills, true), trips: bool(rawLayers.trips, true), chores: bool(rawLayers.chores, false), hub: bool(rawLayers.hub, false),
  };
  const ids = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && x && x.length <= 100))].slice(0, max) as string[] : []);
  const calendars = Array.isArray(raw.calendars)
    ? rows(raw.calendars, LIMITS.calendars, (r) => {
      const name = str(r.name, 40).trim();
      return name ? { id: id(r.id), name, color: color(r.color, "#7566e8"), show: bool(r.show, true) } : null;
    })
    : base.calendars;
  const budget = Array.isArray(raw.budget)
    ? rows(raw.budget, LIMITS.budget, (r) => {
      const name = str(r.name, 40).trim();
      return name ? { id: id(r.id), name, limit: num(r.limit, 0, 10_000_000) } : null;
    })
    : base.budget;
  return {
    members,
    sections,
    sectionOrder: cleanSectionOrder(raw.sectionOrder),
    layers,
    chorePointsCount: bool(raw.chorePointsCount, true),
    chores: rows(raw.chores, LIMITS.chores, (r) => {
      const title = str(r.title, 120).trim();
      const days = Array.isArray(r.days) ? [...new Set(r.days.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort() as number[] : [];
      return title ? { id: id(r.id), title, memberId: id(r.memberId), rotation: ids(r.rotation, LIMITS.members), days, points: int(r.points, 0, 100, 1) } : null;
    }),
    choreDone: rows(raw.choreDone, LIMITS.choreDone, (r) => {
      const date = day(r.date);
      return date && r.choreId ? { id: id(r.id), choreId: id(r.choreId), date, memberId: id(r.memberId), points: int(r.points, 0, 100) } : null;
    }, true),
    behavior: rows(raw.behavior, LIMITS.behavior, (r) => {
      const date = day(r.date);
      return date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), date, points: int(r.points, -100, 100), note: str(r.note, 200) } : null;
    }, true),
    rewards: Array.isArray(raw.rewards)
      ? rows(raw.rewards, LIMITS.rewards, (r) => {
        const title = str(r.title, 80).trim();
        return title ? { id: id(r.id), title, cost: int(r.cost, 1, 10_000, 10) } : null;
      })
      : base.rewards,
    redemptions: rows(raw.redemptions, LIMITS.redemptions, (r) => {
      const date = day(r.date);
      return date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), title: str(r.title, 80), cost: int(r.cost, 0, 10_000), date } : null;
    }, true),
    calendars,
    events: rows(raw.events, LIMITS.events, (r) => {
      const title = str(r.title, 120).trim();
      const date = day(r.date);
      return title && date ? {
        id: id(r.id), title, date, time: clock(r.time), endTime: clock(r.endTime), calendarId: id(r.calendarId),
        memberIds: ids(r.memberIds, LIMITS.members), location: str(r.location, 160), notes: str(r.notes, 1000),
        repeat: oneOf(r.repeat, ["none", "weekly", "monthly", "yearly"] as const, "none"),
      } : null;
    }),
    trips: rows(raw.trips, LIMITS.trips, (r) => {
      const name = str(r.name, 100).trim();
      return name ? {
        id: id(r.id), name, destination: str(r.destination, 120), start: day(r.start), end: day(r.end),
        budget: num(r.budget, 0, 10_000_000), notes: str(r.notes, 3000),
        stops: rows(r.stops, 300, (s) => {
          const title = str(s.title, 160).trim();
          return title ? { id: id(s.id), date: day(s.date), time: clock(s.time), title, cost: num(s.cost, 0, 10_000_000) } : null;
        }),
        packing: rows(r.packing, 400, (p) => {
          const item = str(p.item, 100).trim();
          return item ? { id: id(p.id), item, memberId: id(p.memberId), packed: bool(p.packed) } : null;
        }),
      } : null;
    }),
    polls: rows(raw.polls, LIMITS.polls, (r) => {
      const question = str(r.question, 160).trim();
      const options = rows(r.options, 20, (o) => {
        const label = str(o.label, 100).trim();
        return label ? { id: id(o.id), label } : null;
      });
      const optionIds = new Set(options.map((o) => o.id));
      const votes: Record<string, string> = {};
      const rawVotes = obj(r.votes) || {};
      for (const [voter, choice] of Object.entries(rawVotes).slice(0, LIMITS.members)) {
        if (voter.length <= 100 && typeof choice === "string" && optionIds.has(choice)) votes[voter] = choice;
      }
      return question && options.length ? {
        id: id(r.id), question, kind: oneOf(r.kind, ["dinner", "weekend", "other"] as const, "other"), options, votes,
        closed: bool(r.closed), createdAt: str(r.createdAt, 40), closesOn: day(r.closesOn),
      } : null;
    }),
    bills: rows(raw.bills, LIMITS.bills, (r) => {
      const name = str(r.name, 80).trim();
      const paid = Array.isArray(r.paid) ? [...new Set(r.paid.filter((m: unknown) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)))].slice(-120) as string[] : [];
      return name ? { id: id(r.id), name, amount: num(r.amount, 0, 10_000_000), dueDay: int(r.dueDay, 1, 31, 1), category: str(r.category, 40), autopay: bool(r.autopay), paid } : null;
    }),
    budget,
    expenses: rows(raw.expenses, LIMITS.expenses, (r) => {
      const date = day(r.date);
      return date ? { id: id(r.id), categoryId: id(r.categoryId), amount: num(r.amount, 0, 10_000_000), date, note: str(r.note, 120) } : null;
    }, true),
    income: num(raw.income, 0, 100_000_000),
    notes: rows(raw.notes, LIMITS.notes, (r) => {
      const title = str(r.title, 120);
      const body = str(r.body, 5000);
      return title.trim() || body.trim() ? { id: id(r.id), title, body, color: color(r.color, NOTE_COLORS[0]), pinned: bool(r.pinned), updatedAt: str(r.updatedAt, 40) } : null;
    }),
    health: cleanHealth(raw.health),
    cycleLogs: rows(raw.cycleLogs, LIMITS.cycleLogs, (r) => {
      const date = day(r.date);
      const symptoms = Array.isArray(r.symptoms) ? [...new Set(r.symptoms.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim().slice(0, 30)))].slice(0, 20) as string[] : [];
      const flow = oneOf(r.flow, ["none", "spotting", "light", "medium", "heavy"] as const, "none");
      const log: CycleLog = { id: id(r.id), memberId: id(r.memberId), date, flow, symptoms, note: str(r.note, 300) };
      const discharge = oneOf(r.discharge, ["", ...DISCHARGES] as const, "");
      if (discharge) log.discharge = discharge;
      const pain = int(r.pain, 0, 3, 0); if (pain) log.pain = pain;
      const energy = oneOf(r.energy, ["", "low", "ok", "high"] as const, ""); if (energy) log.energy = energy;
      const temp = num(r.temp, 0, 110, 0); if (temp >= 90) log.temp = temp;
      const ovTest = oneOf(r.ovTest, ["", "negative", "positive"] as const, ""); if (ovTest) log.ovTest = ovTest;
      return date && r.memberId && cycleLogUsed(log) ? log : null;
    }, true),
    pills: rows(raw.pills, LIMITS.pills, (r) => {
      const name = str(r.name, 60).trim();
      const times = Array.isArray(r.times) ? [...new Set(r.times.map(clock).filter(Boolean))].sort().slice(0, 8) as string[] : [];
      const days = Array.isArray(r.days) ? [...new Set(r.days.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort() as number[] : [0, 1, 2, 3, 4, 5, 6];
      const supply = r.supply === null || r.supply === undefined || r.supply === "" ? null : int(r.supply, 0, 10000, 0);
      return name && r.memberId ? {
        id: id(r.id), memberId: id(r.memberId), name, dose: str(r.dose, 60), times: times.length ? times : ["08:00"], days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
        start: day(r.start), end: day(r.end), supply, perDose: int(r.perDose, 1, 20, 1), refillAt: int(r.refillAt, 0, 1000, 7), notes: str(r.notes, 300), color: color(r.color, PILL_COLORS[0]), active: bool(r.active, true),
      } : null;
    }),
    pillDoses: rows(raw.pillDoses, LIMITS.pillDoses, (r) => {
      const date = day(r.date), time = clock(r.time);
      return date && time && r.pillId ? { id: id(r.id), pillId: id(r.pillId), date, time, status: oneOf(r.status, ["taken", "skipped"] as const, "taken"), at: str(r.at, 40) } : null;
    }, true),
    moods: rows(raw.moods, LIMITS.moods, (r) => {
      const date = day(r.date);
      const tags = Array.isArray(r.tags) ? [...new Set(r.tags.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim().slice(0, 30)))].slice(0, 15) as string[] : [];
      return date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), date, mood: int(r.mood, 1, 5, 3), tags, note: str(r.note, 500) } : null;
    }, true),
    goals: rows(raw.goals, LIMITS.goals, (r) => {
      const title = str(r.title, 120).trim();
      return title ? {
        id: id(r.id), title, why: str(r.why, 500), category: oneOf(r.category, ["personal", "health", "money", "family", "career", "learning", "home"] as const, "personal"),
        memberId: id(r.memberId), due: day(r.due), kind: oneOf(r.kind, ["steps", "number"] as const, "steps"),
        target: num(r.target, 0, 1e9), current: num(r.current, -1e9, 1e9), unit: str(r.unit, 20),
        milestones: rows(r.milestones, 50, (m) => { const t = str(m.title, 120).trim(); return t ? { id: id(m.id), title: t, done: bool(m.done) } : null; }),
        done: bool(r.done), createdAt: str(r.createdAt, 40), doneAt: str(r.doneAt, 40),
      } : null;
    }),
    news: (() => {
      const n = obj(raw.news);
      const topics = n && Array.isArray(n.topics) ? [...new Set(n.topics.filter((t: unknown) => typeof t === "string" && /^[A-Za-z]{2,20}$/.test(t as string)))].slice(0, 12) as string[] : ["top", "local", "NATION"];
      return { topics: topics.length ? topics : ["top"], place: n ? str(n.place, 60) : "" };
    })(),
    notify: cleanNotify(raw.notify),
    journal: rows(raw.journal, LIMITS.journal, (r) => {
      const date = day(r.date), body = str(r.body, 20_000);
      return date && (body.trim() || str(r.title, 120).trim()) ? { id: id(r.id), date, title: str(r.title, 120), body, mood: str(r.mood, 8), createdAt: str(r.createdAt, 40) } : null;
    }, true),
    countdowns: rows(raw.countdowns, LIMITS.countdowns, (r) => {
      const title = str(r.title, 80).trim(), date = day(r.date);
      return title && date ? { id: id(r.id), title, date, emoji: str(r.emoji, 8), color: color(r.color, "#7566e8") } : null;
    }),
    groceries: rows(raw.groceries, LIMITS.groceries, (r) => {
      const name = str(r.name, 80).trim();
      return name ? { id: id(r.id), name, qty: str(r.qty, 20), aisle: str(r.aisle, 30), checked: bool(r.checked), price: Math.round(num(r.price, 0, 10000) * 100) / 100 } : null;
    }),
    savedVerses: rows(raw.savedVerses, LIMITS.savedVerses, (r) => {
      const reference = str(r.reference, 60).trim(), text = str(r.text, 4000).trim();
      return reference && text ? { id: id(r.id), reference, text } : null;
    }),
    meditations: rows(raw.meditations, LIMITS.meditations, (r) => {
      const date = day(r.date);
      return date ? { id: id(r.id), date, minutes: num(r.minutes, 0, 600), kind: str(r.kind, 30) } : null;
    }, true),
    widgets: { stickies: bool(obj(raw.widgets)?.stickies, false), ...(bool(obj(raw.widgets)?.chat, false) ? { chat: true } : {}), ...(bool(obj(raw.widgets)?.board, false) ? { board: true } : {}) },
    ...(Array.isArray(raw.widgetBoard) ? { widgetBoard: cleanWidgets(raw.widgetBoard) } : {}),
    ...(obj(raw.layout) ? { layout: cleanLifeLayout(raw.layout) } : {}),
    stickies: rows(raw.stickies, LIMITS.stickies, (r) => ({ id: id(r.id), text: str(r.text, 1000), color: color(r.color, NOTE_COLORS[0]), x: num(r.x, 0, 1, 0.5), y: int(r.y, 0, 6000, 40) })),
    randomLists: rows(raw.randomLists, LIMITS.randomLists, (r) => {
      const name = str(r.name, 60).trim();
      const items = Array.isArray(r.items) ? r.items.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim().slice(0, 100)).slice(0, 200) : [];
      return name && items.length ? { id: id(r.id), name, items } : null;
    }),
    savedWords: rows(raw.savedWords, LIMITS.savedWords, (r) => {
      const word = str(r.word, 60).trim();
      return word ? { id: id(r.id), word, definition: str(r.definition, 500) } : null;
    }),
    linkPage: (() => {
      const lp = obj(raw.linkPage) || {};
      return {
        title: str(lp.title, 80), bio: str(lp.bio, 300),
        links: rows(lp.links, LIMITS.links, (r) => {
          const title = str(r.title, 80).trim(), url = str(r.url, 1000).trim();
          return title && /^(https?:\/\/|mailto:|tel:)/i.test(url) ? { id: id(r.id), title, url, emoji: str(r.emoji, 8) } : null;
        }),
      };
    })(),
    habits: rows(raw.habits, LIMITS.habits, (r) => {
      const name = str(r.name, 60).trim();
      const days = Array.isArray(r.days) ? [...new Set(r.days.filter(isDay))].sort().slice(-500) as string[] : [];
      return name ? { id: id(r.id), name, emoji: str(r.emoji, 8), color: color(r.color, "#7566e8"), days } : null;
    }),
    gratitude: rows(raw.gratitude, LIMITS.gratitude, (r) => {
      const date = day(r.date);
      const items = Array.isArray(r.items) ? r.items.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim().slice(0, 300)).slice(0, 5) : [];
      return date && items.length ? { id: id(r.id), date, items } : null;
    }, true),
    focusLog: rows(raw.focusLog, LIMITS.focusLog, (r) => { const date = day(r.date); return date ? { id: id(r.id), date, minutes: int(r.minutes, 0, 600) } : null; }, true),
    recipes: rows(raw.recipes, LIMITS.recipes, (r) => {
      const title = str(r.title, 120).trim();
      const ingredients = Array.isArray(r.ingredients) ? r.ingredients.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim().slice(0, 120)).slice(0, 80) : [];
      return title ? { id: id(r.id), title, ingredients, steps: str(r.steps, 8000), tags: str(r.tags, 120), servings: int(r.servings, 0, 100), minutes: int(r.minutes, 0, 2000) } : null;
    }),
    meals: rows(raw.meals, LIMITS.meals, (r) => {
      const date = day(r.date), text = str(r.text, 120).trim();
      return date && (text || r.recipeId) ? { id: id(r.id), date, slot: oneOf(r.slot, ["breakfast", "lunch", "dinner"] as const, "dinner"), text, recipeId: id(r.recipeId), cost: Math.round(num(r.cost, 0, 10000) * 100) / 100, serves: num(r.serves, 0, 100) } : null;
    }, true),
    care: rows(raw.care, LIMITS.care, (r) => {
      const name = str(r.name, 80).trim();
      return name ? { id: id(r.id), kind: oneOf(r.kind, ["upkeep", "plants", "car", "pets", "cleaning", "checkups"] as const, "upkeep"), group: str(r.group, 60), name, everyDays: int(r.everyDays, 1, 3650, 30), lastDone: day(r.lastDone), notes: str(r.notes, 500) } : null;
    }),
    birthdays: rows(raw.birthdays, LIMITS.birthdays, (r) => {
      const name = str(r.name, 80).trim();
      const month = Number.isInteger(r.month) && r.month >= 1 && r.month <= 12 ? r.month as number : 0, dd = Number.isInteger(r.day) && r.day >= 1 && r.day <= 31 ? r.day as number : 0;
      return name && month && dd ? { id: id(r.id), name, month, day: dd, year: int(r.year, 0, 2200), kind: oneOf(r.kind, ["birthday", "anniversary", "other"] as const, "birthday") } : null;
    }),
    contacts: rows(raw.contacts, LIMITS.contacts, (r) => {
      const name = str(r.name, 80).trim();
      return name ? { id: id(r.id), name, role: str(r.role, 60), phone: str(r.phone, 40), email: str(r.email, 120), note: str(r.note, 500), emergency: bool(r.emergency) } : null;
    }),
    subscriptions: rows(raw.subscriptions, LIMITS.subscriptions, (r) => {
      const name = str(r.name, 80).trim();
      return name ? { id: id(r.id), name, amount: num(r.amount, 0, 100_000), cycle: oneOf(r.cycle, ["weekly", "monthly", "yearly"] as const, "monthly"), nextDate: day(r.nextDate), category: str(r.category, 40) } : null;
    }),
    jars: rows(raw.jars, LIMITS.jars, (r) => {
      const name = str(r.name, 60).trim();
      return name ? { id: id(r.id), name, emoji: str(r.emoji, 8), color: color(r.color, "#16a34a"), target: num(r.target, 0, 100_000_000), saved: num(r.saved, -100_000_000, 100_000_000) } : null;
    }),
    collections: rows(raw.collections, LIMITS.collections, (r) => {
      const title = str(r.title, 160).trim();
      return title ? { id: id(r.id), kind: oneOf(r.kind, ["reading", "watchlist", "bucket", "gifts", "wishlist", "restaurants", "learning", "projects", "loans"] as const, "bucket"), title, sub: str(r.sub, 120), status: str(r.status, 20), rating: int(r.rating, 0, 5), note: str(r.note, 1000), url: /^https?:\/\//i.test(str(r.url, 1000)) ? str(r.url, 1000) : "", price: num(r.price, 0, 1_000_000), doneOn: day(r.doneOn) } : null;
    }),
    weather: (() => { const w = obj(raw.weather) || {}; return { place: str(w.place, 80), unit: oneOf(w.unit, ["F", "C"] as const, "F") }; })(),
    sleep: rows(raw.sleep, LIMITS.sleep, (r) => { const date = day(r.date), bed = clock(r.bed), wake = clock(r.wake); return date && bed && wake ? { id: id(r.id), date, bed, wake, quality: int(r.quality, 0, 5) } : null; }, true),
    workouts: rows(raw.workouts, LIMITS.workouts, (r) => {
      const date = day(r.date), exercise = str(r.exercise, 60).trim();
      return date && exercise ? { id: id(r.id), date, exercise, sets: int(r.sets, 0, 100), reps: int(r.reps, 0, 1000), weight: num(r.weight, 0, 5000), unit: oneOf(r.unit, ["lb", "kg"] as const, "lb") } : null;
    }, true),
    routines: rows(raw.routines, LIMITS.routines, (r) => {
      const name = str(r.name, 60).trim();
      const steps = rows(r.steps, 30, (s) => { const text = str(s.text, 100).trim(); return text ? { id: id(s.id), text } : null; });
      return name ? { id: id(r.id), name, emoji: str(r.emoji, 8), steps, doneDate: day(r.doneDate), doneSteps: ids(r.doneSteps, 30) } : null;
    }),
    milestones: rows(raw.milestones, LIMITS.milestones, (r) => { const title = str(r.title, 120).trim(), date = day(r.date); return title && date ? { id: id(r.id), who: str(r.who, 60), title, date, note: str(r.note, 1000) } : null; }),
    ious: rows(raw.ious, LIMITS.ious, (r) => { const person = str(r.person, 60).trim(); return person ? { id: id(r.id), person, amount: num(r.amount, -1_000_000, 1_000_000), note: str(r.note, 200), date: day(r.date), settled: bool(r.settled) } : null; }),
    allowance: rows(raw.allowance, LIMITS.allowance, (r) => { const who = str(r.who, 60).trim(); return who ? { id: id(r.id), who, amount: num(r.amount, -100_000, 100_000), note: str(r.note, 120), date: day(r.date) } : null; }, true),
    giftCards: rows(raw.giftCards, LIMITS.giftCards, (r) => { const store = str(r.store, 60).trim(); return store ? { id: id(r.id), store, balance: num(r.balance, 0, 100_000), expires: day(r.expires), note: str(r.note, 200) } : null; }),
    warranties: rows(raw.warranties, LIMITS.warranties, (r) => { const item = str(r.item, 100).trim(); return item ? { id: id(r.id), item, store: str(r.store, 60), bought: day(r.bought), until: day(r.until), note: str(r.note, 300) } : null; }),
    mileage: rows(raw.mileage, LIMITS.mileage, (r) => { const date = day(r.date); return date ? { id: id(r.id), date, miles: num(r.miles, 0, 10_000), purpose: str(r.purpose, 120), route: str(r.route, 120) } : null; }, true),
    mileageRate: num(raw.mileageRate, 0, 10, 0.7),
    clocks: Array.isArray(raw.clocks) ? [...new Set(raw.clocks.filter((z: unknown) => typeof z === "string" && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(z as string) && (z as string).length <= 60))].slice(0, LIMITS.clocks) as string[] : [],
    medical: rows(raw.medical, LIMITS.medical, (r) => {
      const person = str(r.person, 60).trim();
      return person ? { id: id(r.id), person, bloodType: str(r.bloodType, 10), allergies: str(r.allergies, 500), conditions: str(r.conditions, 500), medications: str(r.medications, 500), doctor: str(r.doctor, 200), insurance: str(r.insurance, 200), notes: str(r.notes, 1000) } : null;
    }),
    kit: cleanKit(raw.kit),
    kitInstalled: Array.isArray(raw.kitInstalled) ? raw.kitInstalled.filter((x: unknown): x is string => typeof x === "string").slice(0, 400) : [],
    savedQuotes: Array.isArray(raw.savedQuotes) ? [...new Set(raw.savedQuotes.filter((x: unknown) => typeof x === "string" && x && (x as string).length <= 40))].slice(0, LIMITS.savedQuotes) as string[] : [],
    notesInstalled: Array.isArray(raw.notesInstalled) ? [...new Set(raw.notesInstalled.filter((x: unknown): x is string => typeof x === "string" && !!x && x.length <= 60))].slice(0, 20) : [],
    // Notes-app installs (shared/notesApp.ts): same shape as the built-in Notes above, one list per
    // installed app so each keeps its own separate notes.
    notesApps: (() => {
      const out: Record<string, Note[]> = {};
      for (const [pid, list] of Object.entries(obj(raw.notesApps) || {}).slice(0, 20)) {
        if (pid.length > 60 || !Array.isArray(list)) continue;
        out[pid] = rows(list, LIMITS.notes, (r) => {
          const title = str(r.title, 120);
          const body = str(r.body, 5000);
          return title.trim() || body.trim() ? { id: id(r.id), title, body, color: color(r.color, NOTE_COLORS[0]), pinned: bool(r.pinned), updatedAt: str(r.updatedAt, 40) } : null;
        });
      }
      return out;
    })(),
    sheetsInstalled: Array.isArray(raw.sheetsInstalled) ? [...new Set(raw.sheetsInstalled.filter((x: unknown): x is string => typeof x === "string" && !!x && x.length <= 60))].slice(0, 20) : [],
    sheets: (() => {
      const out: Record<string, Spreadsheet[]> = {};
      for (const [pid, list] of Object.entries(obj(raw.sheets) || {}).slice(0, 20)) {
        if (pid.length > 60) continue;
        out[pid] = cleanSpreadsheets(list);
      }
      return out;
    })(),
    driveInstalled: bool(raw.driveInstalled, false),
    dropInstalled: bool(raw.dropInstalled, false),
    briefOff: bool(raw.briefOff, false),
    drive: cleanDriveFiles(raw.drive),
  };
}

export function cleanHealth(input: unknown): Health {
  const raw = obj(input);
  if (!raw) return emptyHealth();
  const goals: Record<string, HealthGoals> = {};
  for (const [memberId, g] of Object.entries(obj(raw.goals) || {}).slice(0, LIMITS.members)) {
    const r = obj(g);
    if (!r || !memberId || memberId.length > 100) continue;
    goals[memberId] = {
      calories: int(r.calories, 0, 10000, 2000), proteinPct: int(r.proteinPct, 0, 100, 20), carbsPct: int(r.carbsPct, 0, 100, 50), fatPct: int(r.fatPct, 0, 100, 30),
      water: int(r.water, 0, 40, 8), steps: int(r.steps, 0, 100000, 8000), goalWeight: num(r.goalWeight, 0, 1500), activeMinutes: int(r.activeMinutes, 0, 600, 60), fruitVeg: int(r.fruitVeg, 0, 20, 5),
    };
  }
  const nutrition = (r: Record<string, any>) => ({ calories: num(r.calories, 0, 20000), protein: num(r.protein, 0, 2000), carbs: num(r.carbs, 0, 2000), fat: num(r.fat, 0, 2000) });
  const profiles: Record<string, HealthProfile> = {};
  for (const [memberId, v] of Object.entries(obj(raw.profiles) || {}).slice(0, LIMITS.members + 1)) {
    const r = obj(v);
    if (!r || !memberId || memberId.length > 100) continue;
    const weight = num(r.weight, 50, 1000);
    const heightIn = num(r.heightIn, 36, 96);
    const birthYear = int(r.birthYear, 1900, 2100);
    if (!weight || !heightIn || !birthYear) continue;
    profiles[memberId] = {
      sex: oneOf(r.sex, ["female", "male"] as const, "female"), birthYear, heightIn, weight,
      goal: oneOf(r.goal, ["lose", "maintain", "gain"] as const, "maintain"), goalWeight: num(r.goalWeight, 0, 1000),
      rate: num(r.rate, 0, 2), activity: oneOf(r.activity, ["sedentary", "light", "moderate", "active", "very"] as const, "light"),
      diet: oneOf(r.diet, ["balanced", "highProtein", "lowerCarb", "lowerFat"] as const, "balanced"), createdAt: str(r.createdAt, 40),
    };
  }
  return {
    profiles,
    goals,
    food: rows(raw.food, LIMITS.food, (r) => {
      const name = str(r.name, 100).trim();
      const date = day(r.date);
      return name && date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), date, meal: oneOf(r.meal, MEALS, "snacks"), name, servings: num(r.servings, 0.01, 100, 1), ...nutrition(r) } : null;
    }, true),
    exercise: rows(raw.exercise, LIMITS.exercise, (r) => {
      const name = str(r.name, 80).trim();
      const date = day(r.date);
      return name && date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), date, name, minutes: int(r.minutes, 0, 1440), calories: int(r.calories, 0, 10000) } : null;
    }, true),
    days: rows(raw.days, LIMITS.days, (r) => {
      const date = day(r.date);
      return date && r.memberId ? { id: id(r.id), memberId: id(r.memberId), date, water: int(r.water, 0, 40), steps: int(r.steps, 0, 200000), fruitVeg: int(r.fruitVeg, 0, 30) } : null;
    }, true),
    weights: rows(raw.weights, LIMITS.weights, (r) => {
      const date = day(r.date);
      const weight = num(r.weight, 0, 1500);
      return date && r.memberId && weight > 0 ? { id: id(r.id), memberId: id(r.memberId), date, weight } : null;
    }, true),
    foods: rows(raw.foods, LIMITS.foods, (r) => {
      const name = str(r.name, 100).trim();
      return name ? { id: id(r.id), name, serving: str(r.serving, 60), ...nutrition(r) } : null;
    }),
  };
}

/* ---------------- dates ---------------- */
export const toDay = (d: Date) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
export const fromDay = (s: string) => new Date(`${s}T12:00:00`);
export const addDays = (s: string, n: number) => { const d = fromDay(s); d.setDate(d.getDate() + n); return toDay(d); };
export const weekStart = (s: string) => addDays(s, -fromDay(s).getDay());
export const monthKey = (s: string) => s.slice(0, 7);
export const daysBetween = (a: string, b: string) => Math.round((fromDay(b).getTime() - fromDay(a).getTime()) / 86_400_000);
/** Whether a section shows: the usual ones unless switched off, Plugin Store add-ons only once added. */
export const isOn = (section: FamilySection, f: Pick<Family, "sections">) =>
  !TOGGLEABLE.includes(section) || (ADD_ON_SECTIONS.includes(section) ? f.sections[section] === true : f.sections[section] !== false);

/** Whether an event (or one of its repeats) falls on a day. */
export function occursOn(e: FamilyEvent, date: string): boolean {
  if (!isDay(date) || date < e.date) return false;
  if (date === e.date) return true;
  const a = fromDay(e.date), b = fromDay(date);
  if (e.repeat === "weekly") return a.getDay() === b.getDay();
  if (e.repeat === "monthly") {
    const last = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
    return b.getDate() === Math.min(a.getDate(), last);
  }
  if (e.repeat === "yearly") return a.getMonth() === b.getMonth() && (a.getDate() === b.getDate() || (a.getMonth() === 1 && a.getDate() === 29 && b.getDate() === 28 && new Date(b.getFullYear(), 1, 29).getMonth() !== 1));
  return false;
}
export const eventsOn = (f: Family, date: string, all = false) => {
  const shown = new Set(f.calendars.filter((c) => c.show).map((c) => c.id));
  return f.events.filter((e) => (all || shown.has(e.calendarId) || !f.calendars.some((c) => c.id === e.calendarId)) && occursOn(e, date))
    .sort((x, y) => (x.time || "99").localeCompare(y.time || "99"));
};

/* ---------------- chores ---------------- */
/** Who does a chore on a given day: its rotation turns over each week (Sunday), otherwise its one owner. */
export function choreOwner(c: Chore, date: string): string {
  if (!c.rotation.length) return c.memberId;
  const weeks = Math.floor(daysBetween("2024-01-07", weekStart(date)) / 7);
  return c.rotation[((weeks % c.rotation.length) + c.rotation.length) % c.rotation.length];
}
export const choreDueOn = (c: Chore, date: string) => !c.days.length || c.days.includes(fromDay(date).getDay());
export const choreDoneOn = (f: Family, choreId: string, date: string) => f.choreDone.find((d) => d.choreId === choreId && d.date === date);
export function toggleChore(f: Family, c: Chore, date: string, makeId: () => string): Family {
  const done = choreDoneOn(f, c.id, date);
  if (done) return { ...f, choreDone: f.choreDone.filter((d) => d.id !== done.id) };
  const entry = { id: makeId(), choreId: c.id, date, memberId: choreOwner(c, date), points: c.points };
  return { ...f, choreDone: [...f.choreDone, entry].slice(-LIMITS.choreDone) };
}

/* ---------------- rewards ---------------- */
export function starBalance(f: Family, memberId: string) {
  const behavior = f.behavior.filter((b) => b.memberId === memberId).reduce((s, b) => s + b.points, 0);
  const chores = f.chorePointsCount ? f.choreDone.filter((d) => d.memberId === memberId).reduce((s, d) => s + d.points, 0) : 0;
  const spent = f.redemptions.filter((r) => r.memberId === memberId).reduce((s, r) => s + r.cost, 0);
  return { behavior, chores, spent, balance: behavior + chores - spent };
}

/* ---------------- polls ---------------- */
export function tally(p: Poll) {
  const counts = new Map(p.options.map((o) => [o.id, 0]));
  for (const choice of Object.values(p.votes)) counts.set(choice, (counts.get(choice) || 0) + 1);
  const ranked = p.options.map((o) => ({ ...o, votes: counts.get(o.id) || 0 })).sort((a, b) => b.votes - a.votes);
  const top = ranked[0]?.votes || 0;
  return { ranked, total: Object.keys(p.votes).length, leaders: top ? ranked.filter((o) => o.votes === top) : [] };
}
export const POLL_TEMPLATES: Record<PollKind, { question: string; options: string[] }> = {
  dinner: { question: "What's for dinner?", options: ["Tacos", "Pasta", "Pizza night", "Breakfast for dinner", "Stir-fry"] },
  weekend: { question: "What should we do this weekend?", options: ["Park or hike", "Movie night", "Board games", "Visit family", "Bike ride"] },
  other: { question: "", options: ["", ""] },
};

/* ---------------- money ---------------- */
/** A bill's due date in a month ("2026-02" + day 31 → 2026-02-28). */
export function billDue(b: Bill, month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(b.dueDay, last)).padStart(2, "0")}`;
}
export function billState(b: Bill, month: string, today: string): "paid" | "late" | "soon" | "later" {
  if (b.paid.includes(month)) return "paid";
  const due = billDue(b, month);
  if (due < today) return "late";
  return daysBetween(today, due) <= 7 ? "soon" : "later";
}
export function monthSummary(f: Family, month: string) {
  const billsTotal = f.bills.reduce((s, b) => s + b.amount, 0);
  const billsPaid = f.bills.filter((b) => b.paid.includes(month)).reduce((s, b) => s + b.amount, 0);
  const spent = f.expenses.filter((e) => monthKey(e.date) === month).reduce((s, e) => s + e.amount, 0);
  const budgeted = f.budget.reduce((s, c) => s + c.limit, 0);
  return { billsTotal, billsPaid, billsLeft: billsTotal - billsPaid, spent, budgeted, leftover: f.income - billsTotal - spent };
}
export const spentIn = (f: Family, categoryId: string, month: string) =>
  f.expenses.filter((e) => e.categoryId === categoryId && monthKey(e.date) === month).reduce((s, e) => s + e.amount, 0);
export const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });

/** Whether saved family data already has every part the current page expects. Data saved by an
 *  older version (for example before Food & fitness or calorie plans) is missing some parts and is
 *  run through cleanFamily first, which fills them in without changing anything already there. */
export function isCurrentFamily(f: unknown): f is Family {
  const r = obj(f);
  const h = r && obj(r.health);
  if (!r || !h) return false;
  const arrays = ["members", "sectionOrder", "chores", "choreDone", "behavior", "rewards", "redemptions", "calendars", "events", "trips", "polls", "bills", "budget", "expenses", "notes", "cycleLogs", "pills", "pillDoses", "moods", "goals", "journal", "countdowns", "groceries", "savedVerses", "meditations", "savedQuotes", "stickies", "randomLists", "savedWords", "habits", "gratitude", "focusLog", "recipes", "meals", "care", "birthdays", "contacts", "subscriptions", "jars", "collections", "sleep", "workouts", "routines", "milestones", "ious", "allowance", "giftCards", "warranties", "mileage", "clocks", "medical", "kit"];
  const healthArrays = ["food", "exercise", "days", "weights", "foods"];
  if (!arrays.every((k) => Array.isArray(r[k])) || !healthArrays.every((k) => Array.isArray(h[k]))) return false;
  // Every part a new family starts with must be there in the same shape. A family saved before a
  // part existed (like notesInstalled) goes through cleanFamily instead, so the page never reads
  // a missing list ("Cannot read properties of undefined").
  const fresh = emptyFamily() as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(fresh)) {
    const have = r[k];
    if (Array.isArray(v) ? !Array.isArray(have) : v !== null && typeof v === "object" ? !obj(have) : v !== null && typeof have !== typeof v) return false;
  }
  return !!obj(h.goals) && !!obj(h.profiles) && !!obj(r.news) && !!obj(r.notify) && !!obj(r.widgets) && !!obj(r.linkPage) && !!obj(r.weather) && !!obj(r.sections) && !!obj(r.layers) && typeof r.income === "number" && typeof r.chorePointsCount === "boolean";
}
