import test from "node:test";
import assert from "node:assert/strict";
import { NEWS_ARTICLES, NEWS_POINTS, SECTION_COLORS, newsBySlug, newsByTitle, newsReadMinutes, newsWordCount, newsCoverSrc } from "../shared/ariseNews";

test("every story has a unique slug and title", () => {
  assert.ok(NEWS_ARTICLES.length >= 12);
  assert.equal(new Set(NEWS_ARTICLES.map((a) => a.slug)).size, NEWS_ARTICLES.length);
  assert.equal(new Set(NEWS_ARTICLES.map((a) => a.title)).size, NEWS_ARTICLES.length);
  for (const a of NEWS_ARTICLES) {
    assert.match(a.slug, /^[a-z0-9-]+$/);
    assert.equal(newsBySlug(a.slug), a);
    assert.equal(newsByTitle(a.title), a);
    assert.ok(SECTION_COLORS[a.section], `${a.slug} has an unknown section`);
  }
});

test("news stories are recent, sourced and steer clear of off-limits topics", () => {
  const news = NEWS_ARTICLES.filter((a) => a.kind === "news");
  assert.ok(news.length >= 5);
  for (const a of news) {
    assert.ok(a.dateline && a.dateline.length > 3, `${a.slug} needs a dateline`);
    assert.ok((a.sources?.length ?? 0) >= 2, `${a.slug} needs at least two sources`);
    for (const src of a.sources!) assert.match(src.url, /^https:\/\//);
    assert.match(a.publishedOn, /^2026-\d\d-\d\d$/);
  }
  const offLimits = /\b(trump|israel|gaza|palestin|election|democrat|republican|church|mosque|temple|religio|god|prayer|war|bomb|kids)\b/i;
  for (const a of NEWS_ARTICLES) {
    const text = [a.title, a.dek, JSON.stringify(a.body), JSON.stringify(a.questions)].join(" ");
    const hit = text.match(offLimits);
    assert.ok(!hit, `${a.slug} mentions "${hit?.[0]}"`);
  }
});

test("stories are a good length for young readers", () => {
  for (const a of NEWS_ARTICLES) {
    const n = newsWordCount(a);
    assert.ok(n >= 280 && n <= 650, `${a.slug} has ${n} words`);
    assert.ok(newsReadMinutes(a) >= 2 && newsReadMinutes(a) <= 5);
    assert.ok(a.dek.length > 30 && a.dek.length < 130, `${a.slug} dek length`);
    assert.ok(a.words.length >= 3);
    // the glossary words actually appear in the story
    const text = JSON.stringify(a.body).toLowerCase();
    for (const w of a.words) assert.ok(text.includes(w.word.toLowerCase()), `${a.slug}: "${w.word}" isn't in the story`);
  }
});

test("each quiz has five 4-choice questions with a real answer, worth 5 points", () => {
  assert.equal(NEWS_POINTS, 5);
  const letters: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const a of NEWS_ARTICLES) {
    assert.equal(a.questions.length, 5, a.slug);
    for (const q of a.questions) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4, `${a.slug}: duplicate options in "${q.question}"`);
      assert.ok(["A", "B", "C", "D"].includes(q.correct));
      letters[q.correct]++;
    }
    // answers aren't all the same letter within a quiz
    assert.ok(new Set(a.questions.map((q) => q.correct)).size >= 3, `${a.slug} answers are too predictable`);
  }
  // and the answer key is spread out across the issue
  for (const k of Object.keys(letters)) assert.ok(letters[k] >= 8, `only ${letters[k]} answers are ${k}`);
});

import { syncNewsBooks, NEWS_BOOKS_KEY } from "../server/ariseNewsSync";

function fakeStore() {
  const settings = new Map<string, string>();
  const books: { id: number; title: string; author: string; pointsValue: number; keepPoints: boolean; coverUrl: string; questions: any[] }[] = [];
  return {
    settings, books,
    async getSetting(k: string) { return settings.get(k) || ""; },
    async upsertSetting(k: string, v: string) { settings.set(k, v); },
    async getAllBooks() { return books; },
    async createBookWithQuestions(b: any, q: any[]) { const row = { ...b, id: 1000 + books.length, questions: q }; books.push(row); return row; },
  };
}

