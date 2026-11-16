// "Paste a link to the lesson": the page's words are read on the server (server/pageText.ts) for the SPED Exemplar Maker
// and the Kha ELA maker. The web is not touched: a stand-in plays the page reader, and the address checks run for real.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PageError, fetchPageText, linksFrom, pagesText } from "../server/pageText";
import { registerSpedExemplarRoutes } from "../server/spedExemplar";
import { registerKhaElaRoutes } from "../server/khaEla";
import { memoryKV } from "../server/podcastDirectory";
import type { SpedAsk } from "../server/spedExemplar";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("links are picked out of what was typed: up to 3, no repeats, only web addresses", () => {
  assert.deepEqual(linksFrom("https://im.kendallhunt.com/MS/students/2/1/index.html"), ["https://im.kendallhunt.com/MS/students/2/1/index.html"]);
  assert.deepEqual(linksFrom("im.kendallhunt.com/MS/teachers/2/1.html, https://a.org/x\nhttps://a.org/x https://b.org https://c.org https://d.org"), ["https://im.kendallhunt.com/MS/teachers/2/1.html", "https://a.org/x", "https://b.org", "https://c.org"].slice(0, 3));
  assert.deepEqual(linksFrom("not a link at all"), []);
  assert.deepEqual(linksFrom("javascript:alert(1) file:///etc/passwd ftp://x.org"), []);
  assert.deepEqual(linksFrom("http://localhost:3000/a http://127.0.0.1/ http://10.0.0.5/ http://169.254.169.254/latest/meta-data http://user:pw@example.org/"), [], "this server and private networks are refused");
  assert.deepEqual(linksFrom("https://example.org:8080/"), [], "only the normal ports");
  assert.deepEqual(linksFrom(undefined), []);
});

