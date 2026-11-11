// LifeHub apps shared between two accounts (Settings → Sharing, and the Share button in each app):
// which part of the family's saved data each app is, so a partner can open the owner's copy of that app
// and, with Edit, change it. The server only ever reads and writes these parts of the owner's LifeHub
// (server/profileLinks.ts), and the person sharing chooses who sees which.
import { BUNDLES } from "./appBundles";
import type { Family, FamilySection } from "./familyHub";

/** One piece of saved data: a family field, or only the items of some kinds in it (care, collections),
 *  or only some Plugin Kit records (kit, by plugin). */
export type AppPart = { key: keyof Family; kinds?: string[]; plugins?: string[] };
export type SharedApp = { id: string; section: FamilySection; label: string; emoji: string; parts: AppPart[]; personal?: boolean };

const P = (key: keyof Family, more: Partial<AppPart> = {}): AppPart => ({ key, ...more });
const care = (kind: string) => P("care", { kinds: [kind] });
const coll = (kind: string) => P("collections", { kinds: [kind] });

/** The apps (by LifeHub section). Older share ids are kept: Bills is "life:bills", Kitchen is "life:meals". */
const BASE: Omit<SharedApp, "id">[] = [
  { section: "calendar", label: "Calendar", emoji: "📅", parts: [P("calendars"), P("events")] },
  { section: "money", label: "Bills & budget", emoji: "🧾", parts: [P("bills"), P("budget"), P("expenses"), P("income"), P("money")] },
  { section: "chores", label: "Chores", emoji: "🧹", parts: [P("chores"), P("choreDone"), P("rewards"), P("redemptions")] },
  { section: "behavior", label: "Behavior & rewards", emoji: "⭐", parts: [P("behavior"), P("rewards"), P("redemptions")] },
  { section: "goals", label: "Goals", emoji: "🎯", parts: [P("goals")] },
  { section: "trips", label: "Trips", emoji: "✈️", parts: [P("trips")] },
  { section: "polls", label: "Family votes", emoji: "🗳️", parts: [P("polls")] },
  { section: "links", label: "Link page", emoji: "🔗", parts: [P("linkPage")] },
  { section: "notes", label: "Notes", emoji: "📝", parts: [P("notes")] },
  { section: "countdowns", label: "Countdowns", emoji: "⏳", parts: [P("countdowns")] },
  { section: "birthdays", label: "Birthdays", emoji: "🎂", parts: [P("birthdays")] },
  { section: "contacts", label: "Contacts", emoji: "📇", parts: [P("contacts")] },
  { section: "subscriptions", label: "Subscriptions", emoji: "🔁", parts: [P("subscriptions")] },
  { section: "jars", label: "Savings jars", emoji: "🫙", parts: [P("jars")] },
  { section: "ious", label: "IOUs", emoji: "🤝", parts: [P("ious")] },
  { section: "allowance", label: "Allowance", emoji: "💵", parts: [P("allowance")] },
  { section: "giftcards", label: "Gift cards", emoji: "🎁", parts: [P("giftCards")] },
  { section: "warranties", label: "Warranties", emoji: "🧾", parts: [P("warranties")] },
  { section: "mileage", label: "Mileage", emoji: "🚗", parts: [P("mileage"), P("mileageRate")] },
  { section: "medical", label: "Medical cards", emoji: "🩺", parts: [P("medical")] },
  { section: "pills", label: "Medicine", emoji: "💊", parts: [P("pills"), P("pillDoses")] },
  { section: "routines", label: "Routines", emoji: "✅", parts: [P("routines")] },
  { section: "milestones", label: "Milestones", emoji: "👶", parts: [P("milestones")] },
  { section: "habits", label: "Habits", emoji: "🔁", parts: [P("habits")] },
  { section: "randomizer", label: "Randomizer", emoji: "🎲", parts: [P("randomLists")] },
  { section: "workouts", label: "Workout log", emoji: "🏋️", parts: [P("workouts")] },
  { section: "upkeep", label: "Home upkeep", emoji: "🏠", parts: [care("upkeep")] },
  { section: "plants", label: "Plants", emoji: "🪴", parts: [care("plants")] },
  { section: "car", label: "Car care", emoji: "🚙", parts: [care("car")] },
  { section: "pets", label: "Pets", emoji: "🐶", parts: [care("pets")] },
  { section: "cleaning", label: "Cleaning schedule", emoji: "🧽", parts: [care("cleaning")] },
  { section: "checkups", label: "Health checkups", emoji: "🩻", parts: [care("checkups")] },
  { section: "reading", label: "Reading list", emoji: "📚", parts: [coll("reading")] },
  { section: "watchlist", label: "Watchlist", emoji: "🎬", parts: [coll("watchlist")] },
  { section: "bucket", label: "Bucket list", emoji: "🪣", parts: [coll("bucket")] },
  { section: "gifts", label: "Gift ideas", emoji: "🎀", parts: [coll("gifts")] },
  { section: "wishlist", label: "Wishlist", emoji: "💝", parts: [coll("wishlist")] },
  { section: "restaurants", label: "Restaurants", emoji: "🍽️", parts: [coll("restaurants")] },
  { section: "learning", label: "Learning goals", emoji: "🎓", parts: [coll("learning")] },
  { section: "projects", label: "Home projects", emoji: "🔨", parts: [coll("projects")] },
  { section: "loans", label: "Lent items", emoji: "📦", parts: [coll("loans")] },
  { section: "grocery", label: "Shopping list", emoji: "🛒", parts: [P("groceries")] },
  { section: "meals", label: "Meal plan", emoji: "🍲", parts: [P("meals"), P("groceries"), P("recipes")] },
  { section: "recipes", label: "Recipes", emoji: "📖", parts: [P("recipes"), P("groceries")] },
  { section: "clocks", label: "World clock", emoji: "🌍", parts: [P("clocks")] },
  { section: "bible", label: "Saved verses", emoji: "📖", parts: [P("savedVerses")] },
  { section: "quotes", label: "Saved quotes", emoji: "💬", parts: [P("savedQuotes")] },
  { section: "dictionary", label: "Saved words", emoji: "🔤", parts: [P("savedWords")] },
  // Personal ones: they can be shared, they're just not in "everything".
  { section: "journal", label: "Journal", emoji: "📔", parts: [P("journal")], personal: true },
  { section: "mood", label: "Mood", emoji: "🙂", parts: [P("moods")], personal: true },
  { section: "gratitude", label: "Gratitude", emoji: "🙏", parts: [P("gratitude")], personal: true },
  { section: "focus", label: "Focus log", emoji: "🎧", parts: [P("focusLog")], personal: true },
  { section: "meditate", label: "Meditation", emoji: "🧘", parts: [P("meditations")], personal: true },
  { section: "sleep", label: "Sleep", emoji: "😴", parts: [P("sleep"), P("sleepApp")], personal: true },
  { section: "cycle", label: "Period tracker", emoji: "🌸", parts: [P("cycleLogs")], personal: true },
];
const LEGACY_IDS: Partial<Record<FamilySection, string>> = { money: "life:bills" };

