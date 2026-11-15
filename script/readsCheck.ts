// The 5-Minute Reads in a real browser (iPhone Safari's engine and Chrome on a computer): the built app
// (dist/public), signed in as a student, with the server mocked. It opens the library (the 5-Minute Reads
// shelf, one row per category), the Reads page (one section per category, then one category opened from a
// link), and a few of the new reads, and keeps screenshots and any page errors. Run by reads-check.yml;
// results go to the reads-check branch.
import { readFile, stat, mkdir, writeFile, appendFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, webkit, devices, type BrowserContext } from "playwright";
import { QUICK_CATEGORIES, quickCategoryId } from "../shared/ariseNews";
import { FUN_READS } from "../shared/funReads";

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const HOST = "www.arisereader.com";
const user = { id: 7, username: "maya", displayName: "Maya", role: "student", isAdmin: false, approvedByTeacher: true, gradeLevel: 5, points: 120 };

await mkdir("screens", { recursive: true });
await writeFile("screens/results.txt", "");
const note = (s: string) => { console.log(s); void appendFile("screens/results.txt", s + "\n"); };
const LISTS = /^\/api\/(books|eye-gaze\/quizzes|custom-quizzes|banners|student\/(favorites|iarise-topics|suggested-books|reading-recommendations|rewards)|quiz-requests|i-arise-book-ids)$/;

async function serve(ctx: BrowserContext, label: string) {
  await ctx.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if ((url.hostname === HOST || url.hostname === "arisetodo.com") && url.pathname.startsWith("/api/")) {
      const p = url.pathname;
      if (p === "/api/client-error") { note(`${label}: CRASH REPORT ${String(req.postData() || "").slice(0, 1200)}`); return json({ ok: true }); }
      if (p === "/api/me" || p === "/api/auth/me") return json(user);
      if (p === "/api/profile") return json({ ...user, quizResults: [] });
      if (p === "/api/news/books" || p === "/api/reads/books") return json({ books: {} });
      if (p === "/api/books/quiz-takers") return json({});
      if (p === "/api/public/stats") return json({ students: 0, quizzes: 0, books: 0 });
      if (p === "/api/announcement") return json(null);
      if (LISTS.test(p)) return json([]);
      if (req.method() !== "GET") return json({ ok: true });
      // Anything else isn't part of this check: answered "not found", which every page already handles.
      return json({ message: "Not found" }, 404);
    }
    if (url.hostname !== HOST) return route.continue().catch(() => route.abort().catch(() => {}));
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (path === "/") path = "/index.html";
    for (const f of [join("dist/public", path), "dist/public/index.html"]) {
      try { if ((await stat(f)).isFile()) return route.fulfill({ status: 200, contentType: TYPES[extname(f)] || "application/octet-stream", body: await readFile(f) }); } catch { /* next */ }
    }
    return route.fulfill({ status: 404, body: "" });
  });
}

const sample = [FUN_READS[0], FUN_READS.find((a) => a.section === "Entertainment")!, FUN_READS.find((a) => a.section === "Space")!, FUN_READS.find((a) => a.section === "Fun Facts")!];
for (const [label, engine, opts] of [["iphone", webkit, devices["iPhone 14"]], ["desktop", chromium, { viewport: { width: 1366, height: 900 } }]] as const) {
  const browser = await engine.launch();
  const { defaultBrowserType: _e, ...size } = opts as any;
  const ctx = await browser.newContext({ ...size, serviceWorkers: "block", timezoneId: "America/Denver" });
  await serve(ctx, label);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e).slice(0, 300)));
  const session = Buffer.from(JSON.stringify({ user, token: "test-token" })).toString("base64");
  await ctx.addCookies([{ name: "arise_session", value: session, domain: HOST, path: "/" }]);
  await page.addInitScript((s) => { try { localStorage.setItem("arise_session_backup", s); localStorage.setItem("arise-walkthrough-v1:7", "1"); } catch { /* fine */ } }, session);
  const shot = async (name: string) => page.screenshot({ path: `screens/${label}-${name}.png`, fullPage: false });
  try {
    // The Reads page: one section per category.
    await page.goto(`https://${HOST}/#/reads`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.locator("#quick").scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(800);
    const sections = await page.getByTestId("quick-category").count();
    note(`${label}: Reads page shows ${sections} category sections (expected ${QUICK_CATEGORIES.length})`);
    await shot("1-reads");
    await page.evaluate(() => window.scrollBy(0, 1400)); await page.waitForTimeout(600); await shot("2-reads-more");
    // A category opened straight from a link.
    for (const c of [QUICK_CATEGORIES.find((x) => x.label === "Stars & Entertainment")!, QUICK_CATEGORIES.find((x) => x.label === "Inventions")!]) {
      const id = quickCategoryId(c.label);
      await page.goto(`https://${HOST}/?r=${id}#/reads?quick=${id}`, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(3000);
      const pressed = await page.locator('.nw-chip[aria-pressed="true"]').first().textContent().catch(() => "");
      note(`${label}: category link ${id} -> chip "${(pressed || "").trim()}"`);
      await shot(`3-cat-${id}`);
    }
    // The library: the 5-Minute Reads shelf, one row per category.
    await page.goto(`https://${HOST}/#/library`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    for (let i = 0; i < 4; i++) { const b = page.getByRole("button", { name: /^(close|skip|not now|maybe later|got it|done|later|no thanks)/i }).first(); if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(300); } else break; }
    await page.locator("#quick-reads-h").scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(800);
    note(`${label}: library shelf shows ${await page.getByTestId("quick-shelf-category").count()} category rows`);
    await shot("4-library-shelf");
    await page.evaluate(() => window.scrollBy(0, 900)); await page.waitForTimeout(500); await shot("5-library-shelf-more");
    // A few of the new reads.
    for (const a of sample) {
      await page.goto(`https://${HOST}/#/news/${a.slug}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3500);
      const h1 = await page.locator("h1").first().textContent().catch(() => "");
      note(`${label}: read ${a.slug} -> "${(h1 || "").trim().slice(0, 80)}"`);
      await shot(`6-read-${a.slug}`);
    }
  } catch (e) { note(`${label}: FAILED ${String((e as Error)?.message || e).slice(0, 300)}`); }
  note(`${label}: page errors: ${errors.length ? errors.join(" | ") : "none"}`);
  await browser.close();
}
