// Arise Fit's color themes (no imports, so tests can load it). fitUi.tsx turns these into the app's CSS.
// ——— Color themes ——————————————————————————————————————————————————————————————————————————————
// Each theme has an accent for Light and one for Dark (Light's is deeper so it reads on white), and the
// text color that sits on it. The glow, the soft tint, the deep end of gradients and the see-through
// versions are worked out from the accent, so every theme looks finished in both modes.
export type PaletteId = "ember" | "volt" | "ocean" | "aqua" | "berry" | "violet" | "gold" | "crimson" | "mono" | "tide";
type Pal = { name: string; light: [accent: string, on: string]; dark: [accent: string, on: string] };
export const PALETTES: Record<PaletteId, Pal> = {
  ember: { name: "Ember", light: ["#ff5a1f", "#0b0b0c"], dark: ["#ff5a1f", "#0b0b0c"] },
  volt: { name: "Volt", light: ["#5b9e00", "#0b0b0c"], dark: ["#c4f53b", "#0b0b0c"] },
  ocean: { name: "Ocean", light: ["#1a73e8", "#ffffff"], dark: ["#4da3ff", "#0b0b0c"] },
  aqua: { name: "Aqua", light: ["#0a7f74", "#ffffff"], dark: ["#2ee6c5", "#0b0b0c"] },
  berry: { name: "Berry", light: ["#e0245e", "#ffffff"], dark: ["#ff5c93", "#0b0b0c"] },
  violet: { name: "Violet", light: ["#7c3aed", "#ffffff"], dark: ["#a98bff", "#0b0b0c"] },
  gold: { name: "Gold", light: ["#c28400", "#0b0b0c"], dark: ["#ffc83d", "#0b0b0c"] },
  crimson: { name: "Crimson", light: ["#dc2626", "#ffffff"], dark: ["#ff5757", "#0b0b0c"] },
  tide: { name: "Tide", light: ["#0b6e80", "#ffffff"], dark: ["#ffcf4a", "#08303a"] },
  mono: { name: "Mono", light: ["#15171b", "#ffffff"], dark: ["#f4f3ef", "#111318"] },
};
export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];
export const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** a mixed toward b by t (0 = all a, 1 = all b), as #rrggbb. */
export const mix = (a: string, b: string, t: number) => { const x = hexRgb(a), y = hexRgb(b); return `#${x.map((n, i) => Math.round(n + (y[i] - n) * t).toString(16).padStart(2, "0")).join("")}`; };
/** The accent-dependent colors of one theme in one mode. */
export function paletteTokens(id: PaletteId, mode: "light" | "dark", black = false): Record<string, string> {
  const [accent, on] = PALETTES[id][mode];
  const rgb = hexRgb(accent).join(",");
  // Tide tints the whole app, not just its accent.
  if (id === "tide" && mode === "light") return { accent, "on-accent": on, "accent-rgb": rgb, "accent-deep": mix(accent, "#000000", 0.32), "accent-hi": mix(accent, "#ffffff", 0.28), bg: "#e6f4f7", card2: "#d6ebef",
    glow: "linear-gradient(180deg, #7fd0dc 0%, #e6f4f7 36%)", "ember-soft": "#d6ebef", tint: `rgba(${rgb},.12)`, "glow-tint": "#7fd0dc" };
  if (id === "tide" && !black) return { accent, "on-accent": on, "accent-rgb": rgb, "accent-deep": mix(accent, "#000000", 0.4), "accent-hi": mix(accent, "#ffffff", 0.22), bg: "#06161c", card: "#0c242c", "card-bg": "linear-gradient(180deg, #113039, #0c242c)", card2: "#12333d", line: "rgba(190,235,245,.16)", track: "rgba(190,235,245,.16)", nav: "rgba(12,36,44,.95)", gap: "#0c242c", body: "#12333d", muscle: "#1e4753",
    glow: "linear-gradient(180deg, #0b4f5e 0%, #06161c 42%)", "ember-soft": "#12333d", tint: `rgba(${rgb},.16)`, "glow-tint": "#0b4f5e" };
  if (mode === "light") {
    // Ember keeps its exact original peach glow.
    const glow = id === "ember" ? "#ffe2d3" : mix(accent, "#f2f2f4", 0.82);
    return { accent, "on-accent": on, "accent-rgb": rgb, "accent-deep": mix(accent, "#000000", 0.32), "accent-hi": mix(accent, "#ffffff", 0.28),
      glow: `radial-gradient(130% 40% at 50% -8%, ${glow} 0%, #f2f2f4 62%)`, "ember-soft": id === "ember" ? "#fff1ea" : mix(accent, "#ffffff", 0.9), tint: `rgba(${rgb},.10)`, "glow-tint": glow };
  }
  const bg = black ? "#000000" : "#15171b";
  const glow = id === "ember" && !black ? "#3b2415" : mix(accent, bg, black ? 0.86 : 0.8);
  return { accent, "on-accent": on, "accent-rgb": rgb, "accent-deep": mix(accent, "#000000", 0.4), "accent-hi": mix(accent, "#ffffff", 0.22),
    glow: `radial-gradient(120% 55% at 50% -12%, ${glow} 0%, ${bg} 60%)`, "ember-soft": id === "ember" && !black ? "#2e1d14" : mix(accent, black ? "#0e0f11" : "#202329", 0.84), tint: `rgba(${rgb},.16)`, "glow-tint": glow };
}
