// Arise Docs: what a document is (rich text kept as safe HTML plus page settings), cleaning it, and
// turning it into and out of Microsoft Word (.docx) files.
import { escapeXml as x, find, findAllNodes, kid, kids, parseXml, unzipFiles, zipFiles, type XNode } from "./zipfile";

export type PageSize = "letter" | "a4" | "legal";
export type DocContent = {
  v: 1;
  html: string;
  page: { size: PageSize; landscape: boolean; margin: number /* inches */ };
  header: string;
  footer: string;
  pageNumbers: boolean;
};
export const PAGE_PX: Record<PageSize, { w: number; h: number; label: string }> = {
  letter: { w: 816, h: 1056, label: "Letter (8.5 × 11 in)" }, a4: { w: 794, h: 1123, label: "A4 (21 × 29.7 cm)" }, legal: { w: 816, h: 1344, label: "Legal (8.5 × 14 in)" },
};
export const DOC_FONTS = ["Arial", "Calibri", "Georgia", "Times New Roman", "Verdana", "Garamond", "Courier New", "Comic Sans MS", "Lexend", "Roboto", "Open Sans", "Lato", "Montserrat", "Merriweather", "Playfair Display", "Inter"];

export const blankDoc = (html = "<p><br></p>"): DocContent => ({ v: 1, html, page: { size: "letter", landscape: false, margin: 1 }, header: "", footer: "", pageNumbers: false });

const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function cleanDoc(raw: any): DocContent {
  if (!raw || typeof raw !== "object") return blankDoc();
  // The first Office editor stored plain text.
  if (typeof raw.html !== "string" && typeof raw.text === "string") return blankDoc(raw.text.split(/\n/).map((l: string) => `<p>${escText(l) || "<br>"}</p>`).join("") || "<p><br></p>");
  const p = raw.page && typeof raw.page === "object" ? raw.page : {};
  return {
    v: 1,
    html: sanitizeHtml(String(raw.html || "")).slice(0, 8_000_000) || "<p><br></p>",
    page: { size: p.size === "a4" || p.size === "legal" ? p.size : "letter", landscape: !!p.landscape, margin: [0.5, 0.75, 1, 1.25, 1.5].includes(Number(p.margin)) ? Number(p.margin) : 1 },
    header: sanitizeHtml(String(raw.header || "")).slice(0, 4000),
    footer: sanitizeHtml(String(raw.footer || "")).slice(0, 4000),
    pageNumbers: !!raw.pageNumbers,
  };
}

// ─── Safe HTML ──────────────────────────────────────────────────────────────

