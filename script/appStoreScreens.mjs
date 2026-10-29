// Phone-size screenshots of Arise To Duo and Pod+ for checking layouts before an App Store release
// (.github/workflows/app-store-screens.yml). Serves the two built sites locally and opens them in an
// iPhone-sized Chromium. Arise's hubs use the built-in sample profile (lib/sampleMode.ts), so no
// account is needed; Pod+ reads the live Pod+ server for podcasts.
import { createServer } from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };
function serve(root, port, fallback) {
  return new Promise((ok) => createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    const tries = [join(root, path), join(root, path, "index.html"), join(root, fallback)];
    for (const file of tries) {
      try { if ((await stat(file)).isFile()) { res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }); res.end(await readFile(file)); return; } } catch { /* next */ }
    }
    res.writeHead(404); res.end("not found");
  }).listen(port, ok));
}

const out = "screens";
await mkdir(out, { recursive: true });
await serve("dist/public", 4173, "index.html");
await serve("podscroll/dist", 4174, "app/index.html");
const browser = await chromium.launch();
const results = [];
async function shot(name, fn, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: opts.dark ? "dark" : "light", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e)));
  try { await fn(page); await page.screenshot({ path: `${out}/${name}.png` }); results.push(`ok   ${name}${errors.length ? `  (page errors: ${errors.slice(0, 3).join(" | ")})` : ""}`); }
  catch (e) { results.push(`FAIL ${name}: ${e?.message || e}`); try { await page.screenshot({ path: `${out}/${name}-fail.png` }); } catch { /* none */ } }
  await ctx.close();
}
const A = "http://localhost:4173", P = "http://localhost:4174";
const wait = (page, ms) => page.waitForTimeout(ms);
/** The sample profile only runs inside /duo-preview.html?sample=1, so the app is framed full screen there. */
const sample = async (page, hash) => {
  await page.goto(`${A}/duo-preview.html?sample=1`);
  await page.evaluate((src) => { document.body.innerHTML = `<iframe id="f" src="${src}" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`; document.body.style.margin = "0"; }, `/app#${hash}`);
  await wait(page, 7000);
};

await shot("arise-signin", async (p) => { await p.goto(`${A}/#/signin`); await wait(p, 3000); });
await shot("arise-privacy", async (p) => { await p.goto(`${A}/privacy/`); await wait(p, 500); });
await shot("arise-support", async (p) => { await p.goto(`${A}/support/`); await wait(p, 500); });
await shot("arise-terms-dark", async (p) => { await p.goto(`${A}/terms/`); await wait(p, 500); }, { dark: true });
await shot("lifehub-home", (p) => sample(p, "/lifehub?pane=home"));
await shot("lifehub-tasks", (p) => sample(p, "/lifehub?pane=tasks"));
await shot("lifehub-calendar", (p) => sample(p, "/lifehub?go=calendar"));
await shot("lifehub-notifications", (p) => sample(p, "/lifehub?go=notifications"));
await shot("lifehub-more-menu", async (p) => {
  await sample(p, "/lifehub?pane=home");
  const f = p.frameLocator("#f");
  await f.getByTestId("life-more").click();
  await wait(p, 600);
});
await shot("lifehub-account-privacy", async (p) => {
  await sample(p, "/lifehub?pane=home");
  const f = p.frameLocator("#f");
  await f.getByTestId("life-more").click();
  await f.getByTestId("life-more-privacy").click();
  await wait(p, 600);
});
await shot("lifehub-account-delete", async (p) => {
  await sample(p, "/lifehub?pane=home");
  const f = p.frameLocator("#f");
  await f.getByTestId("life-more").click();
  await f.getByTestId("life-more-privacy").click();
  await f.getByTestId("account-delete-open").click();
  await wait(p, 600);
});
await shot("duo-split", (p) => sample(p, "/duo"));
await shot("podplus-home", async (p) => { await p.goto(`${P}/app/`); await wait(p, 9000); });
await shot("podplus-home-dark", async (p) => { await p.goto(`${P}/app/`); await wait(p, 9000); }, { dark: true });
await shot("podplus-menu", async (p) => {
  await p.goto(`${P}/app/`); await wait(p, 6000);
  await p.getByRole("button", { name: /menu/i }).first().click(); await wait(p, 800);
});
await shot("podplus-account-privacy", async (p) => {
  await p.goto(`${P}/app/`); await wait(p, 6000);
  await p.getByRole("button", { name: /menu/i }).first().click(); await wait(p, 600);
  await p.getByRole("button", { name: "Account & privacy" }).first().click(); await wait(p, 600);
});
await shot("podplus-privacy", async (p) => { await p.goto(`${P}/privacy/`); await wait(p, 500); });
await shot("podplus-support-dark", async (p) => { await p.goto(`${P}/support/`); await wait(p, 500); }, { dark: true });

await browser.close();
console.log(results.join("\n"));
process.exit(0);
