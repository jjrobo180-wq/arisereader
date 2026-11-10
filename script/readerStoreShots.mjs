// App Store screenshots of A.R.I.S.E. Reader: the real site (arisereader.com) signed in as the App Review
// sample account, at the sizes Apple asks for (6.9" iPhone 1320×2868, 13" iPad 2064×2752).
// Usage: DEMO_USER=... DEMO_PASS=... node script/readerStoreShots.mjs   -> store-shots/raw/{iphone,ipad}-N.png
// These are the plain screens; script/readerStoreFrames.mjs sets them in a frame under a headline for the store.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const user = process.env.DEMO_USER, pass = process.env.DEMO_PASS;
if (!user || !pass) throw new Error("DEMO_USER and DEMO_PASS are needed");
await mkdir("store-shots/raw", { recursive: true });
const SITE = "https://arisereader.com";
const devices = {
  iphone: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
  ipad: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
};
const pages = [["library", "/#/library"], ["book", null], ["games", "/#/games"], ["profile", "/#/profile"]];
const browser = await chromium.launch();
for (const [kind, opts] of Object.entries(devices)) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(`${SITE}/#/signin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.locator("#reader-username, #username").first().fill(user);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(6000);
  // Any first-run screen or tour: closed.
  for (const label of ["Skip", "Not now", "Maybe later", "Got it", "Close", "Continue"]) {
    const b = page.getByRole("button", { name: label }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(800); }
  }
  // The first-run "Pick Your Favorites" box: three topics picked and saved, so it doesn't come back.
  async function favorites() {
    const save = page.getByRole("button", { name: /Save My Picks/i }).first();
    if (!(await save.isVisible().catch(() => false))) return;
    for (const t of ["Animals", "Space", "Adventure"]) {
      await page.getByRole("button", { name: t, exact: true }).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
    await save.click().catch(() => {});
    await page.waitForTimeout(2500);
    if (await save.isVisible().catch(() => false)) { await page.keyboard.press("Escape"); await page.waitForTimeout(800); }
  }
  await page.goto(`${SITE}/#/library`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await favorites();
  // The 5-Minute Reads row set to Animals: the store shots carry no photos of real people.
  async function animals() {
    const chip = page.getByRole("button", { name: "Animals", exact: true }).first();
    if (await chip.isVisible().catch(() => false)) { await chip.click().catch(() => {}); await page.waitForTimeout(2500); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500); }
  }
  let n = 0;
  for (const [name, path] of pages) {
    try {
      if (path) await page.goto(`${SITE}${path}`, { waitUntil: "domcontentloaded" });
      else {
        // A book: the first one in the Library.
        await page.goto(`${SITE}/#/library`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
        await favorites();
        await animals();
        const link = page.getByRole("button", { name: /Read & Quiz/i }).first();
        await link.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
        if (await link.isVisible().catch(() => false)) await link.click(); else { console.log(`skip ${kind} book: no Read & Quiz button`); continue; }
      }
      await page.waitForTimeout(5000);
      await favorites();
      if (name === "library") await animals();
      n++;
      await page.screenshot({ path: `store-shots/raw/${kind}-${n}.png` });
      console.log(`ok ${kind}-${n} ${name} ${page.url()}`);
    } catch (e) { console.log(`FAIL ${kind} ${name}: ${e?.message || e}`); }
  }
  await ctx.close();
}
await browser.close();
