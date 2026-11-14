// The four Arise apps that also live inside Arise To Duo (November 2026): Cooked, Cooked PT, Arise Notes
// and Podster. Each is still its own App Store app. Inside To Duo each one is a plugin from the Plugin
// Gallery that opens in To Duo's own frame and look, signed in with the To Duo account (no second sign-in).
// Its menu is taken apart into To Duo's row of pages, like Health Lite and Kitchen (shared/appBundles.ts):
// the person picks which pages show with the settings button, and the rest stay one tap away.
//
// The screens are the apps' own, drawn in To Duo's colors and type (client/src/components/super-apps/).
// No imports from familyHub here (it imports this file), so this stays a leaf.

export type SuperAppId = "cooked" | "cookedpt" | "arisenotes" | "podster";
export const SUPER_APP_IDS: readonly SuperAppId[] = ["cooked", "cookedpt", "arisenotes", "podster"];

export type SuperPage = {
  id: string;
  label: string;
  /** A lucide icon name (client/src/components/super-apps/superIcons.ts maps it). */
  icon: string;
  /** One line in the "Pick your pages" box. */
  detail?: string;
};

export type SuperApp = {
  id: SuperAppId;
  /** The LifeHub section it opens as (the same id). */
  section: SuperAppId;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  /** A lucide icon name the Plugin Gallery knows (components/plugin-store/PluginStore.tsx ICONS). */
  icon: string;
  color: string;
  /** Its own App Store listing, for "Also on iPhone". */
  appStore: string;
  /** Every page it has, in the order they show. */
  pages: SuperPage[];
  /** Pages that are always there. */
  fixed: string[];
  /** What a new person starts with (fixed ones included). */
  defaults: string[];
  /** Whether "Pick your pages" is offered. Cooked keeps its own Plugins page instead (its add-ons), and
   *  Cooked PT's five pages are the whole app. */
  pickable: boolean;
};

