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
import { KIT_DEFS, type KitDef } from "./pluginKit";
import { showSection } from "./hubLayout";
import { cleanLifeLayout } from "./lifeLayout";

export type PluginHub = "work" | "life";

export type PluginTarget =
  | { kind: "tab"; tab: HubTab }
  | { kind: "section"; section: FamilySection }
  | { kind: "layer"; layer: "hub"; opens: FamilySection }
  /** Something added to Home: LifeHub's sticky notes, or the Widgets board (in both hubs). */
  | { kind: "widget"; widget: "stickies" | "board"; opens: FamilySection }
  /** A WorkHub Plugin Kit plugin: added to workspace.kitInstalled and opened from the store. */
  | { kind: "kit"; id: string }
  /** The Notes app, installed into a hub it isn't built into: added to workspace.notesInstalled or
   *  family.notesInstalled and opened from the store. Its notes are separate from the hub's own. */
  | { kind: "notesApp"; id: string; label: string }
  /** The Sheets app (shared/sheetsApp.ts): added to family.sheetsInstalled, opened from the store. */
  | { kind: "sheetsApp"; id: string; label: string }
  /** The Drive app (shared/driveApp.ts): added to family.driveInstalled, opened from the store. */
  | { kind: "driveApp" }
  /** The Drop app (shared/dropApp.ts): added to family.dropInstalled, opened from the store. */
  | { kind: "dropApp" }
  | { kind: "connection"; needs: { tab: HubTab } | { section: FamilySection } }
  /** The AI assistant: a chat button on every page of the hub. */
  | { kind: "assistant" }
  /** Arise AI Pro: the premium, metered assistant ($10/mo, see shared/plans.ts's "ai_pro" kind and
   *  shared/aiProApp.ts's usage cap). A paid add-on like the Arise apps below, not a toggle. */
  | { kind: "assistantPro" }
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
  /** A paid add-on, billed on its own instead of being part of a plan. Shown as a price badge on its
   *  tile and card; "Add" sends to Billing to subscribe instead of switching the plugin on directly.
   *  $ is per month, per hub (one subscription covers everyone in that WorkHub or LifeHub). */
  premium?: { priceMonthly: number; note?: string };
};

export const PLUGIN_CATEGORIES: Record<PluginHub, readonly string[]> = {
  work: ["Premium", "Planning", "Students & IEPs", "Classroom", "Families", "Teaching tools", "Checklists", "Ideas", "Wellness", "Connections", "Arise apps"],
  life: ["Premium", "Family", "Kitchen", "Health & wellness", "Money & home", "Everyday", "Checklists", "Fun", "Tools", "Inspiration", "Discover", "Connections", "Arise apps"],
};

const tab = (t: HubTab): PluginTarget => ({ kind: "tab", tab: t });

/** A Plugin Kit definition as a store plugin. LifeHub ones are sections; WorkHub ones open from the store. */
function kitPlugin(d: KitDef): Plugin {
  return {
    id: `${d.hub}-kit-${d.id}`, hub: d.hub, name: d.name, tagline: d.tagline, description: d.description, features: d.features,
    category: d.category, icon: d.icon, color: d.color, featured: d.featured,
    target: d.hub === "life" ? { kind: "section", section: d.id as FamilySection } : { kind: "kit", id: d.id },
  };
}
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

const WIDGETS_PLUGIN = (hub: PluginHub): Plugin => ({
  id: `${hub}-widgets`, hub, name: "Widgets", tagline: "Clocks, calendars, countdowns and fun widgets for Home", category: hub === "work" ? "Teaching tools" : "Tools",
  icon: "AlarmClock", color: "#6d28d9", featured: true, target: { kind: "widget", widget: "board", opens: "home" },
  description: hub === "work"
    ? "Put live widgets on your WorkHub Home: a flip clock, a next-bell countdown, the school day's progress, a month calendar, a timer, world clocks and more. Pick from 34 widgets in 11 themes, from serious to silly, in three sizes."
    : "Put live widgets on your LifeHub Home: clocks of every kind, calendars, countdowns to trips and birthdays, the moon tonight, dice, a coin flip and more. Pick from 34 widgets in 11 themes, from serious to silly, in three sizes.",
  features: ["34 widgets: clocks, calendars, countdowns, fun and focus", "11 themes, from Classic and Paper to Neon and Terminal", "Small, wide or large", "Saved to your account on every device"],
});

