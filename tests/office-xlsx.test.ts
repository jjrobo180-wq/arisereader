// Arise Sheets opens and saves Excel (.xlsx) and CSV files.
// Run with: npx tsx --test tests/office-xlsx.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { Calc, blankWorkbook, display, key, mergeCells, setStyle, setValues } from "../shared/office/workbook";
import { parseCsv, readXlsx, sheetFromRows, sheetToCsv, writeXlsx } from "../shared/office/xlsx";
import { parseXml, unzipFiles, zipFiles } from "../shared/office/zipfile";

test("CSV in and out", () => {
  assert.deepEqual(parseCsv('a,b,"c, d"\n1,"say ""hi""",\r\nx'), [["a", "b", "c, d"], ["1", 'say "hi"', ""], ["x"]]);
  assert.deepEqual(parseCsv("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
  const wb = { ...blankWorkbook(), sheets: [sheetFromRows([["Name", "Score"], ["Ava", "90"], ["Ben, Jr.", "=B2+1"]])] };
  assert.equal(sheetToCsv(wb, 0, new Calc(wb)), 'Name,Score\r\nAva,90\r\n"Ben, Jr.",91');
});

test("zip and xml basics", async () => {
  const z = zipFiles([{ name: "a.txt", data: "hello" }, { name: "b/c.xml", data: "<x a='1'>t &amp; u<y/></x>" }]);
  const files = await unzipFiles(z);
  assert.equal(new TextDecoder().decode(files.get("a.txt")!), "hello");
  const doc = parseXml(new TextDecoder().decode(files.get("b/c.xml")!));
  assert.equal(doc.kids[0].attrs.a, "1");
  assert.equal(doc.kids[0].text, "t & u");
});

test("xlsx round trip keeps values, formulas and looks", async () => {
  let wb = setValues(blankWorkbook(), 0, [
    { r: 0, c: 0, v: "Item" }, { r: 0, c: 1, v: "Cost" }, { r: 1, c: 0, v: "Pens" }, { r: 1, c: 1, v: "$5.50" },
    { r: 2, c: 0, v: "'007" }, { r: 2, c: 1, v: "10/13/2026" }, { r: 3, c: 1, v: "=B2*2" }, { r: 4, c: 0, v: "TRUE" },
  ]);
  wb = setStyle(wb, 0, { r1: 0, c1: 0, r2: 0, c2: 1 }, { b: true, bg: "#fde68a", h: "center", f: "Georgia", z: 14 });
  wb = mergeCells(wb, 0, { r1: 6, c1: 0, r2: 6, c2: 2 }, "all");
  wb = { ...wb, sheets: [{ ...wb.sheets[0], colW: { 0: 180 }, freezeR: 1, name: "Budget & more" }] };
  const back = await readXlsx(writeXlsx(wb));
  const s = back.sheets[0];
  assert.equal(s.name, "Budget & more");
  assert.equal(s.cells[key(3, 1)].v, "=B2*2");
  assert.equal(s.cells[key(2, 0)].v, "'007");
  assert.deepEqual(s.cells[key(0, 0)].s, { b: true, f: "Georgia", z: 14, bg: "#fde68a", h: "center" });
  assert.equal(s.cells[key(1, 1)].s?.nf, "$#,##0.00");
  const calc = new Calc(back);
  assert.equal(display(calc.value(0, 3, 1), s.cells[key(3, 1)].s, s.cells[key(3, 1)].v), "$11.00");
  assert.equal(display(calc.value(0, 2, 1), s.cells[key(2, 1)].s), "10/13/2026");
  assert.equal(calc.value(0, 4, 0), true);
  assert.equal(s.colW[0], 180);
  assert.equal(s.freezeR, 1);
  assert.deepEqual(s.merges, [{ r1: 6, c1: 0, r2: 6, c2: 2 }]);
});
