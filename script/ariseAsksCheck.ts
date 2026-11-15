// "@arise" asks in Arise To Duo's Tasks, in a real browser (iPhone Safari's engine and Chrome on a computer):
// the built app (dist/public) signed in, with the server mocked (the asks routes act like server/todoAsks.ts,
// finishing a few seconds after an ask is sent). It types "@arise make a worksheet for Kha by Monday" and an
// "on Monday" one, checks the to-dos and their chips, opens the Arise tab and the worksheet, and opens an ask
// from a notification's link. Run by arise-asks-check.yml; results go to the arise-asks-check branch.
import { readFile, stat, mkdir, writeFile, appendFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, webkit, devices, type BrowserContext, type Page } from "playwright";
import { askKind, type AriseAsk } from "../shared/ariseAsks";

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg" };
const user = { id: 1, username: "jermaine", displayName: "Jermaine Robinson", role: "todo", isAdmin: false, email: "test@example.com" };
const plan = { unlimited: true, via: "admin", apps: { work: 2, life: 12, limit: null }, ai: { limit: null, used: 0, left: null } };
const base = JSON.parse(await readFile("script/fixtures/duo-workspace.json", "utf8"));
const WORKSHEET = "# Fractions Practice for Kha\n\n*Grade 3 level*\n\n**Instructions:** Shade or write the answer.\n\n1. What is 1/2 + 1/4? ____\n2. Which is bigger, 2/3 or 3/5? ____\n3. Draw 3/4 of a pizza.\n\n| Fraction | Picture |\n|---|---|\n| 1/2 | half |\n\n- [ ] Check your work\n\n## Answer key\n1. 3/4\n2. 2/3";

await mkdir("screens", { recursive: true });
await writeFile("screens/results.txt", "");
const note = (s: string) => { console.log(s); void appendFile("screens/results.txt", s + "\n"); };

async function serve(ctx: BrowserContext, label: string) {
  let saved = structuredClone(base), updatedAt = "2026-11-13T16:23:15.371Z";
  saved.family = saved.family || {}; saved.family.members = [{ id: "m1", name: "Kha", emoji: "🦊", color: "#7c3aed", kind: "kid" }, ...(saved.family.members || [])];
  const asks: AriseAsk[] = [];
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
      if (p === "/api/arise-todo/asks" && req.method() === "GET") {
        // An ask sent more than 4 seconds ago is finished, like the real server once the AI answers.
        for (const a of asks) if (a.status === "working" && Date.now() - Date.parse(a.createdAt) > 4000) Object.assign(a, { status: "done", title: "Fractions Practice for Kha", summary: "Kha's fractions worksheet is ready.", result: WORKSHEET, finishedAt: new Date().toISOString(), seen: false });
        return json({ asks });
      }
      if (p === "/api/arise-todo/asks" && req.method() === "POST") {
        const b: any = req.postDataJSON();
        const later = Date.parse(b.runAt) > Date.now() + 60_000;
        const a: AriseAsk = { id: Math.random().toString(36).slice(2, 10), ask: b.ask, taskId: b.taskId, kind: askKind(b.ask), status: later ? "scheduled" : "working", createdAt: new Date().toISOString(), runAt: b.runAt, due: b.due || "", when: b.when || "" };
        asks.unshift(a);
        note(`${label}: server got ask "${b.ask}" · runAt ${later ? "later" : "now"} · due ${b.due || "-"} · when "${b.when}" · people ${JSON.stringify(b.people)}`);
        return json({ ask: a });
      }
      if (/^\/api\/arise-todo\/asks\/[a-z0-9]+\/seen$/.test(p)) { const a = asks.find((x) => p.includes(x.id)); if (a) a.seen = true; return json({ ask: a }); }
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
  return asks;
}

const closePopups = async (page: Page) => {
  for (let i = 0; i < 5; i++) {
    const b = page.getByRole("button", { name: /^(close|skip|not now|maybe later|got it|done|start using|later|no thanks)/i }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(400); } else break;
  }
};

