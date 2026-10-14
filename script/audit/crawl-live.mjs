// Site audit: opens every public page of the live sites on a phone-sized screen and records anything
// broken — crash screens, script errors, failed requests, broken links, sideways scrolling, missing
// images. Writes audit-out/live.json plus a screenshot per page. Run: node script/audit/crawl-live.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "audit-out/live";
fs.mkdirSync(OUT, { recursive: true });
const SITES = (process.env.SITES || "https://www.arisereader.com,https://arisetodo.com").split(",");
const ROUTES = (process.env.ROUTES || "").split(",").filter(Boolean);
const MAX = Number(process.env.MAX_PAGES || 400);

const browser = await chromium.launch();
const results = [];
const seen = new Set();
const queue = [];
const push = (u) => { const k = u.replace(/\/$/, ""); if (!seen.has(k) && seen.size < MAX) { seen.add(k); queue.push(u); } };

for (const site of SITES) {
  push(site + "/");
  for (const r of ROUTES) push(site + "/#" + r);
  try {
    const xml = await (await fetch(site + "/sitemap.xml")).text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) { const u = m[1].trim(); if (SITES.some((s) => u.startsWith(new URL(s).origin)) || u.includes("arisereader.com") || u.includes("arisetodo.com")) push(u.replace("https://arisereader.com", "https://www.arisereader.com")); }
  } catch (e) { results.push({ url: site + "/sitemap.xml", issues: [{ type: "sitemap", detail: String(e) }] }); }
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 AriseAudit" });
let n = 0;
while (queue.length) {
  const url = queue.shift();
  const page = await ctx.newPage();
  const issues = [];
  page.on("pageerror", (e) => issues.push({ type: "script-error", detail: String(e.message || e).slice(0, 300) }));
  page.on("console", (m) => { if (m.type() === "error") issues.push({ type: "console-error", detail: m.text().slice(0, 300) }); });
  page.on("response", (r) => { const u = r.url(); if (r.status() >= 400 && /arisereader|arisetodo|onrender/.test(u)) issues.push({ type: "http-" + r.status(), detail: u.slice(0, 200) }); });
  page.on("requestfailed", (r) => { const u = r.url(); if (!/google-analytics|googletagmanager|doubleclick|facebook/.test(u)) issues.push({ type: "request-failed", detail: (r.failure()?.errorText || "") + " " + u.slice(0, 200) }); });
  let status = 0;
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    status = res?.status() ?? 0;
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      const W = innerWidth;
      const wide = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 2; }).slice(0, 5).map((e) => e.tagName + "." + String(e.className).slice(0, 60));
      const brokenImgs = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src).slice(0, 10);
      const links = [...document.querySelectorAll("a[href]")].map((a) => a.href);
      const empty = text.trim().length < 20;
      return { title: document.title, crash: /something went wrong|application error|cannot get \/|unexpected error|404|page not found|not found/i.test(text.slice(0, 3000)) ? text.slice(0, 200) : "", hscroll: document.documentElement.scrollWidth > W + 2 ? document.documentElement.scrollWidth : 0, wide, brokenImgs, links, empty, finalUrl: location.href };
    });
    if (status >= 400) issues.push({ type: "page-" + status, detail: url });
    if (info.crash) issues.push({ type: "error-text", detail: info.crash });
    if (info.hscroll) issues.push({ type: "sideways-scroll", detail: info.hscroll + "px " + info.wide.join(" | ") });
    for (const s of info.brokenImgs) issues.push({ type: "broken-image", detail: s });
    if (info.empty) issues.push({ type: "blank-page", detail: info.finalUrl });
    for (const l of info.links) {
      try {
        const u = new URL(l);
        if (!/arisereader\.com|arisetodo\.com/.test(u.hostname)) continue;
        if (/\.(pdf|png|jpg|jpeg|svg|mp3|mp4|zip)$/i.test(u.pathname)) continue;
        push(u.href.replace("https://arisereader.com", "https://www.arisereader.com"));
      } catch {}
    }
    const shot = `${OUT}/${String(++n).padStart(3, "0")}.png`;
    await page.screenshot({ path: shot }).catch(() => {});
    results.push({ url, finalUrl: info.finalUrl, title: info.title, status, shot, issues });
  } catch (e) {
    results.push({ url, status, issues: [...issues, { type: "load-failed", detail: String(e).slice(0, 200) }] });
  }
  await page.close();
  fs.writeFileSync("audit-out/live.json", JSON.stringify(results, null, 1));
}

// Also check every link target answers (HEAD/GET) without opening it fully.
await browser.close();
const bad = results.filter((r) => r.issues.length);
console.log(`Pages: ${results.length}, with issues: ${bad.length}`);
for (const r of bad) console.log(r.url, "→", r.issues.map((i) => i.type + ": " + i.detail).slice(0, 4).join(" || "));
