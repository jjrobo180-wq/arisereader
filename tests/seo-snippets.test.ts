// Search snippets for arisereader.com and arisetodo.com (Nov 26, 2026): every page in either sitemap has a
// title and description Google shows whole, a canonical on its own site, a share image and structured data.
// Run with: npx tsx --test tests/seo-snippets.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const server = readFileSync("server/index.ts", "utf8");
const todo = [...server.split("const TODO_SITEMAP")[1].split("];")[0].matchAll(/\{ path: "([^"]+)"/g)].map((m) => m[1]);
const reader = [...readFileSync("client/public/sitemap.xml", "utf8").matchAll(/<loc>https:\/\/www\.arisereader\.com([^<]+)<\/loc>/g)].map((m) => m[1]);
const fileFor = (site: string, p: string) => p === "/" ? `client/public/${site === "todo" ? "educator" : "reader-landing"}.html` : `client/public${p}index.html`;

for (const [site, pages, host] of [["todo", todo, "https://arisetodo.com"], ["reader", reader, "https://www.arisereader.com"]] as const) {
  test(`${site}: every sitemap page is ready for search`, () => {
    assert.ok(pages.length > 10);
    for (const p of pages) {
      const f = fileFor(site, p);
      assert.ok(existsSync(f), f);
      const h = readFileSync(f, "utf8");
      const title = (h.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/&amp;/g, "&").trim();
      const desc = h.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
      assert.ok(title.length >= 20 && title.length <= 65, `${p} title is ${title.length} characters: ${title}`);
      assert.ok(desc.length >= 70 && desc.length <= 160, `${p} description is ${desc.length} characters`);
      assert.match(h, new RegExp(`rel="canonical" href="${host.replace(/\./g, "\\.")}${p.replace(/\//g, "\\/")}"`), `${p} canonical`);
      assert.match(h, /property="og:image"/, `${p} share image`);
      assert.match(h, /application\/ld\+json/, `${p} structured data`);
    }
  });
}