export const PLUGINS: readonly Plugin[] = [
  // ── Arise WorkHub ──────────────────────────────────────────────────────────
  { id: "work-assistant-pro", hub: "work", name: "Arise AI Pro", tagline: "The premium AI assistant: more context, longer answers", category: "Premium", icon: "Sparkles", color: "#9333ea", featured: true, teacherOnly: true,
    premium: { priceMonthly: 10, note: "500 messages a month included" },
    description: "The same chat button, with real headroom: longer answers, more conversation history, and help with multi-step work — a full unit plan across several lessons, a detailed IEP goal with accommodations, a staff email that needs real nuance.",
    features: ["Longer, more detailed answers", "Remembers more of the conversation", "500 messages a month", "Priced to stay fast even at busy times"], target: { kind: "assistantPro" } },
  WIDGETS_PLUGIN("work"),
  { id: "work-assistant", hub: "work", name: "AI assistant", tagline: "Chat with AI about lessons, IEPs, emails and more", category: "Teaching tools", icon: "Sparkles", color: "#0f766e", featured: true, teacherOnly: true,
    description: "A chat button on every page of WorkHub. Ask for lesson ideas, help wording an IEP goal or accommodation, a parent email draft, or a quick explanation, and get a clear answer right away.",
    features: ["A chat button on every page", "Quick ideas to start with", "Copy any answer in one tap", "Free, with no monthly cap"], target: { kind: "assistant" } },
  { id: "work-calendar", hub: "work", name: "Calendar", tagline: "Your school days, meetings and events", category: "Planning", icon: "CalendarDays", color: "#0f766e", featured: true, target: tab("calendar"),
    description: "One calendar for meetings, deadlines and events, with repeating events and the calendars you already use pulled in.",
    features: ["Day, week and month views", "Repeating events", "Google, Outlook and Apple calendars", "Meetings land here when booked"] },
  { id: "work-tasks", hub: "work", name: "Tasks", tagline: "To-dos with due dates and repeats", category: "Planning", icon: "CheckSquare", color: "#0d9488", featured: true, target: tab("tasks"),
    description: "A to-do list that keeps up with school life: due dates, repeating to-dos and importance.",
    features: ["Due dates and repeats", "Mark what's important", "Undo a check-off", "Forwarded emails become to-dos"] },
  { id: "work-notes", hub: "work", name: "Work Notes", tagline: "Notes about students and meetings", category: "Planning", icon: "StickyNote", color: "#ca8a04", target: tab("notes"),
    description: "Keep notes by student or on their own: staff meetings, trainings, phone calls.",
    features: ["Notes by student", "Notes on their own", "Search everything"] },
  { id: "work-lifehub-notes", hub: "work", name: "LifeHub Notes", tagline: "Quick pinnable notes, the LifeHub way", category: "Planning", icon: "StickyNote", color: "#e5b04f", target: { kind: "notesApp", id: "work-lifehub-notes", label: "LifeHub Notes" },
    description: "The same simple, colorful note cards LifeHub users keep for codes, lists and ideas — now in WorkHub too. A separate set of notes from Work Notes, just for the quick stuff you'd normally jot on a sticky note.",
    features: ["Color-coded note cards", "Pin your most-used notes to the top", "Search across every note", "Its own notes, separate from Work Notes"] },
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
  { id: "life-assistant-pro", hub: "life", name: "Arise AI Pro", tagline: "The premium AI assistant: more context, longer answers", category: "Premium", icon: "Sparkles", color: "#9333ea", featured: true,
    premium: { priceMonthly: 10, note: "500 messages a month included" },
    description: "The same chat button, with real headroom: longer answers, more conversation history, and help with multi-step planning — a week of meals and the grocery list in one go, a detailed budget walkthrough, a family trip planned day by day.",
    features: ["Longer, more detailed answers", "Remembers more of the conversation", "500 messages a month", "Priced to stay fast even at busy times"], target: { kind: "assistantPro" } },
  { id: "life-drive", hub: "life", name: "Drive", tagline: "Upload photos from your camera roll", category: "Premium", icon: "FolderOpen", color: "#2563eb", featured: true,
    description: "A simple photo drive for the family: upload pictures straight from a phone's camera roll or a computer, browse them in one place, and share what you need. 500MB free, with paid storage tiers for more room.",
    features: ["Upload from camera roll or files", "500MB free storage", "More space in Billing when you need it", "Private to your hub"], target: { kind: "driveApp" } },
  { id: "life-sheets", hub: "life", name: "Sheets", tagline: "A simple spreadsheet, right in LifeHub", category: "Premium", icon: "Table", color: "#16a34a", featured: true,
    description: "A real spreadsheet for budgets, packing lists or anything with rows and columns: text or number cells, and formulas like SUM, AVERAGE and basic math between cells. No external app, no export needed.",
    features: ["A real grid: up to 60 rows, 18 columns", "SUM, AVERAGE, MIN, MAX, COUNT and +-*/", "Save as many sheets as you like", "Saved to your account on every device"], target: { kind: "sheetsApp", id: "life-sheets", label: "Sheets" } },
  { id: "life-drop", hub: "life", name: "Drop", tagline: "Send a file to another device, AirDrop-style", category: "Premium", icon: "QrCode", color: "#db2777", featured: true,
    description: "Send a file from this device to another with a 6-character code, a QR code to scan, or a link — whichever's easiest. No account needed on the receiving end. Files stay for one hour and can be picked up as many times as you need, up to 200MB each.",
    features: ["Code, QR, or link — receiver picks what's easiest", "No sign-in needed to receive", "Up to 200MB per file", "Stays an hour — download it as often as you need"], target: { kind: "dropApp" } },
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
  { id: "life-notes", hub: "life", name: "LifeHub Notes", tagline: "Codes, contacts, lists and ideas", category: "Money & home", icon: "StickyNote", color: "#e5b04f", target: section("notes"),
    description: "Colourful notes for the things you keep looking up: codes, contacts, lists and ideas.",
    features: ["Pin what matters", "Colours", "Search"] },
  { id: "life-work-notes", hub: "life", name: "Work Notes", tagline: "A second, separate set of notes", category: "Money & home", icon: "StickyNote", color: "#ca8a04", target: { kind: "notesApp", id: "life-work-notes", label: "Work Notes" },
    description: "The same note-card feature as LifeHub Notes, as a second, separate app. Handy if you want to keep work-related notes apart from everything else in LifeHub Notes.",
    features: ["Color-coded note cards", "Pin your most-used notes to the top", "Search across every note", "Its own notes, separate from LifeHub Notes"] },
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
  { id: "life-assistant", hub: "life", name: "AI assistant", tagline: "Chat with AI about meals, plans, homework and more", category: "Tools", icon: "Sparkles", color: "#7968e5", featured: true,
    description: "A chat button on every page of LifeHub. Ask for dinner ideas, a weekend plan, help with a hard email or a kid's homework question, and get a clear answer right away.",
    features: ["A chat button on every page", "Quick ideas to start with", "Copy any answer in one tap", "Your chat stays on this device"], target: { kind: "assistant" } },
  WIDGETS_PLUGIN("life"),
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
  { id: "life-habits", hub: "life", name: "Habits", tagline: "Build habits, one day at a time", category: "Health & wellness", icon: "Repeat", color: "#8b5cf6", featured: true, target: section("habits"),
    description: "Tap off each habit every day, see your week at a glance, and grow a streak.",
    features: ["Check off in one tap", "See the whole week", "Streaks for every habit", "Quick-add ideas"] },
  { id: "life-gratitude", hub: "life", name: "Gratitude", tagline: "Three good things a day", category: "Health & wellness", icon: "Heart", color: "#f43f5e", target: section("gratitude"),
    description: "Write three things you're thankful for each day, build a streak, and look back on good memories.",
    features: ["Three prompts a day", "A gratitude streak", "Random good memory", "Looking back"] },
  { id: "life-focus", hub: "life", name: "Focus timer", tagline: "Focus blocks with short breaks", category: "Everyday", icon: "Timer", color: "#6366f1", target: section("focus"),
    description: "Work in focused blocks (25, 50 or 15 minutes) with short breaks between, with a chime at each switch.",
    features: ["Three rhythms", "A chime when it's time to switch", "Minutes focused today and this week"] },
  { id: "life-bucket", hub: "life", name: "Bucket list", tagline: "The things you want to do someday", category: "Everyday", icon: "Mountain", color: "#0ea5e9", target: section("bucket"),
    description: "Places, adventures and goals you want to get to. Plan them, then check them off as life happens.",
    features: ["Someday, planned and done", "A category for each", "The date you did it"] },
  { id: "life-recipes", hub: "life", name: "Recipe box", tagline: "Recipes with one-tap shopping", category: "Kitchen", icon: "ChefHat", color: "#f97316", featured: true, target: section("recipes"),
    description: "Keep the family's recipes in one place, searchable, with one tap to put the ingredients on your Grocery list.",
    features: ["Ingredients and steps", "Search and tags", "Send ingredients to the Grocery list", "Time and servings"] },
  { id: "life-meals", hub: "life", name: "Meal planner", tagline: "Plan the week's meals", category: "Kitchen", icon: "UtensilsCrossed", color: "#ea580c", featured: true, target: section("meals"),
    description: "Plan breakfast, lunch and dinner for the week, pick from your Recipe box, and shop for the whole week in one tap.",
    features: ["The whole week at a glance", "Pick from your recipes", "Shop the week in one tap"] },
  { id: "life-upkeep", hub: "life", name: "Home upkeep", tagline: "Never forget the filter again", category: "Money & home", icon: "Wrench", color: "#64748b", target: section("upkeep"),
    description: "Filters, smoke alarms, gutters and more, each with its own schedule. See what's due and check it off.",
    features: ["A dozen common jobs ready to add", "Shows what's due and overdue", "Your own schedule for each"] },
  { id: "life-plants", hub: "life", name: "Plant care", tagline: "Watering reminders for every plant", category: "Money & home", icon: "Flower2", color: "#16a34a", target: section("plants"),
    description: "Give each plant its own watering and feeding schedule, and see which ones are thirsty today.",
    features: ["A schedule per plant", "Water, feed, mist, repot", "Shows who's thirsty"] },
  { id: "life-birthdays", hub: "life", name: "Birthdays", tagline: "Never miss a birthday", category: "Family", icon: "Cake", color: "#ec4899", featured: true, target: section("birthdays"),
    description: "Birthdays and anniversaries soonest first, with how old someone's turning or which anniversary it is.",
    features: ["Soonest first", "How old they're turning", "Anniversaries too"] },
  { id: "life-gifts", hub: "life", name: "Gift ideas", tagline: "Gift ideas, all year round", category: "Family", icon: "Gift", color: "#db2777", target: section("gifts"),
    description: "Jot down gift ideas all year so the holidays are easy. Track who it's for, the price, and what's bought and given.",
    features: ["Who it's for", "Price and link", "Idea, bought, given", "What you've spent"] },
  { id: "life-pets", hub: "life", name: "Pet care", tagline: "Medicine, vet and grooming reminders", category: "Family", icon: "PawPrint", color: "#b45309", target: section("pets"),
    description: "Flea medicine, vet visits, grooming and food for every pet, each on its own schedule.",
    features: ["A schedule per pet", "Common care ready to add", "Shows what's due"] },
  { id: "life-contacts", hub: "life", name: "Important contacts", tagline: "The numbers you need, one tap away", category: "Family", icon: "Phone", color: "#0d9488", target: section("contacts"),
    description: "Doctors, school, babysitters, the plumber. Tap to call or email, and star emergency contacts to keep them on top.",
    features: ["Tap to call or email", "Star emergency contacts", "Notes for each"] },
  { id: "life-subscriptions", hub: "life", name: "Subscriptions", tagline: "See what subscriptions really cost", category: "Money & home", icon: "CreditCard", color: "#7c3aed", featured: true, target: section("subscriptions"),
    description: "Every subscription in one list, with the real monthly and yearly cost and which ones renew this week.",
    features: ["Monthly and yearly totals", "Renewing this week", "Weekly, monthly or yearly"] },
  { id: "life-jars", hub: "life", name: "Savings jars", tagline: "Watch your savings fill up", category: "Money & home", icon: "PiggyBank", color: "#16a34a", target: section("jars"),
    description: "Give each savings goal its own jar, add money as you save, and watch it fill.",
    features: ["A jar per goal", "Progress toward each", "Total saved"] },
  { id: "life-tips", hub: "life", name: "Tip & split", tagline: "Tip and split the bill", category: "Money & home", icon: "Calculator", color: "#0891b2", target: section("tips"),
    description: "Work out the tip and split the bill evenly, with an option to round each share up.",
    features: ["Quick tip buttons", "Split between anyone", "Round up each share"] },
  { id: "life-reading", hub: "life", name: "Reading list", tagline: "Books to read, reading and read", category: "Discover", icon: "BookOpen", color: "#9333ea", target: section("reading"),
    description: "Keep track of the books you want to read, what you're reading now, and how you rated them.",
    features: ["Want to read, reading, read", "Star ratings", "When you finished"] },
  { id: "life-watchlist", hub: "life", name: "Watchlist", tagline: "Movies and shows to watch", category: "Discover", icon: "Tv", color: "#dc2626", target: section("watchlist"),
    description: "Movies and shows to watch, what you're in the middle of, and how you'd rate them.",
    features: ["To watch, watching, watched", "Star ratings", "Where to watch"] },
  { id: "life-weather", hub: "life", name: "Weather", tagline: "Now and the next 7 days", category: "Everyday", icon: "CloudSun", color: "#0284c7", featured: true, target: section("weather"),
    description: "The weather right now and the week ahead for your town, in \u00b0F or \u00b0C.",
    features: ["Right now", "7-day forecast", "Chance of rain", "\u00b0F or \u00b0C"] },
  { id: "life-convert", hub: "life", name: "Unit converter", tagline: "Cups, miles, pounds and degrees", category: "Everyday", icon: "ArrowLeftRight", color: "#4f46e5", target: section("convert"),
    description: "Convert cooking measures, length, weight, temperature, speed and area, with the handy ones a tap away.",
    features: ["Cooking measures", "Oven temperatures", "Length, weight, speed, area"] },
  { id: "life-car", hub: "life", name: "Car care", tagline: "Oil changes, tires and registration", category: "Money & home", icon: "Car", color: "#475569", target: section("car"),
    description: "Oil changes, tire rotations, registration and more for every car in the family, each on its own schedule.",
    features: ["A schedule per car", "Common service ready to add", "Shows what's due"] },
  { id: "life-wishlist", hub: "life", name: "Wishlist", tagline: "Things you'd love", category: "Everyday", icon: "Heart", color: "#e11d48", target: section("wishlist"),
    description: "A wishlist with prices and links, ready whenever someone asks what you want. Track what you're saving for and what you got.",
    features: ["Prices and links", "Want, saving up, got it", "What you've spent"] },
  { id: "life-restaurants", hub: "life", name: "Restaurants", tagline: "Places to try, and how they rated", category: "Kitchen", icon: "Utensils", color: "#f97316", target: section("restaurants"),
    description: "Keep a list of restaurants you want to try, and star the ones you've been to.",
    features: ["Want to try and tried", "Star ratings", "Links to menus"] },
  { id: "life-learning", hub: "life", name: "Learning goals", tagline: "Skills you want to learn", category: "Everyday", icon: "GraduationCap", color: "#2563eb", target: section("learning"),
    description: "Skills and subjects you want to learn, what you're working on now, and what you've mastered.",
    features: ["Want to learn, learning, learned", "How you're learning it", "Links to courses"] },
  { id: "life-projects", hub: "life", name: "Home projects", tagline: "Repairs, upgrades and DIY ideas", category: "Money & home", icon: "Hammer", color: "#b45309", target: section("projects"),
    description: "Keep the house project list in one place: ideas, what's in progress, what's done, and what each might cost.",
    features: ["Ideas, in progress, done", "By room", "Estimated cost"] },
  { id: "life-loans", hub: "life", name: "Lent items", tagline: "Who has my stuff?", category: "Family", icon: "Handshake", color: "#0d9488", target: section("loans"),
    description: "Keep track of what you lent and to whom, so the drill and the good casserole dish find their way home.",
    features: ["What and who", "Lent out and returned", "When it came back"] },
  { id: "life-cleaning", hub: "life", name: "Cleaning schedule", tagline: "A tidy house, a little at a time", category: "Money & home", icon: "Sparkles", color: "#06b6d4", featured: true, target: section("cleaning"),
    description: "Spread the cleaning out: each job by room, on its own schedule. See what's due today and check it off.",
    features: ["A dozen common jobs ready to add", "By room", "Shows what's due today"] },
  { id: "life-checkups", hub: "life", name: "Health checkups", tagline: "Who's due for the dentist?", category: "Health & wellness", icon: "Stethoscope", color: "#e11d48", target: section("checkups"),
    description: "Physicals, dental cleanings, eye exams and shots for each person, with who's due next.",
    features: ["A schedule per person", "Common checkups ready to add", "Shows who's due"] },
  { id: "life-sleep", hub: "life", name: "Sleep log", tagline: "See how you're sleeping", category: "Health & wellness", icon: "Moon", color: "#6366f1", featured: true, target: section("sleep"),
    description: "Log when you went to bed and woke up, and how it felt. See two weeks as a chart and your weekly average.",
    features: ["Hours each night", "Two-week chart", "Weekly average", "How you slept"] },
  { id: "life-workouts", hub: "life", name: "Workout log", tagline: "Sets, reps and personal bests", category: "Health & wellness", icon: "Dumbbell", color: "#ef4444", target: section("workouts"),
    description: "Log sets, reps and weight for each exercise, see your history, and celebrate new personal bests.",
    features: ["Sets, reps and weight", "Personal bests", "History by day"] },
  { id: "life-routines", hub: "life", name: "Routines", tagline: "Checklists that start fresh each day", category: "Family", icon: "ListChecks", color: "#10b981", featured: true, target: section("routines"),
    description: "Morning, bedtime and after-school checklists that reset every day. Great for getting kids out the door.",
    features: ["Starts fresh every day", "Ready-made routines", "Progress bar", "Your own steps"] },
  { id: "life-milestones", hub: "life", name: "Milestones", tagline: "A timeline of the big little moments", category: "Family", icon: "Star", color: "#f59e0b", target: section("milestones"),
    description: "First words, first steps, first day of school. Save the moments with the date and the story.",
    features: ["A timeline by year", "For each person", "The story behind it"] },
  { id: "life-ious", hub: "life", name: "IOUs", tagline: "Who owes who", category: "Money & home", icon: "HandCoins", color: "#059669", target: section("ious"),
    description: "Keep track of money between you and friends: who owes you, who you owe, and settling up.",
    features: ["Owed to you and you owe", "By person", "Settle up in one tap"] },
  { id: "life-allowance", hub: "life", name: "Allowance", tagline: "Kids' allowance and savings", category: "Family", icon: "Coins", color: "#ca8a04", target: section("allowance"),
    description: "Track each kid's allowance, chore money and spending, and watch their balance grow.",
    features: ["A balance per kid", "Money in and spent", "History"] },
  { id: "life-giftcards", hub: "life", name: "Gift cards", tagline: "Never waste a gift card", category: "Money & home", icon: "CreditCard", color: "#8b5cf6", target: section("giftcards"),
    description: "Track what's left on each gift card and when it expires, so none go to waste.",
    features: ["Balance on each card", "Expiry warnings", "Total across cards"] },
  { id: "life-warranties", hub: "life", name: "Warranties", tagline: "Is it still under warranty?", category: "Money & home", icon: "ShieldCheck", color: "#16a34a", target: section("warranties"),
    description: "Log big purchases and their warranties, so when something breaks you know right away if it's covered.",
    features: ["Covered until when", "Where you bought it", "Expiring soon"] },
  { id: "life-mileage", hub: "life", name: "Mileage log", tagline: "Track miles for taxes", category: "Money & home", icon: "Gauge", color: "#475569", target: section("mileage"),
    description: "Log business, medical or volunteer miles as you go, see the year's total and what it's worth, and copy it to a spreadsheet.",
    features: ["Miles by trip", "Yearly total", "Your per-mile rate", "Copy to a spreadsheet"] },
  { id: "life-mortgage", hub: "life", name: "Loan calculator", tagline: "Monthly payment and interest", category: "Money & home", icon: "Landmark", color: "#1d4ed8", target: section("mortgage"),
    description: "See the monthly payment and total interest for a car, home or student loan, and what paying a little extra saves.",
    features: ["Monthly payment", "Total interest", "What extra payments save"] },
  { id: "life-clocks", hub: "life", name: "World clock", tagline: "What time is it there?", category: "Everyday", icon: "Globe", color: "#0ea5e9", target: section("clocks"),
    description: "Keep the time where family and friends live, and see whether it's a good time to call.",
    features: ["Up to 12 cities", "Hours ahead or behind", "Good time to call?"] },
  { id: "life-timers", hub: "life", name: "Kitchen timers", tagline: "Run several timers at once", category: "Kitchen", icon: "Timer", color: "#f43f5e", target: section("timers"),
    description: "Run as many named timers as you need at once (pasta, oven, laundry), each with an alarm when it's done.",
    features: ["Many timers at once", "Quick presets", "Alarm and vibration"] },
  { id: "life-medical", hub: "life", name: "Medical info", tagline: "Health cards for the whole family", category: "Health & wellness", icon: "HeartPulse", color: "#dc2626", target: section("medical"),
    description: "A card for each person with allergies, conditions, medicines, blood type, doctor and insurance. Print it for the fridge or the babysitter.",
    features: ["A card per person", "Allergies stand out", "Print for the babysitter"] },
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
  // The Plugin Kit: 400 plugins drawn by shared tools (shared/pluginKit.ts).
  ...KIT_DEFS.map(kitPlugin),
];

