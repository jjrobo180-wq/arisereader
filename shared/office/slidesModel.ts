// Arise Slides: what a presentation is (slides of positioned text boxes, pictures and shapes on a
// 960 × 540 canvas, with a theme and speaker notes), the themes and layouts, and PowerPoint (.pptx)
// files in and out.
import { sanitizeHtml, parseHtml, type HNode } from "./docModel";
import { escapeXml as x, find, findAllNodes, kid, kids, parseXml, unzipFiles, zipFiles, type XNode } from "./zipfile";

export const CW = 960, CH = 540;
export type ShapeKind = "rect" | "round" | "ellipse" | "triangle" | "diamond" | "arrow" | "star" | "line" | "speech" | "hexagon";
export type El = {
  id: string; type: "text" | "image" | "shape";
  x: number; y: number; w: number; h: number; rot?: number;
  /** Text (safe HTML) for text boxes and shapes. */
  html?: string;
  src?: string; shape?: ShapeKind;
  fill?: string; stroke?: string; strokeW?: number; radius?: number; opacity?: number;
  font?: string; size?: number; color?: string; align?: "left" | "center" | "right"; valign?: "top" | "middle" | "bottom";
  role?: "title" | "subtitle" | "body";
  anim?: "none" | "fade" | "rise" | "zoom";
};
export type Slide = { id: string; bg?: string; elements: El[]; notes: string; transition?: "none" | "fade" | "slide" | "zoom"; hidden?: boolean };
export type Deck = { v: 1; theme: string; slides: Slide[] };

export type Theme = { id: string; name: string; bg: string; bg2?: string; title: string; text: string; accent: string; accent2: string; heading: string; body: string; titleBg?: string };
export const THEMES: Theme[] = [
  { id: "simple", name: "Simple light", bg: "#ffffff", title: "#0f172a", text: "#334155", accent: "#2563eb", accent2: "#dbeafe", heading: "Inter", body: "Inter" },
  { id: "midnight", name: "Midnight", bg: "#0f172a", bg2: "#1e293b", title: "#f8fafc", text: "#cbd5e1", accent: "#38bdf8", accent2: "#1e3a5f", heading: "Montserrat", body: "Inter" },
  { id: "classroom", name: "Classroom", bg: "#fffbeb", title: "#7c2d12", text: "#44403c", accent: "#f59e0b", accent2: "#fde68a", heading: "Lexend", body: "Lexend" },
  { id: "forest", name: "Forest", bg: "#f0fdf4", title: "#14532d", text: "#1f2937", accent: "#16a34a", accent2: "#bbf7d0", heading: "Merriweather", body: "Open Sans" },
  { id: "coral", name: "Coral", bg: "#fff1f2", title: "#881337", text: "#3f3f46", accent: "#f43f5e", accent2: "#fecdd3", heading: "Playfair Display", body: "Lato" },
  { id: "grape", name: "Grape", bg: "#faf5ff", bg2: "#ede9fe", title: "#4c1d95", text: "#3f3f46", accent: "#7c3aed", accent2: "#ddd6fe", heading: "Montserrat", body: "Open Sans" },
  { id: "ocean", name: "Ocean", bg: "#ecfeff", bg2: "#cffafe", title: "#164e63", text: "#1e293b", accent: "#0891b2", accent2: "#a5f3fc", heading: "Roboto", body: "Roboto" },
  { id: "bold", name: "Bold", bg: "#111827", title: "#fde047", text: "#f9fafb", accent: "#fde047", accent2: "#374151", heading: "Montserrat", body: "Lato" },
  { id: "paper", name: "Paper", bg: "#fafaf9", title: "#1c1917", text: "#44403c", accent: "#b45309", accent2: "#e7e5e4", heading: "Georgia", body: "Georgia" },
  { id: "sunrise", name: "Sunrise", bg: "#fff7ed", bg2: "#ffedd5", title: "#9a3412", text: "#431407", accent: "#ea580c", accent2: "#fed7aa", heading: "Lexend", body: "Lato" },
];
export const themeOf = (id: string) => THEMES.find((t) => t.id === id) || THEMES[0];

let n = 0;
export const elId = () => `e${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type LayoutId = "title" | "content" | "two" | "section" | "image" | "quote" | "number" | "blank";
export const LAYOUTS: { id: LayoutId; name: string }[] = [
  { id: "title", name: "Title slide" }, { id: "content", name: "Title and content" }, { id: "two", name: "Two columns" }, { id: "section", name: "Section header" },
  { id: "image", name: "Picture with text" }, { id: "quote", name: "Quote" }, { id: "number", name: "Big number" }, { id: "blank", name: "Blank" },
];
const bullets = (items: string[]) => (items.length ? `<ul>${items.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "<ul><li>Add a point</li></ul>");

