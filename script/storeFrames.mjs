// App Store screenshots of Cooked, Cooked PT, Arise Notes or Podster, dressed for the store: each plain
// screenshot from storeShots.mjs (store-shots/raw/{iphone,ipad}-N.png) is set in a phone or tablet frame
// on the app's own color or ink, under the headline its store/<APP>/listing.json gives it, at Apple's size.
// Usage: APP=cooked node script/storeFrames.mjs   -> store-shots/{iphone,ipad}-N.png
// IN and OUT name other folders; CHROME_PATH names a browser when Playwright has none of its own.
import { chromium } from "playwright";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const APP = process.env.APP;
if (!APP) throw new Error("APP is needed (cooked, cookedpt, notes, podster)");
const listing = JSON.parse(await readFile(`store/${APP}/listing.json`, "utf8"));

const IN = process.env.IN || "store-shots/raw";
const OUT = process.env.OUT || "store-shots";
// A screen chosen by hand (a real phone screenshot, its status bar cropped off) is used in place of the
// one taken automatically with the same name.
const FIXED = process.env.FIXED || `store/${APP}/fixed`;

// One headline per screenshot, by its number in storeShots.mjs; the grounds take turns.
const SLIDES = listing.headlines.map(([title, sub], i) => ({ title, sub, ground: i % 2 ? "ink" : "brand" }));

// The page is laid out in points and drawn at the device's scale, so the picture comes out at Apple's size.
const KINDS = {
  iphone: { w: 440, h: 956, scale: 3, title: 47, sub: 18.5, top: 100, frameTop: 262, frameW: 352, radius: 46, bezel: 7, ribbon: 46 },
  ipad: { w: 1032, h: 1376, scale: 2, title: 84, sub: 31, top: 128, frameTop: 420, frameW: 800, radius: 40, bezel: 11, ribbon: 84 },
};

// Each app's own color; the bookmark ribbon is Arise's, so only Arise Notes carries it.
const BRAND = { cooked: ["#ff5a1f", "#ff8a57", "#fff0e8"], cookedpt: ["#2456f0", "#5b82ff", "#e3eaff"], notes: ["#5b45d8", "#7d6bf0", "#ebe7ff"], podster: ["#ff6a1a", "#ff9752", "#fff0e6"] }[APP];
const RIBBON = APP === "notes";
const GROUNDS = {
  brand: { bg: BRAND[0], glow: BRAND[1], ribbon: "#15131f", sub: BRAND[2] },
  ink: { bg: "#15131f", glow: "#2a2540", ribbon: BRAND[0], sub: "#cdc8de" },
};

function html(kind, slide, shot) {
  const k = KINDS[kind], g = GROUNDS[slide.ground];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;900&display=swap">
<style>
  html, body { margin: 0; width: ${k.w}px; height: ${k.h}px; overflow: hidden; }
  body { position: relative; background: ${g.bg}; font-family: Inter, "Helvetica Neue", Arial, sans-serif; color: #fff; text-align: center; }
  /* One soft light behind the device, so the frame lifts off the ground. */
  .glow { position: absolute; left: 50%; top: ${k.frameTop + k.frameW * 0.5}px; width: ${k.frameW * 1.9}px; height: ${k.frameW * 1.9}px; margin-left: ${-k.frameW * 0.95}px; border-radius: 50%; background: radial-gradient(closest-side, ${g.glow}, transparent); opacity: .55; }
  /* The bookmark from the app's icon. */
  .ribbon { position: absolute; top: 0; right: ${k.ribbon * 0.8}px; width: ${k.ribbon}px; height: ${k.ribbon * 1.85}px; background: ${g.ribbon}; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); }
  h1 { position: absolute; left: 0; right: 0; top: ${k.top}px; margin: 0; font-size: ${k.title}px; line-height: 1.04; font-weight: 900; letter-spacing: -0.025em; }
  p { position: absolute; left: 0; right: 0; top: ${k.top + k.title * 2.08 + k.sub * 0.9}px; margin: 0; font-size: ${k.sub}px; line-height: 1.2; font-weight: 500; color: ${g.sub}; }
  .device { position: absolute; left: 50%; top: ${k.frameTop}px; width: ${k.frameW}px; margin-left: ${-(k.frameW / 2 + k.bezel)}px; border: ${k.bezel}px solid #07060c; border-radius: ${k.radius + k.bezel}px; overflow: hidden; background: #000; min-height: ${k.h - k.frameTop + k.radius}px; box-shadow: 0 ${k.frameW * 0.06}px ${k.frameW * 0.16}px rgba(0, 0, 0, .45), 0 0 0 1.5px rgba(255, 255, 255, .14); }
  /* The page's own top color runs up under the rounded corners, so nothing on the screen is clipped by them. */
  .device .lip { height: ${k.radius * 0.42}px; }
  .device img { display: block; width: 100%; }
</style></head><body>
  <div class="glow"></div>${RIBBON ? '<div class="ribbon"></div>' : ""}
  <h1>${slide.title}</h1><p>${slide.sub}</p>
  <div class="device"><div class="lip" id="lip"></div><img id="shot" alt="" src="data:image/png;base64,${shot}"></div>
  <script>
    const img = document.getElementById("shot");
    const paint = () => {
      const c = document.createElement("canvas"); c.width = 8; c.height = 8;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0, 8, 8, 0, 0, 8, 8);
      const [r, g, b] = x.getImageData(2, 2, 1, 1).data;
      const color = "rgb(" + r + "," + g + "," + b + ")";
      document.getElementById("lip").style.background = color;
      // A picture shorter than the frame: the page's color carries on below it.
      document.querySelector(".device").style.background = color;
      document.body.dataset.ready = "1";
    };
    if (img.complete) paint(); else img.onload = paint;
  </script>
</body></html>`;
}

await mkdir(OUT, { recursive: true });
const named = (list) => list.filter((f) => /^(iphone|ipad)-\d+\.png$/.test(f));
const fixed = named(await readdir(FIXED).catch(() => []));
const files = [...new Set([...named(await readdir(IN).catch(() => [])), ...fixed])].sort();
if (!files.length) throw new Error(`No screenshots in ${IN}`);
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
for (const file of files) {
  const [, kind, n] = file.match(/^(iphone|ipad)-(\d+)\.png$/);
  const slide = SLIDES[Number(n) - 1];
  if (!slide) { console.log(`skip ${file}: no headline for it`); continue; }
  const k = KINDS[kind];
  const ctx = await browser.newContext({ viewport: { width: k.w, height: k.h }, deviceScaleFactor: k.scale });
  const page = await ctx.newPage();
  const shot = (await readFile(path.join(fixed.includes(file) ? FIXED : IN, file))).toString("base64");
  await page.setContent(html(kind, slide, shot), { waitUntil: "load" });
  await page.waitForSelector("body[data-ready]");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, file), omitBackground: false });
  console.log(`ok ${file} ${k.w * k.scale}x${k.h * k.scale}${fixed.includes(file) ? " (chosen by hand)" : ""}`);
  await ctx.close();
}
await browser.close();
