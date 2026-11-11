// Arise Design: a Canva-style design maker (Arise Notes app "Design", Office kind "design"). A design is
// one or more pages of the same size (an Instagram post, a story, a flyer, a poster…), each a background
// and positioned elements: text, shapes, lines, pictures, picture frames and stickers. Everything here is
// shared by the editor (client/src/components/office/DesignEditor.tsx), the templates
// (designTemplates.ts), exporting (designRender.ts) and the server's check of what's saved.

export type DesignSize = { id: string; name: string; group: string; w: number; h: number; unit?: string };
/** The sizes people start from, in pixels at print/screen resolution. */
export const SIZES: DesignSize[] = [
  { id: "ig-post", name: "Instagram post", group: "Social", w: 1080, h: 1080 },
  { id: "ig-portrait", name: "Instagram portrait", group: "Social", w: 1080, h: 1350 },
  { id: "story", name: "Story / Reel", group: "Social", w: 1080, h: 1920 },
  { id: "fb-post", name: "Facebook post", group: "Social", w: 1200, h: 630 },
  { id: "pin", name: "Pinterest pin", group: "Social", w: 1000, h: 1500 },
  { id: "x-header", name: "X / Twitter header", group: "Social", w: 1500, h: 500 },
  { id: "li-banner", name: "LinkedIn banner", group: "Social", w: 1584, h: 396 },
  { id: "yt-thumb", name: "YouTube thumbnail", group: "Video", w: 1280, h: 720 },
  { id: "yt-banner", name: "YouTube banner", group: "Video", w: 2560, h: 1440 },
  { id: "presentation", name: "Presentation (16:9)", group: "Work", w: 1920, h: 1080 },
  { id: "flyer", name: "Flyer (Letter)", group: "Print", w: 1275, h: 1650, unit: "8.5 × 11 in" },
  { id: "a4", name: "A4 document", group: "Print", w: 1240, h: 1754, unit: "210 × 297 mm" },
  { id: "poster", name: "Poster (18 × 24)", group: "Print", w: 1800, h: 2400, unit: "18 × 24 in" },
  { id: "invite", name: "Invitation (5 × 7)", group: "Print", w: 1050, h: 1470, unit: "5 × 7 in" },
  { id: "card", name: "Business card", group: "Print", w: 1050, h: 600, unit: "3.5 × 2 in" },
  { id: "postcard", name: "Postcard", group: "Print", w: 1800, h: 1200, unit: "6 × 4 in" },
  { id: "certificate", name: "Certificate", group: "Print", w: 1650, h: 1275, unit: "11 × 8.5 in" },
  { id: "menu", name: "Menu", group: "Print", w: 1275, h: 2100, unit: "8.5 × 14 in" },
  { id: "logo", name: "Logo", group: "Brand", w: 1000, h: 1000 },
  { id: "email-header", name: "Email header", group: "Brand", w: 1200, h: 400 },
  { id: "phone-wallpaper", name: "Phone wallpaper", group: "Fun", w: 1170, h: 2532 },
  { id: "desktop-wallpaper", name: "Desktop wallpaper", group: "Fun", w: 1920, h: 1200 },
  { id: "worksheet", name: "Worksheet", group: "School", w: 1275, h: 1650, unit: "8.5 × 11 in" },
  { id: "classroom-poster", name: "Classroom poster", group: "School", w: 1650, h: 2550, unit: "11 × 17 in" },
];
export const sizeOf = (id: string) => SIZES.find((s) => s.id === id);

export type ShapeKind = "rect" | "round" | "ellipse" | "triangle" | "diamond" | "pentagon" | "hexagon" | "star" | "star4" | "heart" | "arrow" | "speech" | "cross" | "blob" | "arch" | "badge";
export type LineKind = "solid" | "dashed" | "dotted" | "arrow";
export type DElType = "text" | "shape" | "line" | "image" | "sticker";
export type DEl = {
  id: string; type: DElType;
  x: number; y: number; w: number; h: number; rot?: number; opacity?: number; locked?: boolean; flipX?: boolean; flipY?: boolean;
  // Text
  text?: string; font?: string; size?: number; weight?: 400 | 700 | 900; italic?: boolean; color?: string; align?: "left" | "center" | "right";
  lineH?: number; letter?: number; upper?: boolean; underline?: boolean; highlight?: string; outline?: string;
  // Shape, line, frame
  shape?: ShapeKind; line?: LineKind; fill?: string; stroke?: string; strokeW?: number; radius?: number;
  // Picture (an empty one is a frame: "add a photo")
  src?: string; fit?: "cover" | "contain";
  // Sticker (an emoji drawn big)
  emoji?: string;
  shadow?: boolean;
};
export type DPage = { id: string; bg: string; bgImage?: string; elements: DEl[] };
export type Design = { v: 1; size: string; w: number; h: number; pages: DPage[]; uploads: string[] };