/** The plugins one person sees in one hub. */
export function pluginsFor(hub: PluginHub, opts: { teacher: boolean }): Plugin[] {
  return PLUGINS.filter((p) => p.hub === hub && (!p.teacherOnly || opts.teacher));
}

/** A Notes-app plugin (see shared/notesApp.ts) by its App Store id, in the given hub. */
export function notesAppPlugin(hub: PluginHub, id: string): Plugin | undefined {
  return PLUGINS.find((p) => p.hub === hub && p.id === id && p.target.kind === "notesApp");
}

/** A Sheets-app plugin (see shared/sheetsApp.ts) by its App Store id, in the given hub. */
export function sheetsAppPlugin(hub: PluginHub, id: string): Plugin | undefined {
  return PLUGINS.find((p) => p.hub === hub && p.id === id && p.target.kind === "sheetsApp");
}

/** The Drive-app plugin (see shared/driveApp.ts) in the given hub, if that hub offers one. */
export function driveAppPlugin(hub: PluginHub): Plugin | undefined {
  return PLUGINS.find((p) => p.hub === hub && p.target.kind === "driveApp");
}

/** The Drop-app plugin (see shared/dropApp.ts) in the given hub, if that hub offers one. */
export function dropAppPlugin(hub: PluginHub): Plugin | undefined {
  return PLUGINS.find((p) => p.hub === hub && p.target.kind === "dropApp");
}

