// One plugin for one job (November 2026): LifeHub's health, journal and kitchen tools used to be dozens of
// separate plugins in the gallery. Each is now ONE plugin with the old ones inside it as pages. The first
// time it opens, a "Pick your tools" box lets the person choose which pages they want (a woman might choose the
// period tracker). The old sections still exist underneath, so nothing anyone saved moves or is lost, and
// everyone who already added one of them keeps it, now inside the new plugin.
import type { FamilySection } from "./familyHub";

/** "healthlite" is retired (no bundle): kept in the type so saved choices still read. */
export type BundleId = "healthlite" | "inspire" | "kitchen" | "moneyhub" | "homehub" | "datehub" | "dailyhub" | "listhub" | "focushub";
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


export const BUNDLES: Bundle[] = [
  // Health Lite was here until Nov 15, 2026 (retired: its tools are separate plugins again, see RETIRED_SECTIONS).
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
    fixed: ["meals", "grocery", "recipes"],
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
  {
    id: "moneyhub", section: "moneyhub", name: "Money", category: "Money & home", icon: "Wallet", color: "#059669",
    tagline: "Budget, bills, loans and savings in one place",
    description: "All your money tools in one plugin. Pick the pages you want, like a budget, subscriptions, loans, IOUs, allowance, savings jars, gift cards or a tip calculator, and switch between them with one tap.",
    features: ["Pick only the pages you need", "Budget, bills and subscriptions", "Loans, mortgage and IOUs", "Allowance, savings jars and gift cards"],
    pickerTitle: "Pick your money tools", pickerIntro: "Choose what you want here. You can change this any time with the settings button.",
    fixed: [],
    groups: [
      { title: "Everyday", members: [
        { id: "money" as FamilySection, label: "Budget & bills" },
        { id: "subscriptions" as FamilySection },
        { id: "jars" as FamilySection },
        { id: "tips" as FamilySection }
      ] },
      { title: "Owed & owing", members: [
        { id: "loans" as FamilySection },
        { id: "mortgage" as FamilySection },
        { id: "ious" as FamilySection },
        { id: "allowance" as FamilySection },
        { id: "giftcards" as FamilySection }
      ] },
    ],
  },
  {
    id: "homehub", section: "homehub", name: "Home & Car", category: "Money & home", icon: "Wrench", color: "#0ea5e9",
    tagline: "Upkeep, cleaning, plants, car and warranties",
    description: "Keep the house and the car running from one plugin. Pick upkeep reminders, a cleaning schedule, plant care, car tracking, mileage and warranties.",
    features: ["Pick only the pages you need", "Upkeep and cleaning schedules", "Plants and car care", "Mileage and warranties"],
    pickerTitle: "Pick your home tools", pickerIntro: "Choose what you want here. You can change this any time with the settings button.",
    fixed: [],
    groups: [
      { title: "House", members: [
        { id: "upkeep" as FamilySection },
        { id: "cleaning" as FamilySection },
        { id: "plants" as FamilySection }
      ] },
      { title: "Car & stuff", members: [
        { id: "car" as FamilySection },
        { id: "mileage" as FamilySection },
        { id: "warranties" as FamilySection }
      ] },
    ],
  },
  {
    id: "datehub", section: "datehub", name: "Gifts & Dates", category: "Family", icon: "Gift", color: "#ec4899",
    tagline: "Birthdays, gift ideas, wishlists and countdowns",
    description: "Never miss a birthday again. Pick birthdays, gift ideas, a wishlist and countdowns, all in one plugin.",
    features: ["Pick only the pages you need", "Birthdays with reminders", "Gift ideas and wishlists", "Countdowns to big days"],
    pickerTitle: "Pick your pages", pickerIntro: "Choose what you want here. You can change this any time with the settings button.",
    fixed: [],
    groups: [
      { title: "Dates & gifts", members: [
        { id: "birthdays" as FamilySection },
        { id: "gifts" as FamilySection },
        { id: "wishlist" as FamilySection },
        { id: "countdowns" as FamilySection }
      ] },
    ],
  },
  {
    id: "dailyhub", section: "dailyhub", name: "Daily Reads", category: "Everyday", icon: "Newspaper", color: "#475569",
    tagline: "News, history, trending and the dictionary",
    description: "A little to read every day in one plugin. Pick news, today in history, what is trending and a dictionary.",
    features: ["Pick only the pages you need", "News and trending", "Today in history", "A dictionary"],
    pickerTitle: "Pick your reads", pickerIntro: "Choose what you want here. You can change this any time with the settings button.",
    fixed: [],
    groups: [
      { title: "Read", members: [
        { id: "news" as FamilySection },
        { id: "history" as FamilySection },
        { id: "trending" as FamilySection },
        { id: "dictionary" as FamilySection }
      ] },
    ],
  },
  {
    id: "listhub", section: "listhub", name: "Lists", category: "Everyday", icon: "ListChecks", color: "#7c3aed",
    tagline: "Reading list, watchlist, bucket list and learning",
    description: "Every list in one plugin. Pick a reading list, a watchlist, a bucket list and things you want to learn.",
    features: ["Pick only the pages you need", "Books and shows to watch", "A bucket list", "Things to learn"],
    pickerTitle: "Pick your lists", pickerIntro: "Choose what you want here. You can change this any time with the settings button.",
    fixed: [],
    groups: [
      { title: "Lists", members: [
        { id: "reading" as FamilySection },
        { id: "watchlist" as FamilySection },
        { id: "bucket" as FamilySection },
        { id: "learning" as FamilySection }
      ] },
    ],
  },
  {
    id: "focushub", section: "focushub", name: "Focus & Routines", category: "Everyday", icon: "Timer", color: "#f59e0b",
    tagline: "Focus timer, clocks, routines and milestones",
    description: "Stay on track with one plugin. Pick a focus timer, a world clock, family routines and milestones.",
    features: ["Pick only the pages you need", "A focus timer", "World clock", "Routines and milestones"],
    pickerTitle: "Pick your pages", pickerIntro: "Choose what you want here. You can change this any time with the settings button.",
    fixed: [],
    groups: [
      { title: "Focus", members: [
        { id: "focus" as FamilySection },
        { id: "clocks" as FamilySection }
      ] },
      { title: "Family", members: [
        { id: "routines" as FamilySection },
        { id: "milestones" as FamilySection }
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