let n = 0;
export const dId = () => `d${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const blankDesign = (sizeId = "ig-post", bg = "#ffffff"): Design => {
  const s = sizeOf(sizeId) || SIZES[0];
  return { v: 1, size: s.id, w: s.w, h: s.h, pages: [{ id: dId(), bg, elements: [] }], uploads: [] };
};

// ─── Colors and backgrounds ───

/** A plain color (#rgb, #rrggbb, #rrggbbaa) or a gradient written as "linear:<angle>:<color>:<color>[:<color>]". */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
export const isColor = (v: unknown): v is string => typeof v === "string" && (HEX.test(v) || v === "none" || v === "transparent");
export const isFill = (v: unknown): v is string => isColor(v) || (typeof v === "string" && /^linear:\d{1,3}(:#[0-9a-f]{3,8}){2,3}$/i.test(v));
export function gradientParts(fill: string): { angle: number; stops: string[] } | null {
  const m = /^linear:(\d{1,3})((?::#[0-9a-f]{3,8}){2,3})$/i.exec(fill);
  return m ? { angle: Number(m[1]) % 360, stops: m[2].slice(1).split(":") } : null;
}
/** The CSS for a fill: a color, or a linear gradient. */
export const fillCss = (fill?: string) => { if (!fill) return "transparent"; const g = gradientParts(fill); return g ? `linear-gradient(${g.angle}deg, ${g.stops.join(", ")})` : fill; };

export const GRADIENTS = [
  "linear:135:#ff9a9e:#fecfef", "linear:135:#a18cd1:#fbc2eb", "linear:135:#fbc2eb:#a6c1ee", "linear:135:#84fab0:#8fd3f4", "linear:135:#f6d365:#fda085",
  "linear:135:#667eea:#764ba2", "linear:135:#43e97b:#38f9d7", "linear:135:#fa709a:#fee140", "linear:135:#30cfd0:#330867", "linear:135:#ff0844:#ffb199",
  "linear:180:#0f2027:#203a43:#2c5364", "linear:135:#f093fb:#f5576c", "linear:135:#4facfe:#00f2fe", "linear:160:#232526:#414345", "linear:135:#ffecd2:#fcb69f",
  "linear:135:#c471f5:#fa71cd", "linear:180:#e0c3fc:#8ec5fc", "linear:135:#13547a:#80d0c7", "linear:135:#ff512f:#dd2476", "linear:135:#fdfbfb:#ebedee",
];
export const SWATCHES = [
  "#ffffff", "#f8fafc", "#e2e8f0", "#94a3b8", "#475569", "#1e293b", "#0f172a", "#000000",
  "#fee2e2", "#fca5a5", "#ef4444", "#b91c1c", "#ffedd5", "#fdba74", "#f97316", "#c2410c",
  "#fef9c3", "#fde047", "#eab308", "#a16207", "#dcfce7", "#86efac", "#22c55e", "#15803d",
  "#cffafe", "#67e8f9", "#06b6d4", "#0e7490", "#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8",
  "#ede9fe", "#c4b5fd", "#8b5cf6", "#6d28d9", "#fce7f3", "#f9a8d4", "#ec4899", "#be185d",
];

/** Fonts: the ones the Office apps already load, plus display fonts that make designs look designed. */
export const DESIGN_FONTS = [
  "Inter", "Poppins", "Montserrat", "Raleway", "Lato", "Open Sans", "Roboto", "Nunito", "Quicksand", "Space Grotesk", "Lexend",
  "Bebas Neue", "Anton", "Oswald", "Archivo Black", "Righteous",
  "Playfair Display", "DM Serif Display", "Abril Fatface", "Merriweather", "Georgia",
  "Pacifico", "Dancing Script", "Caveat", "Lobster", "Permanent Marker", "Shadows Into Light",
] as const;
/** Google Fonts address for the fonts the Office apps don't already load. */
export const DESIGN_FONT_LINK = "https://fonts.googleapis.com/css2?" + ["Poppins:wght@400;700;900", "Raleway:wght@400;700;900", "Nunito:wght@400;700;900", "Quicksand:wght@400;700", "Space+Grotesk:wght@400;700",
  "Bebas+Neue", "Anton", "Oswald:wght@400;700", "Archivo+Black", "Righteous", "DM+Serif+Display", "Abril+Fatface", "Pacifico", "Dancing+Script:wght@400;700", "Caveat:wght@400;700", "Lobster",
  "Permanent+Marker", "Shadows+Into+Light", "Montserrat:wght@400;700;900", "Inter:wght@400;700;900", "Playfair+Display:wght@400;700;900"].map((f) => `family=${f}`).join("&") + "&display=swap";

// ─── Shapes ───

export const SHAPES: { id: ShapeKind; label: string }[] = [
  { id: "rect", label: "Square" }, { id: "round", label: "Rounded" }, { id: "ellipse", label: "Circle" }, { id: "triangle", label: "Triangle" },
  { id: "diamond", label: "Diamond" }, { id: "pentagon", label: "Pentagon" }, { id: "hexagon", label: "Hexagon" }, { id: "star", label: "Star" },
  { id: "star4", label: "Sparkle" }, { id: "heart", label: "Heart" }, { id: "arrow", label: "Arrow" }, { id: "speech", label: "Speech bubble" },
  { id: "cross", label: "Plus" }, { id: "blob", label: "Blob" }, { id: "arch", label: "Arch" }, { id: "badge", label: "Badge" },
];
const SHAPE_IDS = SHAPES.map((s) => s.id);
const poly = (pts: [number, number][]) => `M ${pts.map((p) => `${+p[0].toFixed(2)} ${+p[1].toFixed(2)}`).join(" L ")} Z`;
const starPts = (w: number, h: number, points: number, inner: number) => {
  const out: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / points, r = i % 2 ? inner : 1; out.push([w / 2 + (w / 2) * r * Math.cos(a), h / 2 + (h / 2) * r * Math.sin(a)]); }
  return out;
};
/** An SVG path for a shape in a w × h box (the same path draws on screen and when exporting). */
export function designShapePath(kind: ShapeKind, w: number, h: number, r = 0): string {
  switch (kind) {
    case "ellipse": return `M ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 1 ${w / 2 - 0.01} 0 Z`;
    case "round": { const rr = Math.min(r || Math.min(w, h) * 0.12, w / 2, h / 2); return `M ${rr} 0 H ${w - rr} Q ${w} 0 ${w} ${rr} V ${h - rr} Q ${w} ${h} ${w - rr} ${h} H ${rr} Q 0 ${h} 0 ${h - rr} V ${rr} Q 0 0 ${rr} 0 Z`; }
    case "triangle": return poly([[w / 2, 0], [w, h], [0, h]]);
    case "diamond": return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case "pentagon": return poly(Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)] as [number, number]; }));
    case "hexagon": return poly([[w * 0.25, 0], [w * 0.75, 0], [w, h / 2], [w * 0.75, h], [w * 0.25, h], [0, h / 2]]);
    case "star": return poly(starPts(w, h, 5, 0.42));
    case "star4": return poly(starPts(w, h, 4, 0.28));
    case "badge": return poly(starPts(w, h, 16, 0.86));
    case "heart": return `M ${w / 2} ${h * 0.95} C ${w * 0.1} ${h * 0.65} 0 ${h * 0.4} 0 ${h * 0.28} C 0 ${h * 0.08} ${w * 0.18} 0 ${w * 0.3} 0 C ${w * 0.4} 0 ${w * 0.48} ${h * 0.06} ${w / 2} ${h * 0.16} C ${w * 0.52} ${h * 0.06} ${w * 0.6} 0 ${w * 0.7} 0 C ${w * 0.82} 0 ${w} ${h * 0.08} ${w} ${h * 0.28} C ${w} ${h * 0.4} ${w * 0.9} ${h * 0.65} ${w / 2} ${h * 0.95} Z`;
    case "arrow": { const s = h * 0.3, hw = Math.min(w * 0.4, h); return poly([[0, s], [w - hw, s], [w - hw, 0], [w, h / 2], [w - hw, h], [w - hw, h - s], [0, h - s]]); }
    case "speech": { const bh = h * 0.78, rr = Math.min(w, bh) * 0.16; return `M ${rr} 0 H ${w - rr} Q ${w} 0 ${w} ${rr} V ${bh - rr} Q ${w} ${bh} ${w - rr} ${bh} H ${w * 0.35} L ${w * 0.18} ${h} L ${w * 0.22} ${bh} H ${rr} Q 0 ${bh} 0 ${bh - rr} V ${rr} Q 0 0 ${rr} 0 Z`; }
    case "cross": { const t = Math.min(w, h) * 0.32, cx = w / 2, cy = h / 2; return poly([[cx - t / 2, 0], [cx + t / 2, 0], [cx + t / 2, cy - t / 2], [w, cy - t / 2], [w, cy + t / 2], [cx + t / 2, cy + t / 2], [cx + t / 2, h], [cx - t / 2, h], [cx - t / 2, cy + t / 2], [0, cy + t / 2], [0, cy - t / 2], [cx - t / 2, cy - t / 2]]); }
    case "blob": return `M ${w * 0.5} 0 C ${w * 0.8} 0 ${w} ${h * 0.2} ${w * 0.97} ${h * 0.48} C ${w * 0.94} ${h * 0.78} ${w * 0.75} ${h} ${w * 0.47} ${h * 0.98} C ${w * 0.2} ${h * 0.96} 0 ${h * 0.78} ${w * 0.03} ${h * 0.5} C ${w * 0.06} ${h * 0.2} ${w * 0.22} 0 ${w * 0.5} 0 Z`;
    case "arch": return `M 0 ${h} V ${w / 2} A ${w / 2} ${w / 2} 0 0 1 ${w} ${w / 2} V ${h} Z`;
    default: return `M 0 0 H ${w} V ${h} H 0 Z`;
  }
}

// ─── Stickers (emoji, drawn big: they export cleanly as text) ───

export const STICKERS: { group: string; items: string[] }[] = [
  { group: "Smiles", items: ["😀", "😍", "🥳", "😎", "🤩", "😂", "🥰", "😇", "🤔", "😴", "🙌", "👏", "👍", "💪", "🙏", "✌️"] },
  { group: "Love", items: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💕", "💌", "🌹", "💐", "💍", "😘", "🫶"] },
  { group: "Celebrate", items: ["🎉", "🎊", "🎈", "🎁", "🎂", "🍰", "🥂", "🍾", "🏆", "🥇", "⭐", "🌟", "✨", "💫", "🎆", "🪅"] },
  { group: "Nature", items: ["🌸", "🌻", "🌼", "🌷", "🍀", "🌿", "🌴", "🌵", "🍁", "🍂", "🌈", "☀️", "🌙", "⛅", "❄️", "🌊"] },
  { group: "Food", items: ["🍕", "🍔", "🌮", "🍣", "🍩", "🍪", "🧁", "🍦", "🍓", "🍉", "🍋", "🥑", "☕", "🧋", "🍹", "🥗"] },
  { group: "School", items: ["📚", "✏️", "📝", "🎒", "🍎", "🧮", "🔬", "🧪", "🌍", "🎨", "🎵", "🧩", "📐", "🖍️", "🏫", "🎓"] },
  { group: "Work", items: ["💼", "📈", "📊", "💡", "📣", "📅", "⏰", "💻", "📱", "✅", "📌", "🔔", "🚀", "🎯", "🤝", "💰"] },
  { group: "Animals", items: ["🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🦁", "🐯", "🐸", "🐵", "🦄", "🐝", "🦋", "🐢", "🐬", "🦉"] },
  { group: "Sports", items: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏓", "⛳", "🏊", "🚴", "🧘", "🏋️", "⛷️", "🏄", "🥊", "🛹"] },
  { group: "Holidays", items: ["🎃", "👻", "🦃", "🎄", "🎅", "⛄", "🕎", "🪔", "🐰", "🥚", "🍀", "🇺🇸", "🎇", "🧧", "🕯️", "🔔"] },
  { group: "Travel", items: ["✈️", "🚗", "🏖️", "🏔️", "🗽", "🗼", "🏰", "🎡", "⛺", "🧳", "🗺️", "📸", "🚢", "🚂", "🌋", "🏝️"] },
  { group: "Symbols", items: ["➡️", "⬅️", "⬆️", "⬇️", "✔️", "❌", "❗", "❓", "💯", "🔥", "⚡", "💥", "💬", "📍", "🔗", "♻️"] },
];

// ─── Text styles people add from the Text panel ───

export type TextPreset = { id: string; label: string; make: (w: number, h: number) => Partial<DEl>[] };
const T = (o: Partial<DEl>): Partial<DEl> => ({ type: "text", align: "center", color: "#111827", weight: 400, lineH: 1.2, ...o });
/** Heading, subheading and body, then ready-made text combinations. Sizes follow the page. */
export const TEXT_PRESETS: TextPreset[] = [
  { id: "heading", label: "Add a heading", make: (w) => [T({ text: "Add a heading", font: "Poppins", weight: 900, size: Math.round(w / 12), w: w * 0.8 })] },
  { id: "sub", label: "Add a subheading", make: (w) => [T({ text: "Add a subheading", font: "Poppins", weight: 700, size: Math.round(w / 22), w: w * 0.7 })] },
  { id: "body", label: "Add a little bit of body text", make: (w) => [T({ text: "Add a little bit of body text", font: "Inter", size: Math.round(w / 36), w: w * 0.6, lineH: 1.45 })] },
  { id: "sale", label: "BIG SALE", make: (w) => [T({ text: "BIG SALE", font: "Anton", size: Math.round(w / 6), w: w * 0.8, color: "#e11d48", letter: 4 }), T({ text: "UP TO 50% OFF", font: "Montserrat", weight: 700, size: Math.round(w / 24), w: w * 0.6, letter: 8})] },
  { id: "script", label: "Thank you", make: (w) => [T({ text: "Thank you", font: "Pacifico", size: Math.round(w / 9), w: w * 0.8, color: "#be185d" })] },
  { id: "elegant", label: "Elegant title", make: (w) => [T({ text: "Elegant Title", font: "Playfair Display", italic: true, size: Math.round(w / 10), w: w * 0.8 }), T({ text: "A SHORT LINE BELOW", font: "Raleway", weight: 700, size: Math.round(w / 40), w: w * 0.6, letter: 10})] },
  { id: "news", label: "Breaking news", make: (w) => [T({ text: "BREAKING", font: "Bebas Neue", size: Math.round(w / 8), w: w * 0.7, color: "#ffffff", highlight: "#dc2626" }), T({ text: "Your headline goes right here", font: "Oswald", weight: 700, size: Math.round(w / 22), w: w * 0.7})] },
  { id: "quote", label: "“Quote”", make: (w) => [T({ text: "“The best way to get started is to quit talking and begin doing.”", font: "DM Serif Display", size: Math.round(w / 20), w: w * 0.75, lineH: 1.3 }), T({ text: "— Walt Disney", font: "Inter", size: Math.round(w / 40), w: w * 0.5, color: "#64748b"})] },
  { id: "hand", label: "Handwritten note", make: (w) => [T({ text: "Don't forget!", font: "Caveat", weight: 700, size: Math.round(w / 10), w: w * 0.7, color: "#1d4ed8" })] },
  { id: "marker", label: "Marker", make: (w) => [T({ text: "GAME DAY", font: "Permanent Marker", size: Math.round(w / 9), w: w * 0.8, color: "#f97316" })] },
  { id: "retro", label: "Retro", make: (w) => [T({ text: "Groovy", font: "Lobster", size: Math.round(w / 8), w: w * 0.7, color: "#f59e0b", outline: "#7c2d12" })] },
  { id: "label", label: "LABEL", make: (w) => [T({ text: "NEW ARRIVAL", font: "Archivo Black", size: Math.round(w / 28), w: w * 0.4, color: "#ffffff", highlight: "#111827", letter: 6 })] },
  { id: "date", label: "Date and time", make: (w) => [T({ text: "SATURDAY", font: "Bebas Neue", size: Math.round(w / 12), w: w * 0.5, letter: 6 }), T({ text: "June 14 · 2 PM", font: "Poppins", weight: 700, size: Math.round(w / 26), w: w * 0.5, color: "#7c3aed"})] },
  { id: "number", label: "Big number", make: (w) => [T({ text: "#1", font: "Anton", size: Math.round(w / 4), w: w * 0.5, color: "#0ea5e9" })] },
];

// ─── Cleaning what's saved (the server and the editor both use it) ───

const num = (v: unknown, lo: number, hi: number, d: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const okSrc = (v: unknown): v is string => typeof v === "string" && (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v));
const FONT_SET = new Set<string>(DESIGN_FONTS);
const LIMITS = { pages: 50, elements: 150, text: 4000, uploads: 30, src: 4_000_000 };

export function cleanEl(e: any): DEl | null {
  if (!e || typeof e !== "object" || !["text", "shape", "line", "image", "sticker"].includes(e.type)) return null;
  const out: DEl = { id: typeof e.id === "string" && /^[\w-]{1,40}$/.test(e.id) ? e.id : dId(), type: e.type, x: num(e.x, -20000, 40000, 0), y: num(e.y, -20000, 40000, 0), w: num(e.w, 1, 40000, 100), h: num(e.h, 1, 40000, 100) };
  if (e.rot) out.rot = ((num(e.rot, -3600, 3600, 0) % 360) + 360) % 360 || undefined;
  if (!out.rot) delete out.rot;
  if (e.opacity !== undefined && Number(e.opacity) < 1) out.opacity = num(e.opacity, 0, 1, 1);
  for (const k of ["locked", "flipX", "flipY", "italic", "upper", "underline", "shadow"] as const) if (e[k] === true) out[k] = true;
  if (out.type === "text") {
    out.text = typeof e.text === "string" ? e.text.slice(0, LIMITS.text) : "";
    out.font = typeof e.font === "string" && FONT_SET.has(e.font) ? e.font : "Inter";
    out.size = num(e.size, 4, 2000, 48);
    out.weight = e.weight === 900 ? 900 : e.weight === 700 ? 700 : 400;
    out.align = e.align === "left" || e.align === "right" ? e.align : "center";
    out.lineH = num(e.lineH, 0.6, 3, 1.2);
    if (e.letter) out.letter = num(e.letter, -20, 100, 0);
  }
  if (out.type === "shape") out.shape = SHAPE_IDS.includes(e.shape) ? e.shape : "rect";
  if (out.type === "line") out.line = ["solid", "dashed", "dotted", "arrow"].includes(e.line) ? e.line : "solid";
  if (out.type === "image") { if (okSrc(e.src) && e.src.length <= LIMITS.src) out.src = e.src; out.fit = e.fit === "contain" ? "contain" : "cover"; if (SHAPE_IDS.includes(e.shape)) out.shape = e.shape; }
  if (out.type === "sticker") out.emoji = typeof e.emoji === "string" ? Array.from(e.emoji).slice(0, 8).join("") : "⭐";
  for (const k of ["color", "highlight", "outline", "stroke"] as const) if (isColor(e[k])) out[k] = e[k];
  if (isFill(e.fill)) out.fill = e.fill;
  if (e.strokeW !== undefined) out.strokeW = num(e.strokeW, 0, 200, 0);
  if (e.radius !== undefined) out.radius = num(e.radius, 0, 5000, 0);
  return out;
}

export function cleanDesign(raw: any): Design {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.pages)) return blankDesign();
  const size = typeof raw.size === "string" && (sizeOf(raw.size) || raw.size === "custom") ? raw.size : "ig-post";
  const w = Math.round(num(raw.w, 16, 8000, sizeOf(size)?.w ?? 1080)), h = Math.round(num(raw.h, 16, 8000, sizeOf(size)?.h ?? 1080));
  const pages: DPage[] = raw.pages.slice(0, LIMITS.pages).filter((p: any) => p && typeof p === "object").map((p: any): DPage => ({
    id: typeof p.id === "string" && /^[\w-]{1,40}$/.test(p.id) ? p.id : dId(),
    bg: isFill(p.bg) ? p.bg : "#ffffff",
    ...(okSrc(p.bgImage) && p.bgImage.length <= LIMITS.src ? { bgImage: p.bgImage } : {}),
    elements: (Array.isArray(p.elements) ? p.elements : []).slice(0, LIMITS.elements).map(cleanEl).filter((e: DEl | null): e is DEl => !!e),
  }));
  const uploads = (Array.isArray(raw.uploads) ? raw.uploads : []).filter((u: unknown) => okSrc(u) && (u as string).length <= LIMITS.src).slice(0, LIMITS.uploads);
  return { v: 1, size, w, h, pages: pages.length ? pages : [{ id: dId(), bg: "#ffffff", elements: [] }], uploads };
}

/** A design's text, for search and its name (the biggest words on the first page). */
export function designTitle(d: Design): string {
  const texts = (d.pages[0]?.elements || []).filter((e) => e.type === "text" && e.text?.trim()).sort((a, b) => (b.size || 0) - (a.size || 0));
  return (texts[0]?.text || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Scales every page to a new size (Resize): positions and sizes follow, text grows or shrinks with it. */
export function resizeDesign(d: Design, w: number, h: number, sizeId: string): Design {
  const sx = w / d.w, sy = h / d.h, s = Math.min(sx, sy);
  return { ...d, size: sizeId, w, h, pages: d.pages.map((p) => ({ ...p, elements: p.elements.map((e) => {
    const cx = (e.x + e.w / 2) * sx, cy = (e.y + e.h / 2) * sy, nw = e.w * s, nh = e.h * s;
    return { ...e, x: Math.round(cx - nw / 2), y: Math.round(cy - nh / 2), w: Math.round(nw), h: Math.round(nh), ...(e.size ? { size: Math.max(4, Math.round(e.size * s)) } : {}), ...(e.strokeW ? { strokeW: Math.max(1, Math.round(e.strokeW * s)) } : {}), ...(e.radius ? { radius: Math.round(e.radius * s) } : {}), ...(e.letter ? { letter: Math.round(e.letter * s) } : {}) };
  }) })) };
}

// ─── Magic design: what the AI writes, and the same without AI ───

export type DesignCopy = { headline: string; sub: string; body: string; cta: string; emoji: string; palette: string[] };
export const DESIGN_AI_TASK = "design-copy";
export function cleanCopy(raw: any, prompt: string): DesignCopy {
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const palette = Array.isArray(raw?.palette) ? raw.palette.filter((c: unknown) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 4) : [];
  const fallback = builtinCopy(prompt);
  return {
    headline: s(raw?.headline, 60) || fallback.headline, sub: s(raw?.sub, 90) || fallback.sub, body: s(raw?.body, 220) || fallback.body, cta: s(raw?.cta, 40) || fallback.cta,
    emoji: typeof raw?.emoji === "string" && raw.emoji.trim() ? Array.from(raw.emoji.trim()).slice(0, 2).join("") : fallback.emoji, palette: palette.length >= 3 ? palette : fallback.palette,
  };
}
const EMOJI_HINTS: [RegExp, string, string[]][] = [
  [/birthday|party|celebrat/i, "🎉", ["#fff7ed", "#f97316", "#7c2d12"]], [/bake|cookie|cake|food|dinner|lunch|menu|pizza|cafe|coffee/i, "🍪", ["#fffbeb", "#d97706", "#451a03"]],
  [/sale|deal|discount|shop|off\b/i, "🛍️", ["#fff1f2", "#e11d48", "#1f2937"]], [/school|class|teacher|student|math|read|science|homework/i, "📚", ["#eff6ff", "#2563eb", "#1e293b"]],
  [/wedding|love|valentine|anniversary/i, "💍", ["#fdf2f8", "#be185d", "#3f3f46"]], [/game|sport|soccer|basketball|football|team|tournament/i, "🏆", ["#0f172a", "#facc15", "#f8fafc"]],
  [/church|faith|prayer|worship/i, "🕊️", ["#f8fafc", "#6d28d9", "#1e1b4b"]], [/fitness|workout|gym|yoga|run/i, "💪", ["#ecfdf5", "#059669", "#064e3b"]],
  [/music|concert|band|dj/i, "🎵", ["#1e1b4b", "#a78bfa", "#f5f3ff"]], [/holiday|christmas|winter/i, "🎄", ["#f0fdf4", "#dc2626", "#14532d"]],
  [/halloween|spooky/i, "🎃", ["#1c1917", "#f97316", "#fafaf9"]], [/garden|plant|flower|spring/i, "🌸", ["#fdf4ff", "#c026d3", "#3b0764"]],
];
export function builtinCopy(prompt: string): DesignCopy {
  const p = prompt.replace(/\s+/g, " ").trim();
  const hint = EMOJI_HINTS.find(([re]) => re.test(p));
  const words = p.split(" ");
  const headline = (words.length > 6 ? words.slice(0, 5).join(" ") : p || "Your big idea").replace(/^\w/, (c) => c.toUpperCase());
  return { headline, sub: words.length > 6 ? words.slice(5).join(" ").slice(0, 90) : "Don't miss it", body: "Add the details here: when, where and anything people should know.", cta: /sale|shop|deal/i.test(p) ? "Shop now" : /class|school|learn/i.test(p) ? "Learn more" : "Join us", emoji: hint?.[1] || "✨", palette: hint?.[2] || ["#f5f3ff", "#7c3aed", "#1e1b4b"] };
}
