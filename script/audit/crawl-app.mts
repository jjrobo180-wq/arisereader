// Signed-in audit: serves the built app (dist/public) with a stand-in API that signs in as each kind of
// account, then opens every route, every WorkHub tab, every LifeHub section and every premium app on a
// phone-sized screen. The stand-in answers "not found" for data, so this proves no screen crashes when
// data is missing or a request fails. Crashes are collected from the app's own crash reports
// (POST /api/client-error) and from script errors. Run: npx tsx script/audit/crawl-app.mts
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { HUB_TABS } from "../../shared/teacherHub";
import { FAMILY_SECTIONS } from "../../shared/familyHub";
import { liveProApps } from "../../shared/pro/apps";

const ROOT = path.resolve("dist/public");
const OUT = "audit-out/app";
fs.mkdirSync(OUT, { recursive: true });
const PORT = 5055;

const USERS: Record<string, any> = {
  teacher: { id: 101, username: "qa-teacher", displayName: "QA Teacher", isAdmin: false, role: "teacher", accountApproved: true, approvedByTeacher: true, email: "qa@school.edu" },
  admin: { id: 102, username: "qa-admin", displayName: "QA Admin", isAdmin: true, role: "teacher", accountApproved: true, approvedByTeacher: true, email: "qa@school.edu" },
  parent: { id: 103, username: "qa-parent", displayName: "QA Parent", isAdmin: false, role: "parent", accountApproved: true, approvedByTeacher: true },
  todo: { id: 104, username: "qa-todo", displayName: "QA Person", isAdmin: false, role: "todo", accountApproved: true, approvedByTeacher: true },
  student: { id: 105, username: "qa-student", displayName: "QA Student", isAdmin: false, role: "student", teacherId: 101, accountApproved: true, approvedByTeacher: true, totalPoints: 120 },
  eyegaze: { id: 106, username: "qa-eyegaze", displayName: "QA Eye Gaze", isAdmin: false, role: "student", teacherId: 101, accountApproved: true, approvedByTeacher: true, is_eye_gaze_user: true },
};

const crashes: any[] = [];
const apiSeen = new Map<string, number>();
const MIME: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  if (url.pathname.startsWith("/api/")) {
    const key = req.method + " " + url.pathname.replace(/\/\d+(?=\/|$)/g, "/:id");
    apiSeen.set(key, (apiSeen.get(key) || 0) + 1);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const cookieTok = (() => { try { const c = /arise_session=([^;]+)/.exec(String(req.headers.cookie || ""))?.[1]; return c ? JSON.parse(Buffer.from(decodeURIComponent(c), "base64").toString()).token : ""; } catch { return ""; } })();
      const tok = String(req.headers.authorization || "").replace("Bearer ", "") || cookieTok;
      const role = tok.replace(/^qa-/, "").replace(/-\d+$/, "");
      const visit = Number(/-(\d+)$/.exec(tok)?.[1] ?? -1);
      const json = (status: number, data: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
      if (url.pathname === "/api/client-error") { try { crashes.push({ ...JSON.parse(body || "{}"), visit }); } catch {} return json(204, {}); }
      if (url.pathname === "/api/me") return USERS[role] ? json(200, USERS[role]) : json(401, { message: "Not signed in" });
      if (url.pathname === "/api/schools") return json(200, []);
      if (/\/workspace$/.test(url.pathname) && req.method === "GET") return json(200, { workspace: {} });
      return json(404, { message: "Not available in the audit stand-in." });
    });
    return;
  }
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const idx = path.join(file, "index.html");
    file = fs.existsSync(idx) ? idx : path.join(ROOT, "index.html");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise<void>((r) => server.listen(PORT, r));

const appRoutes = [...fs.readFileSync("client/src/App.tsx", "utf8").matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1].replace(/:[a-zA-Z]+/g, "1"));
const routes = [...new Set(appRoutes)];

