// Moving things between LifeHub and FamilyHub. Both hubs keep the same kind of workspace (to-do lists,
// tasks and a Family), so an app moves by copying its saved data into the other hub (merged with
// anything already there, nothing replaced), turning it on there, and turning it off here. Its data
// here is kept, so moving it back brings everything back.
//
// Two ways things move:
// - by hand: "Move to FamilyHub" / "Move to LifeHub" on each app (Family & settings → Move between hubs);
// - on their own: anything you share with someone in your family moves to FamilyHub (useFamilyTransfer).
import { ACCOUNTABILITY_SHARE, isHealthShareId } from "./profileLinks";
import { SHARED_APPS, mergeSlices, pickParts, sharedAppFor, type AppPart } from "./sharedApps";
import { KIT_LIFE_IDS } from "./pluginKit";
import { BUNDLE_BY_SECTION } from "./appBundles";
import { RETIRED_SECTIONS, TOGGLEABLE, type Family, type FamilySection } from "./familyHub";
import { AI_TOOL_TO_PRO, liveProApps } from "./pro/apps";

export type HubItem =
  | { kind: "section"; section: FamilySection }
  /** An app from the Plugin Gallery kept in `sheetsInstalled` (a premium app like Potty Training, an AI tool). */
  | { kind: "app"; app: string }
  /** The to-do lists. */
  | { kind: "tasks" };

/** The workspace both hubs save (server/ariseTodo.ts and server/familySpace.ts check the same shape). */
export type HubWorkspace = { version: number; lists: Array<{ id: string; name: string; color: string } & Record<string, unknown>>; tasks: Array<{ id: string; listId: string } & Record<string, unknown>>; family: Family } & Record<string, unknown>;

export const itemKey = (i: HubItem) => (i.kind === "section" ? `s:${i.section}` : i.kind === "app" ? `a:${i.app}` : "tasks");

/** The shared app with a share id. Kitchen took over the meal plan's id ("life:meals"), so the last one wins. */
export const sharedAppForShare = (id: string) => [...SHARED_APPS].reverse().find((a) => a.id === id);

/** What a share (Settings → Sharing) is in a hub, or null for something that isn't an app in either hub
 *  (Food & fitness numbers, which are part of the retired Health app). */
export function itemForShare(id: string): HubItem | null {
  if (id === ACCOUNTABILITY_SHARE) return { kind: "section", section: "accountability" };
  if (id.startsWith("app:")) return { kind: "app", app: proPluginId(id.slice(4)) };
  if (id === "life:tasks") return { kind: "tasks" };
  if (isHealthShareId(id)) return null;
  const a = sharedAppForShare(id);
  return a && !RETIRED_SECTIONS.includes(a.section) ? { kind: "section", section: a.section } : null;
}

/** The parts of a Family an app keeps. Apps without any (Accountability lives on the server) just move. */
export function partsFor(section: FamilySection): AppPart[] {
  if ((KIT_LIFE_IDS as readonly string[]).includes(section)) return [{ key: "kit", plugins: [section] }];
  if (section === "kitchen") return sharedAppForShare("life:meals")?.parts ?? [];
  return sharedAppFor(section)?.parts ?? [];
}

/** A premium app's LifeHub plugin id: "life-pro-potty", or the AI tool's id it took over ("life-ai-journal-reflect"),
 *  the same ids the Plugin Gallery installs (shared/pluginStore.ts, PREMIUM_APPS). */
export function proPluginId(proId: string): string {
  const task = Object.entries(AI_TOOL_TO_PRO).find(([, pro]) => pro === proId)?.[0];
  return task ? `life-ai-${task}` : `life-pro-${proId}`;
}
/** The premium app a LifeHub plugin id is, if it is one. */
export function proIdOf(app: string): string | null {
  const pro = /^life-pro-(.+)$/.exec(app)?.[1];
  if (pro) return pro;
  const task = /^life-ai-(.+)$/.exec(app)?.[1];
  return task && AI_TOOL_TO_PRO[task] ? AI_TOOL_TO_PRO[task] : null;
}
const proName = (app: string) => { const id = proIdOf(app); return id ? liveProApps().find((a) => a.id === id)?.name : undefined; };

/** Everything on in a hub that can move: its apps (not Home, Tasks, Calendar's place in the menu and the
 *  other built-in pages) and its premium apps. `label` names the ones the page has no name for. */
export function movableItems(f: Family, label: (s: FamilySection) => string | undefined = () => undefined): Array<{ item: HubItem; name: string }> {
  const out: Array<{ item: HubItem; name: string }> = [];
  for (const s of TOGGLEABLE) {
    if (!f.sections[s] || RETIRED_SECTIONS.includes(s)) continue;
    out.push({ item: { kind: "section", section: s }, name: label(s) || SHARED_APPS.find((a) => a.section === s)?.label || s });
  }
  for (const app of f.sheetsInstalled ?? []) {
    const name = proName(app);
    if (name) out.push({ item: { kind: "app", app }, name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Copies an app into `to` and turns it on there; turns it off in `from` (its data kept). */
export function moveItem(from: HubWorkspace, to: HubWorkspace, item: HubItem): { from: HubWorkspace; to: HubWorkspace } {
  if (item.kind === "tasks") return { from, to: copyTasks(from, to) };
  const f = from.family, t = to.family;
  if (item.kind === "app") {
    return {
      from: { ...from, family: { ...f, sheetsInstalled: (f.sheetsInstalled ?? []).filter((x) => x !== item.app) } },
      to: { ...to, family: { ...t, sheetsInstalled: [...new Set([...(t.sheetsInstalled ?? []), item.app])] } },
    };
  }
  const s = item.section;
  const parts = partsFor(s);
  const merged = parts.length ? mergeSlices(pickParts(t, parts), pickParts(f, parts), parts) : {};
  const bundleSet = BUNDLE_BY_SECTION.has(s) && f.bundleSet?.[s] && !t.bundleSet?.[s] ? { ...t.bundleSet, [s]: f.bundleSet[s] } : t.bundleSet;
  const nextTo: Family = { ...t, ...(merged as Partial<Family>), bundleSet, sections: { ...t.sections, [s]: true } };
  const nextFrom: Family = { ...f, sections: { ...f.sections, [s]: false } };
  return { from: { ...from, family: nextFrom }, to: { ...to, family: nextTo } };
}

/** The to-do lists and their tasks copied in (a list or task already there by id isn't added twice).
 *  They stay in the hub they came from too: Tasks is in every hub. Stops at the hubs' limits (100 lists, 5,000 tasks). */
export function copyTasks(from: HubWorkspace, to: HubWorkspace): HubWorkspace {
  const lists = [...to.lists];
  const listIds = new Set(lists.map((l) => l.id));
  for (const l of from.lists) if (!listIds.has(l.id) && lists.length < 100) { lists.push(l); listIds.add(l.id); }
  const tasks = [...to.tasks];
  const taskIds = new Set(tasks.map((x) => x.id));
  for (const x of from.tasks) if (!taskIds.has(x.id) && listIds.has(x.listId) && tasks.length < 5000) { tasks.push(x); taskIds.add(x.id); }
  return { ...to, lists, tasks };
}

/** Whether an item is on in a hub (to show it under "In this hub"). */
export function isOn(f: Family, item: HubItem): boolean {
  return item.kind === "tasks" ? true : item.kind === "app" ? (f.sheetsInstalled ?? []).includes(item.app) : !!f.sections[item.section];
}
