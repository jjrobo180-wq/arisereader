// Arise LifeHub: how a family arranges the hub, chosen in Customize or on Home itself. The same choices as
// WorkHub's (shared/hubLayout.ts): where the phone menu sits, how it closes, and Home's parts in order and size.
import { cleanAnyLayout, type AnyLayout } from "./hubLayout";

/** The parts of LifeHub's Home, in the order they start in. */
export const LIFE_PARTS = [
  { id: "greeting", label: "Today's greeting" },
  { id: "widgets", label: "Widgets" },
  { id: "stats", label: "Quick counts" },
  { id: "agenda", label: "Today's agenda" },
  { id: "chores", label: "Chores" },
  { id: "polls", label: "Open polls" },
  { id: "trip", label: "Next trip" },
  { id: "mood", label: "Mood" },
  { id: "goals", label: "Goals" },
  { id: "health", label: "Food & fitness" },
  { id: "stars", label: "Kids' stars" },
  { id: "bills", label: "Bills due" },
  { id: "notes", label: "Pinned notes" },
  { id: "links", label: "My links" },
] as const;
export type LifePart = (typeof LIFE_PARTS)[number]["id"];

export type LifeLayout = AnyLayout & { home: LifePart[]; homeHidden: LifePart[]; /** 2 once the tab bar became the phone default. */ menuV?: 2 };

/** LifeHub starts with the floating tab bar on a phone (WorkHub keeps the side rail). A layout saved
 *  before the tab bar existed, still on the old default side rail, moves to the tab bar once; picking
 *  any menu in Customize after that is kept.
 *  `pinnable`: installed Kit-plugin/Notes-app ids (see pinId in hubLayout.ts) that may be pinned to Home. */
export const cleanLifeLayout = (raw: unknown, pinnable: readonly string[] = []): LifeLayout => {
  const r: any = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const old = r.menuV !== 2 && (r.menuSide === undefined || r.menuSide === "left");
  const clean = cleanAnyLayout(old ? { ...r, menuSide: "tabs" } : r, LIFE_PARTS.map((p) => p.id), { menuSide: "tabs", menuClose: "button", homeHidden: ["widgets"] }, pinnable) as LifeLayout;
  return { ...clean, menuV: 2 };
};
