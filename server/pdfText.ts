// The words in a PDF, read with Node's own zlib: nothing to install. Handles what teachers usually
// upload (PDFs saved from Google Docs, Word, Chrome's "Save as PDF", test sites): compressed page
// streams, object streams, and fonts that map their codes to letters with a ToUnicode table.
// A scanned PDF (pictures of pages) has no words in it; the caller says so and asks for a photo.
import { inflateSync } from "node:zlib";

type Obj = { dict: string; stream?: Buffer };

const latin1 = (b: Buffer) => b.toString("latin1");

function inflate(raw: Buffer): Buffer | null {
  try { return inflateSync(raw); } catch { /* try without the last bytes, often a stray newline */ }
  try { return inflateSync(raw, { finishFlush: 2 /* Z_SYNC_FLUSH */ }); } catch { return null; }
}

function decodeStream(dict: string, raw: Buffer): Buffer | null {
  if (/\/FlateDecode|\/Fl\b/.test(dict)) return inflate(raw);
  if (/\/Filter/.test(dict)) return null; // images and other encodings: not text
  return raw;
}

/** Every object in the file by number, object streams opened up. */
function readObjects(pdf: Buffer): Map<number, Obj> {
  const text = latin1(pdf);
  const objs = new Map<number, Obj>();
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const num = Number(m[1]);
    const start = m.index + m[0].length;
    const end = text.indexOf("endobj", start);
    if (end < 0) break;
    const body = text.slice(start, end);
    const si = body.search(/\bstream\r?\n/);
    if (si >= 0) {
      const dict = body.slice(0, si);
      const dataStart = start + si + (body.slice(si).startsWith("stream\r\n") ? 8 : 7);
      const len = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
      let dataEnd = len ? dataStart + Number(len[1]) : -1;
      if (dataEnd < 0 || dataEnd > pdf.length || !text.slice(dataEnd, dataEnd + 20).includes("endstream")) dataEnd = text.indexOf("endstream", dataStart);
      const raw = pdf.subarray(dataStart, Math.max(dataStart, dataEnd));
      objs.set(num, { dict, stream: decodeStream(dict, raw) ?? undefined });
    } else objs.set(num, { dict: body });
    re.lastIndex = end;
  }
  // Object streams: many small objects (fonts, pages) packed into one compressed stream.
  for (const o of [...objs.values()]) {
    if (!/\/Type\s*\/ObjStm/.test(o.dict) || !o.stream) continue;
    const first = Number(/\/First\s+(\d+)/.exec(o.dict)?.[1] || 0);
    const s = latin1(o.stream);
    const nums = s.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const from = first + nums[i + 1], to = i + 3 < nums.length ? first + nums[i + 3] : s.length;
      if (!objs.has(nums[i])) objs.set(nums[i], { dict: s.slice(from, to) });
    }
  }
  return objs;
}

const ref = (s: string | undefined) => (s ? Number(/^\s*(\d+)\s+\d+\s+R/.exec(s)?.[1] ?? NaN) : NaN);

/** The value after /Key in a dictionary: a reference, or an inline << >> dictionary, as text. */
function entry(dict: string, key: string, objs: Map<number, Obj>): string {
  const i = dict.search(new RegExp(`/${key}(?![A-Za-z])`));
  if (i < 0) return "";
  const rest = dict.slice(i + key.length + 1).trimStart();
  if (rest.startsWith("<<")) {
    let depth = 0;
    for (let k = 0; k < rest.length - 1; k++) {
      if (rest[k] === "<" && rest[k + 1] === "<") { depth++; k++; }
      else if (rest[k] === ">" && rest[k + 1] === ">") { depth--; k++; if (!depth) return rest.slice(0, k + 1); }
    }
    return rest;
  }
  const n = ref(rest);
  return Number.isNaN(n) ? rest.split(/[\s/]/)[0] : objs.get(n)?.dict ?? "";
}

type CMap = { bytes: number; map: Map<number, string> };
const utf16 = (hex: string) => { let out = ""; for (let i = 0; i + 3 < hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16)); return hex.length === 2 ? String.fromCharCode(parseInt(hex, 16)) : out; };

function parseCMap(s: string): CMap {
  const map = new Map<number, string>();
  const cs = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(s);
  const bytes = cs ? Math.max(1, cs[1].length / 2) : 2;
  for (const block of s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(p[1], 16), utf16(p[2]));
  for (const block of s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16);
      if (hi - lo > 5000) continue;
      if (p[3].startsWith("[")) { const list = [...p[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => x[1]); for (let c = lo; c <= hi; c++) map.set(c, utf16(list[c - lo] || "")); }
      else { const base = p[3].slice(1, -1); const head = base.slice(0, -4), last = parseInt(base.slice(-4) || "0", 16); for (let c = lo; c <= hi; c++) map.set(c, utf16(head + (last + c - lo).toString(16).padStart(4, "0"))); }
    }
  }
  return { bytes, map };
}