export const SUPER_APPS: readonly SuperApp[] = [
  {
    id: "cooked", section: "cooked", name: "Cooked", icon: "Dumbbell", color: "#ea580c",
    appStore: "https://apps.apple.com/app/id6829228586",
    tagline: "Workouts, food, sleep and a real coach",
    description: "Cooked Fitness by Arise, right inside To Duo: lifting programs with every set and rest timer, a food log with macros and barcode scans, runs, sleep, water, fasting and recovery, and a personal trainer when you want one. Add only the Cooked plugins you use.",
    features: ["Programs, live workouts and personal bests", "Food log with macros, meal photos and barcodes", "Runs, sleep, water, fasting and recovery", "Work with a real trainer and choose what they see"],
    pages: [
      { id: "today", label: "Today", icon: "Home", detail: "Your day at a glance" },
      { id: "train", label: "Train", icon: "Dumbbell" }, { id: "food", label: "Food", icon: "Apple" }, { id: "run", label: "Run", icon: "Route" },
      { id: "sleep", label: "Sleep", icon: "Moon" }, { id: "water", label: "Water", icon: "Droplets" }, { id: "fast", label: "Fasting", icon: "Timer" },
      { id: "recovery", label: "Recovery", icon: "HeartPulse" }, { id: "progress", label: "Progress", icon: "BarChart3" }, { id: "steps", label: "Steps", icon: "Footprints" },
      { id: "yoga", label: "Yoga", icon: "Flower2" }, { id: "mind", label: "Breathe", icon: "Wind" }, { id: "mobility", label: "Mobility", icon: "PersonStanding" },
      { id: "hiit", label: "Intervals", icon: "Zap" }, { id: "c25k", label: "Couch to 5K", icon: "Medal" }, { id: "meds", label: "Medicine", icon: "Pill" },
      { id: "period", label: "Period", icon: "CalendarHeart" }, { id: "friends", label: "Friends", icon: "Users" },
      { id: "apps", label: "Plugins", icon: "LayoutGrid", detail: "Add or remove Cooked plugins" },
    ],
    fixed: ["today", "apps"], defaults: ["today", "train", "food", "run", "apps"], pickable: false,
  },
  {
    id: "cookedpt", section: "cookedpt", name: "Cooked PT", icon: "HeartHandshake", color: "#0d9488",
    appStore: "https://apps.apple.com/app/id6829495059",
    tagline: "Coach your clients: programs, inbox and bookings",
    description: "Cooked PT for personal trainers, inside To Duo: get found by people near you who want a trainer, then coach every client in one place. Build programs, see the workouts, food and sleep each client chooses to share, message them, book sessions and get your own website.",
    features: ["A client list with how each one is doing", "Program builder and workout templates", "One inbox for every client", "Bookings, payments and your own website"],
    pages: [
      { id: "clients", label: "Clients", icon: "Users" }, { id: "inbox", label: "Inbox", icon: "Inbox" }, { id: "schedule", label: "Schedule", icon: "CalendarDays" },
      { id: "library", label: "Library", icon: "BookOpen" }, { id: "business", label: "Business", icon: "Briefcase" },
    ],
    fixed: ["clients", "inbox", "schedule", "library", "business"], defaults: ["clients", "inbox", "schedule", "library", "business"], pickable: false,
  },
  {
    id: "arisenotes", section: "arisenotes", name: "Arise Notes", icon: "NotebookPen", color: "#6a55dc",
    appStore: "https://apps.apple.com/app/id6829538120",
    tagline: "AI notes: record, transcribe, summarize",
    description: "Arise Notes inside To Duo: record a meeting, class or visit (or upload one) and get a transcript, a summary, decisions and action items. Type @arise on any line to ask the AI, and use Docs, Sheets, Slides, a whiteboard and flashcards from the Notes plugins.",
    features: ["Record or upload, then a transcript and summary", "Type @arise on any line to ask the AI", "To-dos and dates into your planner", "Docs, Sheets, Slides, whiteboard and flashcards"],
    pages: [
      { id: "pages", label: "Notes", icon: "NotebookPen", detail: "Your typed and handwritten notes" },
      { id: "record", label: "Record", icon: "Mic", detail: "Record a meeting, class or visit" },
      { id: "upload", label: "Upload", icon: "Upload", detail: "Turn a recording into notes" },
      { id: "ask", label: "@arise", icon: "Sparkles", detail: "Ask the AI about anything, or your notes" },
      { id: "memo", label: "Voice memo", icon: "AudioLines", detail: "A quick memo, written down for you" },
      { id: "apps", label: "Plugins", icon: "LayoutGrid", detail: "Docs, Sheets, Slides, whiteboard and more" },
      { id: "settings", label: "Settings", icon: "Settings", detail: "Plan, minutes, look and privacy" },
    ],
    fixed: ["pages"], defaults: ["pages", "record", "upload", "ask", "apps", "settings"], pickable: true,
  },
  {
    id: "podster", section: "podster", name: "Podster", icon: "Podcast", color: "#db2777",
    appStore: "https://apps.apple.com/app/id6828271468",
    tagline: "Podcasts, audiobooks, radio and music",
    description: "Podster inside To Duo: a home page of podcasts picked for you and a swipe feed, plus free audiobooks, music, live radio and news. Turn your own notes into a study episode, post on Podster Social, and keep your library on every device with your To Duo account.",
    features: ["Podcasts picked for you, and a swipe feed", "Audiobooks, music, radio and live news", "Study Podster turns your notes into an episode", "New-episode alerts for the shows you follow"],
    pages: [
      { id: "home", label: "Home", icon: "Home", detail: "Podcasts picked for you" },
      { id: "feed", label: "Swipe feed", icon: "GalleryVertical", detail: "One episode at a time, swipe for the next" },
      { id: "books", label: "Audiobooks", icon: "BookOpen", detail: "Free classic audiobooks" },
      { id: "music", label: "Music", icon: "Music", detail: "Free public domain recordings" },
      { id: "radio", label: "Radio", icon: "Radio", detail: "Live radio stations" },
      { id: "now", label: "News", icon: "Zap", detail: "Up to the minute news" },
      { id: "newsstations", label: "News stations", icon: "Radio", detail: "Live news radio" },
      { id: "standup", label: "Stand-up", icon: "Mic2", detail: "Comedy sets" },
      { id: "study", label: "Study Podster", icon: "GraduationCap", detail: "Your notes, turned into an episode" },
      { id: "meeting", label: "Meeting Pod", icon: "Briefcase", detail: "A meeting, turned into a summary episode" },
      { id: "wiki", label: "Wiki podcasts", icon: "Library", detail: "Any Wikipedia article, read aloud" },
      { id: "live", label: "Live", icon: "Mic", detail: "Audio rooms happening now" },
      { id: "party", label: "Listen together", icon: "Users", detail: "Listen in step with friends" },
      { id: "social", label: "Social", icon: "MessageCircle", detail: "Posts and clips from listeners" },
      { id: "openmic", label: "Open Mic", icon: "Mic2", detail: "Short takes from listeners" },
      { id: "library", label: "Library", icon: "Library", detail: "Shows you follow and downloads" },
      { id: "liked", label: "Liked", icon: "ThumbsUp", detail: "Episodes you liked" },
      { id: "later", label: "Listen later", icon: "Clock", detail: "Saved for later" },
      { id: "import", label: "Bring your shows", icon: "ArrowDownToLine", detail: "Move your shows from another app" },
    ],
    fixed: ["home"], defaults: ["home", "feed", "books", "music", "radio", "study", "social", "library"], pickable: true,
  },
];

