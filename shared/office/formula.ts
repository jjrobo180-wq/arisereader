// Arise Sheets' formula engine: reads formulas the way Excel and Google Sheets do and works them out.
//
// - References: A1, $A$1, A1:B10, A:A, 3:3, Sheet2!A1, 'My sheet'!B2:C9
// - Operators: + - * / ^ & = <> < > <= >= and % (50% is 0.5), with Excel's order of operations
// - About 140 functions: maths, statistics, lookup, text, dates, logic, finance
// - Errors as values: #DIV/0!, #VALUE!, #REF!, #NAME?, #N/A, #NUM!, #CYCLE!
// - Dates are numbers, counted in days from 30 Dec 1899, exactly like Excel, so files move between them.
//
// Nothing here knows about the screen: the grid hands in a way to read a cell, and gets values back.

export type FErr = { err: string };
export type Scalar = number | string | boolean | null | FErr;
export type Matrix = Scalar[][];
export type Value = Scalar | Matrix;

export const err = (e: string): FErr => ({ err: e });
export const isErr = (v: unknown): v is FErr => !!v && typeof v === "object" && !Array.isArray(v) && "err" in (v as any);
export const isMatrix = (v: Value): v is Matrix => Array.isArray(v);
export const E = { DIV0: err("#DIV/0!"), VALUE: err("#VALUE!"), REF: err("#REF!"), NAME: err("#NAME?"), NA: err("#N/A"), NUM: err("#NUM!"), CYCLE: err("#CYCLE!") };

// ─── Addresses ──────────────────────────────────────────────────────────────

export const colName = (c: number): string => { let s = ""; c += 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
export const colIndex = (s: string): number => s.toUpperCase().split("").reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
export const addr = (r: number, c: number) => `${colName(c)}${r + 1}`;
export function parseAddr(a: string): { r: number; c: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(a.trim());
  return m ? { r: Number(m[2]) - 1, c: colIndex(m[1]) } : null;
}
export function parseRangeAddr(a: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const [x, y] = a.split(":");
  const p = parseAddr(x), q = y ? parseAddr(y) : p;
  if (!p || !q) return null;
  return { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c) };
}

// ─── Tokens ─────────────────────────────────────────────────────────────────

type Tok =
  | { t: "num"; v: number; s: string }
  | { t: "str"; v: string; s: string }
  | { t: "bool"; v: boolean; s: string }
  | { t: "err"; v: string; s: string }
  | { t: "ref"; s: string; sheet?: string; c1: number; r1: number; c2?: number; r2?: number; abs: [boolean, boolean, boolean, boolean]; kind: "cell" | "range" | "cols" | "rows" }
  | { t: "fn"; v: string; s: string }
  | { t: "name"; v: string; s: string }
  | { t: "op"; v: string; s: string }
  | { t: "("; s: string } | { t: ")"; s: string } | { t: ","; s: string }
  | { t: "ws"; s: string };

