// An article made into the blocks its cards show (shared/wikiFeed.ts lays them out as pages). Only prose, short
// lists and real photos are kept; links to other articles become data-wiki links that open them as new cards, and
// every other link is just text. The HTML built here holds only text and <a data-wiki>, <b>, <i>, <sub>, <sup>, so
// it is safe to show.
import { articleUrl, boringImage, skipSection, type Block } from "@shared/wikiFeed";

const JUNK = [
  "style", "script", "link", "meta", "noscript", "table", "figure.mw-halign-left table", ".infobox", ".sidebar", ".navbox", ".vertical-navbox", ".ambox", ".ombox", ".tmbox",
  ".mbox-small", ".hatnote", "[role=note]", ".metadata", ".noprint", ".reference", "sup.reference", ".mw-ref", ".reflist", ".references", ".mw-references-wrap", ".mw-editsection",
  ".gallery", ".mw-graph", ".chart", ".timeline-wrapper", ".mwe-math-element", "math", ".toc", "#toc", ".shortdescription", ".mw-empty-elt", ".navigation-not-searchable",
  ".side-box", ".portalbox", ".sistersitebox", ".wikitable", "#coordinates", ".geo-default", ".geo-nondefault", ".mw-kartographer-maplink", ".listen", ".haudio",
  ".mod-gallery", ".multiimage", ".tmulti", ".thumbinner .thumb", ".IPA", ".rt-commentedText", "[style*='display:none']", "[style*='display: none']", ".plainlist", ".clade",
].join(",");

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (t: string) => esc(t).replace(/"/g, "&quot;");
const KEEP = new Set(["B", "STRONG", "I", "EM", "SUB", "SUP"]);

/** An article's title from a link, if it goes to one (not a file, category, help page…). */
export function wikiTitle(href: string | null): string | null {
  const m = (href || "").match(/^(?:https?:\/\/en\.(?:m\.)?wikipedia\.org)?\/wiki\/([^#?]+)/);
  if (!m) return null;
  let t: string;
  try { t = decodeURIComponent(m[1]).replace(/_/g, " "); } catch { return null; }
  return /^(File|Image|Special|Help|Wikipedia|Template|Template talk|Talk|Category|Portal|User|User talk|Draft|MediaWiki|Module|Book|TimedText):/i.test(t) ? null : t;
}

/** A node as safe inline HTML. */
function inline(node: Node): string {
  if (node.nodeType === 3) return esc((node.textContent || "").replace(/\s+/g, " "));
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  const kids = () => Array.from(el.childNodes).map(inline).join("");
  if (el.tagName === "A") { const t = wikiTitle(el.getAttribute("href")); return t ? `<a data-wiki="${escAttr(t)}">${kids()}</a>` : kids(); }
  if (el.tagName === "BR") return " ";
  if (KEEP.has(el.tagName)) { const tag = el.tagName === "STRONG" ? "b" : el.tagName === "EM" ? "i" : el.tagName.toLowerCase(); return `<${tag}>${kids()}</${tag}>`; }
  return kids();
}
const textOf = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim();

/** A paragraph split into pieces of at most max characters, at sentence ends (a link is never cut). */
function pieces(el: Element, max: number): string[] {
  const tokens: string[] = [];
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) {
      const t = (n.textContent || "").replace(/\s+/g, " ");
      // Sentence ends (no lookbehind: older iPhones can't read it).
      for (const part of t.replace(/([.!?]["”’)]?\s)(?=[A-Z0-9"“(])/g, "$1\u0000").split("\u0000")) if (part) tokens.push(esc(part));
    } else tokens.push(inline(n));
  }
  const out: string[] = [];
  let cur = "", len = 0;
  for (const tok of tokens) {
    const l = textOf(tok).length;
    if (len + l > max && len > max * 0.35) { out.push(cur.trim()); cur = ""; len = 0; }
    cur += tok; len += l;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The article as blocks: headings, paragraphs (split to fit a page), short list items and real photos. */
export function articleBlocks(html: string, pieceMax = 520, skipImage?: string): Block[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector(".mw-parser-output") ?? doc.body;
  root.querySelectorAll(JUNK).forEach((n) => n.remove());
  const blocks: Block[] = [];
  const sameFile = (a: string, b?: string) => !!b && a.split("/").pop()!.replace(/^\d+px-/, "") === b.split("/").pop()!.replace(/^\d+px-/, "");
  let skipping = false, skipLevel = 0;
  const walk = (parent: Element) => {
    for (const el of Array.from(parent.children)) {
      if (blocks.length > 600) return;
      const heading = el.matches("div.mw-heading") ? el.querySelector("h2,h3,h4,h5") : el.matches("h2,h3,h4,h5") ? el : null;
      if (heading) {
        const level = Number(heading.tagName[1]);
        const text = (heading.textContent || "").trim();
        if (skipping && level > skipLevel) continue;
        skipping = skipSection(text); skipLevel = level;
        if (!skipping && text) blocks.push({ kind: "h", html: esc(text), text: text.length });
        continue;
      }
      if (skipping) continue;
      if (el.tagName === "SECTION" || (el.tagName === "DIV" && !el.matches("figure, .thumb"))) { walk(el); continue; }
      if (el.tagName === "P" || el.tagName === "BLOCKQUOTE") {
        const plain = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (plain.length < 40) continue;
        for (const h of pieces(el.tagName === "BLOCKQUOTE" ? (el.querySelector("p") ?? el) : el, pieceMax)) { const t = textOf(h).length; if (t) blocks.push({ kind: "p", html: el.tagName === "BLOCKQUOTE" ? `<i>${h}</i>` : h, text: t }); }
        continue;
      }
      if (el.tagName === "UL" || el.tagName === "OL") {
        const items = Array.from(el.children).filter((li) => li.tagName === "LI").map((li) => { li.querySelectorAll("ul,ol").forEach((x) => x.remove()); return inline(li).trim(); });
        // Lists of bare names or links aren't reading; real sentences are.
        const prose = items.filter((h) => { const t = textOf(h); return t.length >= 30 && t.length <= 600; });
        if (prose.length < Math.ceil(items.length / 2)) continue;
        for (const h of prose.slice(0, 8)) blocks.push({ kind: "li", html: h, text: textOf(h).length });
        continue;
      }
      if (el.matches("figure, .thumb, div[typeof*='mw:File']")) {
        const img = el.querySelector("img");
        const caption = (el.querySelector("figcaption, .thumbcaption")?.textContent || "").replace(/\s+/g, " ").trim();
        let src = img?.getAttribute("src") || "";
        const w = Number(img?.getAttribute("width") || 0);
        if (!src || w < 140 || boringImage(src) || boringImage(caption) || sameFile(src, skipImage)) continue;
        if (src.startsWith("//")) src = `https:${src}`;
        if (/\/thumb\//.test(src)) src = src.replace(/\/(\d+)px-([^/]+)$/, (_m, _w, f) => `/800px-${f}`);
        if (!src.startsWith("https://upload.wikimedia.org/")) continue;
        blocks.push({ kind: "img", html: esc(caption.slice(0, 220)), text: 0, src, caption: caption.slice(0, 220) });
      }
    }
  };
  walk(root);
  // Drop headings left with nothing under them.
  return blocks.filter((b, i) => b.kind !== "h" || (blocks[i + 1] && blocks[i + 1].kind !== "h"));
}

const cache = new Map<string, Promise<Block[] | null>>();
/** An article's blocks, fetched once per visit. */
export function loadArticle(title: string, skipImage?: string): Promise<Block[] | null> {
  let p = cache.get(title);
  if (!p) {
    p = fetch(articleUrl(title)).then((r) => (r.ok ? r.json() : null)).then((j) => (typeof j?.parse?.text === "string" ? articleBlocks(j.parse.text, 520, skipImage) : null)).catch(() => null);
    p.then((b) => { if (!b) cache.delete(title); });
    if (cache.size > 80) cache.delete(cache.keys().next().value as string);
    cache.set(title, p);
  }
  return p;
}