/** Plugins that can be added and removed from the store (the rest open somewhere instead). */
export const isAddable = (p: Plugin) => p.target.kind === "tab" || p.target.kind === "section" || p.target.kind === "layer" || p.target.kind === "widget" || p.target.kind === "assistant" || p.target.kind === "kit" || p.target.kind === "notesApp" || p.target.kind === "sheetsApp" || p.target.kind === "driveApp" || p.target.kind === "dropApp";

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
export function workInstalled(p: Plugin, visibleTabs: Partial<Record<HubTab, boolean>>, kitInstalled?: readonly string[], assistant?: boolean, widgets?: boolean, notesInstalled?: readonly string[]): boolean {
  const t = p.target;
  if (t.kind === "widget") return t.widget === "board" && !!widgets;
  if (t.kind === "assistant") return !!assistant;
  if (t.kind === "kit") return !!kitInstalled?.includes(t.id);
  if (t.kind === "notesApp") return !!notesInstalled?.includes(t.id);
  if (t.kind === "tab") return visibleTabs[t.tab] !== false;
  if (t.kind === "connection" && "tab" in t.needs) return visibleTabs[t.needs.tab] !== false;
  return false;
}

/** WorkHub's added Plugin Kit plugins with this one added or removed. */
export function setWorkKit(list: readonly string[] | undefined, p: Plugin, on: boolean): string[] {
  const cur = Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  if (p.target.kind !== "kit") return cur;
  const id = p.target.id;
  return on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id);
}

