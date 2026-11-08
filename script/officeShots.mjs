// Screenshots of Sheets, Docs and Slides with a file open, on an iPhone and a laptop (office-shots workflow).
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
await new Promise((ok) => createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const file of [join("dist/public", path), join("dist/public", path, "index.html")]) {
    try { if ((await stat(file)).isFile()) { res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }); res.end(await readFile(file)); return; } } catch { /* next */ }
  }
  res.writeHead(404); res.end();
}).listen(4180, ok));
await mkdir("screens", { recursive: true });
const browser = await chromium.launch();
const results = [];
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, laptop: { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 } };
for (const [size, opts] of Object.entries(sizes)) for (const kind of ["doc", "sheet", "slides"]) for (const open of ["1", "0"]) {
  if (open === "0" && size === "laptop") continue;
  const name = `${size}-${kind}${open === "1" ? "-open" : "-home"}`;
  const ctx = await browser.newContext(opts); const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e)));
  try {
    await page.goto(`http://localhost:4180/office-preview/?kind=${kind}&open=${open}`); await page.waitForTimeout(3500);
    const box = open === "1" ? await page.getByTestId("office-fullscreen").boundingBox() : null;
    const ed = open === "1" ? await page.locator('[data-testid$="-editor"]').first().boundingBox() : null;
    await page.screenshot({ path: `screens/${name}.png` });
    results.push(`ok   ${name}${box ? `  frame ${Math.round(box.width)}x${Math.round(box.height)} editor ${ed ? `${Math.round(ed.width)}x${Math.round(ed.height)}` : "MISSING"}` : ""}${errors.length ? `  errors: ${errors.slice(0, 2).join(" | ")}` : ""}`);
  } catch (e) { results.push(`FAIL ${name}: ${e?.message || e}`); }
  await ctx.close();
}
// Arise To Duo's "Link someone": top, and scrolled to the very bottom (the Send bar must cover the list's end).
for (const [name, after] of [["phone-link-top", null], ["phone-link-bottom", "bottom"], ["phone-link-all-apps", "all"]]) {
  const ctx = await browser.newContext(sizes.phone); const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e)));
  try {
    await page.goto("http://localhost:4180/office-preview/?screen=link"); await page.waitForTimeout(2500);
    if (after === "all") { await page.getByTestId("grant-show-all").click(); await page.waitForTimeout(400); }
    if (after) { await page.locator('[role="dialog"]').evaluate((d) => { d.scrollTop = d.scrollHeight; }); await page.waitForTimeout(500); }
    const bar = await page.getByTestId("link-invite-send").boundingBox();
    const dlg = await page.locator('[role="dialog"]').boundingBox();
    const gap = bar && dlg ? Math.round(dlg.y + dlg.height - (bar.y + bar.height)) : -1;
    const first = await page.locator('[data-testid^="grant-"]').first().innerText().catch(() => "");
    await page.screenshot({ path: `screens/${name}.png` });
    results.push(`ok   ${name}  space under the Send button ${gap}px  first app: ${first.split("\n")[0]}${errors.length ? `  errors: ${errors.slice(0, 2).join(" | ")}` : ""}`);
  } catch (e) { results.push(`FAIL ${name}: ${e?.message || e}`); }
  await ctx.close();
}
await browser.close();
await writeFile("screens/results.txt", results.join("\n") + "\n");
console.log(results.join("\n"));
