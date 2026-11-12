// Arise Notes → Notes: the note-taking side of Arise Notes (the AI note taker is the other tab).
// Typed notes and handwritten notebooks, synced across devices, free for everyone.
//
//   A typed note keeps formatted HTML (the same sanitizer as Arise Docs: headings, fonts, colours,
//   lists, checklists, tables, pictures) and an optional look: paper colour, font, text size, line
//   spacing, paper lines and width.
//   A handwritten note keeps pages of ink: pen, pencil, highlighter and shape strokes on a page
//   1000 units wide, with a paper style and an optional background picture (a photographed worksheet).
//   A locked note is encrypted on the device with the person's notes password (AES-GCM, key from
//   PBKDF2); the server only ever holds the ciphertext and can't open or reset it.
//
// The server and every device run their copies through cleanPage(), so whatever is stored is safe
// to show and within the limits.
import { htmlText, sanitizeHtml } from "./office/docModel";

// ─── Limits ──────────────────────────────────────────────────────────────────
export const PAGE_BYTES_MAX = 6_000_000;     // one note, pictures and ink included
export const PAGES_PER_PERSON = 10_000;
export const PAGE_TITLE_MAX = 140;
export const INK_PAGES_MAX = 200;
export const STROKES_PER_INK_PAGE = 5000;
export const POINTS_PER_STROKE = 4000;
export const FOLDERS_MAX = 200;
export const TRASH_DAYS = 30;
export const INK_W = 1000;
export const INK_H = 1414; // A4/Letter-ish portrait

// ─── Look ────────────────────────────────────────────────────────────────────
export type PaperTheme = "paper" | "cream" | "sepia" | "mint" | "rose" | "sky" | "graphite" | "midnight" | "charcoal";
export const PAPER_THEMES: Record<PaperTheme, { name: string; bg: string; ink: string; muted: string; line: string; dark: boolean }> = {
  paper: { name: "Paper", bg: "#ffffff", ink: "#1b1a26", muted: "#6b6880", line: "#e7e4f2", dark: false },
  cream: { name: "Cream", bg: "#fbf7ec", ink: "#2b2516", muted: "#7a6f55", line: "#ece3cc", dark: false },
  sepia: { name: "Sepia", bg: "#f3e7d3", ink: "#3d2e1c", muted: "#806a4e", line: "#e2d1b4", dark: false },
  mint: { name: "Mint", bg: "#eef8f3", ink: "#163428", muted: "#557a69", line: "#d3ebdf", dark: false },
  rose: { name: "Rose", bg: "#fdf1f3", ink: "#3b1720", muted: "#8a5a66", line: "#f3d9de", dark: false },
  sky: { name: "Sky", bg: "#eef5fd", ink: "#14263b", muted: "#55708f", line: "#d6e6f8", dark: false },
  graphite: { name: "Graphite", bg: "#26262b", ink: "#ececf1", muted: "#a3a3ad", line: "#3a3a41", dark: true },
  midnight: { name: "Midnight", bg: "#141a2e", ink: "#e8ecf8", muted: "#9aa5c4", line: "#26304d", dark: true },
  charcoal: { name: "Charcoal", bg: "#1c1c1e", ink: "#f2f2f7", muted: "#a1a1a8", line: "#2c2c2e", dark: true },
};
export const PAPER_THEME_IDS = Object.keys(PAPER_THEMES) as PaperTheme[];

