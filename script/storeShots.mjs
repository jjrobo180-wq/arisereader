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
  const ctx = await browser.newContext({ ...opts, permissions: ["microphone", "camera", "geolocation"], geolocation: { latitude: 39.7392, longitude: -104.9903 }, colorScheme: "light", timezoneId: "America/Denver", locale: "en-US" });
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
  // A full load each time: changing only the #part keeps whatever was open (the player, a sheet).
  const goto = async (hash, ms = 5000) => { await page.goto("about:blank"); await page.goto(`${SITE}${START}${hash}`, { waitUntil: "domcontentloaded" }); await wait(ms); await clear(); };
  // No clearing here: it would close a sheet the step just opened (a client's details).
  async function shot(n, label) {
    await page.evaluate(() => { window.scrollTo(0, 0); for (const el of document.querySelectorAll("main, [data-scroll], .overflow-y-auto")) el.scrollTop = 0; }).catch(() => {});
    await wait(400);
    await page.screenshot({ path: `store-shots/raw/${kind}-${n}.png` });
    console.log(`ok ${kind}-${n} ${label} ${page.url()}`);
  }
  const steps = {
    cooked: [
      ["Today", async () => {}],
      ["Train", () => tap(/^Train$/i, { within: "nav" })],
      ["Form check", async () => { await tap(/AI form check/i, { after: 6000 }); }],
      ["Food", async () => { await goto(""); await tap(/^Food$/i, { within: "nav" }); }],
      ["Eat out", async () => { await tap(/^Eat out$/i, { after: 8000 }); }],
      ["Find a trainer", async () => { await goto("", 7000); await tap(/^Today$/i, { within: "nav", after: 3000 }); await tap(/Find a trainer/i, { after: 5000 }); }],
      ["Add-ons", async () => { await goto(""); await tap(/^Plugins$/i, { within: "nav" }); }],
      ["Themes", async () => { await goto("", 7000); await tap(/^Today$/i, { within: "nav", after: 3000 }); await tap(/^Settings$/i, { after: 3000 });
        const a = page.getByRole("radiogroup", { name: "Appearance" }).first(); await reach(a);
        await page.evaluate(() => { const g = document.querySelector('[data-testid="fit-theme"]'); g?.scrollIntoView({ block: "start" }); g?.closest("[class*=overflow-y]")?.scrollBy(0, -90); }); await wait(1200); }],
    ],
    cookedpt: [
      ["Clients", () => tap(/^Clients/i, { within: "nav" })],
      ["Website", async () => { await tap(/^Business/i, { within: "nav", after: 3000 }); await tap(/^Build my website$/i, { after: 3500 }) || await tap(/^Edit$/i, { after: 3500 });
        const pv = page.getByTestId("tr-site-preview").first(); if (await visible(pv)) { await pv.click(); await wait(4000); } }],
      ["Business", async () => { await goto(""); await tap(/^Business/i, { within: "nav", after: 3000 }); }],
      // The client opened from the inbox, where the sample client is always at the top.
      ["Client", async () => { await tap(/^Inbox/i, { within: "nav", after: 2500 }); await tap(/Logged lunch/i, { after: 4000 }); }],
      ["Inbox", async () => { await goto(""); await tap(/^Inbox/i, { within: "nav" }); }],
      ["Library", async () => { await goto(""); await tap(/^Library/i, { within: "nav" }); }],
    ],
    notes: [
      // A written note asking Arise for help: "@arise …" on a line, answered right under it.
      ["At Arise", async () => {
        await goto("", 6000); if (kind === "iphone") await tap(/^All notes/i, { after: 2000 });
        await tap(/^New note$/i, { after: 2500 }); await tap(/^Blank/i, { after: 3000 });
        const ed = page.locator('[contenteditable="true"]').first();
        if (await reach(ed)) { await ed.click();
          for (const line of ["Launch week", "Beta went out Monday: 40 sign-ups and two bugs to fix.", "Newsletter draft due Thursday."]) { await page.keyboard.type(line, { delay: 15 }); await page.keyboard.press("Enter"); }
          await page.keyboard.type("@arise make a checklist for launch week", { delay: 25 }); await page.keyboard.press("Enter");
          await wait(25000); await page.keyboard.press("Escape").catch(() => {}); await page.evaluate(() => document.activeElement?.blur?.()).catch(() => {}); await wait(800); } }],
      ["Recordings", async () => { await goto("", 6000); if (kind === "iphone") await tap(/^All notes/i); }],
      ["Summary", async () => { await tap(/Weekly team check-in/i, { after: 3500 });
        const w = page.getByTestId("notes-summarize").first();
        if (await visible(w)) { await w.click(); await page.waitForSelector('[data-testid="notes-summarize"]', { state: "detached", timeout: 90000 }).catch(() => {}); await wait(2500); } }],
      ["Transcript", () => tap(/^Transcript$/i, { after: 2500 })],
      ["Record", () => goto("#/record", 5000)],
      ["Undercover", async () => { await goto("#/undercover", 5000);
        const box = page.getByPlaceholder(/^(Text message|Message)$/).first();
        if (await visible(box)) { await box.fill("What did we decide in today's team check-in?"); await box.press("Enter"); await wait(20000); } }],
      ["Add-ons", () => goto("#/apps", 5000)],
      ["Design", () => goto("#/app/design", 7000)],
      ["Sheets", () => goto("#/app/sheets", 7000)],
      ["Docs", () => goto("#/app/docs", 7000)],
    ],
    podster: [
      // A show whose cover is its logo (a random pick can be a photo of a real person).
      ["Feed", async () => { await goto("#/search/" + encodeURIComponent("Science Magazine Podcast"), 7000);
        await tap(/Science Magazine Podcast/i, { after: 8000 }); await tap(/Play from the first episode/i, { after: 6000 }); }],
      ["Study", async () => { await goto("#/study", 5000);
        const box = page.locator("textarea").first();
        if (await visible(box)) { await box.fill("Photosynthesis happens in the chloroplasts of plant cells. Light reactions in the thylakoids use sunlight to split water, release oxygen, and make ATP and NADPH. The Calvin cycle in the stroma uses that ATP and NADPH to turn carbon dioxide into glucose. Chlorophyll absorbs mostly red and blue light and reflects green, which is why leaves look green.");
          const go = page.getByRole("button", { name: /Make my Study Pod/i }).first();
          if (await visible(go)) { await go.click(); await page.getByText(/Key points/i).first().waitFor({ timeout: 90000 }).catch(() => {}); await wait(2000); } } }],
      ["Social", async () => { await goto("", 5000); if (kind === "iphone") await tap(/^Menu$/, { after: 1200 }); await tap(/^Social$/, { after: 5000 }); }],
      ["Membership", async () => { await goto("", 6000); }],
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
