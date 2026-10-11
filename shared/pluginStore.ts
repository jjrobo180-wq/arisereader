// The Arise Plugin Store: everything a person can add to their Arise WorkHub or Arise LifeHub.
//
// A plugin is one of four kinds:
//  - "tab":        a WorkHub tab. Adding it switches the tab on (workspace.visibleTabs).
//  - "section":    a LifeHub section. Adding it switches the section on (family.sections).
//  - "layer":      a LifeHub calendar layer (the WorkHub calendar shown in LifeHub).
//  - "connection": a link to an outside app that is set up inside a tab (calendar feeds, Apple
//                  Reminders, email forwarding, Apple Health). It can't be "added" on its own; the
//                  store opens the place it is set up, once the tab it lives in is added.
//  - "app":        an Arise app (History, Math, Social), a paid add-on with its own page.
//
// Adding or removing a plugin only changes what shows: removing never deletes anything, so adding
// it back brings everything back. What is added is saved with the hub itself, so it syncs between
// devices like any other change. The store page is client/src/components/plugin-store/PluginStore.tsx.

import type { HubTab } from "./teacherHub";
import { isOn, type Family, type FamilySection } from "./familyHub";

export type PluginHub = "work" | "life";

export type PluginTarget =
  | { kind: "tab"; tab: HubTab }
  | { kind: "section"; section: FamilySection }
  | { kind: "layer"; layer: "hub"; opens: FamilySection }
  | { kind: "widget"; widget: "stickies"; opens: FamilySection }
  | { kind: "connection"; needs: { tab: HubTab } | { section: FamilySection } }
  | { kind: "app"; app: "history" | "math" | "social"; href: string };

export type Plugin = {
  id: string;
  hub: PluginHub;
  name: string;
  /** One line on the card. */
  tagline: string;
  /** A short paragraph on the detail page. */
  description: string;
  /** What it does, three or four short points. */
  features: string[];
  category: string;
  /** A lucide icon name, looked up in the store page. */
  icon: string;
  /** The tile colour. */
  color: string;
  target: PluginTarget;
  /** Shown first, in the big row at the top. */
  featured?: boolean;
  /** Only teachers (and admins) see it. */
  teacherOnly?: boolean;
  /** For a connection: how to set it up, shown in the store before it sends you anywhere. */
  steps?: string[];
  /** For a connection: what it needs, in one line (an iPhone, the site admin...). */
  needsNote?: string;
  /** For a connection: a CSS selector for its setup box, which Start setup scrolls to and highlights. */
  anchor?: string;
};

export const PLUGIN_CATEGORIES: Record<PluginHub, readonly string[]> = {
  work: ["Planning", "Students & IEPs", "Classroom", "Families", "Connections", "Arise apps"],
  life: ["Family", "Health & wellness", "Money & home", "Everyday", "Inspiration", "Discover", "Connections", "Arise apps"],
};

const tab = (t: HubTab): PluginTarget => ({ kind: "tab", tab: t });
const section = (s: FamilySection): PluginTarget => ({ kind: "section", section: s });

const ARISE_APPS = (hub: PluginHub): Plugin[] => [
  { id: `${hub}-app-history`, hub, name: "Arise History", tagline: "True stories and quizzes", category: "Arise apps", icon: "Landmark", color: "#b7791f",
    description: "Short true stories from history, each with a quiz. Readers earn points right next to their reading.",
    features: ["Stories at every reading level", "A quiz after each story", "Points that count toward prizes"], target: { kind: "app", app: "history", href: "/history/" } },
  { id: `${hub}-app-math`, hub, name: "Arise Math", tagline: "Practice that levels up", category: "Arise apps", icon: "Calculator", color: "#2b6cb0",
    description: "Math practice that grows with each student, from counting to algebra, with levels to climb.",
    features: ["Levels that adjust as they go", "Quick daily practice", "Points that count toward prizes"], target: { kind: "app", app: "math", href: "/math/" } },
  { id: `${hub}-app-social`, hub, name: "Arise Social", tagline: "Explore every career", category: "Arise apps", icon: "Users", color: "#6b46c1",
    description: "Students explore careers, what each job is like and the path to get there.",
    features: ["Hundreds of careers", "What a day on the job looks like", "Points that count toward prizes"], target: { kind: "app", app: "social", href: "/social/" } },
];

