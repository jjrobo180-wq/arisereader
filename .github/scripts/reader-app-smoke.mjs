// Opens the A.R.I.S.E. Reader app build (VITE_NATIVE_APP=reader or educator, with its "inside the iPhone
// app" checks switched on) in Chromium at iPhone size, against the live server, and signs in with a
// public sample account. Prints every page error and whether the "Something went wrong" screen shows,
// and saves screenshots. Usage: node reader-app-smoke.mjs <dist dir> <flavor> <username> <password>
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const [dir, flavor, user, pass] = process.argv.slice(2);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg" };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url || "/").split("?")[0]);
  for (const p of [join(dir, path), join(dir, "index.html")]) {
    try { const body = await readFile(p); res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" }); res.end(body); return; } catch { /* next */ }
  }
  res.writeHead(404); res.end();
}).listen(4173);
const ORIGIN = "http://localhost:4173";
const out = [];
const log = (s) => { out.push(s); console.log(s); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
page.on("pageerror", (e) => log(`PAGE ERROR: ${e.message}\n${String(e.stack || "").split("\n").slice(0, 6).join("\n")}`));
page.on("console", (m) => { if (m.type() === "error") log(`console.error: ${m.text().slice(0, 400)}`); });
// The live server only allows the app's own origin: answer for it here (the request itself is real).
await page.route("https://arisetodo.com/**", async (route) => {
  const cors = { "access-control-allow-origin": ORIGIN, "access-control-allow-credentials": "true", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  try {
    const r = await route.fetch();
    if (r.status() >= 400) log(`API ${r.status()} ${route.request().method()} ${route.request().url().replace("https://arisetodo.com", "")}`);
    await route.fulfill({ response: r, headers: { ...r.headers(), ...cors } });
  } catch (e) { log(`API failed ${route.request().url()}: ${e.message}`); await route.abort(); }
});
const shot = (n) => page.screenshot({ path: `smoke-${flavor}-${n}.png` });
await page.goto(`${ORIGIN}/#/signin`);
await page.waitForTimeout(3000);
await shot("1-signin");
// Sign in (the app's username sign-in, not Apple).
await page.locator('[data-testid="native-email"]').click();
await page.waitForTimeout(800);
await page.locator('[data-testid="native-username"]').fill(user);
await page.locator('[data-testid="native-password"]').fill(pass);
// The form with the keyboard up (the page gets shorter): every field keeps its full height.
await page.setViewportSize({ width: 390, height: 480 }); await page.waitForTimeout(600); await shot("2-signin-keyboard");
const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="native-signin"] label')].map((l) => Math.round(l.getBoundingClientRect().height)));
log(`sign-in rows with the keyboard up: ${rows.join(", ")}px${rows.some((h) => h < 50) ? " — SQUASHED" : ""}`);
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
await shot("3-filled");
await page.locator('[data-testid="native-submit"]').click();
await page.waitForTimeout(9000);
await shot("4-after-signin");
const broken = await page.locator('text=Something went wrong').count();
log(`after sign-in: ${page.url().replace(ORIGIN, "")} — "Something went wrong" ${broken ? "SHOWN" : "not shown"}`);
// Past the first-run screens, then a few seconds on the home screen.
for (let i = 0; i < 6; i++) { const b = page.locator('[data-testid="reader-notify-later"], [data-testid="reader-tour-skip"], [data-testid="reader-tour-next"]').first(); if (!(await b.count())) break; await b.click().catch(() => {}); await page.waitForTimeout(700); }
await page.waitForTimeout(4000);
await shot("5-home");
log(`home: ${page.url().replace(ORIGIN, "")} — "Something went wrong" ${(await page.locator('text=Something went wrong').count()) ? "SHOWN" : "not shown"}`);
await browser.close(); server.close();
console.log(`::notice title=${flavor} app smoke::${out.filter((l) => /ERROR|SHOWN|SQUASHED|failed|API 5/.test(l)).length} problems`);
for (const l of out.filter((l) => /PAGE ERROR|SHOWN|SQUASHED/.test(l))) console.log(`::error title=${flavor}::${l.split("\n")[0].replace(/[\r\n]/g, " ")}`);
if (out.some((l) => /PAGE ERROR|SHOWN|SQUASHED/.test(l))) process.exitCode = 1;
