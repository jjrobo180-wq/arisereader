// Arise Sheets' workbook: typing, formats, inserting, filling, sorting and conditional formatting.
// Run with: npx tsx --test tests/office-workbook.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  Calc, addSheet, blankWorkbook, cleanWorkbook, condStyles, display, fillRange, findAll, insertLines, key, mergeCells, pasteCells, removeDuplicates,
  renameSheet, replaceAll, selectionStats, setBorders, setStyle, setValues, sortRange, splitToColumns, chartData,
} from "../shared/office/workbook";

const put = (vals: Record<string, string>) => {
  const list = Object.entries(vals).map(([a, v]) => ({ r: Number(a.slice(1)) - 1, c: a.charCodeAt(0) - 65, v }));
  return setValues(blankWorkbook(), 0, list);
};
const shown = (wb: ReturnType<typeof blankWorkbook>, a: string, si = 0) => {
  const r = Number(a.slice(1)) - 1, c = a.charCodeAt(0) - 65;
  const cell = wb.sheets[si].cells[key(r, c)];
  return display(new Calc(wb).value(si, r, c), cell?.s, cell?.v);
};

test("typing picks up formats, formulas work out", () => {
  const wb = put({ A1: "$1,200.50", A2: "25%", A3: "10/13/2026", A4: "=A1*2", B1: "=SUM(A1:A2)", C1: "hello" });
  assert.equal(shown(wb, "A1"), "$1,200.50");
  assert.equal(shown(wb, "A2"), "25%");
  assert.equal(shown(wb, "A3"), "10/13/2026");
  assert.equal(shown(wb, "A4"), "$2,401.00");
  assert.equal(shown(wb, "C1"), "hello");
  const cyc = put({ A1: "=B1", B1: "=A1" });
  assert.equal(shown(cyc, "A1"), "#CYCLE!");
});

test("inserting and deleting rows fixes formulas", () => {
  let wb = put({ A1: "1", A2: "2", A3: "3", A4: "=SUM(A1:A3)" });
  wb = insertLines(wb, 0, "row", 1, 2);
  assert.equal(wb.sheets[0].cells[key(5, 0)].v, "=SUM(A1:A5)");
  assert.equal(shown(wb, "A6"), "6");
  wb = insertLines(wb, 0, "row", 0, -1);
  assert.equal(wb.sheets[0].cells[key(4, 0)].v, "=SUM(A1:A4)");
  assert.equal(shown(wb, "A5"), "5");
});

test("fill continues series", () => {
  let wb = put({ A1: "1", A2: "3", B1: "Week 1", C1: "Mon", D1: "=A1*10" });
  wb = fillRange(wb, 0, { r1: 0, c1: 0, r2: 1, c2: 0 }, { r1: 0, c1: 0, r2: 4, c2: 0 });
  assert.deepEqual([2, 3, 4].map((r) => wb.sheets[0].cells[key(r, 0)].v), ["5", "7", "9"]);
  wb = fillRange(wb, 0, { r1: 0, c1: 1, r2: 0, c2: 3 }, { r1: 0, c1: 1, r2: 2, c2: 3 });
  assert.equal(wb.sheets[0].cells[key(2, 1)].v, "Week 3");
  assert.equal(wb.sheets[0].cells[key(2, 2)].v, "Wed");
  assert.equal(wb.sheets[0].cells[key(2, 3)].v, "=A3*10");
});

test("sort, remove duplicates, split", () => {
  let wb = put({ A1: "Name", B1: "Score", A2: "Cam", B2: "85", A3: "Ava", B3: "90", A4: "Ben", B4: "72", A5: "Ava", B5: "90" });
  wb = sortRange(wb, 0, { r1: 0, c1: 0, r2: 4, c2: 1 }, [{ c: 1, dir: -1 }], true, new Calc(wb));
  assert.deepEqual([1, 2, 3, 4].map((r) => wb.sheets[0].cells[key(r, 0)].v), ["Ava", "Ava", "Cam", "Ben"]);
  const res = removeDuplicates(wb, 0, { r1: 0, c1: 0, r2: 4, c2: 1 }, [0, 1], true, new Calc(wb));
  assert.equal(res.removed, 1);
  assert.equal(res.wb.sheets[0].cells[key(4, 0)], undefined);
  const sp = splitToColumns(put({ A1: "Ava, Smith, 4" }), 0, { r1: 0, c1: 0, r2: 0, c2: 0 }, ",");
  assert.deepEqual([0, 1, 2].map((c) => sp.sheets[0].cells[key(0, c)].v), ["Ava", "Smith", "4"]);
});

