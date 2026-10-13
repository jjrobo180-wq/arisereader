// Arise Sheets: what a workbook is and the things you can do to one.
//
// A workbook has sheets; a sheet has cells (what was typed, how it looks, a note), column widths and
// row heights, frozen rows/columns, merged cells, conditional formatting, dropdown lists, a filter,
// hidden rows/columns and charts. Every change returns a new workbook (nothing is changed in place),
// which is what makes undo and saving simple.
import {
  E, adjustForInsert, colName, compare, evalFormula, formatCode, isErr, looksLikeDate, looksLikeTime, parseAddr, parseNumberText, parseRangeAddr,
  renameSheetRefs, shiftFormula, text, type EvalCtx, type Scalar,
} from "./formula";

export type Borders = { t?: string; r?: string; b?: string; l?: string };
export type CellStyle = {
  b?: boolean; i?: boolean; u?: boolean; s?: boolean;
  /** Font family, size (pt), text colour, fill colour. */
  f?: string; z?: number; c?: string; bg?: string;
  h?: "left" | "center" | "right"; v?: "top" | "middle" | "bottom"; w?: boolean;
  /** Number format: an Excel-style code ("0.00", "$#,##0.00", "0%", "m/d/yyyy"), "@" for text, or "checkbox". */
  nf?: string;
  bd?: Borders;
  /** Rotate text (degrees: 0, 45, 90, -90). */
  rot?: number;
  /** Indent level. */
  ind?: number;
};
export type Cell = { v: string; s?: CellStyle; n?: string; /** A link the cell opens. */ link?: string };
export type Merge = { r1: number; c1: number; r2: number; c2: number };
export type CondRule = {
  id: string;
  range: string;
  kind: "gt" | "lt" | "ge" | "le" | "eq" | "ne" | "between" | "contains" | "notContains" | "empty" | "notEmpty" | "dup" | "top" | "bottom" | "aboveAvg" | "belowAvg" | "scale" | "bars" | "formula";
  a?: string; b?: string;
  style?: CellStyle;
  /** For a colour scale: low and high colours (and an optional middle). */
  min?: string; mid?: string; max?: string;
};
export type Validation = { id: string; range: string; kind: "list" | "number" | "date" | "checkbox"; list?: string[]; min?: number; max?: number; strict?: boolean; help?: string };
export type ChartKind = "column" | "bar" | "line" | "area" | "pie" | "doughnut" | "scatter";
export type Chart = { id: string; kind: ChartKind; range: string; title: string; x: number; y: number; w: number; h: number; headers: boolean; legend: boolean; stacked?: boolean; colors?: string[] };
export type Filter = { r1: number; c1: number; c2: number; r2: number; hide: Record<number, string[]>; sort?: { c: number; dir: 1 | -1 } };
export type Sheet = {
  id: string; name: string; color?: string;
  rows: number; cols: number;
  cells: Record<string, Cell>;
  colW: Record<number, number>; rowH: Record<number, number>;
  hiddenRows: number[]; hiddenCols: number[];
  freezeR: number; freezeC: number;
  merges: Merge[];
  cond: CondRule[];
  valid: Validation[];
  filter?: Filter;
  charts: Chart[];
  grid: boolean;
  /** Protect: the sheet can't be changed until unprotected. */
  locked?: boolean;
};
export type Workbook = { v: 1; sheets: Sheet[]; active: number; theme?: string };

export const DEFAULT_COL_W = 100, DEFAULT_ROW_H = 24, MIN_ROWS = 100, MIN_COLS = 26, MAX_ROWS = 20000, MAX_COLS = 200;
export const key = (r: number, c: number) => `${r}:${c}`;
export const unkey = (k: string) => { const [r, c] = k.split(":").map(Number); return { r, c }; };

export const FONTS = ["Arial", "Calibri", "Roboto", "Inter", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New", "Comic Sans MS", "Lexend", "Montserrat", "Merriweather", "Playfair Display", "Open Sans", "Lato"] as const;
export const SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72] as const;
export const NUMBER_FORMATS: { id: string; label: string; code: string; sample: string }[] = [
  { id: "general", label: "Automatic", code: "", sample: "1000.12" },
  { id: "text", label: "Plain text", code: "@", sample: "1000.12" },
  { id: "number", label: "Number", code: "#,##0.00", sample: "1,000.12" },
  { id: "integer", label: "Whole number", code: "#,##0", sample: "1,000" },
  { id: "percent", label: "Percent", code: "0.00%", sample: "10.12%" },
  { id: "percent0", label: "Percent (whole)", code: "0%", sample: "10%" },
  { id: "scientific", label: "Scientific", code: "0.00E+00", sample: "1.01E+03" },
  { id: "currency", label: "Currency", code: "$#,##0.00", sample: "$1,000.12" },
  { id: "currency0", label: "Currency (rounded)", code: "$#,##0", sample: "$1,000" },
  { id: "accounting", label: "Accounting", code: "$#,##0.00;($#,##0.00)", sample: "($1,000.12)" },
  { id: "date", label: "Date", code: "m/d/yyyy", sample: "9/26/2026" },
  { id: "dateLong", label: "Long date", code: "dddd, mmmm d, yyyy", sample: "Saturday, September 26, 2026" },
  { id: "dateShort", label: "Day and month", code: "mmm d", sample: "Sep 26" },
  { id: "time", label: "Time", code: "h:mm AM/PM", sample: "3:59 PM" },
  { id: "datetime", label: "Date and time", code: "m/d/yyyy h:mm AM/PM", sample: "9/26/2026 3:59 PM" },
  { id: "duration", label: "Duration", code: "h:mm:ss", sample: "24:01:00" },
  { id: "checkbox", label: "Checkbox", code: "checkbox", sample: "☑" },
];

export const THEMES: Record<string, { header: string; band: string; accent: string }> = {
  classic: { header: "#f1f5f9", band: "#ffffff", accent: "#0f766e" },
  ocean: { header: "#dbeafe", band: "#f8fbff", accent: "#1d4ed8" },
  forest: { header: "#dcfce7", band: "#f7fdf9", accent: "#15803d" },
  sunset: { header: "#ffedd5", band: "#fffaf5", accent: "#c2410c" },
  grape: { header: "#ede9fe", band: "#fbfaff", accent: "#6d28d9" },
  slate: { header: "#e2e8f0", band: "#f8fafc", accent: "#334155" },
};

// ─── Making and cleaning ────────────────────────────────────────────────────

let seq = 0;
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function blankSheet(name = "Sheet1"): Sheet {
  return { id: newId(), name, rows: MIN_ROWS, cols: MIN_COLS, cells: {}, colW: {}, rowH: {}, hiddenRows: [], hiddenCols: [], freezeR: 0, freezeC: 0, merges: [], cond: [], valid: [], charts: [], grid: true };
}
export const blankWorkbook = (): Workbook => ({ v: 1, sheets: [blankSheet()], active: 0 });

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v) : "");
const color = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v) ? v : undefined);
const int = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

