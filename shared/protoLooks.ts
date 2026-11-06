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
  /** Which recording display (wave, ring, tx) and the Home headline / sizes, for the Studio arrangements. */
  rec?: string; hl?: string; hs?: number; ns?: number;
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
  const accent = t.accent, onAccent = t.onAccent && contrast(t.onAccent, accent) >= 4.5 ? t.onAccent : readable(accent);
  const record = t.record ?? accent, onRecord = t.onRecord ?? readable(record);
  const muted = reach(t.muted, t.card, t.ink, 4.6), mutedBg = reach(muted, t.bg, t.ink, 4.6);
  const accentSoft = t.accentSoft ?? mix(accent, t.card, dark ? 0.78 : 0.84);
  const out: NotesTheme = {
    id: t.id as NotesTheme["id"], label: t.label, blurb: t.blurb, dark, arch: t.arch, group: t.group, rec: t.rec, hl: t.hl, hs: t.hs, ns: t.ns,
    bg: t.bg, card: t.card, line: t.line, ink: t.ink, muted: mutedBg, faint: mutedBg,
    accent, accentInk: t.accentInk ?? reach(reach(accent, t.card, t.ink, 4.6), accentSoft, t.ink, 4.6), accentSoft, onAccent, record, onRecord,
    font: stack(t.fb), display: stack(t.fd), fontUrl: fontUrl(t.fd, t.fb), radius: t.radius, border: t.border, hardShadow: t.hard,
  };
  if (!dark) out.night = nightOf(t);
  return out;
}