test("styles, borders, merges, paste and sheets", () => {
  let wb = put({ A1: "Title", B1: "x", A2: "=B2+1", B2: "4" });
  wb = setStyle(wb, 0, { r1: 0, c1: 0, r2: 0, c2: 1 }, { b: true, bg: "#ffee00" });
  assert.deepEqual(wb.sheets[0].cells[key(0, 1)].s, { b: true, bg: "#ffee00" });
  wb = setStyle(wb, 0, { r1: 0, c1: 0, r2: 0, c2: 0 }, { b: undefined });
  assert.deepEqual(wb.sheets[0].cells[key(0, 0)].s, { bg: "#ffee00" });
  wb = setBorders(wb, 0, { r1: 0, c1: 0, r2: 1, c2: 1 }, "outer");
  assert.deepEqual(wb.sheets[0].cells[key(0, 0)].s?.bd, { t: "#111827", l: "#111827" });
  wb = mergeCells(wb, 0, { r1: 0, c1: 0, r2: 0, c2: 1 }, "all");
  assert.equal(wb.sheets[0].merges.length, 1);
  assert.equal(wb.sheets[0].cells[key(0, 1)].v, "");
  wb = pasteCells(wb, 0, { r: 5, c: 0 }, { cells: [[wb.sheets[0].cells[key(1, 0)]]], from: { r: 1, c: 0 } });
  assert.equal(wb.sheets[0].cells[key(5, 0)].v, "=B6+1");
  wb = addSheet(wb);
  wb = setValues(wb, 1, [{ r: 0, c: 0, v: "=Sheet1!B2*2" }]);
  wb = renameSheet(wb, 0, "Grades Q1");
  assert.equal(wb.sheets[1].cells[key(0, 0)].v, "='Grades Q1'!B2*2");
  assert.equal(shown(wb, "A1", 1), "8");
});

test("conditional formats, find/replace, stats, charts and cleaning", () => {
  let wb = put({ A1: "Item", B1: "Cost", A2: "Pens", B2: "5", A3: "Paper", B3: "20", A4: "Glue", B4: "12" });
  wb = { ...wb, sheets: [{ ...wb.sheets[0], cond: [{ id: "c", range: "B2:B4", kind: "gt", a: "10", style: { bg: "#fecaca" } }] }] };
  const cs = condStyles(wb.sheets[0], 0, new Calc(wb));
  assert.equal(cs.get(key(2, 1))?.bg, "#fecaca");
  assert.equal(cs.has(key(1, 1)), false);
  const hits = findAll(wb, new Calc(wb), "pa", { all: true, si: 0, caseSensitive: false, whole: false, formulas: false });
  assert.equal(hits.length, 1);
  wb = replaceAll(wb, hits, "Pa", "Ca", false);
  assert.equal(wb.sheets[0].cells[key(2, 0)].v, "Caper");
  const st = selectionStats(new Calc(wb), 0, { r1: 0, c1: 1, r2: 3, c2: 1 });
  assert.equal(st.sum, 37); assert.equal(st.count, 4); assert.equal(st.numbers, 3);
  const cd = chartData(wb, 0, new Calc(wb), { id: "x", kind: "column", range: "A1:B4", title: "", x: 0, y: 0, w: 400, h: 300, headers: true, legend: true });
  assert.deepEqual(cd.labels, ["Pens", "Caper", "Glue"]);
  assert.deepEqual(cd.series, [{ name: "Cost", values: [5, 20, 12] }]);
  const clean = cleanWorkbook(JSON.parse(JSON.stringify({ ...wb, sheets: [...wb.sheets, { name: "sheet1", cells: { "0:0": { v: "a", s: { bg: "red", b: 1 } }, bad: { v: "x" } } }] })));
  assert.equal(clean.sheets[1].name, "sheet1 (2)");
  assert.deepEqual(clean.sheets[1].cells, { "0:0": { v: "a", s: { b: true } } });
  assert.equal(cleanWorkbook(null).sheets.length, 1);
});

test("every template opens with working formulas", async () => {
  const { SHEET_TEMPLATES } = await import("../shared/office/sheetTemplates");
  for (const t of SHEET_TEMPLATES) {
    const wb = cleanWorkbook(JSON.parse(JSON.stringify(t.make())));
    const calc = new Calc(wb);
    wb.sheets.forEach((s, si) => {
      for (const k of Object.keys(s.cells)) {
        const [r, c] = k.split(":").map(Number);
        const v = calc.value(si, r, c);
        assert.ok(!(v && typeof v === "object" && "err" in v && v.err !== "#DIV/0!"), `${t.id} ${k} ${s.cells[k].v} → ${JSON.stringify(v)}`);
      }
      condStyles(s, si, calc);
      for (const ch of s.charts) assert.ok(chartData(wb, si, calc, ch).series.length > 0, `${t.id} chart`);
    });
  }
  const { SHEET_TEMPLATES: T } = await import("../shared/office/sheetTemplates");
  const g = T.find((t) => t.id === "gradebook")!.make();
  assert.equal(shown(g, "G3"), "C");
  assert.equal(shown(g, "H5"), "Reteach");
  const b = T.find((t) => t.id === "budget")!.make();
  assert.equal(shown(b, "B17"), "$731.00");
});

test("files from the first Office editor open", () => {
  const wb = cleanWorkbook({ tabs: [{ id: "x", name: "Budget", cells: [["Item", "Cost"], ["Pens", "4"], ["", "=B2*2"]] }] });
  assert.equal(wb.sheets[0].name, "Budget");
  assert.equal(shown(wb, "B3"), "8");
});