export const SUPER_APP_BY_ID = new Map<string, SuperApp>(SUPER_APPS.map((a) => [a.id, a]));
export const isSuperApp = (id: unknown): id is SuperAppId => typeof id === "string" && SUPER_APP_BY_ID.has(id);
export const superAppOf = (id: string): SuperApp | undefined => SUPER_APP_BY_ID.get(id);

/** The pages showing for an app: the fixed ones, then the picked ones (or the defaults, never chosen),
 *  in the app's own order. Unknown or duplicate ids are dropped. */
export function superPagesFor(app: SuperApp, picked?: readonly string[] | null): string[] {
  const known = new Set(app.pages.map((p) => p.id));
  const chosen = new Set([...app.fixed, ...(picked && picked.length ? picked : app.defaults)].filter((id) => known.has(id)));
  return app.pages.map((p) => p.id).filter((id) => chosen.has(id));
}

/** The saved choices (family.superPages), cleaned: known apps, known pages, no repeats. */
export function cleanSuperPages(raw: unknown): Partial<Record<SuperAppId, string[]>> {
  const out: Partial<Record<SuperAppId, string[]>> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, list] of Object.entries(raw as Record<string, unknown>)) {
    const app = SUPER_APP_BY_ID.get(id);
    if (!app || !Array.isArray(list)) continue;
    const known = new Set(app.pages.map((p) => p.id));
    out[app.id] = [...new Set(list.filter((x): x is string => typeof x === "string" && known.has(x)))];
  }
  return out;
}

/** The address inside Arise To Duo that opens one of these apps (and a page or episode in it). */
export function duoAppHash(app: SuperAppId, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({ go: app, ...extra });
  return `/to-do?${q.toString()}`;
}

/**
 * A link or notification meant for one of these apps' own screens, as the place inside Arise To Duo
 * that shows the same thing. Used by the To Duo iPhone app, where a tap on a Cooked coach message
 * (#/fit), a Cooked PT request (#/trainer), an Arise Notes alert (/notes/#…) or a Podster new-episode
 * alert (?s=…&e=…) should open that plugin in To Duo, not a second app. null for anything else.
 */
export function duoLinkFor(url: string): string | null {
  const u = String(url || "").trim();
  if (!u) return null;
  const hashAt = u.indexOf("#");
  const route = hashAt >= 0 ? u.slice(hashAt + 1) : u;
  if (/^\/fit(?:[/?]|$)/.test(route)) {
    const coach = /[?&]coach=([0-9a-z]{1,10}-[A-Za-z0-9_-]{10})/.exec(route)?.[1];
    return duoAppHash("cooked", coach ? { coach } : {});
  }
  if (/^\/trainer(?:[/?]|$)/.test(route)) return duoAppHash("cookedpt");
  if (/^\/notes\//.test(u) || /^\/arise-notes(?:[/?]|$)/.test(route)) return duoAppHash("arisenotes");
  // Podster's own alerts open an episode: ?s=<show>&e=<episode> (server/podPush.ts).
  const pod = /[?&]s=(\d{3,15})&e=(\d{1,20})/.exec(u);
  if (pod && (/^\?/.test(u) || /podster/i.test(u))) return duoAppHash("podster", { s: pod[1], e: pod[2] });
  return null;
}
