// Pod+ profile pages (MySpace style, kept minimal): every listener's page is theirs to design.
// A background (color, gradient, pattern or photo), a banner, an accent color, a font, a card style,
// a profile song, a mood, and widgets they add, arrange and fill in (Top 8 shows, Top 8 friends,
// guestbook, quote, links, photo...). Shared by the page, its editor and the server, which cleans
// every saved page with cleanPage() so nothing unsafe or oversized is ever stored or shown.

export type PageFont = "sans" | "serif" | "mono" | "rounded" | "display" | "hand";
export type CardStyle = "glass" | "solid" | "outline" | "none";
export type Pattern = "dots" | "grid" | "stripes" | "checks" | "waves" | "stars" | "hearts";
export type PageBg =
  | { kind: "color"; color: string }
  | { kind: "gradient"; color: string; color2: string; angle: number }
  | { kind: "pattern"; color: string; color2: string; pattern: Pattern; size: number }
  | { kind: "image"; image: string; fit: "cover" | "tile"; dim: number; color: string };
export type PageBanner = { kind: "none" } | { kind: "color"; color: string; color2?: string } | { kind: "image"; image: string };
export type PageEpisode = { id: string; showId: string; show: string; title: string; art: string; audio: string; secs: number; date?: string };
export type PageShow = { id: string; name: string; art: string; author?: string };

export type WidgetType = "about" | "mood" | "song" | "stats" | "top8" | "friends" | "quote" | "links" | "text" | "photo" | "interests" | "posts" | "clips" | "podcast" | "guestbook";
export type Widget = {
  id: string; type: WidgetType; col: "side" | "main"; title?: string;
  text?: string; by?: string; image?: string;
  shows?: PageShow[]; handles?: string[]; links?: { label: string; url: string }[]; tags?: string[]; count?: number;
};
export type ProfilePageData = {
  v: 1;
  bg: PageBg; banner: PageBanner;
  accent: string; text: "auto" | "light" | "dark"; font: PageFont;
  card: CardStyle; cardColor: string; radius: number;
  layout: "one" | "two";
  mood: { emoji: string; text: string };
  song: PageEpisode | null;
  widgets: Widget[];
};
export type GuestEntry = { id: string; handle: string; name: string; avatar: string; body: string; at: string };

export const WIDGETS: { type: WidgetType; name: string; about: string; col: "side" | "main"; once?: boolean }[] = [
  { type: "about", name: "About me", about: "Your bio, in your words", col: "main", once: true },
  { type: "mood", name: "Mood", about: "How you feel and what you're into today", col: "side", once: true },
  { type: "song", name: "Profile song", about: "An episode that plays on your page", col: "side", once: true },
  { type: "stats", name: "Stats", about: "Followers, following and posts", col: "side", once: true },
  { type: "top8", name: "Top 8 shows", about: "Your eight favorite podcasts", col: "main", once: true },
  { type: "friends", name: "Top 8 friends", about: "The people you pick, in your order", col: "main", once: true },
  { type: "interests", name: "Interests", about: "Tags for what you love", col: "side" },
  { type: "quote", name: "Quote", about: "A line from an episode, or anything", col: "main" },
  { type: "links", name: "Links", about: "Your other pages", col: "side" },
  { type: "text", name: "Text box", about: "A box that says anything", col: "main" },
  { type: "photo", name: "Photo", about: "A picture with a caption", col: "main" },
  { type: "posts", name: "Latest posts", about: "What you posted lately", col: "main", once: true },
  { type: "clips", name: "Clips", about: "Moments you cut from episodes", col: "main", once: true },
  { type: "podcast", name: "My podcast", about: "Episodes you made", col: "main", once: true },
  { type: "guestbook", name: "Guestbook", about: "Visitors leave you a note", col: "main", once: true },
];

