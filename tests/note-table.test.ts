// Tables in notes, run in a real browser (Chromium): a table pasted from Google Sheets is tidied and can be
// typed in, and rows and columns can be added and deleted.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Like a Google Sheets copy: fixed sizes and styles, two empty rows on top, an empty column on the right.
const SHEETS = `<google-sheets-html-origin><table style="table-layout:fixed;width:600px" border="1"><colgroup><col width="100"><col width="200"></colgroup><tbody>
<tr style="height:21px"><td style="overflow:hidden;padding:2px 3px;height:21px"></td><td></td><td></td><td></td></tr>
<tr style="height:21px"><td></td><td></td><td></td><td></td></tr>
<tr><td style="font-family:Arial;font-size:10pt">7th Grade</td><td></td><td></td><td></td></tr>
<tr><td>Start</td><td>Period</td><td>End</td><td></td></tr>
<tr><td>8:50:00 AM</td><td>Morning Meeting/Advisory</td><td>9:30:00 AM</td><td></td></tr>
<tr><td>9:30:00 AM</td><td></td><td>9:33:00 AM</td><td></td></tr>
<tr><td></td><td></td><td></td><td></td></tr>
</tbody></table></google-sheets-html-origin>`;

const first = async (names: string[]) => { for (const n of names) { try { return await import(n); } catch { /* next */ } } return null; };

/** A browser page with the table code on it, or null where there is no browser (then the test is skipped). */
async function browserPage() {
  const pw = await first(["playwright", "/opt/npm-tools/node_modules/playwright/index.mjs"]);
  const esb = await first(["esbuild", "/opt/npm-tools/node_modules/esbuild/lib/main.js"]);
  if (!pw || !esb) return null;
  const { chromium } = pw;
  const build = esb.build ?? esb.default?.build;
  const bundle = await build({
    stdin: { contents: `import * as T from "./client/src/components/notes/noteTable"; import { sanitizeHtml } from "./shared/office/docModel"; (window as any).T = T; (window as any).sanitizeHtml = sanitizeHtml;`, resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
    bundle: true, write: false, format: "iife", platform: "browser",
  });
  const browser = await chromium.launch().catch(() => null);
  if (!browser) return null;
  const page = await browser.newPage();
  await page.setContent(`<div id="ed" contenteditable="true" style="width:600px"></div>`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  return { browser, page };
}

const grid = (page: any) => page.evaluate(() => Array.from(document.querySelectorAll("#ed tr")).map((r: any) => Array.from(r.cells).map((c: any) => c.textContent)));

test("a table pasted from Google Sheets is tidied, can be typed in, and its rows and columns added and deleted", { timeout: 60_000 }, async (t) => {
  const open = await browserPage();
  if (!open) { t.skip("no browser here"); return; }
  const { browser, page } = open;
  try {
    await page.evaluate((html: string) => {
      const w = window as any;
      document.getElementById("ed")!.innerHTML = w.T.tidyPastedHtml(w.sanitizeHtml(html));
    }, SHEETS);
    assert.deepEqual(await grid(page), [
      ["7th Grade", "", ""], ["Start", "Period", "End"], ["8:50:00 AM", "Morning Meeting/Advisory", "9:30:00 AM"], ["9:30:00 AM", "", "9:33:00 AM"],
    ], "empty rows above and below and the empty right column are gone");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#ed [style]").length), 0, "no fixed sizes or styles left");

    // Type into an empty cell (Period of the 9:30 row).
    await page.click("#ed tr:nth-child(4) td:nth-child(2)");
    await page.keyboard.type("Passing");
    assert.equal((await grid(page))[3][1], "Passing");

    const act = (row: number, col: number, action: string) => page.evaluate(([r, c, a]: [number, number, string]) => {
      const w = window as any;
      const cell = document.querySelectorAll("#ed tr")[r].children[c] as HTMLTableCellElement;
      const next = w.T.tableAction(cell, a);
      return next ? next.textContent : null;
    }, [row, col, action]);

    await act(0, 0, "delRow");
    assert.equal((await grid(page))[0][0], "Start");
    await act(0, 2, "colRight");
    assert.deepEqual((await grid(page))[0], ["Start", "Period", "End", ""]);
    await act(0, 3, "delCol");
    assert.deepEqual((await grid(page))[0], ["Start", "Period", "End"]);
    await act(1, 1, "colLeft");
    assert.deepEqual((await grid(page))[1], ["8:50:00 AM", "", "Morning Meeting/Advisory", "9:30:00 AM"]);
    await act(1, 1, "delCol");
    await act(0, 0, "rowAbove");
    await act(1, 0, "rowBelow");
    assert.equal((await grid(page)).length, 5);
    assert.deepEqual((await grid(page))[0], ["", "", ""]);
    await act(0, 0, "delRow");
    // Deleting every column, or the whole table, leaves an empty line to keep writing on.
    for (let i = 0; i < 3; i++) await act(0, 0, "delCol");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#ed table").length), 0);
    assert.equal(await page.evaluate(() => document.querySelector("#ed")!.innerHTML), "<p><br></p>");

    await page.evaluate(() => { document.getElementById("ed")!.innerHTML = (window as any).T.NEW_TABLE_HTML; });
    assert.equal((await grid(page)).length, 3);
    await act(1, 1, "delTable");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#ed table").length), 0);
  } finally {
    await browser.close();
  }
});

test("a Google Sheets paste doesn't leave its wrapper tag in the note as text", async () => {
  const { sanitizeHtml } = await import("../shared/office/docModel");
  const out = sanitizeHtml(SHEETS);
  assert.ok(!/google-sheets|&lt;/.test(out), out.slice(0, 120));
  assert.match(out, /<table/);
});

test("every note editor has the table menu and tidies pasted tables", () => {
  const ed = read("client/src/components/notes/useRichEditor.tsx");
  assert.match(ed, /tidyPastedHtml\(sanitizeHtml\(/);
  assert.match(ed, /state\.table\s*\n?\s*\? <DropButton title="Table: add or delete rows and columns"/);
  assert.match(ed, /title="Insert table" onClick=\{insertTable\}/);
  assert.match(ed, /cellOf\(savedRange\.current\?\.startContainer, ed\.current\)/, "acts on the table the caret was in");
});