const SHEET_PREFIX = /^(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!/;
const CELL = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/;

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const ch = src[i];
    if (/\s/.test(ch)) { const m = /^\s+/.exec(rest)!; out.push({ t: "ws", s: m[0] }); i += m[0].length; continue; }
    if (ch === '"') {
      let j = i + 1, v = "";
      while (j < src.length) { if (src[j] === '"') { if (src[j + 1] === '"') { v += '"'; j += 2; continue; } break; } v += src[j++]; }
      out.push({ t: "str", v, s: src.slice(i, j + 1) }); i = j + 1; continue;
    }
    if (ch === "#") { const m = /^#(?:DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!|NULL!|CYCLE!)/i.exec(rest); if (m) { out.push({ t: "err", v: m[0].toUpperCase(), s: m[0] }); i += m[0].length; continue; } }
    // A reference, possibly with a sheet in front.
    {
      let sheet: string | undefined, len = 0;
      const sp = SHEET_PREFIX.exec(rest);
      const after = sp ? rest.slice(sp[0].length) : rest;
      if (sp) { sheet = sp[1] !== undefined ? sp[1].replace(/''/g, "'") : sp[2]; len = sp[0].length; }
      const a = CELL.exec(after);
      const prevIsValue = out.length && ["num", "str", "ref", ")"].includes(nonWs(out)?.t || "");
      if (a && !/^[A-Za-z0-9_(]/.test(after.slice(a[0].length)) || (a && after[a[0].length] === ":")) {
        let s = a[0], kind: "cell" | "range" = "cell", c2: number | undefined, r2: number | undefined, abs: [boolean, boolean, boolean, boolean] = [!!a[1], !!a[3], false, false];
        const tail = after.slice(a[0].length);
        const b = /^:(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/.exec(tail);
        if (b && !/^[A-Za-z0-9_(]/.test(tail.slice(b[0].length))) { s += b[0]; kind = "range"; c2 = colIndex(b[2]); r2 = Number(b[4]) - 1; abs = [abs[0], abs[1], !!b[1], !!b[3]]; }
        if (!prevIsValue || sheet) {
          out.push({ t: "ref", s: rest.slice(0, len) + s, sheet, kind, c1: colIndex(a[2]), r1: Number(a[4]) - 1, c2, r2, abs });
          i += len + s.length; continue;
        }
      }
      const cols = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![\w(])/.exec(after);
      if (cols && !/^(TRUE|FALSE)$/i.test(cols[2])) { out.push({ t: "ref", s: rest.slice(0, len) + cols[0], sheet, kind: "cols", c1: colIndex(cols[2]), r1: 0, c2: colIndex(cols[4]), r2: 1048575, abs: [!!cols[1], false, !!cols[3], false] }); i += len + cols[0].length; continue; }
      const rows = /^(\$?)(\d{1,7}):(\$?)(\d{1,7})(?![\w(])/.exec(after);
      if (rows && (sheet || !prevIsValue)) { out.push({ t: "ref", s: rest.slice(0, len) + rows[0], sheet, kind: "rows", c1: 0, r1: Number(rows[2]) - 1, c2: 16383, r2: Number(rows[4]) - 1, abs: [false, !!rows[1], false, !!rows[3]] }); i += len + rows[0].length; continue; }
    }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    if (num) { out.push({ t: "num", v: Number(num[0]), s: num[0] }); i += num[0].length; continue; }
    const word = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);
    if (word) {
      const w = word[0];
      if (src[i + w.length] === "(") { out.push({ t: "fn", v: w.toUpperCase(), s: w }); i += w.length; continue; }
      if (/^(TRUE|FALSE)$/i.test(w)) { out.push({ t: "bool", v: w.toUpperCase() === "TRUE", s: w }); i += w.length; continue; }
      out.push({ t: "name", v: w, s: w }); i += w.length; continue;
    }
    const op = /^(<=|>=|<>|[+\-*/^&=<>%])/.exec(rest);
    if (op) { out.push({ t: "op", v: op[0], s: op[0] }); i += op[0].length; continue; }
    if (ch === "(" || ch === ")") { out.push({ t: ch, s: ch } as Tok); i++; continue; }
    if (ch === "," || ch === ";") { out.push({ t: ",", s: ch }); i++; continue; }
    out.push({ t: "name", v: ch, s: ch }); i++;
  }
  return out;
}
const nonWs = (toks: Tok[]) => { for (let k = toks.length - 1; k >= 0; k--) if (toks[k].t !== "ws") return toks[k]; return undefined; };

// ─── Parsing ────────────────────────────────────────────────────────────────

export type Node =
  | { k: "num"; v: number } | { k: "str"; v: string } | { k: "bool"; v: boolean } | { k: "err"; v: string }
  | { k: "ref"; sheet?: string; r: number; c: number }
  | { k: "range"; sheet?: string; r1: number; c1: number; r2: number; c2: number }
  | { k: "name"; v: string }
  | { k: "call"; name: string; args: Node[] }
  | { k: "un"; op: string; a: Node } | { k: "pct"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node };

class ParseError extends Error {}

export function parse(formula: string): Node {
  const toks = tokenize(formula.replace(/^=/, "")).filter((t) => t.t !== "ws");
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expectClose = () => { if (peek()?.t !== ")") throw new ParseError("missing )"); p++; };
  const BIN: Record<string, number> = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 };
  function expr(minPrec = 1): Node {
    let left = unary();
    for (;;) {
      const t = peek();
      if (!t || t.t !== "op" || !(t.v in BIN) || BIN[t.v] < minPrec) break;
      p++;
      const prec = BIN[t.v];
      const right = expr(t.v === "^" ? prec : prec + 1);
      left = { k: "bin", op: t.v, a: left, b: right };
    }
    return left;
  }
  function unary(): Node {
    const t = peek();
    if (t && t.t === "op" && (t.v === "-" || t.v === "+")) { p++; return { k: "un", op: t.v, a: unary() }; }
    return postfix();
  }
  function postfix(): Node {
    let n = primary();
    while (peek()?.t === "op" && (peek() as any).v === "%") { p++; n = { k: "pct", a: n }; }
    return n;
  }
  function primary(): Node {
    const t = next();
    if (!t) throw new ParseError("unexpected end");
    switch (t.t) {
      case "num": return { k: "num", v: t.v };
      case "str": return { k: "str", v: t.v };
      case "bool": return { k: "bool", v: t.v };
      case "err": return { k: "err", v: t.v };
      case "ref": return t.kind === "cell" ? { k: "ref", sheet: t.sheet, r: t.r1, c: t.c1 } : { k: "range", sheet: t.sheet, r1: Math.min(t.r1, t.r2!), c1: Math.min(t.c1, t.c2!), r2: Math.max(t.r1, t.r2!), c2: Math.max(t.c1, t.c2!) };
      case "name": return { k: "name", v: t.v };
      case "(": { const e = expr(); expectClose(); return e; }
      case "fn": {
        if (next()?.t !== "(") throw new ParseError("expected (");
        const args: Node[] = [];
        if (peek()?.t === ")") { p++; return { k: "call", name: t.v, args }; }
        for (;;) {
          if (peek()?.t === "," ) { args.push({ k: "str", v: "" }); p++; continue; }
          args.push(peek()?.t === ")" ? { k: "str", v: "" } : expr());
          const s = next();
          if (s?.t === ")") break;
          if (s?.t !== ",") throw new ParseError("expected , or )");
        }
        return { k: "call", name: t.v, args };
      }
      default: throw new ParseError("unexpected " + t.s);
    }
  }
  const n = expr();
  if (p < toks.length) throw new ParseError("unexpected " + toks[p].s);
  return n;
}

// ─── Evaluating ─────────────────────────────────────────────────────────────

export type EvalCtx = {
  /** The value of one cell (its formula worked out). `sheet` undefined means the current sheet. */
  cell(sheet: string | undefined, r: number, c: number): Scalar;
  /** How many rows and columns a sheet really uses, so A:A doesn't read a million empty cells. */
  bounds(sheet: string | undefined): { rows: number; cols: number } | null;
  /** The cell being worked out (for ROW() and COLUMN() with no argument). */
  here: { r: number; c: number };
  now: Date;
  /** Seeded so RAND doesn't change on every redraw. */
  rand(): number;
};

const MAX_RANGE_CELLS = 2_000_000;

function rangeVals(n: Extract<Node, { k: "range" }>, ctx: EvalCtx): Matrix | FErr {
  const b = ctx.bounds(n.sheet);
  if (!b) return E.REF;
  const r2 = Math.min(n.r2, b.rows - 1), c2 = Math.min(n.c2, b.cols - 1);
  if (r2 < n.r1 || c2 < n.c1) return [[null]];
  if ((r2 - n.r1 + 1) * (c2 - n.c1 + 1) > MAX_RANGE_CELLS) return E.NUM;
  const out: Matrix = [];
  for (let r = n.r1; r <= r2; r++) { const row: Scalar[] = []; for (let c = n.c1; c <= c2; c++) row.push(ctx.cell(n.sheet, r, c)); out.push(row); }
  return out;
}

export function evaluate(node: Node, ctx: EvalCtx): Value {
  switch (node.k) {
    case "num": return node.v;
    case "str": return node.v;
    case "bool": return node.v;
    case "err": return err(node.v);
    case "ref": { if (!ctx.bounds(node.sheet)) return E.REF; return ctx.cell(node.sheet, node.r, node.c); }
    case "range": return rangeVals(node, ctx);
    case "name": return E.NAME;
    case "pct": { const v = num(scalar(evaluate(node.a, ctx))); return isErr(v) ? v : v / 100; }
    case "un": { const v = num(scalar(evaluate(node.a, ctx))); return isErr(v) ? v : node.op === "-" ? -v : v; }
    case "bin": return binary(node.op, evaluate(node.a, ctx), evaluate(node.b, ctx));
    case "call": {
      const f = FUNCS[node.name] || FUNCS[node.name.replace(/^_XLFN\./, "")];
      if (!f) return E.NAME;
      try { return f(node.args, ctx); } catch (e) { return isErr(e) ? e : E.VALUE; }
    }
  }
}

/** A whole formula, start to finish. A broken formula gives an error value, never a throw. */
export function evalFormula(formula: string, ctx: EvalCtx): Scalar {
  let node: Node;
  try { node = parse(formula); } catch { return err("#ERROR!"); }
  const v = evaluate(node, ctx);
  return isMatrix(v) ? (v[0]?.[0] ?? null) : v;
}

function binary(op: string, av: Value, bv: Value): Value {
  // Arrays work cell by cell (={1,2}*2 style): kept simple — a range against a scalar.
  if (isMatrix(av) || isMatrix(bv)) {
    const A = isMatrix(av) ? av : null, B = isMatrix(bv) ? bv : null;
    const rows = Math.max(A?.length || 1, B?.length || 1), cols = Math.max(A?.[0]?.length || 1, B?.[0]?.length || 1);
    const out: Matrix = [];
    for (let r = 0; r < rows; r++) { const row: Scalar[] = []; for (let c = 0; c < cols; c++) row.push(binary(op, A ? (A[r]?.[c] ?? E.NA) : av as Scalar, B ? (B[r]?.[c] ?? E.NA) : bv as Scalar) as Scalar); out.push(row); }
    return out;
  }
  const a = av as Scalar, b = bv as Scalar;
  if (isErr(a)) return a;
  if (isErr(b)) return b;
  if (op === "&") return text(a) + text(b);
  if (["=", "<>", "<", ">", "<=", ">="].includes(op)) {
    const c = compare(a, b);
    return op === "=" ? c === 0 : op === "<>" ? c !== 0 : op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0;
  }
  const x = num(a), y = num(b);
  if (isErr(x)) return x;
  if (isErr(y)) return y;
  switch (op) {
    case "+": return x + y;
    case "-": return x - y;
    case "*": return x * y;
    case "/": return y === 0 ? E.DIV0 : x / y;
    case "^": { const r = Math.pow(x, y); return Number.isFinite(r) ? r : E.NUM; }
  }
  return E.VALUE;
}

/** Excel's compare: numbers < text < booleans; text ignores case; blank equals 0 or "". */
export function compare(a: Scalar, b: Scalar): number {
  const rank = (v: Scalar) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : typeof v === "boolean" ? 2 : 0);
  if (a === null) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0;
  if (b === null) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === "string" && typeof b === "string") { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
  const x = Number(a), y = Number(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

// ─── Coercion ───────────────────────────────────────────────────────────────

export function scalar(v: Value): Scalar { return isMatrix(v) ? (v[0]?.[0] ?? null) : v; }
export function num(v: Scalar): number | FErr {
  if (isErr(v)) return v;
  if (v === null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const parsed = parseNumberText(v);
  return parsed === null ? E.VALUE : parsed;
}
export function text(v: Scalar): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return numToText(v);
  if (isErr(v)) return v.err;
  return v;
}
export function bool(v: Scalar): boolean | FErr {
  if (isErr(v)) return v;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null || v === "") return false;
  if (/^true$/i.test(v)) return true;
  if (/^false$/i.test(v)) return false;
  return E.VALUE;
}
export const numToText = (n: number): string => {
  if (Number.isInteger(n)) return String(n);
  const s = Number(n.toPrecision(15)).toString();
  return s;
};

/** Text that means a number: "1,234.5", "$12", "45%", "(30)", a date like 10/13/2026 or 2026-10-13, a time like 3:30 PM. */
export function parseNumberText(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  let m = /^([+-]?)\(?\$?\s*([\d,]*\.?\d+(?:[eE][+-]?\d+)?)\)?\s*(%?)$/.exec(t);
  if (m && (!m[2].includes(",") || /^\d{1,3}(,\d{3})*(\.\d+)?$/.test(m[2]))) {
    let n = Number(m[2].replace(/,/g, ""));
    if (t.startsWith("(") && t.endsWith(")")) n = -n;
    if (m[1] === "-") n = -n;
    if (m[3]) n /= 100;
    return Number.isFinite(n) ? n : null;
  }
  const d = parseDateText(t);
  if (d !== null) return d;
  m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(t);
  if (m) {
    let h = Number(m[1]);
    if (m[4]) { if (h === 12) h = 0; if (/pm/i.test(m[4])) h += 12; }
    if (h > 23 || Number(m[2]) > 59) return null;
    return (h * 3600 + Number(m[2]) * 60 + Number(m[3] || 0)) / 86400;
  }
  return null;
}

// ─── Dates (Excel serial numbers) ───────────────────────────────────────────

const EPOCH = Date.UTC(1899, 11, 30);
export const toSerial = (y: number, m: number, d: number) => (Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000;
export const fromSerial = (s: number) => new Date(EPOCH + Math.floor(s) * 86_400_000);
export const dateToSerial = (d: Date) => toSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()) + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
export function parseDateText(t: string): number | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(t);
  if (m) return valid(+m[1], +m[2], +m[3]) ? toSerial(+m[1], +m[2], +m[3]) + (m[4] ? (+m[4] * 60 + +m[5]) / 1440 : 0) : null;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return valid(y, +m[1], +m[2]) ? toSerial(y, +m[1], +m[2]) : null; }
  m = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/.exec(t);
  if (m) { const mo = MONTHS.findIndex((x) => x.toLowerCase().startsWith(m![1].toLowerCase().slice(0, 3))) + 1; return mo && valid(+m[3], mo, +m[2]) ? toSerial(+m[3], mo, +m[2]) : null; }
  return null;
}
const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate() && y >= 1900 && y <= 9999;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Is this typed text a date (so the cell should be shown as one)? */
export const looksLikeDate = (t: string) => parseDateText(t.trim()) !== null;
export const looksLikeTime = (t: string) => /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i.test(t.trim());

