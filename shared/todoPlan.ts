// A.R.I.S.E. To-Do's two plans: Free and Unlimited ($10 a month).
//
// Free: 5 menu buttons in each hub (WorkHub and LifeHub, counted separately) and 5 AI uses a
// month. A "menu button" is anything in the menu you chose to have: a section (Calendar,
// Grocery, a calorie counter...), an App Store app, or a to-do list you made. Home, Settings,
// Notifications and A.R.I.S.E. Reader (with Arise Learning) are always there and never count.
// Unlimited: every button you want, and AI up to a fair-use ceiling.
//
// Nothing is ever taken away. Someone over 5 (an account from before the limit, say) keeps every
// button they have; they just can't add another until they're back under 5 or on Unlimited. The
// page and the server both count with these functions, so they always agree.
import { ADD_ON_SECTIONS, TOGGLEABLE, cleanFamily, isOn, orderedToggleable, type Family, type FamilySection } from "./familyHub";
import { HUB_GROUPS, visibleGroups } from "./hubTabGroups";
import { kitDef } from "./pluginKit";
import { notesAppPlugin, sheetsAppPlugin } from "./pluginStore";
import { HUB_TABS, type HubTab } from "./teacherHub";

export const FREE_MENU_BUTTONS = 5;
export const FREE_AI_PER_MONTH = 5;
/** Unlimited's AI is unlimited in normal use; this ceiling only stops runaway use (see FAIR_USE). */
export const UNLIMITED_AI_PER_MONTH = 300;
export const UNLIMITED_MONTHLY_CENTS = 1000;

export const UNLIMITED_NAME = "A.R.I.S.E. To-Do Unlimited";
export const FAIR_USE =
  "Unlimited is meant for normal personal, family and classroom use. Using it in ways that put unusual strain on our service, like bulk data, automated use or anything far beyond normal use, isn't covered. If an account goes well beyond normal use, we'll contact you first. If it continues, we may limit the account or cancel the subscription and refund any unused time. Your data stays yours, and you can always export a copy.";

/** The code the server answers with when a free hub has no room for another button. */
export const BUTTONS_FULL = "todo_buttons_full";
/** The code the server answers with when this month's AI uses are gone. */
export const AI_LIMIT = "todo_ai_limit";

const uniq = (xs: unknown): string[] => (Array.isArray(xs) ? Array.from(new Set(xs.filter((x): x is string => typeof x === "string"))) : []);

/** The menu buttons a LifeHub workspace uses: the sections switched on, the to-do lists, and the App Store apps. */
export function lifeButtons(workspace: unknown): string[] {
  const w: any = workspace && typeof workspace === "object" ? workspace : {};
  const family: Family = cleanFamily(w.family);
  const sections = orderedToggleable(family).filter((id) => isOn(id, family)).map((id) => `section:${id}`);
  const lists = (Array.isArray(w.lists) ? w.lists : []).filter((l: any) => l && typeof l.id === "string").map((l: any) => `list:${l.id}`);
  const apps = [
    ...uniq(family.notesInstalled).filter((id) => !!notesAppPlugin("life", id)).map((id) => `notes:${id}`),
    ...uniq(family.sheetsInstalled).filter((id) => !!sheetsAppPlugin("life", id)).map((id) => `sheets:${id}`),
    ...(family.driveInstalled ? ["drive"] : []),
    ...(family.dropInstalled ? ["drop"] : []),
    ...uniq(family.kitInstalled).filter((id) => !!kitDef(id)).map((id) => `kit:${id}`),
  ];
  return [...sections, ...Array.from(new Set(lists)), ...apps];
}

/** The menu buttons a WorkHub workspace uses: every menu group except Home and A.R.I.S.E. Reader, and the App Store apps. */
export function workButtons(workspace: unknown): string[] {
  const w: any = workspace && typeof workspace === "object" ? workspace : {};
  const visible: Partial<Record<HubTab, boolean>> = { ...(w.visibleTabs && typeof w.visibleTabs === "object" ? w.visibleTabs : {}), admin: false };
  const groups = visibleGroups(visible).filter((g) => g.id !== "home" && g.id !== "arise").map((g) => `group:${g.id}`);
  const apps = [
    ...uniq(w.notesInstalled).filter((id) => !!notesAppPlugin("work", id)).map((id) => `notes:${id}`),
    ...uniq(w.sheetsInstalled).filter((id) => !!sheetsAppPlugin("work", id)).map((id) => `sheets:${id}`),
    ...(w.driveInstalled ? ["drive"] : []),
    ...(w.dropInstalled ? ["drop"] : []),
    ...uniq(w.kitInstalled).filter((id) => kitDef(id)?.hub === "work").map((id) => `kit:${id}`),
  ];
  return [...groups, ...apps];
}

export const buttonsIn = (hub: "work" | "life", workspace: unknown) => (hub === "work" ? workButtons(workspace) : lifeButtons(workspace)).length;

/** Would this change add a button past what Free allows? (A hub already over can keep what it has.) */
export function addsPastFree(hub: "work" | "life", before: unknown, after: unknown, limit = FREE_MENU_BUTTONS): boolean {
  const next = buttonsIn(hub, after);
  return next > limit && next > buttonsIn(hub, before);
}

/** WorkHub tabs a brand-new free WorkHub starts with on (Calendar and Tasks): room to try three more. */
export const WORK_STARTER_TABS: readonly HubTab[] = ["calendar", "tasks"];
/** LifeHub sections a brand-new LifeHub starts with on (beside one "Personal" list): room to try three more. */
export const LIFE_STARTER_SECTIONS = ["calendar"] as const;

/** A brand-new WorkHub's tabs: Home, A.R.I.S.E. Reader and the starter tabs on, everything else off (one tap away in Customize or the App Store). */
export function workStarterVisibleTabs(): Record<HubTab, boolean> {
  const always = new Set<string>([...(HUB_GROUPS.find((g) => g.id === "home")?.tabs ?? []), ...(HUB_GROUPS.find((g) => g.id === "arise")?.tabs ?? []), ...WORK_STARTER_TABS]);
  return Object.fromEntries(HUB_TABS.map((t) => [t, always.has(t)])) as Record<HubTab, boolean>;
}

/** A brand-new LifeHub's section switches: only the starter sections on (the rest are one tap away). */
export function lifeStarterSections(): Partial<Record<FamilySection, boolean>> {
  const on = new Set<string>(LIFE_STARTER_SECTIONS);
  const out: Partial<Record<FamilySection, boolean>> = {};
  for (const id of TOGGLEABLE) if (!ADD_ON_SECTIONS.includes(id)) out[id] = on.has(id);
  return out;
}

/** This month, as "YYYY-MM" (UTC), for counting AI uses. */
export const aiMonth = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);