export const PLUGINS: readonly Plugin[] = [
  // ── Arise WorkHub ──────────────────────────────────────────────────────────
  { id: "work-calendar", hub: "work", name: "Calendar", tagline: "Your school days, meetings and events", category: "Planning", icon: "CalendarDays", color: "#0f766e", featured: true, target: tab("calendar"),
    description: "One calendar for meetings, deadlines and events, with repeating events and the calendars you already use pulled in.",
    features: ["Day, week and month views", "Repeating events", "Google, Outlook and Apple calendars", "Meetings land here when booked"] },
  { id: "work-tasks", hub: "work", name: "Tasks", tagline: "To-dos with due dates and repeats", category: "Planning", icon: "CheckSquare", color: "#0d9488", featured: true, target: tab("tasks"),
    description: "A to-do list that keeps up with school life: due dates, repeating to-dos and importance.",
    features: ["Due dates and repeats", "Mark what's important", "Undo a check-off", "Forwarded emails become to-dos"] },
  { id: "work-notes", hub: "work", name: "Notes", tagline: "Notes about students and meetings", category: "Planning", icon: "StickyNote", color: "#ca8a04", target: tab("notes"),
    description: "Keep notes by student or on their own: staff meetings, trainings, phone calls.",
    features: ["Notes by student", "Notes on their own", "Search everything"] },
  { id: "work-lessons", hub: "work", name: "Lessons", tagline: "Plan lessons by subject and group", category: "Planning", icon: "BookOpenCheck", color: "#2563eb", target: tab("lessons"),
    description: "Plan lessons with their objective, materials and the group they're for.",
    features: ["Objective and materials", "By subject and group", "Dated, so you can plan ahead"] },
  { id: "work-caseload", hub: "work", name: "Caseload", tagline: "Every student, their IEP and levels", category: "Students & IEPs", icon: "Users", color: "#7c3aed", featured: true, target: tab("caseload"),
    description: "Your students in one place: accommodations, IEP and reevaluation dates, reading and math levels, and each student's team.",
    features: ["IEP and reevaluation dates", "Accommodations and disabilities", "Each student's team", "A profile for every student"] },
  { id: "work-schedules", hub: "work", name: "Student schedules", tagline: "Who is where, and when", category: "Students & IEPs", icon: "Clock", color: "#9333ea", target: tab("schedules"),
    description: "Each student's week, so you always know where they are.",
    features: ["A week per student", "Times and places", "Fits with your minutes"] },
  { id: "work-meetings", hub: "work", name: "IEP & Meetings", tagline: "Meetings, deadlines and the ten steps", category: "Students & IEPs", icon: "Handshake", color: "#c026d3", featured: true, target: tab("iep"),
    description: "Plan every IEP meeting from first notice to signatures, with the deadline it has to beat and polls to find a time.",
    features: ["Ten-step meeting plan", "Deadline warnings", "Find a time with a poll", "Booked meetings go on your calendar"] },
  { id: "work-goals", hub: "work", name: "Goals", tagline: "Track IEP goals over time", category: "Students & IEPs", icon: "Target", color: "#db2777", target: tab("goals"),
    description: "Track each IEP goal from baseline to target with a reading every time you check.",
    features: ["Baseline and target", "A chart of progress", "Up or down goals"] },
  { id: "work-minutes", hub: "work", name: "Minutes", tagline: "Service minutes, owed and given", category: "Students & IEPs", icon: "Timer", color: "#e11d48", target: tab("minutes"),
    description: "Log service minutes in a tap and see who is behind this week, block by block.",
    features: ["One-tap logging", "Who is behind this week", "By block of the day", "Missed sessions with a reason"] },
  { id: "work-gradebook", hub: "work", name: "Gradebook", tagline: "Assignments and scores", category: "Classroom", icon: "GraduationCap", color: "#ea580c", target: tab("gradebook"),
    description: "Assignments by category with scores, missing and excused work.",
    features: ["Categories and points", "Missing and excused", "Grades at a glance"] },
  { id: "work-behavior", hub: "work", name: "Behavior", tagline: "Points for the choices that count", category: "Classroom", icon: "Smile", color: "#d97706", target: tab("behavior"),
    description: "Give and take points with a reason, and see how each student is doing.",
    features: ["Points with a reason", "A running total per student", "History by day"] },
  { id: "work-attendance", hub: "work", name: "Attendance", tagline: "Present, absent, tardy, excused", category: "Classroom", icon: "ClipboardCheck", color: "#65a30d", target: tab("attendance"),
    description: "Take attendance by class in seconds.",
    features: ["By class", "Four statuses", "History by student"] },
  { id: "work-parents", hub: "work", name: "Parents", tagline: "A log of every family contact", category: "Families", icon: "MessageCircle", color: "#0284c7", target: tab("parents"),
    description: "Keep track of every call, email and note home, and what still needs following up.",
    features: ["Every contact in one log", "Follow-up status", "By student"] },
  { id: "work-email", hub: "work", name: "Email", tagline: "Emails that need something from you", category: "Families", icon: "Mail", color: "#0369a1", target: tab("email"),
    description: "Forward emails in and keep the ones that need an answer, with a draft reply.",
    features: ["Forward emails in", "Flag what matters", "Turn an email into a to-do"] },
  { id: "work-calendar-feeds", hub: "work", name: "Google, Outlook & Apple Calendar", tagline: "Bring in the calendars you use", category: "Connections", icon: "CalendarPlus", color: "#4f46e5", target: { kind: "connection", needs: { tab: "calendar" } },
    anchor: '[data-testid="calendar-whose"]',
    steps: ["In Google Calendar, Outlook or Apple Calendar, find your calendar's private address (it may be called the iCal, ICS or secret address) and copy it.", "In WorkHub, open Calendar and add a calendar, then paste the address.", "Give it a name. To add a colleague's calendar, choose to keep only the busy times.", "Its events show up in WorkHub and stay up to date on their own."],
    needsNote: "Works with any calendar that gives you a link.",
    description: "Connect any calendar by its link and its events show up in WorkHub, kept up to date. Add a colleague's calendar to see when they're busy.",
    features: ["Google, Outlook, Apple or any calendar link", "Syncs on its own", "Colleagues' calendars, busy times only"] },
  { id: "work-apple-reminders", hub: "work", name: "Apple Reminders", tagline: "Reminders become WorkHub to-dos", category: "Connections", icon: "BellRing", color: "#475569", target: { kind: "connection", needs: { tab: "tasks" } },
    anchor: '[data-testid="apple-steps"]',
    steps: ["Open Tasks in WorkHub and find Apple Reminders at the bottom.", "Tap “Set it up (about 3 minutes)” and copy your private link.", "On your iPhone, make the Shortcut the setup shows you, using that link.", "Run it, or set it to run on its own: your reminders come in as to-dos."],
    needsNote: "Needs an iPhone. Reminders come into WorkHub only; nothing is sent back to Apple.",
    description: "Send reminders from your iPhone straight into your WorkHub to-do list.",
    features: ["From Siri or the Reminders app", "Lands in Tasks", "Set up once"] },
  { id: "work-email-forwarding", hub: "work", name: "Email forwarding", tagline: "Forward an email, get a to-do", category: "Connections", icon: "Forward", color: "#334155", target: { kind: "connection", needs: { tab: "email" } },
    anchor: '[data-testid="hub-forwarding"]',
    steps: ["Open Email in WorkHub and get your forwarding address.", "Save it as a contact in your email app so it's easy to find.", "Forward any email to it.", "It shows up in Email, ready to answer or turn into a to-do."],
    needsNote: "The site admin turns email on once for the whole site.",
    description: "Your own WorkHub address: forward any email to it and it becomes something to do.",
    features: ["Your own forwarding address", "Works from any email app", "Shows up in Email and Tasks"] },
  ...ARISE_APPS("work"),

  // ── Arise LifeHub ──────────────────────────────────────────────────────────
  { id: "life-calendar", hub: "life", name: "Family calendar", tagline: "Everyone's plans in one place", category: "Family", icon: "CalendarRange", color: "#7c6be6", featured: true, target: section("calendar"),
    description: "Shared family calendars with repeating events, and your tasks, bills, trips and chores laid on top.",
    features: ["A calendar per person or group", "Repeating events", "Tasks, bills and trips on top"] },
  { id: "life-chores", hub: "life", name: "Chores", tagline: "Chore chart, rotations and stars", category: "Family", icon: "Sparkles", color: "#f59e72", featured: true, target: section("chores"),
    description: "A chore chart that rotates on its own, with stars kids can spend on rewards.",
    features: ["Rotations by day", "Stars for every chore", "Rewards to spend them on"] },
  { id: "life-behavior", hub: "life", name: "Behavior", tagline: "Kid behavior tracker and rewards", category: "Family", icon: "Smile", color: "#e5b04f", target: section("behavior"),
    description: "Points for good choices, with rewards kids can save up for.",
    features: ["Points with a note", "A reward shop", "Counts with chore stars if you like"] },
  { id: "life-polls", hub: "life", name: "Polls", tagline: "Dinner ideas, weekend plans and votes", category: "Family", icon: "Vote", color: "#db77ac", target: section("polls"),
    description: "Let the family vote on dinner, the weekend, or anything else.",
    features: ["Dinner and weekend polls", "Anyone can add ideas", "See the winner"] },
  { id: "life-trips", hub: "life", name: "Trips", tagline: "Trip planner and packing lists", category: "Family", icon: "Plane", color: "#619ee6", target: section("trips"),
    description: "Plan the trip day by day, with costs, and a packing list for each person.",
    features: ["Day-by-day plan", "Trip budget", "Packing list per person"] },
  { id: "life-health", hub: "life", name: "Food & fitness", tagline: "Food diary, exercise, water and weight", category: "Health & wellness", icon: "Apple", color: "#5fb35b", featured: true, target: section("health"),
    description: "A food diary with calories and macros, exercise, water, steps and weight, for each adult in the family.",
    features: ["Food diary with macros", "Exercise, water and steps", "Weight over time", "Goals made for you"] },
  { id: "life-cycle", hub: "life", name: "Cycle", tagline: "Period and cycle tracker with insights", category: "Health & wellness", icon: "Droplets", color: "#e0566b", target: section("cycle"),
    description: "Track periods and symptoms, and see your next period and fertile window.",
    features: ["Predictions", "Symptoms and notes", "Daily tips"] },
  { id: "life-pills", hub: "life", name: "Pills", tagline: "Pill and vitamin reminders", category: "Health & wellness", icon: "Pill", color: "#36b6a5", target: section("pills"),
    description: "Reminders for every pill and vitamin in the family, with refill warnings.",
    features: ["Reminders by time", "Taken or skipped", "Refill warnings"] },
  { id: "life-mood", hub: "life", name: "Mood", tagline: "Daily mood check-in and patterns", category: "Health & wellness", icon: "SmilePlus", color: "#9b87f5", target: section("mood"),
    description: "A quick daily check-in and the patterns that show up over time.",
    features: ["One-tap check-in", "Tags and notes", "Patterns over time"] },
  { id: "life-money", hub: "life", name: "Budget & bills", tagline: "Bills, budget and spending", category: "Money & home", icon: "Wallet", color: "#16a34a", featured: true, target: section("money"),
    description: "Every bill with its due day, a monthly budget and where the money went.",
    features: ["Bill due dates", "Budget by category", "Spending this month"] },
  { id: "life-notes", hub: "life", name: "Notes", tagline: "Codes, contacts, lists and ideas", category: "Money & home", icon: "StickyNote", color: "#e5b04f", target: section("notes"),
    description: "Colourful notes for the things you keep looking up: codes, contacts, lists and ideas.",
    features: ["Pin what matters", "Colours", "Search"] },
  { id: "life-goals", hub: "life", name: "Goals", tagline: "Personal and family goals", category: "Everyday", icon: "Target", color: "#7566e8", target: section("goals"),
    description: "Personal and family goals with progress you can see.",
    features: ["Goals by area of life", "Progress bars", "Family goals too"] },
  { id: "life-news", hub: "life", name: "News", tagline: "Today's headlines and local news", category: "Everyday", icon: "Newspaper", color: "#64748b", target: section("news"),
    description: "Today's headlines on the topics you pick, and news from where you live.",
    features: ["Pick your topics", "Local news", "Fresh every day"] },
  { id: "life-journal", hub: "life", name: "Journal", tagline: "A daily journal with prompts", category: "Everyday", icon: "NotebookPen", color: "#8b5cf6", featured: true, target: section("journal"),
    description: "Write a few lines a day, with a fresh prompt when you don't know where to start. Add a mood, search old entries, and look back on how far you've come.",
    features: ["A new prompt every day", "Mood for each entry", "Search past entries", "Saved to your account"] },
  { id: "life-countdowns", hub: "life", name: "Countdowns", tagline: "Days until the big days", category: "Everyday", icon: "Hourglass", color: "#f97316", target: section("countdowns"),
    description: "Count down to birthdays, trips, holidays and the last day of school, with big friendly numbers the whole family can watch go down.",
    features: ["Days and weeks to go", "An emoji for each one", "Past ones tucked away"] },
  { id: "life-grocery", hub: "life", name: "Grocery list", tagline: "A shopping list sorted by aisle", category: "Money & home", icon: "ShoppingCart", color: "#22c55e", featured: true, target: section("grocery"),
    description: "Type what you need and it sorts itself by aisle, so you're not running back across the store. Check things off as they go in the cart.",
    features: ["Sorts itself by aisle", "Add many at once with commas", "Check off as you shop", "Copy the list to text someone"] },
  { id: "life-meditate", hub: "life", name: "Meditate", tagline: "Guided breathing and a quiet timer", category: "Health & wellness", icon: "Wind", color: "#0ea5e9", featured: true, target: section("meditate"),
    description: "Follow a breathing circle (calm breath, box breathing or 4-7-8), or sit quietly until a soft bell. Your minutes and streak are kept.",
    features: ["Three guided breathing patterns", "A quiet timer with a bell", "1 to 20 minutes", "Streak and weekly minutes"] },
  { id: "life-bible", hub: "life", name: "Bible", tagline: "Verse of the day and any passage", category: "Inspiration", icon: "BookMarked", color: "#b45309", target: section("bible"),
    description: "A new verse every day, look up and read any passage, and save the verses that matter to you. King James Version.",
    features: ["Verse of the day", "Read any passage", "Save your favorite verses", "King James Version"] },
  { id: "life-quotes", hub: "life", name: "Daily quote", tagline: "A motivational quote every day", category: "Inspiration", icon: "Quote", color: "#6366f1", target: section("quotes"),
    description: "Start each day with a quote worth thinking about. Shuffle for another, and save the ones that stick.",
    features: ["A new quote every day", "Shuffle for more", "Save your favorites"] },
  { id: "life-history", hub: "life", name: "Today in history", tagline: "What happened on this day", category: "Discover", icon: "History", color: "#a16207", target: section("history"),
    description: "What happened on this day over the years, who was born, and the day's observances. Pick any day to look back. From Wikipedia.",
    features: ["Highlights and events", "Born on this day", "Pick any day", "Links to read more"] },
  { id: "life-trending", hub: "life", name: "What's trending", tagline: "Top searches and most-read stories", category: "Discover", icon: "TrendingUp", color: "#e11d48", target: section("trending"),
    description: "See what people across the United States are searching for right now, with the news behind it, and the stories everyone is reading.",
    features: ["Top searches right now", "The news behind each one", "Most-read stories"] },
  { id: "life-stickies", hub: "life", name: "Sticky notes", tagline: "Notes you can put anywhere on Home", category: "Everyday", icon: "StickyNote", color: "#eab308", featured: true,
    target: { kind: "widget", widget: "stickies", opens: "home" },
    description: "Stick colorful notes anywhere on your LifeHub Home screen. Drag them where you want them, change the color, and they stay put on every device.",
    features: ["Put them anywhere on Home", "Drag to move", "Six colors", "Saved to your account"] },
  { id: "life-randomizer", hub: "life", name: "Randomizer", tagline: "Pick from a list, flip a coin, roll dice", category: "Everyday", icon: "Shuffle", color: "#14b8a6", target: section("randomizer"),
    description: "Settle it fairly: pick a name or a dinner from a list, flip a coin, roll dice or pick a number. Save lists you use often.",
    features: ["Pick from a list", "Coin flip and dice", "Random number", "Save your lists"] },
  { id: "life-relationships", hub: "life", name: "Relationships", tagline: "Tips, conversation starters and date ideas", category: "Family", icon: "HeartHandshake", color: "#f43f5e", target: section("relationships"),
    description: "A practical relationship tip every day, tips by topic (talking, disagreements, appreciation, romance, trust, teamwork), conversation starters and date ideas.",
    features: ["A tip every day", "Tips by topic", "Conversation starters", "Date ideas for any budget"] },
  { id: "life-dictionary", hub: "life", name: "Dictionary", tagline: "Look up any word, plus a word a day", category: "Discover", icon: "BookOpenText", color: "#0891b2", target: section("dictionary"),
    description: "Definitions, pronunciation, examples and similar words for any English word, a new word every day, and a list of words you want to remember.",
    features: ["Any English word", "Hear it said", "Word of the day", "Save your words"] },
  { id: "life-links", hub: "life", name: "Link page", tagline: "All your links on one shareable page", category: "Everyday", icon: "Link2", color: "#7c3aed", target: section("links"),
    description: "Like a link tree: put your socials, shop, calendar or favorite sites on one tidy page, and share it with a single link anyone can open.",
    features: ["Your links as big buttons", "A name and a short bio", "Reorder any time", "Share with one link"] },
  { id: "life-workhub-calendar", hub: "life", name: "WorkHub calendar", tagline: "Your work calendar inside LifeHub", category: "Connections", icon: "Briefcase", color: "#0f766e", teacherOnly: true,
    target: { kind: "layer", layer: "hub", opens: "calendar" },
    description: "See your Arise WorkHub calendar on your family calendar, read live, so work and home never double-book.",
    features: ["Read live from WorkHub", "Nothing is copied", "Turn it off any time"] },
  { id: "life-apple-health", hub: "life", name: "Apple Health", tagline: "Steps, workouts and weight from your iPhone", category: "Connections", icon: "HeartPulse", color: "#e11d48", target: { kind: "connection", needs: { section: "health" } },
    anchor: '[data-plugin-anchor="apple-health"]',
    steps: ["Open Food & fitness in LifeHub and pick the person to connect.", "Tap “Connect Apple Health”. You'll get a private link and an iPhone Shortcut.", "On your iPhone, add the Shortcut and let it read your Health data.", "Steps, active calories and weight come in every day on their own."],
    needsNote: "Needs an iPhone (or Apple Watch). Connect each adult separately.",
    description: "Bring steps, workouts and weight in from Apple Health, so Food & fitness fills itself in.",
    features: ["Steps and workouts", "Weight", "Set up once per person"] },
  { id: "life-email-forward", hub: "life", name: "Email forwarding", tagline: "Forward an email, get a task", category: "Connections", icon: "Forward", color: "#334155", target: { kind: "connection", needs: { section: "tasks" } },
    anchor: '[data-plugin-anchor="email-forward"]',
    steps: ["Open Tasks in LifeHub and find “Forward emails here”.", "Tap “Get my forwarding address”.", "Add the email addresses you'll forward from, so strangers can't send you tasks.", "Forward any email (a bill, a flyer, an appointment) and it becomes a task in your Email list."],
    needsNote: "The site admin turns email on once for the whole site.",
    description: "Your own LifeHub address: forward any email to it and it becomes a task.",
    features: ["Your own forwarding address", "Works from any email app", "Lands in Tasks"] },
  ...ARISE_APPS("life"),
];

