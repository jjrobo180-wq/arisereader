// arisetodo.com's home page is for teachers, special educators, schools and parents; the iPhone Duo page
// moved to /iphone-duo/. Run with: npx tsx --test tests/todo-home-educators.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the home page speaks to teachers, special educators, schools and parents", () => {
  const home = read("client/public/educator.html");
  assert.match(home, /<title>Arise To Duo: The Free Workspace for Teachers, Schools and Parents<\/title>/);
  for (const id of ["teachers", "sped", "schools", "parents", "reader", "pricing"]) assert.match(home, new RegExp(`<section id="${id}"`), id);
  assert.match(home, /href="\/app#\/teacher-signup"/);
  assert.match(home, /href="\/app#\/parent-signup"/);
  assert.match(home, /href="\/iphone-duo\/"/, "links to the iPhone Duo page");
  assert.match(home, /fetch\('\/api\/public\/reader-totals'\)/);
  assert.match(home, /Google Classroom and Docs <span class="tag">Coming soon<\/span>/, "not claimed as live before the Google keys are in");
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