test("the page reader refuses private addresses before it connects, and says what to do instead", async () => {
  for (const bad of ["http://127.0.0.1/", "http://localhost/", "http://169.254.169.254/latest/meta-data/", "file:///etc/passwd", "gopher://x.org"]) {
    await assert.rejects(fetchPageText(bad), (e: any) => e instanceof PageError && /can't be opened from here.*Paste the lesson text, or add photos/.test(e.message), bad);
  }
});

test("the pages' words are marked with where they came from and cut to the limit", () => {
  const t = pagesText([{ url: "https://im.kendallhunt.com/a", title: "Lesson 8", text: "x".repeat(500) }], 100);
  assert.equal(t.length, 100);
  assert.match(t, /^Lesson page: Lesson 8 \(im\.kendallhunt\.com\)\n/);
});

/** A stand-in for Express, as in tests/kha-ela.test.ts. */
function appFor(register: (app: any, auth: any, deps: any) => void, deps: Record<string, unknown>) {
  type Route = { method: string; re: RegExp; keys: string[]; handlers: ((req: any, res: any, next: any) => unknown)[] };
  const routes: Route[] = [];
  const add = (method: string) => (path: string, ...handlers: any[]) => { const keys: string[] = []; routes.push({ method, keys, handlers, re: new RegExp("^" + path.replace(/:([a-z]+)/gi, (_m, k) => { keys.push(k); return "([^/]+)"; }) + "$") }); };
  const auth: any = (req: any, _res: any, next: any) => { const [id, role] = String(req.headers["x-user"] || "").split(":"); if (id) req.user = { id: Number(id), role, isAdmin: role === "admin" }; return next(); };
  register({ get: add("GET"), post: add("POST"), delete: add("DELETE") }, auth, { kv: memoryKV(), aiConfigured: () => true, ...deps });
  return async (path: string, method = "GET", body?: unknown) => {
    const route = routes.find((r) => r.method === method && r.re.test(path))!;
    assert.ok(route, `no route for ${method} ${path}`);
    const m = route.re.exec(path)!;
    const req: any = { headers: { "x-user": "1:teacher" }, body: body ?? {}, params: Object.fromEntries(route.keys.map((k, i) => [k, m[i + 1]])) };
    let status = 200, payload: any;
    const res: any = { set() { return res; }, status(c: number) { status = c; return res; }, json(b: unknown) { payload = b; return res; } };
    let i = 0;
    const next = async (): Promise<void> => { const h = route.handlers[i++]; if (h) await h(req, res, next); };
    await next();
    return { status, body: payload };
  };
}
const until = async (fn: () => Promise<any>, ok: (v: any) => boolean) => { for (let i = 0; i < 200; i++) { const v = await fn(); if (ok(v)) return v; await new Promise((r) => setTimeout(r, 20)); } throw new Error("timed out"); };
const PAGE = { url: "https://im.kendallhunt.com/MS/students/2/1/index.html", title: "Grade 7 Unit 4 Lesson 8", text: "Warm-up. Activity 1: solve 3x = 12. Cool-down. ".repeat(10) };

for (const [name, route, register] of [["SPED Exemplar Maker", "/api/sped-exemplar", registerSpedExemplarRoutes], ["Kha ELA", "/api/kha-ela", registerKhaElaRoutes]] as const) {
  test(`${name}: a link alone is enough, its page is read and its words reach the AI`, async () => {
    const asked: SpedAsk[] = [], fetched: string[] = [];
    const call = appFor(register as any, { askAI: async (a: SpedAsk) => { asked.push(a); return "{}"; }, fetchPage: async (u: string) => { fetched.push(u); return PAGE; } });
    const started = await call(route, "POST", { settings: { source: "asis" }, links: PAGE.url });
    assert.equal(started.status, 202, JSON.stringify(started.body));
    const done = await until(() => call(`${route}/${started.body.id}`), (r) => r.body.status !== "working");
    assert.deepEqual(fetched, [PAGE.url]);
    assert.ok(asked.length > 0 && asked[0].text.includes("Activity 1: solve 3x = 12") && asked[0].text.includes("Lesson page: Grade 7 Unit 4 Lesson 8 (im.kendallhunt.com)"), "the page's words are in what the AI is given");
    assert.equal(done.body.status, "failed", "the stand-in AI sends nothing usable, so the build stops with a message");
  });

  test(`${name}: something that is not a web address is told so; nothing is fetched`, async () => {
    const fetched: string[] = [];
    const call = appFor(register as any, { fetchPage: async (u: string) => { fetched.push(u); return PAGE; } });
    const bad = await call(route, "POST", { settings: { source: "asis" }, links: "my lesson on volcanoes" });
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /doesn’t look like a web address/);
    const local = await call(route, "POST", { settings: { source: "asis" }, links: "http://localhost/secret" });
    assert.equal(local.status, 400);
    assert.deepEqual(fetched, []);
  });

  test(`${name}: a page that can't be read stops the build with words the teacher can act on`, async () => {
    const call = appFor(register as any, { askAI: async () => "{}", fetchPage: async () => { throw new PageError("im.kendallhunt.com needs a sign-in to show that page. Paste the lesson text, or add photos of it, instead."); } });
    const { body } = await call(route, "POST", { settings: { source: "asis" }, links: PAGE.url });
    const done = await until(() => call(`${route}/${body.id}`), (r) => r.body.status !== "working");
    assert.equal(done.body.status, "failed");
    assert.match(done.body.error, /needs a sign-in.*Paste the lesson text/);
  });
}

test("both makers have a link box that is sent with the build", () => {
  const sped = read("client/src/pages/SpedExemplarMaker.tsx"), kha = read("client/src/pages/KhaElaMaker.tsx");
  assert.match(sped, /\{ title, grade, text, links, images:/);
  assert.match(sped, /data-testid="sped-links"/);
  assert.match(kha, /\{ settings: s, text, links, images:/);
  assert.match(kha, /data-testid="kha-links"/);
});
