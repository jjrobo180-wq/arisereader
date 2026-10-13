// A.R.I.S.E. To-Do: Free, and the $5 Unlimited upgrade.
//
// Free (for everyone, including people on a $10 Arise Reader plan): every built-in section, plus up
// to 3 apps from the App Store (across WorkHub and LifeHub together), and no AI. Unlimited, $5 a
// month: every app in the App Store, and AI (under a fair-use policy). So someone who only wants
// To-Do pays at most $5; with a Reader plan, $15.
//
// An "app" is something added from the App Store beyond what a hub comes with: a LifeHub add-on
// section (a calorie counter, habits, recipes, a kit...), or a Notes, Sheets, Drive, Drop or Kit app.
// The built-in sections (Calendar, Tasks, Notes, Chores, the WorkHub tabs...) never count.
//
// Nothing is ever taken away: someone over 3 (an account from before) keeps every app they have;
// they just can't add another until they're back under 3 or on Unlimited. The page and the server
// both count with these functions, so they always agree.
import { ADD_ON_SECTIONS, cleanFamily, isOn, type Family } from "./familyHub";
import { kitDef } from "./pluginKit";
import { notesAppPlugin, sheetsAppPlugin, type Plugin } from "./pluginStore";

export const FREE_APPS = 3;
/** Unlimited's AI is for everyday use; this ceiling only stops runaway use (see FAIR_USE). */
export const UNLIMITED_AI_PER_MONTH = 300;
export const UNLIMITED_MONTHLY_CENTS = 500;

export const UNLIMITED_NAME = "A.R.I.S.E. To-Do Unlimited (every app, and AI)";
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
    ...uniq(family.notesInstalled).filter((id) => !!notesAppPlugin("life", id)).map((id) => `notes:${id}`),
    ...uniq(family.sheetsInstalled).filter((id) => !!sheetsAppPlugin("life", id)).map((id) => `sheets:${id}`),
    ...(family.driveInstalled ? ["drive"] : []),
    ...(family.dropInstalled ? ["drop"] : []),
    ...uniq(family.kitInstalled).filter((id) => !!kitDef(id)).map((id) => `kit:${id}`),
  ];
}

/** The App Store apps a WorkHub workspace has added. (Its tabs are built in and never count.) */
export function workApps(workspace: unknown): string[] {
  const w: any = workspace && typeof workspace === "object" ? workspace : {};
  return [
    ...uniq(w.notesInstalled).filter((id) => !!notesAppPlugin("work", id)).map((id) => `notes:${id}`),
    ...uniq(w.sheetsInstalled).filter((id) => !!sheetsAppPlugin("work", id)).map((id) => `sheets:${id}`),
    ...(w.driveInstalled ? ["drive"] : []),
    ...(w.dropInstalled ? ["drop"] : []),
    ...uniq(w.kitInstalled).filter((id) => kitDef(id)?.hub === "work").map((id) => `kit:${id}`),
  ];
}

/** Does adding this App Store item use one of Free's 3 apps? (Built-in sections and tabs don't.) */
export function countsAsApp(hub: "work" | "life", p: Plugin): boolean {
  const t = p.target;
  if (t.kind === "notesApp" || t.kind === "sheetsApp" || t.kind === "driveApp" || t.kind === "dropApp" || t.kind === "kit") return true;
  return hub === "life" && t.kind === "section" && ADD_ON_SECTIONS.includes(t.section);
}

export const appsIn = (hub: "work" | "life", workspace: unknown) => (hub === "work" ? workApps(workspace) : lifeApps(workspace)).length;

/** Would this change take a free account past its apps? Totals are both hubs together. (An account already over can keep what it has.) */
export function growsPastFree(beforeTotal: number, afterTotal: number, limit = FREE_APPS): boolean {
  return afterTotal > limit && afterTotal > beforeTotal;
}

/** This month, as "YYYY-MM" (UTC), for counting AI uses. */
export const aiMonth = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);