export type PageFont = "system" | "serif" | "rounded" | "mono" | "lexend" | "hand" | "classic" | "modern";
export const PAGE_FONTS: Record<PageFont, { name: string; css: string; google?: string }> = {
  system: { name: "Default", css: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif" },
  serif: { name: "Serif", css: "'Merriweather', Georgia, 'Times New Roman', serif", google: "Merriweather:wght@400;700" },
  classic: { name: "Classic", css: "'Playfair Display', Georgia, serif", google: "Playfair+Display:wght@400;700" },
  modern: { name: "Modern", css: "'Inter', system-ui, sans-serif", google: "Inter:wght@400;600;700" },
  rounded: { name: "Rounded", css: "'Nunito', 'SF Pro Rounded', system-ui, sans-serif", google: "Nunito:wght@400;700" },
  mono: { name: "Mono", css: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace", google: "JetBrains+Mono:wght@400;700" },
  lexend: { name: "Easy reading", css: "'Lexend', system-ui, sans-serif", google: "Lexend:wght@400;600" },
  hand: { name: "Handwritten", css: "'Caveat', 'Bradley Hand', cursive", google: "Caveat:wght@400;700" },
};
export const PAGE_FONT_IDS = Object.keys(PAGE_FONTS) as PageFont[];

export type PaperLines = "none" | "lined" | "grid" | "dots";
export type PageLook = { theme: PaperTheme; font: PageFont; size: number; spacing: number; lines: PaperLines; wide: boolean };
export const DEFAULT_LOOK: PageLook = { theme: "paper", font: "system", size: 17, spacing: 1.6, lines: "none", wide: false };

/** Note colours (the dot on the card), like Apple Notes' tags but brighter. */
export const PAGE_COLORS = ["", "#6a55dc", "#ef4e5b", "#f59e0b", "#10b981", "#0ea5e9", "#ec4899", "#64748b"] as const;

// ─── Ink ─────────────────────────────────────────────────────────────────────
export type InkTool = "pen" | "pencil" | "hl" | "shape";
/** One stroke: points as a flat list [x, y, pressure, x, y, pressure…]; x and y in page units, pressure 0–1. */
export type Stroke = { t: InkTool; c: string; w: number; p: number[] };
export type InkPaper = "blank" | "lined" | "narrow" | "grid" | "dots" | "cornell" | "music";
export type InkPage = { id: string; paper: InkPaper; tint: PaperTheme; bg?: string; strokes: Stroke[] };
export const INK_PAPERS: Record<InkPaper, string> = { blank: "Blank", lined: "Lined", narrow: "Narrow lined", grid: "Grid", dots: "Dots", cornell: "Cornell notes", music: "Music staff" };
export const INK_COLORS = ["#1b1a26", "#6a55dc", "#2563eb", "#0d9488", "#16a34a", "#ef4e5b", "#f59e0b", "#ec4899", "#ffffff"] as const;
export const HL_COLORS = ["#fde047", "#86efac", "#7dd3fc", "#f9a8d4", "#fdba74"] as const;

// ─── A note ──────────────────────────────────────────────────────────────────
export type PageKind = "text" | "ink";
/** What's encrypted when a note is locked (everything a person wrote). */
export type PageContent = { title: string; html: string; ink: InkPage[]; look: PageLook };
/** A locked note's ciphertext: AES-GCM with the notes password's key. Base64. */
export type Cipher = { v: 1; iv: string; data: string };
export type Page = {
  id: string;
  kind: PageKind;
  folderId: string;
  color: string;
  pinned: boolean;
  tags: string[];
  locked: boolean;
  /** Empty when locked: the content is in `cipher`. */
  content: PageContent;
  cipher: Cipher | null;
  /** Plain text for search and cards ("" when locked). Handwriting adds what the iPhone read from it. */
  preview: string;
  search: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
/** A note in a list: everything but the content. */
export type PageMeta = Omit<Page, "content" | "cipher" | "search"> & { title: string };

export type Folder = { id: string; name: string; color: string; icon: string; sort: number };
/** The notes password: a salt and a check value, never the password or key. `hint` is optional and plain. */
export type Vault = { v: 1; salt: string; iter: number; check: Cipher; hint: string };
export type PageSettings = { folders: Folder[]; vault: Vault | null; prefs: { view: "grid" | "list"; sort: "edited" | "created" | "title"; look: PageLook; pencilOnly: boolean }; rev: number };
export const DEFAULT_SETTINGS: PageSettings = { folders: [], vault: null, prefs: { view: "grid", sort: "edited", look: DEFAULT_LOOK, pencilOnly: false }, rev: 0 };

// ─── Cleaning ────────────────────────────────────────────────────────────────
const str = (v: unknown, max: number) => (typeof v === "string" ? v : "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max);
const line = (v: unknown, max: number) => str(v, max * 2).replace(/\s+$/, (m) => (/^ $/.test(m) ? " " : "")).replace(/(\S)\s+(?=\S)/g, "$1 ").replace(/^\s+/, "").slice(0, max);
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const hex = (v: unknown, d = "") => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const b64 = (v: unknown, max: number) => (typeof v === "string" && v.length <= max && /^[A-Za-z0-9+/]+={0,2}$/.test(v) ? v : "");
export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const iso = (v: unknown, d: string) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : d);

export function cleanLook(raw: unknown): PageLook {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    theme: pick(r.theme, PAPER_THEME_IDS, DEFAULT_LOOK.theme),
    font: pick(r.font, PAGE_FONT_IDS, DEFAULT_LOOK.font),
    size: Math.round(num(r.size, 13, 28, DEFAULT_LOOK.size)),
    spacing: Math.round(num(r.spacing, 1.2, 2.2, DEFAULT_LOOK.spacing) * 10) / 10,
    lines: pick(r.lines, ["none", "lined", "grid", "dots"] as const, DEFAULT_LOOK.lines),
    wide: r.wide === true,
  };
}

const PAPER_IDS = Object.keys(INK_PAPERS) as InkPaper[];
export function cleanStroke(raw: unknown): Stroke | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (!Array.isArray(r.p)) return null;
  const p: number[] = [];
  const pts = Math.min(Math.floor(r.p.length / 3), POINTS_PER_STROKE);
  for (let i = 0; i < pts; i++) {
    const x = Number(r.p[i * 3]), y = Number(r.p[i * 3 + 1]), pr = Number(r.p[i * 3 + 2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    p.push(Math.round(num(x, -50, INK_W + 50, 0) * 10) / 10, Math.round(num(y, -50, INK_H + 50, 0) * 10) / 10, Math.round(num(pr, 0, 1, 0.5) * 100) / 100);
  }
  if (!p.length) return null;
  return { t: pick(r.t, ["pen", "pencil", "hl", "shape"] as const, "pen"), c: hex(r.c, "#1b1a26"), w: Math.round(num(r.w, 0.5, 60, 3) * 10) / 10, p };
}
const IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export function cleanInkPage(raw: unknown, i: number): InkPage {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const strokes = (Array.isArray(r.strokes) ? r.strokes : []).slice(0, STROKES_PER_INK_PAGE).map(cleanStroke).filter((s): s is Stroke => !!s);
  const bg = typeof r.bg === "string" && r.bg.length < 3_000_000 && IMG.test(r.bg) ? r.bg : undefined;
  return { id: line(r.id, 40) || `p${i + 1}`, paper: pick(r.paper, PAPER_IDS, "blank"), tint: pick(r.tint, PAPER_THEME_IDS, "paper"), ...(bg ? { bg } : {}), strokes };
}

/** A note's own content, cleaned. Typed notes keep their HTML (pictures included); handwriting keeps ink. */
export function cleanContent(raw: unknown, kind: PageKind): PageContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const html = kind === "text" && typeof r.html === "string" ? sanitizeHtml(r.html.slice(0, PAGE_BYTES_MAX)) : "";
  const ink = kind === "ink" ? (Array.isArray(r.ink) ? r.ink : []).slice(0, INK_PAGES_MAX).map(cleanInkPage) : [];
  return { title: line(r.title, PAGE_TITLE_MAX), html, ink: kind === "ink" && !ink.length ? [blankInkPage()] : ink, look: cleanLook(r.look) };
}

export const cleanCipher = (raw: unknown): Cipher | null => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const iv = b64(r.iv, 40), data = b64(r.data, PAGE_BYTES_MAX * 1.4);
  return r.v === 1 && iv && data ? { v: 1, iv, data } : null;
};

/** Hashtags in the text (#reading, #ieps), lowercased, for the tag filter. */
export function tagsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,30})/gu)) out.add(m[1].toLowerCase());
  return [...out].slice(0, 20);
}

