// Cooked Trainer websites (November 2026): each trainer can publish their own site at #/t/<slug>, and its contact
// form sends leads to their app. Run with: npx tsx --test tests/trainer-website.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryCoachStore, registerCoachRoutes } from "../server/coach";
import { createMemoryKv } from "../server/fitKv";
import { emptyFit } from "../shared/fit";
import { cleanLead, cleanSite, idFromSlug, siteSlug } from "../shared/coachSite";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function fakeApp() {
  const routes = new Map<string, any[]>();
  const add = (m: string) => (path: string, ...h: any[]) => routes.set(`${m} ${path}`, h);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT") };
  const call = async (m: string, path: string, user: number | null, body: any = {}, ip = "1.2.3.4") => {
    for (const [k, h] of routes) {
      const [km, kp] = k.split(" "); if (km !== m) continue;
      const names: string[] = []; const re = new RegExp("^" + kp.replace(/:([a-z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "(?:\\?.*)?$");
      const hit = path.match(re); if (!hit) continue;
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(hit[i + 1])])), body, query: {}, user: user ? { id: user } : null, headers: { "x-forwarded-for": ip }, ip };
      let status = 200, out: any;
      const res: any = { headersSent: false, status(s: number) { status = s; return res; }, json(b: any) { out = b; res.headersSent = true; return res; } };
      for (const fn of h) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; }
      return { status, body: out };
    }
    throw new Error(`no route ${m} ${path}`);
  };
  return { app, call };
}
const setup = (ai?: (s: string, u: string) => Promise<string>) => {
  const store = createMemoryCoachStore(); const sent: any[] = []; const { app, call } = fakeApp();
  registerCoachRoutes(app, (_q: any, _r: any, next: any) => next(), { store, kv: createMemoryKv(), fitData: async () => emptyFit(), nameOf: async (id) => `User ${id}`, notify: async (u, m) => { sent.push([u, m.title, m.body]); }, inviteSecret: "test", ai });
  return { store, sent, call };
};
const profile = { name: "Maya Reyes", headline: "Strength for busy parents", bio: "Ten years coaching.", city: "Denver", state: "CO", modes: ["remote", "inPerson"], specialties: ["Strength"], certifications: ["NASM-CPT"], years: 10, prices: [{ id: "p1", label: "Online coaching", mode: "remote", cents: 15000, per: "month" }], accepting: true };

test("slugs carry the trainer id, so sites never collide and need no lookup table", () => {
  assert.equal(siteSlug("Maya Reyes", 7), "maya-reyes-7");
  assert.equal(siteSlug("José  O'Brien!!", 123456), `jose-obrien-${(123456).toString(36)}`);
  assert.equal(siteSlug("", 9), "coach-9");
  for (const id of [1, 7, 35, 36, 999, 123456789]) assert.equal(idFromSlug(siteSlug("Some Name", id)), id);
  assert.equal(idFromSlug("nope"), null);
  assert.equal(idFromSlug("x-0"), null);
});

test("site settings are cleaned: unknown looks, colors, scripts and huge photos are dropped", () => {
  const s = cleanSite({ template: "hacker", accent: "red", heroTitle: "x".repeat(500), photos: ["javascript:alert(1)", "http://insecure.example/a.jpg", "https://cdn.example.com/a.jpg", "data:image/png;base64," + "A".repeat(500_000)], services: [{ title: "" }, { title: "1-on-1", price: "$80" }], published: "yes" });
  assert.equal(s.template, "bold"); assert.equal(s.accent, "#ff5a1f"); assert.equal(s.heroTitle.length, 90);
  assert.deepEqual(s.photos, ["https://cdn.example.com/a.jpg"]);
  assert.equal(s.services.length, 1); assert.equal(s.published, false);
  assert.equal(cleanLead({ name: "A" }, "t"), null, "a lead needs a way to reach them");
  assert.ok(cleanLead({ name: "A", phone: "(303) 555-0101" }, "t"));
  assert.equal(cleanLead({ name: "A", email: "not-an-email" }, "t"), null);
});