// ─── The looks ───
// Billboard: huge type, hard lines, one loud yellow. The default for everyone.
export const PROTO_SPECS: ProtoSpec[] = [
  { id: "x-billboard", label: "Billboard", blurb: "Huge type, hard lines and one loud yellow. Impossible to miss.", arch: "billboard", group: "loud", bg: "#111111", card: "#1c1c1b", ink: "#f5f5f0", muted: "#d2d2ca", line: "#f5f5f0", accent: "#f2e14b", onAccent: "#111111", fd: "Archivo", fb: "Archivo", radius: 0, border: 2 },
  { id: "x-index-graphite", label: "Graphite Index", blurb: "A precise index of every note, in graphite and white. Calm and exact.", arch: "index", rec: "wave", group: "pro", bg: "#0F1012", card: "#1A1B1F", ink: "#F2F2F4", muted: "#8E8F98", line: "#2A2B31", accent: "#F2F2F4", onAccent: "#101113", fd: "Inter", fb: "Inter", radius: 14 },
  { id: "x-index-lime", label: "Lime Index", blurb: "Black index rows with one sharp lime accent. Fast to scan.", arch: "index", rec: "tx", group: "dark", bg: "#0B0D0A", card: "#151A13", ink: "#EFF5E6", muted: "#8A9680", line: "#232B1F", accent: "#D4FF4F", onAccent: "#101808", fd: "Space Grotesk", fb: "Space Grotesk", radius: 10 },
  { id: "x-index-paper", label: "Paper Index", blurb: "A ruled, serif index on warm paper. Like a library card file.", arch: "index", rec: "wave", group: "calm", bg: "#F6F3EC", card: "#FFFFFF", ink: "#1D1B16", muted: "#7A7568", line: "#DDD7C9", accent: "#1D1B16", onAccent: "#FFFFFF", fd: "Newsreader", fb: "Inter", radius: 2 },
  { id: "x-chron-teal", label: "Tide Chronicle", blurb: "A week strip and a timeline, in quiet teal.", arch: "chron", rec: "ring", group: "calm", bg: "#EEF4F3", card: "#FFFFFF", ink: "#1E3438", muted: "#6F8A8D", line: "#D3E2E1", accent: "#3B7A82", onAccent: "#FFFFFF", fd: "Manrope", fb: "Manrope", radius: 16 },
  { id: "x-chron-sun", label: "Sunrise Chronicle", blurb: "Warm orange timeline for notes you want to see in order.", arch: "chron", rec: "ring", group: "play", bg: "#FFF6EC", card: "#FFFFFF", ink: "#2B1A10", muted: "#9A7E69", line: "#F1DEC9", accent: "#F26B3A", onAccent: "#FFFFFF", fd: "Outfit", fb: "Outfit", radius: 18 },
  { id: "x-chron-night", label: "Midnight Chronicle", blurb: "Your notes on a timeline, in deep blue night.", arch: "chron", rec: "wave", group: "dark", bg: "#0B1020", card: "#141B33", ink: "#EAF0FF", muted: "#7F8CB3", line: "#232C4C", accent: "#7C9CFF", onAccent: "#0B1020", fd: "Sora", fb: "Sora", radius: 14 },
  { id: "x-edit-serif", label: "Quiet Serif", blurb: "One line, then your writing. A clear space to think.", arch: "edit", rec: "tx", group: "calm", bg: "#F5F3EE", card: "#EAE7DF", ink: "#1F1E1A", muted: "#807B6E", line: "#DAD6CA", accent: "#1F1E1A", onAccent: "#F5F3EE", fd: "Newsreader", fb: "Inter", radius: 0, hl: "A clear space to think.", ns: 44 },
  { id: "x-edit-fraunces", label: "Warm Press", blurb: "Cream pages and a rust accent. Notes worth keeping.", arch: "edit", rec: "wave", group: "calm", bg: "#FBF4E8", card: "#F2E6D2", ink: "#2A1A0E", muted: "#8F7358", line: "#E8D8BD", accent: "#8A3B12", onAccent: "#FFF6E8", fd: "Fraunces", fb: "DM Sans", radius: 6, hl: "Notes worth keeping." },
  { id: "x-edit-instrument", label: "Think Aloud", blurb: "Giant thin serif on white, with round pill buttons.", arch: "edit", rec: "ring", group: "pro", bg: "#FFFFFF", card: "#F3F3F1", ink: "#111111", muted: "#77776F", line: "#E6E6E2", accent: "#111111", onAccent: "#FFFFFF", fd: "Instrument Serif", fb: "Inter", radius: 99, hl: "Think out loud.", hs: 78, ns: 52 },
  { id: "x-edit-noir", label: "Noir Editorial", blurb: "Black pages and champagne gold. Quiet, then clear.", arch: "edit", rec: "tx", group: "dark", bg: "#0E0E0E", card: "#1A1A19", ink: "#F4EFE6", muted: "#948C7C", line: "#2B2A27", accent: "#E8C37A", onAccent: "#14100A", fd: "Playfair Display", fb: "Inter", radius: 0, hl: "Quiet, then clear." },
  { id: "x-field-lime", label: "Field Lime", blurb: "A monospace capture console in lime on near-black.", arch: "cons", rec: "wave", group: "dark", bg: "#0C100C", card: "#19211A", ink: "#EEF6E4", muted: "#8CA088", line: "#26312A", accent: "#CFF57A", onAccent: "#10180A", fd: "JetBrains Mono", fb: "JetBrains Mono", radius: 6, hl: "WRITE IT DOWN. MOVE FORWARD.", hs: 34 },
  { id: "x-field-amber", label: "Field Amber", blurb: "A monospace logbook glowing amber, like an old terminal.", arch: "cons", rec: "tx", group: "dark", bg: "#14100A", card: "#211A10", ink: "#FBEFD8", muted: "#A39070", line: "#33291A", accent: "#FFB020", onAccent: "#1A1100", fd: "IBM Plex Mono", fb: "IBM Plex Mono", radius: 2, hl: "LOG IT. KEEP MOVING." },
  { id: "x-field-paper", label: "Field Paper", blurb: "Typewriter text, forest green and filed records.", arch: "cons", rec: "ring", group: "structure", bg: "#F1EEE4", card: "#FBF9F2", ink: "#1B1B18", muted: "#807C6C", line: "#D8D3C2", accent: "#1F4D36", onAccent: "#F1EEE4", fd: "Space Mono", fb: "Space Mono", radius: 0, hl: "NOTES, FILED." },
  { id: "x-atlas-blue", label: "Atlas Blue", blurb: "An overview card, collection tiles and recent notes in clear blue.", arch: "atlas", rec: "wave", group: "pro", bg: "#ECEFF4", card: "#FFFFFF", ink: "#1B2540", muted: "#6E7A96", line: "#D9DFEA", accent: "#3B63D8", onAccent: "#FFFFFF", fd: "Inter", fb: "Inter", radius: 20, hl: "5 notes. Infinite possibilities." },
  { id: "x-atlas-coral", label: "Atlas Coral", blurb: "Soft, round tiles in warm coral. Everything in its place.", arch: "atlas", rec: "ring", group: "play", bg: "#FFF1EC", card: "#FFFFFF", ink: "#2E1812", muted: "#A07F72", line: "#F4D9CE", accent: "#E5533C", onAccent: "#FFFFFF", fd: "DM Sans", fb: "DM Sans", radius: 22, hl: "Everything, in its place." },
  { id: "x-atlas-mint", label: "Atlas Mint", blurb: "Dark green workspace with mint tiles.", arch: "atlas", rec: "tx", group: "dark", bg: "#0E1614", card: "#16221F", ink: "#E8F6F0", muted: "#7FA396", line: "#233530", accent: "#5EE0B0", onAccent: "#07140F", fd: "Manrope", fb: "Manrope", radius: 20, hl: "Your ideas, organized." },
  { id: "x-atlas-violet", label: "Atlas Violet", blurb: "A home for every idea, in soft violet.", arch: "atlas", rec: "wave", group: "play", bg: "#F4F0FF", card: "#FFFFFF", ink: "#241A4A", muted: "#8479B0", line: "#E0D8F8", accent: "#6B3FE0", onAccent: "#FFFFFF", fd: "Sora", fb: "Sora", radius: 24, hl: "A home for every idea." },
  { id: "x-stream-orange", label: "Stream Orange", blurb: "One big line and a stream of notes, with a round orange button.", arch: "stream", rec: "ring", group: "play", bg: "#F8F8F6", card: "#FFFFFF", ink: "#141414", muted: "#767670", line: "#E6E5E0", accent: "#EF6A43", onAccent: "#FFFFFF", fd: "Inter", fb: "Inter", radius: 22, hl: "Your thinking." },
  { id: "x-stream-cobalt", label: "Stream Cobalt", blurb: "A flowing list in cobalt, with room for ideas.", arch: "stream", rec: "wave", group: "pro", bg: "#F5F8FF", card: "#FFFFFF", ink: "#16264A", muted: "#6F7FA6", line: "#DCE5F8", accent: "#2F5FD0", onAccent: "#FFFFFF", fd: "Archivo", fb: "Archivo", radius: 22, hl: "Make room for ideas." },
  { id: "x-stream-neon", label: "Stream Neon", blurb: "Graphite and hot pink. Keeps it flowing.", arch: "stream", rec: "tx", group: "dark", bg: "#101114", card: "#1B1C21", ink: "#F4F4F6", muted: "#8B8C96", line: "#2A2B32", accent: "#FF4F8B", onAccent: "#FFFFFF", fd: "Syne", fb: "Inter", radius: 22, hl: "Keep it flowing." },
  { id: "x-atlas-sage", label: "Command Sage", blurb: "A calm dark command centre in sage green.", arch: "atlas", rec: "wave", group: "dark", bg: "#14181A", card: "#1D2326", ink: "#EEF2EE", muted: "#8B9A94", line: "#2B3337", accent: "#DDE8DD", onAccent: "#101414", fd: "Inter", fb: "Inter", radius: 14, hl: "Ready when you are." },
];
export const PROTO_LOOKS: NotesTheme[] = PROTO_SPECS.map(protoLook);
export const PROTO_IDS = PROTO_SPECS.map((s) => s.id);
