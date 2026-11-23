// arisereader.com for search engines: the 5-Minute Reads as real pages, the sitemap that lists them, and the
// homepage's structured data (logo as a PNG, prices that match the plans).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NEWS_ARTICLES } from "../shared/ariseNews";
import { PLANS } from "../shared/plans";
import { READER_LOGO, readPageHtml, readerSitemapXml, readsIndexHtml } from "../server/readerSeo";

const ld = (html: string) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);

test("every read has its own page with the article, a quiz button and Article data", () => {
  for (const a of NEWS_ARTICLES) {
    const html = readPageHtml(a);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://www\\.arisereader\\.com/5-minute-reads/${a.slug}/">`));
    assert.match(html, new RegExp(`href="/app#/news/${a.slug}"`));
    const graph = ld(html)["@graph"];
    const art = graph.find((n: any) => n["@type"] === "Article");
    assert.equal(art.headline, a.title.slice(0, 110));
    assert.ok(graph.some((n: any) => n["@type"] === "BreadcrumbList"));
    // The quiz stays in the app: its questions and answer key aren't written into the page.
    assert.ok(!html.includes('"correct"'), `${a.slug} carries its quiz`);
  }
});

test("the reads index links every read, grouped by category", () => {
  const html = readsIndexHtml();
  for (const a of NEWS_ARTICLES) assert.ok(html.includes(`href="/5-minute-reads/${a.slug}/"`), a.slug);
  const list = ld(html)["@graph"].find((n: any) => n["@type"] === "CollectionPage").mainEntity;
  assert.equal(list.numberOfItems, NEWS_ARTICLES.length);
});

test("the Reader sitemap keeps its pages and adds every read", () => {
  const xml = readerSitemapXml(readFileSync("client/public/sitemap.xml", "utf8"));
  assert.ok(xml.includes("<loc>https://www.arisereader.com/reading-quizzes/</loc>"));
  assert.ok(xml.includes("<loc>https://www.arisereader.com/5-minute-reads/</loc>"));
  assert.equal((xml.match(/<loc>https:\/\/www\.arisereader\.com\/5-minute-reads\/[a-z0-9-]+\/<\/loc>/g) || []).length, NEWS_ARTICLES.length);
});

test("the homepage tells search engines the right logo, names and prices", () => {
  const html = readFileSync("client/public/reader-landing.html", "utf8");
  const graph = ld(html)["@graph"];
  const org = graph.find((n: any) => n["@type"] === "Organization");
  assert.equal(org.logo.url, READER_LOGO);
  assert.ok(org.alternateName.includes("A.R.I.S.E. Reader"));
  const offers = graph.find((n: any) => n["@type"] === "WebApplication").offers;
  assert.equal(offers.find((o: any) => o.name === "Students and parents").price, "0", "free for students and parents");
  assert.ok(!offers.some((o: any) => o.name === "Family" || o.name === "Class"), "no family or class plan for sale");
  assert.equal(offers.find((o: any) => o.name === "Whole school").price, String(PLANS.school.yearlyCents / 100));
  assert.ok(html.includes('<a href="/5-minute-reads/" target="_top">5-Minute Reads</a>'));
  const routes = readFileSync("server/index.ts", "utf8");
  assert.match(routes, /registerReaderSeo\(app, readerStaticSitemap\);/);
  assert.match(routes, /pages: sitemapPages\(readerSitemapXml\(readerXml\)\)/);
});
