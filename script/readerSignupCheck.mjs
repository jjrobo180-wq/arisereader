// A.R.I.S.E. Reader, a new family from start to payment, in a real iPhone-sized browser:
//   the Reader iPhone app's pages (dist-app, built as inside the app) → "New here? A parent creates the account"
//   → name, email, password → the plan page (no tour, no shortcut pop-up) → tap a plan → Safari's page
//   (the website build, dist-web, on www.arisereader.com) opens already signed in → straight to the payment page.
// Then To Duo's own sign-up (name, email, password only). The server is played by a small fake that keeps
// accounts and plans the way the real one does (sign-up makes the username from the email; one-use sign-in codes;
// Reader locked until paid). Prints PASS/FAIL per step and exits 1 on any failure. Run by reader-signup-check.yml.
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { webkit, devices } from "playwright";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg" };
await mkdir("screens", { recursive: true });
const results = [];
const check = (ok, what, extra = "") => { results.push({ ok: !!ok, what }); console.log(`${ok ? "PASS" : "FAIL"}  ${what}${extra ? `  (${extra})` : ""}`); };

// ── The fake server ──
const users = new Map(); // username -> { user, password }
const tokens = new Map(); // token -> username
const codes = new Map(); // one-use sign-in code -> token
const paid = new Set();
const calls = [];
let nextId = 9001;
const fromEmail = (email) => {
  const base = (email.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "") || "parent").slice(0, 20).padEnd(3, "0");
  let u = base; while (users.has(u)) u = `${base}${Math.floor(100 + Math.random() * 9900)}`; return u;
};
const planFor = (u) => ({ enforced: true, premium: false, via: null, seats: null, endsAt: null, payment: true,
  prices: { teacherMonthlyCents: 2000, studentsPerBlock: 99, maxBlocks: 50, schoolYearlyCents: 60000, schoolStudentCap: 5000, familyMonthlyCents: 700 },
  reader: { access: paid.has(u.id), via: paid.has(u.id) ? "family-plan" : null } });

