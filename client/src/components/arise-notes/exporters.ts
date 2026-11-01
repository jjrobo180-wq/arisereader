// Taking a note out of Arise Notes: copy, PDF, Word, print and email. The PDF and Word files are made
// right here on the device (no extra download, nothing sent anywhere): a Word file is a small zip of
// XML, and a PDF of plain text needs only the standard Helvetica font every PDF reader has.
import { noteBlocks, noteHtml, noteText, templateOf, fmtClock, type NoteForExport } from "@shared/ariseNotes";

// ─── Files ────────────────────────────────────────────────────────────────────
export function download(name: string, bytes: Uint8Array | string | Blob, type: string) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export const fileName = (title: string, ext: string) => `${(title || "Arise Notes").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Arise Notes"}.${ext}`;

// ─── Zip (stored, no compression) for Word files ─────────────────────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b: Uint8Array): number { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true); lv.setUint32(14, crc, true); lv.setUint32(18, f.data.length, true); lv.setUint32(22, f.data.length, true);
    lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true); local.set(name, 30);
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true); cv.setUint32(20, f.data.length, true); cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); cd.set(name, 46);
    parts.push(local, f.data); central.push(cd);
    offset += local.length + f.data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}

// ─── Word (.docx) ─────────────────────────────────────────────────────────────
const xml = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (text: string, o: { bold?: boolean; size?: number; color?: string } = {}) =>
  `<w:r><w:rPr>${o.bold ? "<w:b/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}${o.size ? `<w:sz w:val="${o.size}"/>` : ""}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
const para = (runs: string, o: { after?: number; before?: number; indent?: boolean; shade?: string } = {}) =>
  `<w:p><w:pPr><w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 100}"/>${o.indent ? '<w:ind w:left="360" w:hanging="240"/>' : ""}${o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : ""}</w:pPr>${runs}</w:p>`;