test("news stories become 5-point library quizzes exactly once", async () => {
  const store = fakeStore();
  const map = await syncNewsBooks(store);
  assert.equal(store.books.length, NEWS_ARTICLES.length);
  for (const b of store.books) {
    assert.equal(b.pointsValue, 5);
    assert.equal(b.keepPoints, true); // the site's own articles keep their 5 points
    assert.match(b.coverUrl, /^(\/api\/news\/cover\/[a-z0-9-]+(\?v=\d+)?|\/covers\/news\/[a-z0-9-]+\.svg|https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/.+)$/);
    assert.equal(b.questions.length, 5);
  }
  assert.deepEqual(JSON.parse(store.settings.get(NEWS_BOOKS_KEY)!), map);
  // running again changes nothing
  await syncNewsBooks(store);
  assert.equal(store.books.length, NEWS_ARTICLES.length);
});

test("an existing news book is reused if the map was lost", async () => {
  const store = fakeStore();
  await syncNewsBooks(store);
  store.settings.clear();
  const map = await syncNewsBooks(store);
  assert.equal(store.books.length, NEWS_ARTICLES.length);
  assert.equal(Object.keys(map).length, NEWS_ARTICLES.length);
});

test("every story has a cover file in the build", async () => {
  const { existsSync } = await import("node:fs");
  for (const a of NEWS_ARTICLES) assert.ok(a.photo?.file || a.photo?.wikipediaTitle || existsSync(`client/public/covers/news/${a.slug}.svg`) || newsCoverSrc(a).startsWith("/api/news/cover/"), `missing cover for ${a.slug}`);
});

test("a story taken out of the issue leaves the library once", async () => {
  const store: any = fakeStore();
  const retired: number[] = [];
  store.retireBook = async (id: number) => { retired.push(id); };
  const old = { ...NEWS_ARTICLES[0], slug: "old-story", title: "An Old Story" };
  await syncNewsBooks(store, [old, ...NEWS_ARTICLES]);
  const map = await syncNewsBooks(store, NEWS_ARTICLES);
  assert.equal(retired.length, 1);
  assert.ok(!("old-story" in map));
  await syncNewsBooks(store, NEWS_ARTICLES);
  assert.equal(retired.length, 1);
});

test("Arise News is now Arise Originals, and quizzes saved under the old name still count", async () => {
  const { NEWS_AUTHOR, isNewsAuthor } = await import("../shared/ariseNews");
  assert.equal(NEWS_AUTHOR, "Arise Originals");
  assert.ok(isNewsAuthor("Arise Originals") && isNewsAuthor("Arise News") && !isNewsAuthor("iArise") && !isNewsAuthor(null));
});

test("new October quick reads have full reading length, sources, photo credits and quizzes", async () => {
  const { OCTOBER_READS } = await import("../shared/octoberReads");
  const { OCTOBER_FEATURES } = await import("../shared/octoberFeatures");
  const all = [...OCTOBER_READS, ...OCTOBER_FEATURES];
  assert.equal(all.length, 8);
  assert.equal(all.filter(a => a.section === "Biography").length, 4);
  assert.equal(all.filter(a => a.section !== "Biography").length, 4);
  for (const a of all) {
    const count = newsWordCount(a);
    assert.ok(count >= 585 && count <= 650, a.slug + ": " + count + " words");
    assert.equal(newsReadMinutes(a), 5);
    assert.ok(a.photo?.file?.endsWith(".jpg"), a.slug + " needs a real cover photo");
    assert.ok(a.photo?.credit && a.photo?.license, a.slug + " needs photographer credit");
    assert.ok((a.sources?.length ?? 0) >= 1);
    assert.equal(a.questions.length, 5);
    assert.ok(new Set(a.questions.map(q => q.correct)).size >= 3);
    for (const q of a.questions) assert.equal(new Set(q.options).size, 4);
  }
});

test("creator and topic batches are full, distinct 5-minute articles with five quiz questions", async () => {
 const { CREATOR_READS } = await import("../shared/creatorReads2026");
 const { TOPIC_READS } = await import("../shared/topicReads2026");
 assert.equal(CREATOR_READS.length,5);
 assert.equal(TOPIC_READS.length,5);
 for (const a of [...CREATOR_READS,...TOPIC_READS]){
   const count=newsWordCount(a);
   assert.ok(count>=580 && count<=650,a.slug+" has "+count+" words");
   assert.equal(newsReadMinutes(a),5);
   assert.equal(a.questions.length,5);
   assert.ok(new Set(a.questions.map(q=>q.correct)).size>=3,a.slug+" predictable answer key");
   for(const q of a.questions) assert.equal(new Set(q.options).size,4,q.question);
   assert.ok(a.sources && a.sources.length>=1,a.slug+" missing sources");
   if(a.section==="Biography") assert.ok(a.photo?.wikipediaTitle,a.slug+" must request genuine celebrity photo");
 }
});