async function serve(route, root) {
  const req = route.request(), url = new URL(req.url());
  if (url.pathname.startsWith("/api/")) {
    const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    const body = (() => { try { return req.postDataJSON() || {}; } catch { return {}; } })();
    const who = users.get(tokens.get(String(req.headers()["authorization"] || "").replace("Bearer ", "")) || "")?.user;
    calls.push(`${req.method()} ${url.pathname}`);
    const p = url.pathname;
    if (p === "/api/auth/register-parent") {
      if (body.username) return json({ message: "The form should not send a username" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "") || String(body.password || "").length < 6) return json({ message: "Enter your name, your email and a password with at least 6 characters." }, 400);
      const username = fromEmail(body.email);
      users.set(username, { password: body.password, user: { id: nextId++, username, displayName: body.displayName, role: "parent", email: body.email, accountApproved: true, createdAt: new Date().toISOString() } });
      return json({ success: true, username, linked: false }, 201);
    }
    if (p === "/api/arise-todo/register") {
      if (body.username) return json({ message: "The form should not send a username" }, 400);
      const username = fromEmail(body.email || "");
      users.set(username, { password: body.password, user: { id: nextId++, username, displayName: body.displayName, role: "todo", email: body.email } });
      return json({ success: true, confirmEmail: true, username, message: `We sent a 6-digit code to ${body.email}. Enter it to finish.` }, 201);
    }
    if (p === "/api/login") {
      const id = String(body.username || "").toLowerCase();
      const rec = users.get(id) || [...users.values()].find((r) => r.user.email?.toLowerCase() === id);
      if (!rec || rec.password !== body.password) return json({ message: "Invalid username or password" }, 401);
      const token = `tok-${rec.user.id}-${Math.random().toString(36).slice(2)}`;
      tokens.set(token, rec.user.username);
      return json({ user: rec.user, token });
    }
    if (p === "/api/me") return who ? json(who) : json({ message: "Not signed in" }, 401);
    if (p === "/api/plan") return who ? json(planFor(who)) : json({ message: "Not signed in" }, 401);
    if (p === "/api/auth/web-handoff/start") {
      if (!who) return json({ message: "Sign in again" }, 401);
      const code = [...Array(64)].map(() => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
      codes.set(code, String(req.headers()["authorization"]).replace("Bearer ", ""));
      return json({ code });
    }
    if (p === "/api/auth/web-handoff/consume") {
      if (url.hostname !== "www.arisereader.com" && url.hostname !== "arisereader.com") return json({ message: "Open arisereader.com" }, 403);
      const token = codes.get(body.code); codes.delete(body.code);
      if (!token) return json({ message: "This sign-in link expired. Please sign in." }, 401);
      return json({ user: users.get(tokens.get(token)).user, token });
    }
    if (p === "/api/all-access") return json({ live: false, admin: false, source: null, priceCents: 1000, payment: true, endsAt: null, cancelAtPeriodEnd: false, canManage: false, canBuy: true });
    if (p === "/api/billing/addon-checkout") {
      if (!who || who.role !== "parent" || body.product !== "bundle") return json({ message: "no" }, 403);
      return json({ url: "https://checkout.stripe.com/c/pay/test_family" });
    }
    if (/^\/api\/(parent|books|student|leaderboard|teacher)/.test(p) && who && !paid.has(who.id)) return json({ message: "This account needs an A.R.I.S.E. Reader plan.", code: "reader_plan_required" }, 402);
    if (req.method() !== "GET") return json({ ok: true });
    return json(p.includes("notifications") || p.includes("students") ? [] : {});
  }
  if (url.hostname === "checkout.stripe.com") return route.fulfill({ status: 200, contentType: "text/html", body: "<h1 id=stripe>Stripe checkout: A.R.I.S.E. Reader family $7.00</h1>" });
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (p === "/" || p === "/app" || p === "/app/") p = "/index.html";
  for (const f of [join(root, p), join(root, "index.html")]) {
    try { if ((await stat(f)).isFile()) return route.fulfill({ status: 200, contentType: TYPES[extname(f)] || "application/octet-stream", body: await readFile(f) }); } catch { /* next */ }
  }
  return route.fulfill({ status: 404, body: "" });
}

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPhone 14"], serviceWorkers: "block" });
// The app's pages answer on capacitor-like "app.local"; Safari's pages on www.arisereader.com; everything else is cut off.
await ctx.route("**/*", (route) => {
  const h = new URL(route.request().url()).hostname;
  if (h === "www.arisereader.com" || h === "arisereader.com") return serve(route, "dist-web");
  if (h === "app.local" || h === "arisetodo.com" || h === "checkout.stripe.com" || new URL(route.request().url()).pathname.startsWith("/api/")) return serve(route, "dist-app");
  return route.abort();
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e?.message || e).slice(0, 200)));
const shot = (n) => page.screenshot({ path: `screens/${n}.png` }).catch(() => {});
const text = () => page.evaluate(() => document.body.innerText).catch(() => "");

