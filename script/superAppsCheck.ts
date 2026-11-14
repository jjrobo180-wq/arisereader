// Cooked, Cooked PT, Arise Notes and Podster inside Arise To Duo, in a real browser (iPhone Safari's engine,
// and Chrome on a computer): the built app (dist/public) signed in with a To Duo workspace shaped like a real
// one. It opens the Plugin Gallery on its Super apps, then each plugin and every page in its row of pages, in
// Day and in Night, and keeps screenshots and any page errors. Podster's podcasts come from the live site (read
// only; nothing is ever sent to it). Run by super-apps-check.yml; results go to the super-apps-check branch.
import { readFile, stat, mkdir, writeFile, appendFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, webkit, devices, type BrowserContext, type Page } from "playwright";
import { emptyLibrary, emptyTrainer, LISTING } from "../shared/coach";
import { DEFAULT_SETTINGS, NOTES_PLANS, NOTES_TEMPLATES, allows, newAccount, usageView } from "../shared/ariseNotes";
import { SUPER_APPS, superPagesFor } from "../shared/superApps";

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg" };
const user = { id: 1, username: "jermaine", displayName: "Jermaine Robinson", role: "todo", isAdmin: false, email: "test@example.com" };
const plan = { unlimited: true, via: "admin", apps: { work: 2, life: 12, limit: null }, ai: { limit: null, used: 0, left: null } };
const base = JSON.parse(await readFile("script/fixtures/duo-workspace.json", "utf8"));
const fitStart = { v: 1, onboarded: true, profile: { goal: "maintain", activity: 1.45, units: "lb", waterGoalMl: 2500, stepsGoal: 8000, sex: "male", age: 34, heightCm: 180 },
  apps: { tabs: ["train", "food", "run"], added: ["train", "food", "run", "fast", "sleep", "recovery", "yoga", "mind", "water", "progress", "recipes", "friends"] },
  workouts: [], routines: [], foods: [], recentFoods: [], water: {}, weights: [{ date: "2026-11-01", kg: 82 }] };
const trainer = { profile: emptyTrainer("Jermaine"), listed: false, paidUntil: null, subscribed: false, problems: [], library: emptyLibrary(), clients: [], reviews: [], price: LISTING, payments: false };
const acct = newAccount(1, Date.now());
const notesMe = {
  user: { id: 1, name: "Jermaine Robinson", role: "todo", teacher: false, admin: false, workHub: false, email: true },
  plan: "free", planName: NOTES_PLANS.free.name, usage: usageView(acct, acct, "free"), settings: { ...DEFAULT_SETTINGS },
  features: Object.fromEntries(["speakers", "iep", "rollover", "parent", "study", "ask"].map((f) => [f, allows("free", f as any)])),
  templates: NOTES_TEMPLATES.map((t) => ({ id: t.id, label: t.label, emoji: t.emoji, blurb: t.blurb, allowed: true })),
  services: { speech: true, speakers: false, ai: true }, limits: { pieceSecs: 300, pieceBytes: 24 * 1024 * 1024, maxSecs: 7200, memoSecs: 120 }, family: null,
};

await mkdir("screens", { recursive: true });
await writeFile("screens/results.txt", "");
// Written as it goes, so a run that's stopped part way still says what it saw.
const note = (s: string) => { console.log(s); void appendFile("screens/results.txt", s + "\n"); };

function workspace() {
  const w = structuredClone(base);
  w.family = w.family || {};
  w.family.sections = { ...(w.family.sections || {}), cooked: true, cookedpt: true, arisenotes: true, podster: true };
  w.family.earshot = { ...(w.family.earshot || {}), setupDone: true, genres: ["comedy", "news", "science", "tech", "history"], taste: { comedy: 3, news: 3, science: 3, tech: 3, history: 3 } };
  return w;
}

