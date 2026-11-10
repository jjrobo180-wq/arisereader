// Branded coaching (November 2026). Run with: npx tsx --test tests/trainer-brand.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryCoachStore, registerCoachRoutes } from "../server/coach";
import { createMemoryKv } from "../server/fitKv";
import { emptyFit } from "../shared/fit";
import { brandCss, cleanBrand, onColor } from "../shared/coachBrand";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("brand settings are cleaned and the color reads well", () => {
  const b = cleanBrand({ on: true, appName: "  Maya Fit  ", color: "red", logo: "data:image/svg+xml;base64,PHN2Zz4=", tagline: "x".repeat(200) });
  assert.deepEqual([b.appName, b.color, b.logo, b.tagline.length], ["Maya Fit", "#ff5a1f", "", 80]);
  assert.equal(onColor("#ffffff"), "#111111"); assert.equal(onColor("#111827"), "#ffffff"); assert.equal(onColor("#ca8a04"), "#111111");
  assert.match(brandCss("#2563EB"), /--fit-accent:#2563eb!important;--fit-accent-rgb:37,99,235!important/);
});

test("a trainer turns on their brand; clients' apps and the home-screen app get it", async () => {
  const store = createMemoryCoachStore();
  const routes = new Map<string, any[]>();
  const add = (m: string) => (path: string, ...h: any[]) => routes.set(`${m} ${path}`, h);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT") };
  const call = async (m: string, path: string, user: number | null, body: any = {}) => {
    for (const [k, h] of routes) { const [km, kp] = k.split(" "); if (km !== m) continue; const names: string[] = []; const hit = path.match(new RegExp("^" + kp.replace(/:([a-z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "$")); if (!hit) continue;
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, hit[i + 1]])), body, query: {}, user: user ? { id: user } : null, headers: {} };
      let status = 200, out: any; const headers: Record<string, string> = {};
      const res: any = { headersSent: false, status(s: number) { status = s; return res; }, json(b: any) { out = b; res.headersSent = true; return res; }, setHeader(k: string, v: string) { headers[k] = v; }, end(b?: any) { out = b; res.headersSent = true; return res; } };
      for (const fn of h) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; } return { status, body: out, headers }; }
    throw new Error(`no route ${m} ${path}`);
  };
  registerCoachRoutes(app, (_q: any, _r: any, next: any) => next(), { store, kv: createMemoryKv(), fitData: async () => emptyFit(), nameOf: async () => "X", notify: async () => {}, inviteSecret: "t" });
  await call("PUT", "/api/coach/trainer/profile", 7, { profile: { name: "Maya Reyes" } });
  const got = (await call("GET", "/api/coach/trainer/brand", 7)).body;
  assert.equal(got.brand.on, false); assert.match(got.url, /#\/c\/maya-reyes-7$/);
  assert.equal((await call("GET", "/api/coach/brand/7", null)).status, 404, "off: nothing public");
  assert.equal((await call("PUT", "/api/coach/trainer/brand", 7, { brand: { on: true, appName: "" } })).status, 400);
  await call("PUT", "/api/coach/trainer/brand", 7, { brand: { on: true, appName: "Maya Fit", color: "#0d9488", logo: PNG, tagline: "Strong at any age" } });
  for (const key of ["7", "maya-reyes-7"]) {
    const pub = (await call("GET", `/api/coach/brand/${key}`, null)).body;
    assert.equal(pub.brand.appName, "Maya Fit"); assert.equal(pub.trainerId, 7); assert.match(pub.invite, /^7-/);
  }
  const icon = await call("GET", "/api/coach/brand/7/icon", null);
  assert.equal(icon.headers["Content-Type"], "image/png"); assert.ok(Buffer.isBuffer(icon.body) && icon.body.length > 20);
  const man = JSON.parse((await call("GET", "/api/coach/brand/7/manifest.webmanifest", null)).body);
  assert.equal(man.name, "Maya Fit"); assert.equal(man.theme_color, "#0d9488"); assert.equal(man.start_url, "/#/c/maya-reyes-7"); assert.match(man.icons[0].src, /\/api\/coach\/brand\/7\/icon$/);
  // Off again: gone from clients.
  await call("PUT", "/api/coach/trainer/brand", 7, { brand: { on: false, appName: "Maya Fit" } });
  assert.equal((await call("GET", "/api/coach/brand/7", null)).status, 404);
  assert.equal((await call("GET", "/api/coach/brand/7/icon", null)).status, 404);
});

test("the brand is wired into Arise Trainer, Arise Fit and the public web app", () => {
  assert.match(read("client/src/pages/trainer/TrainerApp.tsx"), /<BrandCard token=\{token\}/);
  const fit = read("client/src/pages/fit/FitCoach.tsx");
  assert.match(fit, /useTrainerBrand\(/); assert.match(fit, /<BrandMark b=\{brand\.brand\}/);
  const appTsx = read("client/src/App.tsx");
  assert.match(appTsx, /<Route path="\/c\/:slug"><BrandAppPage \/><\/Route>/);
  assert.match(appTsx, /p\.startsWith\("\/c\/"\)/);
  const ui = read("client/src/pages/coach/Brand.tsx");
  for (const t of ["tr-brand-save", "brand-open", "apple-touch-icon", "manifest.webmanifest"]) assert.ok(ui.includes(t), t);
});
