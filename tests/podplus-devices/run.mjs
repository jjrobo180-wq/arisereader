// Pod+ on iPad and iPhone Duo: the built app (podscroll/dist) in Safari's engine at each screen's size,
// with real podcasts from the Pod+ server. Saves a screenshot of the home page, the player and the
// Library at every size, and any page errors, to tests/podplus-devices/out (the workflow pushes them to
// the podplus-device-shots branch).
import { webkit } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const dist = new URL("../../podscroll/dist/", import.meta.url).pathname;
const out = new URL("./out/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  let path = u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname;
  try { const body = await readFile(join(dist, path)); res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(4174);

// Screens, in CSS points. iPhone Duo: the inner screen opened like a book (fold down the middle) and
// turned (fold across), and the outer screen; iPads from mini to 13-inch, both ways round.
const SCREENS = [
  { name: "duo-inner-book", width: 890, height: 626 },
  { name: "duo-inner-stack", width: 626, height: 890 },
  { name: "duo-outer", width: 375, height: 812 },
  { name: "ipad-mini-portrait", width: 744, height: 1133 },
  { name: "ipad-11-portrait", width: 834, height: 1194 },
  { name: "ipad-11-landscape", width: 1194, height: 834 },
  { name: "ipad-13-landscape", width: 1376, height: 1032 },
  { name: "ipad-13-portrait", width: 1032, height: 1376 },
];
const only = (process.env.SCREENS || "").split(",").filter(Boolean);
const report = ["# Pod+ on iPad and iPhone Duo", ""];
const browser = await webkit.launch();
for (const s of SCREENS.filter((x) => !only.length || only.includes(x.name))) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  // A listener who already picked interests (so the home page has their genres).
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem("podscroll.v1")) localStorage.setItem("podscroll.v1", JSON.stringify({ setupDone: true, genres: ["news", "comedy", "history", "truecrime"], taste: { news: 3, comedy: 3, history: 3, truecrime: 3 } }));
    } catch { /* storage off */ }
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("page error: " + e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  const shot = async (step) => { await p.screenshot({ path: `${out}${s.name}-${step}.png` }); };
  const wide = await p.evaluate(() => document.documentElement.scrollWidth).catch(() => 0);
  try {
    await p.goto("http://localhost:4174/app/", { waitUntil: "load" });
    await p.waitForTimeout(9000);
    await shot("1-home");
    const sideways = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    // The first episode on the page: open it in the player.
    const cover = p.locator("button:has(img), a:has(img)").first();
    if (await cover.count()) { await cover.tap({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(6000); await shot("2-player"); }
    // Back home, then the Library.
    await p.goto("http://localhost:4174/app/", { waitUntil: "load" });
    await p.waitForTimeout(6000);
    const lib = p.getByRole("button", { name: /library/i }).first();
    if (await lib.count()) { await lib.tap({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(4000); await shot("3-library"); }
    report.push(`## ${s.name} (${s.width}x${s.height})`, `- wider than the screen by: ${sideways}px`, ...(errs.length ? errs.slice(0, 8).map((e) => `- ${e}`) : ["- no page errors"]), "");
  } catch (e) {
    report.push(`## ${s.name}`, `- FAILED: ${String(e?.message || e).slice(0, 300)}`, "");
  }
  void wide;
  await ctx.close();
  await writeFile(`${out}report.md`, report.join("\n"));
}
await browser.close();
console.log(report.join("\n"));
process.exit(0);