/** WorkHub's added Notes-app installs with this one added or removed. Removing keeps its saved notes:
 *  adding it back brings them right back, the same as any other plugin. */
export function setWorkNotesApp(list: readonly string[] | undefined, p: Plugin, on: boolean): string[] {
  const cur = Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  if (p.target.kind !== "notesApp") return cur;
  const id = p.target.id;
  return on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id);
}

/** The WorkHub's tab switches with this plugin added or removed. Nothing else changes. */
export function setWorkPlugin<V extends Partial<Record<HubTab, boolean>>>(visibleTabs: V, p: Plugin, on: boolean): V {
  if (p.target.kind !== "tab") return visibleTabs;
  return { ...visibleTabs, [p.target.tab]: on };
}

// ── LifeHub ────────────────────────────────────────────────────────────────

/** Is this LifeHub plugin on? A section is on unless it was switched off. */
export function lifeInstalled(p: Plugin, family: Pick<Family, "sections" | "layers"> & Partial<Pick<Family, "widgets" | "driveInstalled" | "dropInstalled">>, notesInstalled?: readonly string[], sheetsInstalled?: readonly string[]): boolean {
  const t = p.target;
  const sectionOn = (s: FamilySection) => isOn(s, family);
  if (t.kind === "section") return sectionOn(t.section);
  if (t.kind === "layer") return !!family.layers?.[t.layer];
  if (t.kind === "widget") return !!family.widgets?.[t.widget];
  if (t.kind === "assistant") return !!(family.widgets as { chat?: boolean } | undefined)?.chat;
  if (t.kind === "notesApp") return !!notesInstalled?.includes(t.id);
  if (t.kind === "sheetsApp") return !!sheetsInstalled?.includes(t.id);
  if (t.kind === "driveApp") return !!family.driveInstalled;
  if (t.kind === "dropApp") return !!family.dropInstalled;
  if (t.kind === "connection" && "section" in t.needs) return sectionOn(t.needs.section);
  return false;
}

