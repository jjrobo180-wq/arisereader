// Arise WorkHub & LifeHub: visual themes, chosen in Customize alongside layout (menu side, folders,
// Home). This is a look for the hub itself — colors, surfaces and a little personality — separate
// from the "Make it yours" layout choices in hubLayout.ts/lifeLayout.ts.
//
// A theme is a small set of CSS custom-property overrides applied on the hub's own root element
// (via a data attribute, see useHubTheme in the client), never on the whole document, so switching
// a hub's theme never touches the Reader site's own colors or any other hub's.

export type HubThemeId =
  | "classic" | "tile" | "crt";

export type HubTheme = {
  id: HubThemeId;
  name: string;
  tagline: string;
  /** A tiny swatch for the picker: the few colors that read as "this theme" at a glance. */
  swatch: string[];
  /** CSS custom properties set on the hub root. Values are raw CSS (not HSL triples) so a theme
   *  can mix flat colors, gradients-as-background-image classes read these, etc. */
  vars: Record<string, string>;
  /** A few structural tweaks a theme can ask for, read by the hub shell. */
  radius?: "sharp" | "normal" | "round";
  shadow?: "none" | "soft" | "hard";
  font?: "system" | "mono" | "rounded";
  /** Which Home layout shape this theme uses (read by HomeParts, components/teacher-hub/
   *  HubHomeEdit.tsx) — not just color, an actually different grid/tile structure:
   *    "cards"    - today's layout: a wide responsive grid, soft rounded cards. The default.
   *    "tiles"    - Windows-Phone-style: a dense grid of uniform solid-color square tiles, no
   *                 small/medium/large size mixing, name pinned to the tile's bottom-left corner.
   *    "terminal" - CRT-style: a single-column stacked list of boxy bordered panels, bracketed
   *                 labels, no tile pictures.
   *  Adding a new structural variant means adding its id here and teaching HomeParts to render
   *  it — the layout logic itself (drag, reorder, resize, hide) never changes per variant. */
  homeLayout?: "cards" | "tiles" | "terminal";
};

export const HUB_THEMES: HubTheme[] = [
  {
    id: "classic", name: "Classic", tagline: "The hub as it's always looked.",
    swatch: ["#292446", "#f7f8ff", "#7566e8"],
    vars: {}, radius: "normal", shadow: "soft", font: "system",
  },
  {
    id: "tile", name: "Tile", tagline: "Bold flat color blocks, live tile style.",
    swatch: ["#00a2e8", "#ffffff", "#f2600c"],
    vars: {
      "--hub-bg": "#0a0a0a", "--hub-surface": "#00a2e8", "--hub-surface-2": "#1a1a1a",
      "--hub-border": "#000000", "--hub-text": "#ffffff", "--hub-text-soft": "#d6e9f7",
      "--hub-accent": "#f2600c", "--hub-accent-foreground": "#ffffff",
    },
    radius: "sharp", shadow: "none", font: "system", homeLayout: "tiles",
  },
  {
    id: "crt", name: "Old Computer", tagline: "Green phosphor text on a black CRT screen.",
    swatch: ["#000000", "#33ff33", "#003300"],
    vars: {
      "--hub-bg": "#0a0f0a", "--hub-surface": "#0d140d", "--hub-surface-2": "#0a100a",
      "--hub-border": "#1f4d1f", "--hub-text": "#33ff33", "--hub-text-soft": "#1f9e1f",
      "--hub-accent": "#33ff33", "--hub-accent-foreground": "#001400",
      "--hub-scanlines": "1",
    },
    radius: "sharp", shadow: "hard", font: "mono", homeLayout: "terminal",
  },
];

export const DEFAULT_HUB_THEME: HubThemeId = "classic";

export const isHubThemeId = (v: unknown): v is HubThemeId => HUB_THEMES.some((t) => t.id === v);
export const hubThemeOf = (id: unknown): HubTheme => HUB_THEMES.find((t) => t.id === id) ?? HUB_THEMES[0];