export const FONTS: Record<PageFont, { name: string; stack: string; weight: number }> = {
  sans: { name: "Clean", stack: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", weight: 700 },
  serif: { name: "Classic", stack: "Georgia, 'Iowan Old Style', 'Times New Roman', serif", weight: 700 },
  mono: { name: "Typewriter", stack: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace", weight: 700 },
  rounded: { name: "Soft", stack: "ui-rounded, 'SF Pro Rounded', Nunito, 'Varela Round', system-ui, sans-serif", weight: 800 },
  display: { name: "Loud", stack: "Impact, 'Haettenschweiler', 'Arial Narrow Bold', 'Arial Black', sans-serif", weight: 400 },
  hand: { name: "Doodle", stack: "'Comic Sans MS', 'Comic Neue', 'Marker Felt', 'Chalkboard SE', cursive", weight: 700 },
};

export const PATTERNS: Pattern[] = ["dots", "grid", "stripes", "checks", "waves", "stars", "hearts"];

/** Ready-made looks: one tap sets the whole theme (widgets stay as they are). */
export const PRESETS: { id: string; name: string; look: Partial<ProfilePageData> }[] = [
  // The default: Pod+'s own calm, grown-up look (near-black, a quiet charcoal banner, the orange accent).
  { id: "podplus", name: "Pod+", look: { bg: { kind: "color", color: "#0b0b0d" }, banner: { kind: "color", color: "#1d1d22", color2: "#2c2c33" }, accent: "#ff8a3d", text: "light", font: "sans", card: "none", cardColor: "#141418", radius: 14 } },
  { id: "midnight", name: "Midnight", look: { bg: { kind: "gradient", color: "#0f172a", color2: "#312e81", angle: 160 }, banner: { kind: "color", color: "#6366f1", color2: "#ec4899" }, accent: "#a5b4fc", text: "light", font: "sans", card: "glass", cardColor: "#111827", radius: 18 } },
  { id: "paper", name: "Paper", look: { bg: { kind: "color", color: "#f6f3ee" }, banner: { kind: "color", color: "#e7dfd2" }, accent: "#c2410c", text: "dark", font: "serif", card: "solid", cardColor: "#ffffff", radius: 6 } },
  { id: "sunset", name: "Sunset", look: { bg: { kind: "gradient", color: "#ff7e5f", color2: "#7b2ff7", angle: 135 }, banner: { kind: "none" }, accent: "#fff3b0", text: "light", font: "rounded", card: "glass", cardColor: "#000000", radius: 24 } },
  { id: "y2k", name: "Y2K", look: { bg: { kind: "pattern", color: "#ffd1f0", color2: "#ff6ec7", pattern: "stars", size: 34 }, banner: { kind: "color", color: "#ff6ec7", color2: "#7afcff" }, accent: "#d6006f", text: "dark", font: "hand", card: "solid", cardColor: "#ffffff", radius: 14 } },
  { id: "neon", name: "Neon", look: { bg: { kind: "pattern", color: "#05010d", color2: "#1d0b3a", pattern: "grid", size: 28 }, banner: { kind: "color", color: "#00f5d4", color2: "#f15bb5" }, accent: "#00f5d4", text: "light", font: "mono", card: "outline", cardColor: "#05010d", radius: 4 } },
  { id: "forest", name: "Forest", look: { bg: { kind: "gradient", color: "#0b3d2e", color2: "#1f6f50", angle: 180 }, banner: { kind: "color", color: "#9bd19b" }, accent: "#c6f6a8", text: "light", font: "serif", card: "glass", cardColor: "#062a1f", radius: 12 } },
  { id: "minimal", name: "Minimal", look: { bg: { kind: "color", color: "#ffffff" }, banner: { kind: "none" }, accent: "#111111", text: "dark", font: "sans", card: "outline", cardColor: "#ffffff", radius: 10 } },
  { id: "retro", name: "Retro", look: { bg: { kind: "pattern", color: "#1b3a6b", color2: "#24508f", pattern: "checks", size: 40 }, banner: { kind: "color", color: "#ffb703", color2: "#fb8500" }, accent: "#ffb703", text: "dark", font: "display", card: "solid", cardColor: "#fffaf0", radius: 0 } },
];

/** Photo backgrounds anyone can pick (free-to-use photos on Wikimedia Commons). */
export const PHOTO_BGS: { name: string; url: string }[] = [
  { name: "Night sky", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Aurora-borealis_andoya.jpg?width=1600" },
  { name: "Ocean", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Bay_of_Fundy_-_Hopewell_Rocks.jpg?width=1600" },
  { name: "Forest", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Mangrove_trees_in_Everglades.JPG?width=1600" },
  { name: "Leaves", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Red_autumn_leaves.jpg?width=1600" },
  { name: "Rainbow", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Double_rainbow_italy.jpg?width=1600" },
  { name: "Saturn", url: "https://commons.wikimedia.org/wiki/Special:FilePath/PIA05380_-_Saturn_from_Cassini_Orbiter_(square).jpg?width=1600" },
  { name: "Moon", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Full_Moon_Luc_Viatour.jpg?width=1600" },
  { name: "Wind farm", url: "https://commons.wikimedia.org/wiki/Special:FilePath/Rows_of_wind_turbines_at_wind_farm_at_hills.jpg?width=1600" },
];

export const MOODS = ["🎧", "😌", "🤩", "😴", "🤔", "😂", "🔥", "💀", "🥹", "😎", "🧠", "🌙", "☕", "🚗", "🏃", "🎮"];

export const newWidgetId = () => Math.random().toString(36).slice(2, 10);

/** A new page for someone who hasn't designed theirs yet: clean, with the classic sections in place. */
export function defaultPage(): ProfilePageData {
  return {
    v: 1, ...(PRESETS[0].look as Omit<ProfilePageData, "v" | "widgets" | "mood" | "song" | "layout">),
    layout: "two", mood: { emoji: "🎧", text: "" }, song: null,
    widgets: [
      { id: "w-mood", type: "mood", col: "side" }, { id: "w-song", type: "song", col: "side" }, { id: "w-stats", type: "stats", col: "side" },
      { id: "w-about", type: "about", col: "main" }, { id: "w-top8", type: "top8", col: "main", shows: [] }, { id: "w-friends", type: "friends", col: "main", handles: [] },
      { id: "w-posts", type: "posts", col: "main", count: 5 }, { id: "w-guest", type: "guestbook", col: "main" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Cleaning (server and client): only known fields, safe colors, https links, sensible sizes.
// ---------------------------------------------------------------------------
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max) : "");
const color = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback);
const num = (v: unknown, lo: number, hi: number, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback; };
const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
/** Only https links to images and pages (no scripts, no data: tricks). */
export const safeUrl = (v: unknown, max = 600) => { const s = str(v, max); try { const u = new URL(s); return u.protocol === "https:" && !/["'<>\s]/.test(s) ? u.toString() : ""; } catch { return ""; } };
const idOf = (v: unknown) => str(v, 24).replace(/[^A-Za-z0-9_-]/g, "");

function cleanEpisode(v: any): PageEpisode | null {
  if (!v || typeof v !== "object") return null;
  const id = str(v.id, 24).replace(/\D/g, ""), showId = str(v.showId, 24).replace(/\D/g, "");
  const audio = safeUrl(v.audio, 1200);
  if (!id || !showId || !audio) return null;
  return { id, showId, show: str(v.show, 120), title: str(v.title, 200), art: safeUrl(v.art), audio, secs: num(v.secs, 0, 86_400, 0), date: str(v.date, 40) || undefined };
}
function cleanShow(v: any): PageShow | null {
  if (!v || typeof v !== "object") return null;
  const id = str(v.id, 24).replace(/\D/g, "");
  return id ? { id, name: str(v.name, 120), art: safeUrl(v.art), author: str(v.author, 120) || undefined } : null;
}
function cleanBg(v: any, fb: PageBg): PageBg {
  const kind = pick(v?.kind, ["color", "gradient", "pattern", "image"] as const, fb.kind);
  if (kind === "color") return { kind, color: color(v?.color, "#0f172a") };
  if (kind === "gradient") return { kind, color: color(v?.color, "#0f172a"), color2: color(v?.color2, "#312e81"), angle: num(v?.angle, 0, 360, 160) };
  if (kind === "pattern") return { kind, color: color(v?.color, "#0f172a"), color2: color(v?.color2, "#1e293b"), pattern: pick(v?.pattern, PATTERNS, "dots"), size: num(v?.size, 12, 80, 28) };
  const image = safeUrl(v?.image);
  return image ? { kind, image, fit: v?.fit === "tile" ? "tile" : "cover", dim: num(v?.dim, 0, 80, 30), color: color(v?.color, "#000000") } : fb;
}
function cleanBanner(v: any): PageBanner {
  if (v?.kind === "image") { const image = safeUrl(v.image); if (image) return { kind: "image", image }; }
  if (v?.kind === "color") return { kind: "color", color: color(v.color, "#6366f1"), ...(typeof v.color2 === "string" && /^#[0-9a-fA-F]{6}$/.test(v.color2) ? { color2: v.color2.toLowerCase() } : {}) };
  return { kind: "none" };
}
function cleanWidget(v: any): Widget | null {
  const type = pick(v?.type, WIDGETS.map((w) => w.type), "text" as WidgetType);
  if (!v || !WIDGETS.some((w) => w.type === v.type)) return null;
  const w: Widget = { id: idOf(v.id) || newWidgetId(), type, col: v.col === "side" ? "side" : "main" };
  const title = str(v.title, 60); if (title) w.title = title;
  if (type === "quote" || type === "text") { w.text = str(v.text, type === "text" ? 2000 : 400); const by = str(v.by, 80); if (by) w.by = by; }
  if (type === "photo") { w.image = safeUrl(v.image); w.text = str(v.text, 200); }
  if (type === "top8") w.shows = (Array.isArray(v.shows) ? v.shows : []).map(cleanShow).filter(Boolean).slice(0, 8) as PageShow[];
  if (type === "friends") w.handles = [...new Set((Array.isArray(v.handles) ? v.handles : []).map((h: unknown) => str(h, 30).toLowerCase().replace(/^@/, "")).filter((h: string) => /^[a-z0-9_]{3,20}$/.test(h)))].slice(0, 8) as string[];
  if (type === "links") w.links = (Array.isArray(v.links) ? v.links : []).map((l: any) => ({ label: str(l?.label, 40), url: safeUrl(l?.url) })).filter((l: { label: string; url: string }) => l.url).slice(0, 8);
  if (type === "interests") w.tags = [...new Set((Array.isArray(v.tags) ? v.tags : []).map((t: unknown) => str(t, 24)).filter(Boolean))].slice(0, 16) as string[];
  if (type === "posts" || type === "clips" || type === "podcast") w.count = num(v.count, 1, 20, 5);
  return w;
}

/** A page made safe to store and show. Anything unknown is dropped; anything missing gets a default. */
export function cleanPage(raw: unknown): ProfilePageData {
  const d = defaultPage();
  const v: any = raw && typeof raw === "object" ? raw : {};
  const widgets = (Array.isArray(v.widgets) ? v.widgets : d.widgets).map(cleanWidget).filter(Boolean) as Widget[];
  const once = new Set<WidgetType>(); const seen = new Set<string>();
  const unique = widgets.filter((w) => {
    if (seen.has(w.id)) w.id = newWidgetId(); seen.add(w.id);
    if (WIDGETS.find((x) => x.type === w.type)?.once) { if (once.has(w.type)) return false; once.add(w.type); }
    return true;
  }).slice(0, 30);
  return {
    v: 1,
    bg: cleanBg(v.bg, d.bg), banner: v.banner ? cleanBanner(v.banner) : d.banner,
    accent: color(v.accent, d.accent), text: pick(v.text, ["auto", "light", "dark"] as const, "auto"), font: pick(v.font, Object.keys(FONTS) as PageFont[], d.font),
    card: pick(v.card, ["glass", "solid", "outline", "none"] as const, d.card), cardColor: color(v.cardColor, d.cardColor), radius: num(v.radius, 0, 28, d.radius),
    layout: v.layout === "one" ? "one" : "two",
    mood: { emoji: MOODS.includes(v?.mood?.emoji) ? v.mood.emoji : "🎧", text: str(v?.mood?.text, 80) },
    song: cleanEpisode(v.song),
    widgets: unique,
  };
}

// ---------------------------------------------------------------------------
// Colors: readable text on whatever they picked.
// ---------------------------------------------------------------------------
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => { const c = parseInt(m[1].slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const mix = (a: string, b: string) => { const p = (h: string, i: number) => parseInt(h.slice(1 + i, 3 + i), 16); return `#${[0, 2, 4].map((i) => Math.round((p(a, i) + p(b, i)) / 2).toString(16).padStart(2, "0")).join("")}`; };
/** The color most of the page shows (for choosing text that reads on it). */
export const bgTone = (bg: PageBg): string => bg.kind === "color" ? bg.color : bg.kind === "image" ? (bg.dim >= 25 ? "#202020" : "#606060") : mix(bg.color, bg.color2);
/** Text on the page itself (outside cards). */
export const pageInk = (p: ProfilePageData) => p.text === "light" ? "#ffffff" : p.text === "dark" ? "#111111" : luminance(bgTone(p.bg)) > 0.38 ? "#111111" : "#ffffff";
/** Text inside the cards. */
export const cardInk = (p: ProfilePageData) => p.card === "solid" ? (luminance(p.cardColor) > 0.38 ? "#111111" : "#ffffff") : pageInk(p);

/** The CSS background for the page. */
export function bgCss(bg: PageBg): { backgroundColor?: string; backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string; backgroundRepeat?: string; backgroundAttachment?: string } {
  if (bg.kind === "color") return { backgroundColor: bg.color };
  if (bg.kind === "gradient") return { backgroundColor: bg.color, backgroundImage: `linear-gradient(${bg.angle}deg, ${bg.color}, ${bg.color2})` };
  if (bg.kind === "image") {
    const shade = `linear-gradient(rgba(0,0,0,${bg.dim / 100}), rgba(0,0,0,${bg.dim / 100}))`;
    return { backgroundColor: bg.color, backgroundImage: `${shade}, url("${bg.image.replace(/"/g, "%22")}")`, backgroundSize: bg.fit === "tile" ? "auto, 240px" : "auto, cover", backgroundPosition: "center", backgroundRepeat: bg.fit === "tile" ? "repeat" : "no-repeat", backgroundAttachment: "scroll" };
  }
  const c2 = bg.color2, s = bg.size;
  const svg = (body: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}' viewBox='0 0 40 40'>${body}</svg>`)}")`;
  const img: Record<Pattern, string> = {
    dots: `radial-gradient(${c2} 2px, transparent 2.5px)`,
    grid: `linear-gradient(${c2} 1px, transparent 1px), linear-gradient(90deg, ${c2} 1px, transparent 1px)`,
    stripes: `repeating-linear-gradient(45deg, ${c2} 0 ${Math.round(s / 4)}px, transparent ${Math.round(s / 4)}px ${Math.round(s / 2)}px)`,
    checks: `conic-gradient(${c2} 25%, transparent 0 50%, ${c2} 0 75%, transparent 0)`,
    waves: svg(`<path d='M0 25 Q10 15 20 25 T40 25' fill='none' stroke='${c2}' stroke-width='3'/>`),
    stars: svg(`<path d='M20 6l3.5 8.5 9 .7-6.9 5.9 2.2 8.9L20 25.3l-7.8 4.7 2.2-8.9-6.9-5.9 9-.7z' fill='${c2}'/>`),
    hearts: svg(`<path d='M20 31s-11-6.8-11-14a6 6 0 0 1 11-3.3A6 6 0 0 1 31 17c0 7.2-11 14-11 14z' fill='${c2}'/>`),
  };
  return { backgroundColor: bg.color, backgroundImage: img[bg.pattern], backgroundSize: bg.pattern === "grid" || bg.pattern === "dots" || bg.pattern === "checks" ? `${s}px ${s}px` : undefined };
}
