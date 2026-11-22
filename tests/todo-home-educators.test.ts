// arisetodo.com's home page is for teachers, special educators, schools and parents; the iPhone Duo page
// moved to /iphone-duo/. Run with: npx tsx --test tests/todo-home-educators.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the home page speaks to teachers, schools and parents, in the site's own look", () => {
  const home = read("client/public/educator.html");
  const duo = read("client/public/iphone-duo/index.html");
  assert.match(home, /<title>Arise To Duo: The Free Workspace for Teachers, Schools and Families<\/title>/);
  assert.match(home, /<h1>The free workspace <span class="gradient-text">for teachers and families\.<\/span><\/h1>/);
  assert.match(home, /href="\/app#\/teacher-signup">I'm a teacher/);
  assert.match(home, /href="\/app#\/parent-signup">I'm a parent/);
  assert.match(home, /<a href="\/iphone-duo\/">iPhone Duo<\/a>/, "the menu links to the iPhone Duo page");
  assert.match(home, /Arise Reader is free for every student/);
  // Same theme as before: the same stylesheet and the same sections as the iPhone Duo page.
  const style = (h: string) => h.slice(h.indexOf("<style>"), h.indexOf("</style>"));
  assert.equal(style(home), style(duo), "same styles");
  for (const id of ['id="duo"', 'id="duo-live"', 'id="features"', 'id="app-showcase"', 'id="life"', 'id="pricing"', 'id="faq"', 'id="whats-new"']) assert.ok(home.includes(id), id);
  // App links and the Home Screen app still go into the app.
  assert.match(home, /location\.replace\("\/app" \+ location\.hash\)/);
  assert.match(home, /location\.replace\(signedIn \? "\/app#\/" : "\/app#\/signin"\)/);
});

test("the iPhone Duo page lives at /iphone-duo/, in the sitemap, with its own address", () => {
  const duo = read("client/public/iphone-duo/index.html");
  assert.match(duo, /<link rel="canonical" href="https:\/\/arisetodo\.com\/iphone-duo\/" \/>/);
  assert.match(duo, /<a href="\/">For teachers &amp; schools<\/a>/);
  assert.match(read("server/index.ts"), /\{ path: "\/iphone-duo\/", lastmod: "2026-11-22", priority: "0\.9" \}/);
});