const ALLOWED: Record<string, string[]> = {
  p: ["style"], h1: ["style"], h2: ["style"], h3: ["style"], h4: ["style"], blockquote: ["style"], pre: ["style"],
  ul: ["style", "data-check"], ol: ["style", "start", "type"], li: ["style", "data-checked"],
  b: [], strong: [], i: [], em: [], u: [], s: [], strike: [], sub: [], sup: [], code: [], mark: ["style"],
  span: ["style"], font: ["color", "face", "size"], a: ["href", "title"], br: [], hr: ["style"],
  table: ["style"], thead: [], tbody: [], tr: ["style"], td: ["style", "colspan", "rowspan"], th: ["style", "colspan", "rowspan"],
  img: ["src", "alt", "width", "height", "style"], div: ["style", "data-page-break", "align"], figure: ["style"], figcaption: ["style"],
};
const VOID = new Set(["br", "hr", "img"]);
const STYLE_PROPS = new Set(["color", "background-color", "background", "font-family", "font-size", "font-weight", "font-style", "text-decoration", "text-align", "line-height", "margin-left", "margin-top", "margin-bottom", "padding-left", "text-indent", "width", "height", "border", "border-collapse", "vertical-align", "float", "max-width", "list-style-type"]);
const dangerous = /expression|javascript:|url\s*\(|@import|behavior/i;

function cleanStyle(style: string): string {
  return style.split(";").map((d) => d.trim()).filter(Boolean).map((d) => { const i = d.indexOf(":"); return i < 0 ? null : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()] as const; })
    .filter((d): d is readonly [string, string] => !!d && STYLE_PROPS.has(d[0]) && !dangerous.test(d[1]) && d[1].length < 200)
    .map(([k, v]) => `${k}: ${v.replace(/"/g, "'")}`).join("; ");
}
const safeUrl = (u: string, img = false) => {
  const t = u.trim();
  if (img) return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(t) && !/svg/i.test(t.slice(0, 30)) ? t : /^https:\/\//i.test(t) ? t : "";
  return /^(https?:|mailto:|tel:|#)/i.test(t) ? t : "";
};

/** Keeps only the tags, attributes and styles a document needs; scripts and event handlers are dropped. */
export function sanitizeHtml(html: string): string {
  const out: string[] = [];
  const open: string[] = [];
  const re = /<!--[\s\S]*?-->|<(script|style|iframe|object|embed|template|noscript|svg|math|xml|head|title)\b[\s\S]*?<\/\1\s*>|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { out.push(m[4].replace(/>/g, "&gt;")); continue; }
    if (m[0] === "<") { out.push("&lt;"); continue; }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    const closing = m[0][1] === "/";
    if (!ALLOWED[tag]) continue;
    if (closing) {
      const at = open.lastIndexOf(tag);
      if (at < 0) continue;
      while (open.length > at) out.push(`</${open.pop()}>`);
      continue;
    }
    const attrs: string[] = [];
    const ar = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let a: RegExpExecArray | null;
    while ((a = ar.exec(m[3] || ""))) {
      const name = a[1].toLowerCase();
      if (!ALLOWED[tag].includes(name)) continue;
      let val = (a[2] ?? a[3] ?? a[4] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      if (name === "style") val = cleanStyle(val);
      else if (name === "href") val = safeUrl(val);
      else if (name === "src") val = safeUrl(val, true);
      else val = val.slice(0, 200);
      if (!val && name !== "data-page-break" && name !== "data-check") continue;
      attrs.push(` ${name}="${val.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`);
    }
    if (tag === "img" && !attrs.some((x2) => x2.startsWith(" src="))) continue;
    if (tag === "a") attrs.push(' target="_blank" rel="noopener noreferrer"');
    out.push(`<${tag}${attrs.join("")}>`);
    if (!VOID.has(tag)) open.push(tag);
  }
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join("");
}

/** Plain text of a document (for word counts, search and AI). */
export function htmlText(html: string): string {
  return html.replace(/<(br|\/p|\/h[1-6]|\/li|\/div|\/tr|\/blockquote)[^>]*>/gi, "\n").replace(/<\/t[dh]>/gi, "\t").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
}
export function wordCount(html: string): { words: number; chars: number; charsNoSpaces: number; paragraphs: number; minutes: number } {
  const t = htmlText(html);
  const words = (t.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
  return { words, chars: t.length, charsNoSpaces: t.replace(/\s/g, "").length, paragraphs: t.split(/\n+/).filter((l) => l.trim()).length, minutes: Math.max(1, Math.round(words / 230)) };
}

// ─── A small HTML tree (for Word export) ────────────────────────────────────

export type HNode = { tag: string; attrs: Record<string, string>; kids: HNode[]; text?: string };
export function parseHtml(html: string): HNode {
  const root: HNode = { tag: "#root", attrs: {}, kids: [] };
  const stack = [root];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)/g;
  let m: RegExpExecArray | null;
  const un = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[3] !== undefined) { top.kids.push({ tag: "#text", attrs: {}, kids: [], text: un(m[3]) }); continue; }
    const tag = m[1].toLowerCase();
    if (m[0][1] === "/") { const at = stack.map((n) => n.tag).lastIndexOf(tag); if (at > 0) stack.length = at; continue; }
    const attrs: Record<string, string> = {};
    const ar = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let a: RegExpExecArray | null;
    while ((a = ar.exec(m[2] || ""))) attrs[a[1].toLowerCase()] = un(a[2] ?? a[3] ?? a[4] ?? "");
    const node: HNode = { tag, attrs, kids: [] };
    top.kids.push(node);
    if (!VOID.has(tag) && !m[0].endsWith("/>")) stack.push(node);
  }
  return root;
}
const styleMap = (s = "") => Object.fromEntries(s.split(";").map((d) => d.split(":").map((x2) => x2.trim())).filter((d) => d.length >= 2 && d[0]).map(([k, ...v]) => [k.toLowerCase(), v.join(":")]));

