// Arise To Duo's Tasks, end to end in a real browser: the built app on arisetodo.com (served from dist/public),
// signed in, with a workspace shaped like a real one (script/fixtures/duo-workspace.json: titles blanked). It ticks a
// task and quick-adds one, and checks each is saved to the server (a PUT of the workspace). Run by duo-tasks-check.yml.
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, webkit, devices } from "playwright";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const workspace0 = JSON.parse(await readFile("script/fixtures/duo-workspace.json", "utf8"));
const user = { id: 1, username: "jermaine", displayName: "Jermaine Robinson (Admin)", role: process.env.ROLE || "admin", isAdmin: process.env.ROLE !== "parent", email: "test@example.com" };
const plan = process.env.PLAN === "free" ? { unlimited: false, apps: { work: 2, life: 32, limit: 3 }, ai: { limit: 10, used: 0, left: 10 } } : { unlimited: true, via: "admin", apps: { work: 2, life: 32, limit: null }, ai: { limit: null, used: 0, left: null } };
await mkdir("screens", { recursive: true });
const out = [];
const note = (s) => { out.push(s); console.log(s); };

for (const [label, engine, opts] of [["iphone-safari", webkit, devices["iPhone 14"]], ["phone-chrome", chromium, devices["Pixel 7"]], ["desktop", chromium, { viewport: { width: 1366, height: 860 } }]]) {
  const browser = await engine.launch();
  const ctx = await browser.newContext({ ...opts, serviceWorkers: "block" });
  let saved = structuredClone(workspace0), updatedAt = "2026-11-08T16:23:15.371Z";
  const puts = [];
  await ctx.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname.startsWith("/api/")) {
      const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
      if (url.pathname === "/api/me") return json(user);
      if (url.pathname === "/api/todo-plan") return json(plan);
      if (url.pathname === "/api/arise-todo/workspace") {
        if (req.method() === "PUT") {
          const body = req.postDataJSON(); puts.push(body);
          saved = body.workspace; updatedAt = new Date(Date.parse(updatedAt) + 1000).toISOString();
          return json({ ok: true, updatedAt });
        }
        if (url.searchParams.get("since") === updatedAt) return json({ unchanged: true, updatedAt });
        return json({ workspace: saved, updatedAt });
      }
      if (req.method() !== "GET") return json({ ok: true });
      return json({});
    }
    if (url.hostname !== "arisetodo.com") return route.abort();
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (p === "/app" || p === "/app/") p = "/index.html";
    for (const f of [join("dist/public", p), join("dist/public", p.replace(/^\/app/, "")), "dist/public/index.html"]) {
      try { if ((await stat(f)).isFile()) return route.fulfill({ status: 200, contentType: TYPES[extname(f)] || "application/octet-stream", body: await readFile(f) }); } catch { /* next */ }
    }
    return route.fulfill({ status: 404, body: "" });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  const session = Buffer.from(JSON.stringify({ user, token: "test-token" })).toString("base64");
  await ctx.addCookies([{ name: "arise_session", value: session, domain: "arisetodo.com", path: "/" }]);
  await page.addInitScript((s) => { try { localStorage.setItem("arise_session_backup", s); localStorage.setItem("arise-todo-section", "tasks"); localStorage.setItem("arise-walkthrough-v1:1", "1"); for (const r of ["admin", "parent", "teacher", "personal", "life", "work"]) localStorage.setItem(`arise_todo_tour_v2_seen_1_${r}`, "true"); } catch {} }, session);
  try {
    await page.goto("https://arisetodo.com/app#/lifehub", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(6000);
    // Close anything that opens first (welcome, setup, getting started).
    for (let i = 0; i < 4; i++) { const b = page.getByRole("button", { name: /^(close|skip|not now|maybe later|got it|done|start using|later)/i }).first(); if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(600); } }
    await page.screenshot({ path: `screens/${label}-1-tasks.png` });
    const boxes = page.locator('input[type="checkbox"][aria-label^="Done:"]');
    note(`${label}: ${await boxes.count()} task checkboxes on screen`);
    const first = boxes.first();
    const id = await first.getAttribute("aria-label");
    await first.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    const box = await first.boundingBox().catch(() => null);
    if (box) note(`${label}: on top at the checkbox before tapping: ${await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName}.${String(el.className).slice(0, 90)} ${el.getAttribute("aria-label") || ""}` : "nothing"; }, { x: box.x + box.width / 2, y: box.y + box.height / 2 })}`);
    const before = puts.length;
    const openBefore = (saved.tasks || []).filter((t) => !t.done).length;
    if (box) { if (label === "desktop") await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); else await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); }
    await page.waitForTimeout(4000);
    const openAfter = (saved.tasks || []).filter((t) => !t.done).length;
    note(`${label}: tap ${id} -> saves sent: ${puts.length - before}; open tasks saved ${openBefore} → ${openAfter} (${openAfter < openBefore ? "TICKED OK" : "NOT TICKED"})`);
    await page.screenshot({ path: `screens/${label}-1b-ticked.png` });
    const quick = page.getByLabel("Quick add a to-do");
    if (await quick.isVisible().catch(() => false)) {
      const b2 = puts.length;
      await quick.scrollIntoViewIfNeeded().catch(() => {}); await quick.tap?.().catch(() => {}); await quick.click({ timeout: 5000 }).catch((e) => note(`${label}: quick add box can't be tapped: ${e.message.split("\n")[0]}`));
      await page.keyboard.type("Check from the test"); await page.keyboard.press("Enter"); await page.waitForTimeout(4000);
      const last = puts[puts.length - 1]?.workspace?.tasks || [];
      note(`${label}: quick add -> saves sent: ${puts.length - b2}; saved has it: ${last.some((t) => t.title === "Check from the test")}`);
    } else note(`${label}: no quick-add box visible`);
    await page.screenshot({ path: `screens/${label}-2-after.png` });
  } catch (e) { note(`${label}: FAILED ${e.message.split("\n")[0]}`); }
  if (errors.length) note(`${label}: page errors: ${Array.from(new Set(errors)).slice(0, 6).join(" | ")}`);
  await browser.close();
}
await writeFile("screens/results.txt", out.join("\n") + "\n");
process.exit(0);
