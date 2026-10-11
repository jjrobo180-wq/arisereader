// Arise WorkHub: how a teacher arranges the Hub, chosen in Customize. Saved in the workspace, so it follows
// them to every device: where the menu sits on a phone, how it closes, and what Home shows in what order
// (including the picture box).

/** Where the menu sits on a phone. On a computer it is always the sidebar on the left. */
export type MenuSide = "left" | "right" | "bottom";
/** How the phone menu closes: a Hide button (and a tab to bring it back), never, or by itself after a section is picked. */
export type MenuClose = "button" | "always" | "auto";

export const MENU_SIDES: { id: MenuSide; label: string }[] = [
  { id: "left", label: "Left side" }, { id: "right", label: "Right side" }, { id: "bottom", label: "Bottom" },
];
export const MENU_CLOSES: { id: MenuClose; label: string; detail: string }[] = [
  { id: "button", label: "Hide button", detail: "Tap Hide to tuck it away, and the small tab to bring it back." },
  { id: "auto", label: "Closes after I pick", detail: "It tucks away by itself once you pick a section." },
  { id: "always", label: "Always open", detail: "It stays on screen and never hides." },
];

/** The parts of Home, in the order they start in. */
export const HOME_SECTIONS = [
  { id: "day", label: "Today's greeting" },
  { id: "picture", label: "Picture box" },
  { id: "agenda", label: "Today's agenda" },
  { id: "add", label: "Add things fast" },
  { id: "calendar", label: "Your calendar" },
  { id: "meetings", label: "Upcoming meetings" },
  { id: "todo", label: "To do" },
  { id: "notifications", label: "Notifications" },
  { id: "profile", label: "Workspace profile" },
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number]["id"];

export type HubLayout = {
  menuSide: MenuSide;
  menuClose: MenuClose;
  /** Every part of Home, in the teacher's order. */
  home: HomeSection[];
  /** The parts of Home that are hidden. The picture box starts hidden. */
  homeHidden: HomeSection[];
};

export const DEFAULT_LAYOUT: HubLayout = { menuSide: "left", menuClose: "button", home: HOME_SECTIONS.map((s) => s.id), homeHidden: ["picture"] };

const isSection = (x: unknown): x is HomeSection => HOME_SECTIONS.some((s) => s.id === x);

/** A saved layout made safe: known choices only, every part of Home once (a part added later goes in its usual place). */
export function cleanLayout(raw: unknown): HubLayout {
  const r: any = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const menuSide: MenuSide = MENU_SIDES.some((s) => s.id === r.menuSide) ? r.menuSide : DEFAULT_LAYOUT.menuSide;
  const menuClose: MenuClose = MENU_CLOSES.some((c) => c.id === r.menuClose) ? r.menuClose : DEFAULT_LAYOUT.menuClose;
  const saved: HomeSection[] = [];
  for (const x of Array.isArray(r.home) ? r.home : []) if (isSection(x) && !saved.includes(x)) saved.push(x);
  // A part missing from the saved order goes back right after the part it follows by default.
  const home = [...saved];
  HOME_SECTIONS.forEach((s, i) => {
    if (home.includes(s.id)) return;
    const before = i ? HOME_SECTIONS[i - 1].id : null;
    const at = before ? home.indexOf(before) + 1 : 0;
    home.splice(at, 0, s.id);
  });
  const homeHidden = Array.isArray(r.homeHidden) ? [...new Set((r.homeHidden as unknown[]).filter(isSection))] : DEFAULT_LAYOUT.homeHidden;
  return { menuSide, menuClose, home, homeHidden };
}

/** The parts of Home that show, in order. */
export const homeShown = (layout: HubLayout): HomeSection[] => layout.home.filter((s) => !layout.homeHidden.includes(s));

/** The order with one part moved up (-1) or down (+1). */
export function moveSection(layout: HubLayout, id: HomeSection, by: -1 | 1): HubLayout {
  const home = [...layout.home];
  const at = home.indexOf(id), to = at + by;
  if (at < 0 || to < 0 || to >= home.length) return layout;
  [home[at], home[to]] = [home[to], home[at]];
  return { ...layout, home };
}

/** The layout with a part of Home shown or hidden. */
export const showSection = (layout: HubLayout, id: HomeSection, on: boolean): HubLayout =>
  ({ ...layout, homeHidden: on ? layout.homeHidden.filter((x) => x !== id) : [...new Set([...layout.homeHidden, id])] });