for (const [label, engine, opts] of [["iphone", webkit, devices["iPhone 14"]], ["desktop", chromium, { viewport: { width: 1366, height: 900 } }]] as const) {
  const browser = await engine.launch();
  const { defaultBrowserType: _e, ...size } = opts as any;
  const ctx = await browser.newContext({ ...size, serviceWorkers: "block", timezoneId: "America/Denver" });
  const asks = await serve(ctx, label);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e).slice(0, 300)));
  const session = Buffer.from(JSON.stringify({ user, token: "test-token" })).toString("base64");
  await ctx.addCookies([{ name: "arise_session", value: session, domain: "arisetodo.com", path: "/" }]);
  await page.addInitScript((s) => {
    try {
      localStorage.setItem("arise_session_backup", s);
      for (const k of ["arise-walkthrough-v1:1", "arise-duo-setup-v2:1", "arise-getting-started:1", "arise-all-access-popup:1"]) localStorage.setItem(k, "1");
    } catch { /* fine */ }
  }, session);
  const shot = (n: string) => page.screenshot({ path: `screens/${label}-${n}.png` });
  try {
    await page.goto("https://arisetodo.com/app#/to-do?go=tasks", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(6000); await closePopups(page);
    const box = page.getByTestId("tasks-quick-add");
    note(`${label}: quick add box ${await box.isVisible().catch(() => false) ? "shown" : "MISSING"}; placeholder "${await box.getAttribute("placeholder").catch(() => "")}"`);
    await box.fill("@arise make a worksheet for Kha by Monday");
    await page.waitForTimeout(400);
    note(`${label}: hint ${await page.getByTestId("arise-hint").isVisible().catch(() => false) ? "shown" : "MISSING"}`);
    await shot("1-typing");
    await box.press("Enter");
    await page.waitForTimeout(2500);
    note(`${label}: task added: ${await page.getByText("Arise: make a worksheet for Kha", { exact: false }).count() > 0}`);
    await shot("2-task-added");
    await box.fill("@arise email the coach about Saturday on Monday");
    await box.press("Enter");
    await page.waitForTimeout(2500);
    await shot("3-scheduled");
    // The ask finishes; the chip says so after the next refresh (every 15 s while one is being made).
    await page.waitForTimeout(17000);
    const chips = await page.getByTestId("task-arise-chip").allTextContents().catch(() => [] as string[]);
    note(`${label}: chips: ${chips.map((c) => c.trim()).join(" | ") || "NONE"}`);
    await shot("4-ready");
    // The Arise tab.
    await page.getByTestId("task-view-arise").first().click();
    await page.waitForTimeout(1200);
    note(`${label}: Arise tab rows: ${await page.getByTestId("arise-ask-row").count()}`);
    await shot("5-arise-tab");
    await page.getByTestId("arise-ask-row").first().click();
    await page.waitForTimeout(1200);
    const result = page.getByTestId("arise-ask-result");
    note(`${label}: worksheet shown: ${await result.isVisible().catch(() => false)}; has answer key: ${(await result.textContent().catch(() => "") || "").includes("Answer key")}`);
    await shot("6-worksheet");
    // A notification's link opens the ask.
    const done = asks.find((a) => a.status === "done");
    if (done) {
      await page.goto("https://arisetodo.com/app#/to-do?go=home", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000); await closePopups(page);
      await page.goto(`https://arisetodo.com/app#/to-do?go=asks&ask=${done.id}`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
      note(`${label}: notification link opens the ask: ${await page.getByTestId("arise-ask-open").isVisible().catch(() => false)}`);
      await shot("7-from-notification");
    }
  } catch (e: any) { note(`${label}: FAILED ${String(e.message).split("\n")[0]}`); await shot("x-failed").catch(() => {}); }
  note(`${label}: page errors: ${errors.length ? Array.from(new Set(errors)).slice(0, 8).join(" | ") : "none"}`);
  await browser.close();
}
process.exit(0);
