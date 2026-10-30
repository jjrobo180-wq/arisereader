// Arise WorkHub: how a teacher arranges the Hub, chosen in Customize. Saved in the workspace, so it follows
// them to every device: where the menu sits on a phone, how it closes, and what Home shows in what order
// (including the picture box).
import { DEFAULT_HUB_THEME, isHubThemeId, type HubThemeId } from "./appThemes";
import { cleanShortcut, type HubShortcut } from "./hubShortcut";

/** Where the menu sits on a phone. On a computer it is always the sidebar on the left. */
/** "drawer" is an app drawer: a button at the bottom opens every section as app icons, like Android. */
/** "tabs" is the floating tab bar along the bottom (Home, Tasks, Add, Apps, You), the phone default in both hubs. */
export type MenuSide = "left" | "right" | "top" | "bottom" | "drawer" | "tabs";
/** How the phone menu closes: a Hide button (and a tab to bring it back), never, or by itself after a section is picked. */
export type MenuClose = "button" | "always" | "auto";

export const MENU_SIDES: { id: MenuSide; label: string }[] = [
  { id: "left", label: "Left side" }, { id: "right", label: "Right side" }, { id: "top", label: "Top" }, { id: "bottom", label: "Bottom" }, { id: "drawer", label: "App drawer" }, { id: "tabs", label: "Tab bar" },
];
export const MENU_CLOSES: { id: MenuClose; label: string; detail: string }[] = [
  { id: "button", label: "Hide button", detail: "Tap Hide to tuck it away, and the small tab to bring it back." },
  { id: "auto", label: "Closes after I pick", detail: "It tucks away by itself once you pick a section." },
  { id: "always", label: "Always open", detail: "It stays on screen and never hides." },
];

