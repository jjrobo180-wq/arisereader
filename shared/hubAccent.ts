// The one colour Arise WorkHub is tinted with: buttons, links, the today bar, selected states.
//
// Every swatch here is dark enough to carry white text at 4.5:1, which is why the old banner
// palette is not reused — its Gold, Sky and White were fine behind a photo and are not fine
// behind a label.

export const HUB_ACCENTS = [
  { name: "Violet", hex: "#5b3be0" },
  { name: "Indigo", hex: "#3b4ce0" },
  { name: "Blue", hex: "#1d4ed8" },
  { name: "Teal", hex: "#0f766e" },
  { name: "Forest", hex: "#15803d" },
  { name: "Rust", hex: "#c2410c" },
  { name: "Plum", hex: "#9d174d" },
  { name: "Ink", hex: "#16141f" },
] as const;

export const DEFAULT_ACCENT = "#5b3be0";

/** A saved accent made safe to use: a six-digit hex, or "" when it is anything else. */
export const cleanAccent = (v: unknown): string =>
  (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : "");

/** A darker shade of the accent, for hover and for accent-coloured text on a pale ground. */
export function deepenAccent(hex: string, amount = 0.24): string {
  const c = cleanAccent(hex) || DEFAULT_ACCENT;
  const parts = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  return "#" + parts.map((v) => Math.round(v * (1 - amount)).toString(16).padStart(2, "0")).join("");
}