function cleanStyle(s: any): CellStyle | undefined {
  if (!s || typeof s !== "object") return undefined;
  const out: CellStyle = {};
  for (const k of ["b", "i", "u", "s", "w"] as const) if (s[k]) out[k] = true;
  if (typeof s.f === "string" && s.f.length <= 60) out.f = s.f;
  if (Number.isFinite(Number(s.z)) && s.z) out.z = int(s.z, 4, 200, 11);
  if (color(s.c)) out.c = s.c;
  if (color(s.bg)) out.bg = s.bg;
  if (["left", "center", "right"].includes(s.h)) out.h = s.h;
  if (["top", "middle", "bottom"].includes(s.v)) out.v = s.v;
  if (typeof s.nf === "string" && s.nf.length <= 60) out.nf = s.nf;
  if (s.bd && typeof s.bd === "object") { const bd: Borders = {}; for (const k of ["t", "r", "b", "l"] as const) if (color(s.bd[k])) bd[k] = s.bd[k]; if (Object.keys(bd).length) out.bd = bd; }
  if (s.rot) out.rot = int(s.rot, -90, 90, 0);
  if (s.ind) out.ind = int(s.ind, 0, 10, 0);
  return Object.keys(out).length ? out : undefined;
}

export function cleanWorkbook(raw: any): Workbook {
  // Files made by the first, simpler Office editor stored { tabs: [{ name, cells: string[][] }] }.
  if (raw && typeof raw === "object" && !Array.isArray(raw.sheets) && Array.isArray(raw.tabs)) {
    raw = { v: 1, active: 0, sheets: raw.tabs.map((t: any) => {
      const cells: Record<string, Cell> = {};
      (Array.isArray(t?.cells) ? t.cells : []).forEach((row: unknown, r: number) => { if (Array.isArray(row)) row.forEach((v, c) => { if (typeof v === "string" && v) cells[key(r, c)] = { v }; }); });
      return { name: t?.name, cells };
    }) };
  }
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.sheets) || !raw.sheets.length) return blankWorkbook();
  const sheets: Sheet[] = [];
  const names = new Set<string>();
  for (const s of raw.sheets.slice(0, 60)) {
    if (!s || typeof s !== "object") continue;
    let name = str(s.name, 60).trim() || `Sheet${sheets.length + 1}`;
    while (names.has(name.toLowerCase())) name += " (2)";
    names.add(name.toLowerCase());
    const cells: Record<string, Cell> = {};
    let count = 0, maxR = 0, maxC = 0;
    for (const [k, c] of Object.entries(s.cells && typeof s.cells === "object" ? s.cells : {})) {
      if (!/^\d{1,5}:\d{1,3}$/.test(k) || !c || typeof c !== "object") continue;
      const { r, c: col } = unkey(k);
      if (r >= MAX_ROWS || col >= MAX_COLS) continue;
      const cell: Cell = { v: str((c as any).v, 50000) };
      const st = cleanStyle((c as any).s); if (st) cell.s = st;
      if (str((c as any).n, 2000)) cell.n = str((c as any).n, 2000);
      if (/^https?:\/\//.test(str((c as any).link, 2000))) cell.link = str((c as any).link, 2000);
      if (!cell.v && !cell.s && !cell.n) continue;
      cells[k] = cell; maxR = Math.max(maxR, r); maxC = Math.max(maxC, col);
      if (++count > 400_000) break;
    }
    const nums = (o: any, max: number) => { const out: Record<number, number> = {}; for (const [k, v] of Object.entries(o && typeof o === "object" ? o : {})) { const i = Number(k); if (Number.isInteger(i) && i >= 0 && i < max) out[i] = int(v, 2, 2000, 0); } return out; };
    const list = (v: any, max: number) => (Array.isArray(v) ? [...new Set(v.map(Number).filter((x: number) => Number.isInteger(x) && x >= 0 && x < max))] as number[] : []);
    sheets.push({
      id: str(s.id, 40) || newId(), name, ...(color(s.color) ? { color: s.color } : {}),
      rows: int(s.rows, MIN_ROWS, MAX_ROWS, MIN_ROWS) < maxR + 1 ? Math.min(MAX_ROWS, maxR + 20) : int(s.rows, MIN_ROWS, MAX_ROWS, MIN_ROWS),
      cols: int(s.cols, MIN_COLS, MAX_COLS, MIN_COLS) < maxC + 1 ? Math.min(MAX_COLS, maxC + 5) : int(s.cols, MIN_COLS, MAX_COLS, MIN_COLS),
      cells, colW: nums(s.colW, MAX_COLS), rowH: nums(s.rowH, MAX_ROWS), hiddenRows: list(s.hiddenRows, MAX_ROWS), hiddenCols: list(s.hiddenCols, MAX_COLS),
      freezeR: int(s.freezeR, 0, 50, 0), freezeC: int(s.freezeC, 0, 20, 0),
      merges: (Array.isArray(s.merges) ? s.merges : []).slice(0, 2000).map((m: any) => ({ r1: int(m?.r1, 0, MAX_ROWS, 0), c1: int(m?.c1, 0, MAX_COLS, 0), r2: int(m?.r2, 0, MAX_ROWS, 0), c2: int(m?.c2, 0, MAX_COLS, 0) })).filter((m: Merge) => m.r2 >= m.r1 && m.c2 >= m.c1 && (m.r2 > m.r1 || m.c2 > m.c1)),
      cond: (Array.isArray(s.cond) ? s.cond : []).slice(0, 100).filter((r: any) => r && typeof r.range === "string" && parseRangeAddr(r.range)).map((r: any) => ({ id: str(r.id, 40) || newId(), range: str(r.range, 40), kind: r.kind, ...(r.a !== undefined ? { a: str(r.a, 300) } : {}), ...(r.b !== undefined ? { b: str(r.b, 300) } : {}), ...(cleanStyle(r.style) ? { style: cleanStyle(r.style) } : {}), ...(color(r.min) ? { min: r.min } : {}), ...(color(r.mid) ? { mid: r.mid } : {}), ...(color(r.max) ? { max: r.max } : {}) })),
      valid: (Array.isArray(s.valid) ? s.valid : []).slice(0, 200).filter((r: any) => r && typeof r.range === "string" && parseRangeAddr(r.range)).map((r: any) => ({ id: str(r.id, 40) || newId(), range: str(r.range, 40), kind: ["list", "number", "date", "checkbox"].includes(r.kind) ? r.kind : "list", ...(Array.isArray(r.list) ? { list: r.list.slice(0, 200).map((x: unknown) => str(x, 200)) } : {}), ...(Number.isFinite(r.min) ? { min: r.min } : {}), ...(Number.isFinite(r.max) ? { max: r.max } : {}), ...(r.strict ? { strict: true } : {}), ...(str(r.help, 300) ? { help: str(r.help, 300) } : {}) })),
      ...(s.filter && typeof s.filter === "object" ? { filter: { r1: int(s.filter.r1, 0, MAX_ROWS, 0), c1: int(s.filter.c1, 0, MAX_COLS, 0), c2: int(s.filter.c2, 0, MAX_COLS, 0), r2: int(s.filter.r2, 0, MAX_ROWS, 0), hide: Object.fromEntries(Object.entries(s.filter.hide || {}).filter(([k, v]) => /^\d+$/.test(k) && Array.isArray(v)).map(([k, v]) => [Number(k), (v as unknown[]).map((x) => str(x, 300))])), ...(s.filter.sort ? { sort: { c: int(s.filter.sort.c, 0, MAX_COLS, 0), dir: s.filter.sort.dir === -1 ? -1 : 1 } } : {}) } as Filter } : {}),
      charts: (Array.isArray(s.charts) ? s.charts : []).slice(0, 30).filter((c: any) => c && parseRangeAddr(String(c.range || "").replace(/^.*!/, ""))).map((c: any) => ({ id: str(c.id, 40) || newId(), kind: ["column", "bar", "line", "area", "pie", "doughnut", "scatter"].includes(c.kind) ? c.kind : "column", range: str(c.range, 60), title: str(c.title, 120), x: int(c.x, 0, 100000, 40), y: int(c.y, 0, 400000, 40), w: int(c.w, 160, 2000, 480), h: int(c.h, 120, 1500, 300), headers: c.headers !== false, legend: c.legend !== false, ...(c.stacked ? { stacked: true } : {}) })),
      grid: s.grid !== false, ...(s.locked ? { locked: true } : {}),
    });
  }
  if (!sheets.length) return blankWorkbook();
  return { v: 1, sheets, active: int(raw.active, 0, sheets.length - 1, 0), ...(typeof raw.theme === "string" && THEMES[raw.theme] ? { theme: raw.theme } : {}) };
}

