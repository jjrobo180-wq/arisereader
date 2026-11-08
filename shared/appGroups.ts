/** (Health, Kitchen, journal and quote pages are bundled plugins now: shared/appBundles.ts.)
 *  LifeHub apps that belong together share one tile in the menu and a tab strip inside.
 *  A group's tile opens its first app the person has turned on; the strip switches between the rest. */
import type { FamilySection } from "./familyHub";

export type AppGroup = { id: string; label: string; detail: string; members: FamilySection[] };

export const APP_GROUPS: AppGroup[] = [
  { id: "money", label: "Money", detail: "Budget, subscriptions, loans, IOUs, allowance", members: ["money", "subscriptions", "loans", "mortgage", "ious", "allowance", "jars", "tips", "giftcards"] },
  { id: "homecar", label: "Home & car", detail: "Upkeep, cleaning, plants, car, mileage, warranties", members: ["upkeep", "cleaning", "plants", "car", "mileage", "warranties"] },
  { id: "gifts", label: "Gifts & dates", detail: "Birthdays, gift ideas, wishlist, countdowns", members: ["birthdays", "gifts", "wishlist", "countdowns"] },
  { id: "habits", label: "Routines & milestones", detail: "Family routines and milestones", members: ["routines", "milestones"] },
  { id: "calm", label: "Focus & clocks", detail: "Focus timer and world clock", members: ["focus", "clocks"] },
  { id: "reads", label: "Daily reads", detail: "News, history, trending, dictionary", members: ["news", "history", "trending", "dictionary"] },
  { id: "lists", label: "Lists", detail: "Reading, watchlist, bucket list, learning", members: ["reading", "watchlist", "bucket", "learning"] },
];

export const groupOf = (id: string): AppGroup | undefined => APP_GROUPS.find((g) => (g.members as string[]).includes(id));

/** The members of this id's group that are turned on, in group order. Empty when it is not grouped. */
export function groupMembers(id: string, on: readonly string[]): FamilySection[] {
  const g = groupOf(id);
  return g ? g.members.filter((m) => on.includes(m)) : [];
}

/** The app a group's tile opens, and the id its passcode lock is kept under. */
export function leadOf(id: string, on: readonly string[]): string {
  const m = groupMembers(id, on);
  return m.length > 1 ? m[0] : id;
}

/** Keep one id per group (its lead). A group with a single app on stays a plain app. */
export function collapseGroups<T extends string>(ids: readonly T[], on: readonly string[]): T[] {
  return ids.filter((id) => { const m = groupMembers(id, on); return m.length < 2 || m[0] === id; });
}

/** The name to show for an id: the group's, when it has two or more apps on. */
export function groupLabel(id: string, on: readonly string[], own: string): string {
  const g = groupOf(id);
  return g && groupMembers(id, on).length > 1 ? g.label : own;
}
