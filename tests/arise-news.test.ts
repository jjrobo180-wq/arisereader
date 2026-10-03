import test from "node:test";
import assert from "node:assert/strict";
import { NEWS_ARTICLES, NEWS_POINTS, SECTION_COLORS, newsBySlug, newsByTitle, newsReadMinutes, newsWordCount } from "../shared/ariseNews";

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

test("stories are a good length for young readers", () => {
  for (const a of NEWS_ARTICLES) {
    const n = newsWordCount(a);
    assert.ok(n >= 300 && n <= 650, `${a.slug} has ${n} words`);
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
  const books: { id: number; title: string; author: string; pointsValue: number; skipAR: boolean; coverUrl: string; questions: any[] }[] = [];
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
    assert.equal(b.skipAR, true); // never looked up in AR, so the 5 points stick
    assert.match(b.coverUrl, /^\/covers\/news\/[a-z0-9-]+\.svg$/);
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
  for (const a of NEWS_ARTICLES) assert.ok(existsSync(`client/public/covers/news/${a.slug}.svg`), `missing cover for ${a.slug}`);
});
