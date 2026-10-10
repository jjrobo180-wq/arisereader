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
import { TOGGLEABLE, type Family, type FamilySection } from "./familyHub";

export type PluginHub = "work" | "life";

export type PluginTarget =
  | { kind: "tab"; tab: HubTab }
  | { kind: "section"; section: FamilySection }
  | { kind: "layer"; layer: "hub"; opens: FamilySection }
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
};

export const PLUGIN_CATEGORIES: Record<PluginHub, readonly string[]> = {
  work: ["Planning", "Students & IEPs", "Classroom", "Families", "Connections", "Arise apps"],
  life: ["Family", "Health & wellness", "Money & home", "Everyday", "Connections", "Arise apps"],
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
    steps: ["In Google Calendar, Outlook or Apple Calendar, find your calendar's private address (it may be called the iCal, ICS or secret address) and copy it.", "In WorkHub, open Calendar and add a calendar, then paste the address.", "Give it a name. To add a colleague's calendar, choose to keep only the busy times.", "Its events show up in WorkHub and stay up to date on their own."],
    needsNote: "Works with any calendar that gives you a link.",
    description: "Connect any calendar by its link and its events show up in WorkHub, kept up to date. Add a colleague's calendar to see when they're busy.",
    features: ["Google, Outlook, Apple or any calendar link", "Syncs on its own", "Colleagues' calendars, busy times only"] },
  { id: "work-apple-reminders", hub: "work", name: "Apple Reminders", tagline: "Reminders become WorkHub to-dos", category: "Connections", icon: "BellRing", color: "#475569", target: { kind: "connection", needs: { tab: "tasks" } },
    steps: ["Open Tasks in WorkHub and find Apple Reminders at the bottom.", "Tap “Set it up (about 3 minutes)” and copy your private link.", "On your iPhone, make the Shortcut the setup shows you, using that link.", "Run it, or set it to run on its own: your reminders come in as to-dos."],
    needsNote: "Needs an iPhone. Reminders come into WorkHub only; nothing is sent back to Apple.",
    description: "Send reminders from your iPhone straight into your WorkHub to-do list.",
    features: ["From Siri or the Reminders app", "Lands in Tasks", "Set up once"] },
  { id: "work-email-forwarding", hub: "work", name: "Email forwarding", tagline: "Forward an email, get a to-do", category: "Connections", icon: "Forward", color: "#334155", target: { kind: "connection", needs: { tab: "email" } },
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
  { id: "life-workhub-calendar", hub: "life", name: "WorkHub calendar", tagline: "Your work calendar inside LifeHub", category: "Connections", icon: "Briefcase", color: "#0f766e", teacherOnly: true,
    target: { kind: "layer", layer: "hub", opens: "calendar" },
    description: "See your Arise WorkHub calendar on your family calendar, read live, so work and home never double-book.",
    features: ["Read live from WorkHub", "Nothing is copied", "Turn it off any time"] },
  { id: "life-apple-health", hub: "life", name: "Apple Health", tagline: "Steps, workouts and weight from your iPhone", category: "Connections", icon: "HeartPulse", color: "#e11d48", target: { kind: "connection", needs: { section: "health" } },
    steps: ["Open Food & fitness in LifeHub and pick the person to connect.", "Tap “Connect Apple Health”. You'll get a private link and an iPhone Shortcut.", "On your iPhone, add the Shortcut and let it read your Health data.", "Steps, active calories and weight come in every day on their own."],
    needsNote: "Needs an iPhone (or Apple Watch). Connect each adult separately.",
    description: "Bring steps, workouts and weight in from Apple Health, so Food & fitness fills itself in.",
    features: ["Steps and workouts", "Weight", "Set up once per person"] },
  { id: "life-email-forward", hub: "life", name: "Email forwarding", tagline: "Forward an email, get a task", category: "Connections", icon: "Forward", color: "#334155", target: { kind: "connection", needs: { section: "tasks" } },
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
export const isAddable = (p: Plugin) => p.target.kind === "tab" || p.target.kind === "section" || p.target.kind === "layer";

/** Where a plugin opens in its hub: a WorkHub tab or a LifeHub section. null for an Arise app. */
export function pluginOpens(p: Plugin): { tab: HubTab } | { section: FamilySection } | null {
  const t = p.target;
  if (t.kind === "tab") return { tab: t.tab };
  if (t.kind === "section") return { section: t.section };
  if (t.kind === "layer") return { section: t.opens };
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
export function lifeInstalled(p: Plugin, family: Pick<Family, "sections" | "layers">): boolean {
  const t = p.target;
  const sectionOn = (s: FamilySection) => !TOGGLEABLE.includes(s) || family.sections[s] !== false;
  if (t.kind === "section") return sectionOn(t.section);
  if (t.kind === "layer") return !!family.layers?.[t.layer];
  if (t.kind === "connection" && "section" in t.needs) return sectionOn(t.needs.section);
  return false;
}

/** The family with this plugin added or removed. Adding the WorkHub calendar also adds the Calendar section it shows in. */
export function setLifePlugin<F extends Pick<Family, "sections" | "layers">>(family: F, p: Plugin, on: boolean): F {
  const t = p.target;
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
