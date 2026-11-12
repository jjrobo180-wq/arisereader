// Arise Reader, a new family from start to payment, in a real iPhone-sized browser:
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
const duoWorkspace = JSON.parse(await readFile("script/fixtures/duo-workspace.json", "utf8"));
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
    if (p === "/api/arise-todo/workspace") return req.method() === "GET" ? json({ workspace: duoWorkspace, updatedAt: "2026-11-08T16:23:15.371Z" }) : json({ ok: true, updatedAt: new Date().toISOString() });
    if (p === "/api/todo-plan") return json({ unlimited: false, apps: { work: 0, life: 0, limit: 3 }, ai: { limit: 10, used: 0, left: 10 } });
    if (p === "/api/all-access") return json({ live: false, admin: false, source: null, priceCents: 1000, payment: true, endsAt: null, cancelAtPeriodEnd: false, canManage: false, canBuy: true });
    if (p === "/api/billing/addon-checkout") {
      if (!who || who.role !== "parent" || body.product !== "bundle") return json({ message: "no" }, 403);
      return json({ url: "https://checkout.stripe.com/c/pay/test_family" });
    }
    if (/^\/api\/(parent|books|student|leaderboard|teacher)/.test(p) && who && !paid.has(who.id)) return json({ message: "This account needs an Arise Reader plan.", code: "reader_plan_required" }, 402);
    if (req.method() !== "GET") return json({ ok: true });
    return json(p.includes("notifications") || p.includes("students") ? [] : {});
  }
  if (url.hostname === "checkout.stripe.com") return route.fulfill({ status: 200, contentType: "text/html", body: "<h1 id=stripe>Stripe checkout: Arise Reader family $7.00</h1>" });
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  // Like the real server (server/index.ts): arisereader.com/ without a sign-in cookie is the landing page,
  // unless the address carries a sign-in code from the app.
  if (p === "/" && /^(www\.)?arisereader\.com$/.test(url.hostname) && !url.searchParams.get("signin")) p = "/reader-landing.html";
  if (p === "/" || p === "/app" || p === "/app/") p = "/index.html";
  for (const f of [join(root, p), join(root, "index.html")]) {
    try { if ((await stat(f)).isFile()) return route.fulfill({ status: 200, contentType: TYPES[extname(f)] || "application/octet-stream", body: await readFile(f) }); } catch { /* next */ }
  }
  return route.fulfill({ status: 404, body: "" });
}

// App Review screenshot for the Arise All Access subscription (App Store Connect asks for one):
// To Duo's real All Access pop-up, in the app build, with the App Store's product available at $9.99.
// The App Store is the only thing played by a stand-in (a tiny fake of the Arise Store plugin).
const browser = await webkit.launch();
users.set("duo", { password: "duopass123", user: { id: 9500, username: "duo", displayName: "Duo Person", role: "todo", email: "duo@example.com" } });
const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "en-US" });
await ctx.addInitScript(() => {
  window.Capacitor = {
    isNativePlatform: () => true, getPlatform: () => "ios",
    PluginHeaders: [{ name: "AriseStore", methods: [] }],
    nativePromise: async (plugin, method) => {
      if (plugin !== "AriseStore") return {};
      if (method === "storefront") return { country: "USA" };
      if (method === "product") return { available: true, displayPrice: "$9.99" };
      if (method === "entitlements" || method === "restore") return { transactions: [] };
      return {};
    },
  };
});
await ctx.route("**/*", (route) => serve(route, "dist-todo"));
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", String(e?.message || e).slice(0, 200)));
await p.goto("https://app.local/index.html#/signin", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
await p.getByRole("button", { name: /Sign in/i }).last().click().catch(() => {});
await p.waitForTimeout(800);
await p.getByTestId("native-username").fill("duo");
await p.getByTestId("native-password").fill("duopass123");
await p.getByRole("button", { name: /^Sign in$/ }).click();
await p.waitForTimeout(6000);
for (let i = 0; i < 10; i++) {
  if (await p.getByTestId("all-access-popup").isVisible().catch(() => false)) break;
  const b = p.getByRole("button", { name: /^(Skip|Not now|Done|Start using|Get started|Finish)$/ }).first();
  if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await p.waitForTimeout(900); } else await p.waitForTimeout(900);
}
const shown = await p.getByTestId("all-access-popup").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
await p.waitForTimeout(1500);
const t = await p.evaluate(() => document.body.innerText);
console.log("popup shown:", shown, "| Subscribe button:", /Subscribe · \$9\.99 a month/.test(t));
await p.screenshot({ path: "screens/all-access-subscribe.png" });
await writeFile("screens/text.txt", t);
await browser.close();
process.exit(shown && /Subscribe · \$9\.99 a month/.test(t) ? 0 : 1);
