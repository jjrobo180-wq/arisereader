// Phone-size screenshots of Arise To Duo and Pod+ for checking layouts before an App Store release
// (.github/workflows/app-store-screens.yml). Serves the two built sites locally and opens them in an
// iPhone-sized Chromium. Arise's hubs use the built-in sample profile (lib/sampleMode.ts), so no
// account is needed; Pod+ reads the live Pod+ server for podcasts.
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
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
  // First open of the day shows the Daily brief over the hub: close it like a person would.
  const brief = page.frameLocator("#f").getByRole("button", { name: "Close the brief" });
  if (await brief.count()) { await brief.first().click(); await wait(page, 800); }
};
/** Pod+ asks for interests the first time: skip it like a person would. */
const pod = async (page) => {
  await page.goto(`${P}/app/`); await wait(page, 7000);
  const skip = page.getByRole("button", { name: "Skip for now" });
  if (await skip.count()) { await skip.first().click(); await wait(page, 1500); }
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
await shot("podplus-home", (p) => pod(p));
await shot("podplus-home-dark", (p) => pod(p), { dark: true });
await shot("podplus-menu", async (p) => {
  await pod(p);
  await p.getByRole("button", { name: /menu/i }).first().click(); await wait(p, 800);
});
await shot("podplus-account-privacy", async (p) => {
  await pod(p);
  await p.getByRole("button", { name: /menu/i }).first().click(); await wait(p, 600);
  await p.getByRole("button", { name: "Account & privacy" }).last().click(); await wait(p, 600);
});
await shot("podplus-account-delete", async (p) => {
  await pod(p);
  await p.getByRole("button", { name: /menu/i }).first().click(); await wait(p, 600);
  await p.getByRole("button", { name: "Account & privacy" }).last().click(); await wait(p, 600);
  await p.getByTestId("pod-delete-account").click(); await wait(p, 600);
});
await shot("podplus-social", async (p) => {
  await pod(p);
  await p.getByRole("button", { name: /menu/i }).first().click(); await wait(p, 600);
  await p.getByRole("button", { name: /^Social/ }).first().click(); await wait(p, 6000);
});
await shot("podplus-music", async (p) => {
  await p.goto(`${P}/app/#/music`); await wait(p, 6000);
  const skip = p.getByRole("button", { name: "Skip for now" });
  if (await skip.count()) { await skip.first().click(); }
  await wait(p, 10000);
});
await shot("podplus-tab-you", async (p) => { await pod(p); await p.getByTestId("pod-tab-you").click(); await wait(p, 800); });
await shot("podplus-tab-create", async (p) => { await pod(p); await p.getByTestId("pod-tab-create").click(); await wait(p, 800); });
await shot("lifehub-add-menu", async (p) => {
  await sample(p, "/lifehub?pane=home");
  await p.frameLocator("#f").getByTestId("life-tab-add").click();
  await wait(p, 600);
});
await shot("lifehub-tab-you", async (p) => {
  await sample(p, "/lifehub?pane=home");
  await p.frameLocator("#f").getByTestId("life-tab-you").click();
  await wait(p, 600);
});
await shot("lifehub-tab-apps", async (p) => {
  await sample(p, "/lifehub?pane=tasks");
  await p.frameLocator("#f").getByTestId("life-tab-apps").click();
  await wait(p, 900);
});
await shot("podplus-study-pod", async (p) => { await p.goto(`${P}/app/#/study`); await wait(p, 6000); const skip = p.getByRole("button", { name: "Skip for now" }); if (await skip.count()) await skip.first().click(); await wait(p, 1500); });
await shot("podplus-meeting-pod", async (p) => { await p.goto(`${P}/app/#/meeting`); await wait(p, 6000); const skip = p.getByRole("button", { name: "Skip for now" }); if (await skip.count()) await skip.first().click(); await wait(p, 1500); });
await shot("podplus-create-sheet", async (p) => { await pod(p); await p.getByTestId("pod-tab-create").click(); await wait(p, 800); });
await shot("workhub-home", (p) => sample(p, "/hub"));
await shot("workhub-tab-you", async (p) => { await sample(p, "/hub"); await p.frameLocator("#f").getByTestId("hub-tab-you").click(); await wait(p, 600); });
await shot("podplus-continue", async (p) => {
  await p.addInitScript(() => { try { localStorage.setItem("earshot.spots", JSON.stringify({ "1000650000001": { t: 1260, secs: 3300, title: "How the Universe Began, Part 2", show: "Sample Science Show", showId: "1", art: "", at: Date.now() }, "1000650000002": { t: 600, secs: 2900, title: "The Hunt for a Lost City: the Long Version of a Very Long Title", show: "History Hour", showId: "2", art: "", at: Date.now() - 9e5 } })); } catch {} });
  await pod(p);
});
await shot("podplus-import", async (p) => { await p.goto(`${P}/app/#/import`); await wait(p, 6000); const skip = p.getByRole("button", { name: "Skip for now" }); if (await skip.count()) await skip.first().click(); await wait(p, 1200); });
await shot("todo-walkthrough", async (p) => {
  await sample(p, "/lifehub?pane=home");
  await p.frameLocator("#f").locator("body").evaluate(() => window.dispatchEvent(new Event("arise:walkthrough")));
  await wait(p, 700);
});
await shot("todo-walkthrough-split", async (p) => {
  await sample(p, "/lifehub?pane=home");
  const f = p.frameLocator("#f");
  await f.locator("body").evaluate(() => window.dispatchEvent(new Event("arise:walkthrough")));
  await wait(p, 500);
  for (let k = 0; k < 7; k++) { await f.getByTestId("walkthrough-next").click(); await wait(p, 150); }
  await wait(p, 400);
});
await shot("workhub-more-menu", async (p) => { await sample(p, "/hub"); await p.frameLocator("#f").getByTestId("hub-more").click(); await wait(p, 600); });
await shot("workhub-gallery", async (p) => { await sample(p, "/hub"); const f = p.frameLocator("#f"); await f.getByTestId("hub-more").click(); await wait(p, 300); await f.getByTestId("hub-more-gallery").click(); await wait(p, 1500); });
await shot("lifehub-gallery-search", async (p) => { await sample(p, "/lifehub?pane=home"); const f = p.frameLocator("#f"); await f.getByTestId("life-more").click(); await wait(p, 300); await f.getByTestId("life-more-gallery").click(); await wait(p, 1200); const box = f.getByRole("searchbox").first(); if (await box.count()) { await box.fill("calorie"); await wait(p, 800); } });
await shot("podplus-could-save", async (p) => {
  await p.addInitScript(() => { try { const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); const wk = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`; localStorage.setItem("earshot.couldSave", JSON.stringify({ total: { ads: 4300, intros: 0, speed: 0 }, weeks: { [wk]: { ads: 1850, intros: 0, speed: 0 } } })); } catch {} });
  await pod(p);
});
await shot("podplus-privacy", async (p) => { await p.goto(`${P}/privacy/`); await wait(p, 500); });
await shot("podplus-support-dark", async (p) => { await p.goto(`${P}/support/`); await wait(p, 500); }, { dark: true });

await browser.close();
console.log(results.join("\n"));
await writeFile(`${out}/results.txt`, results.join("\n") + "\n");
process.exit(0);
