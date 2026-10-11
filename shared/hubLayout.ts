// Arise WorkHub: how a teacher arranges the Hub, chosen in Customize. Saved in the workspace, so it follows
// them to every device: where the menu sits on a phone, how it closes, and what Home shows in what order
// (including the picture box).

/** Where the menu sits on a phone. On a computer it is always the sidebar on the left. */
/** "drawer" is an app drawer: a button at the bottom opens every section as app icons, like Android. */
export type MenuSide = "left" | "right" | "top" | "bottom" | "drawer";
/** How the phone menu closes: a Hide button (and a tab to bring it back), never, or by itself after a section is picked. */
export type MenuClose = "button" | "always" | "auto";

export const MENU_SIDES: { id: MenuSide; label: string }[] = [
  { id: "left", label: "Left side" }, { id: "right", label: "Right side" }, { id: "top", label: "Top" }, { id: "bottom", label: "Bottom" }, { id: "drawer", label: "App drawer" },
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

/** How big a part of Home is, like an iPhone widget: small is half the width, medium is the full width but short, large is the full width at its own height. */
export type HomeSize = "small" | "medium" | "large";
export const HOME_SIZES: { id: HomeSize; short: string; label: string }[] = [
  { id: "small", short: "S", label: "Small" }, { id: "medium", short: "M", label: "Medium" }, { id: "large", short: "L", label: "Large" },
];

/** What every hub's layout has: where the phone menu sits, how it closes, and Home's parts in order, hidden and sized. */
export type AnyLayout = {
  menuSide: MenuSide;
  menuClose: MenuClose;
  /** Every part of Home, in the person's order. */
  home: string[];
  /** The parts of Home that are hidden. */
  homeHidden: string[];
  /** Each part's size. A part not listed is large. */
  homeSize: Partial<Record<string, HomeSize>>;
};

/** WorkHub's layout. */
export type HubLayout = AnyLayout & { home: HomeSection[]; homeHidden: HomeSection[]; homeSize: Partial<Record<HomeSection, HomeSize>> };

export const DEFAULT_LAYOUT: HubLayout = { menuSide: "left", menuClose: "button", home: HOME_SECTIONS.map((s) => s.id), homeHidden: ["picture"], homeSize: {} };

/**
 * A saved layout made safe for a hub whose Home has these parts (in their usual order): known choices only, every part
 * once (a part added later goes back right after the part it follows by default), and sizes only for real parts.
 */
export function cleanAnyLayout<Id extends string>(raw: unknown, parts: readonly Id[], defaults: { menuSide: MenuSide; menuClose: MenuClose; homeHidden: Id[] }) {
  const r: any = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const isPart = (x: unknown): x is Id => typeof x === "string" && (parts as readonly string[]).includes(x);
  const menuSide: MenuSide = MENU_SIDES.some((s) => s.id === r.menuSide) ? r.menuSide : defaults.menuSide;
  const menuClose: MenuClose = MENU_CLOSES.some((c) => c.id === r.menuClose) ? r.menuClose : defaults.menuClose;
  const home: Id[] = [];
  for (const x of Array.isArray(r.home) ? r.home : []) if (isPart(x) && !home.includes(x)) home.push(x);
  parts.forEach((id, i) => {
    if (home.includes(id)) return;
    const before = i ? parts[i - 1] : null;
    home.splice(before ? home.indexOf(before) + 1 : 0, 0, id);
  });
  const homeHidden: Id[] = Array.isArray(r.homeHidden) ? [...new Set((r.homeHidden as unknown[]).filter(isPart))] : [...defaults.homeHidden];
  const homeSize: Partial<Record<Id, HomeSize>> = {};
  if (r.homeSize && typeof r.homeSize === "object") for (const [k, v] of Object.entries(r.homeSize)) if (isPart(k) && HOME_SIZES.some((z) => z.id === v)) homeSize[k] = v as HomeSize;
  return { menuSide, menuClose, home, homeHidden, homeSize };
}

/** WorkHub's saved layout made safe. */
export const cleanLayout = (raw: unknown): HubLayout => cleanAnyLayout(raw, HOME_SECTIONS.map((s) => s.id), DEFAULT_LAYOUT);

/** The parts of Home that show, in order. */
export const homeShown = <L extends AnyLayout>(layout: L): L["home"] => layout.home.filter((s) => !layout.homeHidden.includes(s));

/** The order with one part moved up (-1) or down (+1). */
export function moveSection<L extends AnyLayout>(layout: L, id: string, by: -1 | 1): L {
  const home = [...layout.home];
  const at = home.indexOf(id), to = at + by;
  if (at < 0 || to < 0 || to >= home.length) return layout;
  [home[at], home[to]] = [home[to], home[at]];
  return { ...layout, home };
}

/** The layout with a part of Home shown or hidden. */
export const showSection = <L extends AnyLayout>(layout: L, id: string, on: boolean): L =>
  ({ ...layout, homeHidden: on ? layout.homeHidden.filter((x) => x !== id) : [...new Set([...layout.homeHidden, id])] });

/** A part's size (large unless it was changed). */
export const sizeOf = (layout: AnyLayout, id: string): HomeSize => layout.homeSize[id] || "large";
/** The layout with a part resized. */
export const resizeSection = <L extends AnyLayout>(layout: L, id: string, size: HomeSize): L => ({ ...layout, homeSize: { ...layout.homeSize, [id]: size } });
