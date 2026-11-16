// The four Arise apps that also live inside Arise To Duo (November 2026): Cooked, Cooked PT, Arise Notes
// and Podster. Each is still its own App Store app. Inside To Duo each one is a plugin from the Plugin
// Gallery that opens in To Duo's own frame and look, signed in with the To Duo account (no second sign-in).
// Its menu is taken apart into To Duo's row of pages, like Health Lite and Kitchen (shared/appBundles.ts):
// the person picks which pages show with the settings button, and the rest stay one tap away.
//
// The screens are the apps' own, drawn in To Duo's colors and type (client/src/components/super-apps/).
// No imports from familyHub here (it imports this file), so this stays a leaf.

export type SuperAppId = CookedPartId | "cookedpt" | NotesPartId | PodPartId;
/** Cooked, taken apart (Nov 15, 2026): Workouts keeps Cooked's id, so its links and trainer invites still work. */
export type CookedPartId = "cooked" | "cookedfood" | "cookedrun" | "cookedrest" | "cookedsocial";
export const COOKED_PARTS: readonly CookedPartId[] = ["cooked", "cookedfood", "cookedrun", "cookedrest", "cookedsocial"];
/** Arise Notes, taken apart (Nov 15, 2026): Arise Notes keeps its id and its notes; recording and @arise are their own. */
export type NotesPartId = "arisenotes" | "notesrecord" | "notesask";
export const NOTES_PARTS: readonly NotesPartId[] = ["arisenotes", "notesrecord", "notesask"];
/** Podster, taken apart (Nov 15, 2026): five Premium plugins of their own, each drawn in To Duo's look. */
export type PodPartId = "podcasts" | "audiobooks" | "podradio" | "studypod" | "podsocial";
export const POD_PARTS: readonly PodPartId[] = ["podcasts", "audiobooks", "podradio", "studypod", "podsocial"];
export const SUPER_APP_IDS: readonly SuperAppId[] = [...COOKED_PARTS, "cookedpt", ...NOTES_PARTS, ...POD_PARTS];
/** The combined apps that were taken apart, and the plugins that replace them. Anyone who had one gets
 *  all of its parts (shared/familyHub.ts cleanFamily), and links to the old one open the first part. */
export const SPLIT_APPS: Readonly<Record<string, readonly SuperAppId[]>> = { podster: POD_PARTS, cooked: COOKED_PARTS, arisenotes: NOTES_PARTS };

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
  /** The family it belongs to, shown above its name (To Duo's eyebrow), e.g. "Podster". */
  family?: string;
  /** Whether "Pick your pages" is offered. Cooked keeps its own Plugins page instead (its add-ons), and
   *  Cooked PT's five pages are the whole app. */
  pickable: boolean;
};

