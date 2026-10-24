// Arise To Duo: Free, and the $5 Unlimited upgrade.
//
// Free (for everyone, including people on a $10 Arise Reader plan): every built-in section, plus up
// to 3 apps from the App Store (across WorkHub and LifeHub together), and no AI. Unlimited, $5 a
// month or $50 a year (the yearly price is a limited-time offer): every app in the App Store, and
// AI (under a fair-use policy).
//
// An "app" is something added from the App Store beyond what a hub comes with: a LifeHub add-on
// section (a calorie counter, habits, recipes, a kit...), or a Notes, Sheets, Drive, Drop or Kit app.
// What each hub comes with never counts: Home, Calendar, Tasks and Notes in WorkHub, and Home,
// Tasks, Calendar, Notes, Notifications and Settings in LifeHub.
//
// Nothing is ever taken away: someone over 3 (an account from before) keeps every app they have;
// they just can't add another until they're back under 3 or on Unlimited. The page and the server
// both count with these functions, so they always agree.
import { ADD_ON_SECTIONS, cleanFamily, isOn, type Family } from "./familyHub";
import { WORK_ADD_ON_TABS, isTabOn, type HubTab } from "./teacherHub";
import { kitDef } from "./pluginKit";
import { notesAppPlugin, officeAppPlugin, sheetsAppPlugin, type Plugin } from "./pluginStore";

export const FREE_APPS = 3;
/** Unlimited's AI is for everyday use; this ceiling only stops runaway use (see FAIR_USE). */
export const UNLIMITED_AI_PER_MONTH = 300;
export const UNLIMITED_MONTHLY_CENTS = 500;
/** The yearly price, sold as a limited-time offer. Set UNLIMITED_YEARLY_OFFER to false to stop selling it (anyone on it keeps it). */
export const UNLIMITED_YEARLY_CENTS = 5000;
export const UNLIMITED_YEARLY_OFFER = true;

export const UNLIMITED_NAME = "Arise To Duo Unlimited (every app, and AI)";
export const FAIR_USE =
  "Unlimited is meant for normal personal, family and classroom use. Using it in ways that put unusual strain on our service, like bulk data, automated use or anything far beyond normal use, isn't covered. If an account goes well beyond normal use, we'll contact you first. If it continues, we may limit the account or cancel the subscription and refund any unused time. Your data stays yours, and you can always export a copy.";

/** The code the server answers with when a free account has no room for another app. */
export const APPS_FULL = "todo_apps_full";
/** The code the server answers with when AI needs Unlimited (or its fair-use ceiling is reached). */
export const AI_LIMIT = "todo_ai_limit";

const uniq = (xs: unknown): string[] => (Array.isArray(xs) ? Array.from(new Set(xs.filter((x): x is string => typeof x === "string"))) : []);

/** The App Store apps a LifeHub workspace has added. */
export function lifeApps(workspace: unknown): string[] {
  const w: any = workspace && typeof workspace === "object" ? workspace : {};
  const family: Family = cleanFamily(w.family);
  return [
    ...ADD_ON_SECTIONS.filter((id) => isOn(id, family)).map((id) => `section:${id}`),
    // The App Store also offers independent widgets, the AI toggle and a
    // WorkHub calendar layer. They count just like any other installed app.
    ...(family.widgets?.board ? ["widget:board"] : []),
    ...(family.widgets?.stickies ? ["widget:stickies"] : []),
    ...(family.widgets?.chat ? ["assistant"] : []),
    ...(family.layers?.hub ? ["layer:hub"] : []),
    ...uniq(family.notesInstalled).filter((id) => !!notesAppPlugin("life", id)).map((id) => `notes:${id}`),
    ...uniq(family.sheetsInstalled).filter((id) => !!sheetsAppPlugin("life", id) || !!officeAppPlugin("life", id)).map((id) => `sheets:${id}`),
    ...(family.driveInstalled ? ["drive"] : []),
    ...(family.dropInstalled ? ["drop"] : []),
    ...uniq(family.kitInstalled).filter((id) => !!kitDef(id)).map((id) => `kit:${id}`),
  ];
}

/** The App Store apps a WorkHub workspace has added. WorkHub comes with Home, Calendar, Tasks and
 *  Notes; every other screen is added from the App Store and counts, the same as a LifeHub add-on. */
export function workApps(workspace: unknown): string[] {
  const w: any = workspace && typeof workspace === "object" ? workspace : {};
  const visible = (w.visibleTabs || {}) as Partial<Record<HubTab, boolean>>;
  return [
    ...WORK_ADD_ON_TABS.filter((tab) => isTabOn(tab, visible)).map((tab) => `tab:${tab}`),
    ...(w.widgetsOn ? ["widget:board"] : []),
    ...(w.aiChat ? ["assistant"] : []),
    ...uniq(w.notesInstalled).filter((id) => !!notesAppPlugin("work", id)).map((id) => `notes:${id}`),
    ...uniq(w.sheetsInstalled).filter((id) => !!sheetsAppPlugin("work", id) || !!officeAppPlugin("work", id)).map((id) => `sheets:${id}`),
    ...(w.driveInstalled ? ["drive"] : []),
    ...(w.dropInstalled ? ["drop"] : []),
    ...uniq(w.kitInstalled).filter((id) => kitDef(id)?.hub === "work").map((id) => `kit:${id}`),
  ];
}

/** Does adding this App Store item use one of Free's 3 apps? (Built-in sections and tabs don't.) */
export function countsAsApp(hub: "work" | "life", p: Plugin): boolean {
  const t = p.target;
  if (t.kind === "notesApp" || t.kind === "sheetsApp" || t.kind === "officeApp" || t.kind === "driveApp" || t.kind === "dropApp" || t.kind === "kit") return true;
  if (t.kind === "widget" || t.kind === "assistant" || t.kind === "layer") return true;
  if (hub === "work" && t.kind === "tab") return WORK_ADD_ON_TABS.includes(t.tab);
  return hub === "life" && t.kind === "section" && ADD_ON_SECTIONS.includes(t.section);
}

export const appsIn = (hub: "work" | "life", workspace: unknown) => (hub === "work" ? workApps(workspace) : lifeApps(workspace)).length;

/** Would this change take a free account past its apps? Totals are both hubs together. (An account already over can keep what it has.) */
export function growsPastFree(beforeTotal: number, afterTotal: number, limit = FREE_APPS): boolean {
  return afterTotal > limit && afterTotal > beforeTotal;
}

/** This month, as "YYYY-MM" (UTC), for counting AI uses. */
export const aiMonth = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);