/** A page's fonts: resource name → its ToUnicode table (or null: read the bytes as plain letters). */
function pageFonts(page: string, objs: Map<number, Obj>): Map<string, CMap | null> {
  let res = entry(page, "Resources", objs);
  let parent = page;
  for (let hop = 0; !res && hop < 10; hop++) { const p = objs.get(ref(/\/Parent\s+(\d+\s+\d+\s+R)/.exec(parent)?.[1]))?.dict; if (!p) break; res = entry(p, "Resources", objs); parent = p; }
  const fonts = new Map<string, CMap | null>();
  const fontDict = entry(res, "Font", objs);
  for (const f of fontDict.matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
    const font = objs.get(Number(f[2]))?.dict || "";
    const tu = objs.get(ref(/\/ToUnicode\s+(\d+\s+\d+\s+R)/.exec(font)?.[1]));
    fonts.set(f[1], tu?.stream ? parseCMap(latin1(tu.stream)) : /Identity-H/.test(font) ? { bytes: 2, map: new Map() } : null);
  }
  return fonts;
}

function decodeText(bytes: number[], cmap: CMap | null): string {
  if (!cmap) return String.fromCharCode(...bytes.map((b) => (b === 0x92 ? 0x2019 : b === 0x93 ? 0x201c : b === 0x94 ? 0x201d : b === 0x96 ? 0x2013 : b === 0x97 ? 0x2014 : b)));
  let out = "";
  for (let i = 0; i + cmap.bytes - 1 < bytes.length; i += cmap.bytes) {
    let code = 0;
    for (let k = 0; k < cmap.bytes; k++) code = code * 256 + bytes[i + k];
    out += cmap.map.get(code) ?? (cmap.map.size ? "" : String.fromCharCode(code));
  }
  return out;
}

