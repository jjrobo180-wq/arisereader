// Small pieces of Arise Sheets that aren't on screen: printing, number-format nudges, measuring text.
import { colName, isErr } from "@shared/office/formula";
import { Calc, display, key, mergeAt, usedBounds, DEFAULT_COL_W, DEFAULT_ROW_H, type CellStyle, type Sheet, type Workbook } from "@shared/office/workbook";

export const FONT_LINK = "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Lato:wght@400;700&family=Lexend:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;700&family=Open+Sans:wght@400;700&family=Playfair+Display:wght@400;700&family=Roboto:wght@400;700&display=swap";
export function loadOfficeFonts() {
  if (typeof document === "undefined" || document.getElementById("arise-office-fonts")) return;
  const l = document.createElement("link");
  l.id = "arise-office-fonts"; l.rel = "stylesheet"; l.href = FONT_LINK;
  document.head.appendChild(l);
}

/** How a cell's look turns into CSS (font size is in points, as in Excel). */
export function cellCss(st: CellStyle | undefined, zoom = 1): Record<string, string | number> {
  const css: Record<string, string | number> = {};
  if (!st) return css;
  if (st.f) css.fontFamily = `'${st.f}', Arial, sans-serif`;
  if (st.z) css.fontSize = `${(st.z * 4 / 3) * zoom}px`;
  if (st.b) css.fontWeight = 700;
  if (st.i) css.fontStyle = "italic";
  const deco = [st.u ? "underline" : "", st.s ? "line-through" : ""].filter(Boolean).join(" ");
  if (deco) css.textDecoration = deco;
  if (st.c) css.color = st.c;
  return css;
}

