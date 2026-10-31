// The Eye Gazer games in Safari's engine (WebKit) as an iPad, played with finger taps. Saves a
// screenshot of each game before and after tapping, and every error, to tests/ipad/out.
import { webkit, devices } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
const dist = new URL("./dist/", import.meta.url).pathname, out = new URL("./out/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".json": "application/json", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); return res.end(u.pathname.includes("settings") ? JSON.stringify({ settings: null }) : "{}"); }
  try { const f = join(dist, u.pathname === "/" ? "index.html" : u.pathname); res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end(); }
}).listen(4173);
process.on("unhandledRejection", (e) => { report.push("UNHANDLED: " + String(e?.stack || e).slice(0, 800)); void writeFile(`${out}report.md`, report.join("\n")); });
process.on("uncaughtException", (e) => { report.push("UNCAUGHT: " + String(e?.stack || e).slice(0, 800)); void writeFile(`${out}report.md`, report.join("\n")); });
const report = [];
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPad (gen 7) landscape"] });
// How to get into each game from its menu (button text, in order).
const FLOW = { match: ["Play"], pop: ["First Words"], sentence: ["Little Line"], fidget: ["Surprise Tiles"], farm: [], runner: [], ninja: [], splash: [] };
const save = () => writeFile(`${out}report.md`, report.join("\n"));
for (const g of (process.env.GAMES || "farm,runner,ninja,splash,pop").split(",")) {
  const errs = [], steps = [];
  let p;
  try {
    p = await ctx.newPage();
    p.on("crash", () => errs.push("PAGE CRASHED (out of memory?)"));
    p.on("pageerror", (e) => errs.push("PAGE ERROR: " + e.message));
    p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
    await p.goto(`http://localhost:4173/index.html?g=${g}`);
    await p.waitForTimeout(4000);
    await p.screenshot({ path: `${out}${g}-1-open.png` });
    steps.push("buttons: " + (await p.$$eval("button", (bs) => bs.filter((b) => b.offsetParent).map((b) => (b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 30)).join(" | "))));
    for (const text of FLOW[g]) {
      const b = p.locator("button", { hasText: text }).first();
      if (await b.count()) { await b.tap({ timeout: 5000 }).catch((e) => steps.push("tap failed: " + e.message.slice(0, 120))); steps.push(`tap "${text}"`); await p.waitForTimeout(3000); }
      else steps.push(`no button "${text}"`);
    }
    await p.screenshot({ path: `${out}${g}-2-in.png` });
    for (let round = 0; round < 5; round++) {
      const picks = await p.evaluate(() => (window).__stage?.debugPicks?.() ?? []);
      if (!picks.length) { steps.push(`round ${round}: nothing tappable in 3D`); const vp = p.viewportSize(); await p.touchscreen.tap(vp.width / 2, vp.height * 0.6); await p.waitForTimeout(1500); continue; }
      const before = JSON.stringify(picks.map((x) => x.id));
      const pk = picks[round % picks.length];
      await p.touchscreen.tap(pk.x, pk.y);
      await p.waitForTimeout(1600);
      const after = await p.evaluate(() => (window).__stage?.debugPicks?.() ?? []);
      steps.push(`round ${round}: ${picks.length} tappable; tap ${pk.id} at ${Math.round(pk.x)},${Math.round(pk.y)} -> ${JSON.stringify(after.map((x) => x.id)) === before ? "nothing changed" : "changed"}`);
    }
    await p.screenshot({ path: `${out}${g}-3-after.png` });
  } catch (e) { steps.push("RUNNER ERROR: " + String(e?.message || e).slice(0, 300)); }
  report.push(`## ${g}\n${steps.join("\n")}\n${errs.slice(0, 15).join("\n") || "(no errors)"}\n`);
  await save();
  await p?.close().catch(() => {});
}
console.log(report.join("\n"));
await browser.close(); server.close();
