// Arise WorkHub & LifeHub: visual themes, chosen in Customize alongside layout (menu side, folders,
// Home). This is a look for the hub itself — colors, surfaces and a little personality — separate
// from the "Make it yours" layout choices in hubLayout.ts/lifeLayout.ts.
//
// A theme is a small set of CSS custom-property overrides applied on the hub's own root element
// (via a data attribute, see useHubTheme in the client), never on the whole document, so switching
// a hub's theme never touches the Reader site's own colors or any other hub's.

export type HubThemeId =
  | "classic" | "minimal" | "tile" | "sunrise" | "forest" | "candy" | "crt";

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
    id: "minimal", name: "Minimalist", tagline: "Black, white and a lot of breathing room.",
    swatch: ["#ffffff", "#111111", "#e5e5e5"],
    vars: {
      "--hub-bg": "#ffffff", "--hub-surface": "#ffffff", "--hub-surface-2": "#fafafa",
      "--hub-border": "#e5e5e5", "--hub-text": "#111111", "--hub-text-soft": "#6b7280",
      "--hub-accent": "#111111", "--hub-accent-foreground": "#ffffff",
    },
    radius: "sharp", shadow: "none", font: "system",
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
    id: "sunrise", name: "Sunrise", tagline: "Warm coral-to-amber gradient, soft and friendly.",
    swatch: ["#ff7e5f", "#feb47b", "#fff3e0"],
    vars: {
      "--hub-bg": "#fff8f1", "--hub-surface": "#ffffff", "--hub-surface-2": "#fff1e4",
      "--hub-border": "#ffd9b8", "--hub-text": "#3a2317", "--hub-text-soft": "#8a6652",
      "--hub-accent": "#ff7e5f", "--hub-accent-foreground": "#ffffff",
    },
    radius: "round", shadow: "soft", font: "rounded",
  },
  {
    id: "forest", name: "Forest", tagline: "Deep green and warm wood tones.",
    swatch: ["#1b4332", "#74c69d", "#f1faee"],
    vars: {
      "--hub-bg": "#f1faee", "--hub-surface": "#ffffff", "--hub-surface-2": "#e9f5e4",
      "--hub-border": "#cde8d1", "--hub-text": "#1b3a2b", "--hub-text-soft": "#4f7a62",
      "--hub-accent": "#1b4332", "--hub-accent-foreground": "#ffffff",
    },
    radius: "normal", shadow: "soft", font: "system",
  },
  {
    id: "candy", name: "Candy Pop", tagline: "Bright pink and violet, playful and bold.",
    swatch: ["#ff4fa3", "#8b5cf6", "#fff0f7"],
    vars: {
      "--hub-bg": "#fff0f7", "--hub-surface": "#ffffff", "--hub-surface-2": "#ffe3f0",
      "--hub-border": "#ffc2e2", "--hub-text": "#3a1030", "--hub-text-soft": "#9c5a86",
      "--hub-accent": "#ff4fa3", "--hub-accent-foreground": "#ffffff",
    },
    radius: "round", shadow: "soft", font: "rounded",
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
