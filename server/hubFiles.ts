// Reads the text out of files a teacher uploads to Arise WorkHub: Excel (.xlsx),
// Word (.docx), and plain text files. Both Office formats are ZIP files of XML,
// so they are read here with Node's own zlib and nothing has to be installed.
import { inflateRawSync } from "node:zlib";

/** The most one unpacked part of a file may be. Stops a tiny upload from unpacking into gigabytes. */
const MAX_PART_BYTES = 12_000_000;
const MAX_PARTS = 2_000;
/** Sheets read from one workbook, and the most that may be unpacked from it in all. A tiny file can name the same big sheet thousands of times. */
const MAX_SHEETS = 40;
const MAX_TOTAL_BYTES = 40_000_000;

export class HubFileError extends Error {}

/** The files inside a ZIP, by name. Each one is unpacked only when asked for. */
export function readZip(file: Buffer): Map<string, () => Buffer> {
  // The list of files sits at the end, after a marker ("PK\x05\x06") and before an optional comment.
  let end = -1;
  for (let i = file.length - 22; i >= Math.max(0, file.length - 22 - 65_535); i--) {
    if (file.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new HubFileError("That file could not be opened. It may be damaged, or saved in an old format.");
  const count = file.readUInt16LE(end + 10);
  let at = file.readUInt32LE(end + 16);
  if (count > MAX_PARTS) throw new HubFileError("That file has too many parts to read.");
  const parts = new Map<string, () => Buffer>();
  for (let n = 0; n < count; n++) {
    if (at + 46 > file.length || file.readUInt32LE(at) !== 0x02014b50) throw new HubFileError("That file could not be opened. It may be damaged.");
    const method = file.readUInt16LE(at + 10);
    const packed = file.readUInt32LE(at + 20);
    const size = file.readUInt32LE(at + 24);
    const nameLength = file.readUInt16LE(at + 28), extraLength = file.readUInt16LE(at + 30), commentLength = file.readUInt16LE(at + 32);
    const header = file.readUInt32LE(at + 42);
    const name = file.toString("utf8", at + 46, at + 46 + nameLength);
    at += 46 + nameLength + extraLength + commentLength;
    parts.set(name, () => {
      if (size > MAX_PART_BYTES) throw new HubFileError("That file is too large to read.");
      if (header + 30 > file.length || file.readUInt32LE(header) !== 0x04034b50) throw new HubFileError("That file could not be opened. It may be damaged.");
      const start = header + 30 + file.readUInt16LE(header + 26) + file.readUInt16LE(header + 28);
      const data = file.subarray(start, start + packed);
      if (method === 0) return Buffer.from(data);
      if (method !== 8) throw new HubFileError("That file is packed in a way this page cannot read.");
      try {
        return inflateRawSync(data, { maxOutputLength: MAX_PART_BYTES });
      } catch {
        throw new HubFileError("That file could not be opened. It may be damaged or too large.");
      }
    });
  }
  return parts;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/** The text of every `<t>` inside a piece of spreadsheet XML (a shared string can be several runs). */
const runs = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");

/** Number formats that show a number as a date. 14 to 22 and 45 to 47 are Excel's built-in date and time formats. */
function dateStyles(stylesXml: string): Set<number> {
  const custom = new Map<number, string>();
  for (const m of stylesXml.matchAll(/<numFmt\s[^>]*>/g)) custom.set(Number(attr(m[0], "numFmtId")), decodeXml(attr(m[0], "formatCode") || ""));
  const looksLikeDate = (id: number) => {
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true;
    const code = (custom.get(id) || "").replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
    return /[dmyhs]/i.test(code) && !/[0#]/.test(code.replace(/s+\.0+/gi, ""));
  };
  const cellXfs = /<cellXfs[\s\S]*?<\/cellXfs>/.exec(stylesXml)?.[0] || "";
  const styles = new Set<number>();
  [...cellXfs.matchAll(/<xf\s[^>]*>/g)].forEach((m, index) => { if (looksLikeDate(Number(attr(m[0], "numFmtId") || 0))) styles.add(index); });
  return styles;
}

/** Excel counts days from the end of 1899. 46301 is 2026-10-06; a fraction is a time of day. */
export function excelDate(serial: number, date1904 = false): string {
  if (!Number.isFinite(serial) || serial < 0 || serial > 2_958_465) return String(serial);
  const ms = Math.round((serial + (date1904 ? 1462 : 0) - 25569) * 86_400_000);
  const d = new Date(ms);
  const day = d.toISOString().slice(0, 10), clock = d.toISOString().slice(11, 16);
  if (serial < 1) return clock;
  return serial % 1 === 0 || clock === "00:00" ? day : `${day} ${clock}`;
}

const columnIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/gi, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** An Excel workbook as plain text: each sheet's name, then its rows with a tab between cells. */
export function xlsxToText(file: Buffer, maxChars = 40_000): string {
  const zip = readZip(file);
  // Each part is unpacked once, however many times it is asked for.
  const unpacked = new Map<string, string>();
  let total = 0;
  const part = (name: string) => {
    const known = unpacked.get(name);
    if (known !== undefined) return known;
    const open = zip.get(name);
    if (!open) return "";
    const data = open();
    total += data.length;
    if (total > MAX_TOTAL_BYTES) throw new HubFileError("That file is too large to read.");
    const text = data.toString("utf8");
    unpacked.set(name, text);
    return text;
  };
  const workbook = part("xl/workbook.xml");
  if (!workbook) throw new HubFileError("That does not look like an Excel file. Save it as .xlsx and try again.");
  const shared = [...part("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => runs(m[1] || ""));
  const dates = dateStyles(part("xl/styles.xml"));
  const date1904 = /<workbookPr[^>]*\sdate1904="(1|true)"/.test(workbook);
  const targets = new Map<string, string>();
  for (const m of part("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\s[^>]*>/g)) {
    targets.set(attr(m[0], "Id") || "", (attr(m[0], "Target") || "").replace(/^\/?(xl\/)?/, "xl/"));
  }
  const out: string[] = [];
  let used = 0;
  /** The rows of one worksheet part. Two sheets that name the same part read it once. */
  const read = new Map<string, string[]>();
  const rowsOf = (partName: string, xml: string): string[] => {
    const known = read.get(partName);
    if (known) return known;
    const rows: string[] = [];
    read.set(partName, rows);
    let rowChars = 0;
    for (const row of xml.matchAll(/<row[\s>][\s\S]*?<\/row>/g)) {
      const cells: string[] = [];
      for (const cell of row[0].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const tag = " " + cell[1], body = cell[2] || "";
        const type = attr(tag, "t"), raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
        let value = "";
        if (type === "s") value = shared[Number(raw)] ?? "";
        else if (type === "inlineStr") value = runs(body);
        else if (type === "b") value = raw === "1" ? "TRUE" : "FALSE";
        else if (type === "str" || type === "e") value = decodeXml(raw);
        else if (raw !== "") value = dates.has(Number(attr(tag, "s") || -1)) ? excelDate(Number(raw), date1904) : String(Number(raw));
        const column = columnIndex(attr(tag, "r") || "");
        const at = column >= 0 && column < 200 ? column : cells.length;
        while (cells.length < at) cells.push("");
        cells[at] = value.replace(/\s+/g, " ").trim();
      }
      const line = cells.join("\t").replace(/\t+$/, "");
      if (line.trim()) { rows.push(line); rowChars += line.length + 1; }
      // More than can be used: no need to read the rest of a huge sheet.
      if (rowChars > maxChars) break;
    }
    return rows;
  };
  const sheets = [...workbook.matchAll(/<sheet\s[^>]*>/g)].slice(0, MAX_SHEETS);
  for (const [index, sheet] of sheets.entries()) {
    if (attr(sheet[0], "state") === "hidden" || attr(sheet[0], "state") === "veryHidden") continue;
    const partName = targets.get(attr(sheet[0], "r:id") || "") || `xl/worksheets/sheet${index + 1}.xml`;
    const xml = part(partName);
    if (!xml) continue;
    const rows = rowsOf(partName, xml);
    if (!rows.length) continue;
    const block = `Sheet: ${decodeXml(attr(sheet[0], "name") || `Sheet ${index + 1}`)}\n${rows.join("\n")}`;
    if (used + block.length > maxChars) { out.push(block.slice(0, Math.max(0, maxChars - used))); used = maxChars; break; }
    out.push(block);
    used += block.length + 2;
  }
  return out.join("\n\n").trim();
}

/** A Word document as plain text: one line per paragraph, a tab between table cells. */
export function docxToText(file: Buffer, maxChars = 40_000): string {
  const xml = readZip(file).get("word/document.xml")?.().toString("utf8");
  if (!xml) throw new HubFileError("That does not look like a Word file. Save it as .docx and try again.");
  // Only what sits inside <w:t> is text. Paragraphs, table rows and line breaks become new lines; tabs and table cells become tabs.
  // A text box is stored twice (once as a fallback picture of itself); the fallback copy is dropped.
  let kept = "";
  const pieces = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<\/w:tc>|<w:(?:br|cr)(?:\s[^>]*)?\/>|<\/w:(?:p|tr)>/g;
  // The last paragraph of a table cell ends the cell, not a line, so a table row stays on one line.
  const tidy = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, "").replace(/<\/w:p>\s*<\/w:tc>/g, "</w:tc>");
  for (const m of tidy.matchAll(pieces)) {
    if (m[1] !== undefined) kept += decodeXml(m[1]);
    else kept += m[0] === "<w:tab/>" || m[0] === "</w:tc>" ? "\t" : "\n";
    if (kept.length > maxChars * 2) break;
  }
  return kept.split("\n").map((line) => line.replace(/[ \t]+$/g, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxChars);
}

export type HubUpload = { name: string; data: Buffer };
export type HubFileKind = "text" | "calendar" | "pdf" | "image";

const extension = (name: string) => /\.([a-z0-9]+)$/i.exec(name.trim())?.[1].toLowerCase() || "";

/** What an uploaded file is, by its name. Throws, with words for the teacher, when it is a kind this page cannot read. */
export function hubFileKind(name: string): HubFileKind {
  const ext = extension(name);
  if (["xlsx", "xlsm", "docx", "csv", "tsv", "txt", "md", "text"].includes(ext)) return "text";
  if (ext === "ics" || ext === "ical" || ext === "ifb") return "calendar";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  if (ext === "xls" || ext === "doc") throw new HubFileError(`That is an older ${ext === "xls" ? "Excel" : "Word"} file. Open it and use Save As to save it as .${ext}x, or copy and paste what is in it.`);
  if (ext === "numbers" || ext === "pages") throw new HubFileError("Apple Numbers and Pages files can't be read here. Export it as Excel, Word or PDF, or copy and paste what is in it.");
  throw new HubFileError("That kind of file can't be read here. Use Excel (.xlsx), Word (.docx), PDF, CSV, a text file, a calendar file (.ics) or a photo.");
}

/** The text inside an uploaded Excel, Word, CSV or text file. */
export function hubFileText(upload: HubUpload, maxChars = 40_000): string {
  const ext = extension(upload.name);
  if (ext === "xlsx" || ext === "xlsm") return xlsxToText(upload.data, maxChars);
  if (ext === "docx") return docxToText(upload.data, maxChars);
  // Text files: drop a byte-order mark and anything that is not text.
  const textValue = upload.data.toString("utf8").replace(/^﻿/, "");
  if (/\u0000/.test(textValue.slice(0, 2000))) throw new HubFileError("That file is not plain text. Save it as .csv or .txt and try again.");
  return textValue.slice(0, maxChars).trim();
}
