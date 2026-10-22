// Arise Sheets: a full spreadsheet, like Google Sheets or Excel. Fonts and sizes, colours, borders,
// number formats, merged cells, frozen rows and columns, formulas with autocomplete, fill handle,
// copy and paste with Excel/Google, sort and filter, conditional formatting, dropdowns, checkboxes,
// charts, notes, links, find and replace, version history, Excel/CSV/PDF in and out, and an AI
// formula helper. Saves by itself to the person's account (lib/cloudDocs.ts).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Filter, Italic, Link as LinkIcon, Lock, MessageSquare, Paintbrush, Percent, Plus, Printer, Sparkles, Underline, ChevronDown, List, Star,
} from "lucide-react";
import { ArrowDownToLine, ArrowUpToLine, BarChart3, Combine, DollarSign, MoveVertical, PaintBucket, Redo2, RotateCw, Sigma, Strikethrough, Undo2, WrapText, Grid3x3, Baseline } from "./icons";
import { flushSync } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { docsApi, saveLabel, useCloudDoc } from "@/lib/cloudDocs";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { FUNCTION_HELP, FUNCTION_NAMES, colName, formulaRefs, isErr, parseAddr, parseRangeAddr, shiftFormula, type Scalar } from "@shared/office/formula";
import {
  Calc, DEFAULT_COL_W, DEFAULT_ROW_H, FONTS, MAX_COLS, MAX_ROWS, NUMBER_FORMATS, SIZES, THEMES, addSheet, blankWorkbook, cleanWorkbook, clearRange, condStyles, deleteSheet, display,
  duplicateSheet, fillRange, hiddenRowSet, insertLines, key, mergeAt, mergeCells, moveSheet, norm, pasteCells, renameSheet, selectionStats, setBorders, setStyle, setValues,
  sortRange, trimRange, updateSheet, usedBounds, validationAt, chartData, type Cell, type CellStyle, type Range, type Sheet, type Workbook,
} from "@shared/office/workbook";
import { parseCsv, readXlsx, sheetFromRows, sheetToCsv, writeXlsx } from "@shared/office/xlsx";
import { ChartSvg } from "./ChartSvg";
import { ColorGrid, DropButton, Floating, MenuBar, MenuList, Tool, ToolSep, downloadBlob, pickFile, safeName, type MenuItem } from "./officeUi";
import { cellCss, changeDecimals, fitColumn, loadOfficeFonts, rangeLabel } from "./sheetsHelpers";
import { SheetDialogs, type DialogState } from "./SheetsDialogs";

const HEAD_W = 46, HEAD_H = 24;
type Pos = { r: number; c: number };
type Edit = { r: number; c: number; text: string; mode: "enter" | "edit"; where: "cell" | "bar" };
type Clip = { si: number; range: Range; cells: (Cell | null)[][]; tsv: string; cut: boolean };

function indexAt(a: Float64Array, pos: number): number {
  let lo = 0, hi = a.length - 2;
  if (pos <= 0) return 0;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (a[mid] <= pos) lo = mid; else hi = mid - 1; }
  return lo;
}

export default function SheetsEditor({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen?: (id: string) => void }) {
  const doc = useCloudDoc<Workbook>(id, cleanWorkbook);
  useEffect(() => { loadOfficeFonts(); }, []);
  if (!doc.content) {
    return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-white text-slate-600">
      {doc.loading ? <><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" /><p className="text-sm font-semibold">Opening spreadsheet…</p></>
        : <><p className="text-sm font-semibold">{doc.error || "That spreadsheet couldn't be opened."}</p><button type="button" onClick={onBack} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Back to files</button></>}
    </div>;
  }
  return <Workspace doc={doc as DocHandle} id={id} onBack={onBack} onOpen={onOpen} />;
}

type DocHandle = ReturnType<typeof useCloudDoc<Workbook>> & { content: Workbook };