/** The family with this plugin added or removed. Adding the WorkHub calendar also adds the Calendar section it shows in. */
export function setLifePlugin<F extends Pick<Family, "sections" | "layers"> & Partial<Pick<Family, "widgets" | "layout" | "driveInstalled" | "dropInstalled">>>(family: F, p: Plugin, on: boolean): F {
  const t = p.target;
  // The Widgets board is a part of Home: adding it shows that part, removing it hides it again.
  if (t.kind === "widget" && t.widget === "board") return { ...family, widgets: { ...(family.widgets ?? { stickies: false }), board: on }, layout: showSection(cleanLifeLayout(family.layout), "widgets", on) };
  if (t.kind === "widget") return { ...family, widgets: { ...(family.widgets ?? { stickies: false }), [t.widget]: on } };
  if (t.kind === "assistant") return { ...family, widgets: { ...(family.widgets ?? { stickies: false }), chat: on } };
  if (t.kind === "section") return { ...family, sections: { ...family.sections, [t.section]: on } };
  if (t.kind === "driveApp") return { ...family, driveInstalled: on };
  if (t.kind === "dropApp") return { ...family, dropInstalled: on };
  if (t.kind === "layer") {
    const next = { ...family, layers: { ...family.layers, [t.layer]: on } };
    return on ? { ...next, sections: { ...next.sections, [t.opens]: true } } : next;
  }
  return family;
}