test("a trainer builds and publishes a site; visitors see it and their messages arrive as leads", async () => {
  const { call, sent, store } = setup();
  // Not published yet: nobody can see it. Publishing needs a name.
  const first = (await call("GET", "/api/coach/trainer/site", 7)).body;
  assert.equal(first.site.published, false);
  assert.equal((await call("PUT", "/api/coach/trainer/site", 7, { site: { published: true } })).status, 400);
  await call("PUT", "/api/coach/trainer/profile", 7, { profile });
  const saved = (await call("PUT", "/api/coach/trainer/site", 7, { site: { published: true, template: "warm", accent: "#0d9488", heroTitle: "Get strong at home", services: [{ title: "Online coaching", text: "Plan, check-ins, chat.", price: "$150 a month" }], faqs: [{ q: "Do I need a gym?", a: "No." }] } })).body;
  assert.match(saved.url, /#\/t\/maya-reyes-7$/);
  const slug = saved.url.split("/t/")[1];
  await store.saveReview({ id: "r1", trainerId: 7, clientId: 50, name: "Sam", stars: 5, text: "Great", date: "2026-10-01" } as any);
  await store.saveReview({ id: "r2", trainerId: 7, clientId: 51, name: "Ana", stars: 4, text: "Good", date: "2026-11-01" } as any);

  const pub = (await call("GET", `/api/coach/site/${slug}`, null)).body;
  assert.equal(pub.site.template, "warm");
  assert.equal(pub.trainer.name, "Maya Reyes");
  assert.equal(pub.trainer.prices.length, 1);
  assert.deepEqual(pub.reviews.map((r: any) => r.name), ["Ana", "Sam"], "newest review first");
  assert.equal(pub.reviews[0].clientId, undefined, "client ids stay private");
  assert.equal(pub.trainer.email, undefined, "contact details aren't published");
  // The invite on the site is a real one: it connects a client straight to this trainer.
  assert.equal((await call("GET", `/api/coach/invite/${pub.invite}`, null)).body.trainer.name, "Maya Reyes");
  // A slug with the wrong number, or another trainer's unpublished site, isn't found.
  assert.equal((await call("GET", `/api/coach/site/maya-reyes-8`, null)).status, 404);

  // Contact form.
  assert.equal((await call("POST", `/api/coach/site/${slug}/lead`, null, { name: "Jo" })).status, 400);
  assert.equal((await call("POST", `/api/coach/site/${slug}/lead`, null, { name: "Bot", email: "b@b.co", website: "spam.biz" })).body.ok, true);
  assert.equal((await call("POST", `/api/coach/site/${slug}/lead`, null, { name: "Jo Park", email: "jo@park.com", goal: "Lose fat", message: "Mornings work best" }, "9.9.9.9")).body.ok, true);
  let leads = (await call("GET", "/api/coach/trainer/leads", 7)).body.leads;
  assert.equal(leads.length, 1, "the honeypot lead was dropped");
  assert.equal(leads[0].name, "Jo Park"); assert.equal(leads[0].status, "new");
  assert.deepEqual(sent.at(-1).slice(0, 2), [7, "New lead from your website"]);
  // Other trainers can't see these leads.
  assert.equal((await call("GET", "/api/coach/trainer/leads", 8)).body.leads.length, 0);
  // Status changes and delete.
  leads = (await call("PUT", `/api/coach/trainer/leads/${leads[0].id}`, 7, { status: "won" })).body.leads;
  assert.equal(leads[0].status, "won");
  leads = (await call("PUT", `/api/coach/trainer/leads/${leads[0].id}`, 7, { status: "hacked" })).body.leads;
  assert.equal(leads[0].status, "won");
  leads = (await call("PUT", `/api/coach/trainer/leads/${leads[0].id}`, 7, { remove: true })).body.leads;
  assert.equal(leads.length, 0);

  // One sender can't flood a trainer.
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await call("POST", `/api/coach/site/${slug}/lead`, null, { name: "Spam", email: `s${i}@x.com` }, "5.5.5.5")).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);

  // Hiding prices and reviews hides them; taking the site down hides everything.
  await call("PUT", "/api/coach/trainer/site", 7, { site: { ...saved.site, showPrices: false, showReviews: false } });
  const hidden = (await call("GET", `/api/coach/site/${slug}`, null)).body;
  assert.equal(hidden.trainer.prices.length, 0); assert.equal(hidden.reviews.length, 0);
  await call("PUT", "/api/coach/trainer/site", 7, { site: { ...saved.site, published: false } });
  assert.equal((await call("GET", `/api/coach/site/${slug}`, null)).status, 404);
  assert.equal((await call("POST", `/api/coach/site/${slug}/lead`, null, { name: "Late", email: "l@x.com" }, "7.7.7.7")).status, 404);
});

test("AI site copy is cleaned and never published on its own", async () => {
  let prompt = "";
  const { call } = setup(async (s, u) => { prompt = s + u; return JSON.stringify({ heroTitle: "Strong parents, strong families", heroSub: "Coaching that fits nap time.", about: "I coach parents.\n\nTen years in.", services: [{ title: "Online coaching", text: "Plan and check-ins", price: "$150/mo" }, { title: "" }], faqs: [{ q: "Gym needed?", a: "No." }], published: true }); });
  assert.equal((await call("POST", "/api/coach/trainer/site/ai", 7)).status, 400, "needs a listing first");
  await call("PUT", "/api/coach/trainer/profile", 7, { profile });
  const d = (await call("POST", "/api/coach/trainer/site/ai", 7)).body.draft;
  assert.equal(d.heroTitle, "Strong parents, strong families");
  assert.equal(d.services.length, 1);
  assert.equal(d.published, undefined);
  assert.match(prompt, /Never invent/);
  assert.match(prompt, /NASM-CPT/);
  assert.equal((await call("GET", "/api/coach/trainer/site", 7)).body.site.published, false);
});

test("the site page, editor and leads are wired in", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /<Route path="\/t\/:slug"><TrainerSitePage \/><\/Route>/);
  const site = read("client/src/pages/coach/TrainerSite.tsx");
  assert.match(site, /\/api\/coach\/site\/\$\{encodeURIComponent\(data\.slug\)\}\/lead/);
  assert.match(site, /#\/fit\?coach=\$\{data\.invite\}/);
  assert.match(site, /value=\{f\.website\}/, "honeypot field");
  const tr = read("client/src/pages/trainer/TrainerApp.tsx");
  assert.match(tr, /<WebsiteCard token=\{token\}/);
  const ed = read("client/src/pages/trainer/TrainerWebsite.tsx");
  for (const t of ["tr-site-ai", "tr-site-publish", "tr-site-preview", "tr-leads", "tr-lead-${s.id}"]) assert.ok(ed.includes(t), t);
  assert.match(read("server/index.ts"), /"\/api\/coach\/trainer\/site", express\.json\(\{ limit: "4mb" \}\)/);
});

test("visitors to a trainer's site see no Arise pop-ups", () => {
  assert.match(read("client/src/App.tsx"), /FULLSCREEN_GAME_ROUTES\.includes\(p\) \|\| p\.startsWith\("\/t\/"\)/);
});