/** The text drawn by one content stream, with line breaks where the text moves down. */
function streamText(s: string, fonts: Map<string, CMap | null>): string {
  let out = "", font: CMap | null = null, size = 12;
  // Where the current line is (moved by Tm and Td), and where the last words were drawn.
  let ly = 0, drawnY: number | null = null;
  const at = () => { if (drawnY !== null && Math.abs(ly - drawnY) > Math.max(1, size * 0.3)) nl(); drawnY = ly; };
  const stack: (number | string | number[][] | { str: number[] })[] = [];
  const nl = () => { if (out && !out.endsWith("\n")) out += "\n"; };
  let i = 0;
  const n = s.length;
  const readString = (): number[] => {
    const b: number[] = []; let depth = 1; i++;
    while (i < n && depth) {
      const c = s[i];
      if (c === "\\") {
        const d = s[++i];
        if (/[0-7]/.test(d)) { let o = d; while (o.length < 3 && /[0-7]/.test(s[i + 1])) o += s[++i]; b.push(parseInt(o, 8) & 255); }
        else if (d === "n") b.push(10); else if (d === "r") b.push(13); else if (d === "t") b.push(9);
        else if (d === "\r" || d === "\n") { if (d === "\r" && s[i + 1] === "\n") i++; }
        else b.push(d.charCodeAt(0));
        i++; continue;
      }
      if (c === "(") depth++;
      else if (c === ")") { depth--; if (!depth) { i++; break; } }
      b.push(c.charCodeAt(0) & 255); i++;
    }
    return b;
  };
  const readHex = (): number[] => { const end = s.indexOf(">", i); const hex = s.slice(i + 1, end).replace(/\s+/g, ""); i = end + 1; const b: number[] = []; for (let k = 0; k < hex.length; k += 2) b.push(parseInt((hex.slice(k, k + 2) + "0").slice(0, 2), 16)); return b; };
  while (i < n) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "%") { while (i < n && s[i] !== "\n" && s[i] !== "\r") i++; continue; }
    if (c === "(") { stack.push({ str: readString() }); continue; }
    if (c === "<" && s[i + 1] === "<") { let d = 0; while (i < n) { if (s.startsWith("<<", i)) { d++; i += 2; } else if (s.startsWith(">>", i)) { d--; i += 2; if (!d) break; } else i++; } continue; }
    if (c === "<") { stack.push({ str: readHex() }); continue; }
    if (c === "[") {
      const parts: number[][] = []; i++;
      while (i < n && s[i] !== "]") {
        if (s[i] === "(") parts.push(readString());
        else if (s[i] === "<") parts.push(readHex());
        else { const m = /^-?\d*\.?\d+/.exec(s.slice(i, i + 20)); if (m) { if (Number(m[0]) < -180) parts.push([-1]); i += m[0].length; } else i++; }
      }
      i++; stack.push(parts); continue;
    }
    if (c === "/") { const m = /^\/[^\s/<>\[\]()%{}]*/.exec(s.slice(i, i + 128))![0]; stack.push(m); i += m.length; continue; }
    const m = /^[^\s/<>\[\]()%{}]+/.exec(s.slice(i, i + 64));
    if (!m) { i++; continue; }
    const tok = m[0]; i += tok.length;
    if (/^[-+]?\d*\.?\d+$/.test(tok)) { stack.push(Number(tok)); continue; }
    const nums = () => stack.filter((x): x is number => typeof x === "number");
    switch (tok) {
      case "Tf": { const name = [...stack].reverse().find((x) => typeof x === "string") as string | undefined; font = name ? fonts.get(name.slice(1)) ?? null : null; const v = nums(); if (v.length) size = Math.abs(v[v.length - 1]) || size; break; }
      case "Tj": case "'": case "\"": { if (tok !== "Tj") { ly -= size; } at(); const t = stack[stack.length - 1]; if (t && typeof t === "object" && "str" in t) out += decodeText(t.str, font); break; }
      case "TJ": { at(); const arr = stack[stack.length - 1]; if (Array.isArray(arr)) for (const part of arr as number[][]) out += part.length === 1 && part[0] === -1 ? (out.endsWith(" ") ? "" : " ") : decodeText(part, font); break; }
      case "Td": case "TD": { const v = nums(); const ty = v[v.length - 1] || 0, tx = v[v.length - 2] || 0; ly += ty; if (Math.abs(ty) > 0.5) { /* a new line: at() breaks it when words are drawn */ } else if (tx > size && out && !/\s$/.test(out)) out += " "; break; }
      case "T*": ly -= size; break;
      case "Tm": { const v = nums(); ly = v[v.length - 1] || 0; break; }
      case "ET": if (out && !/\s$/.test(out)) out += " "; break;
      case "BI": { const e = s.indexOf("EI", i); i = e < 0 ? n : e + 2; break; }
    }
    stack.length = 0;
  }
  return out;
}

/** The words in a PDF, page by page, or "" when it has none (a scan). */
export function pdfToText(pdf: Buffer, maxChars = 40_000): string {
  const objs = readObjects(pdf);
  const pages = [...objs.entries()].filter(([, o]) => /\/Type\s*\/Page(?!s)/.test(o.dict)).sort((a, b) => a[0] - b[0]);
  // Pages in reading order: follow the page tree when it's there.
  const ordered: string[] = [];
  const root = [...objs.values()].find((o) => /\/Type\s*\/Catalog/.test(o.dict));
  const walk = (num: number, depth: number) => {
    const o = objs.get(num); if (!o || depth > 30) return;
    if (/\/Type\s*\/Pages/.test(o.dict)) for (const k of (/\/Kids\s*\[([^\]]*)\]/.exec(o.dict)?.[1] || "").matchAll(/(\d+)\s+\d+\s+R/g)) walk(Number(k[1]), depth + 1);
    else if (/\/Type\s*\/Page/.test(o.dict)) ordered.push(o.dict);
  };
  if (root) walk(ref(/\/Pages\s+(\d+\s+\d+\s+R)/.exec(root.dict)?.[1]), 0);
  const list = ordered.length ? ordered : pages.map(([, o]) => o.dict);
  const out: string[] = [];
  let used = 0;
  for (const [k, page] of list.entries()) {
    if (used > maxChars) break;
    const fonts = pageFonts(page, objs);
    const contents = /\/Contents\s*\[([^\]]*)\]/.exec(page)?.[1] ?? /\/Contents\s+(\d+\s+\d+\s+R)/.exec(page)?.[1] ?? "";
    const parts = [...contents.matchAll(/(\d+)\s+\d+\s+R/g)].map((r) => objs.get(Number(r[1]))?.stream).filter((b): b is Buffer => !!b);
    const text = streamText(parts.map(latin1).join("\n"), fonts).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text) { const block = list.length > 1 ? `Page ${k + 1}:\n${text}` : text; out.push(block); used += block.length + 2; }
  }
  return out.join("\n\n").slice(0, maxChars).trim();
}
