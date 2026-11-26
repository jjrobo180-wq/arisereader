// arisetodo.com/for/: one page per job bundle and one for everyone, made by script/industryPages.ts.
// Run with: npx tsx --test tests/industry-pages.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AUDIENCES, audiencePage, audienceIndex, bundleTools } from "../script/industryPages";
import { HUB_TEMPLATES } from "../shared/pluginStore";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("every job bundle has its own page, plus one for everyone", () => {
  const jobs = HUB_TEMPLATES.filter((t: any) => t.industry).map((t) => t.id).sort();
  assert.deepEqual(AUDIENCES.filter((a) => a.bundle).map((a) => a.bundle!).sort(), jobs);
  assert.ok(AUDIENCES.some((a) => a.slug === "everyone" && !a.bundle));
});

test("each page lists only tools the app really has, and the files are up to date", () => {
  for (const a of AUDIENCES) {
    if (a.bundle) {
      const pack = HUB_TEMPLATES.find((t) => t.id === a.bundle)!;
      assert.equal(bundleTools(a.bundle).length, pack.plugins.length, `${a.slug}: every tool in the bundle is a real plugin`);
    }
    const html = read(`client/public/for/${a.slug}/index.html`);
    assert.equal(html, audiencePage(a), `${a.slug} is stale: run npx tsx script/industryPages.ts`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://arisetodo\\.com/for/${a.slug}/" />`));
    assert.match(html, /href="\/app#\/signin\?create">Get it free/);
    assert.ok(!/To Duo|iPhone Duo/.test(html), `${a.slug}: Arise To Do, never To Duo`);
  }
  assert.equal(read("client/public/for/index.html"), audienceIndex());
});

test("the pages are in the sitemap, linked from the home page and kept out of the iPhone app", () => {
  const server = read("server/index.ts");
  for (const a of AUDIENCES) assert.ok(server.includes(`{ path: "/for/${a.slug}/", lastmod:`), a.slug);
  assert.match(read("client/public/educator.html"), /<a href="\/for\/">Who it's for<\/a>/);
  assert.match(read(".github/scripts/prune_todo_bundle.sh"), /to-do-list-with-notes for\n/);
});