/** A bundle (Kitchen, Money…) is everything its pages keep, plus its Plugin Kit pages' records. */
function bundleApps(): Omit<SharedApp, "id">[] {
  const base = new Map(BASE.map((a) => [a.section, a]));
  return BUNDLES.map((b) => {
    const members = [...b.fixed, ...b.groups.flatMap((g) => g.members.map((m) => m.id))];
    const parts: AppPart[] = [];
    const add = (p: AppPart) => { const same = parts.find((x) => x.key === p.key); if (!same) parts.push({ ...p, ...(p.kinds ? { kinds: [...p.kinds] } : {}) }); else if (same.kinds && p.kinds) same.kinds = Array.from(new Set([...same.kinds, ...p.kinds])); else if (!p.kinds) delete same.kinds; };
    for (const m of members) { const a = base.get(m); if (a) a.parts.forEach(add); }
    if (b.section === "kitchen") add(P("kitchen"));
    const kit = members.filter((m) => !base.has(m));
    if (kit.length) parts.push(P("kit", { plugins: kit }));
    return { section: b.section as FamilySection, label: b.name, emoji: b.section === "kitchen" ? "🍳" : b.section === "moneyhub" ? "💰" : "🧩", parts };
  }).filter((a) => a.parts.length);
}

export const SHARED_APPS: SharedApp[] = [...BASE, ...bundleApps()].map((a) => ({ ...a, id: a.section === "kitchen" ? "life:meals" : LEGACY_IDS[a.section] || `life:${a.section}` }));
export const sharedAppFor = (section: string) => SHARED_APPS.find((a) => a.section === section);
export const sharedAppById = (id: string) => SHARED_APPS.find((a) => a.id === id);
/** The name to show for a shared app: Kitchen took over the meal plan's id, so its name wins. */
export const sharedAppLabel = (id: string) => [...SHARED_APPS].reverse().find((a) => a.id === id)?.label;

