// App Store screenshots of Cooked, Cooked PT, Arise Notes and Podster: the real site (arisetodo.com) signed in
// as the App Review account, at the sizes Apple asks for (6.9" iPhone 1320×2868, 13" iPad 2064×2752).
// Usage: APP=cooked DEMO_USER=... DEMO_PASS=... node script/storeShots.mjs   -> store-shots/raw/{iphone,ipad}-N.png
// Podster needs no sign-in. script/storeFrames.mjs then sets each one in a frame under its headline.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const APP = process.env.APP;
const user = process.env.DEMO_USER, pass = process.env.DEMO_PASS;
const SITE = "https://arisetodo.com";
const START = { cooked: "/#/fit", cookedpt: "/#/trainer", notes: "/notes/", podster: "/podster/app/" }[APP];
if (!START) throw new Error("APP is needed (cooked, cookedpt, notes, podster)");
if (APP !== "podster" && (!user || !pass)) throw new Error("DEMO_USER and DEMO_PASS are needed");
const IPAD = process.env.IPAD !== "0";
await mkdir("store-shots/raw", { recursive: true });
const UA = (d) => `Mozilla/5.0 (${d}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1`;
const devices = {
  iphone: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA("iPhone; CPU iPhone OS 18_0 like Mac OS X") },
  ...(IPAD ? { ipad: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA("iPad; CPU OS 18_0 like Mac OS X") } } : {}),
};

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
// One sign-in, shared by both sizes: the same cookie the site sets when someone signs in.
let cookie = null;
if (APP !== "podster") {
  const r = await fetch(`${SITE}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: user, password: pass }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.token) throw new Error(`Sign-in refused (${r.status}): ${d.message || ""}`);
  cookie = Buffer.from(encodeURIComponent(JSON.stringify({ user: d.user, token: d.token })).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("base64");
  console.log(`signed in as ${d.user?.username}`);
}

for (const [kind, opts] of Object.entries(devices)) {
  const ctx = await browser.newContext({ ...opts, permissions: ["microphone"], colorScheme: "light", timezoneId: "America/Denver", locale: "en-US" });
  if (cookie) await ctx.addCookies([{ name: "arise_session", value: cookie, domain: ".arisetodo.com", path: "/", sameSite: "Lax", expires: Math.floor(Date.now() / 1000) + 86400 }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const wait = (ms) => page.waitForTimeout(ms);
  const visible = (loc) => loc.isVisible().catch(() => false);
  // Pop-ups, tours and first-run screens: closed.
  async function clear() {
    for (let round = 0; round < 3; round++) {
      let closed = false;
      for (const name of [/^(Skip|Not now|Maybe later|Got it|No thanks|Close|Dismiss|Later|Done)$/i]) {
        const b = page.getByRole("button", { name }).first();
        if (await visible(b)) { await b.click().catch(() => {}); await wait(700); closed = true; }
      }
      const x = page.locator('[aria-label="Close"], [aria-label="close"]').first();
      if (await visible(x)) { await x.click().catch(() => {}); await wait(700); closed = true; }
      if (!closed) break;
    }
  }
  // Something further down the screen is scrolled to first.
  const reach = async (loc) => { await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); return visible(loc); };
  async function tap(name, opts = {}) {
    const within = opts.within ? page.locator(opts.within) : page;
    const b = within.getByRole(opts.role || "button", { name, exact: !!opts.exact }).first();
    if (await reach(b)) { await b.click(); await wait(opts.after ?? 2500); return true; }
    const l = within.getByRole("link", { name, exact: !!opts.exact }).first();
    if (await reach(l)) { await l.click(); await wait(opts.after ?? 2500); return true; }
    const t = within.getByText(name, { exact: !!opts.exact }).first();
    if (await reach(t)) { await t.click(); await wait(opts.after ?? 2500); return true; }
    console.log(`  (no "${name}" on ${kind})`);
    return false;
  }
  const goto = async (hash, ms = 5000) => { await page.goto(`${SITE}${START}${hash}`, { waitUntil: "domcontentloaded" }); await wait(ms); await clear(); };
  async function shot(n, label) {
    await clear();
    await page.evaluate(() => { window.scrollTo(0, 0); for (const el of document.querySelectorAll("main, [data-scroll], .overflow-y-auto")) el.scrollTop = 0; }).catch(() => {});
    await wait(400);
    await page.screenshot({ path: `store-shots/raw/${kind}-${n}.png` });
    console.log(`ok ${kind}-${n} ${label} ${page.url()}`);
  }
  const steps = {
    cooked: [
      ["Today", async () => {}],
      ["Train", () => tap(/^Train$/i, { within: "nav" })],
      ["Food", () => tap(/^Food$/i, { within: "nav" })],
      ["Plugins", () => tap(/^Plugins$/i, { within: "nav" })],
    ],
    cookedpt: [
      ["Clients", () => tap(/^Clients/i, { within: "nav" })],
      ["Client", async () => { await tap("Maya Brooks", { after: 3500 }); }],
      ["Inbox", async () => { await goto(""); await tap(/^Inbox/i, { within: "nav" }); await tap("Maya Brooks", { after: 3000 }); }],
      ["Library", async () => { await goto(""); await tap(/^Library/i, { within: "nav" }); }],
    ],
    notes: [
      ["Recordings", async () => { if (kind === "iphone") await tap(/^All notes/i); }],
      ["Summary", async () => { await tap(/Weekly team check-in/i, { after: 3500 });
        const w = page.getByTestId("notes-summarize").first();
        if (await visible(w)) { await w.click(); await page.waitForSelector('[data-testid="notes-summarize"]', { state: "detached", timeout: 90000 }).catch(() => {}); await wait(2500); } }],
      ["Transcript", () => tap(/^Transcript$/i, { after: 2500 })],
      ["Record", () => goto("#/record", 5000)],
    ],
    podster: [
      ["Home", async () => {}],
      ["Feed", async () => { const ep = page.locator("main button, main a").filter({ has: page.locator("img") }).nth(2); if (await visible(ep)) { await ep.click(); await wait(4000); } }],
      ["Audiobooks", () => goto("#/books", 6000)],
      ["Radio", () => goto("#/radio", 6000)],
    ],
  }[APP];
  await page.goto(`${SITE}${START}`, { waitUntil: "domcontentloaded" });
  await wait(7000);
  await clear();
  for (const [i, [label, go]] of steps.entries()) {
    try { await go(); await wait(800); await shot(i + 1, label); }
    catch (e) { console.log(`skip ${kind}-${i + 1} ${label}: ${String(e.message || e).split("\n")[0]}`); }
  }
  await ctx.close();
}
await browser.close();
