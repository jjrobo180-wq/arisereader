// Linked profiles (A.R.I.S.E. To-Do): share parts of your account with another person's account — a
// co-parent, a grandparent, a sitter, a teacher. You invite them by email; nothing is shared until
// they accept. For each thing you choose Off, View or Edit, and you can change it or stop sharing any
// time. They can leave any time.
//
// What can be shared:
//  - Every premium app (Potty Training, Water, Sleep, Steps, Weight, Workouts, Medication…): the other
//    person opens YOUR copy of the app. With Edit they can log and change things in it.
//  - LifeHub pages (calendar, to-dos, chores, goals, bills, trips, food & fitness, link page): view
//    only, the same pages a LifeHub share link shows. LifeHub is saved as one file per family, so two
//    people writing to it at once could overwrite each other; viewing is always safe.
//
// The server (server/profileLinks.ts) keeps the links and checks every read and write with
// accessFor() below. Nothing here trusts what the browser says about access.

import { liveProApps } from "./pro/apps";

export type Access = "view" | "edit";
/** What the owner shares: share id → access. Anything missing is off. */
export type Grants = Record<string, Access>;

export type ProfileLink = {
  id: string;
  ownerId: number;
  /** The invited person's email, lowercased. */
  email: string;
  /** Set once they accept. */
  viewerId?: number;
  /** What the owner calls them ("Grandma", "Mike"). */
  nickname: string;
  status: "pending" | "active";
  grants: Grants;
  createdAt: string;
  updatedAt: string;
};

export const LINK_LIMITS = { perOwner: 20, nickname: 40 } as const;

/** LifeHub pages that can be shared (view only). `target` is the share-view target (shared/todoShare.ts). */
export const LIFE_SHARES = [
  { id: "life:calendar", label: "Calendar", emoji: "📅", target: "calendar" },
  { id: "life:tasks", label: "To-do lists", emoji: "✅", target: "tasks" },
  { id: "life:chores", label: "Chores", emoji: "🧹", target: "chores" },
  { id: "life:goals", label: "Goals", emoji: "🎯", target: "goals" },
  { id: "life:bills", label: "Bills", emoji: "🧾", target: "bills" },
  { id: "life:trips", label: "Trips", emoji: "✈️", target: "trips" },
  { id: "life:links", label: "Link page", emoji: "🔗", target: "links" },
] as const;
/** One person's food & fitness numbers (LifeHub's Health), by family-member id. */
export const healthShareId = (memberId: string) => `life:health:${memberId}`;
export const isHealthShareId = (id: string) => /^life:health:[\w.-]{1,100}$/.test(id);

export const appShareId = (appId: string) => `app:${appId}`;
/** The premium app a stored app key belongs to ("pro-potty" → "potty"), or null for anything else. */
export const appIdFromKey = (key: string): string | null => { const m = /^pro-([a-z0-9-]{1,60})$/.exec(key); return m ? m[1] : null; };

export type ShareItem = { id: string; label: string; emoji?: string; icon?: string; color?: string; kind: "app" | "life"; editable: boolean };

/** Everything that could be shared, apps first (Potty Training at the top, since families ask for it most). */
export function shareCatalog(healthPeople: { id: string; name: string }[] = []): ShareItem[] {
  const apps = liveProApps().map((a): ShareItem => ({ id: appShareId(a.id), label: a.name, icon: a.icon, color: a.color, kind: "app", editable: true }));
  apps.sort((a, b) => Number(b.id === "app:potty") - Number(a.id === "app:potty"));
  const life: ShareItem[] = [
    ...LIFE_SHARES.map((s): ShareItem => ({ id: s.id, label: s.label, emoji: s.emoji, kind: "life", editable: false })),
    ...healthPeople.map((p): ShareItem => ({ id: healthShareId(p.id), label: `Food & fitness · ${p.name}`, emoji: "🍎", kind: "life", editable: false })),
  ];
  return [...apps, ...life];
}

const VALID_APP_IDS = () => new Set(liveProApps().map((a) => appShareId(a.id)));
const LIFE_IDS = new Set<string>(LIFE_SHARES.map((s) => s.id));

/** A saved or sent set of grants made safe: known ids only, LifeHub pages never above View. */
export function cleanGrants(raw: unknown): Grants {
  const out: Grants = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const apps = VALID_APP_IDS();
  for (const [id, v] of Object.entries(raw as Record<string, unknown>).slice(0, 300)) {
    if (v !== "view" && v !== "edit") continue;
    if (apps.has(id)) out[id] = v;
    else if (LIFE_IDS.has(id) || isHealthShareId(id)) out[id] = "view";
  }
  return out;
}

export const normalEmail = (v: unknown): string => {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  return e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : "";
};

export function cleanLinks(raw: unknown, ownerId: number): ProfileLink[] {
  const out: ProfileLink[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== "object") continue;
    const id = typeof r.id === "string" && /^[\w-]{6,40}$/.test(r.id) ? r.id : "";
    const email = normalEmail(r.email);
    if (!id || !email) continue;
    const viewerId = Number.isInteger(r.viewerId) && r.viewerId > 0 ? r.viewerId : undefined;
    out.push({
      id, ownerId, email, ...(viewerId ? { viewerId } : {}),
      nickname: typeof r.nickname === "string" ? r.nickname.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, LINK_LIMITS.nickname) : "",
      status: r.status === "active" && viewerId ? "active" : "pending",
      grants: cleanGrants(r.grants),
      createdAt: typeof r.createdAt === "string" ? r.createdAt.slice(0, 40) : "",
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt.slice(0, 40) : "",
    });
    if (out.length >= LINK_LIMITS.perOwner) break;
  }
  return out;
}

/** What this viewer may do with one shared thing of this owner's: "edit", "view" or null (nothing). */
export function accessFor(links: readonly ProfileLink[], viewerId: number, shareId: string): Access | null {
  const link = links.find((l) => l.status === "active" && l.viewerId === viewerId);
  const a = link?.grants[shareId];
  return a === "edit" || a === "view" ? a : null;
}

/** Does this access allow what's being asked? Edit allows view. */
export const allows = (have: Access | null, need: Access) => have === "edit" || (have === "view" && need === "view");
