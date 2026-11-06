// The Studio series: looks that change the whole feel of Arise Notes and Arise To Duo, not just the
// colors. Each one has its own arrangement for Home, the list, recording, the note heading and (in
// the hubs) the top of Home, the task list and the agenda. `arch` says which arrangement it uses
// (client/src/components/arise-notes/protoLooks.tsx draws it; protoLooks.css dresses it).
import type { NotesTheme } from "./notesThemes";

// ─── Color helpers ───
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
/** `a` with `t` (0..1) of `b` mixed in. */
export const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (h: string) => { const c = hex(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a: string, b: string) => { const [p, q] = [lum(a), lum(b)].sort((m, n) => n - m); return (p + 0.05) / (q + 0.05); };
/** Black or white, whichever reads better on `bg`. */
const readable = (bg: string, dark = "#111111", light = "#ffffff") => (contrast(dark, bg) >= contrast(light, bg) ? dark : light);
/** `c` moved toward `toward` until it reads on `bg` at `min`. */
const reach = (c: string, bg: string, toward: string, min: number) => { let t = 0, out = c; while (contrast(out, bg) < min && t < 1) { t += 0.05; out = mix(c, toward, t); } return out; };

export type ProtoSpec = {
  id: string; label: string; blurb: string; arch: string; group: string;
  bg: string; card: string; ink: string; muted: string; line: string; accent: string;
  /** Display and body font families (Google Fonts names). */
  fd: string; fb: string; dark?: boolean; radius: number; border?: number; hard?: boolean;
  onAccent?: string; record?: string; onRecord?: string; accentInk?: string; accentSoft?: string;
};

const GENERIC = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIFS = new Set(["Newsreader", "Fraunces", "Playfair Display", "Instrument Serif", "DM Serif Display", "Lora"]);
const MONOS = new Set(["JetBrains Mono", "IBM Plex Mono", "Space Mono"]);
const SINGLE = new Set(["Instrument Serif", "DM Serif Display"]);
const stack = (f: string) => `"${f}", ${SERIFS.has(f) ? "Georgia, 'Times New Roman', serif" : MONOS.has(f) ? "ui-monospace, 'SF Mono', Menlo, monospace" : GENERIC}`;
const fontUrl = (...fs: string[]) => `https://fonts.googleapis.com/css2?${[...new Set(fs)].map((f) => `family=${f.replace(/ /g, "+")}${SINGLE.has(f) ? "" : ":wght@400;500;600;700;800"}`).join("&")}&display=swap`;

/** The colors this look uses at night: dark ones as they are, light ones turned over. */
function nightOf(t: ProtoSpec): NonNullable<NotesTheme["night"]> {
  const bg = mix(t.ink, "#000000", 0.9), card = mix(bg, "#ffffff", 0.07), ink = mix(t.bg, "#ffffff", 0.92);
  const muted = reach(mix(ink, bg, 0.3), card, "#ffffff", 4.6);
  const accent = contrast(t.accent, card) >= 4.5 ? t.accent : mix(t.accent, "#ffffff", 0.45);
  return { bg, card, line: mix(bg, "#ffffff", 0.2), ink, muted, faint: muted, accent, accentInk: reach(accent, card, "#ffffff", 4.6), accentSoft: mix(accent, card, 0.8), onAccent: readable(accent) };
}

export function protoLook(t: ProtoSpec): NotesTheme {
  const dark = t.dark ?? lum(t.bg) < 0.25;
  const accent = t.accent, onAccent = t.onAccent ?? readable(accent);
  const record = t.record ?? accent, onRecord = t.onRecord ?? readable(record);
  const muted = reach(t.muted, t.card, t.ink, 4.6), mutedBg = reach(muted, t.bg, t.ink, 4.6);
  const out: NotesTheme = {
    id: t.id as NotesTheme["id"], label: t.label, blurb: t.blurb, dark, arch: t.arch, group: t.group,
    bg: t.bg, card: t.card, line: t.line, ink: t.ink, muted: mutedBg, faint: mutedBg,
    accent, accentInk: t.accentInk ?? reach(accent, t.card, t.ink, 4.6), accentSoft: t.accentSoft ?? mix(accent, t.card, dark ? 0.78 : 0.84), onAccent, record, onRecord,
    font: stack(t.fb), display: stack(t.fd), fontUrl: fontUrl(t.fd, t.fb), radius: t.radius, border: t.border, hardShadow: t.hard,
  };
  if (!dark) out.night = nightOf(t);
  return out;
}

// ─── The looks ───
// Billboard: huge type, hard lines, one loud yellow. The default for everyone.
export const PROTO_SPECS: ProtoSpec[] = [
  { id: "x-billboard", label: "Billboard", blurb: "Huge type, hard lines and one loud yellow. Impossible to miss.", arch: "billboard", group: "loud", bg: "#111111", card: "#1c1c1b", ink: "#f5f5f0", muted: "#d2d2ca", line: "#f5f5f0", accent: "#f2e14b", onAccent: "#111111", fd: "Archivo", fb: "Archivo", radius: 0, border: 2 },
];
export const PROTO_LOOKS: NotesTheme[] = PROTO_SPECS.map(protoLook);
export const PROTO_IDS = PROTO_SPECS.map((s) => s.id);