// ─── Reading values ─────────────────────────────────────────────────────────

/** What a typed value is, before any formula is worked out. */
export function literal(raw: string, st?: CellStyle): Scalar {
  if (raw === "") return null;
  if (st?.nf === "@") return raw;
  // A leading apostrophe keeps what follows as text, as in Excel ('007, '1/2).
  if (raw.startsWith("'")) return raw.slice(1);
  if (/^(true|false)$/i.test(raw)) return /^true$/i.test(raw);
  const n = parseNumberText(raw);
  return n === null ? raw : n;
}

/**
 * Works out every formula on demand and remembers the answers until the workbook changes.
 * A formula that ends up reading itself shows #CYCLE! instead of hanging.
 */
export class Calc {
  private memo = new Map<string, Scalar>();
  private busy = new Set<string>();
  private byName = new Map<string, number>();
  constructor(public wb: Workbook, private now = new Date()) { wb.sheets.forEach((s, i) => this.byName.set(s.name.toLowerCase(), i)); }
  sheetIndex(name: string | undefined, from: number): number { return name === undefined ? from : this.byName.get(name.toLowerCase()) ?? -1; }
  value(si: number, r: number, c: number): Scalar {
    const sh = this.wb.sheets[si];
    if (!sh) return E.REF;
    const cell = sh.cells[key(r, c)];
    if (!cell || cell.v === "") return null;
    if (!cell.v.startsWith("=") || cell.v.length < 2 || cell.s?.nf === "@") return literal(cell.v, cell.s);
    const k = `${si}:${r}:${c}`;
    if (this.memo.has(k)) return this.memo.get(k)!;
    if (this.busy.has(k)) return E.CYCLE;
    this.busy.add(k);
    let seed = (r * 7919 + c * 104729 + si * 31) % 2147483647;
    const ctx: EvalCtx = {
      cell: (sheet, rr, cc) => { const idx = this.sheetIndex(sheet, si); return idx < 0 ? E.REF : this.value(idx, rr, cc); },
      bounds: (sheet) => { const idx = this.sheetIndex(sheet, si); const s2 = this.wb.sheets[idx]; return s2 ? usedBounds(s2) : null; },
      here: { r, c }, now: this.now,
      rand: () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; },
    };
    let v: Scalar;
    try { v = evalFormula(cell.v, ctx); } catch { v = E.VALUE; }
    this.busy.delete(k);
    this.memo.set(k, v);
    return v;
  }
}

/** How much of a sheet is used, plus a little room. */
export function usedBounds(s: Sheet): { rows: number; cols: number } {
  let r = 0, c = 0;
  for (const k in s.cells) { const p = unkey(k); if (p.r >= r) r = p.r + 1; if (p.c >= c) c = p.c + 1; }
  return { rows: Math.max(r, 1), cols: Math.max(c, 1) };
}

/** A value as it shows in its cell, with its number format. */
export function display(v: Scalar, st?: CellStyle, raw = ""): string {
  if (v === null) return "";
  if (isErr(v)) return v.err;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v;
  const nf = st?.nf || autoFormat(raw);
  if (!nf || nf === "@") {
    if (Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-9 && v !== 0)) return v.toExponential(4).toUpperCase();
    return Number(v.toPrecision(11)).toString();
  }
  if (nf === "checkbox") return v ? "TRUE" : "FALSE";
  return formatCode(v, nf);
}