async function serve(ctx: BrowserContext, label: string) {
  let saved = workspace(), updatedAt = "2026-11-13T16:23:15.371Z", fit = structuredClone(fitStart);
  await ctx.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (url.hostname === "arisetodo.com" && url.pathname.startsWith("/api/")) {
      const p = url.pathname;
      if (p === "/api/client-error") { note(`${label}: CRASH REPORT ${String(req.postData() || "").slice(0, 1200)}`); return json({ ok: true }); }
      // Podster's podcasts: the live site's public listening routes, read only.
      if (p.startsWith("/api/podscroll/")) {
        if (req.method() === "GET" && !/\/(account|ad-free|push)/.test(p)) return route.continue().catch(() => json({}));
        if (p === "/api/podscroll/account") return json({ signedIn: true, email: user.email });
        if (p === "/api/podscroll/ad-free") return json({ adFree: false });
        return json({ ok: true });
      }
      if (p === "/api/me") return json(user);
      if (p === "/api/todo-plan") return json(plan);
      if (p === "/api/arise-todo/workspace") {
        if (req.method() === "PUT") { saved = (req.postDataJSON() as any).workspace; updatedAt = new Date(Date.parse(updatedAt) + 1000).toISOString(); return json({ success: true, updatedAt }); }
        if (url.searchParams.get("since") === updatedAt) return json({ unchanged: true, updatedAt });
        return json({ workspace: saved, updatedAt });
      }
      if (p === "/api/fit/data") { if (req.method() === "PUT") { fit = (req.postDataJSON() as any).data; return json({ ok: true }); } return json({ data: fit }); }
      if (p === "/api/fit/exercises") return json({ exercises: [] });
      if (p === "/api/fit/plus") return json({ plus: false });
      if (p === "/api/coach/trainer") return json(trainer);
      if (p === "/api/notes/me") return json(notesMe);
      if (p === "/api/notes") return json({ notes: [] });
      if (req.method() !== "GET") return json({ ok: true });
      return json({});
    }
    if (url.hostname !== "arisetodo.com") return route.continue().catch(() => route.abort().catch(() => {}));
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

for (const [label, engine, opts] of [["iphone", webkit, devices["iPhone 14"]], ["desktop", chromium, { viewport: { width: 1366, height: 900 } }]] as const) {
  for (const night of [false, true]) {
    const tag = `${label}${night ? "-night" : ""}`;
    const browser = await engine.launch();
    const ctx = await browser.newContext({ ...opts, serviceWorkers: "block", timezoneId: "America/Denver" });
    await serve(ctx, tag);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e?.message || e).slice(0, 300)));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_|status of 4\d\d|net::/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    const session = Buffer.from(JSON.stringify({ user, token: "test-token" })).toString("base64");
    await ctx.addCookies([{ name: "arise_session", value: session, domain: "arisetodo.com", path: "/" }]);
    await page.addInitScript(([s, n]) => {
      try {
        localStorage.setItem("arise_session_backup", s as string);
        localStorage.setItem("arise-walkthrough-v1:1", "1");
        localStorage.setItem("arise-todo-night", n ? "1" : "0");
        localStorage.setItem("arise-hub-night", n ? "1" : "0");
        localStorage.setItem("arise-night", n ? "1" : "0");
        for (const k of ["arise-duo-setup-v1:1", "arise-getting-started:1", "arise-all-access-popup:1", "podscroll.asked"]) localStorage.setItem(k, k === "podscroll.asked" ? "yes" : "1");
      } catch { /* fine */ }
    }, [session, night] as const);
    try {
      // The Plugin Gallery: Super apps.
      if (!night) {
        await page.goto("https://arisetodo.com/app#/to-do", { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(6000); await closePopups(page);
        await page.evaluate(() => { try { sessionStorage.setItem("arise_plugin_store", "1"); } catch { /* fine */ } });
        await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(5000); await closePopups(page);
        const chip = page.getByRole("button", { name: /^super apps$/i }).first();
        if (await chip.isVisible().catch(() => false)) await chip.click().catch(() => {});
        else { const box = page.locator('input[type="search"]').first(); if (await box.isVisible().catch(() => false)) { await box.fill("super"); } }
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `screens/${tag}-0-gallery.png` });
        const found = await Promise.all(["life-cooked", "life-cookedpt", "life-arise-notes", "life-podster"].map(async (id) => (await page.getByTestId(`plugin-${id}`).count()) + (await page.getByTestId(`plugin-rail-${id}`).count())));
        note(`${tag}: gallery shows ${found.filter((n) => n > 0).length}/4 of the apps (${found.join(",")})`);
      }
      for (const app of SUPER_APPS) {
        const before = errors.length;
        await page.goto(`https://arisetodo.com/app#/to-do?go=${app.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(app.id === "podster" ? 7000 : 4500); await closePopups(page);
        const head = await page.getByTestId(`super-head-${app.id}`).isVisible().catch(() => false);
        const strip = page.getByTestId(`super-strip-${app.id}`);
        const pills = await strip.locator('[role="tab"]').allTextContents().catch(() => [] as string[]);
        note(`${tag}: ${app.name}: heading ${head ? "shown" : "MISSING"}; pages: ${pills.map((t) => t.trim()).join(" · ") || "NONE"}`);
        await page.screenshot({ path: `screens/${tag}-${app.id}-1.png` });
        // Every page in the row (Cooked's pages come from Cooked's own plugins, so they're read off the row).
        const ids = app.id === "cooked" ? await strip.locator('[role="tab"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid?.replace("super-page-cooked-", "") || "")) : superPagesFor(app, null);
        let k = 2;
        for (const id of ids.slice(1, night ? 2 : undefined)) {
          const pill = page.getByTestId(`super-page-${app.id}-${id}`);
          if (!(await pill.isVisible().catch(() => false))) { note(`${tag}: ${app.name}: no pill for ${id}`); continue; }
          await pill.click().catch((e) => note(`${tag}: ${app.name}: can't open ${id}: ${String(e.message).split("\n")[0]}`));
          await page.waitForTimeout(id === "feed" || id === "social" || id === "library" ? 4000 : 1800);
          await page.screenshot({ path: `screens/${tag}-${app.id}-${k++}-${id}.png` });
        }
        // The page picker (Notes and Podster).
        if (app.pickable && !night) {
          await page.getByTestId(`super-settings-${app.id}`).click().catch(() => {});
          await page.waitForTimeout(800);
          await page.screenshot({ path: `screens/${tag}-${app.id}-picker.png` });
          await page.keyboard.press("Escape").catch(() => {});
        }
        if (errors.length > before) note(`${tag}: ${app.name}: page errors: ${Array.from(new Set(errors.slice(before))).slice(0, 5).join(" | ")}`);
      }
      // Where each one sits in To Duo's menu.
      if (!night) {
        await page.goto("https://arisetodo.com/app#/to-do", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000); await closePopups(page);
        await page.goto("https://arisetodo.com/app#/to-do?go=home", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500); await closePopups(page);
        // A phone: To Duo's Plugins tab (the app drawer). A computer: the side menu is already showing.
        const menu = page.getByRole("button", { name: /^plugins$/i }).last();
        if (label === "iphone" && await menu.isVisible().catch(() => false)) { await menu.click().catch(() => {}); await page.waitForTimeout(1500); }
        await page.screenshot({ path: `screens/${tag}-9-menu.png` });
        for (const a of SUPER_APPS) note(`${tag}: menu has ${a.name}: ${(await page.getByText(a.name, { exact: true }).count()) > 0}`);
      }
    } catch (e: any) { note(`${tag}: FAILED ${String(e.message).split("\n")[0]}`); }
    if (errors.length) note(`${tag}: all page errors: ${Array.from(new Set(errors)).slice(0, 10).join(" | ")}`);
    await browser.close();
  }
}
process.exit(0);