// ─── Colours and sizes ──────────────────────────────────────────────────────

const NAMED: Record<string, string> = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", orange: "FFA500", purple: "800080", gray: "808080", grey: "808080" };
function hexColor(c?: string): string | null {
  if (!c) return null;
  const t = c.trim().toLowerCase();
  if (NAMED[t]) return NAMED[t];
  let m = /^#([0-9a-f]{3})$/.exec(t); if (m) return m[1].split("").map((ch) => ch + ch).join("").toUpperCase();
  m = /^#([0-9a-f]{6})/.exec(t); if (m) return m[1].toUpperCase();
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(t); if (m) return [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  return null;
}
/** A CSS font size in points. */
function sizePt(v?: string): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return null;
  if (/pt$/.test(v)) return n;
  if (/px$/.test(v)) return n * 0.75;
  if (/em$|rem$/.test(v)) return n * 11;
  return null;
}
const FONT_SIZE_TAG: Record<string, number> = { "1": 8, "2": 10, "3": 12, "4": 14, "5": 18, "6": 24, "7": 36 };

// ─── Word export ────────────────────────────────────────────────────────────

type Run = { b?: boolean; i?: boolean; u?: boolean; s?: boolean; color?: string; hl?: string; font?: string; sz?: number; sub?: boolean; sup?: boolean; code?: boolean; link?: string };