/** The format implied by how something was typed: 10/13/2026 is a date, $5 is money, 25% a percent. */
export function autoFormat(raw: string): string {
  const t = raw.trim();
  if (!t || t.startsWith("=")) return "";
  if (looksLikeDate(t)) return /\d{1,2}:\d{2}/.test(t) ? "m/d/yyyy h:mm AM/PM" : "m/d/yyyy";
  if (looksLikeTime(t)) return "h:mm AM/PM";
  if (/^-?\(?\$/.test(t)) return /\.\d/.test(t) ? "$#,##0.00" : "$#,##0";
  if (/%$/.test(t)) return /\.\d+%$/.test(t) ? "0.00%" : "0%";
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return /\./.test(t) ? "#,##0.00" : "#,##0";
  return "";
}

/** A formula's result picks up a format from what it reads: =A1+A2 on two dates is a date, on money it is money. */
export function formulaFormat(sheet: Sheet, raw: string): string {
  if (!raw.startsWith("=")) return "";
  if (/^=\s*(TODAY|NOW|DATE|EDATE|EOMONTH|WORKDAY)\(/i.test(raw)) return /^=\s*NOW/i.test(raw) ? "m/d/yyyy h:mm AM/PM" : "m/d/yyyy";
  if (/^=\s*(SUM|AVERAGE|MIN|MAX|MEDIAN)\(/i.test(raw) || /^=\s*\$?[A-Z]+\$?\d+\s*[-+*/]/i.test(raw)) {
    const m = /(\$?[A-Z]{1,3}\$?\d{1,7})/i.exec(raw.slice(1));
    const a = m ? parseAddr(m[1].replace(/\$/g, "")) : null;
    if (a) { const src = sheet.cells[key(a.r, a.c)]; const nf = src?.s?.nf || autoFormat(src?.v || ""); if (nf && nf !== "@" && nf !== "checkbox" && !(/^=\s*[A-Z]+\d+\s*-\s*[A-Z]+\d+/i.test(raw) && /y/.test(nf))) return nf; }
  }
  return "";
}

export const isNumberLike = (v: Scalar) => typeof v === "number";

// ─── Ranges ─────────────────────────────────────────────────────────────────

export type Range = { r1: number; c1: number; r2: number; c2: number };
export const norm = (a: { r: number; c: number }, b: { r: number; c: number }): Range => ({ r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) });
export const rangeText = (g: Range) => (g.r1 === g.r2 && g.c1 === g.c2 ? `${colName(g.c1)}${g.r1 + 1}` : `${colName(g.c1)}${g.r1 + 1}:${colName(g.c2)}${g.r2 + 1}`);
export const inRange = (g: Range, r: number, c: number) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
export function* cellsIn(g: Range) { for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) yield { r, c }; }

// ─── Changes ────────────────────────────────────────────────────────────────

const withSheet = (wb: Workbook, si: number, fn: (s: Sheet) => Sheet): Workbook => ({ ...wb, sheets: wb.sheets.map((s, i) => (i === si ? fn(s) : s)) });

/** Typed values into cells. A blank value with no look and no note removes the cell. */
export function setValues(wb: Workbook, si: number, values: { r: number; c: number; v: string }[]): Workbook {
  return withSheet(wb, si, (s) => {
    const cells = { ...s.cells };
    let rows = s.rows, cols = s.cols;
    for (const { r, c, v } of values) {
      const k = key(r, c), old = cells[k];
      let st = old?.s;
      // A typed date, time, amount or percent picks up its format the first time.
      if (v && !st?.nf && !v.startsWith("=")) { const nf = autoFormat(v); if (nf) st = { ...(st || {}), nf }; }
      if (v.startsWith("=") && !st?.nf) { const nf = formulaFormat({ ...s, cells }, v); if (nf) st = { ...(st || {}), nf }; }
      const next: Cell = { ...(old || {}), v };
      if (st) next.s = st;
      if (!next.v && !next.s && !next.n) delete cells[k]; else cells[k] = next;
      if (r >= rows - 5) rows = Math.min(MAX_ROWS, r + 50);
      if (c >= cols - 2) cols = Math.min(MAX_COLS, c + 5);
    }
    return { ...s, cells, rows, cols };
  });
}

/** Changes the look of every cell in a range. `patch` keys set to undefined are cleared. */
export function setStyle(wb: Workbook, si: number, g: Range, patch: Partial<CellStyle> | ((old: CellStyle) => CellStyle)): Workbook {
  return withSheet(wb, si, (s) => {
    const cells = { ...s.cells };
    for (const { r, c } of cellsIn(g)) {
      const k = key(r, c), old = cells[k] || { v: "" };
      const merged: any = typeof patch === "function" ? patch({ ...(old.s || {}) }) : { ...(old.s || {}), ...patch };
      for (const x of Object.keys(merged)) if (merged[x] === undefined || merged[x] === false || merged[x] === "") delete merged[x];
      const next: Cell = { ...old, ...(Object.keys(merged).length ? { s: merged } : {}) };
      if (!Object.keys(merged).length) delete next.s;
      if (!next.v && !next.s && !next.n) delete cells[k]; else cells[k] = next;
    }
    return { ...s, cells };
  });
}

/** Borders for a range: all, outer, inner, top, bottom, left, right, none. */
export function setBorders(wb: Workbook, si: number, g: Range, which: "all" | "outer" | "inner" | "top" | "bottom" | "left" | "right" | "none" | "horizontal" | "vertical", col = "#111827"): Workbook {
  return withSheet(wb, si, (s) => {
    const cells = { ...s.cells };
    for (const { r, c } of cellsIn(g)) {
      const k = key(r, c), old = cells[k] || { v: "" };
      const bd: Borders = which === "none" ? {} : { ...(old.s?.bd || {}) };
      const top = r === g.r1, bottom = r === g.r2, left = c === g.c1, right = c === g.c2;
      if (which === "all") Object.assign(bd, { t: col, r: col, b: col, l: col });
      if (which === "outer") { if (top) bd.t = col; if (bottom) bd.b = col; if (left) bd.l = col; if (right) bd.r = col; }
      if (which === "inner" || which === "horizontal") { if (!bottom) bd.b = col; }
      if (which === "inner" || which === "vertical") { if (!right) bd.r = col; }
      if (which === "top" && top) bd.t = col;
      if (which === "bottom" && bottom) bd.b = col;
      if (which === "left" && left) bd.l = col;
      if (which === "right" && right) bd.r = col;
      const st: CellStyle = { ...(old.s || {}) };
      if (Object.keys(bd).length) st.bd = bd; else delete st.bd;
      const next: Cell = { ...old, s: st };
      if (!Object.keys(st).length) delete next.s;
      if (!next.v && !next.s && !next.n) delete cells[k]; else cells[k] = next;
    }
    return { ...s, cells };
  });
}

/** Clears values (and optionally formats and notes) in a range. */
export function clearRange(wb: Workbook, si: number, g: Range, what: "values" | "formats" | "all" = "values"): Workbook {
  return withSheet(wb, si, (s) => {
    const cells = { ...s.cells };
    for (const { r, c } of cellsIn(g)) {
      const k = key(r, c), old = cells[k];
      if (!old) continue;
      const next: Cell = what === "all" ? { v: "" } : what === "formats" ? { v: old.v, ...(old.n ? { n: old.n } : {}) } : { ...old, v: "" };
      if (!next.v && !next.s && !next.n) delete cells[k]; else cells[k] = next;
    }
    return { ...s, cells };
  });
}

/** Inserts (count > 0) or deletes (count < 0) rows or columns at `at`, moving everything after, and fixing every formula. */
export function insertLines(wb: Workbook, si: number, axis: "row" | "col", at: number, count: number): Workbook {
  const target = wb.sheets[si];
  if (!target || !count) return wb;
  const sheets = wb.sheets.map((s, i) => {
    const own = i === si;
    const cells: Record<string, Cell> = {};
    for (const [k, cell] of Object.entries(s.cells)) {
      let { r, c } = unkey(k);
      const v = cell.v.startsWith("=") ? adjustForInsert(cell.v, axis, at, count, target.name, own) : cell.v;
      if (own) {
        const p = axis === "row" ? r : c;
        if (count < 0 && p >= at && p < at - count) continue; // deleted
        if (p >= at) { if (axis === "row") r += count; else c += count; }
      }
      cells[key(r, c)] = v === cell.v ? cell : { ...cell, v };
    }
    if (!own) return { ...s, cells };
    const move = (m: Record<number, number>) => { const out: Record<number, number> = {}; for (const [k, v] of Object.entries(m)) { const i = Number(k); if (count < 0 && i >= at && i < at - count) continue; out[i >= at ? i + count : i] = v; } return out; };
    const moveList = (l: number[]) => l.filter((i) => !(count < 0 && i >= at && i < at - count)).map((i) => (i >= at ? i + count : i));
    const shiftRange = (txt: string) => {
      const g = parseRangeAddr(txt); if (!g) return txt;
      const a1 = axis === "row" ? g.r1 : g.c1, a2 = axis === "row" ? g.r2 : g.c2;
      const n1 = a1 >= at ? Math.max(at, a1 + count) : a1, n2 = a2 >= at ? Math.max(n1, a2 + count) : a2;
      return rangeText(axis === "row" ? { ...g, r1: n1, r2: n2 } : { ...g, c1: n1, c2: n2 });
    };
    return {
      ...s, cells,
      rows: axis === "row" ? Math.max(MIN_ROWS, Math.min(MAX_ROWS, s.rows + count)) : s.rows,
      cols: axis === "col" ? Math.max(MIN_COLS, Math.min(MAX_COLS, s.cols + count)) : s.cols,
      colW: axis === "col" ? move(s.colW) : s.colW, rowH: axis === "row" ? move(s.rowH) : s.rowH,
      hiddenRows: axis === "row" ? moveList(s.hiddenRows) : s.hiddenRows, hiddenCols: axis === "col" ? moveList(s.hiddenCols) : s.hiddenCols,
      merges: s.merges.map((m) => { const g = parseRangeAddr(shiftRange(rangeText(m))); return g ? { r1: g.r1, c1: g.c1, r2: g.r2, c2: g.c2 } : m; }).filter((m) => m.r2 > m.r1 || m.c2 > m.c1),
      cond: s.cond.map((x) => ({ ...x, range: shiftRange(x.range) })),
      valid: s.valid.map((x) => ({ ...x, range: shiftRange(x.range) })),
      charts: s.charts.map((x) => ({ ...x, range: x.range.includes("!") ? x.range : shiftRange(x.range) })),
      filter: undefined,
    };
  });
  return { ...wb, sheets };
}

/** Copies a block of cells (values with formulas shifted, looks, notes) to another place. */
export function pasteCells(wb: Workbook, si: number, at: { r: number; c: number }, block: { cells: (Cell | null)[][]; from?: { r: number; c: number } }, mode: "all" | "values" | "formats" = "all", calc?: Calc): Workbook {
  return withSheet(wb, si, (s) => {
    const cells = { ...s.cells };
    let rows = s.rows, cols = s.cols;
    block.cells.forEach((row, dr) => row.forEach((src, dc) => {
      const r = at.r + dr, c = at.c + dc;
      if (r >= MAX_ROWS || c >= MAX_COLS) return;
      const k = key(r, c), old = cells[k];
      let v = src?.v ?? "";
      if (v.startsWith("=") && block.from) {
        if (mode === "values" && calc) { const val = calc.value(si, block.from.r + dr, block.from.c + dc); v = val === null ? "" : isErr(val) ? val.err : typeof val === "number" ? String(val) : text(val); }
        else v = shiftFormula(v, r - (block.from.r + dr), c - (block.from.c + dc));
      }
      const next: Cell = mode === "formats" ? { v: old?.v ?? "", ...(src?.s ? { s: src.s } : {}) } : mode === "values" ? { ...(old || {}), v } : { v, ...(src?.s ? { s: src.s } : {}), ...(src?.n ? { n: src.n } : {}) };
      if (mode === "formats" && old?.n) next.n = old.n;
      if (!next.v && !next.s && !next.n) delete cells[k]; else cells[k] = next;
      rows = Math.max(rows, Math.min(MAX_ROWS, r + 20)); cols = Math.max(cols, Math.min(MAX_COLS, c + 3));
    }));
    return { ...s, cells, rows, cols };
  });
}

/** Fill: down, right, up or left from the first row/column of a range, continuing number and date series. */
export function fillRange(wb: Workbook, si: number, source: Range, target: Range): Workbook {
  const s = wb.sheets[si];
  const vertical = target.r2 > source.r2 || target.r1 < source.r1;
  const updates: { r: number; c: number; v: string; s?: CellStyle }[] = [];
  if (vertical) {
    for (let c = source.c1; c <= source.c2; c++) {
      const seed: { r: number; cell: Cell | undefined }[] = []; for (let r = source.r1; r <= source.r2; r++) seed.push({ r, cell: s.cells[key(r, c)] });
      const down = target.r2 > source.r2;
      const rows = down ? range(source.r2 + 1, target.r2) : range(target.r1, source.r1 - 1).reverse();
      rows.forEach((r, i) => updates.push({ r, c, ...nextInSeries(seed.map((x) => x.cell), down ? i : -(i + 1), down ? r - seed[i % seed.length].r : r - seed[seed.length - 1 - (i % seed.length)].r, 0, down) }));
    }
  } else {
    for (let r = source.r1; r <= source.r2; r++) {
      const seed: { c: number; cell: Cell | undefined }[] = []; for (let c = source.c1; c <= source.c2; c++) seed.push({ c, cell: s.cells[key(r, c)] });
      const right = target.c2 > source.c2;
      const cs = right ? range(source.c2 + 1, target.c2) : range(target.c1, source.c1 - 1).reverse();
      cs.forEach((c, i) => updates.push({ r, c, ...nextInSeries(seed.map((x) => x.cell), right ? i : -(i + 1), 0, right ? c - seed[i % seed.length].c : c - seed[seed.length - 1 - (i % seed.length)].c, right) }));
    }
  }
  return withSheet(wb, si, (sh) => {
    const cells = { ...sh.cells };
    for (const u of updates) { const next: Cell = { v: u.v, ...(u.s ? { s: u.s } : {}) }; if (!next.v && !next.s) delete cells[key(u.r, u.c)]; else cells[key(u.r, u.c)] = next; }
    return { ...sh, cells };
  });
}
const range = (a: number, b: number) => { const out: number[] = []; for (let i = a; i <= b; i++) out.push(i); return out; };
const DAYS_W = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS_W = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function nextInSeries(seed: (Cell | undefined)[], i: number, dr: number, dc: number, forward: boolean): { v: string; s?: CellStyle } {
  const n = seed.length;
  const src = seed[((i % n) + n) % n];
  const raw = seed.map((c) => c?.v ?? "");
  const st = src?.s;
  // Formulas move like a copy.
  if (src?.v.startsWith("=")) return { v: shiftFormula(src.v, dr, dc), s: st };
  // Numbers (and dates) continue the step between the seed cells; one number counts up by 1 only for a single number with Ctrl-free fill… keep Excel's: one number repeats, two or more continue.
  const nums = raw.map((v) => parseNumberText(v));
  if (n >= 2 && nums.every((x) => x !== null) && !raw.some((v) => v === "")) {
    const step = (nums[n - 1]! - nums[0]!) / (n - 1);
    const k = forward ? n + i : i;
    const val = forward ? nums[0]! + step * k : nums[0]! + step * i;
    const nf = st?.nf || autoFormat(raw[0]);
    return { v: nf && /[dmy]/.test(nf) && !/[0#]/.test(nf) ? display(val, { nf }) : formatSeries(val, raw[0]), s: st };
  }
  if (n === 1 && nums[0] !== null && looksLikeDate(raw[0])) { const val = nums[0]! + (forward ? i + 1 : i); return { v: display(val, { nf: "m/d/yyyy" }), s: st }; }
  // Text ending in a number continues: Week 1, Week 2…
  const m = /^(.*?)(\d+)$/.exec(raw[0]);
  if (m && raw.every((v) => /^(.*?)(\d+)$/.exec(v)?.[1] === m[1])) { const base = Number(m[2]); const step = n >= 2 ? Number(/(\d+)$/.exec(raw[n - 1])![1]) - base : 1; const k = forward ? n + i : i; return { v: `${m[1]}${base + (n >= 2 ? (step / (n - 1)) * k : forward ? i + 1 : i)}`, s: st }; }
  // Days and months continue.
  for (const list of [DAYS_W, MONTHS_W]) {
    const short = (x: string) => x.slice(0, 3).toLowerCase();
    const idx = list.findIndex((d) => d.toLowerCase() === raw[0].toLowerCase() || short(d) === raw[0].toLowerCase());
    if (idx >= 0) { const isShort = raw[0].length <= 3; const k = ((idx + (forward ? n + i : i)) % list.length + list.length) % list.length; const word = isShort ? list[k].slice(0, 3) : list[k]; return { v: raw[0] === raw[0].toUpperCase() ? word.toUpperCase() : word, s: st }; }
  }
  return { v: src?.v ?? "", s: st };
}
const formatSeries = (n: number, sample: string) => (sample.includes("%") ? `${Number((n * 100).toPrecision(12))}%` : String(Number(n.toPrecision(12))));

/** Sorts the rows of a range by one or more columns. Formulas move with their row. */
export function sortRange(wb: Workbook, si: number, g: Range, by: { c: number; dir: 1 | -1 }[], headers: boolean, calc: Calc): Workbook {
  const s = wb.sheets[si];
  const start = headers ? g.r1 + 1 : g.r1;
  const rows = range(start, g.r2).map((r) => ({ r, vals: by.map((b) => calc.value(si, r, b.c)) }));
  rows.sort((a, b) => {
    for (let k = 0; k < by.length; k++) {
      const x = a.vals[k], y = b.vals[k];
      if (x === null && y !== null) return 1;
      if (y === null && x !== null) return -1;
      const c = compare(x, y);
      if (c) return c * by[k].dir;
    }
    return a.r - b.r;
  });
  return withSheet(wb, si, (sh) => {
    const cells = { ...sh.cells };
    rows.forEach((row, i) => {
      const to = start + i;
      for (let c = g.c1; c <= g.c2; c++) {
        const cell = s.cells[key(row.r, c)];
        const k = key(to, c);
        if (cell) cells[k] = cell.v.startsWith("=") ? { ...cell, v: shiftFormula(cell.v, to - row.r, 0) } : cell; else delete cells[k];
      }
    });
    return { ...sh, cells };
  });
}

/** Removes rows in a range whose values repeat an earlier row (in the chosen columns). Returns how many went. */
export function removeDuplicates(wb: Workbook, si: number, g: Range, cols: number[], headers: boolean, calc: Calc): { wb: Workbook; removed: number } {
  const start = headers ? g.r1 + 1 : g.r1;
  const seen = new Set<string>();
  const keep: number[] = [];
  for (let r = start; r <= g.r2; r++) { const k = cols.map((c) => text(calc.value(si, r, c)).toLowerCase()).join("\u0001"); if (!seen.has(k)) { seen.add(k); keep.push(r); } }
  const removed = g.r2 - start + 1 - keep.length;
  const s = wb.sheets[si];
  return {
    removed,
    wb: withSheet(wb, si, (sh) => {
      const cells = { ...sh.cells };
      for (let r = start; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) delete cells[key(r, c)];
      keep.forEach((from, i) => { for (let c = g.c1; c <= g.c2; c++) { const cell = s.cells[key(from, c)]; if (cell) cells[key(start + i, c)] = cell; } });
      return { ...sh, cells };
    }),
  };
}

/** Splits text in one column into several, at a separator (comma, space, tab, semicolon or anything typed). */
export function splitToColumns(wb: Workbook, si: number, g: Range, sep: string): Workbook {
  const s = wb.sheets[si];
  const values: { r: number; c: number; v: string }[] = [];
  for (let r = g.r1; r <= g.r2; r++) {
    const raw = s.cells[key(r, g.c1)]?.v ?? "";
    if (raw.startsWith("=")) continue;
    const parts = sep === " " ? raw.trim().split(/\s+/) : raw.split(sep === "\\t" ? "\t" : sep);
    parts.forEach((p, i) => values.push({ r, c: g.c1 + i, v: p.trim() }));
  }
  return setValues(wb, si, values);
}

/** Trims extra spaces in every typed text value of a range. */
export function trimRange(wb: Workbook, si: number, g: Range): Workbook {
  const s = wb.sheets[si];
  const values: { r: number; c: number; v: string }[] = [];
  for (const { r, c } of cellsIn(g)) { const v = s.cells[key(r, c)]?.v; if (v && !v.startsWith("=") && v !== v.replace(/\s+/g, " ").trim()) values.push({ r, c, v: v.replace(/\s+/g, " ").trim() }); }
  return values.length ? setValues(wb, si, values) : wb;
}

/** Find (and replace) across a sheet or the whole workbook. */
export function findAll(wb: Workbook, calc: Calc, q: string, opts: { all: boolean; si: number; caseSensitive: boolean; whole: boolean; formulas: boolean }): { si: number; r: number; c: number }[] {
  if (!q) return [];
  const out: { si: number; r: number; c: number }[] = [];
  const needle = opts.caseSensitive ? q : q.toLowerCase();
  wb.sheets.forEach((s, si) => {
    if (!opts.all && si !== opts.si) return;
    const keys = Object.keys(s.cells).map(unkey).sort((a, b) => a.r - b.r || a.c - b.c);
    for (const { r, c } of keys) {
      const cell = s.cells[key(r, c)];
      const hay0 = opts.formulas ? cell.v : display(calc.value(si, r, c), cell.s, cell.v);
      const hay = opts.caseSensitive ? hay0 : hay0.toLowerCase();
      if (opts.whole ? hay === needle : hay.includes(needle)) out.push({ si, r, c });
    }
  });
  return out;
}
export function replaceAll(wb: Workbook, hits: { si: number; r: number; c: number }[], q: string, rep: string, caseSensitive: boolean): Workbook {
  let next = wb;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "g" : "gi");
  const bySheet = new Map<number, { r: number; c: number; v: string }[]>();
  for (const h of hits) { const v = wb.sheets[h.si].cells[key(h.r, h.c)]?.v ?? ""; (bySheet.get(h.si) || bySheet.set(h.si, []).get(h.si)!).push({ r: h.r, c: h.c, v: v.replace(re, rep) }); }
  for (const [si, vals] of bySheet) next = setValues(next, si, vals);
  return next;
}

// ─── Sheets ─────────────────────────────────────────────────────────────────

export function addSheet(wb: Workbook, name?: string): Workbook {
  let n = wb.sheets.length + 1, nm = name || `Sheet${n}`;
  while (wb.sheets.some((s) => s.name.toLowerCase() === nm.toLowerCase())) nm = `Sheet${++n}`;
  return { ...wb, sheets: [...wb.sheets, blankSheet(nm)], active: wb.sheets.length };
}
export function renameSheet(wb: Workbook, si: number, name: string): Workbook {
  const nm = name.replace(/[[\]*?/\\:]/g, "").trim().slice(0, 60);
  if (!nm || wb.sheets.some((s, i) => i !== si && s.name.toLowerCase() === nm.toLowerCase())) return wb;
  const from = wb.sheets[si].name;
  return { ...wb, sheets: wb.sheets.map((s, i) => {
    const cells: Record<string, Cell> = {};
    for (const [k, c] of Object.entries(s.cells)) cells[k] = c.v.startsWith("=") ? { ...c, v: renameSheetRefs(c.v, from, nm) } : c;
    return { ...s, cells, ...(i === si ? { name: nm } : {}) };
  }) };
}
export function duplicateSheet(wb: Workbook, si: number): Workbook {
  const src = wb.sheets[si];
  let nm = `Copy of ${src.name}`, n = 2;
  while (wb.sheets.some((s) => s.name.toLowerCase() === nm.toLowerCase())) nm = `Copy of ${src.name} (${n++})`;
  const copy: Sheet = JSON.parse(JSON.stringify(src));
  copy.id = newId(); copy.name = nm; copy.charts = copy.charts.map((c) => ({ ...c, id: newId() }));
  const sheets = [...wb.sheets]; sheets.splice(si + 1, 0, copy);
  return { ...wb, sheets, active: si + 1 };
}
export function deleteSheet(wb: Workbook, si: number): Workbook {
  if (wb.sheets.length <= 1) return wb;
  const sheets = wb.sheets.filter((_s, i) => i !== si);
  return { ...wb, sheets, active: Math.min(wb.active >= si ? Math.max(0, wb.active - 1) : wb.active, sheets.length - 1) };
}
export function moveSheet(wb: Workbook, si: number, by: number): Workbook {
  const j = si + by; if (j < 0 || j >= wb.sheets.length) return wb;
  const sheets = [...wb.sheets]; [sheets[si], sheets[j]] = [sheets[j], sheets[si]];
  return { ...wb, sheets, active: j };
}
export const updateSheet = withSheet;

// ─── Merges ─────────────────────────────────────────────────────────────────

export function mergeCells(wb: Workbook, si: number, g: Range, how: "all" | "horizontal" | "vertical" | "unmerge"): Workbook {
  return withSheet(wb, si, (s) => {
    const others = s.merges.filter((m) => !(m.r1 <= g.r2 && m.r2 >= g.r1 && m.c1 <= g.c2 && m.c2 >= g.c1));
    if (how === "unmerge") return { ...s, merges: others };
    const add: Merge[] = how === "all" ? [{ ...g }] : how === "horizontal" ? range(g.r1, g.r2).map((r) => ({ r1: r, r2: r, c1: g.c1, c2: g.c2 })) : range(g.c1, g.c2).map((c) => ({ r1: g.r1, r2: g.r2, c1: c, c2: c }));
    // Only the top-left value is kept, as in Excel.
    const cells = { ...s.cells };
    for (const m of add) for (const { r, c } of cellsIn(m)) if ((r !== m.r1 || c !== m.c1) && cells[key(r, c)]) { const { v: _v, ...rest } = cells[key(r, c)]; if (rest.s || rest.n) cells[key(r, c)] = { v: "", ...rest }; else delete cells[key(r, c)]; }
    return { ...s, cells, merges: [...others, ...add.filter((m) => m.r2 > m.r1 || m.c2 > m.c1)] };
  });
}
/** The merge a cell is part of, if any. */
export const mergeAt = (s: Sheet, r: number, c: number) => s.merges.find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2);

// ─── Conditional formatting ─────────────────────────────────────────────────

const lerp = (a: string, b: string, t: number) => {
  const pa = hex(a), pb = hex(b);
  return `rgb(${pa.map((x, i) => Math.round(x + (pb[i] - x) * t)).join(",")})`;
};
const hex = (h: string) => { const s = h.replace("#", ""); const f = s.length === 3 ? s.split("").map((x) => x + x).join("") : s.slice(0, 6); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); };