/** LifeHub's added Sheets-app installs with this one added or removed. Removing keeps its saved sheets. */
export function setLifeSheetsApp(list: readonly string[] | undefined, p: Plugin, on: boolean): string[] {
  const cur = Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  if (p.target.kind !== "sheetsApp") return cur;
  const id = p.target.id;
  return on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id);
}

/** LifeHub's added Notes-app installs with this one added or removed. Removing keeps its saved notes. */
export function setLifeNotesApp(list: readonly string[] | undefined, p: Plugin, on: boolean): string[] {
  const cur = Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  if (p.target.kind !== "notesApp") return cur;
  const id = p.target.id;
  return on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id);
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

// ── Hub templates ────────────────────────────────────────────────────────────
// A ready-made bundle of App Store plugins, for someone building a new hub around one area of life.
// Adding a template adds every plugin in it in one go, each exactly as if added on its own: nothing
// new is created to hold them, and removing any one of them afterward works the same as always.

export type HubTemplate = {
  id: string;
  hub: PluginHub;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  /** The plugin ids this template adds, in the order they'll show on its detail page. */
  plugins: readonly string[];
};

export const HUB_TEMPLATES: readonly HubTemplate[] = [
  { id: "life-template-finance", hub: "life", name: "Finance hub", tagline: "Bills, budget, savings and more, all at once", icon: "Wallet", color: "#16a34a",
    description: "Everything for the money side of family life, added together: bills and budget, subscriptions, savings jars, who owes who, gift card balances, warranties, a loan calculator and a mileage log.",
    plugins: ["life-money", "life-subscriptions", "life-jars", "life-tips", "life-ious", "life-giftcards", "life-warranties", "life-mortgage", "life-mileage"] },
  { id: "life-template-health", hub: "life", name: "Health & fitness hub", tagline: "Food, exercise, sleep and checkups, all at once", icon: "HeartPulse", color: "#dc2626",
    description: "Everything for tracking health as a family, added together: a food and fitness diary, workouts, sleep, checkups, cycle tracking, pill reminders, mood check-ins, meditation and habits.",
    plugins: ["life-health", "life-workouts", "life-sleep", "life-checkups", "life-cycle", "life-pills", "life-mood", "life-meditate", "life-habits"] },
  { id: "life-template-home", hub: "life", name: "Home & chores hub", tagline: "Chores, upkeep and the car, all at once", icon: "Wrench", color: "#64748b",
    description: "Everything for running the household, added together: the chore chart, home upkeep schedules, a cleaning schedule, car care, plant care, home projects, the grocery list, lent items and pet care.",
    plugins: ["life-chores", "life-upkeep", "life-cleaning", "life-car", "life-plants", "life-projects", "life-grocery", "life-loans", "life-pets"] },
];

/** A template's plugins, resolved and in this hub (missing or wrong-hub ids are quietly skipped). */
export function templatePlugins(t: HubTemplate): Plugin[] {
  return t.plugins.map((id) => PLUGINS.find((p) => p.id === id && p.hub === t.hub)).filter((p): p is Plugin => !!p);
}

/** How many of a template's plugins are already added (same test as the App Store uses per-plugin). */
export function templateInstalledCount(t: HubTemplate, family: Pick<Family, "sections" | "layers"> & Partial<Pick<Family, "widgets">>, notesInstalled?: readonly string[]): number {
  return templatePlugins(t).filter((p) => lifeInstalled(p, family, notesInstalled)).length;
}

/** The family with every plugin in a template added (or removed) at once, each exactly as setLifePlugin
 *  would do it on its own. A template has no plugins of its own kind that aren't already "section" or
 *  "widget" targets, so this never touches notesInstalled; a future template that needs that can extend it. */
export function setLifeTemplate<F extends Pick<Family, "sections" | "layers"> & Partial<Pick<Family, "widgets" | "layout">>>(family: F, t: HubTemplate, on: boolean): F {
  return templatePlugins(t).reduce((f, p) => setLifePlugin(f, p, on), family);
}
