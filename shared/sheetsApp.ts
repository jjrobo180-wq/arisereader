// The "Sheets" app: a simple spreadsheet, offered as its own Arise App Store install for Arise
// LifeHub and Arise WorkHub. Bolted onto the hub the same loose way Notes-app installs are (see
// shared/notesApp.ts): not a typed field most of familyHub.ts knows about, just read and saved
// through these helpers, so installing or removing it never has to touch the core hub types.
//
// A real grid, not a mock: text or number cells, referenced A1-style, with a small set of
// formulas (=SUM, =AVERAGE, =MIN, =MAX, =COUNT over a range like A1:A10, plus +-*/ between cells).
// No external library — just enough spreadsheet to plan a budget, a packing list or a grade sheet.

export type SheetCell = { v: string };
export type Spreadsheet = {
  id: string;
  name: string;
  /** Row-major grid of raw cell text (formulas start with "="). Sparse rows/cols read as "". */
  rows: string[][];
  updatedAt: string;
};

const MAX_ROWS = 60;
const MAX_COLS = 18;
export const DEFAULT_ROWS = 20;
export const DEFAULT_COLS = 8;

export function blankGrid(rows = DEFAULT_ROWS, cols = DEFAULT_COLS): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** A saved sheet made safe: a bounded grid of short strings. */
function cleanGrid(raw: unknown): string[][] {
  if (!Array.isArray(raw)) return blankGrid();
  const rows = raw.slice(0, MAX_ROWS).map((r) => (Array.isArray(r) ? r.slice(0, MAX_COLS).map((c) => str(c, 400)) : []));
  while (rows.length < DEFAULT_ROWS) rows.push([]);
  for (const r of rows) while (r.length < DEFAULT_COLS) r.push("");
  return rows;
}

const LIMIT = 100;
export function cleanSpreadsheets(raw: unknown): Spreadsheet[] {
  if (!Array.isArray(raw)) return [];
  const out: Spreadsheet[] = [];
  for (const r of raw.slice(0, LIMIT)) {
    if (!r || typeof r !== "object") continue;
    const id = str((r as any).id, 60);
    if (!id) continue;
    out.push({ id, name: str((r as any).name, 80) || "Untitled sheet", rows: cleanGrid((r as any).rows), updatedAt: str((r as any).updatedAt, 40) });
    if (out.length >= LIMIT) break;
  }
  return out;
}

export function saveSpreadsheet(list: Spreadsheet[], sheet: Spreadsheet): Spreadsheet[] {
  const clean: Spreadsheet = { ...sheet, name: sheet.name.slice(0, 80) || "Untitled sheet", rows: cleanGrid(sheet.rows), updatedAt: new Date().toISOString() };
  return list.some((s) => s.id === clean.id) ? list.map((s) => (s.id === clean.id ? clean : s)) : [clean, ...list].slice(0, LIMIT);
}

export const removeSpreadsheet = (list: Spreadsheet[], id: string): Spreadsheet[] => list.filter((s) => s.id !== id);

// ── A tiny formula engine ────────────────────────────────────────────────────
// Supports: numbers, cell refs (A1), +-*/ and parentheses between refs/numbers, and
// =SUM(A1:A10) / =AVERAGE(...) / =MIN(...) / =MAX(...) / =COUNT(...) over a rectangular range.

const colToIndex = (col: string) => col.toUpperCase().split("").reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
const REF = /^([A-Za-z]+)(\d+)$/;

function cellValue(rows: string[][], ref: string): number {
  const m = REF.exec(ref);
  if (!m) return 0;
  const c = colToIndex(m[1]), r = Number(m[2]) - 1;
  const raw = rows[r]?.[c] ?? "";
  const evaluated = evalCell(rows, raw);
  const n = Number(evaluated);
  return Number.isFinite(n) ? n : 0;
}

function expandRange(a: string, b: string): string[] {
  const ma = REF.exec(a), mb = REF.exec(b);
  if (!ma || !mb) return [];
  const c1 = colToIndex(ma[1]), c2 = colToIndex(mb[1]), r1 = Number(ma[2]) - 1, r2 = Number(mb[2]) - 1;
  const out: string[] = [];
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      out.push(String.fromCharCode(65 + c) + (r + 1));
  return out;
}

function callFn(name: string, args: string, rows: string[][]): number {
  const range = args.split(":").map((s) => s.trim());
  const refs = range.length === 2 ? expandRange(range[0], range[1]) : [args.trim()];
  const nums = refs.map((r) => cellValue(rows, r));
  switch (name.toUpperCase()) {
    case "SUM": return nums.reduce((a, b) => a + b, 0);
    case "AVERAGE": return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case "MIN": return nums.length ? Math.min(...nums) : 0;
    case "MAX": return nums.length ? Math.max(...nums) : 0;
    case "COUNT": return refs.filter((r) => { const m = REF.exec(r); return m && rows[Number(m[2]) - 1]?.[colToIndex(m[1])]; }).length;
    default: return 0;
  }
}

/** Evaluates one cell's raw text. Non-formula text/numbers pass through unchanged. Guards against
 *  cycles with a depth cap rather than true cycle detection (fine for a small personal grid). */
export function evalCell(rows: string[][], raw: string, depth = 0): string {
  if (!raw || !raw.startsWith("=") || depth > 24) return raw ?? "";
  const expr = raw.slice(1).trim();
  const fnMatch = /^([A-Za-z]+)\(([^()]*)\)$/.exec(expr);
  if (fnMatch) {
    try { return String(callFn(fnMatch[1], fnMatch[2], rows)); } catch { return "#ERR"; }
  }
  // A small arithmetic expression over refs/numbers: replace refs with their values, then eval safely.
  try {
    const safe = expr.replace(/[A-Za-z]+\d+/g, (ref) => String(cellValue(rows, ref)));
    if (!/^[\d\s+\-*/().]+$/.test(safe)) return "#ERR";
    // eslint-disable-next-line no-new-func
    const n = Function(`"use strict"; return (${safe || 0});`)();
    return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : "#ERR";
  } catch { return "#ERR"; }
}

/** The display value for a cell: formulas evaluated, everything else shown as typed. */
export const displayCell = (rows: string[][], r: number, c: number): string => evalCell(rows, rows[r]?.[c] ?? "");