/** A new slide in a layout, filled in. */
export function makeSlide(layout: LayoutId, t: Theme, fill: { title?: string; bullets?: string[]; sub?: string; notes?: string; right?: string[] } = {}): Slide {
  const T = (o: Partial<El>): El => ({ id: elId(), type: "text", x: 0, y: 0, w: 100, h: 50, font: t.body, color: t.text, size: 24, align: "left", valign: "top", ...o });
  const els: El[] = [];
  const title = esc(fill.title || "");
  switch (layout) {
    case "title":
      els.push({ id: elId(), type: "shape", shape: "rect", x: 80, y: 316, w: 120, h: 8, fill: t.accent, stroke: "none" });
      els.push(T({ role: "title", x: 80, y: 150, w: 800, h: 160, html: `<p>${title || "Presentation title"}</p>`, font: t.heading, size: 54, color: t.title, valign: "bottom" }));
      els.push(T({ role: "subtitle", x: 80, y: 340, w: 800, h: 80, html: `<p>${esc(fill.sub || fill.bullets?.join(" · ") || "Subtitle")}</p>`, size: 24 }));
      break;
    case "content":
      els.push(T({ role: "title", x: 60, y: 36, w: 840, h: 84, html: `<p>${title || "Slide title"}</p>`, font: t.heading, size: 38, color: t.title, valign: "middle" }));
      els.push({ id: elId(), type: "shape", shape: "rect", x: 60, y: 124, w: 72, h: 5, fill: t.accent, stroke: "none" });
      els.push(T({ role: "body", x: 60, y: 150, w: 840, h: 350, html: bullets(fill.bullets || []), size: (fill.bullets?.length || 0) > 5 ? 20 : 24 }));
      break;
    case "two":
      els.push(T({ role: "title", x: 60, y: 36, w: 840, h: 84, html: `<p>${title || "Compare"}</p>`, font: t.heading, size: 38, color: t.title, valign: "middle" }));
      els.push(T({ role: "body", x: 60, y: 150, w: 405, h: 350, html: bullets(fill.bullets || ["First idea"]), size: 22 }));
      els.push(T({ role: "body", x: 495, y: 150, w: 405, h: 350, html: bullets(fill.right || ["Second idea"]), size: 22 }));
      break;
    case "section":
      els.push({ id: elId(), type: "shape", shape: "rect", x: 0, y: 0, w: 960, h: 540, fill: t.accent, stroke: "none" });
      els.push(T({ role: "title", x: 80, y: 180, w: 800, h: 120, html: `<p>${title || "Section"}</p>`, font: t.heading, size: 52, color: "#ffffff", valign: "middle" }));
      els.push(T({ role: "subtitle", x: 80, y: 300, w: 800, h: 60, html: `<p>${esc(fill.sub || "")}</p>`, size: 22, color: "#ffffffcc" }));
      break;
    case "image":
      els.push({ id: elId(), type: "shape", shape: "round", x: 520, y: 60, w: 380, h: 420, fill: t.accent2, stroke: "none", html: '<p style="text-align: center">Double-click to add a picture</p>', color: t.text, size: 16, align: "center", valign: "middle" });
      els.push(T({ role: "title", x: 60, y: 60, w: 420, h: 110, html: `<p>${title || "Title"}</p>`, font: t.heading, size: 36, color: t.title, valign: "bottom" }));
      els.push(T({ role: "body", x: 60, y: 190, w: 420, h: 290, html: bullets(fill.bullets || []), size: 22 }));
      break;
    case "quote":
      els.push(T({ x: 60, y: 40, w: 120, h: 140, html: "<p>“</p>", font: "Georgia", size: 140, color: t.accent }));
      els.push(T({ role: "title", x: 120, y: 150, w: 720, h: 200, html: `<p>${title || "A quote worth sharing."}</p>`, font: t.heading, size: 36, color: t.title, valign: "middle", align: "center" }));
      els.push(T({ role: "subtitle", x: 120, y: 370, w: 720, h: 50, html: `<p>— ${esc(fill.sub || "Who said it")}</p>`, size: 20, align: "center" }));
      break;
    case "number":
      els.push(T({ role: "title", x: 60, y: 110, w: 840, h: 220, html: `<p>${title || "87%"}</p>`, font: t.heading, size: 140, color: t.accent, align: "center", valign: "middle" }));
      els.push(T({ role: "subtitle", x: 120, y: 340, w: 720, h: 90, html: `<p>${esc(fill.sub || fill.bullets?.[0] || "of students met their reading goal")}</p>`, size: 26, align: "center" }));
      break;
    case "blank": break;
  }
  return { id: elId(), elements: els, notes: fill.notes || "", transition: "fade" };
}