/** The extra look conditional formatting gives each cell on a sheet, worked out once per draw. */
export function condStyles(s: Sheet, si: number, calc: Calc): Map<string, CellStyle & { bar?: number; barColor?: string }> {
  const out = new Map<string, CellStyle & { bar?: number; barColor?: string }>();
  for (const rule of s.cond) {
    const g = parseRangeAddr(rule.range);
    if (!g) continue;
    const b = usedBounds(s);
    const R: Range = { r1: g.r1, c1: g.c1, r2: Math.min(g.r2, b.rows - 1), c2: Math.min(g.c2, b.cols - 1) };
    const vals: { k: string; v: Scalar }[] = [];
    for (const { r, c } of cellsIn(R)) vals.push({ k: key(r, c), v: calc.value(si, r, c) });
    const nums = vals.map((x) => x.v).filter((v): v is number => typeof v === "number");
    const avg = nums.length ? nums.reduce((a, x) => a + x, 0) / nums.length : 0;
    const lo = Math.min(...nums), hi = Math.max(...nums);
    const counts = new Map<string, number>();
    if (rule.kind === "dup") for (const { v } of vals) if (v !== null && v !== "") { const t = text(v).toLowerCase(); counts.set(t, (counts.get(t) || 0) + 1); }
    const n = Number(rule.a), n2 = Number(rule.b);
    const sorted = [...nums].sort((x, y) => y - x);
    for (const { k, v } of vals) {
      let hit = false;
      const x = typeof v === "number" ? v : null;
      switch (rule.kind) {
        case "gt": hit = x !== null && x > n; break; case "lt": hit = x !== null && x < n; break;
        case "ge": hit = x !== null && x >= n; break; case "le": hit = x !== null && x <= n; break;
        case "eq": hit = x !== null ? x === n : text(v).toLowerCase() === String(rule.a || "").toLowerCase(); break;
        case "ne": hit = v !== null && (x !== null ? x !== n : text(v).toLowerCase() !== String(rule.a || "").toLowerCase()); break;
        case "between": hit = x !== null && x >= Math.min(n, n2) && x <= Math.max(n, n2); break;
        case "contains": hit = v !== null && text(v).toLowerCase().includes(String(rule.a || "").toLowerCase()); break;
        case "notContains": hit = v !== null && !text(v).toLowerCase().includes(String(rule.a || "").toLowerCase()); break;
        case "empty": hit = v === null || v === ""; break; case "notEmpty": hit = v !== null && v !== ""; break;
        case "dup": hit = v !== null && v !== "" && (counts.get(text(v).toLowerCase()) || 0) > 1; break;
        case "top": hit = x !== null && x >= (sorted[Math.max(0, Math.min(sorted.length, n || 10) - 1)] ?? Infinity); break;
        case "bottom": hit = x !== null && x <= (sorted[sorted.length - Math.max(1, Math.min(sorted.length, n || 10))] ?? -Infinity); break;
        case "aboveAvg": hit = x !== null && x > avg; break; case "belowAvg": hit = x !== null && x < avg; break;
        case "scale": if (x !== null && hi > lo) { const t = (x - lo) / (hi - lo); const mid = rule.mid; out.set(k, { ...(out.get(k) || {}), bg: mid ? (t < 0.5 ? lerp(rule.min || "#f87171", mid, t * 2) : lerp(mid, rule.max || "#4ade80", (t - 0.5) * 2)) : lerp(rule.min || "#ffffff", rule.max || "#4ade80", t) }); } continue;
        case "bars": if (x !== null) out.set(k, { ...(out.get(k) || {}), bar: hi > 0 ? Math.max(0, x) / hi : 0, barColor: rule.max || "#60a5fa" }); continue;
        case "formula": {
          const { r, c } = unkey(k);
          const f = shiftFormula(String(rule.a || "").startsWith("=") ? String(rule.a) : `=${rule.a}`, r - g.r1, c - g.c1);
          const res = evalFormula(f, { cell: (sh, rr, cc) => calc.value(calc.sheetIndex(sh, si), rr, cc), bounds: () => usedBounds(s), here: { r, c }, now: new Date(), rand: Math.random });
          hit = res === true || (typeof res === "number" && res !== 0);
          break;
        }
      }
      if (hit && rule.style) out.set(k, { ...(out.get(k) || {}), ...rule.style });
    }
  }
  return out;
}