/** Makes a .docx file Word, Google Docs and Pages open. */
export function writeDocx(doc: DocContent, title = "Document"): Uint8Array {
  const rels: string[] = [];
  const media: { name: string; data: Uint8Array }[] = [];
  let relN = 10;
  const addRel = (type: string, target: string, external = false) => { const id = `rId${relN++}`; rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${x(target)}"${external ? ' TargetMode="External"' : ""}/>`); return id; };
  let imgN = 0;

  const runXml = (text: string, r: Run): string => {
    const pr = [
      r.font ? `<w:rFonts w:ascii="${x(r.font)}" w:hAnsi="${x(r.font)}" w:cs="${x(r.font)}"/>` : r.code ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>' : "",
      r.b ? "<w:b/>" : "", r.i ? "<w:i/>" : "", r.s ? "<w:strike/>" : "", r.color ? `<w:color w:val="${r.color}"/>` : r.link ? '<w:color w:val="1155CC"/>' : "",
      r.sz ? `<w:sz w:val="${Math.round(r.sz * 2)}"/>` : "", r.hl ? `<w:shd w:val="clear" w:color="auto" w:fill="${r.hl}"/>` : "",
      r.u || r.link ? '<w:u w:val="single"/>' : "", r.sub ? '<w:vertAlign w:val="subscript"/>' : r.sup ? '<w:vertAlign w:val="superscript"/>' : "",
    ].join("");
    const parts = text.split("\n");
    return parts.map((t, i) => `${i ? "<w:r><w:br/></w:r>" : ""}${t ? `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ""}<w:t xml:space="preserve">${x(t)}</w:t></w:r>` : ""}`).join("");
  };
  const inline = (nodes: HNode[], r: Run): string => nodes.map((n) => {
    if (n.tag === "#text") return runXml((n.text || "").replace(/\s+/g, " "), r);
    if (n.tag === "br") return "<w:r><w:br/></w:r>";
    if (n.tag === "img") return imageXml(n);
    const st = styleMap(n.attrs.style);
    const next: Run = { ...r };
    if (n.tag === "b" || n.tag === "strong" || /^(bold|[6-9]00)$/.test(st["font-weight"] || "")) next.b = true;
    if (n.tag === "i" || n.tag === "em" || st["font-style"] === "italic") next.i = true;
    if (n.tag === "u" || /underline/.test(st["text-decoration"] || "")) next.u = true;
    if (n.tag === "s" || n.tag === "strike" || /line-through/.test(st["text-decoration"] || "")) next.s = true;
    if (n.tag === "sub") next.sub = true; if (n.tag === "sup") next.sup = true; if (n.tag === "code") next.code = true;
    const col = hexColor(st.color || n.attrs.color); if (col) next.color = col;
    const bg = hexColor(st["background-color"] || st.background); if (bg) next.hl = bg; if (n.tag === "mark" && !bg) next.hl = "FFF59D";
    const ff = (st["font-family"] || n.attrs.face || "").split(",")[0].replace(/['"]/g, "").trim(); if (ff) next.font = ff;
    const sz = sizePt(st["font-size"]) ?? (n.attrs.size ? FONT_SIZE_TAG[n.attrs.size] : null); if (sz) next.sz = sz;
    if (n.tag === "a" && n.attrs.href) { const id = addRel("hyperlink", n.attrs.href, true); return `<w:hyperlink r:id="${id}">${inline(n.kids, { ...next, link: n.attrs.href })}</w:hyperlink>`; }
    return inline(n.kids, next);
  }).join("");
  const imageXml = (n: HNode): string => {
    const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i.exec(n.attrs.src || "");
    if (!m) return "";
    const ext = m[1].toLowerCase().replace("jpeg", "jpg");
    const bin = typeof atob === "function" ? Uint8Array.from(atob(m[2].replace(/\s/g, "")), (ch) => ch.charCodeAt(0)) : new Uint8Array(Buffer.from(m[2], "base64"));
    const name = `image${++imgN}.${ext}`;
    media.push({ name, data: bin });
    const id = addRel("image", `media/${name}`);
    const st = styleMap(n.attrs.style);
    const wpx = parseFloat(st.width || n.attrs.width || "") || 400, hpx = parseFloat(st.height || n.attrs.height || "") || wpx * 0.66;
    const cx = Math.round(Math.min(wpx, 624) * 9525), cy = Math.round(hpx * (Math.min(wpx, 624) / wpx) * 9525);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${imgN}" name="Picture ${imgN}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imgN}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };
  const pPr = (n: HNode, extra = ""): string => {
    const st = styleMap(n.attrs.style);
    const jc = { center: "center", right: "right", justify: "both", left: "left" }[st["text-align"] || n.attrs.align || ""];
    const ind = parseFloat(st["margin-left"] || st["padding-left"] || "");
    const lh = parseFloat(st["line-height"] || "");
    return `<w:pPr>${extra}${lh ? `<w:spacing w:line="${Math.round(lh * 240)}" w:lineRule="auto"/>` : ""}${ind ? `<w:ind w:left="${Math.round(ind * 15)}"/>` : ""}${jc ? `<w:jc w:val="${jc}"/>` : ""}</w:pPr>`;
  };
  const isBlock = (t: string) => /^(p|h[1-6]|ul|ol|li|blockquote|pre|table|div|hr|figure|figcaption)$/.test(t);
  const blocks = (nodes: HNode[], listLevel = -1, listKind: "bullet" | "number" | "check" = "bullet"): string => {
    const out: string[] = [];
    let loose: HNode[] = [];
    const flush = () => { if (loose.some((n) => n.tag !== "#text" || (n.text || "").trim())) out.push(`<w:p>${inline(loose, {})}</w:p>`); loose = []; };
    for (const n of nodes) {
      if (!isBlock(n.tag)) { loose.push(n); continue; }
      flush();
      const style = /^h[1-4]$/.test(n.tag) ? `<w:pStyle w:val="Heading${n.tag[1]}"/>` : n.tag === "blockquote" ? '<w:pStyle w:val="Quote"/>' : "";
      if (n.tag === "p" || /^h[1-6]$/.test(n.tag) || n.tag === "blockquote" || n.tag === "pre" || n.tag === "figcaption") {
        if ((n.tag === "blockquote" || n.tag === "p") && n.kids.some((k) => isBlock(k.tag))) { out.push(blocks(n.kids, listLevel, listKind)); continue; }
        out.push(`<w:p>${pPr(n, style)}${inline(n.kids, n.tag === "pre" ? { code: true } : {})}</w:p>`);
      } else if (n.tag === "div" && "data-page-break" in n.attrs) out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      else if (n.tag === "div" || n.tag === "figure") out.push(blocks(n.kids));
      else if (n.tag === "hr") out.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>');
      else if (n.tag === "ul" || n.tag === "ol") out.push(blocks(n.kids, listLevel + 1, n.tag === "ol" ? "number" : "data-check" in n.attrs ? "check" : "bullet"));
      else if (n.tag === "li") {
        const inl = n.kids.filter((k) => !isBlock(k.tag) || k.tag === "p"), sub = n.kids.filter((k) => k.tag === "ul" || k.tag === "ol");
        const flat = inl.flatMap((k) => (k.tag === "p" ? k.kids : [k]));
        const lvl = Math.max(0, listLevel);
        const prefix = listKind === "check" ? (n.attrs["data-checked"] === "true" ? "☑ " : "☐ ") : "";
        out.push(`<w:p><w:pPr>${listKind === "check" ? "" : `<w:numPr><w:ilvl w:val="${Math.min(8, lvl)}"/><w:numId w:val="${listKind === "number" ? 2 : 1}"/></w:numPr>`}${listKind === "check" ? `<w:ind w:left="${360 + lvl * 360}"/>` : ""}</w:pPr>${prefix ? runXml(prefix, {}) : ""}${inline(flat, {})}</w:p>`);
        if (sub.length) out.push(blocks(sub, lvl));
      } else if (n.tag === "table") {
        const rows = findRows(n);
        const cols = Math.max(1, ...rows.map((r) => r.kids.filter((c) => c.tag === "td" || c.tag === "th").length));
        const w = Math.floor(9360 / cols);
        out.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:color="A0A0A0"/>`).join("")}</w:tblBorders></w:tblPr><w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.map((r) => `<w:tr>${r.kids.filter((c) => c.tag === "td" || c.tag === "th").map((c) => { const st = styleMap(c.attrs.style); const bg = hexColor(st["background-color"] || st.background); const span = Number(c.attrs.colspan || 1); const inner = blocks(c.kids.length ? c.kids : [{ tag: "#text", attrs: {}, kids: [], text: "" }]); return `<w:tc><w:tcPr><w:tcW w:w="${w * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}${bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : c.tag === "th" ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : ""}</w:tcPr>${c.tag === "th" ? inner.replace(/<w:r>(?!<w:rPr>)/g, "<w:r><w:rPr><w:b/></w:rPr>") : inner || "<w:p/>"}${/<w:p[ >]/.test(inner) ? "" : "<w:p/>"}</w:tc>`; }).join("")}</w:tr>`).join("")}</w:tbl><w:p/>`);
      }
    }
    flush();
    return out.join("");
  };
  const findRows = (t: HNode): HNode[] => t.kids.flatMap((k) => (k.tag === "tr" ? [k] : k.tag === "thead" || k.tag === "tbody" ? k.kids.filter((r) => r.tag === "tr") : []));

  const body = blocks(parseHtml(doc.html).kids) || "<w:p/>";
  const size = PAGE_PX[doc.page.size];
  const [pw, ph] = doc.page.landscape ? [size.h, size.w] : [size.w, size.h];
  const twip = (px: number) => Math.round(px * 15);
  const mar = Math.round(doc.page.margin * 1440);
  const hdrText = parseHtml(doc.header).kids, ftrText = parseHtml(doc.footer).kids;
  const hasHeader = doc.header.replace(/<[^>]+>/g, "").trim().length > 0;
  const hasFooter = doc.footer.replace(/<[^>]+>/g, "").trim().length > 0 || doc.pageNumbers;
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  const headerId = hasHeader ? addRel("header", "header1.xml") : "";
  const footerId = hasFooter ? addRel("footer", "footer1.xml") : "";
  const sect = `<w:sectPr>${headerId ? `<w:headerReference w:type="default" r:id="${headerId}"/>` : ""}${footerId ? `<w:footerReference w:type="default" r:id="${footerId}"/>` : ""}<w:pgSz w:w="${twip(pw)}" w:h="${twip(ph)}"${doc.page.landscape ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${mar}" w:right="${mar}" w:bottom="${mar}" w:left="${mar}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;
  const pageField = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${NS}>${blocks(hdrText) || "<w:p/>"}</w:hdr>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS}>${hasFooter && doc.footer.replace(/<[^>]+>/g, "").trim() ? blocks(ftrText) : ""}${doc.pageNumbers ? `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${pageField}</w:p>` : ""}</w:ftr>`;
  const lvl = (i: number, fmt: string, text: string) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + i * 360}" w:hanging="360"/></w:pPr>${fmt === "bullet" ? '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>' : ""}</w:lvl>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering ${NS}><w:abstractNum w:abstractNumId="0">${Array.from({ length: 9 }, (_, i) => lvl(i, "bullet", "")).join("")}</w:abstractNum><w:abstractNum w:abstractNumId="1">${Array.from({ length: 9 }, (_, i) => lvl(i, ["decimal", "lowerLetter", "lowerRoman"][i % 3], `%${i + 1}.`)).join("")}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
  const heading = (n: number, sz: number, color: string) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${n === 1 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${heading(1, 40, "1F2937")}${heading(2, 32, "1F2937")}${heading(3, 28, "374151")}${heading(4, 24, "374151")}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="CBD5E1"/></w:pBdr></w:pPr><w:rPr><w:i/><w:color w:val="475569"/></w:rPr></w:style></w:styles>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${rels.join("")}</Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="webp" ContentType="image/webp"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>${hasHeader ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ""}${hasFooter ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ""}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${x(title)}</dc:title><dc:creator>Arise Docs</dc:creator></cp:coreProperties>`;
  return zipFiles([
    { name: "[Content_Types].xml", data: types }, { name: "_rels/.rels", data: rootRels }, { name: "docProps/core.xml", data: core },
    { name: "word/document.xml", data: document }, { name: "word/styles.xml", data: styles }, { name: "word/numbering.xml", data: numbering }, { name: "word/_rels/document.xml.rels", data: docRels },
    ...(hasHeader ? [{ name: "word/header1.xml", data: header }] : []), ...(hasFooter ? [{ name: "word/footer1.xml", data: footer }] : []),
    ...media.map((m) => ({ name: `word/media/${m.name}`, data: m.data })),
  ]);
}

// ─── Word import ────────────────────────────────────────────────────────────

const b64 = (bytes: Uint8Array) => { if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64"); let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

/** Opens a .docx file as a document. */
export async function readDocx(buf: ArrayBuffer | Uint8Array): Promise<DocContent> {
  const files = await unzipFiles(buf);
  const dec = new TextDecoder();
  const get = (p: string) => { const f = files.get(p); return f ? dec.decode(f) : ""; };
  const docXml = get("word/document.xml");
  if (!docXml) throw new Error("That doesn't look like a Word file.");
  const rels = new Map<string, string>();
  for (const r of findAllNodes(parseXml(get("word/_rels/document.xml.rels")), "Relationship")) rels.set(r.attrs.Id, r.attrs.Target);
  // Which lists are numbered and which are bullets.
  const numFmt = new Map<string, string>();
  const numbering = parseXml(get("word/numbering.xml"));
  const abstractFmt = new Map<string, string>();
  for (const an of findAllNodes(numbering, "abstractNum")) { const l0 = kids(an, "lvl").find((l) => l.attrs.ilvl === "0"); abstractFmt.set(an.attrs.abstractNumId, kid(l0, "numFmt")?.attrs.val || "bullet"); }
  for (const n of findAllNodes(numbering, "num")) numFmt.set(n.attrs.numId, abstractFmt.get(kid(n, "abstractNumId")?.attrs.val || "") || "bullet");
  const styleNames = new Map<string, string>();
  for (const s of findAllNodes(parseXml(get("word/styles.xml")), "style")) styleNames.set(s.attrs.styleId, (kid(s, "name")?.attrs.val || "").toLowerCase());

  const runHtml = (r: XNode, inLink = false): string => {
    const pr = kid(r, "rPr");
    let out = "";
    for (const k of r.kids) {
      if (k.name === "t") out += escText(k.text);
      else if (k.name === "tab") out += " ";
      else if (k.name === "br") out += k.attrs.type === "page" ? "" : "<br>";
      else if (k.name === "drawing" || k.name === "pict") {
        const blip = find(k, "blip") || find(k, "imagedata");
        const id = blip?.attrs.embed || blip?.attrs.id;
        const target = id ? rels.get(id) : undefined;
        const data = target ? files.get(`word/${target.replace(/^\.?\//, "")}`) : undefined;
        if (data && target) {
          const ext = target.split(".").pop()!.toLowerCase();
          const ex = find(k, "extent");
          const w = ex ? Math.round(Number(ex.attrs.cx) / 9525) : 0;
          if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) out += `<img src="data:image/${ext === "jpg" ? "jpeg" : ext};base64,${b64(data)}"${w ? ` style="width: ${Math.min(w, 640)}px"` : ""}>`;
        }
      }
    }
    if (!out || !pr) return out;
    const css: string[] = [];
    const col = kid(pr, "color")?.attrs.val; if (col && col !== "auto" && col !== "000000" && !(inLink && /^(1155CC|0563C1|0000FF)$/i.test(col))) css.push(`color: #${col}`);
    const sz = Number(kid(pr, "sz")?.attrs.val); if (sz && sz !== 22 && sz !== 24) css.push(`font-size: ${sz / 2}pt`);
    const font = kid(pr, "rFonts")?.attrs.ascii; if (font && !/^(Calibri|Arial|Times New Roman|Aptos)$/.test(font)) css.push(`font-family: '${font}'`);
    const hl = kid(pr, "highlight")?.attrs.val, shd = kid(pr, "shd")?.attrs.fill;
    if (hl && hl !== "none") css.push(`background-color: ${hl === "yellow" ? "#fff59d" : hl === "green" ? "#bbf7d0" : hl === "cyan" ? "#a5f3fc" : hl === "magenta" ? "#f5d0fe" : "#fde68a"}`); else if (shd && shd !== "auto") css.push(`background-color: #${shd}`);
    const on = (n: string) => { const e = kid(pr, n); return !!e && e.attrs.val !== "0" && e.attrs.val !== "false" && e.attrs.val !== "none"; };
    if (on("b")) out = `<strong>${out}</strong>`;
    if (on("i")) out = `<em>${out}</em>`;
    if (on("u") && !inLink) out = `<u>${out}</u>`;
    if (on("strike")) out = `<s>${out}</s>`;
    const va = kid(pr, "vertAlign")?.attrs.val; if (va === "superscript") out = `<sup>${out}</sup>`; else if (va === "subscript") out = `<sub>${out}</sub>`;
    return css.length ? `<span style="${css.join("; ")}">${out}</span>` : out;
  };
  const paraInner = (p: XNode): string => p.kids.map((k) => {
    if (k.name === "r") return runHtml(k);
    if (k.name === "hyperlink") { const href = k.attrs.id ? rels.get(k.attrs.id) : ""; const inner = kids(k, "r").map((r) => runHtml(r, !!href)).join(""); return href ? `<a href="${escText(href).replace(/"/g, "&quot;")}">${inner}</a>` : inner; }
    if (k.name === "ins" || k.name === "smartTag" || k.name === "sdt" || k.name === "fldSimple") return paraInner(kid(k, "sdtContent") || k);
    return "";
  }).join("");

  const out: string[] = [];
  const listStack: string[] = [];
  const closeLists = (to: number) => { while (listStack.length > to) out.push(`</${listStack.pop()}>`); };
  const body = find(parseXml(docXml), "body");
  const walk = (nodes: XNode[]) => {
    for (const n of nodes) {
      if (n.name === "p") {
        const pr = kid(n, "pPr");
        const sid = kid(pr, "pStyle")?.attrs.val || "";
        const sname = styleNames.get(sid) || sid.toLowerCase();
        const hm = /heading\s*(\d)/.exec(sname) || /^heading(\d)$/i.exec(sid);
        const numPr = kid(pr, "numPr");
        const jc = kid(pr, "jc")?.attrs.val;
        const align = jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : jc === "both" ? "justify" : "";
        const style = align ? ` style="text-align: ${align}"` : "";
        const inner = paraInner(n);
        const pageBreak = findAllNodes(n, "br").some((b) => b.attrs.type === "page");
        if (numPr) {
          const lvl = Number(kid(numPr, "ilvl")?.attrs.val || 0);
          const tag = (numFmt.get(kid(numPr, "numId")?.attrs.val || "") || "bullet") === "bullet" ? "ul" : "ol";
          while (listStack.length < lvl + 1) { out.push(`<${tag}>`); listStack.push(tag); }
          closeLists(lvl + 1);
          if (listStack[lvl] !== tag) { closeLists(lvl); out.push(`<${tag}>`); listStack.push(tag); }
          out.push(`<li${style}>${inner || "<br>"}</li>`);
          continue;
        }
        closeLists(0);
        if (hm) out.push(`<h${Math.min(4, Number(hm[1]))}${style}>${inner || "<br>"}</h${Math.min(4, Number(hm[1]))}>`);
        else if (/title/.test(sname)) out.push(`<h1${style}>${inner}</h1>`);
        else if (/quote/.test(sname)) out.push(`<blockquote>${inner}</blockquote>`);
        else out.push(`<p${style}>${inner || "<br>"}</p>`);
        if (pageBreak) out.push('<div data-page-break=""></div>');
      } else if (n.name === "tbl") {
        closeLists(0);
        out.push(`<table style="border-collapse: collapse; width: 100%">${kids(n, "tr").map((tr) => `<tr>${kids(tr, "tc").map((tc) => { const span = Number(kid(kid(tc, "tcPr"), "gridSpan")?.attrs.val || 1); const fill = kid(kid(tc, "tcPr"), "shd")?.attrs.fill; return `<td${span > 1 ? ` colspan="${span}"` : ""} style="border: 1px solid #94a3b8${fill && fill !== "auto" ? `; background-color: #${fill}` : ""}">${kids(tc, "p").map((p) => paraInner(p)).join("<br>")}</td>`; }).join("")}</tr>`).join("")}</table>`);
      } else if (n.name === "sdt") walk(kid(n, "sdtContent")?.kids || []);
    }
  };
  walk(body?.kids || []);
  closeLists(0);
  const doc = blankDoc(sanitizeHtml(out.join("")) || "<p><br></p>");
  const pg = find(body, "pgSz");
  if (pg) { const w = Number(pg.attrs.w), h = Number(pg.attrs.h); doc.page.landscape = pg.attrs.orient === "landscape" || w > h; const long = Math.max(w, h); doc.page.size = long > 19500 ? "legal" : long > 16000 ? "a4" : "letter"; }
  const mar = find(body, "pgMar"); if (mar) { const m = Number(mar.attrs.left) / 1440; doc.page.margin = [0.5, 0.75, 1, 1.25, 1.5].reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a), 1); }
  return doc;
}

/** A document as a web page, for printing, PDF and the .html download. */
export function docPrintHtml(doc: DocContent, title: string, fontLink = ""): string {
  const size = PAGE_PX[doc.page.size];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escText(title)}</title>${fontLink ? `<link rel="stylesheet" href="${fontLink}">` : ""}<style>
@page { size: ${doc.page.size === "a4" ? "A4" : doc.page.size} ${doc.page.landscape ? "landscape" : "portrait"}; margin: ${doc.page.margin}in; }
body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; margin: 0; ${size ? "" : ""} }
h1 { font-size: 20pt; margin: 0.6em 0 0.3em; } h2 { font-size: 16pt; margin: 0.6em 0 0.3em; } h3 { font-size: 14pt; margin: 0.5em 0 0.25em; } h4 { font-size: 12pt; }
p { margin: 0 0 0.5em; } table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #94a3b8; padding: 4px 6px; vertical-align: top; }
blockquote { margin: 0.5em 0 0.5em 0; padding-left: 12px; border-left: 4px solid #cbd5e1; color: #475569; font-style: italic; }
img { max-width: 100%; } [data-page-break] { break-after: page; } ul[data-check] { list-style: none; padding-left: 1.2em; } ul[data-check] li::before { content: "☐ "; } ul[data-check] li[data-checked="true"]::before { content: "☑ "; }
.hdr, .ftr { color: #64748b; font-size: 9pt; }
</style></head><body>${doc.header ? `<div class="hdr">${doc.header}</div>` : ""}${doc.html}${doc.footer ? `<div class="ftr">${doc.footer}</div>` : ""}</body></html>`;
}
