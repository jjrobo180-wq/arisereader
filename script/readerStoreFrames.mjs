// App Store screenshots of Arise Reader, dressed for the store: each plain screenshot from
// readerStoreShots.mjs (store-shots/raw/{iphone,ipad}-N.png) is set in a phone or tablet frame on the
// app's own purple or ink, under a short headline, at the same size Apple asks for.
// Usage: node script/readerStoreFrames.mjs   -> store-shots/{iphone,ipad}-N.png
// IN and OUT name other folders; CHROME_PATH names a browser when Playwright has none of its own.
import { chromium } from "playwright";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const IN = process.env.IN || "store-shots/raw";
const OUT = process.env.OUT || "store-shots";

// One headline per screenshot, in the order readerStoreShots.mjs takes them.
const SLIDES = [
  { title: "Read. Quiz.<br>Earn points.", sub: "1,200+ books, each with a quick quiz", ground: "purple" },
  { title: "5-minute reads<br>kids finish", sub: "Short stories on animals, space and more", ground: "ink" },
  { title: "Reading unlocks<br>game time", sub: "Pass a quiz, then play", ground: "purple" },
  { title: "Stay close to<br>your teacher", sub: "Messages, points and progress together", ground: "ink" },
];

// The page is laid out in points and drawn at the device's scale, so the picture comes out at Apple's size.
const KINDS = {
  iphone: { w: 440, h: 956, scale: 3, title: 47, sub: 18.5, top: 100, frameTop: 262, frameW: 352, radius: 46, bezel: 7, ribbon: 46 },
  ipad: { w: 1032, h: 1376, scale: 2, title: 84, sub: 31, top: 128, frameTop: 420, frameW: 800, radius: 40, bezel: 11, ribbon: 84 },
};

const GROUNDS = {
  purple: { bg: "#6d3df5", glow: "#8f63ff", ribbon: "#15131f", sub: "#ebe4ff" },
  ink: { bg: "#15131f", glow: "#2a2540", ribbon: "#6d3df5", sub: "#cdc8de" },
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
  .device { position: absolute; left: 50%; top: ${k.frameTop}px; width: ${k.frameW}px; margin-left: ${-(k.frameW / 2 + k.bezel)}px; border: ${k.bezel}px solid #07060c; border-radius: ${k.radius + k.bezel}px; overflow: hidden; background: #000; box-shadow: 0 ${k.frameW * 0.06}px ${k.frameW * 0.16}px rgba(0, 0, 0, .45), 0 0 0 1.5px rgba(255, 255, 255, .14); }
  /* The page's own top color runs up under the rounded corners, so nothing on the screen is clipped by them. */
  .device .lip { height: ${k.radius * 0.42}px; }
  .device img { display: block; width: 100%; }
</style></head><body>
  <div class="glow"></div><div class="ribbon"></div>
  <h1>${slide.title}</h1><p>${slide.sub}</p>
  <div class="device"><div class="lip" id="lip"></div><img id="shot" alt="" src="data:image/png;base64,${shot}"></div>
  <script>
    const img = document.getElementById("shot");
    const paint = () => {
      const c = document.createElement("canvas"); c.width = 8; c.height = 8;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0, 8, 8, 0, 0, 8, 8);
      const [r, g, b] = x.getImageData(2, 2, 1, 1).data;
      document.getElementById("lip").style.background = "rgb(" + r + "," + g + "," + b + ")";
      document.body.dataset.ready = "1";
    };
    if (img.complete) paint(); else img.onload = paint;
  </script>
</body></html>`;
}

await mkdir(OUT, { recursive: true });
const files = (await readdir(IN)).filter((f) => /^(iphone|ipad)-\d+\.png$/.test(f)).sort();
if (!files.length) throw new Error(`No screenshots in ${IN}`);
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
for (const file of files) {
  const [, kind, n] = file.match(/^(iphone|ipad)-(\d+)\.png$/);
  const slide = SLIDES[Number(n) - 1];
  if (!slide) { console.log(`skip ${file}: no headline for it`); continue; }
  const k = KINDS[kind];
  const ctx = await browser.newContext({ viewport: { width: k.w, height: k.h }, deviceScaleFactor: k.scale });
  const page = await ctx.newPage();
  const shot = (await readFile(path.join(IN, file))).toString("base64");
  await page.setContent(html(kind, slide, shot), { waitUntil: "load" });
  await page.waitForSelector("body[data-ready]");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, file), omitBackground: false });
  console.log(`ok ${file} ${k.w * k.scale}x${k.h * k.scale}`);
  await ctx.close();
}
await browser.close();
