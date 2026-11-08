// App Store screenshots of A.R.I.S.E. Reader: the real site (arisereader.com) signed in as the App Review
// sample account, at the sizes Apple asks for (6.9" iPhone 1320×2868, 13" iPad 2064×2752).
// Usage: DEMO_USER=... DEMO_PASS=... node script/readerStoreShots.mjs   -> store-shots/{iphone,ipad}-N.png
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const user = process.env.DEMO_USER, pass = process.env.DEMO_PASS;
if (!user || !pass) throw new Error("DEMO_USER and DEMO_PASS are needed");
await mkdir("store-shots", { recursive: true });
const SITE = "https://arisereader.com";
const devices = {
  iphone: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
  ipad: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
};
const pages = [["library", "/#/library"], ["games", "/#/games"], ["profile", "/#/profile"], ["book", null]];
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
  let n = 0;
  for (const [name, path] of pages) {
    try {
      if (path) await page.goto(`${SITE}${path}`, { waitUntil: "domcontentloaded" });
      else {
        // A book: the first one in the Library.
        await page.goto(`${SITE}/#/library`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
        const link = page.locator('a[href*="/read/"], a[href*="#/read/"], a[href*="/course/"]').first();
        if (await link.isVisible().catch(() => false)) await link.click(); else { console.log(`skip ${kind} book: no book link`); continue; }
      }
      await page.waitForTimeout(5000);
      n++;
      await page.screenshot({ path: `store-shots/${kind}-${n}.png` });
      console.log(`ok ${kind}-${n} ${name} ${page.url()}`);
    } catch (e) { console.log(`FAIL ${kind} ${name}: ${e?.message || e}`); }
  }
  await ctx.close();
}
await browser.close();