// ─── Helpers for functions ──────────────────────────────────────────────────

type Fn = (args: Node[], ctx: EvalCtx) => Value;
const ev = (n: Node | undefined, ctx: EvalCtx): Value => (n ? evaluate(n, ctx) : null);
const sv = (n: Node | undefined, ctx: EvalCtx): Scalar => scalar(ev(n, ctx));
function nv(n: Node | undefined, ctx: EvalCtx, fallback?: number): number {
  if (!n && fallback !== undefined) return fallback;
  const v = num(sv(n, ctx));
  if (isErr(v)) throw v;
  return v;
}
function tv(n: Node | undefined, ctx: EvalCtx): string { const v = sv(n, ctx); if (isErr(v)) throw v; return text(v); }
function bv(n: Node | undefined, ctx: EvalCtx, fallback = false): boolean { if (!n) return fallback; const v = bool(sv(n, ctx)); if (isErr(v)) throw v; return v; }
const asMatrix = (v: Value): Matrix => (isMatrix(v) ? v : [[v]]);
const flat = (v: Value): Scalar[] => asMatrix(v).flat();

/** Numbers for SUM-like functions: from ranges only real numbers count; typed-in arguments are converted. */
function numbers(args: Node[], ctx: EvalCtx, opts: { countText?: boolean } = {}): number[] {
  const out: number[] = [];
  for (const a of args) {
    const v = evaluate(a, ctx);
    if (isMatrix(v)) {
      for (const x of v.flat()) {
        if (isErr(x)) throw x;
        if (typeof x === "number") out.push(x);
        else if (opts.countText && (typeof x === "string" || typeof x === "boolean")) out.push(typeof x === "boolean" ? (x ? 1 : 0) : 0);
      }
    } else {
      if (isErr(v)) throw v;
      if (v === null) continue;
      if (a.k === "ref") { if (typeof v === "number") out.push(v); else if (opts.countText && v !== "") out.push(typeof v === "boolean" ? (v ? 1 : 0) : 0); continue; }
      const n = num(v);
      if (isErr(n)) throw n;
      out.push(n);
    }
  }
  return out;
}

/** COUNTIF-style criteria: 5, ">5", "<>apple", "a*", "?at", "" (blank). */
export function matcher(crit: Scalar): (v: Scalar) => boolean {
  if (typeof crit === "number" || typeof crit === "boolean") return (v) => compare(v, crit) === 0 && v !== null;
  const c = text(crit);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(c)!;
  const op = m[1] || "=", rhs = m[2];
  const rn = parseNumberText(rhs);
  if (rn !== null && rhs.trim() !== "") {
    return (v) => {
      const x = typeof v === "number" ? v : typeof v === "string" ? parseNumberText(v) : null;
      if (x === null) return op === "<>";
      return op === "=" ? x === rn : op === "<>" ? x !== rn : op === "<" ? x < rn : op === ">" ? x > rn : op === "<=" ? x <= rn : x >= rn;
    };
  }
  if (rhs === "") return op === "<>" ? (v) => v !== null && v !== "" : (v) => v === null || v === "";
  if (/^(true|false)$/i.test(rhs)) { const b = /^true$/i.test(rhs); return (v) => (op === "<>" ? v !== b : v === b); }
  const wild = /[*?]/.test(rhs);
  const re = wild ? new RegExp("^" + rhs.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/~\*/g, "\u0001").replace(/~\?/g, "\u0002").replace(/\*/g, ".*").replace(/\?/g, ".").replace(/\u0001/g, "\\*").replace(/\u0002/g, "\\?") + "$", "is") : null;
  const low = rhs.toLowerCase();
  if (op === "=" || op === "<>") {
    const eq = (v: Scalar) => (re ? re.test(text(v)) : text(v).toLowerCase() === low);
    return op === "=" ? eq : (v) => !eq(v);
  }
  return (v) => { const c2 = compare(typeof v === "string" ? v : text(v), rhs); return op === "<" ? c2 < 0 : op === ">" ? c2 > 0 : op === "<=" ? c2 <= 0 : c2 >= 0; };
}

function ifsPairs(args: Node[], ctx: EvalCtx, start: number): { range: Matrix; test: (v: Scalar) => boolean }[] {
  const out = [];
  for (let i = start; i + 1 < args.length; i += 2) out.push({ range: asMatrix(ev(args[i], ctx)), test: matcher(sv(args[i + 1], ctx)) });
  return out;
}
const sameShape = (a: Matrix, b: Matrix) => a.length === b.length && (a[0]?.length || 0) === (b[0]?.length || 0);

function round(n: number, d: number, mode: "round" | "up" | "down" = "round") {
  const f = Math.pow(10, d);
  const x = n * f;
  const r = mode === "round" ? Math.sign(x) * Math.round(Math.abs(x) + 1e-9) : mode === "up" ? Math.sign(x) * Math.ceil(Math.abs(x) - 1e-9) : Math.sign(x) * Math.floor(Math.abs(x) + 1e-9);
  return r / f;
}
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
function variance(xs: number[], sample: boolean) { if (xs.length < (sample ? 2 : 1)) throw E.DIV0; const m = mean(xs); return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - (sample ? 1 : 0)); }
function median(xs: number[]) { if (!xs.length) throw E.NUM; const s = [...xs].sort((a, b) => a - b); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
function percentile(xs: number[], k: number) { if (!xs.length || k < 0 || k > 1) throw E.NUM; const s = [...xs].sort((a, b) => a - b); const pos = (s.length - 1) * k, lo = Math.floor(pos); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo); }

function lookupIndex(arr: Scalar[], key: Scalar, mode: number): number {
  // mode 0: exact (wildcards for text), 1: largest <= key (sorted ascending), -1: smallest >= key (sorted descending)
  if (mode === 0) { const t = typeof key === "string" ? matcher(key) : null; return arr.findIndex((v) => (t ? t(v) : compare(v, key) === 0 && v !== null)); }
  let best = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === null) continue;
    const c = compare(arr[i], key);
    if (mode === 1) { if (c <= 0) best = i; else break; }
    else { if (c >= 0) best = i; else break; }
  }
  return best;
}

const serialToDate = (s: number) => { const d = fromSerial(s); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay() }; };
const isWeekend = (s: number) => { const w = serialToDate(s).dow; return w === 0 || w === 6; };

// ─── The functions ──────────────────────────────────────────────────────────

const math1 = (f: (x: number) => number): Fn => (a, c) => { const r = f(nv(a[0], c)); return Number.isFinite(r) ? r : E.NUM; };

