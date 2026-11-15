// The Plugin Gallery in a real browser (iPhone Safari's engine and Chrome on a computer): the built app
// (dist/public) signed in to Arise To Duo with the server mocked. It opens the gallery, checks the Premium
// and Mini switch, a shelf, searches ("final grade", "gift dates", "docs", "health lite"), clears the
// search, and opens a plugin's page. Run by plugin-store-check.yml; results go to the plugin-store-check branch.
import { readFile, stat, mkdir, writeFile, appendFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, webkit, devices, type BrowserContext, type Page } from "playwright";

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg" };
const user = { id: 1, username: "jermaine", displayName: "Jermaine Robinson", role: "todo", isAdmin: false, email: "test@example.com" };
const plan = { unlimited: true, via: "admin", apps: { work: 2, life: 12, limit: null }, ai: { limit: null, used: 0, left: null } };
const base = JSON.parse(await readFile("script/fixtures/duo-workspace.json", "utf8"));
const OUT = process.env.SCREENS || "screens";

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/results.txt`, "");
const note = (s: string) => { console.log(s); void appendFile(`${OUT}/results.txt`, s + "\n"); };

async function serve(ctx: BrowserContext, label: string) {
  let saved = structuredClone(base), updatedAt = "2026-11-13T16:23:15.371Z";
  await ctx.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (url.hostname === "arisetodo.com" && url.pathname.startsWith("/api/")) {
      const p = url.pathname;
      if (p === "/api/client-error") { note(`${label}: CRASH REPORT ${String(req.postData() || "").slice(0, 1200)}`); return json({ ok: true }); }
      if (p === "/api/me") return json(user);
      if (p === "/api/todo-plan") return json(plan);
      if (p === "/api/arise-todo/workspace") {
        if (req.method() === "PUT") { saved = (req.postDataJSON() as any).workspace; updatedAt = new Date(Date.parse(updatedAt) + 1000).toISOString(); return json({ success: true, updatedAt }); }
        if (url.searchParams.get("since") === updatedAt) return json({ unchanged: true, updatedAt });
        return json({ workspace: saved, updatedAt });
      }
      if (p === "/api/arise-todo/asks") return json({ asks: [] });
      if (p === "/api/profile-links") return json({ mine: [], withMe: [], myEmail: user.email, requests: [] });
      if (req.method() !== "GET") return json({ ok: true });
      return json({});
    }
    if (url.hostname !== "arisetodo.com") return route.abort().catch(() => {});
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (path === "/app" || path === "/app/") path = "/index.html";
    for (const f of [join("dist/public", path), join("dist/public", path.replace(/^\/app/, "")), "dist/public/index.html"]) {
      try { if ((await stat(f)).isFile()) return route.fulfill({ status: 200, contentType: TYPES[extname(f)] || "application/octet-stream", body: await readFile(f) }); } catch { /* next */ }
    }
    return route.fulfill({ status: 404, body: "" });
  });
}

const closePopups = async (page: Page) => {
  for (let i = 0; i < 5; i++) {
    const b = page.getByRole("button", { name: /^(close|skip|not now|maybe later|got it|done|start using|later|no thanks)/i }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(400); } else break;
  }
};
const names = async (page: Page, testid: string, n = 5) => (await page.getByTestId(testid).locator('[data-testid^="plugin-"] .truncate.text-\\[16px\\]').allTextContents().catch(() => [] as string[])).slice(0, n).join(" | ");

for (const [label, engine, opts] of [["iphone", webkit, devices["iPhone 14"]], ["desktop", chromium, { viewport: { width: 1366, height: 900 } }]] as const) {
  const browser = await engine.launch();
  const { defaultBrowserType: _e, ...size } = opts as any;
  const ctx = await browser.newContext({ ...size, serviceWorkers: "block", timezoneId: "America/Denver" });
  await serve(ctx, label);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e).slice(0, 300)));
  const session = Buffer.from(JSON.stringify({ user, token: "test-token" })).toString("base64");
  await ctx.addCookies([{ name: "arise_session", value: session, domain: "arisetodo.com", path: "/" }]);
  await page.addInitScript((s) => {
    try {
      localStorage.setItem("arise_session_backup", s);
      for (const k of ["arise-walkthrough-v1:1", "arise-duo-setup-v2:1", "arise-getting-started:1", "arise-all-access-popup:1"]) localStorage.setItem(k, "1");
      sessionStorage.setItem("arise_plugin_store", "1");
    } catch { /* fine */ }
  }, session);
  const shot = (n: string, full = false) => page.screenshot({ path: `${OUT}/${label}-${n}.png`, fullPage: full });
  try {
    await page.goto("https://arisetodo.com/app#/to-do?go=home", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(6000);
    if (!(await page.getByTestId("plugin-store").isVisible().catch(() => false))) { await closePopups(page); }
    const store = page.getByTestId("plugin-store");
    note(`${label}: gallery open: ${await store.isVisible().catch(() => false)}; count "${(await page.getByTestId("store-app-count").textContent().catch(() => ""))?.trim()}"`);
    note(`${label}: tier buttons: ${(await page.getByTestId("plugin-tiers").locator("button").allTextContents()).join(" / ")}`);
    note(`${label}: premium heading: ${await page.getByTestId("plugin-tier-premium").isVisible()}, mini heading: ${await page.getByTestId("plugin-tier-mini").count() > 0}`);
    note(`${label}: premium rail: ${(await page.locator('[data-testid^="plugin-rail-"] .truncate').allTextContents()).join(" | ")}`);
    note(`${label}: mini shelves: ${(await page.locator('[data-testid="plugin-shelf"][data-tier="mini"] h2').allTextContents()).join(" | ")}`);
    await shot("1-browse");
    await page.getByTestId("plugin-tier-btn-premium").click(); await page.waitForTimeout(600);
    note(`${label}: Premium shelves: ${(await page.locator('[data-testid="plugin-shelf"] h2').allTextContents()).join(" | ")}; chips: ${(await page.getByTestId("plugin-shelf-chip").allTextContents()).join(", ")}`);
    await shot("2-premium");
    await page.getByTestId("plugin-tier-btn-mini").click(); await page.waitForTimeout(600);
    note(`${label}: Mini chips: ${(await page.getByTestId("plugin-shelf-chip").allTextContents()).join(", ")}`);
    await shot("3-mini");
    await page.getByTestId("plugin-shelf-chip").filter({ hasText: "School & study" }).click(); await page.waitForTimeout(600);
    note(`${label}: School & study: ${(await page.getByTestId("plugin-results-title").textContent())?.trim()}`);
    await shot("4-shelf");
    await page.getByTestId("plugin-tier-btn-all").click(); await page.waitForTimeout(300);
    const search = page.getByTestId("plugin-search");
    for (const q of ["final grade", "gift dates", "docs", "podcast", "health lite", "period"]) {
      await search.fill(q); await page.waitForTimeout(500);
      const title = (await page.getByTestId("plugin-results-title").textContent().catch(() => ""))?.trim();
      const prem = await names(page, "plugin-results-premium", 3), mini = await names(page, "plugin-results-mini", 3);
      note(`${label}: search "${q}": ${title} · premium [${prem}] · mini [${mini}]`);
      if (q === "final grade") await shot("5-search");
    }
    await page.getByTestId("plugin-search-clear").click(); await page.waitForTimeout(400);
    note(`${label}: cleared: search empty ${await search.inputValue() === ""}, back to browsing ${await page.getByTestId("plugin-tier-premium").isVisible()}`);
    await search.fill("final grade"); await page.waitForTimeout(400);
    await page.getByTestId("plugin-results-mini").locator('[role="button"]').first().click(); await page.waitForTimeout(800);
    note(`${label}: detail: ${(await page.getByTestId("plugin-detail").locator("h3").textContent().catch(() => ""))} · ${(await page.getByTestId("plugin-detail-kind").textContent().catch(() => ""))}`);
    await shot("6-detail");
    // Escape closes the page, then clears the search.
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    note(`${label}: Escape: detail closed ${!(await page.getByTestId("plugin-detail").isVisible().catch(() => false))}, search cleared ${await search.inputValue() === ""}, gallery still open ${await store.isVisible()}`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    note(`${label}: sideways scroll: ${wide ? "YES (bad)" : "none"}`);
  } catch (e) {
    note(`${label}: FAILED ${String((e as Error)?.message || e).slice(0, 400)}`);
    await shot("error").catch(() => {});
  }
  note(`${label}: page errors: ${errors.length ? errors.join(" || ") : "none"}`);
  await browser.close();
}