/** The parts of Home, in the order they start in. */
export const HOME_SECTIONS = [
  { id: "day", label: "Today's greeting" },
  { id: "widgets", label: "Widgets" },
  { id: "stats", label: "Quick counts" },
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

/** Where the menu sits on a computer. */
export type DeskSide = "left" | "right" | "compact" | "top" | "drawer";
export const DESK_SIDES: { id: DeskSide; label: string; detail: string }[] = [
  { id: "left", label: "Sidebar left", detail: "Names and icons down the left." },
  { id: "right", label: "Sidebar right", detail: "The same sidebar on the right." },
  { id: "compact", label: "Icons only", detail: "A slim strip of icons for more room." },
  { id: "top", label: "Top bar", detail: "Sections across the top." },
  { id: "drawer", label: "App drawer", detail: "No menu, just a button that opens every section as app icons." },
];

/** A folder in the menu: a name and the sections (menu items) inside it, like a folder of apps on a phone. */
export type MenuFolder = { id: string; name: string; items: string[] };
export const FOLDER_LIMIT = 12;

/** Saved folders made safe: named, each item in one folder only. */
export function cleanFolders(raw: unknown): MenuFolder[] {
  const seen = new Set<string>(), ids = new Set<string>(), out: MenuFolder[] = [];
  for (const f of Array.isArray(raw) ? raw.slice(0, FOLDER_LIMIT) : []) {
    if (!f || typeof f !== "object") continue;
    const name = String((f as any).name ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 30);
    let id = String((f as any).id ?? "").slice(0, 40) || `f${out.length + 1}`;
    if (!name || ids.has(id)) continue;
    ids.add(id);
    const items = (Array.isArray((f as any).items) ? (f as any).items : []).filter((x: unknown): x is string => typeof x === "string" && !!x && x.length <= 60 && !seen.has(x)).slice(0, 40);
    items.forEach((x: string) => seen.add(x));
    out.push({ id, name, items });
  }
  return out;
}

export type MenuEntry<T> = { kind: "item"; item: T } | { kind: "folder"; folder: MenuFolder; items: T[] };
/** The menu with folders: each folder sits where its first section was, holding its sections.
 *  A folder with nothing in it yet (just made in Customize) has no section to sit next to, so it
 *  shows at the end instead of disappearing — otherwise making a new folder looks like it did nothing. */
export function foldMenu<T extends { id: string }>(items: T[], folders: MenuFolder[]): MenuEntry<T>[] {
  const out: MenuEntry<T>[] = [], placed = new Set<string>();
  for (const item of items) {
    const f = folders.find((x) => x.items.includes(item.id));
    if (!f) { out.push({ kind: "item", item }); continue; }
    if (placed.has(f.id)) continue;
    placed.add(f.id);
    out.push({ kind: "folder", folder: f, items: items.filter((i) => f.items.includes(i.id)) });
  }
  for (const f of folders) if (!placed.has(f.id)) out.push({ kind: "folder", folder: f, items: [] });
  return out;
}

/** What every hub's layout has: where the phone menu sits, how it closes, and Home's parts in order, hidden and sized. */
export type AnyLayout = {
  menuSide: MenuSide;
  /** Where the menu sits on a computer. */
  deskSide: DeskSide;
  /** Folders the person made in the menu. */
  folders: MenuFolder[];
  menuClose: MenuClose;
  /** Every part of Home, in the person's order. Besides the hub's built-in parts, this can hold a
   *  pinned app's id (see pinId/unpinId below) for an installed app pinned to Home. */
  home: string[];
  /** The parts of Home that are hidden. */
  homeHidden: string[];
  /** Each part's size. A part not listed is large. */
  homeSize: Partial<Record<string, HomeSize>>;
  /** The hub's visual theme (see shared/appThemes.ts), chosen in Customize. */
  theme: HubThemeId;
  /** What the ⚡ button in the header opens (shared/hubShortcut.ts). Not set until the person picks something. */
  shortcut?: HubShortcut;
  /** 2 once the floating tab bar became the phone default (see cleanAnyLayout). */
  menuV?: 2;
};

/** A pinned app on Home is kept in `home`/`homeHidden`/`homeSize` under this id, so it never collides
 *  with a built-in part's id (which never has a colon) and can be told apart from one at a glance. */
export const pinId = (pluginId: string): string => `pin:${pluginId}`;
export const isPinId = (id: string): boolean => id.startsWith("pin:");
export const unpinId = (id: string): string => id.slice("pin:".length);
/** One widget from the Widgets board, placed on Home as its own part. Kept in `home` under this id so each
 *  widget remembers its own place. A saved id for a widget that no longer exists is simply skipped on Home. */
export const widgetHomeId = (widgetId: string): string => `w:${widgetId}`;
export const isWidgetHomeId = (id: string): boolean => /^w:[A-Za-z0-9_-]{1,64}$/.test(id);
export const widgetIdOf = (id: string): string => id.slice(2);

/** WorkHub's layout. */
export type HubLayout = AnyLayout & { home: HomeSection[]; homeHidden: HomeSection[]; homeSize: Partial<Record<HomeSection, HomeSize>> };

export const DEFAULT_LAYOUT: HubLayout = { menuSide: "tabs", deskSide: "left", folders: [], menuClose: "button", home: HOME_SECTIONS.map((s) => s.id), homeHidden: ["picture", "widgets"], homeSize: {}, theme: DEFAULT_HUB_THEME };

/**
 * A saved layout made safe for a hub whose Home has these parts (in their usual order): known choices only, every part
 * once (a part added later goes back right after the part it follows by default), and sizes only for real parts.
 * `pinnable` is every installed app's id that may be pinned to Home right now (Kit plugins, Notes apps): a saved
 * pin for an app that isn't installed any more is dropped, the same way an unknown built-in part would be.
 */
export function cleanAnyLayout<Id extends string>(raw: unknown, parts: readonly Id[], defaults: { menuSide: MenuSide; menuClose: MenuClose; homeHidden: Id[] }, pinnable: readonly string[] = []) {
  const r: any = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const isPinned = (x: unknown): x is string => typeof x === "string" && isPinId(x) && pinnable.includes(unpinId(x));
  const isPart = (x: unknown): x is Id => typeof x === "string" && ((parts as readonly string[]).includes(x) || isPinned(x) || isWidgetHomeId(x));
  // When the tab bar became the phone default, a layout still on the old default side rail moved to it once;
  // a menu picked in Customize after that (menuV 2) is kept, the side rail included.
  const oldDefault = defaults.menuSide === "tabs" && r.menuV !== 2 && (r.menuSide === undefined || r.menuSide === "left");
  const menuSide: MenuSide = oldDefault ? "tabs" : MENU_SIDES.some((s) => s.id === r.menuSide) ? r.menuSide : defaults.menuSide;
  const menuClose: MenuClose = MENU_CLOSES.some((c) => c.id === r.menuClose) ? r.menuClose : defaults.menuClose;
  const home: Id[] = [];
  for (const x of Array.isArray(r.home) ? r.home : []) if (isPart(x) && !home.includes(x)) home.push(x);
  parts.forEach((id, i) => {
    if (home.includes(id)) return;
    const before = i ? parts[i - 1] : null;
    home.splice(before ? home.indexOf(before) + 1 : 0, 0, id);
  });
  // A pinned app not already placed (newly installed, or pinned elsewhere and not yet saved here) goes
  // at the end, hidden, so pinning never happens until the app is actually added through the "Add to Home" tray.
  for (const id of pinnable.map(pinId)) if (!home.includes(id as Id)) home.push(id as Id);
  const homeHidden: Id[] = Array.isArray(r.homeHidden) ? [...new Set((r.homeHidden as unknown[]).filter(isPart))] : [...defaults.homeHidden];
  // A part that is new since this layout was saved starts the way it does on a new layout: hidden if it starts hidden there.
  if (Array.isArray(r.home) && Array.isArray(r.homeHidden)) {
    for (const id of defaults.homeHidden) if (!(r.home as unknown[]).includes(id) && !homeHidden.includes(id)) homeHidden.push(id);
  }
  // A pinned app starts hidden too, until it's added from the tray, same as a built-in part that starts hidden.
  for (const id of pinnable.map(pinId)) if (!homeHidden.includes(id as Id) && !(Array.isArray(r.home) && (r.home as unknown[]).includes(id))) homeHidden.push(id as Id);
  const homeSize: Partial<Record<Id, HomeSize>> = {};
  if (r.homeSize && typeof r.homeSize === "object") for (const [k, v] of Object.entries(r.homeSize)) if (isPart(k) && HOME_SIZES.some((z) => z.id === v)) homeSize[k] = v as HomeSize;
  const deskSide: DeskSide = DESK_SIDES.some((s) => s.id === r.deskSide) ? r.deskSide : "left";
  const theme: HubThemeId = isHubThemeId(r.theme) ? r.theme : DEFAULT_HUB_THEME;
  const shortcut = cleanShortcut(r.shortcut);
  return { menuSide, deskSide, folders: cleanFolders(r.folders), menuClose, home, homeHidden, homeSize, theme, ...(shortcut ? { shortcut } : {}), menuV: 2 as const };
}

/** WorkHub's saved layout made safe. `pinnable`: installed Kit-plugin/Notes-app ids (see pinId) that may be pinned to Home. */
export const cleanLayout = (raw: unknown, pinnable: readonly string[] = []): HubLayout => cleanAnyLayout(raw, HOME_SECTIONS.map((s) => s.id), DEFAULT_LAYOUT, pinnable);

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

/** The layout with a new visual theme chosen (see shared/appThemes.ts). */
export const setTheme = <L extends AnyLayout>(layout: L, theme: HubThemeId): L => ({ ...layout, theme });