/** What an app keeps, out of a family. */
export function pickParts(family: Partial<Family>, parts: AppPart[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of parts) {
    const v = (family as any)[p.key];
    if (p.kinds) out[p.key] = (Array.isArray(v) ? v : []).filter((x: any) => p.kinds!.includes(x?.kind));
    else if (p.plugins) out[p.key] = (Array.isArray(v) ? v : []).filter((x: any) => p.plugins!.includes(x?.plugin));
    else out[p.key] = v;
  }
  return out;
}

/** Puts an app's data back into a family: its own items replaced, everything else in the family left alone. */
export function applyParts<F extends Partial<Family>>(family: F, parts: AppPart[], slice: Record<string, unknown>): F {
  const next: any = { ...family };
  for (const p of parts) {
    if (!(p.key in slice)) continue;
    const v = slice[p.key];
    if (p.kinds || p.plugins) {
      const keep = (Array.isArray(next[p.key]) ? next[p.key] : []).filter((x: any) => (p.kinds ? !p.kinds.includes(x?.kind) : !p.plugins!.includes(x?.plugin)));
      const mine = (Array.isArray(v) ? v : []).filter((x: any) => (p.kinds ? p.kinds.includes(x?.kind) : p.plugins!.includes(x?.plugin)));
      next[p.key] = [...keep, ...mine];
    } else next[p.key] = v;
  }
  return next;
}

/** Merging your own copy into a shared one: lists are joined (an item already there by id isn't added twice);
 *  anything else keeps the shared copy's value, unless it's empty there. */
export function mergeSlices(shared: Record<string, unknown>, mine: Record<string, unknown>, parts: AppPart[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...shared };
  for (const p of parts) {
    const a = shared[p.key], b = mine[p.key];
    if (Array.isArray(a) || Array.isArray(b)) {
      const list = Array.isArray(a) ? [...a] : [];
      const seen = new Set(list.map((x: any) => (x && typeof x === "object" && "id" in x ? `id:${x.id}` : JSON.stringify(x))));
      for (const x of Array.isArray(b) ? b : []) { const k = x && typeof x === "object" && "id" in x ? `id:${(x as any).id}` : JSON.stringify(x); if (!seen.has(k)) { seen.add(k); list.push(x); } }
      out[p.key] = list;
    } else if (a === undefined || a === null || a === "" || a === 0 || (typeof a === "object" && a && !Object.keys(a).length)) out[p.key] = b;
  }
  return out;
}

/** Whether a slice has anything in it (to know if there's something of yours to merge). */
export const sliceHasData = (slice: Record<string, unknown>) => Object.values(slice).some((v) => (Array.isArray(v) ? v.length > 0 : false));
