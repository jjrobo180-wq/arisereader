// Framed App Store screenshots for Arise To Duo (.github/workflows/arisetodo-store-shots.yml).
// Opens the built site's sample profile (lib/sampleMode.ts) in an iPhone-sized Chromium, then draws each
// screen inside a phone frame with a headline on a colour wash. Output: listing/6.9/NN-name.png (1320x2868)
// and listing/6.5/NN-name.png (1284x2778), plus listing/raw/*.png (the plain captures).
import { createServer } from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/json" };
const serve = (root, port) => new Promise((ok) => createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const file of [join(root, path), join(root, path, "index.html"), join(root, "index.html")]) {
    try { if ((await stat(file)).isFile()) { res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }); res.end(await readFile(file)); return; } } catch { /* next */ }
  }
  res.writeHead(404); res.end("not found");
}).listen(port, ok));

await serve("dist/public", 4173);
const A = "http://localhost:4173";
const wait = (p, ms) => p.waitForTimeout(ms);
for (const d of ["raw", "6.9", "6.5"]) await mkdir(`listing/${d}`, { recursive: true });
const browser = await chromium.launch();

const open = async (page, hash) => {
  await page.goto(`${A}/duo-preview.html?sample=1`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.evaluate((src) => { document.body.innerHTML = `<iframe id="f" src="${src}" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`; document.body.style.margin = "0"; }, `/#${hash}`);
  await wait(page, 7000);
  const brief = page.frameLocator("#f").getByRole("button", { name: "Close the brief" });
  if (await brief.count()) { await brief.first().click(); await wait(page, 800); }
};
const SHOTS = [
  ["home", "Your whole day, one calm place", "Plan, track and remember without the clutter.", (p) => open(p, "/lifehub?pane=home")],
  ["tasks", "Tasks that stay simple", "Lists, due dates and reminders that actually remind you.", (p) => open(p, "/lifehub?pane=tasks")],
  ["apps", "Every tool in one place", "Money, health, kitchen, home and more, neatly grouped.", async (p) => { await open(p, "/lifehub?pane=tasks"); await p.frameLocator("#f").getByTestId("life-tab-apps").click(); await wait(p, 900); }],
  ["you", "Make it yours", "Themes, night mode, passcode lock and more.", async (p) => { await open(p, "/lifehub?pane=home"); await p.frameLocator("#f").getByTestId("life-tab-you").click(); await wait(p, 900); }],
  ["calendar", "Plan it together", "Shared family calendars and countdowns.", (p) => open(p, "/lifehub?go=calendar")],
  ["split", "Two apps, one screen", "Split screen for phones without a Duo.", (p) => open(p, "/duo")],
  ["workhub", "WorkHub for the busy week", "Switch from life to work in one tap.", (p) => open(p, "/hub")],
];
const frame = (img, title, sub, w, h) => `<!doctype html><meta charset=utf-8><style>
*{box-sizing:border-box;margin:0}body{width:${w}px;height:${h}px;overflow:hidden;font-family:-apple-system,"SF Pro Display",Inter,Helvetica,Arial,sans-serif;
background:radial-gradient(120% 70% at 50% 0%,#7c5cff 0%,#4b2fd0 45%,#241a6b 100%);position:relative}
.t{position:absolute;left:0;right:0;top:${h * 0.05}px;text-align:center;color:#fff;padding:0 ${w * 0.07}px}
.t h1{font-size:${w * 0.078}px;line-height:1.08;font-weight:800;letter-spacing:-.02em}
.t p{margin-top:${h * 0.012}px;font-size:${w * 0.035}px;line-height:1.3;opacity:.82;font-weight:500}
.ph{position:absolute;left:50%;top:${h * 0.235}px;width:${w * 0.82}px;transform:translateX(-50%);background:#0b0b10;border-radius:${w * 0.1}px ${w * 0.1}px 0 0;padding:${w * 0.02}px ${w * 0.02}px 0;box-shadow:0 ${w * 0.04}px ${w * 0.1}px rgba(0,0,0,.45),inset 0 0 0 ${w * 0.004}px #3a3a46}
.ph .bar{height:${w * 0.085}px;background:#0b0b10}.ph img{display:block;width:100%;border-radius:0}
.ph:after{content:"";position:absolute;top:${w * 0.045}px;left:50%;width:${w * 0.2}px;height:${w * 0.055}px;margin-left:-${w * 0.1}px;background:#000;border-radius:99px}
</style><div class=t><h1>${title}</h1><p>${sub}</p></div><div class=ph><div class=bar></div><img src="${img}"></div>`;

let n = 0;
for (const [name, title, sub, go] of SHOTS) {
  n++;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  console.log(`start ${name}`);
  try { await Promise.race([go(page), new Promise((_, no) => setTimeout(() => no(new Error("timed out after 90s")), 90000))]); } catch (e) { console.log(`FAIL ${name}: ${e?.message || e}`); }
  const file = `listing/raw/${String(n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file });
  await ctx.close();
  const data = `data:image/png;base64,${(await readFile(file)).toString("base64")}`;
  for (const [dir, w, h] of [["6.9", 1320, 2868], ["6.5", 1284, 2778]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await c.newPage();
    p.setDefaultTimeout(30000);
    await p.setContent(frame(data, title, sub, w, h), { waitUntil: "domcontentloaded" }); await wait(p, 400);
    await p.screenshot({ path: `listing/${dir}/${String(n).padStart(2, "0")}-${name}.png` });
    await c.close();
  }
  console.log(`ok ${name}`);
}
// A dual-screen phone turned sideways: each screen is 720x540 points. Two shots, one per hub.
for (const [name, hash] of [["duo-life", "/lifehub?pane=home"], ["duo-work", "/hub"]]) {
  const ctx = await browser.newContext({ viewport: { width: 720, height: 540 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  try { await Promise.race([open(page, hash), new Promise((_, no) => setTimeout(() => no(new Error("timed out")), 90000))]); } catch (e) { console.log(`FAIL ${name}: ${e?.message || e}`); }
  await page.screenshot({ path: `listing/raw/${name}.png` });
  await ctx.close(); console.log(`ok ${name}`);
}

// iPad: the app in a real 13" iPad viewport (1032x1376 points at 2x = 2064x2752), no frame.
await mkdir("listing/ipad", { recursive: true });
const IPAD = [
  ["home", (p) => open(p, "/lifehub?pane=home")],
  ["tasks", (p) => open(p, "/lifehub?pane=tasks")],
  ["apps", async (p) => { await open(p, "/lifehub?pane=tasks"); await p.frameLocator("#f").getByTestId("life-tab-apps").click(); await wait(p, 900); }],
  ["split", (p) => open(p, "/duo")],
  ["workhub", (p) => open(p, "/hub")],
];
let k = 0;
for (const [name, go] of IPAD) {
  k++;
  const ctx = await browser.newContext({ viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  try { await Promise.race([go(page), new Promise((_, no) => setTimeout(() => no(new Error("timed out")), 90000))]); } catch (e) { console.log(`FAIL ipad ${name}: ${e?.message || e}`); }
  await page.screenshot({ path: `listing/ipad/${String(k).padStart(2, "0")}-${name}.png` });
  await ctx.close(); console.log(`ok ipad ${name}`);
}
// Apple Watch (Series 12 class, 416x496): the Tasks and Today screens of the watch app.
await mkdir("listing/watch", { recursive: true });
const WATCH = {
  tasks: `<div class=h><b>Tasks</b><span>10:09</span></div>
    <div class=r><i></i>Pay electric bill</div><div class=r><i></i>Pick up groceries</div><div class=r><i></i>Call the dentist</div><div class=r><i></i>Plan Friday dinner</div>`,
  today: `<div class=h><b>Today</b><span>10:09</span></div>
    <div class=ring><svg viewBox="0 0 100 100"><circle cx=50 cy=50 r=40 fill=none stroke=#2a2540 stroke-width=11 /><circle cx=50 cy=50 r=40 fill=none stroke=#8b6cff stroke-width=11 stroke-linecap=round stroke-dasharray="150 252" transform="rotate(-90 50 50)"/></svg><div><em>3</em><small>of 5 done</small></div></div>
    <div class=r><i></i>Next: Call the dentist</div>`,
};
const watchHtml = (inner) => `<!doctype html><meta charset=utf-8><style>*{box-sizing:border-box;margin:0}body{width:416px;height:496px;background:#000;color:#fff;font-family:-apple-system,"SF Pro Rounded",Inter,Helvetica,Arial,sans-serif;padding:34px 22px 0;overflow:hidden}
.h{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.h b{font-size:30px;font-weight:700;color:#a78bff}.h span{font-size:26px;font-weight:600}
.r{display:flex;align-items:center;gap:14px;background:#1c1a2b;border-radius:22px;padding:16px 18px;margin-bottom:10px;font-size:24px;font-weight:600}
.r i{width:26px;height:26px;border-radius:50%;border:3px solid #8b6cff;flex:none}
.ring{position:relative;width:210px;height:210px;margin:6px auto 18px}.ring svg{width:100%;height:100%}.ring div{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ring em{font-style:normal;font-size:64px;font-weight:800}.ring small{font-size:20px;opacity:.7}</style>${inner}`;
let w = 0;
for (const [name, inner] of Object.entries(WATCH)) {
  w++;
  const c = await browser.newContext({ viewport: { width: 416, height: 496 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  await p.setContent(watchHtml(inner), { waitUntil: "domcontentloaded" }); await wait(p, 300);
  await p.screenshot({ path: `listing/watch/${String(w).padStart(2, "0")}-${name}.png` });
  await c.close(); console.log(`ok watch ${name}`);
}

// iPhone Duo: the app across both screens (2034x1398, landscape).
await mkdir("listing/duo", { recursive: true });
const DUO = [["split", (p) => open(p, "/duo")], ["life", (p) => open(p, "/lifehub?pane=home")], ["work", (p) => open(p, "/hub")], ["tasks", (p) => open(p, "/lifehub?pane=tasks")]];
let q = 0;
for (const [name, go] of DUO) {
  q++;
  const ctx = await browser.newContext({ viewport: { width: 1017, height: 699 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  try { await Promise.race([go(page), new Promise((_, no) => setTimeout(() => no(new Error("timed out")), 90000))]); } catch (e) { console.log(`FAIL duo ${name}: ${e?.message || e}`); }
  await page.screenshot({ path: `listing/duo/${String(q).padStart(2, "0")}-${name}.png` });
  await ctx.close(); console.log(`ok duo ${name}`);
}
await browser.close();
process.exit(0);
