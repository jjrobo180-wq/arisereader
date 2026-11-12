// Phone-size screenshots of Cooked with a made-up sample account, for checking every screen's layout,
// colors and wording (.github/workflows/fit-screens.yml). Serves the built site, signs in a pretend
// person by cookie and answers the app's server calls with sample data, so no real account is used.
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
await new Promise((ok) => createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const file of [join("dist/public", path), join("dist/public", path, "index.html"), join("dist/public", "index.html")]) {
    try { if ((await stat(file)).isFile()) { res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }); res.end(await readFile(file)); return; } } catch { /* next */ }
  }
  res.writeHead(404); res.end();
}).listen(4180, ok));

// ——— A sample person ————————————————————————————————————————————————————————————————————————————
const DAY = 864e5, now = Date.now();
const key = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const at = (daysAgo, h, m = 0) => { const d = new Date(now - daysAgo * DAY); d.setHours(h, m, 0, 0); return d.getTime(); };
const set = (reps, weight) => ({ reps, weight, done: true });
const workouts = [1, 3, 5, 8, 10, 12, 15, 17].map((ago, i) => ({ id: `w${i}`, date: new Date(at(ago, 18)).toISOString(), name: i % 2 ? "Upper A" : "Lower A", programId: "iron-progression", secs: 3300,
  exercises: i % 2 ? [{ exId: "bench-press", name: "Bench press", sets: [set(8, 155), set(8, 155), set(7, 155)] }, { exId: "barbell-row", name: "Barbell row", sets: [set(10, 135), set(10, 135)] }]
    : [{ exId: "back-squat", name: "Back squat", sets: [set(5, 225), set(5, 225), set(5, 225)] }, { exId: "rdl", name: "Romanian deadlift", sets: [set(8, 185), set(8, 185)] }] }));
workouts.push({ id: "y1", date: new Date(at(2, 7)).toISOString(), name: "Morning Mobility", programId: "session-yoga", dayId: "yoga-morning", secs: 600, exercises: [] });
const today = key(now);
const food = (id, meal, name, kcal, p, c, f) => ({ id, date: today, meal, name, kcal, p, c, f, servings: 1 });
const nights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((ago, i) => ({ date: key(at(ago - 1, 6)), bed: at(ago, 22 + (i % 2), 40 - i * 3), wake: at(ago - 1, 6, 30 + (i % 3) * 10), ...(i % 3 === 0 ? { q: 4 } : {}) }));
const DATA = {
  v: 1, onboarded: true,
  profile: { sex: "m", birthYear: 1992, heightCm: 180, goal: "lose", activity: 1.55, units: "lb", waterGoalMl: 2800, stepsGoal: 9000, goalKg: 80, pace: 0.5, dietPlan: "balanced" },
  workouts, routines: [{ id: "r1", name: "Push day", exercises: [{ exId: "bench-press", name: "Bench press", sets: 4, reps: "6-8", rest: 120 }] }],
  program: { id: "iron-progression", started: new Date(at(20, 9)).toISOString(), done: ["u1", "l1", "u2", "l2"] },
  foods: [food("f1", "breakfast", "Greek yogurt with berries", 280, 24, 32, 6), food("f2", "lunch", "Chicken burrito bowl", 640, 45, 70, 18), food("f3", "snack", "Protein bar", 210, 20, 22, 7)],
  recentFoods: [], water: { [today]: 1400 }, weights: [20, 15, 10, 5, 1].map((ago, i) => ({ date: key(at(ago, 7)), kg: 88 - i * 0.6 })),
  fasting: { protocol: "16:8", start: new Date(at(1, 20)).toISOString(), log: [] },
  sleep: { goalH: 8, nights },
};
const USER = { id: 4242, username: "sample-fit", displayName: "Jordan Rivera", role: "student", email: "jordan@example.com" };
const cookie = Buffer.from(JSON.stringify({ user: USER, token: "sample-fit-token" })).toString("base64");

