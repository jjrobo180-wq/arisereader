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
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPad (gen 7) landscape"] });
const report = [];
for (const g of ["match", "pop", "sentence", "fidget", "farm", "runner", "ninja", "splash"]) {
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGE ERROR: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  await p.goto(`http://localhost:4173/index.html?g=${g}`);
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${out}${g}-1-open.png` });
  // Start buttons first (a game's menu), then whatever can be tapped in the 3D scene.
  const steps = [];
  for (let round = 0; round < 6; round++) {
    const btn = await p.$('button:visible:has-text("Play"), button:visible:has-text("Start"), button:visible:has-text("PLAY"), button:visible:has-text("Go"), button:visible:has-text("Let")');
    if (btn && round < 2) { const t = (await btn.innerText()).slice(0, 40); await btn.tap().catch(() => {}); steps.push(`tap button "${t}"`); await p.waitForTimeout(2500); continue; }
    const picks = await p.evaluate(() => (window).__stage?.debugPicks?.() ?? []);
    steps.push(`round ${round}: ${picks.length} tappable in 3D`);
    if (!picks.length) { const vp = p.viewportSize(); await p.touchscreen.tap(vp.width / 2, vp.height / 2); steps.push("tap centre"); await p.waitForTimeout(1500); continue; }
    const before = JSON.stringify(picks.map((x) => x.id));
    const pk = picks[Math.floor(picks.length / 2)];
    await p.touchscreen.tap(pk.x, pk.y);
    await p.waitForTimeout(1500);
    const after = await p.evaluate(() => (window).__stage?.debugPicks?.() ?? []);
    steps.push(`tap ${pk.id} at ${Math.round(pk.x)},${Math.round(pk.y)} -> ${JSON.stringify(after.map((x) => x.id)) === before ? "NOTHING CHANGED" : "changed"}`);
  }
  await p.screenshot({ path: `${out}${g}-2-after.png` });
  report.push(`## ${g}\n${steps.join("\n")}\n${errs.slice(0, 15).join("\n") || "(no errors)"}\n`);
  await p.close();
}
await writeFile(`${out}report.md`, report.join("\n"));
console.log(report.join("\n"));
await browser.close(); server.close();
