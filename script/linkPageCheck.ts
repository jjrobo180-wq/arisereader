// The Link page in a real browser (iPhone Safari's engine and Chrome on a computer): the built app
// (dist/public) opening a shared Link page with the server mocked, in each theme and both layouts.
// Run by link-page-check.yml; screenshots and results go to the link-page-check branch.
import { readFile, stat, mkdir, writeFile, appendFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, webkit, devices, type BrowserContext } from "playwright";

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const OUT = process.env.SCREENS || "screens";
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/results.txt`, "");
const note = (s: string) => { console.log(s); void appendFile(`${OUT}/results.txt`, s + "\n"); };

const LINKS = [
  { title: "Instagram", url: "https://instagram.com/jrobinson", emoji: "📸" },
  { title: "TikTok", url: "https://www.tiktok.com/@jrobinson", emoji: "🎵" },
  { title: "LinkedIn", url: "https://www.linkedin.com/in/jrobinson", emoji: "💼" },
  { title: "Email", url: "mailto:hello@jrobinson.co", emoji: "💬" },
  { title: "Portfolio", url: "https://jrobinson.co", emoji: "🔗" },
  { title: "Book a 20-minute call", url: "https://cal.com/jrobinson/intro", emoji: "📅" },
  { title: "Arise Reader for classrooms", url: "https://www.arisereader.com", emoji: "📚" },
  { title: "Newsletter", url: "https://jrobinson.substack.com", emoji: "✍️" },
];
const PAGES: Record<string, any> = {
  light: { theme: undefined, style: undefined },
  dark: { theme: "dark", style: undefined },
  sand: { theme: "sand", style: undefined },
  mist: { theme: "mist", style: "directory" },
};

async function serve(ctx: BrowserContext) {
  await ctx.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (url.hostname === "arisetodo.com" && url.pathname.startsWith("/api/")) {
      const m = /^\/api\/todo-share\/([a-z]+)x+$/.exec(url.pathname);
      if (m && PAGES[m[1]]) {
        const p = PAGES[m[1]];
        return json({ owner: "Jermaine", today: "2026-11-15", myVote: null, view: { kind: "links", title: "Jermaine Robinson", bio: "Teacher, builder of Arise. Helping kids fall in love with reading.", ...(p.style ? { style: p.style } : {}), ...(p.theme ? { theme: p.theme } : {}), links: LINKS.map((l, i) => p.style === "directory" ? { ...l, group: i < 6 ? "Work" : "Reading" } : l) } });
      }
      if (url.pathname === "/api/client-error") { note(`CRASH REPORT ${String(req.postData() || "").slice(0, 600)}`); return json({ ok: true }); }
      return json({}, 404);
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

for (const [label, engine, opts] of [["iphone", webkit, devices["iPhone 14"]], ["desktop", chromium, { viewport: { width: 1280, height: 900 } }]] as const) {
  const browser = await engine.launch();
  const { defaultBrowserType: _e, ...size } = opts as any;
  const ctx = await browser.newContext({ ...size, serviceWorkers: "block" });
  await serve(ctx);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e).slice(0, 300)));
  for (const theme of Object.keys(PAGES)) {
    try {
      await page.goto(`https://arisetodo.com/app#/share/${theme}${"x".repeat(24)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.getByTestId("link-page-view").waitFor({ timeout: 20000 });
      await page.waitForTimeout(800);
      const name = await page.getByTestId("link-page-name").textContent();
      const icons = await page.getByTestId("link-page-icons").locator("a").count().catch(() => 0);
      const rows = await page.locator('[data-testid="link-page-view"] a[href^="http"]').count();
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      note(`${label} ${theme}: name "${name}", icons ${icons}, links ${rows}, title "${await page.title()}", sideways scroll ${wide ? "YES" : "none"}`);
      await page.screenshot({ path: `${OUT}/${label}-${theme}.png`, fullPage: true });
    } catch (e) { note(`${label} ${theme}: FAILED ${String((e as Error)?.message || e).slice(0, 300)}`); await page.screenshot({ path: `${OUT}/${label}-${theme}-error.png` }).catch(() => {}); }
  }
  note(`${label}: page errors: ${errors.length ? errors.join(" || ") : "none"}`);
  await browser.close();
}