/** One more or one fewer decimal place on a number format. */
export function changeDecimals(nf: string | undefined, sample: number | null, delta: 1 | -1): string {
  if (nf && /[dmyhs]/i.test(nf.replace(/"[^"]*"/g, "")) && !/[0#]/.test(nf)) return nf;
  let code = nf && nf !== "@" && nf !== "checkbox" ? nf : "";
  if (!code) {
    const d = sample === null ? 0 : (String(Number(sample.toPrecision(10))).split(".")[1] || "").length;
    code = d ? `0.${"0".repeat(d)}` : "0";
  }
  return code.split(";").map((part) => {
    const quotes: string[] = [];
    let p = part.replace(/"[^"]*"/g, (q) => { quotes.push(q); return `\u0001${quotes.length - 1}\u0001`; });
    const m = /([0#,]*[0#])(\.0*)?/.exec(p);
    if (m) {
      const zeros = Math.max(0, (m[2] ? m[2].length - 1 : 0) + delta);
      p = p.slice(0, m.index) + m[1] + (zeros ? "." + "0".repeat(zeros) : "") + p.slice(m.index + m[0].length);
    }
    return p.replace(/\u0001(\d+)\u0001/g, (_x, i) => quotes[Number(i)]);
  }).join(";");
}

let canvas: HTMLCanvasElement | null = null;
export function textWidth(t: string, st?: CellStyle): number {
  canvas ||= document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return t.length * 7;
  ctx.font = `${st?.i ? "italic " : ""}${st?.b ? "700 " : ""}${((st?.z || 10) * 4) / 3}px ${st?.f ? `'${st.f}', ` : ""}Arial, sans-serif`;
  return Math.max(...t.split("\n").map((line) => ctx.measureText(line).width));
}

/** The width that fits the longest value in a column. */
export function fitColumn(s: Sheet, si: number, c: number, calc: Calc): number {
  let w = 30;
  let n = 0;
  for (const k in s.cells) {
    if (!k.endsWith(`:${c}`)) continue;
    const r = Number(k.split(":")[0]);
    const cell = s.cells[k];
    if (mergeAt(s, r, c)) continue;
    const t = display(calc.value(si, r, c), cell.s, cell.v);
    if (t) w = Math.max(w, textWidth(t, cell.s) + 14);
    if (++n > 3000) break;
  }
  return Math.min(600, Math.ceil(w));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A sheet (or the selected range) as a printable page. */
export function sheetPrintHtml(wb: Workbook, si: number, calc: Calc, opts: { title: string; range?: { r1: number; c1: number; r2: number; c2: number }; gridlines: boolean; landscape: boolean; fit: boolean }): string {
  const s = wb.sheets[si];
  const b = usedBounds(s);
  const g = opts.range || { r1: 0, c1: 0, r2: b.rows - 1, c2: b.cols - 1 };
  const hiddenR = new Set(s.hiddenRows), hiddenC = new Set(s.hiddenCols);
  const cols: number[] = []; for (let c = g.c1; c <= g.c2; c++) if (!hiddenC.has(c)) cols.push(c);
  const rows: string[] = [];
  for (let r = g.r1; r <= g.r2; r++) {
    if (hiddenR.has(r)) continue;
    const tds: string[] = [];
    for (const c of cols) {
      const m = mergeAt(s, r, c);
      if (m && (m.r1 !== r || m.c1 !== c)) continue;
      const cell = s.cells[key(r, c)];
      const v = calc.value(si, r, c);
      const st = cell?.s || {};
      let t = display(v, st, cell?.v || "");
      if (st.nf === "checkbox") t = v === true ? "☑" : "☐";
      const css = Object.entries(cellCss(st)).map(([k, val]) => `${k.replace(/[A-Z]/g, (x) => "-" + x.toLowerCase())}:${val}`);
      if (st.bg) css.push(`background:${st.bg}`);
      css.push(`text-align:${st.h || (typeof v === "number" ? "right" : typeof v === "boolean" || isErr(v) ? "center" : "left")}`);
      css.push(`vertical-align:${st.v === "middle" ? "middle" : st.v || "bottom"}`);
      if (st.w) css.push("white-space:pre-wrap"); else css.push("white-space:pre");
      for (const [side, k] of [["top", "t"], ["right", "r"], ["bottom", "b"], ["left", "l"]] as const) if (st.bd?.[k]) css.push(`border-${side}:1px solid ${st.bd[k]}`);
      const span = m ? ` rowspan="${m.r2 - m.r1 + 1}" colspan="${cols.filter((x) => x >= m.c1 && x <= m.c2).length}"` : "";
      tds.push(`<td${span} style="${css.join(";")}">${cell?.link ? `<a href="${esc(cell.link)}">${esc(t)}</a>` : esc(t)}</td>`);
    }
    rows.push(`<tr style="height:${s.rowH[r] || DEFAULT_ROW_H}px">${tds.join("")}</tr>`);
  }
  const colgroup = cols.map((c) => `<col style="width:${s.colW[c] || DEFAULT_COL_W}px">`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title><link rel="stylesheet" href="${FONT_LINK}"><style>
@page { size: ${opts.landscape ? "landscape" : "portrait"}; margin: 0.5in; }
body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 0; }
table { border-collapse: collapse; table-layout: fixed; ${opts.fit ? "width: 100%;" : ""} }
td { padding: 2px 5px; overflow: hidden; ${opts.gridlines ? "border: 1px solid #d4d4d8;" : ""} }
a { color: #1d4ed8; }
</style></head><body><table>${colgroup}${rows.join("")}</table></body></html>`;
}

export const rangeLabel = (g: { r1: number; c1: number; r2: number; c2: number }) => (g.r1 === g.r2 && g.c1 === g.c2 ? `${colName(g.c1)}${g.r1 + 1}` : `${colName(g.c1)}${g.r1 + 1}:${colName(g.c2)}${g.r2 + 1}`);

export const SHORTCUTS: [string, string][] = [
  ["Ctrl + C / X / V", "Copy, cut, paste"], ["Ctrl + Shift + V", "Paste values only"], ["Ctrl + Z / Ctrl + Y", "Undo / redo"], ["Ctrl + B / I / U", "Bold, italic, underline"],
  ["Ctrl + Shift + X", "Strikethrough"], ["Ctrl + F / Ctrl + H", "Find / find and replace"], ["Ctrl + Arrow", "Jump to the edge of the data"], ["Shift + Arrow", "Grow the selection"],
  ["Ctrl + A", "Select all"], ["Ctrl + Space / Shift + Space", "Select column / row"], ["Enter / Shift + Enter", "Save and move down / up"], ["Tab / Shift + Tab", "Save and move right / left"],
  ["F2", "Edit the cell"], ["Alt + Enter", "New line in a cell"], ["Delete", "Clear cells"], ["Ctrl + D / Ctrl + R", "Fill down / fill right"],
  ["Ctrl + ;", "Insert today's date"], ["Ctrl + Shift + ;", "Insert the time"], ["Ctrl + Shift + 4 / 5", "Currency / percent"], ["Ctrl + \\", "Clear formatting"],
  ["Ctrl + K", "Insert link"], ["Ctrl + P", "Print"], ["Ctrl + `", "Show formulas"], ["Ctrl + S", "Save now"], ["Alt + ↓", "Open a dropdown list"],
];
