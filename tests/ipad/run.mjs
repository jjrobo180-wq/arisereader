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
  try { const f = join(dist, u.pathname === "/" ? "index.html" : u.pathname); const body = await readFile(f); res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); res.end(body); }
  catch { if (!res.headersSent) { res.writeHead(404); res.end(); } }
}).listen(4173);
process.on("unhandledRejection", (e) => { report.push("UNHANDLED: " + String(e?.stack || e).slice(0, 800)); void writeFile(`${out}report.md`, report.join("\n")); });
process.on("uncaughtException", (e) => { report.push("UNCAUGHT: " + String(e?.stack || e).slice(0, 800)); void writeFile(`${out}report.md`, report.join("\n")); });
const report = [];
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPad (gen 7) landscape"] });
// How to get into each game from its menu (button text, in order).
const FLOW = { match: ["Play"], pop: ["First Words"], sentence: ["Little Line"], fidget: ["Surprise Tiles"], farm: [], runner: ["PLAY"], ninja: ["PLAY"], splash: ["SPLASH!"], talker: [], flashcards: [], lessons: [], home: [] };
const save = () => writeFile(`${out}report.md`, report.join("\n"));
for (const g of (process.env.GAMES || "runner,ninja,splash,talker,flashcards,lessons,home").split(",")) {
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
      if (!picks.length) {
        const vp = p.viewportSize(); const a = await p.screenshot();
        // a swipe left/right and a tap (steering, slicing), then: did the screen change?
        const cdp = async (x0, y0, x1, y1) => { await p.evaluate(([x0, y0, x1, y1]) => { const el = document.elementFromPoint(x0, y0) || document.body; const mk = (type, x, y) => new PointerEvent(type, { pointerType: "touch", pointerId: 7, clientX: x, clientY: y, bubbles: true, isPrimary: true }); el.dispatchEvent(mk("pointerdown", x0, y0)); for (let i = 1; i <= 6; i++) window.dispatchEvent(mk("pointermove", x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6)); window.dispatchEvent(mk("pointerup", x1, y1)); }, [x0, y0, x1, y1]); };
        await cdp(vp.width * 0.5, vp.height * 0.6, vp.width * (round % 2 ? 0.2 : 0.8), vp.height * 0.6);
        await p.touchscreen.tap(vp.width * (0.3 + 0.1 * round), vp.height * 0.5);
        await p.waitForTimeout(1500);
        const b = await p.screenshot();
        steps.push(`round ${round}: no 3D targets; swipe + tap -> screen ${Buffer.compare(a, b) ? "changed" : "SAME"}`);
        continue;
      }
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