/** A deck from the AI's outline: a title slide, then content slides. */
export function deckFromOutline(theme: string, title: string, slides: { title: string; bullets: string[]; notes?: string }[]): Deck {
  const t = themeOf(theme);
  const list = slides.length ? slides : [{ title, bullets: [] }];
  return {
    v: 1, theme: t.id,
    slides: list.map((s, i) => (i === 0 ? makeSlide("title", t, { title: s.title || title, sub: s.bullets.join(" · "), notes: s.notes }) : s.bullets.length === 0 ? makeSlide("section", t, { title: s.title, notes: s.notes }) : makeSlide("content", t, { title: s.title, bullets: s.bullets, notes: s.notes }))),
  };
}

export const blankDeck = (theme = "simple"): Deck => ({ v: 1, theme, slides: [makeSlide("title", themeOf(theme))] });

const num = (v: unknown, lo: number, hi: number, d: number) => { const k = Number(v); return Number.isFinite(k) ? Math.min(hi, Math.max(lo, k)) : d; };
const col = (v: unknown) => (typeof v === "string" && /^(#[0-9a-f]{3,8}|none|transparent)$/i.test(v) ? v : undefined);
const SHAPES: ShapeKind[] = ["rect", "round", "ellipse", "triangle", "diamond", "arrow", "star", "line", "speech", "hexagon"];

export function cleanDeck(raw: any): Deck {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.slides)) return blankDeck();
  // Decks from the first Office editor were titles, bullets and notes.
  if (raw.slides.length && raw.slides.every((s: any) => s && !Array.isArray(s.elements) && ("title" in s || "bullets" in s))) {
    return deckFromOutline("simple", String(raw.slides[0]?.title || "Presentation"), raw.slides.map((s: any) => ({ title: String(s.title || "").slice(0, 200), bullets: Array.isArray(s.bullets) ? s.bullets.map((b: unknown) => String(b).slice(0, 300)).slice(0, 12) : [], notes: String(s.notes || "").slice(0, 5000) })));
  }
  const slides: Slide[] = raw.slides.slice(0, 300).filter((s: any) => s && typeof s === "object").map((s: any): Slide => ({
    id: typeof s.id === "string" ? s.id.slice(0, 40) : elId(),
    ...(col(s.bg) ? { bg: s.bg } : {}),
    notes: typeof s.notes === "string" ? s.notes.slice(0, 10000) : "",
    transition: ["none", "fade", "slide", "zoom"].includes(s.transition) ? s.transition : "fade",
    ...(s.hidden ? { hidden: true } : {}),
    elements: (Array.isArray(s.elements) ? s.elements : []).slice(0, 80).filter((e: any) => e && ["text", "image", "shape"].includes(e.type)).map((e: any): El => {
      const out: El = { id: typeof e.id === "string" ? e.id.slice(0, 40) : elId(), type: e.type, x: num(e.x, -2000, 3000, 0), y: num(e.y, -2000, 3000, 0), w: num(e.w, 4, 4000, 100), h: num(e.h, 2, 4000, 50) };
      if (e.rot) out.rot = num(e.rot, -360, 360, 0);
      if (typeof e.html === "string") out.html = sanitizeHtml(e.html).slice(0, 20000);
      if (e.type === "image" && typeof e.src === "string" && (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(e.src) || /^https:\/\//.test(e.src))) out.src = e.src.slice(0, 6_000_000);
      if (SHAPES.includes(e.shape)) out.shape = e.shape;
      for (const k of ["fill", "stroke", "color"] as const) if (col(e[k])) out[k] = e[k];
      if (e.strokeW !== undefined) out.strokeW = num(e.strokeW, 0, 40, 2);
      if (e.radius !== undefined) out.radius = num(e.radius, 0, 400, 0);
      if (e.opacity !== undefined) out.opacity = num(e.opacity, 0, 1, 1);
      if (typeof e.font === "string") out.font = e.font.slice(0, 60);
      if (e.size !== undefined) out.size = num(e.size, 6, 300, 24);
      if (["left", "center", "right"].includes(e.align)) out.align = e.align;
      if (["top", "middle", "bottom"].includes(e.valign)) out.valign = e.valign;
      if (["title", "subtitle", "body"].includes(e.role)) out.role = e.role;
      if (["none", "fade", "rise", "zoom"].includes(e.anim)) out.anim = e.anim;
      return out;
    }).filter((e: El) => e.type !== "image" || e.src),
  }));
  return { v: 1, theme: themeOf(raw.theme).id, slides: slides.length ? slides : blankDeck().slides };
}

/** SVG path for a shape in a w × h box. */
export function shapePath(kind: ShapeKind, w: number, h: number, r = 0): string {
  switch (kind) {
    case "ellipse": return `M ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 1 ${w / 2 - 0.01} 0 Z`;
    case "triangle": return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`;
    case "diamond": return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
    case "arrow": { const s = h * 0.3, hw = Math.min(w * 0.4, h); return `M 0 ${s} L ${w - hw} ${s} L ${w - hw} 0 L ${w} ${h / 2} L ${w - hw} ${h} L ${w - hw} ${h - s} L 0 ${h - s} Z`; }
    case "star": { const pts: string[] = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 0.4 : 1; pts.push(`${w / 2 + (w / 2) * rr * Math.cos(a)} ${h / 2 + (h / 2) * rr * Math.sin(a)}`); } return `M ${pts.join(" L ")} Z`; }
    case "hexagon": return `M ${w * 0.25} 0 L ${w * 0.75} 0 L ${w} ${h / 2} L ${w * 0.75} ${h} L ${w * 0.25} ${h} L 0 ${h / 2} Z`;
    case "speech": { const bh = h * 0.78, rr = Math.min(16, w / 6, bh / 4); return `M ${rr} 0 H ${w - rr} Q ${w} 0 ${w} ${rr} V ${bh - rr} Q ${w} ${bh} ${w - rr} ${bh} H ${w * 0.35} L ${w * 0.18} ${h} L ${w * 0.22} ${bh} H ${rr} Q 0 ${bh} 0 ${bh - rr} V ${rr} Q 0 0 ${rr} 0 Z`; }
    case "line": return `M 0 ${h / 2} L ${w} ${h / 2}`;
    case "round": { const rr = Math.min(r || 18, w / 2, h / 2); return `M ${rr} 0 H ${w - rr} Q ${w} 0 ${w} ${rr} V ${h - rr} Q ${w} ${h} ${w - rr} ${h} H ${rr} Q 0 ${h} 0 ${h - rr} V ${rr} Q 0 0 ${rr} 0 Z`; }
    default: return `M 0 0 H ${w} V ${h} H 0 Z`;
  }
}

// ─── PowerPoint export ──────────────────────────────────────────────────────

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const EMU = 12700; // per canvas pixel (960 px = 12,192,000 EMU), so a canvas pixel is one point
const hex6 = (c?: string) => { if (!c || c === "none" || c === "transparent") return null; const h = c.replace("#", ""); return (h.length === 3 || h.length === 4 ? h.slice(0, 3).split("").map((k) => k + k).join("") : h.slice(0, 6)).toUpperCase(); };
const alphaOf = (c?: string) => { if (!c) return 1; const h = c.replace("#", ""); return h.length === 8 ? parseInt(h.slice(6), 16) / 255 : h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1; };
const PRST: Record<ShapeKind, string> = { rect: "rect", round: "roundRect", ellipse: "ellipse", triangle: "triangle", diamond: "diamond", arrow: "rightArrow", star: "star5", line: "line", speech: "wedgeRoundRectCallout", hexagon: "hexagon" };
const styleMap = (s = "") => Object.fromEntries(s.split(";").map((d) => d.split(":").map((k) => k.trim())).filter((d) => d.length >= 2 && d[0]).map(([k, ...v]) => [k.toLowerCase(), v.join(":")]));
const cssHex = (c?: string) => { if (!c) return null; const m = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(c); if (m) return [m[1], m[2], m[3]].map((k) => Number(k).toString(16).padStart(2, "0")).join("").toUpperCase(); return hex6(c.trim()); };

function paragraphs(html: string, e: El, t: Theme): string {
  const root = parseHtml(html || "");
  const out: string[] = [];
  const base = { sz: Math.round((e.size || 24) * 100), color: hex6(e.color) || hex6(t.text)!, font: e.font || t.body };
  type R = { b?: boolean; i?: boolean; u?: boolean; s?: boolean; color?: string; sz?: number; font?: string };
  const runs = (nodes: HNode[], r: R): string => nodes.map((k) => {
    if (k.tag === "#text") return k.text ? `<a:r><a:rPr lang="en-US" sz="${r.sz || base.sz}"${r.b ? ' b="1"' : ""}${r.i ? ' i="1"' : ""}${r.u ? ' u="sng"' : ""}${r.s ? ' strike="sngStrike"' : ""} dirty="0"><a:solidFill><a:srgbClr val="${r.color || base.color}"/></a:solidFill><a:latin typeface="${x(r.font || base.font)}"/></a:rPr><a:t>${x(k.text.replace(/\s+/g, " "))}</a:t></a:r>` : "";
    if (k.tag === "br") return "<a:br/>";
    const st = styleMap(k.attrs.style);
    const n2: R = { ...r };
    if (k.tag === "b" || k.tag === "strong" || /bold|[6-9]00/.test(st["font-weight"] || "")) n2.b = true;
    if (k.tag === "i" || k.tag === "em" || st["font-style"] === "italic") n2.i = true;
    if (k.tag === "u" || /underline/.test(st["text-decoration"] || "")) n2.u = true;
    if (k.tag === "s" || k.tag === "strike" || /line-through/.test(st["text-decoration"] || "")) n2.s = true;
    const c = cssHex(st.color || k.attrs.color); if (c) n2.color = c;
    const fs = parseFloat(st["font-size"] || ""); if (fs) n2.sz = Math.round(/pt/.test(st["font-size"]) ? fs * 133 : fs * 100);
    const ff = (st["font-family"] || "").split(",")[0].replace(/['"]/g, "").trim(); if (ff) n2.font = ff;
    return runs(k.kids, n2);
  }).join("");
  const algn = (st: Record<string, string>) => ({ center: "ctr", right: "r", justify: "just" }[st["text-align"] || e.align || "left"] || "l");
  const walk = (nodes: HNode[], bullet: "" | "bullet" | "number", lvl: number) => {
    let loose: HNode[] = [];
    const flush = () => { if (loose.length) { out.push(`<a:p><a:pPr algn="${algn({})}"><a:buNone/></a:pPr>${runs(loose, {})}</a:p>`); loose = []; } };
    for (const k of nodes) {
      if (k.tag === "ul" || k.tag === "ol") { flush(); walk(k.kids, k.tag === "ol" ? "number" : "bullet", lvl + (bullet ? 1 : 0)); continue; }
      if (/^(p|h[1-6]|li|div|blockquote)$/.test(k.tag)) {
        flush();
        const inner = k.kids.filter((c) => c.tag !== "ul" && c.tag !== "ol");
        const sub = k.kids.filter((c) => c.tag === "ul" || c.tag === "ol");
        const bu = k.tag === "li" ? (bullet === "number" ? '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>' : '<a:buFont typeface="Arial"/><a:buChar char="•"/>') : "<a:buNone/>";
        out.push(`<a:p><a:pPr algn="${algn(styleMap(k.attrs.style))}"${k.tag === "li" ? ` marL="${342900 + lvl * 342900}" indent="-342900" lvl="${lvl}"` : ""}><a:spcBef><a:spcPts val="${k.tag === "li" ? 600 : 0}"/></a:spcBef>${bu}</a:pPr>${runs(inner, /^h/.test(k.tag) ? { b: true } : {})}<a:endParaRPr lang="en-US" sz="${base.sz}"/></a:p>`);
        if (sub.length) walk(sub, bullet || "bullet", lvl + 1);
        continue;
      }
      loose.push(k);
    }
    flush();
  };
  walk(root.kids, "", 0);
  return out.join("") || `<a:p><a:endParaRPr lang="en-US" sz="${base.sz}"/></a:p>`;
}

/** Makes a .pptx file PowerPoint, Keynote and Google Slides open. */
export function writePptx(deck: Deck, title = "Presentation"): Uint8Array {
  const t = themeOf(deck.theme);
  const files: { name: string; data: string | Uint8Array }[] = [];
  const media: { name: string; data: Uint8Array }[] = [];
  const list = deck.slides;
  const fromB64 = (s: string) => (typeof atob === "function" ? Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) : new Uint8Array(Buffer.from(s, "base64")));
  list.forEach((s, i) => {
    const rels: [string, string, string][] = [["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "notesSlide", `../notesSlides/notesSlide${i + 1}.xml`]];
    let id = 2;
    const shapes = s.elements.map((e) => {
      id++;
      const off = `<a:xfrm${e.rot ? ` rot="${Math.round(e.rot * 60000)}"` : ""}><a:off x="${Math.round(e.x * EMU)}" y="${Math.round(e.y * EMU)}"/><a:ext cx="${Math.round(e.w * EMU)}" cy="${Math.round(e.h * EMU)}"/></a:xfrm>`;
      if (e.type === "image") {
        const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i.exec(e.src || "");
        if (!m) return "";
        const ext = m[1].toLowerCase().replace("jpeg", "jpg");
        const name = `image${media.length + 1}.${ext}`;
        media.push({ name, data: fromB64(m[2]) });
        const rid = `rId${rels.length + 1}`;
        rels.push([rid, "image", `../media/${name}`]);
        return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${off}<a:prstGeom prst="${e.radius ? "roundRect" : "rect"}"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
      }
      const fill = e.type === "shape" ? hex6(e.fill) : hex6(e.fill);
      const fa = alphaOf(e.fill);
      const stroke = hex6(e.stroke);
      const prst = e.type === "shape" ? PRST[e.shape || "rect"] : "rect";
      const anchor = { top: "t", middle: "ctr", bottom: "b" }[e.valign || (e.type === "shape" ? "middle" : "top")];
      const sp = `<p:spPr>${off}<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fill ? `<a:solidFill><a:srgbClr val="${fill}">${fa < 1 ? `<a:alpha val="${Math.round(fa * 100000)}"/>` : ""}</a:srgbClr></a:solidFill>` : "<a:noFill/>"}${stroke ? `<a:ln w="${Math.round((e.strokeW || 2) * EMU)}"><a:solidFill><a:srgbClr val="${stroke}"/></a:solidFill></a:ln>` : "<a:ln><a:noFill/></a:ln>"}</p:spPr>`;
      const body = `<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="${anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paragraphs(e.html || "", e, t)}</p:txBody>`;
      return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${e.role ? e.role[0].toUpperCase() + e.role.slice(1) : e.type === "text" ? "TextBox" : "Shape"} ${id}"/><p:cNvSpPr${e.type === "text" ? ' txBox="1"' : ""}/><p:nvPr/></p:nvSpPr>${sp}${body}</p:sp>`;
    }).join("");
    const bg = hex6(s.bg || t.bg) || "FFFFFF";
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: `${HEAD}<p:sld ${NS}${s.hidden ? ' show="0"' : ""}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${s.transition && s.transition !== "none" ? `<p:transition spd="med">${s.transition === "fade" ? "<p:fade/>" : s.transition === "slide" ? '<p:push dir="l"/>' : "<p:zoom/>"}</p:transition>` : ""}</p:sld>` });
    files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: relsXml(rels) });
    const notes = s.notes.split(/\n+/).map((k) => `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${x(k)}</a:t></a:r></a:p>`).join("") || '<a:p><a:endParaRPr lang="en-US"/></a:p>';
    files.push({ name: `ppt/notesSlides/notesSlide${i + 1}.xml`, data: `${HEAD}<p:notes ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image ${i + 1}"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes ${i + 1}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${notes}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>` });
    files.push({ name: `ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`, data: relsXml([["rId1", "notesMaster", "../notesMasters/notesMaster1.xml"], ["rId2", "slide", `../slides/slide${i + 1}.xml`]]) });
  });
  const exts = [...new Set(media.map((m) => m.name.split(".").pop()!))];
  const mimes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
  const CLRMAP = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
  const EMPTY = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>';
  const THEME = `${HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${x(t.name)}"><a:themeElements><a:clrScheme name="Arise"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="${hex6(t.title)}"/></a:dk2><a:lt2><a:srgbClr val="${hex6(t.bg)}"/></a:lt2><a:accent1><a:srgbClr val="${hex6(t.accent)}"/></a:accent1><a:accent2><a:srgbClr val="${hex6(t.accent2)}"/></a:accent2><a:accent3><a:srgbClr val="6D28D9"/></a:accent3><a:accent4><a:srgbClr val="BE123C"/></a:accent4><a:accent5><a:srgbClr val="B45309"/></a:accent5><a:accent6><a:srgbClr val="047857"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Arise"><a:majorFont><a:latin typeface="${x(t.heading)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${x(t.body)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Arise"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  files.push({ name: "[Content_Types].xml", data: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${exts.map((e) => `<Default Extension="${e}" ContentType="${mimes[e]}"/>`).join("")}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${list.map((_s, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` });
  files.push({ name: "_rels/.rels", data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` });
  files.push({ name: "docProps/core.xml", data: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${x(title)}</dc:title><dc:creator>Arise Slides</dc:creator></cp:coreProperties>` });
  files.push({ name: "ppt/presentation.xml", data: `${HEAD}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId3"/></p:notesMasterIdLst><p:sldIdLst>${list.map((_s, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${CW * EMU}" cy="${CH * EMU}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>` });
  files.push({ name: "ppt/_rels/presentation.xml.rels", data: relsXml([["rId1", "slideMaster", "slideMasters/slideMaster1.xml"], ["rId2", "theme", "theme/theme1.xml"], ["rId3", "notesMaster", "notesMasters/notesMaster1.xml"], ...list.map((_s, i): [string, string, string] => [`rId${10 + i}`, "slide", `slides/slide${i + 1}.xml`])]) });
  files.push({ name: "ppt/slideMasters/slideMaster1.xml", data: `${HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY}</p:cSld>${CLRMAP}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2400"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>` });
  files.push({ name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: relsXml([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "theme", "../theme/theme1.xml"]]) });
  files.push({ name: "ppt/slideLayouts/slideLayout1.xml", data: `${HEAD}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank">${EMPTY}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` });
  files.push({ name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: relsXml([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]) });
  files.push({ name: "ppt/theme/theme1.xml", data: THEME }, { name: "ppt/theme/theme2.xml", data: THEME });
  files.push({ name: "ppt/notesMasters/notesMaster1.xml", data: `${HEAD}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="381000" y="685800"/><a:ext cx="6096000" cy="3429000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp></p:spTree></p:cSld>${CLRMAP}<p:notesStyle><a:lvl1pPr><a:defRPr sz="1200"/></a:lvl1pPr></p:notesStyle></p:notesMaster>` });
  files.push({ name: "ppt/notesMasters/_rels/notesMaster1.xml.rels", data: relsXml([["rId1", "theme", "../theme/theme2.xml"]]) });
  for (const m of media) files.push({ name: `ppt/media/${m.name}`, data: m.data });
  return zipFiles(files);
}
const relsXml = (items: [string, string, string][]) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join("")}</Relationships>`;

// ─── PowerPoint import ──────────────────────────────────────────────────────

const b64 = (bytes: Uint8Array) => { if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64"); let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const PRST_BACK: Record<string, ShapeKind> = { rect: "rect", roundRect: "round", ellipse: "ellipse", triangle: "triangle", diamond: "diamond", rightArrow: "arrow", star5: "star", line: "line", wedgeRoundRectCallout: "speech", wedgeRectCallout: "speech", hexagon: "hexagon" };

/** Opens a .pptx file as a deck: text boxes, shapes, pictures, backgrounds and notes. */
export async function readPptx(buf: ArrayBuffer | Uint8Array): Promise<Deck> {
  const files = await unzipFiles(buf);
  const dec = new TextDecoder();
  const get = (p: string) => { const f = files.get(p); return f ? dec.decode(f) : ""; };
  const pres = parseXml(get("ppt/presentation.xml"));
  if (!find(pres, "presentation")) throw new Error("That doesn't look like a PowerPoint file.");
  const sz = find(pres, "sldSz");
  const scale = sz ? CW / (Number(sz.attrs.cx) / EMU) : 1;
  const sy = sz ? CH / (Number(sz.attrs.cy) / EMU) : 1;
  const presRels = new Map<string, string>();
  for (const r of findAllNodes(parseXml(get("ppt/_rels/presentation.xml.rels")), "Relationship")) presRels.set(r.attrs.Id, r.attrs.Target);
  const order = findAllNodes(find(pres, "sldIdLst"), "sldId").map((s) => presRels.get(s.attrs.id)).filter(Boolean) as string[];
  const slides: Slide[] = [];
  for (const target of order.slice(0, 300)) {
    const path = `ppt/${target.replace(/^\.?\//, "")}`;
    const doc = parseXml(get(path));
    const relPath = path.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
    const rels = new Map<string, string>();
    for (const r of findAllNodes(parseXml(get(relPath)), "Relationship")) rels.set(r.attrs.Id, r.attrs.Target);
    const els: El[] = [];
    const pos = (n: XNode | undefined) => { const off = find(n, "off"), ext = find(n, "ext"); return { x: Number(off?.attrs.x || 0) / EMU * scale, y: Number(off?.attrs.y || 0) / EMU * sy, w: Number(ext?.attrs.cx || 0) / EMU * scale, h: Number(ext?.attrs.cy || 0) / EMU * sy }; };
    const color = (n: XNode | undefined) => { const c = find(n, "srgbClr")?.attrs.val; return c ? `#${c.toLowerCase()}` : undefined; };
    const walkTree = (tree: XNode | undefined) => {
      for (const n of tree?.kids || []) {
        if (n.name === "grpSp") { walkTree(n); continue; }
        if (n.name === "pic") {
          const id = find(n, "blip")?.attrs.embed; const t2 = id ? rels.get(id) : undefined;
          const data = t2 ? files.get(`ppt/${t2.replace(/^\.\.\//, "")}`) : undefined;
          const ext = t2?.split(".").pop()?.toLowerCase() || "";
          if (data && ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) { const p = pos(find(n, "xfrm")); if (p.w > 0) els.push({ id: elId(), type: "image", ...p, src: `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${b64(data)}` }); }
          continue;
        }
        if (n.name !== "sp") continue;
        const spPr = kid(n, "spPr");
        const xf = find(spPr, "xfrm");
        if (!xf) continue;
        const p = pos(xf);
        const prst = find(spPr, "prstGeom")?.attrs.prst || "rect";
        const fillNode = kid(spPr, "solidFill");
        const lnNode = kid(spPr, "ln");
        const body = kid(n, "txBody");
        const paras = kids(body, "p");
        const texts = paras.map((pp) => findAllNodes(pp, "t").map((t2) => t2.text).join(""));
        const firstR = find(body, "rPr");
        const size = firstR?.attrs.sz ? Math.round(Number(firstR.attrs.sz) / 100 * scale) : undefined;
        const align = find(body, "pPr")?.attrs.algn;
        const html = paras.map((pp) => {
          const runs = kids(pp, "r").map((r) => { const rp = kid(r, "rPr"); let t2 = (kid(r, "t")?.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;"); const c = color(kid(rp, "solidFill")); if (rp?.attrs.b === "1") t2 = `<strong>${t2}</strong>`; if (rp?.attrs.i === "1") t2 = `<em>${t2}</em>`; if (rp?.attrs.u && rp.attrs.u !== "none") t2 = `<u>${t2}</u>`; return c ? `<span style="color: ${c}">${t2}</span>` : t2; }).join("");
          const isBullet = !!find(kid(pp, "pPr"), "buChar") || !!find(kid(pp, "pPr"), "buAutoNum");
          return isBullet ? `<li>${runs}</li>` : `<p>${runs || "<br>"}</p>`;
        }).join("").replace(/(<li>.*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
        const isPh = !!find(kid(n, "nvSpPr"), "ph");
        const hasFill = !!fillNode;
        const textColor = color(find(firstR, "solidFill"));
        const anchor = kid(body, "bodyPr")?.attrs.anchor;
        const plain = textColor ? html.replace(new RegExp(`<span style="color: ${textColor}">([\\s\\S]*?)</span>`, "g"), "$1") : html;
        const base: El = { id: elId(), type: hasFill || prst !== "rect" ? "shape" : "text", ...p, html: sanitizeHtml(plain), size: size || 24, color: textColor, align: align === "ctr" ? "center" : align === "r" ? "right" : "left", valign: anchor === "ctr" ? "middle" : anchor === "b" ? "bottom" : "top" };
        if (base.type === "shape") { base.shape = PRST_BACK[prst] || "rect"; base.fill = color(fillNode) || "none"; base.stroke = lnNode && !kid(lnNode, "noFill") ? color(lnNode) : "none"; }
        if (isPh && /title/i.test(find(kid(n, "nvSpPr"), "ph")?.attrs.type || "")) base.role = "title";
        if (!texts.join("").trim() && base.type === "text") continue;
        els.push(base);
      }
    };
    walkTree(find(doc, "spTree"));
    const bg = color(find(find(doc, "bg"), "solidFill"));
    let notes = "";
    for (const [, t2] of rels) if (/notesSlide/.test(t2)) { const nd = parseXml(get(`ppt/${t2.replace(/^\.\.\//, "")}`)); notes = findAllNodes(nd, "sp").filter((s) => find(s, "ph")?.attrs.type === "body").map((s) => kids(find(s, "txBody"), "p").map((pp) => findAllNodes(pp, "t").map((t3) => t3.text).join("")).join("\n")).join("\n").trim(); }
    slides.push({ id: elId(), ...(bg ? { bg } : {}), elements: els, notes, transition: "fade" });
  }
  if (!slides.length) throw new Error("No slides found in that file.");
  return { v: 1, theme: "simple", slides };
}

/** Plain text of a slide (for search, thumbnails' titles and AI). */
export const slideTitle = (s: Slide) => (s.elements.find((e) => e.role === "title")?.html || s.elements.find((e) => e.html)?.html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;|&lt;|&gt;/g, " ").replace(/\s+/g, " ").trim();
