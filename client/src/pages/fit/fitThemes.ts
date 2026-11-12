// Cooked's color themes (no imports, so tests can load it). fitUi.tsx turns these into the app's CSS.
// ——— Color themes ——————————————————————————————————————————————————————————————————————————————
// Each theme has an accent for Light and one for Dark (Light's is deeper so it reads on white), and the
// text color that sits on it. The glow, the soft tint, the deep end of gradients and the see-through
// versions are worked out from the accent, so every theme looks finished in both modes.
export type PaletteId = "ember" | "volt" | "ocean" | "aqua" | "berry" | "violet" | "gold" | "crimson" | "mono" | "tide" | "rose" | "lilac";
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
  rose: { name: "Rose", light: ["#b84a62", "#ffffff"], dark: ["#f2a7b8", "#2a1016"] },
  lilac: { name: "Lilac", light: ["#8b4fd8", "#ffffff"], dark: ["#c9a8ff", "#1e1236"] },
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

// ——— Layouts ———————————————————————————————————————————————————————————————————————————————————
// A layout is the whole shape of the app, not just its colors: its typefaces, how round everything is,
// its cards, how Today is arranged (FitLayouts.tsx) and the tab bar. The color theme (above) still sets
// the accent on top; picking a layout also picks the color theme it was drawn with (it can be changed).
export type LayoutId = "athletic" | "studio" | "bloom" | "pro" | "proplus" | "zen";
type Base = Partial<Record<"bg" | "card" | "card-bg" | "card-shadow" | "card2" | "line" | "text" | "dim" | "steel" | "track" | "nav" | "nav-border" | "nav-shadow" | "gap" | "body" | "muscle", string>>;
export type FitLayout = {
  name: string; blurb: string; palette: PaletteId;
  /** Headings and body text, and the Google Fonts stylesheet that has them. */
  display: string; body: string; fonts: string;
  /** Headings: weight, case and letter spacing. */
  weight: number; upper: boolean; tracking: string;
  /** How round things are, against Athletic's corners (1 = the same, 2 = twice as round). */
  round: number;
  light: Base; dark: Base;
};
const GF = "https://fonts.googleapis.com/css2?display=swap&family=";
export const LAYOUTS: Record<LayoutId, FitLayout> = {
  athletic: { name: "Athletic", blurb: "Bold and loud: big condensed headings, a floating tab bar.", palette: "ember",
    display: "'Barlow Condensed', 'Oswald', 'Arial Narrow', sans-serif", body: "'Barlow', -apple-system, system-ui, sans-serif", fonts: `${GF}Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700`,
    weight: 800, upper: true, tracking: ".01em", round: 1, light: {}, dark: {} },
  studio: { name: "Studio", blurb: "Soft and elegant: serif headings, rose and cream, rounded everything.", palette: "rose",
    display: "'Fraunces', 'Playfair Display', Georgia, serif", body: "'DM Sans', -apple-system, system-ui, sans-serif", fonts: `${GF}Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500;600;700`,
    weight: 500, upper: false, tracking: "-.01em", round: 1.9,
    light: { bg: "#faf4f0", card: "#ffffff", "card-bg": "#ffffff", "card-shadow": "0 1px 2px rgba(120,60,70,.05), 0 14px 34px -12px rgba(150,80,95,.22)", card2: "#f4e8e4", line: "rgba(110,60,70,.10)", text: "#33252a", dim: "#7a5f66", steel: "#5e4a50", track: "rgba(110,60,70,.10)", nav: "rgba(255,255,255,.92)", "nav-border": "rgba(110,60,70,.08)", "nav-shadow": "0 16px 36px -10px rgba(150,80,95,.35)", gap: "#ffffff", body: "#f1e2de", muscle: "#e3cbc6" },
    dark: { bg: "#1c1517", card: "#2a2023", "card-bg": "linear-gradient(180deg, #30252a, #2a2023)", "card-shadow": "inset 0 1px 0 rgba(255,235,240,.06), 0 14px 30px -14px rgba(0,0,0,.6)", card2: "#36292e", line: "rgba(255,225,232,.10)", text: "#f8eef0", dim: "#c3a8b0", steel: "#e3d2d6", track: "rgba(255,225,232,.10)", nav: "rgba(42,32,35,.94)", gap: "#2a2023", body: "#36292e", muscle: "#4d3a40" } },
  bloom: { name: "Bloom", blurb: "Playful and bright: lilac and pink, bubbly type, a flower of rings.", palette: "lilac",
    display: "'Quicksand', 'Nunito', system-ui, sans-serif", body: "'Nunito', -apple-system, system-ui, sans-serif", fonts: `${GF}Quicksand:wght@500;600;700&family=Nunito:wght@400;600;700;800`,
    weight: 700, upper: false, tracking: "0", round: 2.2,
    light: { bg: "#f6f0fc", card: "#ffffff", "card-bg": "linear-gradient(180deg, #ffffff, #fdfaff)", "card-shadow": "0 2px 0 rgba(140,90,200,.06), 0 16px 30px -14px rgba(140,90,200,.35)", card2: "#efe5fa", line: "rgba(100,60,150,.10)", text: "#2e2440", dim: "#6d5f85", steel: "#54476b", track: "rgba(100,60,150,.10)", nav: "rgba(255,255,255,.94)", "nav-border": "rgba(100,60,150,.08)", "nav-shadow": "0 16px 36px -10px rgba(140,90,200,.45)", gap: "#ffffff", body: "#ece2f8", muscle: "#d9c8ee" },
    dark: { bg: "#18132a", card: "#251d3b", "card-bg": "linear-gradient(180deg, #2b2244, #251d3b)", "card-shadow": "inset 0 1px 0 rgba(240,225,255,.07), 0 14px 30px -14px rgba(0,0,0,.7)", card2: "#30264c", line: "rgba(230,215,255,.12)", text: "#f6f0ff", dim: "#b9aad6", steel: "#ddd2f0", track: "rgba(230,215,255,.12)", nav: "rgba(37,29,59,.95)", gap: "#251d3b", body: "#30264c", muscle: "#463a68" } },
  pro: { name: "Pro", blurb: "A dashboard: dense tiles, sharp corners and numbers in mono.", palette: "volt",
    display: "'Space Grotesk', 'Inter', system-ui, sans-serif", body: "'Inter', -apple-system, system-ui, sans-serif", fonts: `${GF}Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700`,
    weight: 700, upper: false, tracking: "-.02em", round: 0.45,
    light: { bg: "#eef0f3", card: "#ffffff", "card-bg": "#ffffff", "card-shadow": "0 0 0 1px rgba(17,19,24,.08)", line: "rgba(17,19,24,.10)", nav: "rgba(255,255,255,.97)", "nav-shadow": "0 -1px 0 rgba(17,19,24,.08)" },
    dark: { bg: "#0d0f12", card: "#15181d", "card-bg": "#15181d", "card-shadow": "0 0 0 1px rgba(255,255,255,.07)", card2: "#1d2127", line: "rgba(255,255,255,.08)", nav: "rgba(13,15,18,.97)", "nav-shadow": "0 -1px 0 rgba(255,255,255,.07)", gap: "#15181d", body: "#1d2127", muscle: "#2c3139" } },
  proplus: { name: "Pro+", blurb: "Every stat on Home, deep analysis and forecasts. Fit+.", palette: "gold",
    display: "'Space Grotesk', 'Inter', system-ui, sans-serif", body: "'Inter', -apple-system, system-ui, sans-serif", fonts: `${GF}Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700`,
    weight: 700, upper: false, tracking: "-.02em", round: 0.45,
    light: { bg: "#eef0f3", card: "#ffffff", "card-bg": "#ffffff", "card-shadow": "0 0 0 1px rgba(17,19,24,.08)", line: "rgba(17,19,24,.10)", nav: "rgba(255,255,255,.97)", "nav-shadow": "0 -1px 0 rgba(17,19,24,.08)" },
    dark: { bg: "#0d0f12", card: "#15181d", "card-bg": "#15181d", "card-shadow": "0 0 0 1px rgba(255,255,255,.07)", card2: "#1d2127", line: "rgba(255,255,255,.08)", nav: "rgba(13,15,18,.97)", "nav-shadow": "0 -1px 0 rgba(255,255,255,.07)", gap: "#15181d", body: "#1d2127", muscle: "#2c3139" } },
  zen: { name: "Zen", blurb: "Calm and quiet: thin type, open space, no boxes, just lines.", palette: "mono",
    display: "'Manrope', 'Inter', system-ui, sans-serif", body: "'Manrope', -apple-system, system-ui, sans-serif", fonts: `${GF}Manrope:wght@300;400;500;600;700`,
    weight: 300, upper: false, tracking: "-.03em", round: 0.7,
    light: { bg: "#f7f6f3", card: "#f7f6f3", "card-bg": "transparent", "card-shadow": "inset 0 -1px 0 rgba(20,20,20,.10)", card2: "#ecebe6", line: "rgba(20,20,20,.10)", text: "#1a1a1a", dim: "#686660", nav: "rgba(247,246,243,.96)", "nav-shadow": "0 -1px 0 rgba(20,20,20,.08)", "nav-border": "transparent", gap: "#f7f6f3" },
    dark: { bg: "#121212", card: "#121212", "card-bg": "transparent", "card-shadow": "inset 0 -1px 0 rgba(255,255,255,.10)", card2: "#1e1e1e", line: "rgba(255,255,255,.10)", text: "#efeee9", dim: "#9a9893", nav: "rgba(18,18,18,.96)", "nav-shadow": "0 -1px 0 rgba(255,255,255,.08)", "nav-border": "transparent", gap: "#121212" } },
};
export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];