export const FUNCS: Record<string, Fn> = {
  // Maths
  SUM: (a, c) => numbers(a, c).reduce((s, x) => s + x, 0),
  PRODUCT: (a, c) => numbers(a, c).reduce((s, x) => s * x, 1),
  SUMPRODUCT: (a, c) => {
    const ms = a.map((n) => asMatrix(ev(n, c)));
    if (!ms.length || ms.some((m) => !sameShape(m, ms[0]))) return E.VALUE;
    let s = 0;
    for (let r = 0; r < ms[0].length; r++) for (let k = 0; k < ms[0][0].length; k++) s += ms.reduce((p, m) => p * (typeof m[r][k] === "number" ? (m[r][k] as number) : 0), 1);
    return s;
  },
  SUMSQ: (a, c) => numbers(a, c).reduce((s, x) => s + x * x, 0),
  ABS: math1(Math.abs), SQRT: (a, c) => { const x = nv(a[0], c); return x < 0 ? E.NUM : Math.sqrt(x); },
  POWER: (a, c) => { const r = Math.pow(nv(a[0], c), nv(a[1], c)); return Number.isFinite(r) ? r : E.NUM; },
  EXP: math1(Math.exp), LN: (a, c) => { const x = nv(a[0], c); return x <= 0 ? E.NUM : Math.log(x); },
  LOG: (a, c) => { const x = nv(a[0], c), b = nv(a[1], c, 10); return x <= 0 || b <= 0 || b === 1 ? E.NUM : Math.log(x) / Math.log(b); },
  LOG10: (a, c) => { const x = nv(a[0], c); return x <= 0 ? E.NUM : Math.log10(x); },
  MOD: (a, c) => { const x = nv(a[0], c), y = nv(a[1], c); return y === 0 ? E.DIV0 : x - y * Math.floor(x / y); },
  QUOTIENT: (a, c) => { const y = nv(a[1], c); return y === 0 ? E.DIV0 : Math.trunc(nv(a[0], c) / y); },
  INT: math1(Math.floor), TRUNC: (a, c) => round(nv(a[0], c), nv(a[1], c, 0), "down"),
  ROUND: (a, c) => round(nv(a[0], c), nv(a[1], c, 0)), ROUNDUP: (a, c) => round(nv(a[0], c), nv(a[1], c, 0), "up"), ROUNDDOWN: (a, c) => round(nv(a[0], c), nv(a[1], c, 0), "down"),
  MROUND: (a, c) => { const m = nv(a[1], c); return m === 0 ? 0 : Math.round(nv(a[0], c) / m) * m; },
  CEILING: (a, c) => { const m = nv(a[1], c, 1); return m === 0 ? 0 : Math.ceil(nv(a[0], c) / m) * m; },
  FLOOR: (a, c) => { const m = nv(a[1], c, 1); return m === 0 ? E.DIV0 : Math.floor(nv(a[0], c) / m) * m; },
  "CEILING.MATH": (a, c) => { const m = nv(a[1], c, 1) || 1; return Math.ceil(nv(a[0], c) / m) * m; },
  "FLOOR.MATH": (a, c) => { const m = nv(a[1], c, 1) || 1; return Math.floor(nv(a[0], c) / m) * m; },
  EVEN: math1((x) => { const r = Math.ceil(Math.abs(x) / 2) * 2; return x < 0 ? -r : r; }), ODD: math1((x) => { let r = Math.ceil(Math.abs(x)); if (r % 2 === 0) r += 1; return x < 0 ? -r : r; }),
  SIGN: math1(Math.sign), PI: () => Math.PI, SIN: math1(Math.sin), COS: math1(Math.cos), TAN: math1(Math.tan), ASIN: math1(Math.asin), ACOS: math1(Math.acos), ATAN: math1(Math.atan),
  ATAN2: (a, c) => Math.atan2(nv(a[1], c), nv(a[0], c)), DEGREES: math1((x) => (x * 180) / Math.PI), RADIANS: math1((x) => (x * Math.PI) / 180),
  FACT: (a, c) => { const n = Math.floor(nv(a[0], c)); if (n < 0 || n > 170) return E.NUM; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  COMBIN: (a, c) => { const n = Math.floor(nv(a[0], c)), k = Math.floor(nv(a[1], c)); if (k < 0 || n < k) return E.NUM; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); },
  PERMUT: (a, c) => { const n = Math.floor(nv(a[0], c)), k = Math.floor(nv(a[1], c)); if (k < 0 || n < k) return E.NUM; let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; },
  GCD: (a, c) => numbers(a, c).map(Math.floor).reduce((x, y) => { while (y) [x, y] = [y, x % y]; return Math.abs(x); }, 0),
  LCM: (a, c) => numbers(a, c).map(Math.floor).reduce((x, y) => { if (!x || !y) return 0; let g = x, h = y; while (h) [g, h] = [h, g % h]; return Math.abs((x * y) / g); }, 1),
  RAND: (_a, c) => c.rand(), RANDBETWEEN: (a, c) => { const lo = Math.ceil(nv(a[0], c)), hi = Math.floor(nv(a[1], c)); return hi < lo ? E.NUM : lo + Math.floor(c.rand() * (hi - lo + 1)); },
  SUMIF: (a, c) => { const range = asMatrix(ev(a[0], c)), test = matcher(sv(a[1], c)), sum = a[2] ? asMatrix(ev(a[2], c)) : range; let s = 0; range.forEach((row, r) => row.forEach((v, k) => { const x = sum[r]?.[k]; if (test(v) && typeof x === "number") s += x; })); return s; },
  SUMIFS: (a, c) => { const sum = asMatrix(ev(a[0], c)), pairs = ifsPairs(a, c, 1); let s = 0; sum.forEach((row, r) => row.forEach((x, k) => { if (typeof x === "number" && pairs.every((p) => p.test(p.range[r]?.[k] ?? null))) s += x; })); return s; },

  // Statistics
  AVERAGE: (a, c) => { const xs = numbers(a, c); return xs.length ? mean(xs) : E.DIV0; },
  AVERAGEA: (a, c) => { const xs = numbers(a, c, { countText: true }); return xs.length ? mean(xs) : E.DIV0; },
  AVERAGEIF: (a, c) => { const range = asMatrix(ev(a[0], c)), test = matcher(sv(a[1], c)), avg = a[2] ? asMatrix(ev(a[2], c)) : range; const xs: number[] = []; range.forEach((row, r) => row.forEach((v, k) => { const x = avg[r]?.[k]; if (test(v) && typeof x === "number") xs.push(x); })); return xs.length ? mean(xs) : E.DIV0; },
  AVERAGEIFS: (a, c) => { const avg = asMatrix(ev(a[0], c)), pairs = ifsPairs(a, c, 1); const xs: number[] = []; avg.forEach((row, r) => row.forEach((x, k) => { if (typeof x === "number" && pairs.every((p) => p.test(p.range[r]?.[k] ?? null))) xs.push(x); })); return xs.length ? mean(xs) : E.DIV0; },
  COUNT: (a, c) => { let n = 0; for (const x of a) { const v = ev(x, c); if (isMatrix(v)) n += v.flat().filter((y) => typeof y === "number").length; else if (typeof v === "number" || (x.k !== "ref" && typeof v === "string" && parseNumberText(v) !== null)) n++; } return n; },
  COUNTA: (a, c) => a.reduce((n, x) => n + flat(ev(x, c)).filter((y) => y !== null && y !== "").length, 0),
  COUNTBLANK: (a, c) => flat(ev(a[0], c)).filter((y) => y === null || y === "").length,
  COUNTIF: (a, c) => { const t = matcher(sv(a[1], c)); return flat(ev(a[0], c)).filter(t).length; },
  COUNTIFS: (a, c) => { const pairs = ifsPairs(a, c, 0); if (!pairs.length) return 0; let n = 0; pairs[0].range.forEach((row, r) => row.forEach((_v, k) => { if (pairs.every((p) => p.test(p.range[r]?.[k] ?? null))) n++; })); return n; },
  MAX: (a, c) => { const xs = numbers(a, c); return xs.length ? Math.max(...xs) : 0; },
  MIN: (a, c) => { const xs = numbers(a, c); return xs.length ? Math.min(...xs) : 0; },
  MAXIFS: (a, c) => { const m = asMatrix(ev(a[0], c)), pairs = ifsPairs(a, c, 1); const xs: number[] = []; m.forEach((row, r) => row.forEach((x, k) => { if (typeof x === "number" && pairs.every((p) => p.test(p.range[r]?.[k] ?? null))) xs.push(x); })); return xs.length ? Math.max(...xs) : 0; },
  MINIFS: (a, c) => { const m = asMatrix(ev(a[0], c)), pairs = ifsPairs(a, c, 1); const xs: number[] = []; m.forEach((row, r) => row.forEach((x, k) => { if (typeof x === "number" && pairs.every((p) => p.test(p.range[r]?.[k] ?? null))) xs.push(x); })); return xs.length ? Math.min(...xs) : 0; },
  MEDIAN: (a, c) => median(numbers(a, c)),
  MODE: (a, c) => { const xs = numbers(a, c); const counts = new Map<number, number>(); let best: number | null = null, bc = 1; for (const x of xs) { const n = (counts.get(x) || 0) + 1; counts.set(x, n); if (n > bc) { bc = n; best = x; } } return best === null ? E.NA : best; },
  "STDEV": (a, c) => Math.sqrt(variance(numbers(a, c), true)), "STDEV.S": (a, c) => Math.sqrt(variance(numbers(a, c), true)), STDEVP: (a, c) => Math.sqrt(variance(numbers(a, c), false)), "STDEV.P": (a, c) => Math.sqrt(variance(numbers(a, c), false)),
  VAR: (a, c) => variance(numbers(a, c), true), "VAR.S": (a, c) => variance(numbers(a, c), true), VARP: (a, c) => variance(numbers(a, c), false), "VAR.P": (a, c) => variance(numbers(a, c), false),
  LARGE: (a, c) => { const xs = numbers([a[0]], c).sort((x, y) => y - x); const k = Math.floor(nv(a[1], c)); return k < 1 || k > xs.length ? E.NUM : xs[k - 1]; },
  SMALL: (a, c) => { const xs = numbers([a[0]], c).sort((x, y) => x - y); const k = Math.floor(nv(a[1], c)); return k < 1 || k > xs.length ? E.NUM : xs[k - 1]; },
  RANK: (a, c) => { const x = nv(a[0], c); const xs = numbers([a[1]], c); const asc = bv(a[2], c); if (!xs.includes(x)) return E.NA; return 1 + xs.filter((y) => (asc ? y < x : y > x)).length; },
  "RANK.EQ": (a, c) => FUNCS.RANK(a, c),
  PERCENTILE: (a, c) => percentile(numbers([a[0]], c), nv(a[1], c)), "PERCENTILE.INC": (a, c) => percentile(numbers([a[0]], c), nv(a[1], c)),
  QUARTILE: (a, c) => percentile(numbers([a[0]], c), Math.floor(nv(a[1], c)) / 4), "QUARTILE.INC": (a, c) => percentile(numbers([a[0]], c), Math.floor(nv(a[1], c)) / 4),
  PERCENTRANK: (a, c) => { const xs = numbers([a[0]], c).sort((p, q) => p - q), x = nv(a[1], c); if (!xs.length) return E.NA; const below = xs.filter((y) => y < x).length; return round(below / (xs.length - 1 || 1), 3, "down"); },
  CORREL: (a, c) => { const xs = flat(ev(a[0], c)), ys = flat(ev(a[1], c)); const p: [number, number][] = []; xs.forEach((x, i) => { if (typeof x === "number" && typeof ys[i] === "number") p.push([x, ys[i] as number]); }); if (p.length < 2) return E.DIV0; const mx = mean(p.map((q) => q[0])), my = mean(p.map((q) => q[1])); let sxy = 0, sx = 0, sy = 0; for (const [x, y] of p) { sxy += (x - mx) * (y - my); sx += (x - mx) ** 2; sy += (y - my) ** 2; } return sx && sy ? sxy / Math.sqrt(sx * sy) : E.DIV0; },
  SLOPE: (a, c) => { const ys = flat(ev(a[0], c)), xs = flat(ev(a[1], c)); const p: [number, number][] = []; xs.forEach((x, i) => { if (typeof x === "number" && typeof ys[i] === "number") p.push([x, ys[i] as number]); }); const mx = mean(p.map((q) => q[0])), my = mean(p.map((q) => q[1])); let n = 0, d = 0; for (const [x, y] of p) { n += (x - mx) * (y - my); d += (x - mx) ** 2; } return d ? n / d : E.DIV0; },
  INTERCEPT: (a, c) => { const s = FUNCS.SLOPE(a, c); if (isErr(s)) return s; const ys = numbers([a[0]], c), xs = numbers([a[1]], c); return mean(ys) - (s as number) * mean(xs); },
  FORECAST: (a, c) => { const s = FUNCS.SLOPE([a[1], a[2]], c), i = FUNCS.INTERCEPT([a[1], a[2]], c); if (isErr(s)) return s; if (isErr(i)) return i; return (i as number) + (s as number) * nv(a[0], c); },

  // Logic
  IF: (a, c) => { const t = bool(sv(a[0], c)); if (isErr(t)) return t; return t ? ev(a[1], c) ?? true : a.length > 2 ? ev(a[2], c) : false; },
  IFS: (a, c) => { for (let i = 0; i + 1 < a.length; i += 2) { const t = bool(sv(a[i], c)); if (isErr(t)) return t; if (t) return ev(a[i + 1], c); } return E.NA; },
  IFERROR: (a, c) => { const v = sv(a[0], c); return isErr(v) ? ev(a[1], c) : ev(a[0], c); },
  IFNA: (a, c) => { const v = sv(a[0], c); return isErr(v) && v.err === "#N/A" ? ev(a[1], c) : ev(a[0], c); },
  AND: (a, c) => { for (const x of a) for (const v of flat(ev(x, c))) { if (v === null) continue; const b = bool(v); if (isErr(b)) { if (typeof v === "string") continue; return b; } if (!b) return false; } return true; },
  OR: (a, c) => { for (const x of a) for (const v of flat(ev(x, c))) { if (v === null) continue; const b = bool(v); if (isErr(b)) { if (typeof v === "string") continue; return b; } if (b) return true; } return false; },
  XOR: (a, c) => a.reduce((n, x) => n + flat(ev(x, c)).filter((v) => bool(v) === true).length, 0) % 2 === 1,
  NOT: (a, c) => !bv(a[0], c), TRUE: () => true, FALSE: () => false,
  SWITCH: (a, c) => { const v = sv(a[0], c); for (let i = 1; i + 1 < a.length; i += 2) if (compare(v, sv(a[i], c)) === 0) return ev(a[i + 1], c); return a.length % 2 === 0 ? ev(a[a.length - 1], c) : E.NA; },
  CHOOSE: (a, c) => { const i = Math.floor(nv(a[0], c)); return i < 1 || i >= a.length ? E.VALUE : ev(a[i], c); },
  ISBLANK: (a, c) => { const v = sv(a[0], c); return v === null; }, ISNUMBER: (a, c) => typeof sv(a[0], c) === "number", ISTEXT: (a, c) => typeof sv(a[0], c) === "string",
  ISERROR: (a, c) => isErr(sv(a[0], c)), ISERR: (a, c) => { const v = sv(a[0], c); return isErr(v) && v.err !== "#N/A"; }, ISNA: (a, c) => { const v = sv(a[0], c); return isErr(v) && v.err === "#N/A"; },
  ISLOGICAL: (a, c) => typeof sv(a[0], c) === "boolean", ISEVEN: (a, c) => Math.floor(Math.abs(nv(a[0], c))) % 2 === 0, ISODD: (a, c) => Math.floor(Math.abs(nv(a[0], c))) % 2 === 1, NA: () => E.NA,

  // Lookup
  VLOOKUP: (a, c) => { const key = sv(a[0], c), t = asMatrix(ev(a[1], c)), col = Math.floor(nv(a[2], c)); const approx = a[3] ? bv(a[3], c, true) : true; if (col < 1 || col > (t[0]?.length || 0)) return E.REF; const i = lookupIndex(t.map((r) => r[0]), key, approx ? 1 : 0); return i < 0 ? E.NA : t[i][col - 1]; },
  HLOOKUP: (a, c) => { const key = sv(a[0], c), t = asMatrix(ev(a[1], c)), row = Math.floor(nv(a[2], c)); const approx = a[3] ? bv(a[3], c, true) : true; if (row < 1 || row > t.length) return E.REF; const i = lookupIndex(t[0], key, approx ? 1 : 0); return i < 0 ? E.NA : t[row - 1][i]; },
  XLOOKUP: (a, c) => {
    const key = sv(a[0], c), look = flat(ev(a[1], c)), ret = asMatrix(ev(a[2], c)), mode = Math.floor(nv(a[4], c, 0));
    let i = mode === 0 ? lookupIndex(look, key, 0) : -1;
    if (mode === -1 || mode === 1) { let best = -1; look.forEach((v, k) => { if (v === null) return; const cmp = compare(v, key); if (cmp === 0) { if (best < 0 || compare(look[best], key) !== 0) best = k; } else if (mode === -1 ? cmp < 0 && (best < 0 || compare(v, look[best]) > 0) : cmp > 0 && (best < 0 || compare(v, look[best]) < 0)) { if (best < 0 || compare(look[best], key) !== 0) best = k; } }); i = best; }
    if (i < 0) return a[3] ? ev(a[3], c) : E.NA;
    return ret.length === 1 ? ret[0][i] : ret[i]?.[0] ?? E.NA;
  },
  LOOKUP: (a, c) => { const key = sv(a[0], c), look = flat(ev(a[1], c)), ret = a[2] ? flat(ev(a[2], c)) : look; const i = lookupIndex(look, key, 1); return i < 0 ? E.NA : ret[i] ?? E.NA; },
  MATCH: (a, c) => { const key = sv(a[0], c), arr = flat(ev(a[1], c)), mode = Math.floor(nv(a[2], c, 1)); const i = lookupIndex(arr, key, mode === 0 ? 0 : mode > 0 ? 1 : -1); return i < 0 ? E.NA : i + 1; },
  XMATCH: (a, c) => { const key = sv(a[0], c), arr = flat(ev(a[1], c)); const i = lookupIndex(arr, key, 0); return i < 0 ? E.NA : i + 1; },
  INDEX: (a, c) => { const t = asMatrix(ev(a[0], c)); let r = Math.floor(nv(a[1], c, 1)), k = Math.floor(nv(a[2], c, 1)); if (t.length === 1 && a.length === 2) { k = r; r = 1; } if (r < 1 || k < 1 || r > t.length || k > (t[0]?.length || 0)) return E.REF; return t[r - 1][k - 1]; },
  ROW: (a, c) => (a[0] && (a[0].k === "ref" || a[0].k === "range") ? (a[0].k === "ref" ? a[0].r : a[0].r1) + 1 : c.here.r + 1),
  COLUMN: (a, c) => (a[0] && (a[0].k === "ref" || a[0].k === "range") ? (a[0].k === "ref" ? a[0].c : a[0].c1) + 1 : c.here.c + 1),
  ROWS: (a, c) => asMatrix(ev(a[0], c)).length, COLUMNS: (a, c) => asMatrix(ev(a[0], c))[0]?.length || 0,
  TRANSPOSE: (a, c) => { const t = asMatrix(ev(a[0], c)); return t[0]?.map((_x, k) => t.map((r) => r[k])) || [[null]]; },
  UNIQUE: (a, c) => { const seen = new Set<string>(); const out: Matrix = []; for (const row of asMatrix(ev(a[0], c))) { const key = row.map(text).join("\u0001").toLowerCase(); if (!seen.has(key)) { seen.add(key); out.push(row); } } return out.length ? out : E.NA; },
  SORT: (a, c) => { const t = asMatrix(ev(a[0], c)).map((r) => [...r]); const k = Math.floor(nv(a[1], c, 1)) - 1, dir = nv(a[2], c, 1); t.sort((x, y) => compare(x[k], y[k]) * (dir < 0 ? -1 : 1)); return t; },
  FILTER: (a, c) => { const t = asMatrix(ev(a[0], c)), inc = flat(ev(a[1], c)); const out = t.filter((_r, i) => bool(inc[i]) === true); return out.length ? out : a[2] ? ev(a[2], c) : E.NA; },
  SEQUENCE: (a, c) => { const rows = Math.floor(nv(a[0], c)), cols = Math.floor(nv(a[1], c, 1)), start = nv(a[2], c, 1), step = nv(a[3], c, 1); return Array.from({ length: Math.min(rows, 10000) }, (_x, r) => Array.from({ length: Math.min(cols, 100) }, (_y, k) => start + (r * cols + k) * step)); },

  // Text
  CONCATENATE: (a, c) => a.map((x) => flat(ev(x, c)).map(text).join("")).join(""), CONCAT: (a, c) => a.map((x) => flat(ev(x, c)).map(text).join("")).join(""),
  TEXTJOIN: (a, c) => { const d = tv(a[0], c), skip = bv(a[1], c, true); const parts: string[] = []; for (const x of a.slice(2)) for (const v of flat(ev(x, c))) { const s = text(v); if (!skip || s !== "") parts.push(s); } return parts.join(d); },
  LEFT: (a, c) => tv(a[0], c).slice(0, Math.max(0, Math.floor(nv(a[1], c, 1)))), RIGHT: (a, c) => { const s = tv(a[0], c), n = Math.max(0, Math.floor(nv(a[1], c, 1))); return n ? s.slice(-n) : ""; },
  MID: (a, c) => { const s = tv(a[0], c), st = Math.floor(nv(a[1], c)), n = Math.floor(nv(a[2], c)); return st < 1 || n < 0 ? E.VALUE : s.substr(st - 1, n); },
  LEN: (a, c) => tv(a[0], c).length, UPPER: (a, c) => tv(a[0], c).toUpperCase(), LOWER: (a, c) => tv(a[0], c).toLowerCase(),
  PROPER: (a, c) => tv(a[0], c).toLowerCase().replace(/(^|[^a-z'])([a-z])/g, (_m, p, ch) => p + ch.toUpperCase()),
  TRIM: (a, c) => tv(a[0], c).replace(/\s+/g, " ").trim(), CLEAN: (a, c) => tv(a[0], c).replace(/[\u0000-\u001f]/g, ""),
  SUBSTITUTE: (a, c) => { const s = tv(a[0], c), from = tv(a[1], c), to = tv(a[2], c); if (!from) return s; if (a[3]) { const n = Math.floor(nv(a[3], c)); let i = -1; for (let k = 0; k < n; k++) { i = s.indexOf(from, i + 1); if (i < 0) return s; } return s.slice(0, i) + to + s.slice(i + from.length); } return s.split(from).join(to); },
  REPLACE: (a, c) => { const s = tv(a[0], c), st = Math.floor(nv(a[1], c)), n = Math.floor(nv(a[2], c)); return s.slice(0, st - 1) + tv(a[3], c) + s.slice(st - 1 + n); },
  FIND: (a, c) => { const i = tv(a[1], c).indexOf(tv(a[0], c), Math.floor(nv(a[2], c, 1)) - 1); return i < 0 ? E.VALUE : i + 1; },
  SEARCH: (a, c) => { const needle = tv(a[0], c), hay = tv(a[1], c), st = Math.floor(nv(a[2], c, 1)) - 1; const re = new RegExp(needle.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, "."), "i"); const m = re.exec(hay.slice(st)); return m ? m.index + st + 1 : E.VALUE; },
  REPT: (a, c) => { const n = Math.floor(nv(a[1], c)); return n < 0 || n > 10000 ? E.VALUE : tv(a[0], c).repeat(n); },
  EXACT: (a, c) => tv(a[0], c) === tv(a[1], c), CHAR: (a, c) => String.fromCharCode(Math.floor(nv(a[0], c))), CODE: (a, c) => { const s = tv(a[0], c); return s ? s.charCodeAt(0) : E.VALUE; },
  T: (a, c) => { const v = sv(a[0], c); return typeof v === "string" ? v : ""; }, N: (a, c) => { const v = sv(a[0], c); return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : 0; },
  VALUE: (a, c) => { const v = sv(a[0], c); if (typeof v === "number") return v; const n = parseNumberText(text(v)); return n === null ? E.VALUE : n; },
  NUMBERVALUE: (a, c) => FUNCS.VALUE(a, c),
  TEXT: (a, c) => { const v = sv(a[0], c); if (isErr(v)) return v; const n = typeof v === "number" ? v : parseNumberText(text(v)); return n === null ? text(v) : formatCode(n, tv(a[1], c)); },
  FIXED: (a, c) => formatCode(nv(a[0], c), bv(a[2], c) ? `0.${"0".repeat(Math.max(0, nv(a[1], c, 2)))}` : `#,##0.${"0".repeat(Math.max(0, nv(a[1], c, 2)))}`),
  DOLLAR: (a, c) => formatCode(nv(a[0], c), `$#,##0.${"0".repeat(Math.max(0, nv(a[1], c, 2)))}`),
  SPLIT: (a, c) => { const parts = tv(a[0], c).split(tv(a[1], c) || ","); return [parts.map((p) => { const n = parseNumberText(p); return n === null ? p : n; })]; },
  REGEXMATCH: (a, c) => { try { return new RegExp(tv(a[1], c)).test(tv(a[0], c)); } catch { return E.VALUE; } },
  REGEXEXTRACT: (a, c) => { try { const m = new RegExp(tv(a[1], c)).exec(tv(a[0], c)); return m ? m[1] ?? m[0] : E.NA; } catch { return E.VALUE; } },
  REGEXREPLACE: (a, c) => { try { return tv(a[0], c).replace(new RegExp(tv(a[1], c), "g"), tv(a[2], c)); } catch { return E.VALUE; } },
  HYPERLINK: (a, c) => (a[1] ? tv(a[1], c) : tv(a[0], c)),

  // Dates and times
  TODAY: (_a, c) => toSerial(c.now.getFullYear(), c.now.getMonth() + 1, c.now.getDate()),
  NOW: (_a, c) => dateToSerial(c.now),
  DATE: (a, c) => { const y = Math.floor(nv(a[0], c)), m = Math.floor(nv(a[1], c)), d = Math.floor(nv(a[2], c)); const dt = new Date(Date.UTC(y < 100 ? 1900 + y : y, m - 1, d)); return (dt.getTime() - EPOCH) / 86_400_000; },
  TIME: (a, c) => ((nv(a[0], c) * 3600 + nv(a[1], c) * 60 + nv(a[2], c)) / 86400) % 1,
  DATEVALUE: (a, c) => { const d = parseDateText(tv(a[0], c)); return d === null ? E.VALUE : Math.floor(d); },
  TIMEVALUE: (a, c) => { const n = parseNumberText(tv(a[0], c)); return n === null ? E.VALUE : n % 1; },
  YEAR: (a, c) => serialToDate(nv(a[0], c)).y, MONTH: (a, c) => serialToDate(nv(a[0], c)).m, DAY: (a, c) => serialToDate(nv(a[0], c)).d,
  HOUR: (a, c) => Math.floor(((nv(a[0], c) % 1) * 24) + 1e-9), MINUTE: (a, c) => Math.floor(((nv(a[0], c) * 1440) % 60) + 1e-9), SECOND: (a, c) => Math.round((nv(a[0], c) * 86400) % 60),
  WEEKDAY: (a, c) => { const dow = serialToDate(nv(a[0], c)).dow, t = nv(a[1], c, 1); return t === 2 ? ((dow + 6) % 7) + 1 : t === 3 ? (dow + 6) % 7 : dow + 1; },
  WEEKNUM: (a, c) => { const s = Math.floor(nv(a[0], c)); const { y } = serialToDate(s); const jan1 = toSerial(y, 1, 1); const dow = serialToDate(jan1).dow; return Math.floor((s - jan1 + dow) / 7) + 1; },
  ISOWEEKNUM: (a, c) => { const s = Math.floor(nv(a[0], c)); const d = fromSerial(s); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t.getTime() - y0.getTime()) / 86_400_000 + 1) / 7); },
  DAYS: (a, c) => Math.floor(nv(a[0], c)) - Math.floor(nv(a[1], c)),
  DATEDIF: (a, c) => {
    const s = Math.floor(nv(a[0], c)), e = Math.floor(nv(a[1], c)), unit = tv(a[2], c).toUpperCase(); if (e < s) return E.NUM;
    const A = serialToDate(s), B = serialToDate(e);
    let months = (B.y - A.y) * 12 + (B.m - A.m); if (B.d < A.d) months--;
    if (unit === "D") return e - s; if (unit === "M") return months; if (unit === "Y") return Math.floor(months / 12);
    if (unit === "YM") return months % 12; if (unit === "MD") return B.d >= A.d ? B.d - A.d : B.d + new Date(Date.UTC(B.y, B.m - 1, 0)).getUTCDate() - A.d;
    if (unit === "YD") { let y = B.y; if (toSerial(y, A.m, Math.min(A.d, 28)) > e) y--; return e - toSerial(y, A.m, A.d); }
    return E.NUM;
  },
  EDATE: (a, c) => { const { y, m, d } = serialToDate(nv(a[0], c)), n = Math.floor(nv(a[1], c)); const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate(); return toSerial(new Date(Date.UTC(y, m - 1 + n, 1)).getUTCFullYear(), new Date(Date.UTC(y, m - 1 + n, 1)).getUTCMonth() + 1, Math.min(d, last)); },
  EOMONTH: (a, c) => { const { y, m } = serialToDate(nv(a[0], c)), n = Math.floor(nv(a[1], c)); const dt = new Date(Date.UTC(y, m + n, 0)); return (dt.getTime() - EPOCH) / 86_400_000; },
  NETWORKDAYS: (a, c) => { let s = Math.floor(nv(a[0], c)), e = Math.floor(nv(a[1], c)), sign = 1; if (e < s) { [s, e] = [e, s]; sign = -1; } const hol = new Set(a[2] ? numbers([a[2]], c).map(Math.floor) : []); let n = 0; for (let d = s; d <= e; d++) if (!isWeekend(d) && !hol.has(d)) n++; return n * sign; },
  WORKDAY: (a, c) => { let d = Math.floor(nv(a[0], c)); let n = Math.floor(nv(a[1], c)); const hol = new Set(a[2] ? numbers([a[2]], c).map(Math.floor) : []); const step = n < 0 ? -1 : 1; while (n !== 0) { d += step; if (!isWeekend(d) && !hol.has(d)) n -= step; } return d; },
  YEARFRAC: (a, c) => Math.abs(nv(a[1], c) - nv(a[0], c)) / 365.25,

  // Finance
  PMT: (a, c) => { const r = nv(a[0], c), n = nv(a[1], c), pv = nv(a[2], c), fv = nv(a[3], c, 0), type = nv(a[4], c, 0); if (n === 0) return E.NUM; if (r === 0) return -(pv + fv) / n; const p = Math.pow(1 + r, n); return -(r * (pv * p + fv)) / ((1 + r * type) * (p - 1)); },
  FV: (a, c) => { const r = nv(a[0], c), n = nv(a[1], c), pmt = nv(a[2], c), pv = nv(a[3], c, 0), type = nv(a[4], c, 0); if (r === 0) return -(pv + pmt * n); const p = Math.pow(1 + r, n); return -(pv * p + (pmt * (1 + r * type) * (p - 1)) / r); },
  PV: (a, c) => { const r = nv(a[0], c), n = nv(a[1], c), pmt = nv(a[2], c), fv = nv(a[3], c, 0), type = nv(a[4], c, 0); if (r === 0) return -(fv + pmt * n); const p = Math.pow(1 + r, n); return -(fv + (pmt * (1 + r * type) * (p - 1)) / r) / p; },
  NPER: (a, c) => { const r = nv(a[0], c), pmt = nv(a[1], c), pv = nv(a[2], c), fv = nv(a[3], c, 0); if (r === 0) return pmt === 0 ? E.NUM : -(pv + fv) / pmt; const x = (pmt - fv * r) / (pmt + pv * r); return x <= 0 ? E.NUM : Math.log(x) / Math.log(1 + r); },
  RATE: (a, c) => { const n = nv(a[0], c), pmt = nv(a[1], c), pv = nv(a[2], c), fv = nv(a[3], c, 0); let r = nv(a[5], c, 0.1); for (let i = 0; i < 100; i++) { const p = Math.pow(1 + r, n); const f = pv * p + (pmt * (p - 1)) / r + fv; const df = n * pv * Math.pow(1 + r, n - 1) + pmt * ((n * Math.pow(1 + r, n - 1) * r - (p - 1)) / (r * r)); const nr = r - f / df; if (!Number.isFinite(nr)) return E.NUM; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } return E.NUM; },
  NPV: (a, c) => { const r = nv(a[0], c); return numbers(a.slice(1), c).reduce((s, x, i) => s + x / Math.pow(1 + r, i + 1), 0); },
  IRR: (a, c) => { const xs = numbers([a[0]], c); let r = nv(a[1], c, 0.1); for (let i = 0; i < 100; i++) { let f = 0, df = 0; xs.forEach((x, k) => { f += x / Math.pow(1 + r, k); df -= (k * x) / Math.pow(1 + r, k + 1); }); const nr = r - f / df; if (!Number.isFinite(nr)) return E.NUM; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } return E.NUM; },
  IPMT: (a, c) => { const r = nv(a[0], c), per = nv(a[1], c), n = nv(a[2], c), pv = nv(a[3], c); const pmt = FUNCS.PMT([a[0], a[2], a[3]], c) as number; let bal = pv; for (let i = 1; i < per; i++) bal = bal * (1 + r) + pmt; return -bal * r * (n ? 1 : 1); },
  PPMT: (a, c) => { const pmt = FUNCS.PMT([a[0], a[2], a[3]], c) as number; const ip = FUNCS.IPMT(a, c) as number; return pmt - ip; },
};
FUNCS.AVG = FUNCS.AVERAGE;