/** The plugins one person sees in one hub. */
export function pluginsFor(hub: PluginHub, opts: { teacher: boolean }): Plugin[] {
  return PLUGINS.filter((p) => p.hub === hub && (!p.teacherOnly || opts.teacher));
}

/** Plugins that can be added and removed from the store (the rest open somewhere instead). */
export const isAddable = (p: Plugin) => p.target.kind === "tab" || p.target.kind === "section" || p.target.kind === "layer" || p.target.kind === "widget";

/** Where a plugin opens in its hub: a WorkHub tab or a LifeHub section. null for an Arise app. */
export function pluginOpens(p: Plugin): { tab: HubTab } | { section: FamilySection } | null {
  const t = p.target;
  if (t.kind === "tab") return { tab: t.tab };
  if (t.kind === "section") return { section: t.section };
  if (t.kind === "layer" || t.kind === "widget") return { section: t.opens };
  if (t.kind === "connection") return t.needs;
  return null;
}

// ── WorkHub ────────────────────────────────────────────────────────────────

/** Is this WorkHub plugin on? A tab is on unless it was switched off. */
export function workInstalled(p: Plugin, visibleTabs: Partial<Record<HubTab, boolean>>): boolean {
  const t = p.target;
  if (t.kind === "tab") return visibleTabs[t.tab] !== false;
  if (t.kind === "connection" && "tab" in t.needs) return visibleTabs[t.needs.tab] !== false;
  return false;
}

