// Arise Fit's Food, end to end in a real browser (iPhone Safari's engine and Chrome): the built app, signed in,
// with apps set up like a real account (Food added, not on the tab bar). It opens Food, adds a food by search and
// one by Quick add, and checks each reaches the server (a PUT of the Fit data). Run by duo-tasks-check.yml.
import { readFile, stat, mkdir, appendFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, webkit, devices } from "playwright";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const user = { id: 1, username: "jermaine", displayName: "Jermaine Robinson", role: "admin", isAdmin: true, email: "test@example.com" };
const start = { v: 1, onboarded: true, profile: { goal: "maintain", activity: 1.45, units: "lb", waterGoalMl: 2500, stepsGoal: 8000, sex: "male", age: 34, heightCm: 180 },
  apps: { tabs: ["mind", "train", "sleep"], added: ["train", "food", "run", "fast", "sleep", "recovery", "yoga", "mind", "water", "progress", "recipes", "friends", "form", "scan", "coach", "eat", "period", "meds"] },
  workouts: [], routines: [], foods: [], recentFoods: [], water: {}, weights: [{ date: "2026-11-01", kg: 82 }] };
const BANANA = { name: "Banana", brand: "", serving: "1 medium", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, source: "usda" };
await mkdir("screens", { recursive: true });
const note = async (s) => { console.log(s); await appendFile("screens/fit-results.txt", s + "\n"); };

for (const [label, engine, opts] of [["iphone-safari", webkit, devices["iPhone 14"]], ["phone-chrome", chromium, devices["Pixel 7"]]]) {
  const browser = await engine.launch();
  const ctx = await browser.newContext(opts);
  let saved = structuredClone(start); const puts = []; const searches = [];
  await ctx.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname.startsWith("/api/")) {
      const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
      if (url.pathname === "/api/me") return json(user);
      if (url.pathname === "/api/client-error") { await note(`${label}: CRASH REPORT ${String(req.postData() || "").slice(0, 1500)}`); return json({ ok: true }); }
      if (url.pathname === "/api/fit/data") { if (req.method() === "PUT") { const b = req.postDataJSON(); puts.push(b); saved = b.data; return json({ ok: true }); } return json({ data: saved }); }
      if (url.pathname === "/api/fit/exercises") return json({ exercises: [] });
      if (url.pathname === "/api/fit/plus") return json({ plus: false });
      if (url.pathname.startsWith("/api/arise-todo/food/search")) { searches.push(url.searchParams.get("q")); return json({ foods: [BANANA] }); }
      if (req.method() !== "GET") return json({ ok: true });
      return json({});
    }
    if (url.hostname !== "arise.test") return route.abort();
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (p === "/") p = "/index.html";
    for (const f of [join("dist/public", p), "dist/public/index.html"]) {
      try { if ((await stat(f)).isFile()) return route.fulfill({ status: 200, contentType: TYPES[extname(f)] || "application/octet-stream", body: await readFile(f) }); } catch { /* next */ }
    }
    return route.fulfill({ status: 404, body: "" });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 600)}`); });
  const session = Buffer.from(JSON.stringify({ user, token: "test-token" })).toString("base64");
  await ctx.addCookies([{ name: "arise_session", value: session, domain: "arise.test", path: "/" }]);
  await page.addInitScript((s) => { try { localStorage.setItem("arise_session_backup", s); } catch {} }, session);
  const tap = async (loc, what) => { try { await loc.scrollIntoViewIfNeeded({ timeout: 4000 }); await loc.tap({ timeout: 6000 }); return true; } catch (e) { await note(`${label}: can't tap ${what}: ${e.message.split("\n")[0]}`); return false; } };
  try {
    await page.goto("https://arise.test/#/fit", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `screens/fit-${label}-1-today.png` });
    // 1) Food from Today's calories card.
    if (!(await tap(page.getByTestId("fit-today-calories"), "the calories card on Today"))) {
      await tap(page.getByRole("button", { name: /plugins/i }).last(), "Plugins tab");
      await page.waitForTimeout(800);
      await tap(page.getByRole("button", { name: /^food/i }).first(), "Food in Plugins");
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `screens/fit-${label}-2-food.png` });
    const p0 = puts.length;
    if (await tap(page.getByTestId("fit-add-breakfast"), "Add food under Breakfast")) {
      await page.waitForTimeout(800);
      await page.screenshot({ path: `screens/fit-${label}-3-add.png` });
      const searchChip = page.getByRole("button", { name: /^search$/i }).first();
      if (await searchChip.isVisible().catch(() => false)) await tap(searchChip, "Search chip");
      const box = page.getByTestId("fit-food-search");
      if (await tap(box, "the search box")) {
        await page.keyboard.type("banana"); await page.waitForTimeout(1500);
        await tap(page.getByRole("button", { name: /banana/i }).first(), "the Banana result");
        await page.waitForTimeout(600);
        await page.screenshot({ path: `screens/fit-${label}-4-picked.png` });
        await tap(page.getByTestId("fit-food-add"), "Add to Breakfast");
        await page.waitForTimeout(4000);
      }
    }
    await note(`${label}: search add -> searched: ${searches.length}; saves: ${puts.length - p0}; foods saved: ${(saved.foods || []).length} (${(saved.foods || []).some((f) => f.name === "Banana") ? "LOGGED OK" : "NOT LOGGED"})`);
    const p1 = puts.length;
    if (await tap(page.getByTestId("fit-add-lunch"), "Add food under Lunch")) {
      await page.waitForTimeout(800);
      await tap(page.getByRole("button", { name: /^quick add$/i }).first(), "Quick add chip");
      await tap(page.getByTestId("fit-quick-kcal"), "calories box"); await page.keyboard.type("350");
      await tap(page.getByRole("button", { name: /^add$/i }).last(), "Add (quick)");
      await page.waitForTimeout(4000);
    }
    await note(`${label}: quick add -> saves: ${puts.length - p1}; foods saved: ${(saved.foods || []).length} (${(saved.foods || []).some((f) => f.kcal === 350) ? "LOGGED OK" : "NOT LOGGED"})`);
    await page.screenshot({ path: `screens/fit-${label}-5-after.png` });
  } catch (e) { await note(`${label}: FAILED ${e.message.split("\n")[0]}`); }
  if (errors.length) await note(`${label}: page errors: ${Array.from(new Set(errors)).slice(0, 6).join(" | ")}`);
  await browser.close();
}
process.exit(0);
