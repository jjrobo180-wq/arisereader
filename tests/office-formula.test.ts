// Arise Sheets' formula engine works things out the way Excel and Google Sheets do.
// Run with: npx tsx --test tests/office-formula.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { adjustForInsert, evalFormula, formatCode, parseNumberText, shiftFormula, toSerial, type EvalCtx, type Scalar } from "../shared/office/formula";

function sheet(cells: Record<string, string | number>, other: Record<string, Record<string, string | number>> = {}) {
  const read = (grid: Record<string, string | number>, r: number, c: number): Scalar => {
    const key = String.fromCharCode(65 + c) + (r + 1);
    const v = grid[key];
    if (v === undefined) return null;
    if (typeof v === "number") return v;
    if (v.startsWith("=")) return evalFormula(v, ctx(r, c));
    const n = parseNumberText(v);
    return n === null ? v : n;
  };
  const ctx = (r = 0, c = 0): EvalCtx => ({
    cell: (s, rr, cc) => read(s ? other[s] || {} : cells, rr, cc),
    bounds: (s) => (s && !other[s] ? null : { rows: 100, cols: 26 }),
    here: { r, c }, now: new Date(2026, 9, 13, 9, 30), rand: () => 0.5,
  });
  return (f: string) => evalFormula(f, ctx(50, 10));
}

test("maths, order of operations, percent and text joining", () => {
  const f = sheet({});
  assert.equal(f("=1+2*3"), 7);
  assert.equal(f("=(1+2)*3"), 9);
  assert.equal(f("=2^3^2"), 512);
  assert.equal(f("=-2^2"), 4);
  assert.equal(f("=50%*10"), 5);
  assert.equal(f('="a"&"b"&1'), "ab1");
  assert.equal(f("=10/0").valueOf().constructor, Object);
  assert.deepEqual(f("=10/0"), { err: "#DIV/0!" });
  assert.deepEqual(f("=NOPE(1)"), { err: "#NAME?" });
  assert.deepEqual(f("=1+"), { err: "#ERROR!" });
});

test("ranges, lookups, conditions and other sheets", () => {
  const f = sheet({ A1: "Name", B1: "Score", A2: "Ava", B2: 90, A3: "Ben", B3: 72, A4: "Cam", B4: 85, C2: "x" }, { "Term 2": { A1: 5, A2: 7 } });
  assert.equal(f("=SUM(B2:B4)"), 247);
  assert.equal(f("=AVERAGE(B:B)"), 247 / 3);
  assert.equal(f("=COUNTIF(B2:B4,\">80\")"), 2);
  assert.equal(f("=SUMIF(A2:A4,\"A*\",B2:B4)"), 90);
  assert.equal(f("=VLOOKUP(\"Ben\",A2:B4,2,FALSE)"), 72);
  assert.equal(f("=XLOOKUP(\"Cam\",A2:A4,B2:B4)"), 85);
  assert.equal(f("=INDEX(B2:B4,MATCH(\"Ava\",A2:A4,0))"), 90);
  assert.equal(f("=IF(B3>=80,\"Pass\",\"Retake\")"), "Retake");
  assert.equal(f("=IFS(B2>=90,\"A\",B2>=80,\"B\")"), "A");
  assert.equal(f("=SUM('Term 2'!A1:A2)"), 12);
  assert.deepEqual(f("=Nowhere!A1"), { err: "#REF!" });
  assert.equal(f("=RANK(B4,B2:B4)"), 2);
  assert.equal(f("=IFERROR(1/0,\"none\")"), "none");
  assert.equal(f("=COUNTA(A1:C4)"), 9);
  assert.equal(f("=TEXTJOIN(\", \",TRUE,A2:A4)"), "Ava, Ben, Cam");
});

test("dates, text and finance", () => {
  const f = sheet({ A1: "2026-10-13", A2: "10/1/2026" });
  assert.equal(f("=A1"), toSerial(2026, 10, 13));
  assert.equal(f("=A1-A2"), 12);
  assert.equal(f("=TODAY()"), toSerial(2026, 10, 13));
  assert.equal(f("=YEAR(A1)&\"-\"&MONTH(A1)"), "2026-10");
  assert.equal(f("=NETWORKDAYS(A2,A1)"), 9);
  assert.equal(f("=TEXT(A1,\"mmm d, yyyy\")"), "Oct 13, 2026");
  assert.equal(f("=TEXT(1234.5,\"$#,##0.00\")"), "$1,234.50");
  assert.equal(f("=PROPER(\"hello WORLD\")"), "Hello World");
  assert.equal(f("=ROUND(PMT(0.05/12,360,200000),2)"), -1073.64);
  assert.equal(f("=DATEDIF(A2,A1,\"D\")"), 12);
});

test("formats like Excel", () => {
  assert.equal(formatCode(0.256, "0.0%"), "25.6%");
  assert.equal(formatCode(1234567.891, "#,##0.00"), "1,234,567.89");
  assert.equal(formatCode(-5, "$#,##0.00"), "-$5.00");
  assert.equal(formatCode(toSerial(2026, 1, 5), "dddd"), "Monday");
  assert.equal(formatCode(0.75, "h:mm AM/PM"), "6:00 PM");
});

test("copying and inserting move references the right way", () => {
  assert.equal(shiftFormula("=A1+$B$1+B$2", 1, 1), "=B2+$B$1+C$2");
  assert.equal(shiftFormula("=SUM(A1:A3)", 2, 0), "=SUM(A3:A5)");
  assert.equal(shiftFormula("=A1", -1, 0), "=#REF!");
  assert.equal(adjustForInsert("=SUM(A1:A10)+B5", "row", 2, 3, "Sheet1", true), "=SUM(A1:A13)+B8");
  assert.equal(adjustForInsert("=SUM(A1:A10)+B5", "row", 4, -1, "Sheet1", true), "=SUM(A1:A9)+#REF!");
  assert.equal(adjustForInsert("=Other!A5", "row", 0, 1, "Sheet1", true), "=Other!A5");
});
