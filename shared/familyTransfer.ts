// Everything you share with someone in your family lives in FamilyHub: Accountability, Kitchen, Potty
// Training, the calendar, chores, bills, your to-do lists and every other app you share (Settings → Sharing).
// Each one is copied into FamilyHub (merged with anything already there, shared/hubMove.ts), turned on there,
// and turned off in your LifeHub (its data kept there too). Each share moves once (Family.movedToFamily), so
// moving one back to LifeHub by hand sticks. To-do lists are copied: Tasks stays in both hubs.
//
// Version 2 (Nov 23, 2026): Kitchen moved as the old Meal plan, Kitchen's saved data didn't copy, and
// shared to-do lists and some apps were left out. Everything moved by version 1 is moved again once.
import { familyMine } from "./familyShared";
import { itemForShare, itemKey, moveItem, type HubItem, type HubWorkspace } from "./hubMove";
import type { Family } from "./familyHub";

export const TRANSFER_VERSION = 2;

export type FamilyMove = { ids: string[]; items: HubItem[] };

/** What this LifeHub has already moved (none, when it was moved by an older version). */
export const movedAlready = (life: Pick<Family, "movedToFamily" | "familyMoveV">) => (life.familyMoveV === TRANSFER_VERSION ? life.movedToFamily ?? [] : []);

/** The things I share with people in my family that haven't moved to FamilyHub yet. */
export function pendingMoves(mine: Parameters<typeof familyMine>[0], familyIds: number[], me: number, life: Pick<Family, "movedToFamily" | "familyMoveV">): FamilyMove {
  const done = movedAlready(life);
  const ids = familyMine(mine, familyIds, me).map((r) => r.id).filter((id) => !done.includes(id));
  const items = new Map<string, HubItem>();
  for (const id of ids) { const item = itemForShare(id); if (item) items.set(itemKey(item), item); }
  return { ids, items: [...items.values()] };
}

/** FamilyHub with everything in the move copied in and turned on. */
export function intoFamily(life: HubWorkspace, fam: HubWorkspace, m: FamilyMove): HubWorkspace {
  let to = fam;
  for (const item of m.items) to = moveItem(life, to, item).to;
  return to;
}

/** LifeHub with those apps turned off (data kept) and remembered as moved, by this version. */
export function outOfLife(life: HubWorkspace, m: FamilyMove): HubWorkspace {
  let from = life;
  for (const item of m.items) from = moveItem(from, from, item).from;
  const family = from.family;
  return { ...from, family: { ...family, familyMoveV: TRANSFER_VERSION, movedToFamily: [...new Set([...movedAlready(life.family), ...m.ids])].slice(-200) } };
}