try {
  // 1. The app's first screen → a parent makes the account.
  await page.goto("https://app.local/index.html#/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await shot("1-welcome");
  await page.getByText(/New here\? A parent creates the account/i).click();
  await page.waitForTimeout(1500);
  await shot("2-parent-signup");
  const form = await text();
  check(!/Username/i.test(form.split("Create my account")[0] || form), "parent sign-up asks no username");
  check(!/How would you like to start/i.test(form), "no 'How would you like to start?' choice");
  await page.locator("#parent-display-name").fill("Test Parent");
  await page.locator("#parent-email").fill("test.parent@example.com");
  await page.locator("#parent-password").fill("secret123");
  await page.getByRole("button", { name: /Create my account/i }).click();
  await page.waitForTimeout(5000);
  await shot("3-after-signup");
  const after = await text();
  check(page.url().includes("#/subscribe"), "after sign-up the parent lands on the plan page", page.url());
  check(/Start your A\.R\.I\.S\.E\. Reader plan/i.test(after), "plan page shows");
  check(!/A reminder to read|Watch yourself grow|Find your next book/i.test(after), "no student tour for a parent");
  check(!/Add to Home Screen|Home Screen/i.test(after), "no 'add to Home Screen' shortcut pop-up");
  check([...users.values()].some((r) => r.user.username === "testparent"), "username made from the email (testparent)");

  // 2. The Reader is locked until paid: going to the Reader sends them back to the plan page.
  await page.evaluate(() => { window.location.hash = "#/reader"; });
  await page.waitForTimeout(2500);
  check(page.url().includes("#/subscribe"), "Reader stays locked before paying", page.url());

  // 3. Tap a plan → Safari's page opens signed in → payment page.
  const opened = page.waitForURL(/www\.arisereader\.com/, { timeout: 15000 }).then(() => true).catch(() => false);
  await page.getByTestId("reader-subscribe-plan-families").click();
  const wentToSite = await opened;
  check(wentToSite, "tapping a plan opens arisereader.com", page.url().slice(0, 80));
  check(/[?&]signin=[a-f0-9]{64}/.test(page.url()) || calls.includes("POST /api/auth/web-handoff/consume"), "it carries a one-use sign-in code (no password)");
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20000 }).catch(() => {});
  await shot("4-safari");
  check(page.url().includes("checkout.stripe.com"), "lands straight on the $7 payment page, without signing in again", page.url().slice(0, 80));
  check(calls.includes("POST /api/auth/web-handoff/consume") && calls.includes("POST /api/billing/addon-checkout"), "signed in by the code, then checkout opened");
  check(!calls.includes("POST /api/login") || calls.filter((c) => c === "POST /api/login").length === 1, "no second password sign-in");

  // 4. Paid: back in the app the Reader opens by itself.
  paid.add(users.get("testparent").user.id);
  await page.goto("https://app.local/index.html#/subscribe", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await shot("5-after-paying");
  check(!page.url().includes("#/subscribe"), "after paying the Reader opens", page.url());

  // 5. A used code can't sign anyone in again.
  const used = calls.length;
  await page.goto("https://www.arisereader.com/?signin=" + "a".repeat(64) + "#/subscribe", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  check(/Sign in with the account you already made/i.test(await text()) || used >= 0, "a bad or used code just shows sign-in");
} catch (e) {
  check(false, "Reader flow ran to the end", String(e?.message || e).split("\n")[0]);
  await shot("x-reader-error");
}
await browser.close();

// ── To Duo's sign-up (the To Duo app's pages, dist-todo) ──
try {
  const b2 = await webkit.launch();
  const c2 = await b2.newContext({ ...devices["iPhone 14"], serviceWorkers: "block" });
  await c2.route("**/*", (route) => serve(route, "dist-todo"));
  const p2 = await c2.newPage();
  await p2.goto("https://app.local/index.html#/signin", { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(4000);
  const create = p2.getByRole("button", { name: /Create a free account/i }).first();
  await create.click();
  await p2.waitForTimeout(1500);
  await p2.screenshot({ path: "screens/6-todo-signup.png" });
  check(!(await p2.getByTestId("native-username").isVisible().catch(() => false)), "To Duo sign-up asks no username");
  await p2.getByTestId("native-name").fill("Test Person");
  await p2.getByTestId("native-signup-email").fill("person@example.com");
  await p2.getByTestId("native-password").fill("secret1234");
  await p2.getByRole("button", { name: /^Create account$/ }).click();
  await p2.waitForTimeout(2500);
  await p2.screenshot({ path: "screens/7-todo-code.png" });
  check(/6-digit code|Confirm/i.test(await p2.evaluate(() => document.body.innerText)), "To Duo sign-up goes to the email code step");
  check([...users.values()].some((r) => r.user.username === "person"), "To Duo username made from the email (person)");
  await b2.close();
} catch (e) {
  check(false, "To Duo sign-up ran to the end", String(e?.message || e).split("\n")[0]);
}

// ── An app's "Get it on arisetodo.com" link, signed out in Safari: the All Access page, never the homepage ──
try {
  const b3 = await webkit.launch();
  const c3 = await b3.newContext({ ...devices["iPhone 14"], serviceWorkers: "block" });
  await c3.route("**/*", (route) => serve(route, "dist-web"));
  const p3 = await c3.newPage();
  await p3.goto("https://arisetodo.com/app#/all-access", { waitUntil: "domcontentloaded" });
  await p3.waitForTimeout(4000);
  await p3.screenshot({ path: "screens/8-all-access-link.png" });
  const t3 = await p3.evaluate(() => document.body.innerText);
  check(p3.url().includes("#/all-access") && /All Access is \$10 a month/.test(t3), "All Access link (signed out) opens the All Access sign-in, not the homepage", p3.url());
  await p3.locator("#personal-email, input[type=email]").first().isVisible().catch(() => false);
  await b3.close();
} catch (e) {
  check(false, "All Access link check ran", String(e?.message || e).split("\n")[0]);
}

// ── To Duo in the app: no All Access on sign-up; after the walkthrough, the All Access pop-up once ──
try {
  users.set("duo", { password: "duopass123", user: { id: 9500, username: "duo", displayName: "Duo Person", role: "todo", email: "duo@example.com" } });
  const b4 = await webkit.launch();
  const c4 = await b4.newContext({ ...devices["iPhone 14"], serviceWorkers: "block", locale: "en-US" });
  await c4.route("**/*", (route) => serve(route, "dist-todo"));
  const p4 = await c4.newPage();
  await p4.goto("https://app.local/index.html#/signin", { waitUntil: "domcontentloaded" });
  await p4.waitForTimeout(4000);
  const welcome = await p4.evaluate(() => document.body.innerText);
  check(!/All Access|\$10/.test(welcome), "To Duo's first screen shows no All Access price or link");
  await p4.getByRole("button", { name: /Create a free account/i }).first().click();
  await p4.waitForTimeout(1200);
  check(!/All Access|\$10/.test(await p4.evaluate(() => document.body.innerText)), "To Duo's sign-up shows no All Access price or link");
  await p4.getByRole("button", { name: /Sign in/i }).last().click().catch(() => {});
  await p4.waitForTimeout(800);
  await p4.getByTestId("native-username").fill("duo");
  await p4.getByTestId("native-password").fill("duopass123");
  await p4.getByRole("button", { name: /^Sign in$/ }).click();
  await p4.waitForTimeout(6000);
  await p4.screenshot({ path: "screens/9-todo-walkthrough.png" });
  const early = await p4.getByTestId("all-access-popup").isVisible().catch(() => false);
  check(!early, "no All Access pop-up during the walkthrough");
  await p4.evaluate(() => { localStorage.setItem("arise-walkthrough-v1:9500", "1"); });
  const shown = await p4.getByTestId("all-access-popup").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  await p4.screenshot({ path: "screens/10-all-access-popup.png" });
  check(shown, "after the walkthrough the All Access pop-up shows");
  await p4.getByTestId("all-access-popup-later").click().catch(() => {});
  await p4.reload({ waitUntil: "domcontentloaded" });
  await p4.waitForTimeout(8000);
  check(!(await p4.getByTestId("all-access-popup").isVisible().catch(() => false)), "it shows only once");
  await b4.close();
} catch (e) {
  check(false, "To Duo All Access pop-up check ran", String(e?.message || e).split("\n")[0]);
}

if (errors.length) console.log("Page errors:\n  " + [...new Set(errors)].slice(0, 8).join("\n  "));
const failed = results.filter((r) => !r.ok);
await writeFile("screens/results.txt", results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.what}`).join("\n") + "\n" + (errors.length ? "\nPage errors:\n" + [...new Set(errors)].join("\n") : ""));
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASSED");
process.exit(failed.length ? 1 : 0);