/** The dropdown or rule that applies to a cell, if any. */
export const validationAt = (s: Sheet, r: number, c: number) => s.valid.find((v) => { const g = parseRangeAddr(v.range); return !!g && inRange(g, r, c); });

/** Rows hidden by the filter (plus rows hidden by hand). */
export function hiddenRowSet(s: Sheet, si: number, calc: Calc): Set<number> {
  const out = new Set(s.hiddenRows);
  const f = s.filter;
  if (f && Object.keys(f.hide).length) {
    const b = usedBounds(s);
    for (let r = f.r1 + 1; r <= Math.max(f.r2, b.rows - 1); r++) {
      for (const [c, hidden] of Object.entries(f.hide)) {
        if (!hidden.length) continue;
        const t = display(calc.value(si, r, Number(c)), s.cells[key(r, Number(c))]?.s, s.cells[key(r, Number(c))]?.v || "");
        if (hidden.includes(t)) { out.add(r); break; }
      }
    }
  }
  return out;
}

/** The values in a range as a table for a chart: labels and one or more series. */
export function chartData(wb: Workbook, si: number, calc: Calc, ch: Chart): { labels: string[]; series: { name: string; values: number[] }[] } {
  let sheetIdx = si, ref = ch.range;
  const bang = ref.lastIndexOf("!");
  if (bang > 0) { sheetIdx = calc.sheetIndex(ref.slice(0, bang).replace(/^'|'$/g, "").replace(/''/g, "'"), si); ref = ref.slice(bang + 1); }
  const g = parseRangeAddr(ref);
  if (!g || sheetIdx < 0) return { labels: [], series: [] };
  const b = usedBounds(wb.sheets[sheetIdx]);
  const r2 = Math.min(g.r2, b.rows - 1), c2 = Math.min(g.c2, b.cols - 1);
  const head = ch.headers ? 1 : 0;
  const firstIsLabel = (() => { for (let r = g.r1 + head; r <= r2; r++) { const v = calc.value(sheetIdx, r, g.c1); if (typeof v === "string") return true; } return c2 > g.c1; })();
  const labelCol = firstIsLabel ? g.c1 : -1;
  const labels: string[] = [];
  for (let r = g.r1 + head; r <= r2; r++) labels.push(labelCol >= 0 ? display(calc.value(sheetIdx, r, labelCol), wb.sheets[sheetIdx].cells[key(r, labelCol)]?.s) : String(r - g.r1 - head + 1));
  const series: { name: string; values: number[] }[] = [];
  for (let c = labelCol >= 0 ? g.c1 + 1 : g.c1; c <= c2; c++) {
    const name = ch.headers ? display(calc.value(sheetIdx, g.r1, c)) || colName(c) : colName(c);
    const values: number[] = [];
    for (let r = g.r1 + head; r <= r2; r++) { const v = calc.value(sheetIdx, r, c); values.push(typeof v === "number" ? v : 0); }
    series.push({ name, values });
  }
  return { labels, series: series.slice(0, 12) };
}

/** Totals of the cells selected, for the bar along the bottom. */
export function selectionStats(calc: Calc, si: number, g: Range, cap = 200_000): { sum: number; avg: number | null; min: number | null; max: number | null; count: number; numbers: number } {
  let sum = 0, count = 0, numbers = 0, min = Infinity, max = -Infinity, seen = 0;
  for (const { r, c } of cellsIn(g)) {
    if (++seen > cap) break;
    const v = calc.value(si, r, c);
    if (v === null || v === "") continue;
    count++;
    if (typeof v === "number") { numbers++; sum += v; if (v < min) min = v; if (v > max) max = v; }
  }
  return { sum, count, numbers, avg: numbers ? sum / numbers : null, min: numbers ? min : null, max: numbers ? max : null };
}