type Visit = { role: string; hash: string; session?: Record<string, string>; local?: Record<string, string>; label: string };
const visits: Visit[] = [];
for (const role of Object.keys(USERS)) for (const r of routes) visits.push({ role, hash: r, label: `${role} ${r}` });
for (const role of ["teacher", "admin"]) for (const t of HUB_TABS) visits.push({ role, hash: "/workhub", session: { workhub_tab: t }, label: `${role} workhub:${t}` });
for (const role of ["parent", "todo"]) for (const s of FAMILY_SECTIONS) visits.push({ role, hash: "/lifehub", local: { "arise-todo-section": s }, label: `${role} lifehub:${s}` });
for (const a of liveProApps()) visits.push({ role: "parent", hash: `/pro?app=${a.id}`, label: `parent app:${a.id}` });
for (const k of ["sheet", "doc", "slides"]) visits.push({ role: "teacher", hash: `/office?kind=${k}`, label: `teacher office:${k}` });
for (const m of ["standby", "sleep"]) visits.push({ role: "teacher", hash: `/ambient?mode=${m}`, label: `teacher ambient:${m}` });
visits.push({ role: "guest", hash: "/signin", label: "guest signin" });

const browser = await chromium.launch();
const results: any[] = [];
let n = 0, next = 0;
async function visitOne(i: number) {
  const v = visits[i];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  if (USERS[v.role]) {
    const cookie = Buffer.from(JSON.stringify({ user: USERS[v.role], token: `qa-${v.role}-${i}` })).toString("base64");
    await ctx.addCookies([{ name: "arise_session", value: cookie, domain: "localhost", path: "/" }]);
  }
  await ctx.addInitScript(({ session, local }) => {
    try { for (const [k, val] of Object.entries(session || {})) sessionStorage.setItem(k, val as string); for (const [k, val] of Object.entries(local || {})) localStorage.setItem(k, val as string); } catch {}
  }, { session: v.session, local: v.local });
  const page = await ctx.newPage();
  const issues: string[] = [];
  page.on("pageerror", (e) => issues.push("script-error: " + String(e.message).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|404|Not available in the audit/.test(m.text())) issues.push("console: " + m.text().slice(0, 300)); });
  try {
    await page.goto(`http://localhost:${PORT}/#${v.hash}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2200);
    const info = await page.evaluate(() => {
      const t = document.body?.innerText || "";
      const W = innerWidth;
      return { crash: /Something went wrong/.test(t) && /couldn.t finish loading/.test(t), hscroll: document.documentElement.scrollWidth > W + 2 ? document.documentElement.scrollWidth : 0, blank: t.trim().length < 15, finalHash: location.hash };
    });
    await page.waitForTimeout(300);
    if (info.crash) issues.push("CRASH SCREEN");
    if (info.hscroll) issues.push("sideways-scroll " + info.hscroll + "px");
    if (info.blank) issues.push("blank page");
    for (const c of crashes.filter((c) => c.visit === i)) issues.push(`crash-report: ${c.name}: ${c.message} @ ${c.where}`);
    let shot = "";
    if (issues.length) { shot = `${String(++n).padStart(3, "0")}.png`; await page.screenshot({ path: `${OUT}/${shot}` }).catch(() => {}); }
    results.push({ ...v, finalHash: info.finalHash, issues, shot });
  } catch (e) {
    results.push({ ...v, issues: [...issues, "load-failed: " + String(e).slice(0, 200)] });
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: 6 }, async () => { while (next < visits.length) { const i = next++; await visitOne(i); if (i % 25 === 0) fs.writeFileSync("audit-out/app.json", JSON.stringify({ results, crashes }, null, 1)); } }));
fs.writeFileSync("audit-out/app.json", JSON.stringify({ results, crashes, api: Object.fromEntries([...apiSeen].sort((a, b) => b[1] - a[1])) }, null, 1));
await browser.close();
server.close();
const bad = results.filter((r) => r.issues.length);
console.log(`Visited ${results.length}; with issues ${bad.length}; crash reports ${crashes.length}`);
const byIssue = new Map<string, string[]>();
for (const r of bad) for (const i of r.issues) byIssue.set(i, [...(byIssue.get(i) || []), r.label]);
for (const [i, where] of [...byIssue].sort((a, b) => b[1].length - a[1].length)) console.log(`${where.length}× ${i}\n    ${where.slice(0, 6).join(" | ")}`);