test("all twenty new October five-minute reads meet editorial acceptance requirements", async () => {
 const [{CREATOR_READS},{MUSIC_READS},{TOPIC_READS},{FRESH_READS}] = await Promise.all([
   import("../shared/creatorReads2026"),import("../shared/musicReads2026"),import("../shared/topicReads2026"),import("../shared/freshReads2026")
 ]);
 const all=[...CREATOR_READS,...MUSIC_READS,...TOPIC_READS,...FRESH_READS];
 assert.equal(all.length,20);
 assert.equal(all.filter(a=>a.section==="Biography").length,10);
 assert.equal(new Set(all.map(a=>a.slug)).size,20);
 for(const a of all){
   const count=newsWordCount(a);
   assert.ok(count>=585 && count<=650, a.slug+": "+count);
   assert.equal(newsReadMinutes(a),5);
   assert.equal(a.questions.length,5);
   assert.ok(a.sources?.length, a.slug+" needs sources");
   assert.ok(a.words.length>=3);
   const text=JSON.stringify(a.body).toLowerCase();
   for(const w of a.words) assert.ok(text.includes(w.word.toLowerCase()),a.slug+" lacks "+w.word);
   for(const q of a.questions) {
     assert.equal(q.options.length,4);
     assert.equal(new Set(q.options).size,4);
     assert.ok(["A","B","C","D"].includes(q.correct));
   }
   assert.ok(new Set(a.questions.map(q=>q.correct)).size>=3,a.slug+" predictable quiz");
   if(a.section==="Biography") assert.ok(a.photo?.wikipediaTitle,a.slug+" needs real-photo lookup");
 }
});

test("twenty athlete, science and world-culture reads are finished and unique", async () => {
 const [{ATHLETE_READS},{INTERNATIONAL_ATHLETES},{SCIENCE_READS},{CULTURE_READS}] = await Promise.all([
  import("../shared/athleteReads2026"),import("../shared/internationalAthletes2026"),
  import("../shared/scienceReads2026"),import("../shared/cultureReads2026")
 ]);
 const all=[...ATHLETE_READS,...INTERNATIONAL_ATHLETES,...SCIENCE_READS,...CULTURE_READS];
 assert.equal(all.length,20);
 assert.equal(all.filter(x=>x.section==="Biography").length,10);
 assert.equal(new Set(all.map(x=>x.slug)).size,20);
 for(const a of all){
  const n=newsWordCount(a);
  assert.ok(n>=585&&n<=650,a.slug+": "+n+" words");
  assert.equal(newsReadMinutes(a),5);
  assert.equal(a.questions.length,5);
  assert.ok((a.sources?.length??0)>=1,a.slug+" needs sources");
  assert.ok(a.words.length>=3);
  for(const w of a.words) assert.ok(JSON.stringify(a.body).toLowerCase().includes(w.word.toLowerCase()),a.slug+" glossary missing "+w.word);
  for(const q of a.questions){
   assert.equal(q.options.length,4);
   assert.equal(new Set(q.options).size,4);
  }
  assert.ok(new Set(a.questions.map(q=>q.correct)).size>=3);
  if(a.section==="Biography") assert.ok(a.photo?.wikipediaTitle,a.slug+" needs licensed real-person photo lookup");
 }
});

test("every 5-Minute Read has a real photo to show, never only a drawing", async () => {
  const { NEWS_ARTICLES } = await import("../shared/ariseNews");
  const missing = NEWS_ARTICLES.filter((a) => !a.photo?.file && !a.photo?.wikipediaTitle).map((a) => a.slug);
  assert.deepEqual(missing, []);
});

test("the browser finds real photos for the Originals and swaps any drawn cover for them", async () => {
  const { readFileSync } = await import("node:fs");
  const lib = readFileSync(new URL("../client/src/lib/readPhotos.ts", import.meta.url), "utf8");
  assert.match(lib, /pilicense: "free"/);
  assert.match(readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8"), /installReadPhotos\(\);\ncreateRoot/);
  const { newsCoverSrc, readPhotoFound, NEWS_ARTICLES } = await import("../shared/ariseNews");
  const a = NEWS_ARTICLES.find((x) => x.slug === "octopus-genius")!;
  assert.match(newsCoverSrc(a), /^\/api\/news\/cover\/octopus-genius\?v=\d+$/);
  readPhotoFound["octopus-genius"] = "https://upload.wikimedia.org/x/Octopus.jpg";
  assert.equal(newsCoverSrc(a), "https://upload.wikimedia.org/x/Octopus.jpg");
  delete readPhotoFound["octopus-genius"];
});
