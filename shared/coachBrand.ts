// Branded coaching (November 2026): a trainer's own name, logo and color inside Arise Fit for their clients, and a
// web app of their own at arisetodo.com/#/c/<their-name> that clients add to their home screen with the trainer's
// icon and name. Server: server/coach.ts. Fit applies it: client/src/pages/coach/Brand.tsx.

export type Brand = { on: boolean; appName: string; color: string; logo: string; tagline: string };
export const emptyBrand = (): Brand => ({ on: false, appName: "", color: "#ff5a1f", logo: "", tagline: "" });
export const BRAND_COLORS = ["#ff5a1f", "#e11d48", "#db2777", "#7c3aed", "#2563eb", "#0891b2", "#0d9488", "#16a34a", "#ca8a04", "#111827"];

const HEX = /^#[0-9a-f]{6}$/i;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trimStart().replace(/ {2,}$/, "").slice(0, max) : "");
export function cleanBrand(raw: unknown): Brand {
  const r = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const logo = typeof r.logo === "string" && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(r.logo) && r.logo.length <= 200_000 ? r.logo : "";
  return { on: r.on === true, appName: str(r.appName, 30), color: HEX.test(r.color) ? r.color.toLowerCase() : emptyBrand().color, logo, tagline: str(r.tagline, 80) };
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("")}`;
export const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (hex: string) => { const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** White or near-black text on the color, whichever reads better. */
export const onColor = (hex: string) => ((lum(hex) + 0.05) / 0.05 > 1.05 / (lum(hex) + 0.05) ? "#111111" : "#ffffff");
/** The CSS that turns Arise Fit's accent into the trainer's color (wins over the chosen palette). */
export function brandCss(color: string): string {
  const c = HEX.test(color) ? color.toLowerCase() : emptyBrand().color;
  const [r, g, b] = rgb(c);
  return `html[data-fit-theme]{--fit-accent:${c}!important;--fit-accent-rgb:${r},${g},${b}!important;--fit-accent-deep:${mix(c, "#000000", 0.35)}!important;--fit-accent-hi:${mix(c, "#ffffff", 0.25)}!important;--fit-on-accent:${onColor(c)}!important}`;
}
/** The web app manifest for a trainer's own app, so "Add to Home Screen" shows their name and icon. */
export const brandManifest = (b: Brand, name: string, iconUrl: string, startUrl: string) => ({
  name: b.appName || name, short_name: (b.appName || name).slice(0, 12), start_url: startUrl, scope: "/", display: "standalone",
  background_color: "#ffffff", theme_color: b.color, icons: b.logo ? [{ src: iconUrl, sizes: "512x512", type: b.logo.startsWith("data:image/png") ? "image/png" : "image/jpeg", purpose: "any" }] : [],
});
