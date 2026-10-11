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
] as const;
export type LifePart = (typeof LIFE_PARTS)[number]["id"];

export type LifeLayout = AnyLayout & { home: LifePart[]; homeHidden: LifePart[] };

/** LifeHub starts with the menu across the top on a phone, as it always was. */
export const cleanLifeLayout = (raw: unknown): LifeLayout =>
  cleanAnyLayout(raw, LIFE_PARTS.map((p) => p.id), { menuSide: "top", menuClose: "button", homeHidden: ["widgets"] }) as LifeLayout;