export function noteDocx(n: NoteForExport, withTranscript = true): Uint8Array {
  const body: string[] = [];
  body.push(para(run(n.title || "Untitled note", { bold: true, size: 40 }), { after: 60 }));
  const meta = [new Date(n.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }), n.durationSecs ? fmtClock(n.durationSecs) : "", templateOf(n.template).label].filter(Boolean).join(" · ");
  body.push(para(run(meta, { size: 18, color: "6B6880" }), { after: 240 }));
  for (const b of noteBlocks(n, withTranscript)) {
    body.push(para(run(b.heading, { bold: true, size: 26, color: "3B2FA0" }), { before: 200, after: 80 }));
    if (b.draft) body.push(para(run("Draft for the teacher to review. Nothing was sent anywhere.", { size: 18, color: "9A6400" }), { shade: "FFF4DC" }));
    if (b.heading === "Summary") body.push(para(run(b.lines[0], { size: 22 })));
    else if (b.heading === "Transcript") for (const l of b.lines) body.push(para(run(l, { size: 19 }), { after: 60 }));
    else for (const l of b.lines) body.push(para(run(`•  ${l}`, { size: 22 }), { indent: true, after: 60 }));
  }
  body.push(para(run("Made with Arise Notes", { size: 16, color: "9A97AD" }), { before: 240 }));
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const enc = new TextEncoder();
  return zip([
    { name: "[Content_Types].xml", data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>') },
    { name: "_rels/.rels", data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>') },
    { name: "docProps/core.xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(n.title || "Arise Notes")}</dc:title><dc:creator>Arise Notes</dc:creator></cp:coreProperties>`) },
    { name: "word/document.xml", data: enc.encode(doc) },
  ]);
}

// ─── PDF (Helvetica, letters the standard PDF fonts have) ─────────────────────
// Widths of Helvetica and Helvetica-Bold (1/1000 of the font size), characters 32–126.
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const HELVB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
// Characters outside Latin-1 that the PDF's standard encoding (WinAnsi) still has.
const WINANSI: Record<string, number> = { "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159 };
const SPECIAL_W: Record<number, number> = { 133: 1000, 145: 222, 146: 222, 147: 333, 148: 333, 149: 350, 150: 556, 151: 1000, 128: 556, 153: 1000 };
const LATIN_BASE = "AAAAAAACEEEEIIIIDNOOOOOxOUUUUYPsaaaaaaaceeeeiiiidnooooo/ouuuuypy";
/** The byte the PDF uses for a character, or -1 when the standard fonts don't have it. */
function code(ch: string): number {
  const c = ch.codePointAt(0)!;
  if (c >= 32 && c <= 126) return c;
  if (c >= 160 && c <= 255) return c;
  return WINANSI[ch] ?? -1;
}
function width(text: string, bold: boolean, size: number) {
  const t = bold ? HELVB : HELV;
  let w = 0;
  for (const ch of text) {
    const c = code(ch);
    if (c >= 32 && c <= 126) w += t[c - 32];
    else if (c >= 192 && c <= 255) { const base = LATIN_BASE[c - 192]; w += /[a-zA-Z]/.test(base) ? t[base.charCodeAt(0) - 32] : 556; }
    else w += SPECIAL_W[c] ?? 556;
  }
  return (w * size) / 1000;
}
/** True when every letter can be shown with the standard PDF fonts (otherwise the browser's print is used). */
export const pdfCanShow = (text: string) => { for (const ch of text) { if (ch === "\n" || ch === "\t") continue; if (code(ch) < 0) return false; } return true; };
const pdfString = (s: string) => {
  let out = "";
  for (const ch of s) {
    const c = code(ch);
    if (c < 0) out += "?";
    else if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (c > 126) out += `\\${c.toString(8).padStart(3, "0")}`;
    else out += ch;
  }
  return `(${out})`;
};
function wrap(text: string, bold: boolean, size: number, max: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    let cur = "";
    for (const word of raw.split(/(\s+)/)) {
      if (!word) continue;
      const next = cur + word;
      if (width(next, bold, size) <= max || !cur.trim()) {
        // A single word longer than the line is broken where it must be.
        if (!cur.trim() && width(next, bold, size) > max) {
          let piece = "";
          for (const ch of next) { if (width(piece + ch, bold, size) > max && piece) { lines.push(piece); piece = ""; } piece += ch; }
          cur = piece;
        } else cur = next;
      } else { lines.push(cur.trimEnd()); cur = word.trimStart(); }
    }
    lines.push(cur.trimEnd());
  }
  return lines;
}

export function notePdf(n: NoteForExport, withTranscript = true): Uint8Array {
  const W = 612, H = 792, M = 54, maxW = W - M * 2;
  const pages: string[] = [];
  let ops: string[] = [];
  let y = H - M;
  const newPage = () => { if (ops.length) pages.push(ops.join("\n")); ops = []; y = H - M; };
  const text = (s: string, o: { bold?: boolean; size: number; color?: string; indent?: number; gap?: number; bullet?: boolean }) => {
    const lead = o.size * 1.35;
    const hang = o.bullet ? 12 : 0;
    const x = M + (o.indent ?? 0) + hang;
    wrap(s, !!o.bold, o.size, maxW - (o.indent ?? 0) - hang).forEach((line, i) => {
      if (y - lead < M + 20) newPage();
      y -= lead;
      if (o.bullet && i === 0) ops.push(`BT 0.42 0.33 0.86 rg /F2 ${o.size} Tf ${M + (o.indent ?? 0)} ${y.toFixed(2)} Td ${pdfString("•")} Tj ET`);
      ops.push(`BT ${o.color ?? "0.09 0.09 0.16"} rg /${o.bold ? "F2" : "F1"} ${o.size} Tf ${x} ${y.toFixed(2)} Td ${pdfString(line)} Tj ET`);
    });
    y -= o.gap ?? 0;
  };
  text(n.title || "Untitled note", { bold: true, size: 20, gap: 2 });
  const meta = [new Date(n.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }), n.durationSecs ? fmtClock(n.durationSecs) : "", templateOf(n.template).label].filter(Boolean).join(" · ");
  text(meta, { size: 9.5, color: "0.42 0.41 0.5", gap: 10 });
  for (const b of noteBlocks(n, withTranscript)) {
    if (y < M + 80) newPage();
    y -= 6;
    text(b.heading, { bold: true, size: 13, color: "0.23 0.18 0.63", gap: 3 });
    if (b.draft) text("Draft for the teacher to review. Nothing was sent anywhere.", { size: 9.5, color: "0.6 0.39 0", gap: 3 });
    if (b.heading === "Summary") text(b.lines[0], { size: 11, gap: 4 });
    else if (b.heading === "Transcript") for (const l of b.lines) text(l, { size: 9.5, gap: 1.5 });
    else for (const l of b.lines) text(l, { size: 10.5, indent: 4, gap: 2, bullet: true });
  }
  y -= 10;
  text("Made with Arise Notes", { size: 8.5, color: "0.6 0.59 0.68" });
  newPage();
  // Page numbers.
  pages.forEach((p, i) => { pages[i] = `${p}\nBT 0.6 0.59 0.68 rg /F1 8 Tf ${W - M - 60} 30 Td ${pdfString(`Page ${i + 1} of ${pages.length}`)} Tj ET`; });
  const objs: string[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  const kids: string[] = [];
  pages.forEach((content, i) => {
    const pageId = 5 + i * 2, contentId = 6 + i * 2;
    kids.push(`${pageId} 0 R`);
    objs[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objs[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  let out = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  for (let id = 1; id < objs.length; id++) { offsets[id] = out.length; out += `${id} 0 obj\n${objs[id]}\nendobj\n`; }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character above is one byte (the four after %PDF are written as Latin-1).
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

// ─── Print, copy, mail ───────────────────────────────────────────────────────
export function printNote(n: NoteForExport, withTranscript = true) {
  const w = window.open("", "_blank", "noopener=no");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${(n.title || "Arise Notes").replace(/</g, "&lt;")}</title><style>
    body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:#18172a;max-width:720px;margin:32px auto;padding:0 20px}
    h1{font-size:26px;margin:0 0 4px}h2{font-size:16px;color:#3b2fa0;margin:22px 0 6px}.meta{color:#6b6880;font-size:13px}.line{margin:2px 0;font-size:13px}
    .draft{background:#fff4dc;color:#7a4a04;padding:6px 10px;border-radius:8px;font-size:13px}ul{padding-left:20px}li{margin:3px 0}</style></head><body>${noteHtml(n, withTranscript)}</body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* the person can print from the window */ } }, 300);
  return true;
}
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
export const mailtoLink = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.length > 1800 ? `${body.slice(0, 1800)}…` : body)}`;
export { noteText };
