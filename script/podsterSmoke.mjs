// Opens the built Podster player (dist-pod/app/index.html) in WebKit, signed out and signed in, and fails
// on any page error or a blank screen.
import { webkit } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist-pod");
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const browser = await webkit.launch();
let bad = 0;
for (const signedIn of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  if (signedIn) await ctx.addInitScript(() => { localStorage.setItem("podscroll.session", "x".repeat(44)); localStorage.setItem("podscroll.email", "pat@example.com"); });
  await ctx.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/api/")) return route.fulfill({ status: 200, contentType: "application/json", body: u.pathname.endsWith("ad-free") ? '{"adFree":false}' : "{}" });
    if (u.host !== "pod.local") return route.fulfill({ status: 204, body: "" });
    let p = path.join(root, decodeURIComponent(u.pathname)); if (p.endsWith("/")) p += "index.html";
    try { route.fulfill({ status: 200, contentType: types[path.extname(p)] || "application/octet-stream", body: await readFile(p) }); } catch { route.fulfill({ status: 404, body: "" }); }
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e?.message || e)));
  await page.goto("https://pod.local/app/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const text = (await page.evaluate(() => document.body.innerText)).trim();
  console.log(signedIn ? "signed in:" : "signed out:", errs.length ? `ERRORS ${errs.join(" | ")}` : "no errors", "| text chars:", text.length);
  if (errs.length || text.length < 20) bad++;
  await page.screenshot({ path: `pod-${signedIn ? "in" : "out"}.png` });
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