export const SUPER_APPS: readonly SuperApp[] = [
  {
    id: "cooked", section: "cooked", family: "Cooked", name: "Workouts", icon: "Dumbbell", color: "#ea580c",
    appStore: "https://apps.apple.com/app/id6829228586",
    tagline: "Programs, live workouts and a real coach",
    description: "Cooked's training inside To Duo: lifting programs with every set and rest timer, intervals, yoga, mobility and Couch to 5K, your progress and personal bests, and a personal trainer when you want one.",
    features: ["Programs, live workouts and personal bests", "Intervals, yoga, mobility and Couch to 5K", "Your progress and personal bests", "Work with a real trainer and choose what they see"],
    pages: [
      { id: "today", label: "Today", icon: "Home", detail: "Your day at a glance" },
      { id: "train", label: "Train", icon: "Dumbbell" }, { id: "hiit", label: "Intervals", icon: "Zap" }, { id: "yoga", label: "Yoga", icon: "Flower2" },
      { id: "mobility", label: "Mobility", icon: "PersonStanding" }, { id: "c25k", label: "Couch to 5K", icon: "Medal" }, { id: "progress", label: "Progress", icon: "BarChart3" },
    ],
    fixed: ["today", "train", "hiit", "yoga", "mobility", "c25k", "progress"], defaults: ["today", "train", "hiit", "yoga", "mobility", "c25k", "progress"], pickable: false,
  },
  {
    id: "cookedfood", section: "cookedfood", family: "Cooked", name: "Food & Fasting", icon: "Apple", color: "#16a34a",
    appStore: "https://apps.apple.com/app/id6829228586",
    tagline: "A food log with macros, fasting and water",
    description: "Cooked's food log inside To Duo: log meals with macros, meal photos and barcode scans, run a fast with a timer, and keep up with water.",
    features: ["Food log with macros", "Meal photos and barcode scans", "Fasting timer", "Water through the day"],
    pages: [{ id: "food", label: "Food", icon: "Apple" }, { id: "fast", label: "Fasting", icon: "Timer" }, { id: "water", label: "Water", icon: "Droplets" }],
    fixed: ["food", "fast", "water"], defaults: ["food", "fast", "water"], pickable: false,
  },
  {
    id: "cookedrun", section: "cookedrun", family: "Cooked", name: "Run & Steps", icon: "Route", color: "#0284c7",
    appStore: "https://apps.apple.com/app/id6829228586",
    tagline: "Runs, walks and rides, and your steps",
    description: "Cooked's outdoor tracker inside To Duo: runs, walks and rides with distance and pace, and your daily steps toward a goal.",
    features: ["Runs, walks and rides", "Distance, pace and splits", "Daily steps toward a goal", "Your history week by week"],
    pages: [{ id: "run", label: "Run", icon: "Route" }, { id: "steps", label: "Steps", icon: "Footprints" }],
    fixed: ["run", "steps"], defaults: ["run", "steps"], pickable: false,
  },
  {
    id: "cookedrest", section: "cookedrest", family: "Cooked", name: "Sleep & Recovery", icon: "Moon", color: "#4f46e5",
    appStore: "https://apps.apple.com/app/id6829228586",
    tagline: "Sleep, readiness, breathing and your body",
    description: "Cooked's recovery side inside To Duo: track sleep, see how ready you are to train, breathe and wind down, and keep your medicine and period in the same place.",
    features: ["Sleep tracking", "Readiness from your training and sleep", "Breathing and wind-down", "Medicine and period, kept with it"],
    pages: [{ id: "sleep", label: "Sleep", icon: "Moon" }, { id: "recovery", label: "Recovery", icon: "HeartPulse" }, { id: "mind", label: "Breathe", icon: "Wind" }, { id: "meds", label: "Medicine", icon: "Pill" }, { id: "period", label: "Period", icon: "CalendarHeart" }],
    fixed: ["sleep", "recovery", "mind", "meds", "period"], defaults: ["sleep", "recovery", "mind", "meds", "period"], pickable: false,
  },
  {
    id: "cookedsocial", section: "cookedsocial", family: "Cooked", name: "Cooked Social", icon: "Users", color: "#e11d48",
    appStore: "https://apps.apple.com/app/id6829228586",
    tagline: "Friends, your circle and a workout buddy",
    description: "Cooked's social side inside To Duo: add friends, see how your circle is doing, and pair up with a workout buddy to keep each other going.",
    features: ["Friends and their workouts", "Your circle's leaderboard", "A workout buddy", "Cheer each other on"],
    pages: [{ id: "friends", label: "Friends", icon: "Users" }],
    fixed: ["friends"], defaults: ["friends"], pickable: false,
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
    id: "arisenotes", section: "arisenotes", family: "Arise Notes", name: "Arise Notes", icon: "NotebookPen", color: "#6a55dc",
    appStore: "https://apps.apple.com/app/id6829538120",
    tagline: "Your typed and handwritten notes",
    description: "Arise Notes inside To Duo: typed and handwritten notes and pages, with Docs, Sheets, Slides, a whiteboard and flashcards from the Notes plugins, and your plan and minutes in Settings.",
    features: ["Typed and handwritten notes", "Docs, Sheets, Slides, whiteboard and flashcards", "To-dos and dates into your planner", "Your plan, minutes, look and privacy"],
    pages: [
      { id: "pages", label: "Notes", icon: "NotebookPen", detail: "Your typed and handwritten notes" },
      { id: "apps", label: "Plugins", icon: "LayoutGrid", detail: "Docs, Sheets, Slides, whiteboard and more" },
      { id: "settings", label: "Settings", icon: "Settings", detail: "Plan, minutes, look and privacy" },
    ],
    fixed: ["pages", "apps", "settings"], defaults: ["pages", "apps", "settings"], pickable: false,
  },
  {
    id: "notesrecord", section: "notesrecord", family: "Arise Notes", name: "Recorder", icon: "Mic", color: "#7c3aed",
    appStore: "https://apps.apple.com/app/id6829538120",
    tagline: "Record or upload, and get the notes written",
    description: "Record a meeting, class or visit, or upload a recording, and Arise Notes writes the transcript, a summary, the decisions and the action items. Voice memos are written down for you too.",
    features: ["Record a meeting, class or visit", "Upload a recording", "Transcript, summary and action items", "Quick voice memos, written down"],
    pages: [
      { id: "record", label: "Record", icon: "Mic", detail: "Record a meeting, class or visit" },
      { id: "upload", label: "Upload", icon: "Upload", detail: "Turn a recording into notes" },
      { id: "memo", label: "Voice memo", icon: "AudioLines", detail: "A quick memo, written down for you" },
    ],
    fixed: ["record", "upload", "memo"], defaults: ["record", "upload", "memo"], pickable: false,
  },
  {
    id: "notesask", section: "notesask", family: "Arise Notes", name: "Ask @arise", icon: "Sparkles", color: "#9333ea",
    appStore: "https://apps.apple.com/app/id6829538120",
    tagline: "Ask the AI about anything, or your notes",
    description: "Ask @arise, Arise Notes' AI, about anything or about your own notes and recordings, in a plain chat inside To Duo.",
    features: ["Ask about anything", "Ask about your notes and recordings", "Plain answers, quickly", "Uses your Arise Notes minutes"],
    pages: [{ id: "ask", label: "Ask", icon: "Sparkles", detail: "Ask the AI about anything, or your notes" }],
    fixed: ["ask"], defaults: ["ask"], pickable: false,
  },
  {
    id: "podcasts", section: "podcasts", family: "Podster", name: "Podcasts", icon: "Podcast", color: "#db2777",
    appStore: "https://apps.apple.com/app/id6828271468",
    tagline: "Shows picked for you, a swipe feed and your library",
    description: "Podster's podcasts inside To Duo: a home page of shows picked for what you like, a swipe feed that plays one episode after another, up to the minute news, stand-up and Wikipedia read aloud, and your library of follows, likes and downloads, kept with your To Duo account.",
    features: ["Podcasts picked for you, and a swipe feed", "Up to the minute news and stand-up", "Your follows, likes and downloads on every device", "New-episode alerts for the shows you follow"],
    pages: [
      { id: "home", label: "Home", icon: "Home", detail: "Podcasts picked for you" },
      { id: "feed", label: "Swipe feed", icon: "GalleryVertical", detail: "One episode at a time, swipe for the next" },
      { id: "music", label: "Music", icon: "Music", detail: "Free public domain recordings" },
      { id: "now", label: "News", icon: "Zap", detail: "Up to the minute news" },
      { id: "standup", label: "Stand-up", icon: "Mic2", detail: "Comedy sets" },
      { id: "wiki", label: "Wiki podcasts", icon: "Library", detail: "Any Wikipedia article, read aloud" },
      { id: "live", label: "Live", icon: "Mic", detail: "Audio rooms happening now" },
      { id: "party", label: "Listen together", icon: "Users", detail: "Listen in step with friends" },
      { id: "library", label: "Library", icon: "Library", detail: "Shows you follow and downloads" },
      { id: "liked", label: "Liked", icon: "ThumbsUp", detail: "Episodes you liked" },
      { id: "later", label: "Listen later", icon: "Clock", detail: "Saved for later" },
      { id: "import", label: "Bring your shows", icon: "ArrowDownToLine", detail: "Move your shows from another app" },
    ],
    fixed: ["home"], defaults: ["home", "feed", "now", "library"], pickable: true,
  },
  {
    id: "audiobooks", section: "audiobooks", family: "Podster", name: "Audiobooks", icon: "BookOpen", color: "#7c3aed",
    appStore: "https://apps.apple.com/app/id6828271468",
    tagline: "Thousands of classic books, read aloud",
    description: "Free classic audiobooks from LibriVox, in To Duo: browse shelves or search by title and author, pick up where you left off, and listen with To Duo's player while you use the rest of the app, with speed and a sleep timer.",
    features: ["Thousands of classic books, free with no ads", "Continue where you left off", "Speed, skip and a sleep timer", "Keeps playing while you use the rest of To Duo"],
    pages: [
      { id: "browse", label: "Browse", icon: "BookOpen", detail: "Shelves of classic books" },
      { id: "listening", label: "Listening", icon: "Headphones", detail: "Books you've started" },
    ],
    fixed: ["browse", "listening"], defaults: ["browse", "listening"], pickable: false,
  },
  {
    id: "podradio", section: "podradio", family: "Podster", name: "Radio", icon: "Radio", color: "#0891b2",
    appStore: "https://apps.apple.com/app/id6828271468",
    tagline: "Live FM, AM and online stations",
    description: "Live radio in To Duo: stations near you, FM, talk, sports and every kind of music, and stations that are news all day, played straight from each station's own stream. It keeps playing while you use the rest of To Duo.",
    features: ["Stations near you and around the world", "Music, talk, sports and news stations", "Save your favorite stations", "Keeps playing while you use the rest of To Duo"],
    pages: [
      { id: "stations", label: "Stations", icon: "Radio", detail: "Live stations by kind" },
      { id: "news", label: "News stations", icon: "Zap", detail: "News all day" },
      { id: "saved", label: "Saved", icon: "Heart", detail: "Your favorite stations" },
    ],
    fixed: ["stations", "news", "saved"], defaults: ["stations", "news", "saved"], pickable: false,
  },
  {
    id: "studypod", section: "studypod", family: "Podster", name: "Study Podster", icon: "GraduationCap", color: "#2563eb",
    appStore: "https://apps.apple.com/app/id6828271468",
    tagline: "Your notes, turned into an episode",
    description: "Paste notes, add a PDF or photos of a page, or record a class, and Study Podster makes a short episode two hosts talk through, with a summary, key points and a quiz. Meeting Pod does the same for a meeting: decisions, action items and open questions.",
    features: ["Notes, PDFs, photos or a recording", "Two AI hosts talk it through", "Summary, key points and a quiz", "Meeting Pod: decisions and action items"],
    pages: [
      { id: "study", label: "Study", icon: "GraduationCap", detail: "Notes into a study episode" },
      { id: "meeting", label: "Meeting Pod", icon: "Briefcase", detail: "A meeting into a summary episode" },
      { id: "made", label: "Made", icon: "Library", detail: "Everything you've made" },
    ],
    fixed: ["study", "meeting", "made"], defaults: ["study", "meeting", "made"], pickable: false,
  },
  {
    id: "podsocial", section: "podsocial", family: "Podster", name: "Podster Social", icon: "MessageCircle", color: "#e11d48",
    appStore: "https://apps.apple.com/app/id6828271468",
    tagline: "Posts and clips from listeners",
    description: "What listeners are saying: posts, shared episodes and clips from the people you follow and everyone else, with likes, comments and people to find. Post your own take, signed in with your To Duo account.",
    features: ["For you and Following feeds", "Post your take, like and comment", "Find people and follow them", "Signed in with your To Duo account"],
    pages: [
      { id: "foryou", label: "For you", icon: "Sparkles", detail: "Posts from everyone" },
      { id: "following", label: "Following", icon: "Users", detail: "People you follow" },
      { id: "people", label: "People", icon: "Search", detail: "Find people" },
    ],
    fixed: ["foryou", "following", "people"], defaults: ["foryou", "following", "people"], pickable: false,
  },
];

export const SUPER_APP_BY_ID = new Map<string, SuperApp>(SUPER_APPS.map((a) => [a.id, a]));
export const isSuperApp = (id: unknown): id is SuperAppId => typeof id === "string" && SUPER_APP_BY_ID.has(id);
export const superAppOf = (id: string): SuperApp | undefined => SUPER_APP_BY_ID.get(id);
/** Where a link to an app opens: itself, or the first part of an app that was taken apart. */
export const superAppFor = (id: string): SuperAppId | null => (isSuperApp(id) ? id : SPLIT_APPS[id]?.[0] ?? null);
/** Someone who had a combined app gets each of its parts, unless they removed that part. */
export function withSplitApps<T extends Record<string, boolean | undefined>>(sections: T): T {
  let out = sections;
  for (const [old, parts] of Object.entries(SPLIT_APPS)) {
    if (sections[old] !== true) continue;
    for (const part of parts) if (out[part] === undefined) out = { ...out, [part]: true };
  }
  return out;
}

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
  if (pod && (/^\?/.test(u) || /podster/i.test(u))) return duoAppHash("podcasts", { s: pod[1], e: pod[2] });
  return null;
}
