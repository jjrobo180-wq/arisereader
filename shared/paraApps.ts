// Para Team settings and team apps.
//
// Settings (kept on the team itself, para_teams.settings) say two things:
//  - perms: what paras may do with things other people made. The teacher who made the team (the
//    owner) sets these in Team › Permissions. Leads can always change anything.
//  - apps: the apps from the Arise App Store the team has added (LifeHub apps, Plugin Kit apps and
//    the Office apps). They show as their own pages in the team's menu.
//
// A team app keeps its data in one shared LifeHub-shaped store (a Family, shared/familyHub.ts):
// the team's "hub" item. Polls go in family.polls, a kit app's records in family.kit, and so on,
// so every app works exactly as it does in LifeHub, only shared by the whole team. Saving sends
// only what changed (diffFamily), and lists of records are merged one record at a time
// (applyFamilyPatch), so two paras adding to the same poll list at once both keep their entry.
import { FAMILY_SECTIONS, emptyFamily, type Family, type FamilySection } from "./familyHub";
import { pluginsFor, type Plugin } from "./pluginStore";
import { kitDef } from "./pluginKit";

// ─── permissions ──────────────────────────────────────────────────────────────────────────────

export const PERM_KEYS = ["bulletins", "calendar", "tasks", "messages", "lessons", "docs", "data", "appsAdd", "appsEdit"] as const;
export type PermKey = (typeof PERM_KEYS)[number];
export type ParaPerms = Record<PermKey, boolean>;

/** Out of the box paras can edit and take down anyone's bulletin and use the team's apps;
 *  everything else made by someone else stays theirs (and the leads') to change. */
export const DEFAULT_PERMS: ParaPerms = {
  bulletins: true, calendar: false, tasks: false, messages: false, lessons: false, docs: false, data: false, appsAdd: false, appsEdit: true,
};

export const PERM_INFO: Record<PermKey, { label: string; line: string }> = {
  bulletins: { label: "Edit and take down anyone's bulletins", line: "Paras can change or remove any bulletin on the board, not only their own." },
  calendar: { label: "Edit and delete anyone's calendar events", line: "Paras can change or remove events and absences other people added." },
  tasks: { label: "Edit and delete anyone's to-dos", line: "Paras can change or remove to-dos other people made (anyone can still tick off their own)." },
  messages: { label: "Delete anyone's messages", line: "Paras can remove any message in the team chat." },
  lessons: { label: "Edit anyone's lesson plans", line: "Paras can change or remove lesson plans other people wrote." },
  docs: { label: "Edit and delete anyone's links and files", line: "Paras can rename, move or delete docs and files other people added." },
  data: { label: "Edit and delete anyone's data entries", line: "Paras can change or remove behavior and goal data other people logged." },
  appsAdd: { label: "Add and remove team apps", line: "Paras can add apps from the App Gallery to the team, and remove them." },
  appsEdit: { label: "Make changes in team apps", line: "Paras can add, change and vote in the team's apps. Off: they can look but not change anything." },
};

/** Which kinds of team item each switch opens up to paras. */
export const PERM_KINDS: Partial<Record<PermKey, readonly string[]>> = {
  bulletins: ["bulletin"], calendar: ["event"], tasks: ["task"], messages: ["message"], lessons: ["lesson"], docs: ["link", "file"], data: ["log"],
};
export const permForKind = (perms: ParaPerms, kind: string): boolean =>
  PERM_KEYS.some((k) => perms[k] && (PERM_KINDS[k] || []).includes(kind));

export type ParaSettings = { perms: ParaPerms; apps: string[] };
export const MAX_TEAM_APPS = 120;
export const defaultSettings = (): ParaSettings => ({ perms: { ...DEFAULT_PERMS }, apps: [] });

/** Settings as stored, made safe: unknown switches dropped, missing ones at their default, only
 *  apps that exist kept (once each). */
export function cleanSettings(raw: unknown): ParaSettings {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, any>;
  const p = (r.perms && typeof r.perms === "object" ? r.perms : {}) as Record<string, unknown>;
  const perms = { ...DEFAULT_PERMS };
  for (const k of PERM_KEYS) if (typeof p[k] === "boolean") perms[k] = p[k] as boolean;
  const apps = [...new Set((Array.isArray(r.apps) ? r.apps : []).filter((a: unknown): a is string => typeof a === "string" && !!paraApp(a)))].slice(0, MAX_TEAM_APPS);
  return { perms, apps };
}

/** May this person add or remove the team's apps? */
export const canManageApps = (role: "lead" | "para", perms: ParaPerms) => role === "lead" || perms.appsAdd;
/** May this person change what's in the team's apps? */
export const canUseApps = (role: "lead" | "para", perms: ParaPerms) => role === "lead" || perms.appsEdit;

// ─── the catalog ──────────────────────────────────────────────────────────────────────────────

/** One app a team can add: a LifeHub app, a Plugin Kit app (from either hub), or an Office app
 *  (a link into the person's own Arise Office, since those files belong to one account). */
export type ParaApp = {
  key: string;
  kind: "section" | "kit" | "office";
  name: string;
  tagline: string;
  description: string;
  features: string[];
  category: string;
  icon: string;
  color: string;
  /** Section and kit apps: the LifeHub section or kit id. Office apps: where it opens. */
  target: string;
};

/** LifeHub screens that belong to one person's account, not a shared team page. */
const PERSONAL: readonly FamilySection[] = ["home", "tasks", "start", "reader", "lifeplan", "linked", "notifications", "family"];