const out = "fit-screens";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
async function shot(name, fn, { dark = false, scrolls = 1, prefs, at: atTime, noTodaySleep, schedule } = {}) {
  // A screen can be taken at a set time of day (the morning check-in only shows in the morning).
  const fixed = atTime ? (() => { const d = new Date(); const [h, m] = atTime.split(":").map(Number); d.setHours(h, m, 0, 0); return d.getTime(); })() : null;
  if (typeof prefs === "function") prefs = prefs(fixed ?? Date.now());
  let data = noTodaySleep ? { ...DATA, sleep: { ...DATA.sleep, nights: DATA.sleep.nights.filter((n) => n.date !== today) } } : DATA;
  if (schedule) data = { ...data, sleep: { ...data.sleep, schedule: { bed: "22:45", wake: "06:30" } } };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: dark ? "dark" : "light", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  await ctx.addCookies([{ name: "arise_session", value: cookie, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(([d, dark, prefs]) => {
    try {
      localStorage.setItem("arise-fit-data", JSON.stringify(d));
      localStorage.setItem("arise-fit-theme", dark ? "dark" : "light");
      for (const [k, v] of Object.entries(prefs || {})) localStorage.setItem(k, v);
    } catch { /* none */ }
  }, [data, dark, prefs]);
  if (fixed) await ctx.clock.setFixedTime(new Date(fixed));
  await ctx.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/api/me") return json(USER);
    if (p === "/api/fit/data") return route.request().method() === "GET" ? json({ data }) : json({ ok: true });
    if (p === "/api/fit/exercises") return json({ exercises: [] });
    if (p === "/api/fit/plus") return json({ plus: true, via: "admin", price: "$4.99 a month", pass: { role: "none" } });
    return json({ message: "Not in the sample." }, 404);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e)));
  try {
    await page.goto("http://localhost:4180/#/fit");
    await page.waitForSelector('[data-testid="fit-app"]', { timeout: 20000 });
    await page.waitForTimeout(1500);
    await fn(page);
    await page.waitForTimeout(900);
    for (let i = 0; i < scrolls; i++) {
      await page.screenshot({ path: `${out}/${name}${scrolls > 1 ? `-${i + 1}` : ""}.png` });
      const moved = await page.evaluate(() => {
        const els = [...document.querySelectorAll("#fit-main, [role=dialog] .overflow-y-auto")].filter((e) => e.scrollHeight > e.clientHeight + 4);
        const el = els[els.length - 1]; if (!el) return false;
        const before = el.scrollTop; el.scrollTop += el.clientHeight - 120; return el.scrollTop !== before;
      });
      if (!moved) break;
      await page.waitForTimeout(700);
    }
    results.push(`ok   ${name}${errors.length ? `  (page errors: ${errors.slice(0, 3).join(" | ")})` : ""}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${String(e?.message || e).split("\n")[0]}${errors.length ? `  (page errors: ${errors.slice(0, 3).join(" | ")})` : ""}`);
    try { await page.screenshot({ path: `${out}/${name}-fail.png` }); } catch { /* none */ }
  }
  await ctx.close();
}
const tap = (id) => async (p) => { await p.getByTestId(id).first().click(); };
const seq = (...fns) => async (p) => { for (const f of fns) { await f(p); await p.waitForTimeout(700); } };

// Each line: a screen. Extra screens for new features are listed in script/fitScreens.list.mjs when it exists.
const SCREENS = [
  ["today", async () => {}, { scrolls: 5 }],
  ["today-dark", async () => {}, { dark: true, scrolls: 2 }],
  ["train", tap("fit-tab-train"), { scrolls: 4 }],
  ["food", tap("fit-tab-food"), { scrolls: 3 }],
  ["settings", tap("fit-open-settings"), { scrolls: 4 }],
  ["progress", seq(tap("fit-tab-apps"), tap("fit-apps-open-progress")), { scrolls: 2 }],
  ["sleep", tap("fit-today-sleep"), { scrolls: 3 }],
];
try { const extra = await import(new URL("./fitScreens.list.mjs", import.meta.url)); SCREENS.push(...extra.default({ tap, seq })); } catch { /* none */ }
const only = process.env.FIT_SCREENS ? new Set(process.env.FIT_SCREENS.split(",")) : null;
for (const [name, fn, opts] of SCREENS) if (!only || only.has(name)) await shot(name, fn, opts);
await browser.close();
await writeFile(`${out}/results.txt`, results.join("\n") + "\n");
console.log(results.join("\n"));
process.exit(0);
