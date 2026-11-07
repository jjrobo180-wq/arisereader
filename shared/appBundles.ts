// One plugin for one job (November 2026): LifeHub's health, journal and kitchen tools used to be dozens of
// separate plugins in the gallery. Each is now ONE plugin with the old ones inside it as pages. The first
// time it opens, a "Pick your tools" box lets the person choose which pages they want (a woman might choose the
// period tracker). The old sections still exist underneath, so nothing anyone saved moves or is lost, and
// everyone who already added one of them keeps it, now inside the new plugin.
import type { FamilySection } from "./familyHub";

export type BundleId = "healthlite" | "inspire" | "kitchen";
export type BundleMember = { id: FamilySection; label?: string; detail?: string };
export type Bundle = {
  id: BundleId;
  /** The section the plugin opens as. */
  section: BundleId;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  icon: string;
  color: string;
  category: string;
  pickerTitle: string;
  pickerIntro: string;
  /** Pages that are always there (no choosing needed). */
  fixed: FamilySection[];
  /** The pages to pick from, in groups. */
  groups: { title: string; members: BundleMember[] }[];
  /** A small banner at the top. */
  promo?: { title: string; body: string; cta: string; href: string };
};

const FIT_LINK = "https://arisetodo.com/#/fit";

export const BUNDLES: Bundle[] = [
  {
    id: "healthlite", section: "healthlite", name: "Health Lite", category: "Health & wellness", icon: "HeartPulse", color: "#e0566b",
    tagline: "Everything for your health, in one place",
    description: "One simple home for your health. Pick the tools you want, like a period tracker, medicine reminders, a food diary, workouts, sleep, mood or water, and switch between them with one tap. Want more depth? Arise Fit has full programs, meal tracking and coaching.",
    features: ["Pick only the tools you need", "Period tracker, medicine, food, workouts, sleep, mood", "Daily trackers for water, steps, pain and more", "Your records stay private to you"],
    pickerTitle: "Pick your health tools", pickerIntro: "Choose what you want in Health Lite. You can change this any time with the settings button.",
    fixed: [],
    groups: [
      { title: "Body", members: [
        { id: "health", label: "Food & fitness", detail: "Calories, water, exercise and weight" },
        { id: "workouts", label: "Workouts", detail: "Sets, reps and personal bests" },
        { id: "cycle", label: "Period tracker", detail: "Cycle, symptoms and predictions" },
        { id: "pills", label: "Medicine", detail: "Pill and vitamin reminders and refills" },
        { id: "sleep", label: "Sleep", detail: "Sleep log, sounds and stories" },
        { id: "sleepfinder", label: "Sleep Finder", detail: "Find something to fall asleep to" },
      ] },
      { title: "Mind", members: [
        { id: "mood", label: "Mood", detail: "A daily check-in and patterns" },
        { id: "meditate", label: "Meditate", detail: "Guided breathing and a quiet timer" },
        { id: "habits", label: "Habits", detail: "Build habits, one day at a time" },
        { id: "self-care" as FamilySection, label: "Self-care ideas" },
      ] },
      { title: "Records", members: [
        { id: "medical", label: "Medical info", detail: "Health cards for your family" },
        { id: "checkups", label: "Checkups", detail: "Who is due for the dentist?" },
        { id: "doctors" as FamilySection, label: "Doctors & dentists" },
        { id: "vaccines" as FamilySection, label: "Vaccine records" },
        { id: "allergies-list" as FamilySection, label: "Allergies" },
        { id: "pain-level" as FamilySection, label: "Pain level" },
      ] },
      { title: "Daily trackers", members: [
        { id: "water-log" as FamilySection, label: "Water" },
        { id: "steps-log" as FamilySection, label: "Steps" },
        { id: "veggie-log" as FamilySection, label: "Fruits & veggies" },
        { id: "outdoor-log" as FamilySection, label: "Outdoor time" },
        { id: "stretch-log" as FamilySection, label: "Stretching" },
        { id: "yoga-log" as FamilySection, label: "Yoga" },
        { id: "screen-time" as FamilySection, label: "Screen time" },
        { id: "coffee-log" as FamilySection, label: "Caffeine" },
        { id: "alcohol-free" as FamilySection, label: "Alcohol-free days" },
        { id: "smoke-free" as FamilySection, label: "Smoke-free days" },
        { id: "sugar-free" as FamilySection, label: "No added sugar" },
        { id: "soda-free" as FamilySection, label: "No soda" },
        { id: "flossed" as FamilySection, label: "Flossed" },
      ] },
    ],
    promo: { title: "Want more from your health?", body: "Arise Fit has full training programs, meal tracking, sleep scores, a medicine tracker and a period tracker, plus a coach.", cta: "Get Arise Fit", href: FIT_LINK },
  },
  {
    id: "inspire", section: "inspire", name: "Journal & Inspiration", category: "Inspiration", icon: "NotebookPen", color: "#8b5cf6",
    tagline: "Journal, quotes, gratitude and more",
    description: "Your daily moment of calm in one plugin: a journal with prompts, a motivational quote every day, gratitude, affirmations, pep talks and the Bible. Pick the pages you want and skip the rest.",
    features: ["A journal with daily prompts", "A motivational quote every day", "Gratitude, affirmations and pep talks", "Verse of the day"],
    pickerTitle: "Pick your pages", pickerIntro: "Choose what you want here. You can change this any time with the settings button.",
    fixed: [],
    groups: [
      { title: "Write", members: [
        { id: "journal", label: "Journal", detail: "A daily journal with prompts" },
        { id: "gratitude", label: "Gratitude", detail: "Three good things a day" },
      ] },
      { title: "Read", members: [
        { id: "quotes", label: "Daily quote", detail: "A motivational quote every day" },
        { id: "affirmations" as FamilySection, label: "Affirmations" },
        { id: "pep-talks" as FamilySection, label: "Pep talks" },
        { id: "bible", label: "Bible", detail: "Verse of the day and any passage" },
      ] },
    ],
  },
  {
    id: "kitchen", section: "kitchen", name: "Kitchen", category: "Kitchen", icon: "ChefHat", color: "#ea580c",
    tagline: "Plan meals, shop, cook",
    description: "Plan the week, tap once to put what you need on your shopping list, and shop with one clean checklist. Your recipes live right here too. Add a pantry, freezer or kitchen timers if you want them.",
    features: ["Plan the week in a glance", "One-tap shopping list from your plan or a recipe", "A clean, sorted checklist", "Recipes, pantry, freezer and timers if you want them"],
    pickerTitle: "Extras for your kitchen", pickerIntro: "Shop, Plan and Recipes are always here. Add anything else you would use.",
    fixed: ["grocery", "meals", "recipes"],
    groups: [
      { title: "Add to your kitchen", members: [
        { id: "timers", label: "Timers", detail: "Run several kitchen timers at once" },
        { id: "restaurants", label: "Restaurants", detail: "Places to try, and how they rated" },
        { id: "pantry" as FamilySection, label: "Pantry" },
        { id: "freezer" as FamilySection, label: "Freezer" },
        { id: "price-book" as FamilySection, label: "Price book" },
        { id: "recipe-scaler" as FamilySection, label: "Recipe scaler" },
        { id: "substitutions" as FamilySection, label: "Kitchen swaps" },
        { id: "cooking-tips" as FamilySection, label: "Cooking tips" },
        { id: "easy-dinners" as FamilySection, label: "Easy dinner ideas" },
        { id: "lunchbox-ideas" as FamilySection, label: "Lunchbox ideas" },
        { id: "breakfast-ideas" as FamilySection, label: "Breakfast ideas" },
        { id: "kid-snacks" as FamilySection, label: "Kids' snacks" },
        { id: "slow-cooker" as FamilySection, label: "Slow cooker ideas" },
        { id: "takeout-menus" as FamilySection, label: "Takeout favorites" },
        { id: "wine-list" as FamilySection, label: "Drinks we liked" },
        { id: "potluck" as FamilySection, label: "Potluck sign-up" },
        { id: "home-meals" as FamilySection, label: "Home-cooked meals" },
      ] },
    ],
  },
];

export const BUNDLE_BY_SECTION = new Map<string, Bundle>(BUNDLES.map((b) => [b.section, b]));
/** Every page that lives inside a bundle (fixed and optional) → the bundle section it belongs to. */
export const BUNDLE_PARENT = new Map<string, BundleId>(BUNDLES.flatMap((b) => [...b.fixed, ...b.groups.flatMap((g) => g.members.map((m) => m.id))].map((id) => [id, b.id] as [string, BundleId])));
export const bundleOf = (b: BundleId | string) => BUNDLE_BY_SECTION.get(b);
/** The bundle a page belongs to, or undefined for an ordinary section. */
export const parentOf = (section: string): BundleId | undefined => BUNDLE_PARENT.get(section);
export const bundleMembers = (b: Bundle): FamilySection[] => [...b.fixed, ...b.groups.flatMap((g) => g.members.map((m) => m.id))];
export const memberInfo = (b: Bundle, id: string): BundleMember | undefined => b.groups.flatMap((g) => g.members).find((m) => m.id === id);
