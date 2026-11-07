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
  rec?: string; hl?: string; hs?: number; ns?: number; v?: string;
  onAccent?: string; record?: string; onRecord?: string; accentInk?: string; accentSoft?: string;
};

const GENERIC = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIFS = new Set(["Newsreader", "Fraunces", "Playfair Display", "Instrument Serif", "DM Serif Display", "Lora"]);
const MONOS = new Set(["JetBrains Mono", "IBM Plex Mono", "Space Mono", "Courier Prime", "Special Elite"]);
const SINGLE = new Set(["Instrument Serif", "DM Serif Display", "Gochi Hand", "Special Elite"]);
const stack = (f: string) => `"${f}", ${SERIFS.has(f) ? "Georgia, 'Times New Roman', serif" : MONOS.has(f) ? "ui-monospace, 'SF Mono', Menlo, monospace" : GENERIC}`;
/** Weights a family really has: Google answers 400 to the whole request if one is missing. */
const WEIGHTS: Record<string, string> = { "Space Grotesk": "400;500;600;700", "IBM Plex Mono": "400;500;600;700", "IBM Plex Sans": "400;500;600;700", "Space Mono": "400;700", "Courier Prime": "400;700", Caveat: "400;500;600;700", Lora: "400;500;600;700", "Familjen Grotesk": "400;500;600;700" };
const fontUrl = (...fs: string[]) => `https://fonts.googleapis.com/css2?${[...new Set(fs)].map((f) => `family=${f.replace(/ /g, "+")}${SINGLE.has(f) ? "" : `:wght@${WEIGHTS[f] ?? "400;500;600;700;800"}`}`).join("&")}&display=swap`;

/** The colors this look uses at night: dark ones as they are, light ones turned over. */
function nightOf(t: ProtoSpec): NonNullable<NotesTheme["night"]> {
  const bg = mix(t.ink, "#000000", 0.9), card = mix(bg, "#ffffff", 0.07), ink = mix(t.bg, "#ffffff", 0.92);
  const muted = reach(mix(ink, bg, 0.3), card, "#ffffff", 4.6);
  // A black (or near-grey) accent turned halfway to white became a muddy mid-grey button with dark words on it.
  // A colorless accent goes to the night ink instead (crisp light buttons); a colored one is lightened as before.
  const sat = (() => { const h = t.accent.replace("#", ""); const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(...c) - Math.min(...c); })();
  const accent = contrast(t.accent, card) >= 4.5 ? t.accent : sat < 40 ? ink : mix(t.accent, "#ffffff", 0.45);
  return { bg, card, line: mix(bg, "#ffffff", 0.2), ink, muted, faint: muted, accent, accentInk: reach(accent, card, "#ffffff", 4.6), accentSoft: mix(accent, card, 0.8), onAccent: readable(accent) };
}