/** The WorkHub's tab switches with this plugin added or removed. Nothing else changes. */
export function setWorkPlugin<V extends Partial<Record<HubTab, boolean>>>(visibleTabs: V, p: Plugin, on: boolean): V {
  if (p.target.kind !== "tab") return visibleTabs;
  return { ...visibleTabs, [p.target.tab]: on };
}

// ── LifeHub ────────────────────────────────────────────────────────────────

/** Is this LifeHub plugin on? A section is on unless it was switched off. */
export function lifeInstalled(p: Plugin, family: Pick<Family, "sections" | "layers"> & Partial<Pick<Family, "widgets">>): boolean {
  const t = p.target;
  const sectionOn = (s: FamilySection) => isOn(s, family);
  if (t.kind === "section") return sectionOn(t.section);
  if (t.kind === "layer") return !!family.layers?.[t.layer];
  if (t.kind === "widget") return !!family.widgets?.[t.widget];
  if (t.kind === "connection" && "section" in t.needs) return sectionOn(t.needs.section);
  return false;
}

/** The family with this plugin added or removed. Adding the WorkHub calendar also adds the Calendar section it shows in. */
export function setLifePlugin<F extends Pick<Family, "sections" | "layers"> & Partial<Pick<Family, "widgets">>>(family: F, p: Plugin, on: boolean): F {
  const t = p.target;
  if (t.kind === "widget") return { ...family, widgets: { ...(family.widgets ?? { stickies: false }), [t.widget]: on } };
  if (t.kind === "section") return { ...family, sections: { ...family.sections, [t.section]: on } };
  if (t.kind === "layer") {
    const next = { ...family, layers: { ...family.layers, [t.layer]: on } };
    return on ? { ...next, sections: { ...next.sections, [t.opens]: true } } : next;
  }
  return family;
}

/** A connection whose tab or section isn't added yet: the plugin to add first. */
export function connectionNeeds(p: Plugin): Plugin | null {
  const t = p.target;
  if (t.kind !== "connection") return null;
  return PLUGINS.find((q) => q.hub === p.hub && (
    ("tab" in t.needs && q.target.kind === "tab" && q.target.tab === t.needs.tab) ||
    ("section" in t.needs && q.target.kind === "section" && q.target.section === t.needs.section))) ?? null;
}

/** Search by name, tagline, category and features. */
export function searchPlugins(list: readonly Plugin[], query: string): Plugin[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...list];
  return list.filter((p) => {
    const text = [p.name, p.tagline, p.category, p.description, ...p.features].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** The session-storage key that opens the store when a hub loads (used to switch hubs from inside the store). */
export const OPEN_STORE_KEY = "arise_plugin_store";