export const FUNCTION_NAMES = Object.keys(FUNCS).sort();

/** One-line help for the formula autocomplete. */
export const FUNCTION_HELP: Record<string, string> = {
  SUM: "SUM(range) — adds numbers", AVERAGE: "AVERAGE(range) — the mean", COUNT: "COUNT(range) — how many numbers", COUNTA: "COUNTA(range) — how many non-empty cells",
  MAX: "MAX(range) — the biggest", MIN: "MIN(range) — the smallest", IF: "IF(test, if true, if false)", IFS: "IFS(test1, value1, test2, value2, …)", IFERROR: "IFERROR(value, if error)",
  SUMIF: "SUMIF(range, criteria, [sum range])", SUMIFS: "SUMIFS(sum range, range1, criteria1, …)", COUNTIF: "COUNTIF(range, criteria)", COUNTIFS: "COUNTIFS(range1, criteria1, …)",
  AVERAGEIF: "AVERAGEIF(range, criteria, [average range])", VLOOKUP: "VLOOKUP(key, table, column, [sorted])", XLOOKUP: "XLOOKUP(key, look in, return, [if missing])",
  HLOOKUP: "HLOOKUP(key, table, row, [sorted])", INDEX: "INDEX(range, row, [column])", MATCH: "MATCH(key, range, [type])", ROUND: "ROUND(number, digits)",
  CONCAT: "CONCAT(text1, text2, …)", TEXTJOIN: "TEXTJOIN(separator, skip blanks, text1, …)", LEFT: "LEFT(text, count)", RIGHT: "RIGHT(text, count)", MID: "MID(text, start, count)",
  LEN: "LEN(text)", TRIM: "TRIM(text)", UPPER: "UPPER(text)", LOWER: "LOWER(text)", PROPER: "PROPER(text)", SUBSTITUTE: "SUBSTITUTE(text, find, replace)",
  TODAY: "TODAY() — today's date", NOW: "NOW() — date and time", DATE: "DATE(year, month, day)", DATEDIF: "DATEDIF(start, end, \"Y\"/\"M\"/\"D\")", NETWORKDAYS: "NETWORKDAYS(start, end) — school/work days",
  TEXT: "TEXT(value, \"format\")", PMT: "PMT(rate, periods, amount) — loan payment", FV: "FV(rate, periods, payment, [present])", RANK: "RANK(value, range)", MEDIAN: "MEDIAN(range)",
  UNIQUE: "UNIQUE(range)", SORT: "SORT(range, [column], [1 or -1])", FILTER: "FILTER(range, condition)", RANDBETWEEN: "RANDBETWEEN(low, high)", AND: "AND(test1, test2, …)", OR: "OR(test1, test2, …)",
};