export function protoLook(t: ProtoSpec): NotesTheme {
  const dark = t.dark ?? lum(t.bg) < 0.25;
  const accent = t.accent, onAccent = t.onAccent && contrast(t.onAccent, accent) >= 4.5 ? t.onAccent : readable(accent);
  const record = t.record ?? accent, onRecord = t.onRecord ?? readable(record);
  const muted = reach(t.muted, t.card, t.ink, 4.6), mutedBg = reach(muted, t.bg, t.ink, 4.6);
  let accentSoft = t.accentSoft ?? mix(accent, t.card, dark ? 0.78 : 0.84);
  // Keep the soft tint close enough to the card that the accent text on it stays readable.
  for (let i = 0; i < 6 && !t.accentSoft && contrast(reach(accent, t.card, t.ink, 4.6), accentSoft) < 4.6; i++) accentSoft = mix(accentSoft, t.card, 0.3);
  const out: NotesTheme = {
    id: t.id as NotesTheme["id"], label: t.label, blurb: t.blurb, dark, arch: t.arch, group: t.group, rec: t.rec, hl: t.hl, hs: t.hs, ns: t.ns, v: t.v,
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
  { id: "x-billboard-cobalt", label: "Billboard Cobalt", blurb: "The same huge type on white, with one electric cobalt.", arch: "billboard", group: "loud", bg: "#ffffff", card: "#f1f3fa", ink: "#0b0f1a", muted: "#4b5368", line: "#0b0f1a", accent: "#1537e8", onAccent: "#ffffff", fd: "Archivo", fb: "Archivo", radius: 0, border: 2 },
  { id: "x-billboard-signal", label: "Billboard Signal", blurb: "Huge type on warm paper, with a signal red.", arch: "billboard", group: "loud", bg: "#f3efe4", card: "#e9e3d2", ink: "#16130e", muted: "#5a5446", line: "#16130e", accent: "#c8321a", onAccent: "#ffffff", fd: "Archivo", fb: "Archivo", radius: 0, border: 2 },
  { id: "x-billboard-forest", label: "Billboard Forest", blurb: "Huge type on deep forest green, with one mint highlight.", arch: "billboard", group: "loud", bg: "#0f2a1d", card: "#173826", ink: "#eaf3ec", muted: "#b4cdbb", line: "#eaf3ec", accent: "#b9f5c8", onAccent: "#0f2a1d", fd: "Archivo", fb: "Archivo", radius: 0, border: 2 },
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
  { id: "x-cabinet", label: "Cabinet", blurb: "Folders and a big round record button. Tidy, bright and friendly.", arch: "rows", group: "pro", bg: "#F5F7FB", card: "#FFFFFF", ink: "#14213D", muted: "#4A5675", line: "#E3E8F2", accent: "#2F4BD8", onAccent: "#FFFFFF", fd: "Inter", fb: "Inter", radius: 14, v: "cabinet", record: "#D6342C", onRecord: "#ffffff" },
  { id: "x-threadline", label: "Threadline", blurb: "Conversation-style rows with round initials, in calm green.", arch: "rows", group: "calm", bg: "#F4F7F5", card: "#FFFFFF", ink: "#12261D", muted: "#46594F", line: "#D5DED8", accent: "#0E7A55", onAccent: "#FFFFFF", fd: "Plus Jakarta Sans", fb: "Plus Jakarta Sans", radius: 16, v: "thread" },
  { id: "x-maison", label: "Maison", blurb: "Quiet serif titles and bronze lines on warm white, like a gallery.", arch: "rows", group: "calm", bg: "#FBFAF7", card: "#FFFFFF", ink: "#1D1B18", muted: "#6B665D", line: "#E5E1D8", accent: "#8A6A3D", onAccent: "#FFFFFF", fd: "Newsreader", fb: "Inter", radius: 4, v: "atelier" },
  { id: "x-obsidian", label: "Obsidian", blurb: "Black glass with a single gold line. Dark, sharp and expensive.", arch: "rows", group: "dark", bg: "#0C0D10", card: "#16181D", ink: "#ECEDEF", muted: "#9A9FA9", line: "#23262C", accent: "#D8B56A", onAccent: "#17120A", fd: "Inter Tight", fb: "Inter", radius: 12, v: "graphite" },
  { id: "x-helvetic", label: "Helvetic", blurb: "Swiss grid: white, black rules and one blue.", arch: "rows", group: "structure", bg: "#FFFFFF", card: "#EDEEF2", ink: "#0A0A0A", muted: "#5C5F66", line: "#E3E4E8", accent: "#2347F5", onAccent: "#FFFFFF", fd: "Inter Tight", fb: "Inter", radius: 0, v: "swiss" },
  { id: "x-outliner", label: "Outliner", blurb: "Numbered outline rows in a code-editor font.", arch: "rows", group: "structure", bg: "#EEF0F5", card: "#FFFFFF", ink: "#1B1F2A", muted: "#5A6376", line: "#C9CEDA", accent: "#E5432E", onAccent: "#FFFFFF", fd: "IBM Plex Mono", fb: "IBM Plex Sans", radius: 2, v: "outline" },
  { id: "x-cornell", label: "Cornell", blurb: "Study-paper cards with a serif title, inspired by Cornell notes.", arch: "rows", group: "calm", bg: "#F2F0E6", card: "#FFFFFF", ink: "#22262F", muted: "#5E6473", line: "#C9D3E6", accent: "#1F4478", onAccent: "#FFFFFF", fd: "Source Serif 4", fb: "Inter", radius: 12, v: "cornell" },
  { id: "x-nightshift", label: "Nightshift", blurb: "One big record button, then your day on a dark timeline.", arch: "timeline", group: "dark", bg: "#0E1116", card: "#1A1F29", ink: "#F2F4F8", muted: "#9AA3B2", line: "#262C38", accent: "#FF5A4F", onAccent: "#0E1116", fd: "Space Grotesk", fb: "Space Grotesk", radius: 14, record: "#FF5A4F", onRecord: "#0E1116" },
  { id: "x-corkboard", label: "Corkboard", blurb: "Sticky notes pinned to a dotted green board, in handwriting.", arch: "wall", group: "tactile", bg: "#2C4B3F", card: "#243F34", ink: "#F6F0E0", muted: "#CFE3D8", line: "#3D5F51", accent: "#FFE27A", onAccent: "#2A2418", fd: "Caveat", fb: "Inter", radius: 4 },
  { id: "x-swatch", label: "Swatch", blurb: "A bento of bright tiles and colour-coded note cards.", arch: "tiles", group: "play", bg: "#FFFDF8", card: "#FFFFFF", ink: "#1B1B2F", muted: "#4A4A63", line: "#EADFC9", accent: "#5B3FD9", onAccent: "#FFFFFF", fd: "DM Sans", fb: "DM Sans", radius: 20 },
  { id: "x-spiral", label: "Spiral", blurb: "Notebooks on a shelf with coloured covers. Start a page and record.", arch: "shelf", group: "tactile", bg: "#FAF7F0", card: "#FFFFFF", ink: "#1C2433", muted: "#5B6478", line: "#DDD5C2", accent: "#8A3B2B", onAccent: "#FFFFFF", fd: "Lora", fb: "Inter", radius: 8 },
  { id: "x-stickies", label: "Stickies", blurb: "A grid of coloured sticky notes in marker handwriting.", arch: "sticky", group: "play", bg: "#F4F1EA", card: "#FFFFFF", ink: "#1D1B16", muted: "#5B564A", line: "#DDD7C9", accent: "#FF4F8B", onAccent: "#1D1B16", fd: "Gochi Hand", fb: "Inter", radius: 6, v: "grid" },
  { id: "x-peel-pad", label: "Peel Pad", blurb: "A lavender desk with a stack of sticky notes to peel off.", arch: "sticky", group: "play", bg: "#9A9AE8", card: "#C9C9F5", ink: "#14142B", muted: "#2E2E66", line: "#7F7FD0", accent: "#FFE45C", onAccent: "#1D1B16", fd: "Gochi Hand", fb: "Inter", radius: 6, v: "pad" },
  { id: "x-fullcolor", label: "Fullcolor", blurb: "Every note is a full-width colour band with a sound-wave texture.", arch: "strips", group: "loud", bg: "#F4F1EA", card: "#FFFFFF", ink: "#17140F", muted: "#6A6354", line: "#D9D3C4", accent: "#FF5B3A", onAccent: "#17140F", fd: "Familjen Grotesk", fb: "Familjen Grotesk", radius: 0 },
  { id: "x-receipts", label: "Receipts", blurb: "Each note is a paper receipt on a grey desk. Tap Print New to record.", arch: "receipt", group: "tactile", bg: "#C9C2B1", card: "#FBFAF4", ink: "#1A1A1A", muted: "#4A4636", line: "#A8A08C", accent: "#E8452C", onAccent: "#FFFFFF", fd: "Courier Prime", fb: "Courier Prime", radius: 4 },
  { id: "x-deck", label: "Deck", blurb: "One huge card for your latest note, then the rest in a quiet list.", arch: "deck", group: "loud", bg: "#141414", card: "#1F1F22", ink: "#EDEDF2", muted: "#B5B5C0", line: "#2A2A30", accent: "#FF5B36", onAccent: "#141414", fd: "Bricolage Grotesque", fb: "Bricolage Grotesque", radius: 28 },
  { id: "x-tape-rack", label: "Tape Rack", blurb: "Every note is a coloured cassette on a tan shelf.", arch: "cassette", group: "tactile", bg: "#CDBB9A", card: "#F6EFDC", ink: "#2A1D12", muted: "#53432F", line: "#B7A582", accent: "#C8261B", onAccent: "#FFFFFF", fd: "Special Elite", fb: "Inter", radius: 12 },
  { id: "x-chronograph", label: "Chronograph", blurb: "A dial for the record button and your day as a trail of dots.", arch: "dial", group: "dark", bg: "#14123A", card: "#2A2660", ink: "#F1F0FF", muted: "#B3B0E8", line: "#2E2A66", accent: "#FFD84D", onAccent: "#14123A", fd: "Unbounded", fb: "Space Grotesk", radius: 14, record: "#FF6B4A", onRecord: "#14123A" },
  { id: "x-evening-paper", label: "Evening Paper", blurb: "A warm greeting, one big ask button and notes grouped by day.", arch: "paper", group: "calm", bg: "#FBF8F2", card: "#FFFFFF", ink: "#22201C", muted: "#6B6558", line: "#E4DED0", accent: "#A0461F", onAccent: "#FFFFFF", fd: "Newsreader", fb: "Inter", radius: 14 },
];
export const PROTO_LOOKS: NotesTheme[] = PROTO_SPECS.map(protoLook);
export const PROTO_IDS = PROTO_SPECS.map((s) => s.id);