/** Plain text of a typed note (for search, the card and AI tools). */
export const textOfHtml = (html: string) => htmlText(html).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

/** What the server stores for a note: cleaned, with its card preview and search text worked out. */
export function cleanPage(raw: unknown, now: string, prev?: Page | null): Page {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind: PageKind = r.kind === "ink" ? "ink" : "text";
  // Locked only with a valid ciphertext; otherwise it's kept as an ordinary note.
  const cipher = r.locked === true ? cleanCipher(r.cipher) : null;
  const locked = !!cipher;
  const content = locked ? { title: "", html: "", ink: [], look: cleanLook((r.content as any)?.look) } : cleanContent(r.content, kind);
  const body = kind === "text" ? textOfHtml(content.html) : "";
  // Handwriting: what the iPhone read from the pages (sent as `inkText`), so handwriting is searchable.
  const inkText = kind === "ink" && !locked ? line(r.inkText, 20_000) : "";
  const search = locked ? "" : [content.title, body, inkText].filter(Boolean).join("\n").slice(0, 200_000);
  return {
    id: isUuid(r.id) ? r.id.toLowerCase() : (prev?.id ?? ""),
    kind,
    folderId: isUuid(r.folderId) ? r.folderId.toLowerCase() : "",
    color: hex(r.color, ""),
    pinned: r.pinned === true,
    tags: locked ? [] : [...new Set([...(Array.isArray(r.tags) ? r.tags.map((t) => line(t, 30).toLowerCase().replace(/^#/, "")).filter(Boolean) : []), ...tagsIn(`${body}\n${inkText}`)])].slice(0, 20),
    locked,
    content,
    cipher,
    preview: locked ? "" : (body || inkText).replace(/\s+/g, " ").slice(0, 240),
    search,
    rev: prev?.rev ?? 0,
    createdAt: prev?.createdAt ?? iso(r.createdAt, now),
    updatedAt: now,
    deletedAt: prev?.deletedAt ?? null,
  };
}

export const blankInkPage = (paper: InkPaper = "lined", tint: PaperTheme = "paper"): InkPage => ({ id: `p${Math.random().toString(36).slice(2, 9)}`, paper, tint, strokes: [] });
export const pageTitle = (p: { content: PageContent; locked: boolean; kind: PageKind; preview?: string }) =>
  p.locked ? "Locked note" : p.content.title || (p.preview ?? "").split("\n")[0].slice(0, 60) || (p.kind === "ink" ? "Handwritten note" : "New note");
export const pageBytes = (p: unknown) => JSON.stringify(p).length;

export function cleanFolders(raw: unknown): Folder[] {
  const seen = new Set<string>();
  return (Array.isArray(raw) ? raw : []).slice(0, FOLDERS_MAX).map((f: any, i) => ({ id: isUuid(f?.id) ? f.id.toLowerCase() : "", name: line(f?.name, 40), color: hex(f?.color, "#6a55dc"), icon: line(f?.icon, 4) || "📁", sort: Math.round(num(f?.sort, 0, 10_000, i)) }))
    .filter((f) => f.id && f.name && !seen.has(f.id) && seen.add(f.id));
}
export function cleanVault(raw: unknown): Vault | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const salt = b64(r.salt, 64), check = cleanCipher(r.check);
  return r.v === 1 && salt && check ? { v: 1, salt, iter: Math.round(num(r.iter, 100_000, 2_000_000, 310_000)), check, hint: line(r.hint, 80) } : null;
}
export function cleanSettings(raw: unknown, rev = 0): PageSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const p = (r.prefs && typeof r.prefs === "object" ? r.prefs : {}) as Record<string, unknown>;
  return {
    folders: cleanFolders(r.folders),
    vault: cleanVault(r.vault),
    prefs: { view: p.view === "list" ? "list" : "grid", sort: pick(p.sort, ["edited", "created", "title"] as const, "edited"), look: cleanLook(p.look), pencilOnly: p.pencilOnly === true },
    rev,
  };
}

// ─── Templates ───────────────────────────────────────────────────────────────
export type PageTemplate = { id: string; name: string; emoji: string; kind: PageKind; title: string; html?: string; paper?: InkPaper; look?: Partial<PageLook> };
export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: "blank", name: "Blank note", emoji: "📝", kind: "text", title: "" },
  { id: "checklist", name: "Checklist", emoji: "✅", kind: "text", title: "To do", html: '<ul data-check="true"><li data-checked="false"><br></li></ul>' },
  { id: "meeting", name: "Meeting", emoji: "🤝", kind: "text", title: "Meeting", html: "<h2>Who</h2><p><br></p><h2>Notes</h2><p><br></p><h2>Decisions</h2><ul><li><br></li></ul><h2>Next steps</h2><ul data-check=\"true\"><li data-checked=\"false\"><br></li></ul>" },
  { id: "journal", name: "Journal", emoji: "🌙", kind: "text", title: "", html: "<h2>Today</h2><p><br></p><h2>Grateful for</h2><ul><li><br></li></ul><h2>Tomorrow</h2><p><br></p>", look: { theme: "cream", font: "serif" } },
  { id: "lesson", name: "Lesson plan", emoji: "🍎", kind: "text", title: "Lesson", html: "<h2>Objective</h2><p><br></p><h2>Materials</h2><ul><li><br></li></ul><h2>Steps</h2><ol><li><br></li></ol><h2>Check for understanding</h2><p><br></p>" },
  { id: "cornell-text", name: "Cornell (typed)", emoji: "🎓", kind: "text", title: "Class notes", html: '<table style="border-collapse: collapse; width: 100%"><tr><th style="width: 32%; border: 1px solid #ddd; padding: 8px; text-align: left">Questions</th><th style="border: 1px solid #ddd; padding: 8px; text-align: left">Notes</th></tr><tr><td style="border: 1px solid #ddd; padding: 8px"><br></td><td style="border: 1px solid #ddd; padding: 8px"><br></td></tr></table><h3>Summary</h3><p><br></p>' },
  { id: "ink-lined", name: "Handwriting", emoji: "✍️", kind: "ink", title: "", paper: "lined" },
  { id: "ink-grid", name: "Graph paper", emoji: "📐", kind: "ink", title: "", paper: "grid" },
  { id: "ink-dots", name: "Dot journal", emoji: "⚫", kind: "ink", title: "", paper: "dots" },
  { id: "ink-cornell", name: "Cornell (handwritten)", emoji: "🎓", kind: "ink", title: "", paper: "cornell" },
  { id: "ink-blank", name: "Sketch", emoji: "🎨", kind: "ink", title: "", paper: "blank" },
  { id: "ink-music", name: "Music staff", emoji: "🎼", kind: "ink", title: "", paper: "music" },
];