let catalog: { list: ParaApp[]; byKey: Map<string, ParaApp> } | null = null;

function build() {
  const out = new Map<string, ParaApp>();
  const add = (p: Plugin, a: Omit<ParaApp, "name" | "tagline" | "description" | "features" | "category" | "icon" | "color">) => {
    if (out.has(a.key)) return;
    out.set(a.key, { ...a, name: p.name, tagline: p.tagline, description: p.description, features: p.features, category: p.category, icon: p.icon, color: p.color });
  };
  // WorkHub first: Para Team is a WorkHub space, so a kit or Office app offered in both hubs uses
  // WorkHub's wording and opens WorkHub's version.
  for (const hub of ["work", "life"] as const) {
    for (const p of pluginsFor(hub, { teacher: true })) {
      const t = p.target;
      if (t.kind === "section") {
        if (PERSONAL.includes(t.section) || !(FAMILY_SECTIONS as readonly string[]).includes(t.section)) continue;
        if (kitDef(t.section)) add(p, { key: `kit:${t.section}`, kind: "kit", target: t.section });
        else add(p, { key: t.section, kind: "section", target: t.section });
      } else if (t.kind === "kit") {
        if (kitDef(t.id)) add(p, { key: `kit:${t.id}`, kind: "kit", target: t.id });
      } else if (t.kind === "officeApp") {
        add(p, { key: `office:${t.id.replace(/^(work|life)-/, "")}`, kind: "office", target: t.href });
      }
    }
  }
  const list = [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { list, byKey: out };
}

export function paraApps(): ParaApp[] { return (catalog ??= build()).list; }
export function paraApp(key: string): ParaApp | undefined { return (catalog ??= build()).byKey.get(key); }

// ─── the shared data, sent as changes ────────────────────────────────────────────────────────

/** What one save sends: whole values for most parts, record-by-record changes for lists of
 *  records (anything that is an array of objects with an id). */
export type FamilyPatch = {
  set?: Record<string, unknown>;
  lists?: Record<string, { order: string[]; upsert: unknown[]; remove: string[] }>;
};

/** Parts of a Family a team app never changes: who's on the team comes from the team itself,
 *  and a passcode lock is one person's, not the team's. */
const NOT_SHARED = new Set(["members", "lock"]);
const FAMILY_KEYS = new Set(Object.keys(emptyFamily()).filter((k) => !NOT_SHARED.has(k)));
// Optional parts that emptyFamily leaves out.
for (const k of ["widgetBoard", "layout", "lifePlan"]) FAMILY_KEYS.add(k);

const isRecordList = (v: unknown): v is Array<{ id: string }> =>
  Array.isArray(v) && v.every((x) => !!x && typeof x === "object" && !Array.isArray(x) && typeof (x as any).id === "string");
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** The changes that turn `before` into `after`, or null when nothing changed. */
export function diffFamily(before: Family, after: Family): FamilyPatch | null {
  const patch: FamilyPatch = {};
  for (const key of FAMILY_KEYS) {
    const a = (before as any)[key], b = (after as any)[key];
    if (a === b || same(a, b)) continue;
    if (isRecordList(a) && isRecordList(b)) {
      const was = new Map(a.map((x) => [x.id, x]));
      const now = new Set(b.map((x) => x.id));
      (patch.lists ??= {})[key] = {
        order: b.map((x) => x.id),
        upsert: b.filter((x) => !was.has(x.id) || !same(was.get(x.id), x)),
        remove: a.filter((x) => !now.has(x.id)).map((x) => x.id),
      };
    } else {
      (patch.set ??= {})[key] = b;
    }
  }
  return patch.set || patch.lists ? patch : null;
}

/** Applies a save to what's stored. A list keeps the saver's order; records someone else added
 *  meanwhile (that the saver never saw) stay, after the saver's. Run cleanFamily on the result. */
export function applyFamilyPatch(stored: Record<string, unknown>, raw: unknown): Record<string, unknown> {
  const patch = (raw && typeof raw === "object" ? raw : {}) as FamilyPatch;
  const out: Record<string, unknown> = { ...stored };
  if (patch.set && typeof patch.set === "object") {
    for (const [key, value] of Object.entries(patch.set)) if (FAMILY_KEYS.has(key)) out[key] = value;
  }
  if (patch.lists && typeof patch.lists === "object") {
    for (const [key, change] of Object.entries(patch.lists)) {
      if (!FAMILY_KEYS.has(key) || !change || typeof change !== "object") continue;
      const current = isRecordList(out[key]) ? (out[key] as Array<{ id: string }>) : [];
      const byId = new Map(current.map((x) => [x.id, x as unknown]));
      for (const id of Array.isArray(change.remove) ? change.remove : []) byId.delete(String(id));
      for (const rec of Array.isArray(change.upsert) ? change.upsert : []) {
        if (rec && typeof rec === "object" && typeof (rec as any).id === "string") byId.set((rec as any).id, rec);
      }
      const order = (Array.isArray(change.order) ? change.order : []).map(String);
      const placed = new Set<string>();
      const list: unknown[] = [];
      for (const id of order) if (byId.has(id) && !placed.has(id)) { list.push(byId.get(id)); placed.add(id); }
      for (const [id, rec] of byId) if (!placed.has(id)) list.push(rec);
      out[key] = list;
    }
  }
  return out;
}

/** The most one team's shared app data may hold, as JSON. */
export const TEAM_APPS_MAX_BYTES = 2_500_000;