function Workspace({ doc, id, onBack, onOpen }: { doc: DocHandle; id: string; onBack: () => void; onOpen?: (id: string) => void }) {
  const { token } = useAuth();
  const wb = doc.content;
  const wbRef = useRef(wb);
  wbRef.current = wb;
  const past = useRef<Workbook[]>([]);
  const future = useRef<Workbook[]>([]);
  const [, bump] = useState(0);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const say = useCallback((m: string) => { setToast(m); if (toastTimer.current) window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(""), 3200); }, []);

  const commit = useCallback((next: Workbook | ((w: Workbook) => Workbook)) => {
    const prev = wbRef.current;
    const n = typeof next === "function" ? next(prev) : next;
    if (n === prev) return;
    past.current.push(prev);
    if (past.current.length > 150) past.current.shift();
    future.current = [];
    wbRef.current = n;
    doc.setContent(n);
  }, [doc.setContent]);
  const quiet = (n: Workbook) => { wbRef.current = n; doc.setContent(n); };
  const undo = () => { const p = past.current.pop(); if (!p) return; future.current.push(wbRef.current); quiet(p); bump((x) => x + 1); };
  const redo = () => { const f = future.current.pop(); if (!f) return; past.current.push(wbRef.current); quiet(f); bump((x) => x + 1); };

  const si = Math.min(wb.active, wb.sheets.length - 1);
  const sheet = wb.sheets[si];
  const calc = useMemo(() => new Calc(wb), [wb]);

  // ─── View settings ───
  const [zoomStr, setZoomStr] = useSavedChoice<string>("sheets-zoom", "100");
  const zoom = Math.max(50, Math.min(200, Number(zoomStr) || 100));
  const z = zoom / 100;
  const [showFormulas, setShowFormulas] = useState(false);
  const [barOn, setBarOn] = useSavedChoice<"on" | "off">("sheets-formula-bar", "on", ["on", "off"]);
  const [statKind, setStatKind] = useSavedChoice<"sum" | "avg" | "min" | "max" | "count" | "numbers">("sheets-stat", "sum", ["sum", "avg", "min", "max", "count", "numbers"]);

  // ─── Selection & editing ───
  const [anchor, setAnchor] = useState<Pos>({ r: 0, c: 0 });
  const [focus, setFocus] = useState<Pos>({ r: 0, c: 0 });
  const [edit, setEdit] = useState<Edit | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; kind: "cell" | "col" | "row" } | null>(null);
  const [paint, setPaint] = useState<CellStyle | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [chartSel, setChartSel] = useState<string | null>(null);
  const [fillTo, setFillTo] = useState<Pos | null>(null);
  const [live, setLive] = useState<{ axis: "col" | "row"; i: number; px: number } | null>(null);
  const [chartLive, setChartLive] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const [ddOpen, setDdOpen] = useState<HTMLElement | null>(null);
  const [filterOpen, setFilterOpen] = useState<{ c: number; el: HTMLElement } | null>(null);
  const [suggest, setSuggest] = useState(0);
  const [findHit, setFindHit] = useState<{ si: number; r: number; c: number } | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const bar = useRef<HTMLTextAreaElement>(null);
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 800, h: 500 });

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Switching sheets starts at the top.
  const lastSheet = useRef(sheet.id);
  useEffect(() => {
    if (lastSheet.current === sheet.id) return;
    lastSheet.current = sheet.id;
    setAnchor({ r: 0, c: 0 }); setFocus({ r: 0, c: 0 }); setEdit(null); setChartSel(null);
    scroller.current?.scrollTo({ left: 0, top: 0 });
  }, [sheet.id]);

  // ─── Geometry ───
  const hiddenRows = useMemo(() => hiddenRowSet(sheet, si, calc), [sheet, si, calc]);
  const hiddenCols = useMemo(() => new Set(sheet.hiddenCols), [sheet.hiddenCols]);
  const colX = useMemo(() => {
    const a = new Float64Array(sheet.cols + 1);
    for (let c = 0; c < sheet.cols; c++) { const w = live?.axis === "col" && live.i === c ? live.px : sheet.colW[c] ?? DEFAULT_COL_W; a[c + 1] = a[c] + (hiddenCols.has(c) ? 0 : Math.round(w * z)); }
    return a;
  }, [sheet.cols, sheet.colW, hiddenCols, z, live]);
  // Rows grow to fit big text (unless their height was set by hand).
  const autoH = useMemo(() => {
    const out: Record<number, number> = {};
    for (const k in sheet.cells) { const st = sheet.cells[k].s; if (!st?.z || st.z <= 12) continue; const r = Number(k.slice(0, k.indexOf(":"))); const need = Math.ceil(st.z * 4 / 3 * 1.45); if (need > (out[r] || DEFAULT_ROW_H)) out[r] = need; }
    return out;
  }, [sheet.cells]);
  const rowY = useMemo(() => {
    const a = new Float64Array(sheet.rows + 1);
    for (let r = 0; r < sheet.rows; r++) { const h = live?.axis === "row" && live.i === r ? live.px : sheet.rowH[r] ?? autoH[r] ?? DEFAULT_ROW_H; a[r + 1] = a[r] + (hiddenRows.has(r) ? 0 : Math.round(h * z)); }
    return a;
  }, [sheet.rows, sheet.rowH, hiddenRows, z, live, autoH]);
  const fw = colX[Math.min(sheet.freezeC, sheet.cols)], fh = rowY[Math.min(sheet.freezeR, sheet.rows)];
  const vw = size.w, vh = size.h;
  const sx = scroll.x, sy = scroll.y;
  const bodyW = Math.max(0, vw - HEAD_W - fw), bodyH = Math.max(0, vh - HEAD_H - fh);
  const totalW = HEAD_W + colX[sheet.cols] + 60, totalH = HEAD_H + rowY[sheet.rows] + 80;

  const visCols = (a: number, b: number) => { const out: number[] = []; for (let c = a; c <= b && c < sheet.cols; c++) if (!hiddenCols.has(c)) out.push(c); return out; };
  const visRows = (a: number, b: number) => { const out: number[] = []; for (let r = a; r <= b && r < sheet.rows; r++) if (!hiddenRows.has(r)) out.push(r); return out; };
  const frozenCols = visCols(0, sheet.freezeC - 1), frozenRows = visRows(0, sheet.freezeR - 1);
  const bodyCols = visCols(Math.max(sheet.freezeC, indexAt(colX, fw + sx)), indexAt(colX, fw + sx + bodyW));
  const bodyRows = visRows(Math.max(sheet.freezeR, indexAt(rowY, fh + sy)), indexAt(rowY, fh + sy + bodyH));

  /** Where a cell sits inside the visible area (viewport pixels). */
  const cellBox = (r: number, c: number) => {
    const x = HEAD_W + (c < sheet.freezeC ? colX[c] : colX[c] - sx);
    const y = HEAD_H + (r < sheet.freezeR ? rowY[r] : rowY[r] - sy);
    return { x, y, w: colX[c + 1] - colX[c], h: rowY[r + 1] - rowY[r] };
  };
  const pointToCell = (clientX: number, clientY: number): Pos & { inColHead: boolean; inRowHead: boolean } => {
    const rect = viewport.current!.getBoundingClientRect();
    const x = clientX - rect.left - HEAD_W, y = clientY - rect.top - HEAD_H;
    const ax = x < fw ? Math.max(0, x) : x + sx, ay = y < fh ? Math.max(0, y) : y + sy;
    return { c: Math.min(sheet.cols - 1, indexAt(colX, ax)), r: Math.min(sheet.rows - 1, indexAt(rowY, ay)), inColHead: y < 0, inRowHead: x < 0 };
  };

  const expandMerges = useCallback((g: Range): Range => {
    let out = { ...g }, grew = true;
    while (grew) {
      grew = false;
      for (const m of sheet.merges) {
        if (m.r1 <= out.r2 && m.r2 >= out.r1 && m.c1 <= out.c2 && m.c2 >= out.c1 && (m.r1 < out.r1 || m.r2 > out.r2 || m.c1 < out.c1 || m.c2 > out.c2)) {
          out = { r1: Math.min(out.r1, m.r1), c1: Math.min(out.c1, m.c1), r2: Math.max(out.r2, m.r2), c2: Math.max(out.c2, m.c2) }; grew = true;
        }
      }
    }
    return out;
  }, [sheet.merges]);
  const sel = useMemo(() => expandMerges(norm(anchor, focus)), [anchor, focus, expandMerges]);
  const used = useMemo(() => usedBounds(sheet), [sheet]);
  /** A selection made smaller for whole rows/columns, so styling a column doesn't touch 20,000 empty cells. */
  const clampSel = (g: Range): Range => ({ r1: g.r1, c1: g.c1, r2: Math.min(g.r2, Math.max(used.rows + 200, 1000) - 1, sheet.rows - 1), c2: Math.min(g.c2, Math.max(used.cols + 20, 26) - 1, sheet.cols - 1) });
  const wholeCols = sel.r1 === 0 && sel.r2 >= sheet.rows - 1;
  const wholeRows = sel.c1 === 0 && sel.c2 >= sheet.cols - 1;

  const activeCell = sheet.cells[key(anchor.r, anchor.c)];
  const ast: CellStyle = activeCell?.s || {};
  const activeVal = calc.value(si, anchor.r, anchor.c);

  // ─── Scrolling ───
  const ensureVisible = (r: number, c: number) => {
    const el = scroller.current;
    if (!el) return;
    let { x, y } = { x: el.scrollLeft, y: el.scrollTop };
    if (c >= sheet.freezeC) {
      if (colX[c] - fw < x) x = colX[c] - fw;
      else if (colX[c + 1] - fw > x + bodyW) x = colX[c + 1] - fw - bodyW;
    }
    if (r >= sheet.freezeR) {
      if (rowY[r] - fh < y) y = rowY[r] - fh;
      else if (rowY[r + 1] - fh > y + bodyH) y = rowY[r + 1] - fh - bodyH;
    }
    if (x !== el.scrollLeft || y !== el.scrollTop) el.scrollTo({ left: Math.max(0, x), top: Math.max(0, y) });
  };
  const focusGrid = () => window.setTimeout(() => viewport.current?.focus({ preventScroll: true }), 0);
  const select = (a: Pos, f: Pos = a, scrollTo = true) => {
    setAnchor(a); setFocus(f); setChartSel(null);
    if (scrollTo) ensureVisible(f.r, f.c);
  };

  // ─── Guarding protected sheets ───
  const guard = () => { if (sheet.locked) { say("This sheet is protected. Unprotect it from its tab to make changes."); return false; } return true; };
  const change = (fn: (w: Workbook) => Workbook) => { if (guard()) commit(fn); };

  // ─── Editing ───
  const rawOf = (r: number, c: number) => sheet.cells[key(r, c)]?.v ?? "";
  const startEdit = (mode: "enter" | "edit", text?: string, where: "cell" | "bar" = "cell") => {
    if (!guard()) return;
    const v = validationAt(sheet, anchor.r, anchor.c);
    if (v?.kind === "checkbox" || ast.nf === "checkbox") { toggleCheck(anchor.r, anchor.c); return; }
    // Rendered and focused right away, so fast typing never lands anywhere else.
    flushSync(() => { setEdit({ r: anchor.r, c: anchor.c, text: text ?? rawOf(anchor.r, anchor.c), mode, where }); setSuggest(0); });
    const el = where === "bar" ? bar.current : editor.current;
    if (el) { el.focus({ preventScroll: true }); const n = el.value.length; el.setSelectionRange(n, n); setCaret(n); }
  };
  const pointing = useRef<{ start: number; end: number; anchor: Pos } | null>(null);
  const tidyFormula = (v: string) => {
    if (!v.startsWith("=")) return v;
    const open = (v.match(/\(/g) || []).length - (v.match(/\)/g) || []).length;
    if (open > 0) v += ")".repeat(open);
    return v.split(/("[^"]*")/).map((part, i) => (i % 2 ? part : part.replace(/\b([A-Za-z][A-Za-z0-9.]*)(?=\()/g, (m) => m.toUpperCase()).replace(/(^|[^A-Za-z_'!])([a-z]{1,3}\$?\d{1,7})\b/g, (_m, p, ref) => p + ref.toUpperCase()))).join("");
  };
  const commitEdit = (move: "down" | "up" | "right" | "left" | "none" = "down", all = false) => {
    if (!edit) return true;
    const { r, c } = edit;
    const v = tidyFormula(edit.text);
    const rule = validationAt(sheet, r, c);
    if (rule?.strict && v && !v.startsWith("=")) {
      const n = Number(v);
      const bad = rule.kind === "list" ? !(rule.list || []).some((x) => x.toLowerCase() === v.toLowerCase()) : rule.kind === "number" ? !Number.isFinite(n) || (rule.min !== undefined && n < rule.min) || (rule.max !== undefined && n > rule.max) : false;
      if (bad) { say(rule.help || (rule.kind === "list" ? `Pick one of: ${(rule.list || []).join(", ")}` : "That value isn't allowed here.")); return false; }
    }
    if (all && (sel.r2 > sel.r1 || sel.c2 > sel.c1)) {
      const g = clampSel(sel);
      const vals: { r: number; c: number; v: string }[] = [];
      for (let rr = g.r1; rr <= g.r2; rr++) for (let cc = g.c1; cc <= g.c2; cc++) vals.push({ r: rr, c: cc, v: v.startsWith("=") ? shiftFormula(v, rr - r, cc - c) : v });
      commit((w) => setValues(w, si, vals));
    } else if (v !== rawOf(r, c)) commit((w) => setValues(w, si, [{ r, c, v }]));
    setEdit(null);
    pointing.current = null;
    if (move !== "none") moveBy(move === "down" ? 1 : move === "up" ? -1 : 0, move === "right" ? 1 : move === "left" ? -1 : 0, false, { r, c });
    focusGrid();
    return true;
  };
  const cancelEdit = () => { setEdit(null); pointing.current = null; focusGrid(); };

  const nextVisible = (r: number, c: number, dr: number, dc: number) => {
    let nr = r + dr, nc = c + dc;
    while (nr > 0 && nr < sheet.rows - 1 && hiddenRows.has(nr)) nr += dr || 1;
    while (nc > 0 && nc < sheet.cols - 1 && hiddenCols.has(nc)) nc += dc || 1;
    return { r: Math.max(0, Math.min(sheet.rows - 1, nr)), c: Math.max(0, Math.min(sheet.cols - 1, nc)) };
  };
  const moveBy = (dr: number, dc: number, extend = false, from?: Pos) => {
    const base = extend ? focus : from || anchor;
    // Moving out of a merged cell skips the rest of it.
    const m = mergeAt(sheet, base.r, base.c);
    const start = m && !extend ? { r: dr > 0 ? m.r2 : dr < 0 ? m.r1 : base.r, c: dc > 0 ? m.c2 : dc < 0 ? m.c1 : base.c } : base;
    const next = nextVisible(start.r, start.c, dr, dc);
    if (extend) { setFocus(next); ensureVisible(next.r, next.c); }
    else select(next);
  };
  const hasValue = (r: number, c: number) => !!sheet.cells[key(r, c)]?.v;
  const jump = (dr: number, dc: number, extend: boolean) => {
    const base = extend ? focus : anchor;
    let { r, c } = base;
    const step = () => { r += dr; c += dc; };
    const inside = () => r >= 0 && c >= 0 && r < sheet.rows && c < sheet.cols;
    const maxR = Math.max(used.rows, 1), maxC = Math.max(used.cols, 1);
    step();
    if (!inside()) { r -= dr; c -= dc; }
    else if (hasValue(base.r, base.c) && hasValue(r, c)) { while (inside() && hasValue(r, c)) step(); r -= dr; c -= dc; }
    else { while (inside() && !hasValue(r, c) && r <= maxR && c <= maxC) step(); if (!inside() || !hasValue(r, c)) { r = dr > 0 ? Math.min(sheet.rows - 1, maxR) : dr < 0 ? 0 : r - dr; c = dc > 0 ? Math.min(sheet.cols - 1, maxC) : dc < 0 ? 0 : c - dc; } }
    const p = { r: Math.max(0, Math.min(sheet.rows - 1, r)), c: Math.max(0, Math.min(sheet.cols - 1, c)) };
    if (extend) { setFocus(p); ensureVisible(p.r, p.c); } else select(p);
  };

  // ─── Styling ───
  const style = (patch: Partial<CellStyle> | ((old: CellStyle) => CellStyle)) => change((w) => setStyle(w, si, clampSel(sel), patch));
  const toggle = (k: "b" | "i" | "u" | "s" | "w") => style({ [k]: ast[k] ? undefined : true });
  const setNf = (nf: string | undefined) => style({ nf: nf || undefined });
  const decimals = (d: 1 | -1) => style((old) => ({ ...old, nf: changeDecimals(old.nf || ast.nf, typeof activeVal === "number" ? activeVal : null, d) }));
  const fontSize = (delta: number) => { const cur = ast.z || 10; const i = SIZES.findIndex((s) => s >= cur); const next = delta > 0 ? SIZES[Math.min(SIZES.length - 1, (SIZES[i] === cur ? i : i - 1) + 1)] : SIZES[Math.max(0, i - 1)]; style({ z: next === 10 ? undefined : next }); };
  const toggleCheck = (r: number, c: number) => {
    if (!guard()) return;
    const v = calc.value(si, r, c);
    commit((w) => setValues(w, si, [{ r, c, v: v === true ? "FALSE" : "TRUE" }]));
  };

  // ─── Clipboard ───
  const copyOut = (cut: boolean, data?: DataTransfer | null) => {
    const g = { ...sel, r2: Math.min(sel.r2, used.rows - 1), c2: Math.min(sel.c2, used.cols - 1) };
    if (g.r2 < g.r1 || g.c2 < g.c1) { g.r2 = g.r1; g.c2 = g.c1; }
    const cells: (Cell | null)[][] = [], lines: string[] = [], html: string[] = [];
    for (let r = g.r1; r <= g.r2; r++) {
      const row: (Cell | null)[] = [], txt: string[] = [], tds: string[] = [];
      for (let c = g.c1; c <= g.c2; c++) {
        const cell = sheet.cells[key(r, c)] || null;
        row.push(cell ? JSON.parse(JSON.stringify(cell)) : null);
        const t = display(calc.value(si, r, c), cell?.s, cell?.v || "");
        txt.push(/[\t\n"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
        const css = Object.entries(cellCss(cell?.s)).map(([k, v]) => `${k.replace(/[A-Z]/g, (x) => "-" + x.toLowerCase())}:${v}`).concat(cell?.s?.bg ? [`background:${cell.s.bg}`] : []).join(";");
        tds.push(`<td style="${css}">${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`);
      }
      cells.push(row); lines.push(txt.join("\t")); html.push(`<tr>${tds.join("")}</tr>`);
    }
    const tsv = lines.join("\n");
    setClip({ si, range: g, cells, tsv, cut });
    if (data) { data.setData("text/plain", tsv); data.setData("text/html", `<table>${html.join("")}</table>`); }
    else void navigator.clipboard?.writeText(tsv).catch(() => {});
    say(cut ? "Cut. Paste where it should go." : `Copied ${rangeLabel(g)}.`);
  };
  const pasteIn = (text: string, mode: "all" | "values" | "formats" = "all") => {
    if (!guard()) return;
    const at = { r: sel.r1, c: sel.c1 };
    const norm2 = (s: string) => s.replace(/\r\n/g, "\n").replace(/\n$/, "");
    if (clip && norm2(text) === norm2(clip.tsv)) {
      const srcCalc = calc;
      commit((w) => {
        let next = w;
        if (clip.cut && clip.si === si) next = clearRange(next, si, clip.range, "all");
        else if (clip.cut) next = clearRange(next, clip.si, clip.range, "all");
        return pasteCells(next, si, at, { cells: clip.cells, from: clip.si === si || !clip.cut ? { r: clip.range.r1, c: clip.range.c1 } : undefined }, mode, srcCalc);
      });
      const h = clip.cells.length, w = clip.cells[0]?.length || 1;
      select(at, { r: at.r + h - 1, c: at.c + w - 1 }, false);
      if (clip.cut) setClip(null);
      return;
    }
    const rows = parseCsv(norm2(text), "\t");
    if (!rows.length) return;
    // One value pasted over a selection fills it.
    if (rows.length === 1 && rows[0].length === 1 && (sel.r2 > sel.r1 || sel.c2 > sel.c1)) {
      const g = clampSel(sel); const vals: { r: number; c: number; v: string }[] = [];
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) vals.push({ r, c, v: rows[0][0] });
      commit((w) => setValues(w, si, vals));
      return;
    }
    const vals: { r: number; c: number; v: string }[] = [];
    rows.slice(0, MAX_ROWS - at.r).forEach((row, dr) => row.slice(0, MAX_COLS - at.c).forEach((v, dc) => vals.push({ r: at.r + dr, c: at.c + dc, v })));
    commit((w) => setValues(w, si, vals));
    select(at, { r: at.r + rows.length - 1, c: at.c + Math.max(...rows.map((r) => r.length)) - 1 }, false);
  };
  const pasteMode = useRef<"all" | "values">("all");
  const handlers = useRef({ copyOut, pasteIn });
  handlers.current = { copyOut, pasteIn };
  useEffect(() => {
    const mine = () => document.activeElement === viewport.current;
    const onCopy = (e: ClipboardEvent) => { if (!mine()) return; e.preventDefault(); handlers.current.copyOut(false, e.clipboardData); };
    const onCut = (e: ClipboardEvent) => { if (!mine()) return; e.preventDefault(); handlers.current.copyOut(true, e.clipboardData); };
    const onPaste = (e: ClipboardEvent) => { if (!mine()) return; e.preventDefault(); handlers.current.pasteIn(e.clipboardData?.getData("text/plain") || "", pasteMode.current); pasteMode.current = "all"; };
    document.addEventListener("copy", onCopy); document.addEventListener("cut", onCut); document.addEventListener("paste", onPaste);
    return () => { document.removeEventListener("copy", onCopy); document.removeEventListener("cut", onCut); document.removeEventListener("paste", onPaste); };
  }, []);
  const pasteFromMenu = async (mode: "all" | "values" | "formats") => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { text = clip?.tsv || ""; }
    if (!text && clip) text = clip.tsv;
    if (!text) { say("Nothing to paste. Use Ctrl+V (⌘V on Mac) to paste from another app."); return; }
    pasteIn(text, mode);
  };

  // ─── Rows, columns, sheets ───
  const insert = (axis: "row" | "col", after: boolean) => {
    const count = axis === "row" ? sel.r2 - sel.r1 + 1 : sel.c2 - sel.c1 + 1;
    const at = axis === "row" ? (after ? sel.r2 + 1 : sel.r1) : (after ? sel.c2 + 1 : sel.c1);
    change((w) => insertLines(w, si, axis, at, Math.min(count, 500)));
  };
  const remove = (axis: "row" | "col") => {
    const g = clampSel(sel);
    const n = axis === "row" ? g.r2 - g.r1 + 1 : g.c2 - g.c1 + 1;
    change((w) => insertLines(w, si, axis, axis === "row" ? g.r1 : g.c1, -n));
    select({ r: g.r1, c: g.c1 });
  };
  const hide = (axis: "row" | "col") => change((w) => updateSheet(w, si, (s) => {
    if (axis === "row") { const add: number[] = []; for (let r = sel.r1; r <= Math.min(sel.r2, sel.r1 + 2000); r++) add.push(r); return { ...s, hiddenRows: [...new Set([...s.hiddenRows, ...add])] }; }
    const add: number[] = []; for (let c = sel.c1; c <= sel.c2; c++) add.push(c); return { ...s, hiddenCols: [...new Set([...s.hiddenCols, ...add])] };
  }));
  const unhideAll = (axis: "row" | "col") => change((w) => updateSheet(w, si, (s) => (axis === "row" ? { ...s, hiddenRows: [] } : { ...s, hiddenCols: [] })));
  const freeze = (axis: "row" | "col", n: number) => change((w) => updateSheet(w, si, (s) => (axis === "row" ? { ...s, freezeR: Math.min(50, n) } : { ...s, freezeC: Math.min(20, n) })));
  const setActive = (i: number) => { if (edit) commitEdit("none"); quiet({ ...wbRef.current, active: i }); };
  const sortBy = (dir: 1 | -1, whole: boolean) => {
    if (!guard()) return;
    const g = whole ? { r1: sheet.freezeR, c1: 0, r2: used.rows - 1, c2: used.cols - 1 } : clampSel(sel);
    if (g.r2 <= g.r1) { say("Nothing to sort here."); return; }
    commit((w) => sortRange(w, si, g, [{ c: anchor.c, dir }], false, new Calc(w)));
    say(`Sorted ${whole ? "the sheet" : rangeLabel(g)} by column ${colName(anchor.c)} ${dir === 1 ? "A → Z" : "Z → A"}.`);
  };
  const toggleFilter = () => {
    if (sheet.filter) { change((w) => updateSheet(w, si, (s) => ({ ...s, filter: undefined }))); return; }
    const g = sel.r2 > sel.r1 ? clampSel(sel) : { r1: sel.r1, c1: 0, r2: Math.max(used.rows - 1, sel.r1 + 1), c2: Math.max(used.cols - 1, 0) };
    change((w) => updateSheet(w, si, (s) => ({ ...s, filter: { r1: g.r1, c1: g.c1, r2: g.r2, c2: g.c2, hide: {} } })));
    say("Filter on. Use the buttons in the header row.");
  };
  const insertChart = () => {
    const g = sel.r2 > sel.r1 || sel.c2 > sel.c1 ? clampSel(sel) : { r1: 0, c1: 0, r2: Math.max(0, used.rows - 1), c2: Math.max(0, used.cols - 1) };
    const nid = `ch${Date.now().toString(36)}`;
    const x = Math.round(colX[Math.min(sheet.cols, g.c2 + 1)] / z) + 24, y = Math.round(rowY[g.r1] / z);
    change((w) => updateSheet(w, si, (s) => ({ ...s, charts: [...s.charts, { id: nid, kind: "column", range: rangeLabel(g), title: "", x, y, w: 480, h: 300, headers: true, legend: true }] })));
    setChartSel(nid);
    setDialog({ kind: "chart", chartId: nid });
  };
  const fillDir = (dir: "down" | "right") => {
    const g = clampSel(sel);
    if (dir === "down" && g.r2 > g.r1) change((w) => fillRange(w, si, { ...g, r2: g.r1 }, g));
    if (dir === "right" && g.c2 > g.c1) change((w) => fillRange(w, si, { ...g, c2: g.c1 }, g));
  };
  const insertNow = (what: "date" | "time") => {
    const d = new Date();
    const v = what === "date" ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` : `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() >= 12 ? "PM" : "AM"}`;
    change((w) => setValues(w, si, [{ r: anchor.r, c: anchor.c, v }]));
  };
  const insertCheckbox = () => {
    const g = clampSel(sel);
    change((w) => { let n = setStyle(w, si, g, { nf: "checkbox", h: "center" }); const vals: { r: number; c: number; v: string }[] = []; for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if (!w.sheets[si].cells[key(r, c)]?.v) vals.push({ r, c, v: "FALSE" }); n = setValues(n, si, vals); return n; });
  };
  const insertFunction = (name: string) => {
    const g = clampSel(sel);
    const above = anchor.r > 0 ? `${colName(anchor.c)}1:${colName(anchor.c)}${anchor.r}` : "";
    const arg = g.r2 > g.r1 || g.c2 > g.c1 ? rangeLabel(g) : above;
    const target = g.r2 > g.r1 || g.c2 > g.c1 ? { r: g.r2 + 1, c: g.c1 } : anchor;
    select(target);
    window.setTimeout(() => {
      setEdit({ r: target.r, c: target.c, text: `=${name}(${arg}`, mode: "edit", where: "cell" });
      window.setTimeout(() => { editor.current?.focus(); const n = editor.current?.value.length || 0; editor.current?.setSelectionRange(n, n); }, 0);
    }, 0);
  };

  // ─── Files ───
  const api = docsApi(token);
  const download = (kind: "xlsx" | "csv" | "tsv") => {
    const base = safeName(doc.name || "Spreadsheet");
    if (kind === "xlsx") downloadBlob(`${base}.xlsx`, writeXlsx(wbRef.current, calc) as BlobPart, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    else downloadBlob(`${base}${wb.sheets.length > 1 ? ` - ${safeName(sheet.name)}` : ""}.${kind}`, "﻿" + sheetToCsv(wbRef.current, si, calc, kind === "csv" ? "," : "\t"), kind === "csv" ? "text/csv" : "text/tab-separated-values");
  };
  const importFile = async () => {
    const f = await pickFile(".xlsx,.xlsm,.csv,.tsv,.txt");
    if (!f) return;
    try {
      let incoming: Workbook;
      if (/\.(xlsx|xlsm)$/i.test(f.name)) incoming = await readXlsx(await f.arrayBuffer());
      else { const rows = parseCsv(await f.text(), /\.tsv$/i.test(f.name) ? "\t" : undefined); incoming = { ...blankWorkbook(), sheets: [sheetFromRows(rows, f.name.replace(/\.[^.]+$/, "").slice(0, 60))] }; }
      setDialog({ kind: "import", incoming, fileName: f.name });
    } catch (e: any) { say(e?.message || "That file couldn't be opened."); }
  };
  const newFile = async () => { try { const d = await api.create("sheet", "Untitled spreadsheet", blankWorkbook()); onOpen?.(d.id); } catch (e: any) { say(e.message); } };
  const makeCopy = async () => { try { await doc.flush(); const d = await api.create("sheet", `Copy of ${doc.name}`, wbRef.current); say("Copy made."); onOpen?.(d.id); } catch (e: any) { say(e.message); } };
  const trashFile = async () => { if (!window.confirm(`Move "${doc.name}" to the trash? You can restore it for 30 days.`)) return; try { await api.trash(id); onBack(); } catch (e: any) { say(e.message); } };
  const [starred, setStarred] = useState<boolean | null>(null);
  useEffect(() => { let alive = true; api.list("sheet").then((all) => { if (alive) setStarred(!!all.find((d) => d.id === id)?.starred); }).catch(() => {}); return () => { alive = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const toggleStar = async () => { const next = !starred; setStarred(next); try { await api.save(id, { starred: next }); } catch { setStarred(!next); } };

  // ─── Keyboard ───
  const onGridKey = (e: React.KeyboardEvent) => {
    if (edit) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const arrows: Record<string, [number, number]> = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] };
    if (arrows[k]) {
      e.preventDefault();
      if (e.altKey && k === "ArrowDown") { const v = validationAt(sheet, anchor.r, anchor.c); if (v?.kind === "list") { const el = viewport.current?.querySelector<HTMLElement>("[data-dd]"); if (el) setDdOpen(el); } return; }
      const [dr, dc] = arrows[k];
      if (mod) jump(dr, dc, e.shiftKey); else moveBy(dr, dc, e.shiftKey);
      return;
    }
    if (k === "Tab") { e.preventDefault(); moveBy(0, e.shiftKey ? -1 : 1); return; }
    if (k === "Enter") { e.preventDefault(); if (e.shiftKey) moveBy(-1, 0); else startEdit("edit"); return; }
    if (k === "F2") { e.preventDefault(); startEdit("edit"); return; }
    if (k === "Escape") { setClip(null); setPaint(null); return; }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); change((w) => clearRange(w, si, clampSel(sel), "values")); return; }
    if (k === "PageDown" || k === "PageUp") { e.preventDefault(); const rows = Math.max(1, Math.floor(bodyH / (DEFAULT_ROW_H * z)) - 1); moveBy(k === "PageDown" ? rows : -rows, 0, e.shiftKey); return; }
    if (k === "Home") { e.preventDefault(); select(mod ? { r: 0, c: 0 } : { r: anchor.r, c: 0 }); return; }
    if (k === "End") { e.preventDefault(); select(mod ? { r: used.rows - 1, c: used.cols - 1 } : { r: anchor.r, c: Math.max(0, used.cols - 1) }); return; }
    if (mod) {
      const lk = k.toLowerCase();
      const run = (fn: () => void) => { e.preventDefault(); fn(); };
      if (lk === "z" && !e.shiftKey) return run(undo);
      if (lk === "y" || (lk === "z" && e.shiftKey)) return run(redo);
      if (lk === "b") return run(() => toggle("b"));
      if (lk === "i") return run(() => toggle("i"));
      if (lk === "u") return run(() => toggle("u"));
      if (lk === "x" && e.shiftKey) return run(() => toggle("s"));
      if (lk === "a") return run(() => select({ r: 0, c: 0 }, { r: sheet.rows - 1, c: sheet.cols - 1 }, false));
      if (lk === "f") return run(() => setDialog({ kind: "find", replace: false }));
      if (lk === "h") return run(() => setDialog({ kind: "find", replace: true }));
      if (lk === "d") return run(() => fillDir("down"));
      if (lk === "r") return run(() => fillDir("right"));
      if (lk === "k") return run(() => setDialog({ kind: "link" }));
      if (lk === "p") return run(() => setDialog({ kind: "print" }));
      if (lk === "s") return run(() => { void doc.flush(); say("Saved."); });
      if (k === ";" || k === ":") return run(() => insertNow(e.shiftKey || k === ":" ? "time" : "date"));
      if (k === "`") return run(() => setShowFormulas((x) => !x));
      if (k === "\\") return run(() => style(() => ({})));
      if (k === "$" || (e.shiftKey && k === "4")) return run(() => setNf("$#,##0.00"));
      if (k === "%" || (e.shiftKey && k === "5")) return run(() => setNf("0.00%"));
      if (lk === "v" && e.shiftKey) { pasteMode.current = "values"; return; }
      if (k === " ") return run(() => select({ r: 0, c: anchor.c }, { r: sheet.rows - 1, c: focus.c }, false));
      return;
    }
    if (e.shiftKey && k === " ") { e.preventDefault(); select({ r: anchor.r, c: 0 }, { r: focus.r, c: sheet.cols - 1 }, false); return; }
    if (k.length === 1 && !e.altKey) { e.preventDefault(); startEdit("enter", k); }
  };

  // Formula autocomplete
  const editCaret = () => { const el = edit?.where === "bar" ? bar.current : editor.current; return el ? el.selectionStart ?? el.value.length : edit?.text.length ?? 0; };
  const [caret, setCaret] = useState(0);
  const suggestions = useMemo(() => {
    if (!edit || !edit.text.startsWith("=")) return [];
    const before = edit.text.slice(0, caret);
    const m = /(^|[^A-Za-z0-9_."!$:])([A-Za-z][A-Za-z0-9.]*)$/.exec(before);
    if (!m || (before.split('"').length - 1) % 2) return [];
    const q = m[2].toUpperCase();
    return FUNCTION_NAMES.filter((f) => f.startsWith(q) && f !== q).slice(0, 8);
  }, [edit, caret]);
  const fnHelp = useMemo(() => {
    if (!edit || !edit.text.startsWith("=")) return "";
    const before = edit.text.slice(0, caret);
    let depth = 0;
    for (let i = before.length - 1; i >= 0; i--) {
      const ch = before[i];
      if (ch === ")") depth++;
      else if (ch === "(") { if (depth === 0) { const m = /([A-Za-z][A-Za-z0-9.]*)$/.exec(before.slice(0, i)); return m ? FUNCTION_HELP[m[1].toUpperCase()] || `${m[1].toUpperCase()}(…)` : ""; } depth--; }
    }
    return "";
  }, [edit, caret]);
  const acceptSuggestion = (name: string) => {
    if (!edit) return;
    const before = edit.text.slice(0, caret), after = edit.text.slice(caret);
    const nb = before.replace(/[A-Za-z][A-Za-z0-9.]*$/, `${name}(`);
    flushSync(() => { setEdit({ ...edit, text: nb + after }); setSuggest(0); });
    const el = edit.where === "bar" ? bar.current : editor.current;
    el?.focus(); el?.setSelectionRange(nb.length, nb.length); setCaret(nb.length);
  };
  const canPoint = () => {
    if (!edit || !edit.text.startsWith("=")) return false;
    const c = editCaret();
    if (pointing.current && pointing.current.end === c) return true;
    return /[=(,+\-*/^&<>:;\s]$/.test(edit.text.slice(0, c));
  };
  const insertRef = (g: Range, keepAnchor?: Pos) => {
    if (!edit) return;
    const label = rangeLabel(g);
    const c = editCaret();
    const p = pointing.current && pointing.current.end === c ? pointing.current : { start: c, end: c, anchor: keepAnchor || { r: g.r1, c: g.c1 } };
    const text = edit.text.slice(0, p.start) + label + edit.text.slice(p.end);
    pointing.current = { start: p.start, end: p.start + label.length, anchor: p.anchor };
    flushSync(() => setEdit({ ...edit, text, mode: "enter" }));
    const pos = p.start + label.length;
    const el = edit.where === "bar" ? bar.current : editor.current;
    el?.focus({ preventScroll: true }); el?.setSelectionRange(pos, pos); setCaret(pos);
  };
  const onEditorKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!edit) return;
    if (suggestions.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSuggest((s) => (s + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSuggest((s) => (s - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); acceptSuggestion(suggestions[Math.min(suggest, suggestions.length - 1)]); return; }
    }
    if (e.key === "Enter" && e.altKey) {
      e.preventDefault();
      const el = e.currentTarget, s = el.selectionStart, en = el.selectionEnd;
      const text = edit.text.slice(0, s) + "\n" + edit.text.slice(en);
      setEdit({ ...edit, text });
      window.setTimeout(() => el.setSelectionRange(s + 1, s + 1), 0);
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); commitEdit(e.shiftKey ? "up" : "down", e.ctrlKey || e.metaKey); return; }
    if (e.key === "Tab") { e.preventDefault(); commitEdit(e.shiftKey ? "left" : "right"); return; }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); return; }
    const arrows: Record<string, [number, number]> = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] };
    if (arrows[e.key] && edit.mode === "enter" && edit.where === "cell") {
      e.preventDefault();
      const [dr, dc] = arrows[e.key];
      if (canPoint()) {
        const from = pointing.current?.anchor || { r: edit.r, c: edit.c };
        const p = nextVisible(from.r, from.c, dr, dc);
        insertRef({ r1: p.r, c1: p.c, r2: p.r, c2: p.c }, p);
        if (pointing.current) pointing.current.anchor = p;
        return;
      }
      commitEdit(dr > 0 ? "down" : dr < 0 ? "up" : dc > 0 ? "right" : "left");
    }
  };

  // ─── Pointer ───
  const drag = useRef<null | { kind: "select" | "fill" | "point" | "col" | "row" | "resize-col" | "resize-row" | "chart-move" | "chart-size"; start: Pos; x0: number; y0: number; i?: number; base?: number; chart?: { id: string; x: number; y: number; w: number; h: number }; touch?: boolean; moved?: boolean }>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("textarea, [data-no-grid]")) return;
    if (e.button === 2) return;
    const touch = e.pointerType === "touch";
    const resize = t.closest<HTMLElement>("[data-resize]");
    if (resize) {
      e.preventDefault();
      const [axis, i] = resize.dataset.resize!.split(":");
      const idx = Number(i);
      const base = axis === "col" ? sheet.colW[idx] ?? DEFAULT_COL_W : sheet.rowH[idx] ?? DEFAULT_ROW_H;
      drag.current = { kind: axis === "col" ? "resize-col" : "resize-row", start: { r: 0, c: 0 }, x0: e.clientX, y0: e.clientY, i: idx, base };
      viewport.current?.setPointerCapture(e.pointerId);
      return;
    }
    const chartEl = t.closest<HTMLElement>("[data-chart]");
    if (chartEl) {
      e.preventDefault();
      const ch = sheet.charts.find((c) => c.id === chartEl.dataset.chart);
      if (!ch) return;
      if (edit) commitEdit("none");
      setChartSel(ch.id);
      drag.current = { kind: t.closest("[data-chart-size]") ? "chart-size" : "chart-move", start: { r: 0, c: 0 }, x0: e.clientX, y0: e.clientY, chart: { id: ch.id, x: ch.x, y: ch.y, w: ch.w, h: ch.h } };
      viewport.current?.setPointerCapture(e.pointerId);
      viewport.current?.focus({ preventScroll: true });
      return;
    }
    if (t.closest("[data-check]")) {
      e.preventDefault();
      const [r, c] = t.closest<HTMLElement>("[data-check]")!.dataset.check!.split(":").map(Number);
      if (edit) commitEdit("none");
      select({ r, c }, { r, c }, false);
      toggleCheck(r, c);
      return;
    }
    if (t.closest("[data-dd]")) { e.preventDefault(); setDdOpen(t.closest<HTMLElement>("[data-dd]")); return; }
    const fb = t.closest<HTMLElement>("[data-filter]");
    if (fb) { e.preventDefault(); setFilterOpen({ c: Number(fb.dataset.filter), el: fb }); return; }
    const p = pointToCell(e.clientX, e.clientY);
    setChartSel(null);
    if (t.closest("[data-fill]")) {
      e.preventDefault();
      drag.current = { kind: "fill", start: p, x0: e.clientX, y0: e.clientY };
      viewport.current?.setPointerCapture(e.pointerId);
      return;
    }
    // Clicking cells while typing a formula puts their address in it.
    if (edit && !p.inColHead && !p.inRowHead && canPoint() && !(p.r === edit.r && p.c === edit.c)) {
      e.preventDefault();
      pointing.current = pointing.current && pointing.current.end === editCaret() ? pointing.current : null;
      insertRef({ r1: p.r, c1: p.c, r2: p.r, c2: p.c }, p);
      drag.current = { kind: "point", start: p, x0: e.clientX, y0: e.clientY };
      viewport.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (edit) { if (!commitEdit("none")) return; }
    if (p.inColHead && p.inRowHead) { select({ r: 0, c: 0 }, { r: sheet.rows - 1, c: sheet.cols - 1 }, false); return; }
    if (touch) { drag.current = { kind: p.inColHead ? "col" : p.inRowHead ? "row" : "select", start: p, x0: e.clientX, y0: e.clientY, touch: true }; return; }
    e.preventDefault();
    viewport.current?.focus({ preventScroll: true });
    if (p.inColHead) {
      const a = e.shiftKey ? anchor : { r: 0, c: p.c };
      setAnchor({ r: 0, c: a.c }); setFocus({ r: sheet.rows - 1, c: p.c });
      drag.current = { kind: "col", start: { r: 0, c: a.c }, x0: e.clientX, y0: e.clientY };
    } else if (p.inRowHead) {
      const a = e.shiftKey ? anchor : { r: p.r, c: 0 };
      setAnchor({ r: a.r, c: 0 }); setFocus({ r: p.r, c: sheet.cols - 1 });
      drag.current = { kind: "row", start: { r: a.r, c: 0 }, x0: e.clientX, y0: e.clientY };
    } else {
      if (e.shiftKey) setFocus({ r: p.r, c: p.c }); else { setAnchor({ r: p.r, c: p.c }); setFocus({ r: p.r, c: p.c }); }
      drag.current = { kind: "select", start: { r: p.r, c: p.c }, x0: e.clientX, y0: e.clientY };
    }
    viewport.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.touch) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) d.moved = true; return; }
    if (d.kind === "resize-col" || d.kind === "resize-row") {
      const delta = (d.kind === "resize-col" ? e.clientX - d.x0 : e.clientY - d.y0) / z;
      setLive({ axis: d.kind === "resize-col" ? "col" : "row", i: d.i!, px: Math.max(d.kind === "resize-col" ? 20 : 14, Math.round(d.base! + delta)) });
      return;
    }
    if (d.kind === "chart-move" || d.kind === "chart-size") {
      const c = d.chart!, dx = (e.clientX - d.x0) / z, dy = (e.clientY - d.y0) / z;
      setChartLive(d.kind === "chart-move" ? { ...c, x: Math.max(0, Math.round(c.x + dx)), y: Math.max(0, Math.round(c.y + dy)) } : { ...c, w: Math.max(200, Math.round(c.w + dx)), h: Math.max(150, Math.round(c.h + dy)) });
      return;
    }
    // Scroll when dragging past the edge.
    const rect = scroller.current!.getBoundingClientRect();
    if (e.clientX > rect.right - 10) scroller.current!.scrollLeft += 24; else if (e.clientX < rect.left + HEAD_W + fw && sx > 0 && d.kind !== "row") scroller.current!.scrollLeft -= 24;
    if (e.clientY > rect.bottom - 10) scroller.current!.scrollTop += 24; else if (e.clientY < rect.top + HEAD_H + fh && sy > 0 && d.kind !== "col") scroller.current!.scrollTop -= 24;
    const p = pointToCell(e.clientX, e.clientY);
    if (d.kind === "select") setFocus({ r: p.r, c: p.c });
    else if (d.kind === "col") setFocus({ r: sheet.rows - 1, c: p.c });
    else if (d.kind === "row") setFocus({ r: p.r, c: sheet.cols - 1 });
    else if (d.kind === "fill") setFillTo({ r: p.r, c: p.c });
    else if (d.kind === "point" && pointing.current) insertRef(norm(pointing.current.anchor, p));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    try { viewport.current?.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    if (!d) return;
    if (d.touch) {
      if (d.moved) return;
      const p = d.start;
      if (d.kind === "col") { select({ r: 0, c: p.c }, { r: sheet.rows - 1, c: p.c }, false); return; }
      if (d.kind === "row") { select({ r: p.r, c: 0 }, { r: p.r, c: sheet.cols - 1 }, false); return; }
      if (p.r === anchor.r && p.c === anchor.c && p.r === focus.r && p.c === focus.c) startEdit("edit");
      else select({ r: p.r, c: p.c }, { r: p.r, c: p.c }, false);
      return;
    }
    if (d.kind === "resize-col" || d.kind === "resize-row") {
      const l = live; setLive(null);
      if (!l) return;
      const axis = l.axis;
      const many = axis === "col" ? wholeCols && l.i >= sel.c1 && l.i <= sel.c2 : wholeRows && l.i >= sel.r1 && l.i <= sel.r2;
      change((w) => updateSheet(w, si, (s) => {
        const m = { ...(axis === "col" ? s.colW : s.rowH) };
        if (many) for (let i = axis === "col" ? sel.c1 : sel.r1; i <= (axis === "col" ? sel.c2 : Math.min(sel.r2, sel.r1 + 2000)); i++) m[i] = l.px; else m[l.i] = l.px;
        return axis === "col" ? { ...s, colW: m } : { ...s, rowH: m };
      }));
      return;
    }
    if (d.kind === "chart-move" || d.kind === "chart-size") {
      const l = chartLive; setChartLive(null);
      if (l && (l.x !== d.chart!.x || l.y !== d.chart!.y || l.w !== d.chart!.w || l.h !== d.chart!.h)) change((w) => updateSheet(w, si, (s) => ({ ...s, charts: s.charts.map((c) => (c.id === l.id ? { ...c, x: l.x, y: l.y, w: l.w, h: l.h } : c)) })));
      return;
    }
    if (d.kind === "fill" && fillTo) {
      const f = fillTo; setFillTo(null);
      let target: Range | null = null;
      const down = f.r - sel.r2, up = sel.r1 - f.r, right = f.c - sel.c2, left = sel.c1 - f.c;
      const best = Math.max(down, up, right, left);
      if (best > 0) {
        if (best === down) target = { ...sel, r2: f.r }; else if (best === up) target = { ...sel, r1: f.r };
        else if (best === right) target = { ...sel, c2: f.c }; else target = { ...sel, c1: f.c };
      }
      if (target) { const tg = target; change((w) => fillRange(w, si, sel, tg)); setAnchor({ r: tg.r1, c: tg.c1 }); setFocus({ r: tg.r2, c: tg.c2 }); }
      return;
    }
    if (d.kind === "fill") { setFillTo(null); return; }
    if (paint && d.kind === "select") { const st = paint; setPaint(null); change((w) => setStyle(w, si, clampSel(norm(anchor, focus)), () => ({ ...st }))); }
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const resize = t.closest<HTMLElement>("[data-resize]");
    if (resize) {
      const [axis, i] = resize.dataset.resize!.split(":");
      if (axis === "col") { const c = Number(i); const cols = wholeCols && c >= sel.c1 && c <= sel.c2 ? Array.from({ length: sel.c2 - sel.c1 + 1 }, (_, k) => sel.c1 + k) : [c]; change((w) => updateSheet(w, si, (s) => { const m = { ...s.colW }; for (const cc of cols) m[cc] = fitColumn(s, si, cc, calc); return { ...s, colW: m }; })); }
      else change((w) => updateSheet(w, si, (s) => { const m = { ...s.rowH }; delete m[Number(i)]; return { ...s, rowH: m }; }));
      return;
    }
    const chartEl = t.closest<HTMLElement>("[data-chart]");
    if (chartEl) { setDialog({ kind: "chart", chartId: chartEl.dataset.chart! }); return; }
    if (t.closest("textarea, [data-check], [data-dd], [data-filter], [data-fill], [data-no-grid]")) return;
    const p = pointToCell(e.clientX, e.clientY);
    if (p.inColHead || p.inRowHead) return;
    startEdit("edit");
  };
  const onContextMenu = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("textarea")) return;
    e.preventDefault();
    const p = pointToCell(e.clientX, e.clientY);
    if (edit) commitEdit("none");
    const kind = p.inColHead ? "col" : p.inRowHead ? "row" : "cell";
    const inside = p.r >= sel.r1 && p.r <= sel.r2 && p.c >= sel.c1 && p.c <= sel.c2;
    if (!inside) {
      if (kind === "col") select({ r: 0, c: p.c }, { r: sheet.rows - 1, c: p.c }, false);
      else if (kind === "row") select({ r: p.r, c: 0 }, { r: p.r, c: sheet.cols - 1 }, false);
      else select({ r: p.r, c: p.c }, { r: p.r, c: p.c }, false);
    }
    setCtx({ x: e.clientX, y: e.clientY, kind });
  };

  // ─── Drawing ───
  const cond = useMemo(() => condStyles(sheet, si, calc), [sheet, si, calc]);
  const theme = wb.theme ? THEMES[wb.theme] : null;
  const filterHeader = sheet.filter ? sheet.filter.r1 : -1;
  const refBoxes = useMemo(() => (edit ? formulaRefs(edit.text).filter((x) => !x.sheet || x.sheet.toLowerCase() === sheet.name.toLowerCase()) : []), [edit, sheet.name]);
  const REF_COLORS = ["#1a73e8", "#e8710a", "#9334e6", "#188038", "#d93025", "#12b5cb"];

  const renderCell = (r: number, c: number, ox: number, oy: number, quadCols: number[]): ReactNode => {
    const m = mergeAt(sheet, r, c);
    const cell = sheet.cells[key(r, c)];
    const cs = cond.get(key(r, c));
    if (!cell && !cs && !(filterHeader === r && sheet.filter && c >= sheet.filter.c1 && c <= sheet.filter.c2)) return null;
    let w = colX[c + 1] - colX[c], h = rowY[r + 1] - rowY[r];
    if (m) { w = colX[m.c2 + 1] - colX[m.c1]; h = rowY[m.r2 + 1] - rowY[m.r1]; }
    const st: CellStyle = { ...(cell?.s || {}), ...(cs || {}) };
    const raw = cell?.v || "";
    const v: Scalar = raw ? calc.value(si, r, c) : null;
    const isFormula = raw.startsWith("=") && raw.length > 1;
    let shown = showFormulas && isFormula ? raw : display(v, st, raw);
    const check = st.nf === "checkbox";
    const err = isErr(v);
    const align = st.h || (showFormulas && isFormula ? "left" : typeof v === "number" ? "right" : typeof v === "boolean" || err || check ? "center" : "left");
    // Text spills into empty cells to its right, like in Excel and Google Sheets.
    let spill = w;
    if (!m && !st.w && align === "left" && typeof v === "string" && shown) {
      const need = Math.min(3000, shown.length * 8 * z + 8);
      if (need > w) {
        let nc = c + 1;
        const last = quadCols[quadCols.length - 1] ?? c;
        const stopAt = c < sheet.freezeC ? sheet.freezeC : Math.max(last + 10, c + 1);
        while (spill < need && nc < sheet.cols && nc < stopAt && !sheet.cells[key(r, nc)]?.v && !mergeAt(sheet, r, nc)) { spill += colX[nc + 1] - colX[nc]; nc++; }
      }
    }
    if (typeof v === "number" && !st.w && !(showFormulas && isFormula) && shown.length * 7.2 * z > w + 2 && !check) shown = "#".repeat(Math.max(1, Math.floor(w / (7.2 * z))));
    const fontPx = ((st.z || 10) * 4 / 3) * z;
    const bg = st.bg || (theme && r > 0 && r % 2 === 0 && raw ? theme.band : undefined);
    const box: CSSProperties = {
      position: "absolute", left: colX[m ? m.c1 : c] - ox, top: rowY[m ? m.r1 : r] - oy, width: spill > w ? spill : w, height: h,
      background: bg || (spill > w || m ? "#fff" : undefined), zIndex: spill > w ? 2 : m ? 2 : 1,
      display: "flex", alignItems: st.v === "top" ? "flex-start" : st.v === "middle" ? "center" : "flex-end",
      justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
      padding: `0 ${3 * z}px 0 ${(3 + (st.ind || 0) * 12) * z}px`, overflow: "hidden",
      fontFamily: st.f ? `'${st.f}', Arial, sans-serif` : "Arial, sans-serif", fontSize: fontPx, lineHeight: 1.25,
      color: err ? "#b91c1c" : st.c || (cell?.link ? "#1a56db" : "#111827"), fontWeight: st.b ? 700 : 400, fontStyle: st.i ? "italic" : undefined,
      textDecoration: [st.u || cell?.link ? "underline" : "", st.s ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
      whiteSpace: st.w ? "pre-wrap" : "pre", wordBreak: st.w ? "break-word" : undefined, textAlign: align,
      boxShadow: m ? "inset 0 0 0 0.5px #e2e8f0" : undefined,
    };
    const bd = st.bd;
    return <div key={`${r}:${c}`} style={box} title={cell?.n ? cell.n : err ? errHelp((v as { err: string }).err) : undefined}>
      {cs?.bar !== undefined && <div style={{ position: "absolute", left: 1, top: 3, bottom: 3, width: `${Math.round(cs.bar * 100)}%`, background: `linear-gradient(90deg, ${cs.barColor}, ${cs.barColor}55)`, borderRadius: 2 }} />}
      {check ? <span data-check={`${r}:${c}`} role="checkbox" aria-checked={v === true} className="relative inline-flex cursor-pointer items-center justify-center rounded-[3px] border-2" style={{ width: 14 * z, height: 14 * z, borderColor: v === true ? st.c || "#1a73e8" : "#5f6368", background: v === true ? st.c || "#1a73e8" : "#fff" }}>{v === true && <svg viewBox="0 0 12 12" width={10 * z} height={10 * z}><path d="M2 6.5 5 9l5-6" stroke="#fff" strokeWidth="2" fill="none" /></svg>}</span>
        : <span className="relative" style={st.rot ? { display: "inline-block", transform: `rotate(${-st.rot}deg)` } : undefined}>{shown}</span>}
      {bd && <div className="pointer-events-none absolute inset-0" style={{ borderTop: bd.t ? `1px solid ${bd.t}` : undefined, borderRight: bd.r ? `1px solid ${bd.r}` : undefined, borderBottom: bd.b ? `1px solid ${bd.b}` : undefined, borderLeft: bd.l ? `1px solid ${bd.l}` : undefined, marginTop: bd.t ? -1 : 0, marginLeft: bd.l ? -1 : 0 }} />}
      {cell?.n && <span className="pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[6px] border-t-[6px] border-l-transparent border-t-amber-500" />}
      {err && <span className="pointer-events-none absolute left-0 top-0 h-0 w-0 border-r-[6px] border-t-[6px] border-r-transparent border-t-rose-600" />}
      {filterHeader === r && sheet.filter && c >= sheet.filter.c1 && c <= sheet.filter.c2 && <button type="button" data-filter={c} aria-label={`Filter column ${colName(c)}`} className={`absolute right-0.5 top-1/2 z-10 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded ${sheet.filter.hide[c]?.length || sheet.filter.sort?.c === c ? "bg-emerald-600 text-white" : "bg-white text-slate-600 shadow"}`}><Filter size={10} /></button>}
    </div>;
  };

  const rectOf = (g: Range, ox: number, oy: number): CSSProperties => ({ position: "absolute", left: colX[g.c1] - ox, top: rowY[g.r1] - oy, width: colX[Math.min(sheet.cols, g.c2 + 1)] - colX[g.c1], height: rowY[Math.min(sheet.rows, g.r2 + 1)] - rowY[g.r1] });
  const quadrant = (rows: number[], cols: number[], frozenRow: boolean, frozenCol: boolean, key2: string) => {
    const left = HEAD_W + (frozenCol ? 0 : fw), top = HEAD_H + (frozenRow ? 0 : fh);
    const width = frozenCol ? fw : bodyW, height = frozenRow ? fh : bodyH;
    if (width <= 0 || height <= 0) return null;
    const ox = frozenCol ? 0 : fw + sx, oy = frozenRow ? 0 : fh + sy;
    const items: ReactNode[] = [];
    const seenMerge = new Set<string>();
    // Merged cells whose top-left is out of view still show.
    if (rows.length && cols.length) {
      const rr = { r1: rows[0], r2: rows[rows.length - 1], c1: cols[0], c2: cols[cols.length - 1] };
      for (const m of sheet.merges) if (m.r1 <= rr.r2 && m.r2 >= rr.r1 && m.c1 <= rr.c2 && m.c2 >= rr.c1) { seenMerge.add(`${m.r1}:${m.c1}`); items.push(renderCell(m.r1, m.c1, ox, oy, cols)); }
    }
    for (const r of rows) for (const c of cols) { const m = mergeAt(sheet, r, c); if (m) continue; items.push(renderCell(r, c, ox, oy, cols)); }
    const grid: ReactNode[] = [];
    if (sheet.grid) {
      for (const c of cols) grid.push(<div key={`v${c}`} style={{ position: "absolute", left: colX[c + 1] - ox - 1, top: 0, width: 1, height, background: "#e2e8f0" }} />);
      for (const r of rows) grid.push(<div key={`h${r}`} style={{ position: "absolute", top: rowY[r + 1] - oy - 1, left: 0, height: 1, width, background: "#e2e8f0" }} />);
    }
    const selBox = rectOf(sel, ox, oy);
    const act = mergeAt(sheet, anchor.r, anchor.c) || { r1: anchor.r, c1: anchor.c, r2: anchor.r, c2: anchor.c };
    const multi = sel.r2 > sel.r1 || sel.c2 > sel.c1;
    const showFill = !edit && cols.includes(Math.min(sel.c2, sheet.cols - 1)) && rows.includes(Math.min(sel.r2, sheet.rows - 1)) && !wholeCols && !wholeRows;
    const fillBox = fillTo ? (() => { const down = fillTo.r - sel.r2, up = sel.r1 - fillTo.r, right = fillTo.c - sel.c2, left2 = sel.c1 - fillTo.c; const best = Math.max(down, up, right, left2); if (best <= 0) return null; const g = best === down ? { ...sel, r2: fillTo.r } : best === up ? { ...sel, r1: fillTo.r } : best === right ? { ...sel, c2: fillTo.c } : { ...sel, c1: fillTo.c }; return rectOf(g, ox, oy); })() : null;
    const clipBox = clip && clip.si === si ? rectOf(clip.range, ox, oy) : null;
    const hit = findHit && findHit.si === si ? rectOf({ r1: findHit.r, c1: findHit.c, r2: findHit.r, c2: findHit.c }, ox, oy) : null;
    const lastRow = !frozenRow && rows.length && rows[rows.length - 1] >= sheet.rows - 1;
    return <div key={key2} style={{ position: "absolute", left, top, width, height, overflow: "hidden" }}>
      {grid}
      {items}
      {refBoxes.map((rb, i) => <div key={`ref${i}`} className="pointer-events-none" style={{ ...rectOf(rb, ox, oy), zIndex: 4, border: `2px dashed ${REF_COLORS[i % REF_COLORS.length]}`, background: `${REF_COLORS[i % REF_COLORS.length]}14` }} />)}
      {multi && <div className="pointer-events-none" style={{ ...selBox, zIndex: 3, background: "rgba(26,115,232,0.10)", border: "1px solid #1a73e8" }} />}
      {!edit && <div className="pointer-events-none" style={{ ...rectOf(act, ox, oy), zIndex: 5, border: `2px solid ${paint ? "#16a34a" : "#1a73e8"}`, marginLeft: -1, marginTop: -1, width: (rectOf(act, ox, oy).width as number) + 1, height: (rectOf(act, ox, oy).height as number) + 1 }} />}
      {clipBox && <div className="pointer-events-none" style={{ ...clipBox, zIndex: 5, border: "2px dashed #1a73e8" }} />}
      {hit && <div className="pointer-events-none" style={{ ...hit, zIndex: 5, background: "rgba(250,204,21,0.35)", border: "2px solid #eab308" }} />}
      {fillBox && <div className="pointer-events-none" style={{ ...fillBox, zIndex: 5, border: "1px dashed #334155" }} />}
      {showFill && <span data-fill="" className="absolute rounded-sm border border-white bg-[#1a73e8]" style={{ left: colX[sel.c2 + 1] - ox - 4, top: rowY[sel.r2 + 1] - oy - 4, width: 7, height: 7, zIndex: 7, cursor: "crosshair", touchAction: "none", transform: "scale(1.15)" }} />}
      {lastRow && <div data-no-grid="" className="absolute flex items-center gap-2 px-3 py-3 text-xs text-slate-600" style={{ left: 0, top: rowY[sheet.rows] - oy }}>
        <button type="button" onClick={() => change((w) => updateSheet(w, si, (s) => ({ ...s, rows: Math.min(MAX_ROWS, s.rows + 1000) })))} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-50">Add 1,000 more rows</button>
        {sheet.rows >= MAX_ROWS && <span>That's the most rows a sheet can have.</span>}
      </div>}
    </div>;
  };

  const chartLayer = () => !sheet.charts.length ? null : <div key="charts" style={{ position: "absolute", left: HEAD_W, top: HEAD_H, width: Math.max(0, vw - HEAD_W), height: Math.max(0, vh - HEAD_H), overflow: "hidden", pointerEvents: "none" }}>{sheet.charts.map((ch0) => {
      const ch = chartLive?.id === ch0.id ? { ...ch0, ...chartLive } : ch0;
      const data = chartData(wb, si, calc, ch);
      const w = Math.round(ch.w * z), h = Math.round(ch.h * z);
      return <div key={ch.id} data-chart={ch.id} className={`absolute cursor-move rounded-md bg-white shadow-md ${chartSel === ch.id ? "ring-2 ring-sky-500" : "ring-1 ring-slate-200"}`} style={{ left: ch.x * z - sx, top: ch.y * z - sy, width: w, height: h, zIndex: 6, pointerEvents: "auto" }}>
        <ChartSvg kind={ch.kind} labels={data.labels} series={data.series} title={ch.title} legend={ch.legend} stacked={ch.stacked} width={w} height={h} colors={ch.colors} />
        {chartSel === ch.id && <>
          <span data-chart-size="" className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-sky-600" style={{ touchAction: "none" }} />
          <div data-no-grid="" className="absolute right-1 top-1 flex gap-1">
            <button type="button" onClick={() => setDialog({ kind: "chart", chartId: ch.id })} className="rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-bold text-slate-700 shadow ring-1 ring-slate-200">Edit</button>
            <button type="button" onClick={() => { change((w2) => updateSheet(w2, si, (s) => ({ ...s, charts: s.charts.filter((c) => c.id !== ch.id) }))); setChartSel(null); }} className="rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-bold text-rose-600 shadow ring-1 ring-slate-200">Delete</button>
          </div>
        </>}
      </div>;
  })}</div>;

  const colHeads = (cols: number[], frozen: boolean) => {
    const ox = frozen ? 0 : fw + sx;
    const left = HEAD_W + (frozen ? 0 : fw), width = frozen ? fw : bodyW;
    if (width <= 0) return null;
    return <div key={frozen ? "chf" : "chb"} style={{ position: "absolute", left, top: 0, width, height: HEAD_H, overflow: "hidden" }}>
      {cols.map((c) => {
        const on = c >= sel.c1 && c <= sel.c2;
        const full = wholeCols && on;
        return <div key={c} className={`absolute flex select-none items-center justify-center border-b border-r text-[11px] ${full ? "bg-[#1a73e8] font-bold text-white" : on ? "bg-[#d3e3fd] font-bold text-slate-800" : "bg-slate-50 text-slate-500"} border-slate-200`} style={{ left: colX[c] - ox, width: colX[c + 1] - colX[c], height: HEAD_H }}>
          {colName(c)}
          {(hiddenCols.has(c + 1)) && <span title="Hidden columns" className="absolute right-0 top-1 text-[9px] text-slate-400">◂▸</span>}
          <span data-resize={`col:${c}`} className="absolute right-[-3px] top-0 z-10 h-full w-[7px] cursor-col-resize hover:bg-sky-400/60" style={{ touchAction: "none" }} />
        </div>;
      })}
    </div>;
  };
  const rowHeads = (rows: number[], frozen: boolean) => {
    const oy = frozen ? 0 : fh + sy;
    const top = HEAD_H + (frozen ? 0 : fh), height = frozen ? fh : bodyH;
    if (height <= 0) return null;
    return <div key={frozen ? "rhf" : "rhb"} style={{ position: "absolute", left: 0, top, width: HEAD_W, height, overflow: "hidden" }}>
      {rows.map((r) => {
        const on = r >= sel.r1 && r <= sel.r2;
        const full = wholeRows && on;
        return <div key={r} className={`absolute flex select-none items-center justify-center border-b border-r text-[11px] ${full ? "bg-[#1a73e8] font-bold text-white" : on ? "bg-[#d3e3fd] font-bold text-slate-800" : "bg-slate-50 text-slate-500"} border-slate-200`} style={{ top: rowY[r] - oy, height: rowY[r + 1] - rowY[r], width: HEAD_W }}>
          {r + 1}
          <span data-resize={`row:${r}`} className="absolute bottom-[-3px] left-0 z-10 h-[7px] w-full cursor-row-resize hover:bg-sky-400/60" style={{ touchAction: "none" }} />
        </div>;
      })}
    </div>;
  };

  // The box you type in, over the cell.
  const editorBox = (() => {
    if (!edit) return null;
    const b = cellBox(edit.r, edit.c);
    const m = mergeAt(sheet, edit.r, edit.c);
    const w0 = m ? colX[m.c2 + 1] - colX[m.c1] : b.w, h0 = m ? rowY[m.r2 + 1] - rowY[m.r1] : b.h;
    const st = sheet.cells[key(edit.r, edit.c)]?.s || {};
    const fontPx = ((st.z || 10) * 4 / 3) * z;
    const lines = edit.text.split("\n");
    const longest = Math.max(...lines.map((l) => l.length));
    const w = Math.min(Math.max(w0 + 2, longest * fontPx * 0.6 + 16), vw - b.x - 4);
    const h = Math.max(h0 + 2, lines.length * fontPx * 1.3 + 8);
    return { x: b.x - 1, y: b.y - 1, w, h, fontPx, st };
  })();

  const stats = useMemo(() => (sel.r2 > sel.r1 || sel.c2 > sel.c1 ? selectionStats(calc, si, { r1: sel.r1, c1: sel.c1, r2: Math.min(sel.r2, used.rows - 1), c2: Math.min(sel.c2, used.cols - 1) }) : null), [calc, si, sel, used]);
  const fmtStat = (n: number | null) => (n === null ? "—" : display(n, activeCell?.s?.nf && activeCell.s.nf !== "checkbox" ? activeCell.s : { nf: "#,##0.##" }).replace(/\.$/, ""));
  const statText = stats && stats.count > 0 ? ({ sum: `Sum: ${fmtStat(stats.sum)}`, avg: `Average: ${fmtStat(stats.avg)}`, min: `Min: ${fmtStat(stats.min)}`, max: `Max: ${fmtStat(stats.max)}`, count: `Count: ${stats.count}`, numbers: `Count numbers: ${stats.numbers}` } as const)[stats.numbers ? statKind : "count"] : "";

  // ─── Menus ───
  const numberItems = (): MenuItem[] => [...NUMBER_FORMATS.map((f): MenuItem => ({ label: f.label, hint: f.sample, checked: (ast.nf || "") === f.code, onClick: () => (f.code === "checkbox" ? insertCheckbox() : setNf(f.code)) })), { sep: true }, { label: "Custom number format…", onClick: () => setDialog({ kind: "format" }) }];
  const alignItems = (): MenuItem[] => [
    { label: "Left", icon: <AlignLeft size={14} />, checked: ast.h === "left", onClick: () => style({ h: "left" }) }, { label: "Center", icon: <AlignCenter size={14} />, checked: ast.h === "center", onClick: () => style({ h: "center" }) }, { label: "Right", icon: <AlignRight size={14} />, checked: ast.h === "right", onClick: () => style({ h: "right" }) }, { label: "Automatic", onClick: () => style({ h: undefined }) },
    { sep: true }, { label: "Top", icon: <ArrowUpToLine size={14} />, checked: ast.v === "top", onClick: () => style({ v: "top" }) }, { label: "Middle", icon: <MoveVertical size={14} />, checked: ast.v === "middle", onClick: () => style({ v: "middle" }) }, { label: "Bottom", icon: <ArrowDownToLine size={14} />, checked: !ast.v || ast.v === "bottom", onClick: () => style({ v: undefined }) },
    { sep: true }, { label: "Increase indent", onClick: () => style((o) => ({ ...o, ind: Math.min(10, (o.ind || 0) + 1) })) }, { label: "Decrease indent", onClick: () => style((o) => ({ ...o, ind: Math.max(0, (o.ind || 0) - 1) || undefined })) },
  ];
  const mergeItems = (): MenuItem[] => [{ label: "Merge all", onClick: () => change((w) => mergeCells(w, si, clampSel(sel), "all")) }, { label: "Merge horizontally", onClick: () => change((w) => mergeCells(w, si, clampSel(sel), "horizontal")) }, { label: "Merge vertically", onClick: () => change((w) => mergeCells(w, si, clampSel(sel), "vertical")) }, { label: "Unmerge", onClick: () => change((w) => mergeCells(w, si, clampSel(sel), "unmerge")) }];
  const rotateItems = (): MenuItem[] => [0, 45, 90, -45, -90].map((d) => ({ label: d === 0 ? "None" : `${d > 0 ? "Tilt up" : "Tilt down"} ${Math.abs(d)}°`, checked: (ast.rot || 0) === d, onClick: () => style({ rot: d || undefined }) }));
  const freezeItems = (): MenuItem[] => [
    { label: "No rows", checked: sheet.freezeR === 0, onClick: () => freeze("row", 0) }, { label: "1 row", checked: sheet.freezeR === 1, onClick: () => freeze("row", 1) }, { label: "2 rows", checked: sheet.freezeR === 2, onClick: () => freeze("row", 2) }, { label: `Up to row ${anchor.r + 1}`, onClick: () => freeze("row", anchor.r + 1) },
    { sep: true }, { label: "No columns", checked: sheet.freezeC === 0, onClick: () => freeze("col", 0) }, { label: "1 column", checked: sheet.freezeC === 1, onClick: () => freeze("col", 1) }, { label: "2 columns", checked: sheet.freezeC === 2, onClick: () => freeze("col", 2) }, { label: `Up to column ${colName(anchor.c)}`, onClick: () => freeze("col", anchor.c + 1) },
  ];
  const fnItems = (): MenuItem[] => [...["SUM", "AVERAGE", "COUNT", "MAX", "MIN", "IF", "COUNTIF", "SUMIF", "VLOOKUP", "XLOOKUP", "ROUND", "TODAY"].map((f): MenuItem => ({ label: f, hint: (FUNCTION_HELP[f] || "").split("—")[1]?.trim(), onClick: () => insertFunction(f) })), { sep: true }, { label: "All functions…", onClick: () => setDialog({ kind: "functions" }) }];
  const cellMenu = (): MenuItem[] => [
    { label: "Cut", keys: "Ctrl+X", onClick: () => copyOut(true) }, { label: "Copy", keys: "Ctrl+C", onClick: () => copyOut(false) }, { label: "Paste", keys: "Ctrl+V", onClick: () => void pasteFromMenu("all") },
    { label: "Paste special", sub: [{ label: "Values only", keys: "Ctrl+Shift+V", onClick: () => void pasteFromMenu("values") }, { label: "Format only", onClick: () => void pasteFromMenu("formats") }] },
    { sep: true },
    { label: `Insert ${sel.r2 - sel.r1 + 1 > 1 && !wholeCols ? `${sel.r2 - sel.r1 + 1} rows` : "1 row"} above`, onClick: () => insert("row", false) }, { label: "Insert row below", onClick: () => insert("row", true) },
    { label: `Insert ${sel.c2 - sel.c1 + 1 > 1 && !wholeRows ? `${sel.c2 - sel.c1 + 1} columns` : "1 column"} left`, onClick: () => insert("col", false) }, { label: "Insert column right", onClick: () => insert("col", true) },
    { label: "Delete row" + (sel.r2 > sel.r1 ? "s" : ""), onClick: () => remove("row") }, { label: "Delete column" + (sel.c2 > sel.c1 ? "s" : ""), onClick: () => remove("col") },
    { label: "Clear contents", keys: "Delete", onClick: () => change((w) => clearRange(w, si, clampSel(sel), "values")) },
    { sep: true },
    { label: "Sort range A → Z", onClick: () => sortBy(1, false) }, { label: "Sort range Z → A", onClick: () => sortBy(-1, false) },
    { sep: true },
    { label: "Insert link", keys: "Ctrl+K", icon: <LinkIcon size={14} />, onClick: () => setDialog({ kind: "link" }) }, { label: activeCell?.n ? "Edit note" : "Insert note", icon: <MessageSquare size={14} />, onClick: () => setDialog({ kind: "note" }) },
    { label: "Dropdown", onClick: () => setDialog({ kind: "valid" }) }, { label: "Checkbox", onClick: insertCheckbox },
    { label: "Conditional formatting", onClick: () => setDialog({ kind: "cond" }) }, { label: "Create chart", icon: <BarChart3 size={14} />, onClick: insertChart },
  ];
  const colMenu = (): MenuItem[] => [
    { label: "Cut", onClick: () => copyOut(true) }, { label: "Copy", onClick: () => copyOut(false) }, { label: "Paste", onClick: () => void pasteFromMenu("all") }, { sep: true },
    { label: `Insert ${sel.c2 - sel.c1 + 1} left`, onClick: () => insert("col", false) }, { label: `Insert ${sel.c2 - sel.c1 + 1} right`, onClick: () => insert("col", true) },
    { label: `Delete column${sel.c2 > sel.c1 ? "s" : ""}`, onClick: () => remove("col") }, { label: "Clear column", onClick: () => change((w) => clearRange(w, si, clampSel(sel), "values")) },
    { label: `Hide column${sel.c2 > sel.c1 ? "s" : ""}`, onClick: () => hide("col") }, ...(sheet.hiddenCols.length ? [{ label: "Unhide all columns", onClick: () => unhideAll("col") } as MenuItem] : []),
    { label: "Resize to fit data", onClick: () => change((w) => updateSheet(w, si, (s) => { const m = { ...s.colW }; for (let c = sel.c1; c <= sel.c2; c++) m[c] = fitColumn(s, si, c, calc); return { ...s, colW: m }; })) },
    { sep: true }, { label: "Sort sheet A → Z", onClick: () => sortBy(1, true) }, { label: "Sort sheet Z → A", onClick: () => sortBy(-1, true) }, { label: `Freeze up to column ${colName(sel.c2)}`, onClick: () => freeze("col", sel.c2 + 1) },
  ];
  const rowMenu = (): MenuItem[] => [
    { label: "Cut", onClick: () => copyOut(true) }, { label: "Copy", onClick: () => copyOut(false) }, { label: "Paste", onClick: () => void pasteFromMenu("all") }, { sep: true },
    { label: `Insert ${sel.r2 - sel.r1 + 1} above`, onClick: () => insert("row", false) }, { label: `Insert ${sel.r2 - sel.r1 + 1} below`, onClick: () => insert("row", true) },
    { label: `Delete row${sel.r2 > sel.r1 ? "s" : ""}`, onClick: () => remove("row") }, { label: "Clear row", onClick: () => change((w) => clearRange(w, si, clampSel(sel), "values")) },
    { label: `Hide row${sel.r2 > sel.r1 ? "s" : ""}`, onClick: () => hide("row") }, ...(sheet.hiddenRows.length ? [{ label: "Unhide all rows", onClick: () => unhideAll("row") } as MenuItem] : []),
    { label: "Reset row height", onClick: () => change((w) => updateSheet(w, si, (s) => { const m = { ...s.rowH }; for (let r = sel.r1; r <= Math.min(sel.r2, sel.r1 + 2000); r++) delete m[r]; return { ...s, rowH: m }; })) },
    { sep: true }, { label: `Freeze up to row ${sel.r2 + 1}`, onClick: () => freeze("row", sel.r2 + 1) },
  ];
  const menus = [
    { label: "File", items: (): MenuItem[] => [
      { label: "New spreadsheet", onClick: () => void newFile() }, { label: "Open…", onClick: onBack }, { label: "Make a copy", onClick: () => void makeCopy() }, { sep: true },
      { label: "Import Excel or CSV…", onClick: () => void importFile() },
      { label: "Download", sub: [{ label: "Microsoft Excel (.xlsx)", onClick: () => download("xlsx") }, { label: "PDF (.pdf)", onClick: () => setDialog({ kind: "print" }) }, { label: "Comma separated (.csv, this sheet)", onClick: () => download("csv") }, { label: "Tab separated (.tsv, this sheet)", onClick: () => download("tsv") }] },
      { sep: true }, { label: "Version history", icon: <RotateCw size={14} />, onClick: () => setDialog({ kind: "versions" }) }, { label: "Print", keys: "Ctrl+P", icon: <Printer size={14} />, onClick: () => setDialog({ kind: "print" }) }, { sep: true },
      { label: "Move to trash", danger: true, onClick: () => void trashFile() },
    ] },
    { label: "Edit", items: (): MenuItem[] => [
      { label: "Undo", keys: "Ctrl+Z", disabled: !past.current.length, onClick: undo }, { label: "Redo", keys: "Ctrl+Y", disabled: !future.current.length, onClick: redo }, { sep: true },
      { label: "Cut", keys: "Ctrl+X", onClick: () => copyOut(true) }, { label: "Copy", keys: "Ctrl+C", onClick: () => copyOut(false) }, { label: "Paste", keys: "Ctrl+V", onClick: () => void pasteFromMenu("all") },
      { label: "Paste special", sub: [{ label: "Values only", onClick: () => void pasteFromMenu("values") }, { label: "Format only", onClick: () => void pasteFromMenu("formats") }] }, { sep: true },
      { label: "Delete values", keys: "Delete", onClick: () => change((w) => clearRange(w, si, clampSel(sel), "values")) }, { label: "Delete rows", onClick: () => remove("row") }, { label: "Delete columns", onClick: () => remove("col") }, { sep: true },
      { label: "Fill down", keys: "Ctrl+D", onClick: () => fillDir("down") }, { label: "Fill right", keys: "Ctrl+R", onClick: () => fillDir("right") }, { sep: true },
      { label: "Find and replace", keys: "Ctrl+H", onClick: () => setDialog({ kind: "find", replace: true }) },
    ] },
    { label: "View", items: (): MenuItem[] => [
      { label: "Freeze", sub: freezeItems() }, { sep: true },
      { label: "Gridlines", checked: sheet.grid, onClick: () => change((w) => updateSheet(w, si, (s) => ({ ...s, grid: !s.grid }))) },
      { label: "Formula bar", checked: barOn === "on", onClick: () => setBarOn(barOn === "on" ? "off" : "on") },
      { label: "Formulas", keys: "Ctrl+`", checked: showFormulas, onClick: () => setShowFormulas((x) => !x) },
      { label: "Hidden rows", disabled: !sheet.hiddenRows.length, onClick: () => unhideAll("row"), hint: "unhide all" }, { label: "Hidden columns", disabled: !sheet.hiddenCols.length, onClick: () => unhideAll("col"), hint: "unhide all" },
      { sep: true }, { label: "Zoom", sub: [50, 75, 90, 100, 125, 150, 200].map((n): MenuItem => ({ label: `${n}%`, checked: zoom === n, onClick: () => setZoomStr(String(n)) })) },
    ] },
    { label: "Insert", items: (): MenuItem[] => [
      { label: `${sel.r2 - sel.r1 + 1 > 1 && !wholeCols ? sel.r2 - sel.r1 + 1 : 1} row(s) above`, onClick: () => insert("row", false) }, { label: "Row below", onClick: () => insert("row", true) },
      { label: "Column left", onClick: () => insert("col", false) }, { label: "Column right", onClick: () => insert("col", true) }, { sep: true },
      { label: "Chart", icon: <BarChart3 size={14} />, onClick: insertChart }, { label: "Checkbox", onClick: insertCheckbox }, { label: "Dropdown", onClick: () => setDialog({ kind: "valid" }) },
      { label: "Function", icon: <Sigma size={14} />, sub: fnItems() }, { sep: true },
      { label: "Link", keys: "Ctrl+K", icon: <LinkIcon size={14} />, onClick: () => setDialog({ kind: "link" }) }, { label: "Note", icon: <MessageSquare size={14} />, onClick: () => setDialog({ kind: "note" }) },
      { label: "Today's date", keys: "Ctrl+;", onClick: () => insertNow("date") }, { label: "Current time", keys: "Ctrl+Shift+;", onClick: () => insertNow("time") }, { sep: true },
      { label: "New sheet", icon: <Plus size={14} />, onClick: () => commit((w) => addSheet(w)) },
    ] },
    { label: "Format", items: (): MenuItem[] => [
      { label: "Number", sub: numberItems() },
      { label: "Text", sub: [{ label: "Bold", keys: "Ctrl+B", checked: !!ast.b, onClick: () => toggle("b") }, { label: "Italic", keys: "Ctrl+I", checked: !!ast.i, onClick: () => toggle("i") }, { label: "Underline", keys: "Ctrl+U", checked: !!ast.u, onClick: () => toggle("u") }, { label: "Strikethrough", keys: "Ctrl+Shift+X", checked: !!ast.s, onClick: () => toggle("s") }] },
      { label: "Alignment", sub: alignItems() },
      { label: "Wrapping", sub: [{ label: "Overflow", checked: !ast.w, onClick: () => style({ w: undefined }) }, { label: "Wrap", checked: !!ast.w, onClick: () => style({ w: true }) }] },
      { label: "Rotation", sub: rotateItems() },
      { label: "Font size", sub: SIZES.map((s): MenuItem => ({ label: String(s), checked: (ast.z || 10) === s, onClick: () => style({ z: s === 10 ? undefined : s }) })) },
      { label: "Merge cells", sub: mergeItems() }, { sep: true },
      { label: "Conditional formatting", onClick: () => setDialog({ kind: "cond" }) },
      { label: "Alternating colours", sub: [...Object.keys(THEMES).map((t): MenuItem => ({ label: t[0].toUpperCase() + t.slice(1), checked: wb.theme === t, onClick: () => applyBanding(t) })), { sep: true }, { label: "Remove", onClick: () => commit((w) => ({ ...w, theme: undefined })) }] },
      { sep: true }, { label: "Clear formatting", keys: "Ctrl+\\", onClick: () => style(() => ({})) },
    ] },
    { label: "Data", items: (): MenuItem[] => [
      { label: `Sort sheet by column ${colName(anchor.c)} (A → Z)`, onClick: () => sortBy(1, true) }, { label: `Sort sheet by column ${colName(anchor.c)} (Z → A)`, onClick: () => sortBy(-1, true) },
      { label: "Sort range…", onClick: () => setDialog({ kind: "sort" }) }, { sep: true },
      { label: sheet.filter ? "Remove filter" : "Create a filter", icon: <Filter size={14} />, onClick: toggleFilter },
      { label: "Data validation (dropdowns, rules)", onClick: () => setDialog({ kind: "valid" }) }, { sep: true },
      { label: "Remove duplicates…", onClick: () => setDialog({ kind: "dedupe" }) }, { label: "Split text to columns…", onClick: () => setDialog({ kind: "split" }) },
      { label: "Trim whitespace", onClick: () => { change((w) => trimRange(w, si, clampSel(sel))); say("Extra spaces trimmed."); } },
      { sep: true }, { label: "Protect this sheet", checked: !!sheet.locked, onClick: () => commit((w) => updateSheet(w, si, (s) => ({ ...s, locked: !s.locked }))) },
    ] },
    { label: "Tools", items: (): MenuItem[] => [
      { label: "AI formula helper", icon: <Sparkles size={14} />, onClick: () => setDialog({ kind: "ai" }) }, { label: "Function list", icon: <Sigma size={14} />, onClick: () => setDialog({ kind: "functions" }) },
      { label: "Keyboard shortcuts", onClick: () => setDialog({ kind: "shortcuts" }) },
    ] },
  ];
  const applyBanding = (t: string) => {
    const th = THEMES[t];
    const g = sel.r2 > sel.r1 ? clampSel(sel) : { r1: 0, c1: 0, r2: Math.max(1, used.rows - 1), c2: Math.max(0, used.cols - 1) };
    change((w) => {
      let n = setStyle(w, si, { ...g, r2: g.r1 }, (o) => ({ ...o, bg: th.accent, c: "#ffffff", b: true }));
      for (let r = g.r1 + 1; r <= g.r2; r++) n = setStyle(n, si, { ...g, r1: r, r2: r }, (o) => ({ ...o, bg: (r - g.r1) % 2 === 0 ? th.header : th.band }));
      return n;
    });
  };

  // ─── Toolbar ───
  const fontName = ast.f || "Arial";
  const tb = <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-slate-100/80 px-2 py-1" data-testid="sheets-toolbar">
    <Tool title="Undo" keys="Ctrl+Z" onClick={undo} disabled={!past.current.length}><Undo2 size={16} /></Tool>
    <Tool title="Redo" keys="Ctrl+Y" onClick={redo} disabled={!future.current.length}><Redo2 size={16} /></Tool>
    <Tool title="Print" keys="Ctrl+P" onClick={() => setDialog({ kind: "print" })}><Printer size={16} /></Tool>
    <Tool title="Paint format (copy this cell's look to the next cells you select)" active={!!paint} onClick={() => setPaint(paint ? null : { ...ast })}><Paintbrush size={16} /></Tool>
    <DropButton title="Zoom" label={<span className="text-[12px]">{zoom}%</span>}>{(close) => <MenuList items={[50, 75, 90, 100, 125, 150, 200].map((n) => ({ label: `${n}%`, checked: zoom === n, onClick: () => setZoomStr(String(n)) }))} onDone={close} />}</DropButton>
    <ToolSep />
    <Tool title="Currency" onClick={() => setNf("$#,##0.00")} active={ast.nf === "$#,##0.00"}><DollarSign size={15} /></Tool>
    <Tool title="Percent" onClick={() => setNf("0.00%")} active={ast.nf === "0.00%"}><Percent size={15} /></Tool>
    <Tool title="Fewer decimal places" onClick={() => decimals(-1)}><span className="text-[11px] font-bold">.0<span className="text-[9px]">←</span></span></Tool>
    <Tool title="More decimal places" onClick={() => decimals(1)}><span className="text-[11px] font-bold">.00<span className="text-[9px]">→</span></span></Tool>
    <DropButton title="More formats" label={<span className="text-[12px] font-bold">123</span>}>{(close) => <MenuList items={numberItems()} onDone={close} />}</DropButton>
    <ToolSep />
    <DropButton title="Font" testId="sheets-font" label={<span className="w-[88px] truncate text-left text-[12px]" style={{ fontFamily: fontName }}>{fontName}</span>}>{(close) => <MenuList items={FONTS.map((f) => ({ label: f, checked: fontName === f, icon: <span style={{ fontFamily: f }} className="text-[12px]">A</span>, onClick: () => style({ f: f === "Arial" ? undefined : f }) }))} onDone={close} />}</DropButton>
    <ToolSep />
    <Tool title="Smaller text" onClick={() => fontSize(-1)}><span className="text-base leading-none">−</span></Tool>
    <DropButton title="Font size" label={<span className="w-6 text-center text-[12px]">{ast.z || 10}</span>}>{(close) => <MenuList items={SIZES.map((s) => ({ label: String(s), checked: (ast.z || 10) === s, onClick: () => style({ z: s === 10 ? undefined : s }) }))} onDone={close} />}</DropButton>
    <Tool title="Bigger text" onClick={() => fontSize(1)}><span className="text-base leading-none">+</span></Tool>
    <ToolSep />
    <Tool title="Bold" keys="Ctrl+B" active={!!ast.b} onClick={() => toggle("b")} testId="sheets-bold"><Bold size={16} /></Tool>
    <Tool title="Italic" keys="Ctrl+I" active={!!ast.i} onClick={() => toggle("i")}><Italic size={16} /></Tool>
    <Tool title="Strikethrough" keys="Ctrl+Shift+X" active={!!ast.s} onClick={() => toggle("s")}><Strikethrough size={16} /></Tool>
    <Tool title="Underline" keys="Ctrl+U" active={!!ast.u} onClick={() => toggle("u")}><Underline size={16} /></Tool>
    <DropButton title="Text colour" label={<span className="flex flex-col items-center"><Baseline size={15} /><span className="-mt-0.5 h-1 w-4 rounded" style={{ background: ast.c || "#000" }} /></span>}>{(close) => <ColorGrid value={ast.c} onPick={(c) => { style({ c: c && c !== "#000000" ? c : undefined }); close(); }} />}</DropButton>
    <ToolSep />
    <DropButton title="Fill colour" testId="sheets-fill" label={<span className="flex flex-col items-center"><PaintBucket size={15} /><span className="-mt-0.5 h-1 w-4 rounded border border-slate-300" style={{ background: ast.bg || "#fff" }} /></span>}>{(close) => <ColorGrid value={ast.bg} onPick={(c) => { style({ bg: c && c !== "#ffffff" ? c : undefined }); close(); }} />}</DropButton>
    <DropButton title="Borders" label={<Grid3x3 size={15} />}>{(close) => <BorderPicker onPick={(which, color) => { change((w) => setBorders(w, si, clampSel(sel), which, color)); close(); }} />}</DropButton>
    <DropButton title="Merge cells" label={<Combine size={15} />}>{(close) => <MenuList items={mergeItems()} onDone={close} />}</DropButton>
    <ToolSep />
    <DropButton title="Horizontal and vertical align" label={ast.h === "center" ? <AlignCenter size={15} /> : ast.h === "right" ? <AlignRight size={15} /> : <AlignLeft size={15} />}>{(close) => <MenuList items={alignItems()} onDone={close} />}</DropButton>
    <Tool title="Wrap text" active={!!ast.w} onClick={() => toggle("w")}><WrapText size={16} /></Tool>
    <DropButton title="Text rotation" label={<RotateCw size={15} />}>{(close) => <MenuList items={rotateItems()} onDone={close} />}</DropButton>
    <ToolSep />
    <Tool title="Insert link" keys="Ctrl+K" onClick={() => setDialog({ kind: "link" })}><LinkIcon size={15} /></Tool>
    <Tool title="Insert note" onClick={() => setDialog({ kind: "note" })}><MessageSquare size={15} /></Tool>
    <Tool title="Insert chart" onClick={insertChart} testId="sheets-chart"><BarChart3 size={16} /></Tool>
    <Tool title={sheet.filter ? "Remove filter" : "Create a filter"} active={!!sheet.filter} onClick={toggleFilter}><Filter size={15} /></Tool>
    <DropButton title="Functions" label={<Sigma size={15} />}>{(close) => <MenuList items={fnItems()} onDone={close} />}</DropButton>
    <ToolSep />
    <Tool title="AI formula helper" onClick={() => setDialog({ kind: "ai" })}><span className="inline-flex items-center gap-1 text-[12px] font-bold text-violet-700"><Sparkles size={14} />AI</span></Tool>
  </div>;

  // ─── Formula bar ───
  const barValue = edit ? edit.text : showFormulas ? rawOf(anchor.r, anchor.c) : rawOf(anchor.r, anchor.c);
  const [nameBox, setNameBox] = useState<string | null>(null);
  const goTo = (text: string) => {
    const t = text.trim();
    const bang = t.lastIndexOf("!");
    let target = si, ref = t;
    if (bang > 0) { const nm = t.slice(0, bang).replace(/^'|'$/g, ""); target = wb.sheets.findIndex((s) => s.name.toLowerCase() === nm.toLowerCase()); ref = t.slice(bang + 1); if (target < 0) { say(`No sheet called ${nm}.`); return; } }
    const g = parseRangeAddr(ref) || (parseAddr(ref) ? (() => { const a = parseAddr(ref)!; return { r1: a.r, c1: a.c, r2: a.r, c2: a.c }; })() : null);
    if (!g) { say("Type a cell like B4 or a range like A1:C10."); return; }
    if (target !== si) setActive(target);
    window.setTimeout(() => { select({ r: g.r1, c: g.c1 }, { r: Math.min(g.r2, MAX_ROWS - 1), c: Math.min(g.c2, MAX_COLS - 1) }); focusGrid(); }, 0);
  };

  // ─── Sheet tabs ───
  const [renaming, setRenaming] = useState<number | null>(null);
  const [tabMenu, setTabMenu] = useState<{ i: number; el: HTMLElement } | null>(null);
  const [allSheets, setAllSheets] = useState<HTMLElement | null>(null);
  const tabItems = (i: number): MenuItem[] => [
    { label: "Rename", onClick: () => setRenaming(i) }, { label: "Duplicate", onClick: () => commit((w) => duplicateSheet(w, i)) },
    { label: "Delete", danger: true, disabled: wb.sheets.length <= 1, onClick: () => { if (window.confirm(`Delete "${wb.sheets[i].name}"? You can undo this.`)) commit((w) => deleteSheet(w, i)); } },
    { label: "Change colour", sub: [{ label: "None", onClick: () => commit((w) => updateSheet(w, i, (s) => ({ ...s, color: undefined }))) }, ...["#ea4335", "#fbbc04", "#34a853", "#4285f4", "#9334e6", "#ff6d01", "#46bdc6", "#5f6368"].map((c): MenuItem => ({ label: c, icon: <span className="inline-block h-3 w-3 rounded-full" style={{ background: c }} />, onClick: () => commit((w) => updateSheet(w, i, (s) => ({ ...s, color: c }))) }))] },
    { label: wb.sheets[i].locked ? "Unprotect sheet" : "Protect sheet", icon: <Lock size={13} />, onClick: () => commit((w) => updateSheet(w, i, (s) => ({ ...s, locked: !s.locked }))) },
    { sep: true }, { label: "Move left", disabled: i === 0, onClick: () => commit((w) => moveSheet(w, i, -1)) }, { label: "Move right", disabled: i === wb.sheets.length - 1, onClick: () => commit((w) => moveSheet(w, i, 1)) },
  ];

  const ddRule = validationAt(sheet, anchor.r, anchor.c);
  const activeBox = cellBox(anchor.r, anchor.c);
  const am = mergeAt(sheet, anchor.r, anchor.c);
  const activeW = am ? colX[am.c2 + 1] - colX[am.c1] : activeBox.w, activeH = am ? rowY[am.r2 + 1] - rowY[am.r1] : activeBox.h;
  const activeOnScreen = activeBox.x >= HEAD_W - 2 && activeBox.y >= HEAD_H - 2 && activeBox.x < vw && activeBox.y < vh;

  return <div className="flex h-[calc(100dvh-8rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm" data-testid="sheets-editor">
    {/* Title and menus */}
    <div className="flex items-start gap-2 px-2 pt-2 sm:px-3">
      <button type="button" onClick={async () => { if (edit) commitEdit("none"); await doc.flush(); onBack(); }} aria-label="Back to files" title="Back to files" className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><ArrowLeft size={18} /></button>
      <span className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white sm:inline-flex"><Grid3x3 size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <input value={doc.name} onChange={(e) => doc.setName(e.target.value)} aria-label="Spreadsheet name" data-testid="sheets-name" className="min-w-0 max-w-[60vw] rounded-md border border-transparent px-1.5 py-0.5 text-[17px] font-semibold text-slate-900 hover:border-slate-300 focus:border-sky-500 focus:outline-none sm:max-w-md" />
          <button type="button" onClick={() => void toggleStar()} aria-label={starred ? "Unstar" : "Star"} title={starred ? "Starred" : "Star"} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><Star size={15} className={starred ? "fill-amber-400 text-amber-500" : ""} /></button>
          <span className={`hidden truncate text-xs sm:inline ${doc.state === "error" || doc.state === "conflict" ? "font-bold text-rose-600" : "text-slate-500"}`} data-testid="sheets-save">{saveLabel(doc.state)}</span>
          {sheet.locked && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800"><Lock size={11} />Protected</span>}
        </div>
        <MenuBar menus={menus} />
      </div>
    </div>
    {doc.state === "conflict" && <div className="mx-3 mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">This spreadsheet was changed on another device.
      <button type="button" onClick={doc.keepMine} className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white">Keep what's here</button>
      <button type="button" onClick={() => void doc.reload()} className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-300">Load the other copy</button></div>}
    <div className="px-2 pb-1.5 pt-1 sm:px-3">{tb}</div>

    {/* Formula bar */}
    {barOn === "on" && <div className="flex items-stretch border-y border-slate-200 text-[13px]">
      <input value={nameBox ?? rangeLabel(sel.r2 >= sheet.rows - 1 && sel.r1 === 0 && !wholeRows ? { ...sel, r2: sel.r2 } : sel)} onFocus={(e) => { setNameBox(e.target.value); e.target.select(); }} onChange={(e) => setNameBox(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { goTo(nameBox || ""); setNameBox(null); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { setNameBox(null); focusGrid(); } }} onBlur={() => setNameBox(null)}
        aria-label="Name box (type a cell to go to it)" data-testid="sheets-namebox" className="w-24 shrink-0 border-r border-slate-200 px-2 font-mono text-[12px] text-slate-700 focus:bg-sky-50 focus:outline-none sm:w-28" />
      <span className="flex items-center border-r border-slate-200 px-2 italic text-slate-400">fx</span>
      <div className="relative min-w-0 flex-1">
        <textarea ref={bar} rows={1} value={barValue} aria-label="Formula bar" data-testid="sheets-formula-bar"
          onFocus={() => { if (!edit) { if (!guard()) { bar.current?.blur(); return; } setEdit({ r: anchor.r, c: anchor.c, text: rawOf(anchor.r, anchor.c), mode: "edit", where: "bar" }); } else if (edit.where !== "bar") setEdit({ ...edit, where: "bar" }); }}
          onChange={(e) => { if (edit) { setEdit({ ...edit, text: e.target.value }); setCaret(e.target.selectionStart); pointing.current = null; } }}
          onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
          onKeyDown={onEditorKey}
          className="block h-8 w-full resize-none overflow-hidden bg-white px-2 py-1.5 font-mono text-[13px] leading-5 text-slate-900 focus:outline-none" />
        {edit?.where === "bar" && (suggestions.length > 0 || fnHelp) && <Suggest items={suggestions} active={suggest} help={fnHelp} onPick={acceptSuggestion} style={{ left: 8, top: 34 }} />}
      </div>
    </div>}

    {/* The grid */}
    <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto overscroll-contain" onScroll={(e) => { const el = e.currentTarget; setScroll({ x: el.scrollLeft, y: el.scrollTop }); }} data-testid="sheets-scroller">
      <div style={{ width: totalW, height: totalH, position: "relative" }}>
        <div ref={viewport} tabIndex={0} role="grid" aria-label={`${sheet.name} grid`} data-testid="sheets-grid"
          onKeyDown={onGridKey} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null; setFillTo(null); setLive(null); setChartLive(null); }}
          onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}
          className="select-none outline-none" style={{ position: "sticky", left: 0, top: 0, width: vw, height: vh, overflow: "hidden", background: "#fff", cursor: paint ? "copy" : "cell" }}>
          {quadrant(bodyRows, bodyCols, false, false, "q-body")}
          {quadrant(frozenRows, bodyCols, true, false, "q-top")}
          {quadrant(bodyRows, frozenCols, false, true, "q-left")}
          {quadrant(frozenRows, frozenCols, true, true, "q-corner")}
          {fw > 0 && <div className="pointer-events-none absolute w-[3px] bg-slate-300" style={{ left: HEAD_W + fw - 2, top: 0, height: vh }} />}
          {fh > 0 && <div className="pointer-events-none absolute h-[3px] bg-slate-300" style={{ top: HEAD_H + fh - 2, left: 0, width: vw }} />}
          {chartLayer()}
          {colHeads(bodyCols, false)}{colHeads(frozenCols, true)}
          {rowHeads(bodyRows, false)}{rowHeads(frozenRows, true)}
          <div className="absolute left-0 top-0 z-10 border-b border-r border-slate-300 bg-slate-100" style={{ width: HEAD_W, height: HEAD_H }} title="Select all" />
          {/* Dropdown arrow, link chip and note for the active cell */}
          {!edit && activeOnScreen && ddRule?.kind === "list" && <button type="button" data-dd="" aria-label="Open list" className="absolute z-[8] inline-flex items-center justify-center rounded bg-white/90 text-slate-600 shadow-sm ring-1 ring-slate-300" style={{ left: activeBox.x + activeW - 18, top: activeBox.y + (activeH - 16) / 2, width: 16, height: 16 }}><ChevronDown size={12} /></button>}
          {!edit && activeOnScreen && activeCell?.link && <div data-no-grid="" className="absolute z-[9] flex max-w-[280px] items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-slate-200" style={{ left: activeBox.x, top: activeBox.y + activeH + 4 }}>
            <LinkIcon size={12} className="shrink-0 text-slate-400" /><a href={activeCell.link} target="_blank" rel="noreferrer noopener" className="truncate font-semibold text-sky-700 underline">{activeCell.link}</a>
            <button type="button" onClick={() => setDialog({ kind: "link" })} className="shrink-0 font-bold text-slate-500 hover:text-slate-800">Edit</button>
          </div>}
          {!edit && activeOnScreen && activeCell?.n && !activeCell.link && <div data-no-grid="" className="absolute z-[9] max-w-[240px] whitespace-pre-wrap rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-950 shadow-lg ring-1 ring-amber-200" style={{ left: activeBox.x + activeW + 6, top: activeBox.y }} onClick={() => setDialog({ kind: "note" })}>{activeCell.n}</div>}
          {editorBox && edit && <>
            <textarea ref={editor} value={edit.text} spellCheck={!edit.text.startsWith("=")} aria-label="Cell editor" data-testid="sheets-cell-editor"
              onChange={(e) => { setEdit({ ...edit, text: e.target.value }); setCaret(e.target.selectionStart); if (pointing.current && e.target.selectionStart !== pointing.current.end) pointing.current = null; }}
              onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
              onFocus={() => { if (edit.where !== "cell") setEdit({ ...edit, where: "cell" }); }}
              onKeyDown={onEditorKey}
              className="absolute z-[30] resize-none overflow-hidden border-2 border-[#1a73e8] bg-white px-[3px] py-0.5 shadow-lg outline-none"
              style={{ left: editorBox.x, top: editorBox.y, width: editorBox.w, height: editorBox.h, fontSize: editorBox.fontPx, fontFamily: editorBox.st.f ? `'${editorBox.st.f}', Arial` : "Arial, sans-serif", fontWeight: editorBox.st.b ? 700 : 400, fontStyle: editorBox.st.i ? "italic" : undefined, color: editorBox.st.c || "#111827", lineHeight: 1.3, textAlign: editorBox.st.h === "right" ? "right" : editorBox.st.h === "center" ? "center" : "left", whiteSpace: "pre" }} />
            {edit.where === "cell" && (suggestions.length > 0 || fnHelp) && <Suggest items={suggestions} active={suggest} help={fnHelp} onPick={acceptSuggestion} style={{ left: editorBox.x, top: editorBox.y + editorBox.h + 2, zIndex: 31 }} />}
          </>}
        </div>
      </div>
    </div>

    {/* Sheet tabs and totals */}
    <div className="flex items-center gap-1 border-t border-slate-200 bg-slate-50 px-1.5 py-1 text-[13px]">
      <button type="button" onClick={() => commit((w) => addSheet(w))} aria-label="Add sheet" title="Add sheet" data-testid="sheets-add-tab" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200"><Plus size={16} /></button>
      <button type="button" onClick={(e) => setAllSheets(e.currentTarget)} aria-label="All sheets" title="All sheets" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200"><List size={16} /></button>
      {allSheets && <Floating anchor={allSheets} onClose={() => setAllSheets(null)}><MenuList items={wb.sheets.map((s, i) => ({ label: s.name, checked: i === si, onClick: () => setActive(i) }))} onDone={() => setAllSheets(null)} /></Floating>}
      <div className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto">
        {wb.sheets.map((s, i) => renaming === i
          ? <input key={s.id} autoFocus defaultValue={s.name} aria-label="Sheet name" className="h-8 w-32 shrink-0 rounded-md border border-sky-500 px-2 text-[13px] focus:outline-none"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) { const n = renameSheet(wbRef.current, i, v); if (n === wbRef.current) say("That name is taken or not allowed."); else commit(n); } setRenaming(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(null); }} />
          : <button key={s.id} type="button" onClick={() => setActive(i)} onDoubleClick={() => setRenaming(i)} onContextMenu={(e) => { e.preventDefault(); setTabMenu({ i, el: e.currentTarget }); }}
              className={`relative inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 ${i === si ? "bg-white font-bold text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-slate-200"}`} data-testid={`sheets-tab-${i}`}>
              {s.locked && <Lock size={11} />}{s.name}
              {i === si && <span role="button" tabIndex={-1} aria-label="Sheet options" onClick={(e) => { e.stopPropagation(); setTabMenu({ i, el: e.currentTarget as HTMLElement }); }} className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100"><ChevronDown size={12} /></span>}
              {s.color && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full" style={{ background: s.color }} />}
            </button>)}
      </div>
      {tabMenu && <Floating anchor={tabMenu.el} onClose={() => setTabMenu(null)}><MenuList items={tabItems(tabMenu.i)} onDone={() => setTabMenu(null)} /></Floating>}
      {statText && <DropButton title="Totals of the selected cells" testId="sheets-stats" label={<span className="text-[12px] font-semibold text-slate-700">{statText}</span>}>{(close) => stats && <div className="min-w-[220px] py-1 text-[13px]">
        {([["sum", "Sum", fmtStat(stats.sum)], ["avg", "Average", fmtStat(stats.avg)], ["min", "Min", fmtStat(stats.min)], ["max", "Max", fmtStat(stats.max)], ["count", "Count", String(stats.count)], ["numbers", "Count numbers", String(stats.numbers)]] as const).map(([k, label, val]) =>
          <button key={k} type="button" onClick={() => { setStatKind(k); close(); }} className={`flex w-full justify-between gap-6 px-3 py-1.5 hover:bg-slate-100 ${statKind === k ? "font-bold text-emerald-700" : ""}`}><span>{label}</span><span>{val}</span></button>)}
      </div>}</DropButton>}
    </div>

    {ctx && <Floating anchor={new DOMRect(ctx.x, ctx.y, 0, 0)} onClose={() => setCtx(null)}><MenuList items={ctx.kind === "col" ? colMenu() : ctx.kind === "row" ? rowMenu() : cellMenu()} onDone={() => setCtx(null)} /></Floating>}
    {ddOpen && ddRule?.kind === "list" && <Floating anchor={ddOpen} onClose={() => setDdOpen(null)}>
      <div className="min-w-[180px] py-1 text-[13px]">{(ddRule.list || []).map((opt) => <button key={opt} type="button" onClick={() => { change((w) => setValues(w, si, [{ r: anchor.r, c: anchor.c, v: opt }])); setDdOpen(null); focusGrid(); }} className={`flex w-full items-center px-3 py-1.5 text-left hover:bg-slate-100 ${display(activeVal) === opt ? "font-bold text-emerald-700" : ""}`}>{opt}</button>)}
        {(ddRule.list || []).length === 0 && <p className="px-3 py-2 text-slate-500">No choices yet. Edit the dropdown to add some.</p>}</div>
    </Floating>}
    {filterOpen && sheet.filter && <Floating anchor={filterOpen.el} onClose={() => setFilterOpen(null)}>
      <FilterPanel sheet={sheet} si={si} calc={calc} c={filterOpen.c} onSort={(dir) => { const f = sheet.filter!; const g = { r1: f.r1 + 1, c1: f.c1, r2: Math.max(f.r2, used.rows - 1), c2: f.c2 }; change((w) => sortRange(w, si, g, [{ c: filterOpen.c, dir }], false, new Calc(w))); setFilterOpen(null); }}
        onApply={(hidden) => { change((w) => updateSheet(w, si, (s) => ({ ...s, filter: s.filter ? { ...s.filter, hide: { ...s.filter.hide, [filterOpen.c]: hidden } } : s.filter }))); setFilterOpen(null); }} />
    </Floating>}
    <SheetDialogs state={dialog} close={() => { setDialog(null); setFindHit(null); focusGrid(); }} wb={wb} si={si} sel={clampSel(sel)} anchor={anchor} calc={calc} commit={change} commitAny={commit} say={say} docId={id} token={token}
      selectCell={(s2, r, c) => { if (s2 !== si) setActive(s2); window.setTimeout(() => select({ r, c }), 0); setFindHit({ si: s2, r, c }); }}
      replaceAllInto={(n) => commit(n)}
      startFormula={(t) => { setDialog(null); setEdit({ r: anchor.r, c: anchor.c, text: t, mode: "edit", where: "cell" }); window.setTimeout(() => { editor.current?.focus(); const n = editor.current?.value.length || 0; editor.current?.setSelectionRange(n, n); setCaret(n); }, 0); }} />
    {toast && <div role="status" className="pointer-events-none fixed bottom-6 left-1/2 z-[1100] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">{toast}</div>}
  </div>;
}

const errHelp = (e: string) => ({ "#DIV/0!": "Dividing by zero (or an empty cell).", "#VALUE!": "A value is the wrong type, like text where a number goes.", "#REF!": "A cell this formula reads no longer exists.", "#NAME?": "Unknown function or name. Check the spelling.", "#N/A": "Not found.", "#NUM!": "The number is out of range.", "#CYCLE!": "This formula reads its own cell (directly or through others).", "#ERROR!": "The formula couldn't be read. Check brackets and commas." } as Record<string, string>)[e] || e;

function Suggest({ items, active, help, onPick, style }: { items: string[]; active: number; help: string; onPick: (s: string) => void; style: CSSProperties }) {
  return <div data-no-grid="" className="absolute z-40 w-[300px] overflow-hidden rounded-lg bg-white text-[12px] shadow-xl ring-1 ring-slate-200" style={style}>
    {items.map((f, i) => <button key={f} type="button" onMouseDown={(e) => { e.preventDefault(); onPick(f); }} className={`block w-full px-3 py-1.5 text-left ${i === active ? "bg-sky-50" : "hover:bg-slate-50"}`}>
      <span className="font-mono font-bold text-slate-900">{f}</span>{FUNCTION_HELP[f] && <span className="ml-2 text-slate-500">{(FUNCTION_HELP[f].split("—")[1] || FUNCTION_HELP[f]).trim()}</span>}
    </button>)}
    {help && <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 font-mono text-slate-700">{help}</div>}
  </div>;
}

function BorderPicker({ onPick }: { onPick: (which: "all" | "outer" | "inner" | "top" | "bottom" | "left" | "right" | "none" | "horizontal" | "vertical", color: string) => void }) {
  const [color, setColor] = useState("#111827");
  const opts: { id: Parameters<typeof onPick>[0]; label: string; d: string }[] = [
    { id: "all", label: "All borders", d: "M3 3h18v18H3zM12 3v18M3 12h18" }, { id: "inner", label: "Inner borders", d: "M12 3v18M3 12h18" }, { id: "horizontal", label: "Horizontal", d: "M3 12h18" }, { id: "vertical", label: "Vertical", d: "M12 3v18" },
    { id: "outer", label: "Outer borders", d: "M3 3h18v18H3z" }, { id: "left", label: "Left", d: "M3 3v18" }, { id: "top", label: "Top", d: "M3 3h18" }, { id: "right", label: "Right", d: "M21 3v18" },
    { id: "bottom", label: "Bottom", d: "M3 21h18" }, { id: "none", label: "Clear borders", d: "M5 5l14 14" },
  ];
  return <div className="w-[230px] p-3">
    <div className="grid grid-cols-5 gap-1">{opts.map((o) => <button key={o.id} type="button" title={o.label} aria-label={o.label} onClick={() => onPick(o.id, color)} className="inline-flex h-9 items-center justify-center rounded-md hover:bg-slate-100">
      <svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 3h18v18H3z" fill="none" stroke="#cbd5e1" strokeDasharray="2 2" /><path d={o.d} fill="none" stroke={o.id === "none" ? "#e11d48" : color} strokeWidth="2" /></svg>
    </button>)}</div>
    <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-[12px] text-slate-600">Border colour
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="ml-auto h-7 w-9 cursor-pointer rounded border border-slate-200" aria-label="Border colour" />
    </div>
  </div>;
}

function FilterPanel({ sheet, si, calc, c, onSort, onApply }: { sheet: Sheet; si: number; calc: Calc; c: number; onSort: (dir: 1 | -1) => void; onApply: (hidden: string[]) => void }) {
  const f = sheet.filter!;
  const values = useMemo(() => {
    const seen = new Map<string, number>();
    const b = usedBounds(sheet);
    for (let r = f.r1 + 1; r <= Math.max(f.r2, b.rows - 1); r++) { const cell = sheet.cells[key(r, c)]; const t = display(calc.value(si, r, c), cell?.s, cell?.v || ""); seen.set(t, (seen.get(t) || 0) + 1); }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [sheet, si, calc, c, f]);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(f.hide[c] || []));
  const [q, setQ] = useState("");
  const shown = values.filter(([v]) => v.toLowerCase().includes(q.toLowerCase()));
  return <div className="w-[260px] p-3 text-[13px]">
    <button type="button" onClick={() => onSort(1)} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-100">Sort A → Z</button>
    <button type="button" onClick={() => onSort(-1)} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-100">Sort Z → A</button>
    <div className="my-2 border-t border-slate-100" />
    <p className="mb-1 text-xs font-bold text-slate-500">Filter by values</p>
    <div className="mb-1 flex gap-2 text-xs"><button type="button" className="font-bold text-sky-700" onClick={() => setHidden(new Set())}>Select all</button><button type="button" className="font-bold text-sky-700" onClick={() => setHidden(new Set(values.map(([v]) => v)))}>Clear</button></div>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="mb-1 h-8 w-full rounded-md border border-slate-300 px-2 text-sm" />
    <div className="max-h-56 overflow-auto">{shown.map(([v, n]) => <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-50">
      <input type="checkbox" checked={!hidden.has(v)} onChange={(e) => { const next = new Set(hidden); if (e.target.checked) next.delete(v); else next.add(v); setHidden(next); }} />
      <span className="flex-1 truncate">{v || "(Blanks)"}</span><span className="text-xs text-slate-400">{n}</span>
    </label>)}</div>
    <div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => onApply([...hidden])} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">OK</button></div>
  </div>;
}

