// Taking a note out: Word, Markdown, plain text and print for typed notes; a PDF (one page per page)
// and pictures for handwriting. All made here on the device.
import { INK_H, INK_W, textOfHtml, type InkPage } from "@shared/arisePages";
import { blankDoc, docPrintHtml, parseHtml, writeDocx, type HNode } from "@shared/office/docModel";
import { download, fileName } from "../exporters";
import { pageImage } from "./inkDraw";

export function exportWord(title: string, html: string) { download(fileName(title, "docx"), writeDocx(blankDoc(html), title || "Note"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); }
export function exportText(title: string, html: string) { download(fileName(title, "txt"), `${title ? `${title}\n\n` : ""}${textOfHtml(html)}\n`, "text/plain;charset=utf-8"); }
export function exportMarkdown(title: string, html: string) { download(fileName(title, "md"), `${title ? `# ${title}\n\n` : ""}${htmlToMarkdown(html)}\n`, "text/markdown;charset=utf-8"); }

/** Opens the system print screen (Save as PDF is there too). */
export function printPage(title: string, html: string) {
  const w = window.open("", "_blank", "noopener=no");
  if (!w) return false;
  w.document.write(docPrintHtml(blankDoc(`${title ? `<h1>${esc(title)}</h1>` : ""}${html}`), title || "Note"));
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* print from the window */ } }, 300);
  return true;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Typed notes as Markdown: headings, lists, checklists, quotes, code, links, bold and italic, tables. */
export function htmlToMarkdown(html: string): string {
  const kids = (n: HNode): string => (n.kids ?? []).map(inline).join("");
  const inline = (n: HNode): string => {
    if (n.text !== undefined) return n.text.replace(/([*_`[\]])/g, "\\$1");
    const t = n.tag;
    if (t === "br") return "  \n";
    if (t === "b" || t === "strong") return `**${kids(n)}**`;
    if (t === "i" || t === "em") return `*${kids(n)}*`;
    if (t === "s" || t === "strike" || t === "del") return `~~${kids(n)}~~`;
    if (t === "code") return `\`${kids(n)}\``;
    if (t === "a") return `[${kids(n)}](${n.attrs?.href ?? ""})`;
    if (t === "img") return `![${n.attrs?.alt ?? ""}](${(n.attrs?.src ?? "").startsWith("data:") ? "image" : n.attrs?.src ?? ""})`;
    return kids(n);
  };
  const block = (n: HNode, depth = 0): string => {
    const t = n.tag;
    if (n.text !== undefined) return n.text.trim() ? n.text : "";
    if (/^h[1-6]$/.test(t ?? "")) return `${"#".repeat(Number(t![1]) + 1)} ${kids(n).trim()}\n\n`;
    if (t === "p" || t === "div") { const s = kids(n).trim(); return s ? `${s}\n\n` : ""; }
    if (t === "blockquote") return `${kids(n).trim().split("\n").map((l) => `> ${l}`).join("\n")}\n\n`;
    if (t === "pre") return `\`\`\`\n${(n.kids ?? []).map((k) => k.text ?? kids(k)).join("")}\n\`\`\`\n\n`;
    if (t === "hr") return "---\n\n";
    if (t === "ul" || t === "ol") {
      const check = !!n.attrs && "data-check" in n.attrs;
      const items = (n.kids ?? []).filter((k) => k.tag === "li").map((li, i) => {
        const mark = check ? `- [${li.attrs?.["data-checked"] === "true" ? "x" : " "}] ` : t === "ol" ? `${i + 1}. ` : "- ";
        const nested = (li.kids ?? []).filter((k) => k.tag === "ul" || k.tag === "ol").map((k) => block(k, depth + 1)).join("");
        const own = (li.kids ?? []).filter((k) => k.tag !== "ul" && k.tag !== "ol").map(inline).join("").trim();
        return `${"  ".repeat(depth)}${mark}${own}\n${nested}`;
      }).join("");
      return depth ? items : `${items}\n`;
    }
    if (t === "table") {
      const rows = collect(n, "tr").map((tr) => (tr.kids ?? []).filter((c) => c.tag === "td" || c.tag === "th").map((c) => kids(c).replace(/\|/g, "\\|").trim()));
      if (!rows.length) return "";
      const w = Math.max(...rows.map((r) => r.length));
      const line = (r: string[]) => `| ${Array.from({ length: w }, (_, i) => r[i] ?? "").join(" | ")} |`;
      return `${line(rows[0])}\n|${" --- |".repeat(w)}\n${rows.slice(1).map(line).join("\n")}\n\n`;
    }
    if (t === "img") return `${inline(n)}\n\n`;
    return (n.kids ?? []).map((k) => block(k, depth)).join("");
  };
  const collect = (n: HNode, tag: string): HNode[] => (n.tag === tag ? [n] : (n.kids ?? []).flatMap((k) => collect(k, tag)));
  return block(parseHtml(html)).replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Handwriting ─────────────────────────────────────────────────────────────
export function exportInkImage(title: string, page: InkPage, n: number) {
  const url = pageImage(page, 1600, 0.92);
  const bin = Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0));
  download(fileName(`${title || "Handwritten note"} page ${n}`, "jpg"), bin, "image/jpeg");
}

/** A PDF of every page, each a picture of the page (Letter-ish, 612 × 865 points). */
export function inkPdf(pages: InkPage[]): Uint8Array {
  const W = 612, H = Math.round((INK_H / INK_W) * W);
  const jpegs = pages.map((p) => Uint8Array.from(atob(pageImage(p, 1275, 0.85).split(",")[1]), (c) => c.charCodeAt(0)));
  const te = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === "string" ? te.encode(b) : b; parts.push(u); size += u.length; };
  const obj = (n: number, body: (Uint8Array | string)[]) => { offsets[n] = size; push(`${n} 0 obj\n`); body.forEach(push); push("\nendobj\n"); };
  push("%PDF-1.4\n%âãÏÓ\n");
  const n = pages.length;
  // 1 catalog, 2 pages, then for each page: page, content, image.
  const pageIds = pages.map((_, i) => 3 + i * 3);
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, [`<< /Type /Pages /Count ${n} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`]);
  jpegs.forEach((jpg, i) => {
    const [pg, content, img] = [pageIds[i], pageIds[i] + 1, pageIds[i] + 2];
    const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(pg, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`]);
    obj(content, [`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`]);
    const dims = jpegSize(jpg);
    obj(img, [`<< /Type /XObject /Subtype /Image /Width ${dims.w} /Height ${dims.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, "\nendstream"]);
  });
  const total = 3 + n * 3;
  const xref = size;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
export const exportInkPdf = (title: string, pages: InkPage[]) => download(fileName(title || "Handwritten note", "pdf"), inkPdf(pages), "application/pdf");

/** Width and height from a JPEG's start-of-frame marker. */
export function jpegSize(b: Uint8Array): { w: number; h: number } {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xc0 && m <= 0xc3) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  return { w: 1275, h: 1803 };
}
