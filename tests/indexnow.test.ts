// IndexNow: only new or changed public pages are sent, a failed send is retried next start, and the
// key file the search engines check is really there. Run with: npx tsx --test tests/indexnow.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INDEXNOW_KEY, INDEXNOW_SETTING, pagesToSend, sitemapPages, submitChanged, type IndexNowDeps, type Site } from "../server/indexNow";

function deps(status = 200, saved = "") {
  const settings = new Map<string, string>([[INDEXNOW_SETTING, saved]]);
  const posts: { url: string; body: any }[] = [];
  const d: IndexNowDeps = {
    getSetting: async (k) => settings.get(k) ?? "",
    upsertSetting: async (k, v) => { settings.set(k, v); },
    post: async (url, body) => { posts.push({ url, body }); return status; },
    log: () => {},
  };
  return { d, posts, settings };
}

const sites = (lastmod = "2026-10-24"): Site[] => [
  { host: "arisetodo.com", pages: [{ loc: "https://arisetodo.com/", lastmod }, { loc: "https://arisetodo.com/family-to-do-app/", lastmod: "2026-10-24" }] },
  { host: "www.arisereader.com", pages: [{ loc: "https://www.arisereader.com/", lastmod: "" }] },
];

test("reads <loc> and <lastmod> from a sitemap", () => {
  const xml = `<urlset><url><loc>https://www.arisereader.com/</loc><lastmod>2026-10-24</lastmod></url>
  <url><loc>https://www.arisereader.com/math/</loc></url></urlset>`;
  assert.deepEqual(sitemapPages(xml), [
    { loc: "https://www.arisereader.com/", lastmod: "2026-10-24" },
    { loc: "https://www.arisereader.com/math/", lastmod: "" },
  ]);
});

test("the first start sends every page, one request per site, with the key", async () => {
  const { d, posts } = deps();
  const r = await submitChanged(d, sites());
  assert.equal(r.sent, 3);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].url, "https://api.indexnow.org/indexnow");
  assert.equal(posts[0].body.key, INDEXNOW_KEY);
  assert.equal(posts[0].body.keyLocation, `https://arisetodo.com/${INDEXNOW_KEY}.txt`);
  assert.deepEqual(posts[0].body.urlList, ["https://arisetodo.com/", "https://arisetodo.com/family-to-do-app/"]);
});

test("a restart with nothing changed sends nothing; a changed lastmod sends only that page", async () => {
  const first = deps();
  await submitChanged(first.d, sites());
  const saved = first.settings.get(INDEXNOW_SETTING)!;

  const again = deps(200, saved);
  assert.deepEqual(await submitChanged(again.d, sites()), { sent: 0, failed: 0 });
  assert.equal(again.posts.length, 0);

  const changed = deps(200, saved);
  await submitChanged(changed.d, sites("2026-11-02"));
  assert.equal(changed.posts.length, 1);
  assert.deepEqual(changed.posts[0].body.urlList, ["https://arisetodo.com/"]);
});

test("a refused or failed send is not remembered, so the next start tries again", async () => {
  const refused = deps(403);
  assert.deepEqual(await submitChanged(refused.d, sites()), { sent: 0, failed: 3 });
  assert.equal(refused.settings.get(INDEXNOW_SETTING), "");
  const thrown: IndexNowDeps = { ...deps().d, post: async () => { throw new Error("offline"); } };
  assert.deepEqual(await submitChanged(thrown, sites()), { sent: 0, failed: 3 });
});

test("a page from another host is never sent under the wrong site", () => {
  const out = pagesToSend([{ host: "arisetodo.com", pages: [{ loc: "https://www.arisereader.com/", lastmod: "" }] }], {});
  assert.deepEqual(out, []);
});

test("the key file is served from the site root and holds the key", () => {
  const file = readFileSync(new URL(`../client/public/${INDEXNOW_KEY}.txt`, import.meta.url), "utf8");
  assert.equal(file.trim(), INDEXNOW_KEY);
});
