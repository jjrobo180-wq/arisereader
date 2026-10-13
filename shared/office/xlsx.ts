// Arise Sheets ⇄ Excel (.xlsx) and CSV. Opening keeps values, formulas, fonts, fills, borders, number
// formats, alignment, column widths, row heights, merged cells, frozen panes, hidden rows/columns and
// dropdown lists. Saving writes the same things back, so the file opens in Excel or Google Sheets.
import { colIndex, colName, isErr, parseRangeAddr, shiftFormula, type Scalar } from "./formula";
import { Calc, blankSheet, cleanWorkbook, key, literal, rangeText, DEFAULT_COL_W, DEFAULT_ROW_H, type Cell, type CellStyle, type Sheet, type Workbook } from "./workbook";
import { deepText, escapeXml as x, find, findAllNodes, kid, kids, parseXml, unzipFiles, zipFiles, type XNode } from "./zipfile";

// ─── CSV ────────────────────────────────────────────────────────────────────

export function parseCsv(text: string, sep?: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const d = sep || (() => { const line = src.split(/\r?\n/, 1)[0] || ""; const counts = [",", "\t", ";", "|"].map((s) => [s, line.split(s).length] as const); return counts.sort((a, b) => b[1] - a[1])[0][1] > 1 ? counts[0][0] : ","; })();
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if (ch === '"' && cur === "") q = true;
    else if (ch === d) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export function sheetFromRows(rows: string[][], name = "Sheet1"): Sheet {
  const s = blankSheet(name);
  rows.slice(0, 20000).forEach((row, r) => row.slice(0, 200).forEach((v, c) => { if (v !== "") s.cells[key(r, c)] = { v }; }));
  s.rows = Math.max(s.rows, rows.length + 20);
  s.cols = Math.max(s.cols, Math.min(200, Math.max(0, ...rows.map((r) => r.length)) + 3));
  return s;
}

/** A sheet's shown values as CSV (or TSV). */
export function sheetToCsv(wb: Workbook, si: number, calc: Calc, sep = ","): string {
  const s = wb.sheets[si];
  let maxR = -1, maxC = -1;
  for (const k in s.cells) { const [r, c] = k.split(":").map(Number); if (s.cells[k].v) { maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); } }
  const out: string[] = [];
  for (let r = 0; r <= maxR; r++) {
    const line: string[] = [];
    for (let c = 0; c <= maxC; c++) {
      const v = calc.value(si, r, c);
      const t = v === null ? "" : isErr(v) ? v.err : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v);
      line.push(/["\n\r]/.test(t) || t.includes(sep) ? `"${t.replace(/"/g, '""')}"` : t);
    }
    out.push(line.join(sep));
  }
  return out.join("\r\n");
}

// ─── Reading .xlsx ──────────────────────────────────────────────────────────

const BUILTIN_FORMATS: Record<number, string> = {
  1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 11: "0.00E+00", 14: "m/d/yyyy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy",
  18: "h:mm AM/PM", 19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss", 22: "m/d/yyyy h:mm", 37: "#,##0;(#,##0)", 38: "#,##0;(#,##0)", 39: "#,##0.00;(#,##0.00)", 40: "#,##0.00;(#,##0.00)",
  44: "$#,##0.00", 45: "mm:ss", 46: "[h]:mm:ss", 47: "mm:ss.0", 48: "##0.0E+0", 49: "@",
};
const THEME_COLORS = ["#ffffff", "#000000", "#e7e6e6", "#44546a", "#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47"];
const INDEXED = ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#800000", "#008000", "#000080", "#808000", "#800080", "#008080", "#c0c0c0", "#808080"];

function readColor(n: XNode | undefined): string | undefined {
  if (!n) return undefined;
  if (n.attrs.rgb) { const h = n.attrs.rgb.slice(-6); return /^[0-9a-f]{6}$/i.test(h) ? `#${h.toLowerCase()}` : undefined; }
  if (n.attrs.theme !== undefined) {
    let c = THEME_COLORS[Number(n.attrs.theme)];
    const tint = Number(n.attrs.tint || 0);
    if (c && tint) { const v = [1, 3, 5].map((i) => parseInt(c!.slice(i, i + 2), 16)).map((ch) => Math.round(tint < 0 ? ch * (1 + tint) : ch + (255 - ch) * tint)); c = `#${v.map((ch) => ch.toString(16).padStart(2, "0")).join("")}`; }
    return c;
  }
  if (n.attrs.indexed !== undefined) return INDEXED[Number(n.attrs.indexed)];
  return undefined;
}

type XfStyle = CellStyle;
function readStyles(xml: string | undefined): XfStyle[] {
  if (!xml) return [];
  const doc = parseXml(xml);
  const fmts: Record<number, string> = { ...BUILTIN_FORMATS };
  for (const f of findAllNodes(find(doc, "numFmts"), "numFmt")) fmts[Number(f.attrs.numFmtId)] = f.attrs.formatCode;
  const fonts = kids(find(doc, "fonts"), "font").map((f): CellStyle => {
    const s: CellStyle = {};
    if (kid(f, "b") && kid(f, "b")!.attrs.val !== "0") s.b = true;
    if (kid(f, "i") && kid(f, "i")!.attrs.val !== "0") s.i = true;
    if (kid(f, "u") && kid(f, "u")!.attrs.val !== "none") s.u = true;
    if (kid(f, "strike") && kid(f, "strike")!.attrs.val !== "0") s.s = true;
    const sz = Number(kid(f, "sz")?.attrs.val); if (sz) s.z = Math.round(sz);
    const nm = kid(f, "name")?.attrs.val; if (nm) s.f = nm;
    const c = readColor(kid(f, "color")); if (c && c !== "#000000") s.c = c;
    return s;
  });
  const fills = kids(find(doc, "fills"), "fill").map((f) => { const p = kid(f, "patternFill"); return p && p.attrs.patternType && p.attrs.patternType !== "none" ? readColor(kid(p, "fgColor")) || readColor(kid(p, "bgColor")) : undefined; });
  const borders = kids(find(doc, "borders"), "border").map((b) => {
    const out: CellStyle["bd"] = {};
    for (const [side, k] of [["top", "t"], ["right", "r"], ["bottom", "b"], ["left", "l"]] as const) { const n = kid(b, side); if (n?.attrs.style) out[k] = readColor(kid(n, "color")) || "#000000"; }
    return Object.keys(out).length ? out : undefined;
  });
  return kids(find(doc, "cellXfs"), "xf").map((xf) => {
    const s: CellStyle = { ...(fonts[Number(xf.attrs.fontId || 0)] || {}) };
    const fill = fills[Number(xf.attrs.fillId || 0)]; if (fill) s.bg = fill;
    const bd = borders[Number(xf.attrs.borderId || 0)]; if (bd) s.bd = bd;
    const nf = Number(xf.attrs.numFmtId || 0); if (nf && fmts[nf]) s.nf = fmts[nf].replace(/\[\$([^\]-]*)-[^\]]*\]/g, "$1").replace(/\\/g, "").replace(/_./g, "").replace(/\*./g, "").replace(/\?/g, "#").replace(/\[(Red|Black|Blue|Green|Color\d+)\]/gi, "").replace(/"\$"/g, "$").trim();
    const al = kid(xf, "alignment");
    if (al) {
      if (["left", "center", "right"].includes(al.attrs.horizontal)) s.h = al.attrs.horizontal as CellStyle["h"];
      if (al.attrs.horizontal === "centerContinuous") s.h = "center";
      if (al.attrs.vertical === "center") s.v = "middle"; else if (al.attrs.vertical === "top") s.v = "top";
      if (al.attrs.wrapText === "1" || al.attrs.wrapText === "true") s.w = true;
      const rot = Number(al.attrs.textRotation || 0); if (rot) s.rot = rot > 90 ? 90 - rot : rot;
      const ind = Number(al.attrs.indent || 0); if (ind) s.ind = ind;
    }
    return s;
  });
}

const isDefaultFont = (s: CellStyle) => (s.f === "Calibri" || s.f === "Arial") && (!s.z || s.z === 11 || s.z === 10);

/** Opens an .xlsx file as a workbook. */
export async function readXlsx(buf: ArrayBuffer | Uint8Array): Promise<Workbook> {
  const files = await unzipFiles(buf);
  const dec = new TextDecoder();
  const get = (p: string) => { const f = files.get(p.replace(/^\//, "")); return f ? dec.decode(f) : undefined; };
  const wbXml = get("xl/workbook.xml");
  if (!wbXml) throw new Error("That doesn't look like an Excel file.");
  const wbDoc = parseXml(wbXml);
  const rels = new Map<string, string>();
  for (const r of findAllNodes(parseXml(get("xl/_rels/workbook.xml.rels") || ""), "Relationship")) rels.set(r.attrs.Id, r.attrs.Target);
  const shared = findAllNodes(parseXml(get("xl/sharedStrings.xml") || ""), "si").map((si) => findAllNodes(si, "t").filter((t) => !isPhonetic(si, t)).map(deepText).join(""));
  const styles = readStyles(get("xl/styles.xml"));
  const sheets: Sheet[] = [];
  for (const sn of findAllNodes(find(wbDoc, "sheets"), "sheet").slice(0, 60)) {
    const target = rels.get(sn.attrs.id) || "";
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const xml = get(path);
    if (!xml) continue;
    const doc = parseXml(xml);
    const s = blankSheet(sn.attrs.name || `Sheet${sheets.length + 1}`);
    const sharedF = new Map<string, { f: string; r: number; c: number }>();
    let maxR = 0, maxC = 0;
    for (const row of findAllNodes(find(doc, "sheetData"), "row")) {
      const rIdx = Number(row.attrs.r) - 1;
      if (row.attrs.ht && row.attrs.customHeight === "1") s.rowH[rIdx] = Math.round(Number(row.attrs.ht) * 4 / 3);
      if (row.attrs.hidden === "1") s.hiddenRows.push(rIdx);
      for (const c of kids(row, "c")) {
        const m = /^([A-Z]+)(\d+)$/.exec(c.attrs.r || "");
        if (!m) continue;
        const r = Number(m[2]) - 1, col = colIndex(m[1]);
        if (r >= 20000 || col >= 200) continue;
        const st = c.attrs.s ? styles[Number(c.attrs.s)] : undefined;
        const fNode = kid(c, "f");
        let v = "";
        if (fNode) {
          const text = fNode.text.trim();
          if (fNode.attrs.t === "shared" && fNode.attrs.si !== undefined) {
            if (text) sharedF.set(fNode.attrs.si, { f: text, r, c: col });
            else { const base = sharedF.get(fNode.attrs.si); if (base) v = shiftFormula(`=${base.f}`, r - base.r, col - base.c); }
          }
          if (!v && text) v = `=${text.replace(/_xlfn\.|_xlws\./g, "")}`;
        }
        if (!v) {
          const raw = kid(c, "v")?.text ?? "";
          const t = c.attrs.t;
          if (t === "s") v = shared[Number(raw)] ?? "";
          else if (t === "inlineStr") v = findAllNodes(kid(c, "is"), "t").map(deepText).join("");
          else if (t === "b") v = raw === "1" ? "TRUE" : "FALSE";
          else if (t === "str" || t === "e") v = raw;
          else v = raw;
          // Text that would read as a number or formula stays text.
          if ((t === "s" || t === "inlineStr") && (/^=/.test(v) || literal(v) !== v) && v !== "") v = v.startsWith("'") ? v : `'${v}`;
        }
        const cell: Cell = { v };
        if (st) {
          const style: CellStyle = { ...st };
          if (isDefaultFont(style)) { delete style.f; delete style.z; }
          if (style.nf === "General" || style.nf === "general") delete style.nf;
          if (Object.keys(style).length) cell.s = style;
        }
        if (cell.v || cell.s) { s.cells[key(r, col)] = cell; maxR = Math.max(maxR, r); maxC = Math.max(maxC, col); }
      }
    }
    for (const col of findAllNodes(find(doc, "cols"), "col")) {
      const a = Number(col.attrs.min) - 1, b = Math.min(Number(col.attrs.max) - 1, a + 200);
      for (let c = a; c <= b && c < 200; c++) {
        if (col.attrs.hidden === "1") s.hiddenCols.push(c);
        else if (col.attrs.width && col.attrs.customWidth !== "0") s.colW[c] = Math.max(20, Math.round(Number(col.attrs.width) * 7 + 5));
      }
    }
    for (const mc of findAllNodes(find(doc, "mergeCells"), "mergeCell")) { const g = parseRangeAddr(mc.attrs.ref || ""); if (g) s.merges.push(g); }
    const pane = find(find(doc, "sheetViews"), "pane");
    if (pane && (pane.attrs.state === "frozen" || pane.attrs.state === "frozenSplit")) { s.freezeR = Math.min(50, Number(pane.attrs.ySplit || 0)); s.freezeC = Math.min(20, Number(pane.attrs.xSplit || 0)); }
    const sv = find(find(doc, "sheetViews"), "sheetView");
    if (sv?.attrs.showGridLines === "0") s.grid = false;
    for (const dv of findAllNodes(find(doc, "dataValidations"), "dataValidation")) {
      if (dv.attrs.type !== "list") continue;
      const f1 = kid(dv, "formula1")?.text || "";
      if (!/^".*"$/.test(f1)) continue;
      for (const ref of (dv.attrs.sqref || "").split(/\s+/).filter(Boolean)) if (parseRangeAddr(ref)) s.valid.push({ id: `v${s.valid.length}`, range: ref, kind: "list", list: f1.slice(1, -1).split(",").map((t) => t.trim()) });
    }
    // Tabs coloured in Excel keep their colour.
    const tab = find(find(doc, "sheetPr"), "tabColor"); const tc = readColor(tab); if (tc) s.color = tc;
    s.rows = Math.max(s.rows, maxR + 30);
    s.cols = Math.max(s.cols, maxC + 5);
    sheets.push(s);
  }
  if (!sheets.length) throw new Error("No sheets found in that file.");
  return cleanWorkbook({ v: 1, sheets, active: 0 });
}
const isPhonetic = (_si: XNode, _t: XNode) => false;

// ─── Writing .xlsx ──────────────────────────────────────────────────────────

const argb = (c: string) => { const h = c.replace("#", ""); const f = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h.slice(0, 6); return `FF${f.toUpperCase()}`; };

/** Saves a workbook as an .xlsx file Excel and Google Sheets open. */
export function writeXlsx(wb: Workbook, calc = new Calc(wb)): Uint8Array {
  const fonts: string[] = ['<font><sz val="10"/><name val="Arial"/></font>'];
  const fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders: string[] = ["<border><left/><right/><top/><bottom/><diagonal/></border>"];
  const numFmts: string[] = [];
  const xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const idx = (list: string[], item: string) => { const i = list.indexOf(item); if (i >= 0) return i; list.push(item); return list.length - 1; };
  const fmtIds = new Map<string, number>();
  const styleIds = new Map<string, number>();
  const styleId = (st: CellStyle | undefined): number => {
    if (!st || !Object.keys(st).length) return 0;
    const sig = JSON.stringify(st);
    const known = styleIds.get(sig); if (known !== undefined) return known;
    const font = `<font>${st.b ? "<b/>" : ""}${st.i ? "<i/>" : ""}${st.s ? "<strike/>" : ""}${st.u ? "<u/>" : ""}<sz val="${st.z || 10}"/>${st.c ? `<color rgb="${argb(st.c)}"/>` : ""}<name val="${x(st.f || "Arial")}"/></font>`;
    const fontId = idx(fonts, font);
    const fillId = st.bg ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(st.bg)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const side = (n: string, c?: string) => (c ? `<${n} style="thin"><color rgb="${argb(c)}"/></${n}>` : `<${n}/>`);
    const borderId = st.bd ? idx(borders, `<border>${side("left", st.bd.l)}${side("right", st.bd.r)}${side("top", st.bd.t)}${side("bottom", st.bd.b)}<diagonal/></border>`) : 0;
    let numFmtId = 0;
    if (st.nf && st.nf !== "checkbox") {
      const builtin = Object.entries(BUILTIN_FORMATS).find(([id, code]) => code === st.nf && (Number(id) <= 22 || id === "49"));
      if (builtin) numFmtId = Number(builtin[0]);
      else { numFmtId = fmtIds.get(st.nf) ?? 164 + fmtIds.size; if (!fmtIds.has(st.nf)) { fmtIds.set(st.nf, numFmtId); numFmts.push(`<numFmt numFmtId="${numFmtId}" formatCode="${x(st.nf)}"/>`); } }
    }
    const al = st.h || st.v || st.w || st.rot || st.ind ? `<alignment${st.h ? ` horizontal="${st.h}"` : ""}${st.v ? ` vertical="${st.v === "middle" ? "center" : st.v}"` : ""}${st.w ? ' wrapText="1"' : ""}${st.rot ? ` textRotation="${st.rot < 0 ? 90 - st.rot : st.rot}"` : ""}${st.ind ? ` indent="${st.ind}"` : ""}/>` : "";
    xfs.push(`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ""}${fontId ? ' applyFont="1"' : ""}${fillId ? ' applyFill="1"' : ""}${borderId ? ' applyBorder="1"' : ""}${al ? ' applyAlignment="1">' + al + "</xf>" : "/>"}`);
    styleIds.set(sig, xfs.length - 1);
    return xfs.length - 1;
  };

  const sheetXml = wb.sheets.map((s, si) => {
    const byRow = new Map<number, { c: number; cell: Cell }[]>();
    for (const [k, cell] of Object.entries(s.cells)) { const [r, c] = k.split(":").map(Number); (byRow.get(r) || byRow.set(r, []).get(r)!).push({ c, cell }); }
    for (const r of [...Object.keys(s.rowH).map(Number), ...s.hiddenRows]) if (!byRow.has(r)) byRow.set(r, []);
    const rows = [...byRow.keys()].sort((a, b) => a - b).map((r) => {
      const cells = byRow.get(r)!.sort((a, b) => a.c - b.c).map(({ c, cell }) => {
        const ref = `${colName(c)}${r + 1}`;
        const sid = styleId(cell.s);
        const sAttr = sid ? ` s="${sid}"` : "";
        if (cell.v.startsWith("=") && cell.v.length > 1 && cell.s?.nf !== "@") {
          const val = calc.value(si, r, c);
          const cached = valueXml(val);
          return `<c r="${ref}"${sAttr}${cached.t}><f>${x(cell.v.slice(1))}</f>${cached.v}</c>`;
        }
        if (!cell.v) return `<c r="${ref}"${sAttr}/>`;
        const lit: Scalar = cell.v.startsWith("'") ? cell.v.slice(1) : literal(cell.v, cell.s);
        const cv = valueXml(lit);
        if (typeof lit === "string") return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${x(lit)}</t></is></c>`;
        return `<c r="${ref}"${sAttr}${cv.t}>${cv.v}</c>`;
      }).join("");
      const ht = s.rowH[r];
      return `<row r="${r + 1}"${ht ? ` ht="${(ht * 0.75).toFixed(2)}" customHeight="1"` : ""}${s.hiddenRows.includes(r) ? ' hidden="1"' : ""}>${cells}</row>`;
    }).join("");
    const colIdx = [...new Set([...Object.keys(s.colW).map(Number), ...s.hiddenCols])].sort((a, b) => a - b);
    const cols = colIdx.length ? `<cols>${colIdx.map((c) => `<col min="${c + 1}" max="${c + 1}" width="${(((s.colW[c] ?? DEFAULT_COL_W) - 5) / 7).toFixed(2)}" customWidth="1"${s.hiddenCols.includes(c) ? ' hidden="1"' : ""}/>`).join("")}</cols>` : "";
    const freeze = s.freezeR || s.freezeC ? `<pane${s.freezeC ? ` xSplit="${s.freezeC}"` : ""}${s.freezeR ? ` ySplit="${s.freezeR}"` : ""} topLeftCell="${colName(s.freezeC)}${s.freezeR + 1}" activePane="${s.freezeR && s.freezeC ? "bottomRight" : s.freezeR ? "bottomLeft" : "topRight"}" state="frozen"/>` : "";
    const views = `<sheetViews><sheetView workbookViewId="0"${s.grid ? "" : ' showGridLines="0"'}${si === wb.active ? ' tabSelected="1"' : ""}>${freeze}</sheetView></sheetViews>`;
    const merges = s.merges.length ? `<mergeCells count="${s.merges.length}">${s.merges.map((m) => `<mergeCell ref="${rangeText(m)}"/>`).join("")}</mergeCells>` : "";
    const lists = s.valid.filter((v) => v.kind === "list" && v.list?.length);
    const valid = lists.length ? `<dataValidations count="${lists.length}">${lists.map((v) => `<dataValidation type="list" allowBlank="1" showErrorMessage="${v.strict ? 1 : 0}" sqref="${v.range}"><formula1>"${x(v.list!.join(",").slice(0, 250))}"</formula1></dataValidation>`).join("")}</dataValidations>` : "";
    const pr = s.color ? `<sheetPr><tabColor rgb="${argb(s.color)}"/></sheetPr>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pr}${views}<sheetFormatPr defaultRowHeight="${(DEFAULT_ROW_H * 0.75).toFixed(2)}"/>${cols}<sheetData>${rows}</sheetData>${merges}${valid}</worksheet>`;
  });

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join("")}</numFmts>` : ""}<fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="${wb.active}"/></bookViews><sheets>${wb.sheets.map((s, i) => `<sheet name="${x(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wb.sheets.map((_s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${wb.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${wb.sheets.map((_s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Arise Sheets</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Arise Sheets</Application></Properties>`;
  return zipFiles([
    { name: "[Content_Types].xml", data: types }, { name: "_rels/.rels", data: rootRels }, { name: "docProps/core.xml", data: core }, { name: "docProps/app.xml", data: app },
    { name: "xl/workbook.xml", data: workbook }, { name: "xl/_rels/workbook.xml.rels", data: wbRels }, { name: "xl/styles.xml", data: styles },
    ...sheetXml.map((d, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: d })),
  ]);
}

function valueXml(v: Scalar): { t: string; v: string } {
  if (v === null) return { t: "", v: "" };
  if (isErr(v)) return { t: ' t="e"', v: `<v>${x(v.err === "#CYCLE!" ? "#REF!" : v.err)}</v>` };
  if (typeof v === "boolean") return { t: ' t="b"', v: `<v>${v ? 1 : 0}</v>` };
  if (typeof v === "number") return { t: "", v: `<v>${Number.isFinite(v) ? v : 0}</v>` };
  return { t: ' t="str"', v: `<v>${x(v)}</v>` };
}
