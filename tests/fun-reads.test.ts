// The November 2026 5-Minute Reads (shared/funReads*.ts) and the category sections on the library shelf
// and the Reads page.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FUN_READS } from "../shared/funReads";
import { NEWS_ARTICLES, NEWS_POINTS, QUICK_CATEGORIES, SECTION_COLORS, newsCoverSrc, newsReadMinutes, newsWordCount, quickCategoryById, quickCategoryId, quickCategoryOf } from "../shared/ariseNews";

const read = (p: string) => readFileSync(p, "utf8");

test("100 new 5-Minute Reads, each a real five-minute read with a unique slug and title", () => {
  assert.equal(FUN_READS.length, 100);
  assert.equal(new Set(FUN_READS.map((a) => a.slug)).size, 100);
  assert.equal(new Set(FUN_READS.map((a) => a.title)).size, 100);
  for (const a of FUN_READS) {
    const n = newsWordCount(a);
    assert.ok(n >= 585 && n <= 650, `${a.slug}: ${n} words`);
    assert.equal(newsReadMinutes(a), 5, a.slug);
    assert.equal(a.kind, "feature");
    assert.equal(a.grades, "Grades 3–7");
    assert.ok(a.body.filter((b) => b.kind === "h").length >= 2, `${a.slug} needs section headings`);
    assert.ok(a.body.some((b) => b.kind === "fact"), `${a.slug} needs a fact box`);
  }
});

test("every new read has a free Wikimedia photo, its Wikipedia source and a glossary from the text", () => {
  for (const a of FUN_READS) {
    assert.match(a.photo?.file || "", /\.(jpe?g|png)$/i, a.slug);
    assert.match(newsCoverSrc(a), /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, a.slug);
    assert.ok(a.photo?.alt && a.photo.alt.length > 10, `${a.slug} needs alt text`);
    assert.match(a.sources?.[0]?.url || "", /^https:\/\/en\.wikipedia\.org\/wiki\//, a.slug);
    assert.ok(a.words.length >= 3);
    const body = JSON.stringify(a.body).toLowerCase();
    for (const w of a.words) assert.ok(body.includes(w.word.toLowerCase()), `${a.slug}: "${w.word}" is not in the story`);
  }
});

test("each quiz has five 4-choice questions, answers spread across A to D, worth 5 points", () => {
  assert.equal(NEWS_POINTS, 5);
  const letters: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const a of FUN_READS) {
    assert.equal(a.questions.length, 5, a.slug);
    for (const q of a.questions) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4, `${a.slug}: ${q.question}`);
      letters[q.correct]++;
    }
    assert.ok(new Set(a.questions.map((q) => q.correct)).size >= 3, `${a.slug} answer key is predictable`);
  }
  for (const k of Object.keys(letters)) assert.ok(letters[k] >= 115 && letters[k] <= 135, `${k}: ${letters[k]}`);
});

test("the new reads stay kid-appropriate: no off-limits or rough words", () => {
  const offLimits = /\b(trump|israel|gaza|palestin|election|democrat|republican|church|mosque|temple|religio|god|prayer|war|bomb|kids|kill|killed|gun|guns|drunk|beer|wine|hell|damn|stupid|dumb|sexy)\b/i;
  for (const a of FUN_READS) {
    const text = [a.title, a.dek, JSON.stringify(a.body), JSON.stringify(a.questions)].join(" ");
    const hit = text.match(offLimits);
    assert.ok(!hit, `${a.slug} says "${hit?.[0]}"`);
  }
});

test("the reads cover every kind: history, people, stars, sports, soccer, science, space, nature, inventions, arts, fun facts", () => {
  const byCat: Record<string, number> = {};
  for (const a of FUN_READS) byCat[quickCategoryOf(a).label] = (byCat[quickCategoryOf(a).label] || 0) + 1;
  for (const label of ["History", "Famous People", "Stars & Entertainment", "Sports", "Soccer", "Science", "Space", "Animals & Nature", "Inventions", "Arts & Music", "Fun Facts"]) {
    assert.ok((byCat[label] || 0) >= 4, `${label} has ${byCat[label] || 0}`);
  }
});

test("every read belongs to a shelf category, and category links round-trip", () => {
  for (const a of NEWS_ARTICLES) {
    assert.ok(SECTION_COLORS[a.section], `${a.slug} has an unknown section`);
    assert.ok(QUICK_CATEGORIES.some((c) => c.sections.includes(a.section)), `${a.slug} (${a.section}) has no category`);
  }
  const ids = QUICK_CATEGORIES.map((c) => quickCategoryId(c.label));
  assert.equal(new Set(ids).size, ids.length);
  for (const c of QUICK_CATEGORIES) assert.equal(quickCategoryById(quickCategoryId(c.label)), c);
  assert.equal(quickCategoryId("Stars & Entertainment"), "stars-entertainment");
  assert.equal(quickCategoryById("nope"), null);
  // Earlier biographies are filed with their kind of fame.
  const by = (slug: string) => NEWS_ARTICLES.find((a) => a.slug === slug)!;
  assert.equal(quickCategoryOf(by("lebron-james-bio")).label, "Sports");
  assert.equal(quickCategoryOf(by("lionel-messi-bio")).label, "Soccer");
  assert.equal(quickCategoryOf(by("taylor-swift-bio")).label, "Stars & Entertainment");
  assert.equal(quickCategoryOf(by("louis-braille")).label, "Famous People");
});

test("the library shelf and the Reads page show each category as its own section", () => {
  const shelf = read("client/src/components/QuickReadsShelf.tsx");
  assert.match(shelf, /cat === "All"\n\s+\? cats\.map\(\(c\) =>/);
  assert.match(shelf, /data-testid="quick-shelf-category"/);
  assert.match(shelf, /onSeeCategory \? onSeeCategory\(id\) : setCat\(c\.label\)/);
  const lib = read("client/src/pages/Library.tsx");
  assert.match(lib, /onSeeCategory=\{\(id\) => navigate\(`\/reads\?quick=\$\{id\}`\)\}/);
  assert.match(lib, /onSeeAll=\{\(\) => navigate\("\/reads\?quick=all"\)\}/);
  const hub = read("client/src/pages/reads/ReadHub.tsx");
  assert.match(hub, /new URLSearchParams\(h\.split\("\?"\)\[1\] \|\| ""\)\.get\("quick"\)/);
  assert.match(hub, /data-testid="quick-category"/);
  assert.match(hub, /id=\{`quick-\$\{quickCategoryId\(c\.label\)\}`\}/);
});