// ─── Number formats ─────────────────────────────────────────────────────────

/** Formats a number with an Excel-style code: 0.00, #,##0, $#,##0.00, 0%, 0.0E+00, mm/dd/yyyy, mmm d, yyyy, h:mm AM/PM, dddd… */
export function formatCode(n: number, code: string): string {
  const c = code.split(";")[n < 0 && code.includes(";") ? 1 : 0] ?? code;
  if (/[dmyhs]/i.test(c.replace(/"[^"]*"/g, "")) && !/[0#]/.test(c.replace(/"[^"]*"/g, ""))) return formatDate(n, c);
  if (/E\+/i.test(c)) { const d = (c.split(".")[1]?.match(/0/g) || []).length; return n.toExponential(d).toUpperCase().replace(/E\+?(-?)(\d)$/, "E+$10$2").replace("E+-", "E-"); }
  const pct = c.includes("%");
  let x = pct ? n * 100 : n;
  const neg = x < 0 && !code.includes(";");
  x = Math.abs(x);
  const m = /([#0,]*)(?:\.([0#]*))?/.exec(c.replace(/"[^"]*"|[$€£%]/g, "")) || ["", "", ""];
  const decimals = (m[2] || "").length, minDec = ((m[2] || "").match(/0/g) || []).length;
  let s = x.toFixed(decimals);
  if (decimals > minDec) s = s.replace(new RegExp(`0{1,${decimals - minDec}}$`), "").replace(/\.$/, "");
  if ((m[1] || "").includes(",")) { const [i, d] = s.split("."); s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (d ? "." + d : ""); }
  const prefix = (c.match(/^[^#0.,]*/)?.[0] || "").replace(/"/g, ""), suffix = (c.match(/[^#0.,]*$/)?.[0] || "").replace(/"/g, "");
  return (neg ? "-" : "") + prefix + s + suffix;
}

export function formatDate(n: number, code: string): string {
  const day = Math.floor(n), frac = n - day;
  const { y, m, d, dow } = serialToDate(day);
  let secs = Math.round(frac * 86400);
  const H = Math.floor(secs / 3600); secs -= H * 3600; const M = Math.floor(secs / 60); const S = secs - M * 60;
  const ampm = /AM\/PM|A\/P/i.test(code);
  const h12 = H % 12 || 12;
  const tokens = code.match(/"[^"]*"|yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|A\/P|./gi) || [];
  let sawH = false;
  return tokens.map((t, i) => {
    const lower = t.toLowerCase();
    if (t.startsWith('"')) return t.slice(1, -1);
    if (lower === "yyyy") return String(y); if (lower === "yy") return String(y).slice(-2);
    if (lower === "mmmm") return MONTHS[m - 1]; if (lower === "mmm") return MONTHS[m - 1].slice(0, 3);
    if (lower === "mm" || lower === "m") {
      // After an hour (or before seconds) "m" means minutes.
      const next = tokens.slice(i + 1).find((x) => /[a-z]/i.test(x))?.toLowerCase() || "";
      if (sawH || next.startsWith("s")) return lower === "mm" ? String(M).padStart(2, "0") : String(M);
      return lower === "mm" ? String(m).padStart(2, "0") : String(m);
    }
    if (lower === "dddd") return DAYS[dow]; if (lower === "ddd") return DAYS[dow].slice(0, 3);
    if (lower === "dd") return String(d).padStart(2, "0"); if (lower === "d") return String(d);
    if (lower === "hh") { sawH = true; return String(ampm ? h12 : H).padStart(2, "0"); } if (lower === "h") { sawH = true; return String(ampm ? h12 : H); }
    if (lower === "ss") return String(S).padStart(2, "0"); if (lower === "s") return String(S);
    if (lower === "am/pm") return H < 12 ? "AM" : "PM"; if (lower === "a/p") return H < 12 ? "A" : "P";
    return t;
  }).join("");
}

// ─── Moving formulas (copy, fill, insert and delete rows/columns) ───────────

/** A formula copied from one cell to another: relative references move with it, $ ones stay. */
export function shiftFormula(formula: string, dr: number, dc: number): string {
  if (!formula.startsWith("=")) return formula;
  return "=" + tokenize(formula.slice(1)).map((t) => {
    if (t.t !== "ref") return t.s;
    const sheet = t.s.match(SHEET_PREFIX)?.[0] || "";
    const mv = (v: number, abs: boolean, d: number) => (abs ? v : v + d);
    if (t.kind === "cell") { const r = mv(t.r1, t.abs[1], dr), c = mv(t.c1, t.abs[0], dc); return r < 0 || c < 0 ? "#REF!" : sheet + refText(r, c, t.abs[0], t.abs[1]); }
    if (t.kind === "range") { const r1 = mv(t.r1, t.abs[1], dr), c1 = mv(t.c1, t.abs[0], dc), r2 = mv(t.r2!, t.abs[3], dr), c2 = mv(t.c2!, t.abs[2], dc); return Math.min(r1, r2, c1, c2) < 0 ? "#REF!" : `${sheet}${refText(r1, c1, t.abs[0], t.abs[1])}:${refText(r2, c2, t.abs[2], t.abs[3])}`; }
    if (t.kind === "cols") { const c1 = mv(t.c1, t.abs[0], dc), c2 = mv(t.c2!, t.abs[2], dc); return Math.min(c1, c2) < 0 ? "#REF!" : `${sheet}${t.abs[0] ? "$" : ""}${colName(c1)}:${t.abs[2] ? "$" : ""}${colName(c2)}`; }
    const r1 = mv(t.r1, t.abs[1], dr), r2 = mv(t.r2!, t.abs[3], dr); return Math.min(r1, r2) < 0 ? "#REF!" : `${sheet}${t.abs[1] ? "$" : ""}${r1 + 1}:${t.abs[3] ? "$" : ""}${r2 + 1}`;
  }).join("");
}
const refText = (r: number, c: number, ac: boolean, ar: boolean) => `${ac ? "$" : ""}${colName(c)}${ar ? "$" : ""}${r + 1}`;

/**
 * References after rows or columns are inserted (count > 0) or deleted (count < 0) at `at`, on the
 * sheet named `sheet`. `own` is true when the formula lives on that sheet (so unprefixed refs count).
 * Every reference follows its cells, absolute or not, the way Excel does.
 */
export function adjustForInsert(formula: string, axis: "row" | "col", at: number, count: number, sheet: string, own: boolean): string {
  if (!formula.startsWith("=")) return formula;
  return "=" + tokenize(formula.slice(1)).map((t) => {
    if (t.t !== "ref") return t.s;
    const prefix = t.s.match(SHEET_PREFIX)?.[0] || "";
    const target = t.sheet !== undefined ? t.sheet.toLowerCase() === sheet.toLowerCase() : own;
    if (!target) return t.s;
    const move = (v: number): number | null => {
      if (count > 0) return v >= at ? v + count : v;
      const end = at - count; // deleted: at .. end-1
      if (v >= end) return v + count;
      if (v >= at) return null;
      return v;
    };
    const moveEnd = (v: number, start: number): number | null => {
      if (count > 0) return v >= at ? v + count : v;
      const end = at - count;
      if (v >= end) return v + count;
      if (v >= at) return at - 1 >= start ? at - 1 : null;
      return v;
    };
    if (t.kind === "cell") {
      const r = axis === "row" ? move(t.r1) : t.r1, c = axis === "col" ? move(t.c1) : t.c1;
      return r === null || c === null ? "#REF!" : prefix + refText(r, c, t.abs[0], t.abs[1]);
    }
    if (t.kind === "range" || (t.kind === "cols" && axis === "col") || (t.kind === "rows" && axis === "row")) {
      let a1 = axis === "row" ? t.r1 : t.c1, a2 = axis === "row" ? t.r2! : t.c2!;
      let n1 = move(a1);
      const n2 = moveEnd(a2, a1);
      if (n1 === null) n1 = count < 0 ? at : a1;
      if (n2 === null || n2 < n1) return "#REF!";
      a1 = n1;
      if (t.kind === "cols") return `${prefix}${t.abs[0] ? "$" : ""}${colName(a1)}:${t.abs[2] ? "$" : ""}${colName(n2)}`;
      if (t.kind === "rows") return `${prefix}${t.abs[1] ? "$" : ""}${a1 + 1}:${t.abs[3] ? "$" : ""}${n2 + 1}`;
      return axis === "row"
        ? `${prefix}${refText(a1, t.c1, t.abs[0], t.abs[1])}:${refText(n2, t.c2!, t.abs[2], t.abs[3])}`
        : `${prefix}${refText(t.r1, a1, t.abs[0], t.abs[1])}:${refText(t.r2!, n2, t.abs[2], t.abs[3])}`;
    }
    return t.s;
  }).join("");
}

/** A formula after a sheet is renamed. */
export function renameSheetRefs(formula: string, from: string, to: string): string {
  if (!formula.startsWith("=")) return formula;
  const q = /^[A-Za-z_][\w.]*$/.test(to) ? to : `'${to.replace(/'/g, "''")}'`;
  return "=" + tokenize(formula.slice(1)).map((t) => (t.t === "ref" && t.sheet?.toLowerCase() === from.toLowerCase() ? t.s.replace(SHEET_PREFIX, `${q}!`) : t.s)).join("");
}

/** Every cell a formula reads, for drawing coloured boxes while it's being typed. */
export function formulaRefs(formula: string): { sheet?: string; r1: number; c1: number; r2: number; c2: number; text: string }[] {
  if (!formula.startsWith("=")) return [];
  return tokenize(formula.slice(1)).filter((t): t is Extract<Tok, { t: "ref" }> => t.t === "ref").map((t) => ({ sheet: t.sheet, r1: Math.min(t.r1, t.r2 ?? t.r1), c1: Math.min(t.c1, t.c2 ?? t.c1), r2: Math.max(t.r1, t.r2 ?? t.r1), c2: Math.max(t.c1, t.c2 ?? t.c1), text: t.s }));
}
