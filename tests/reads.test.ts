import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readsDir, READABLE_BOOKS } from "../shared/readsCatalog";

test("every readable book has its contents and chapters on disk", () => {
  assert.ok(READABLE_BOOKS.length >= 30);
  for (const b of READABLE_BOOKS) {
    const idx = JSON.parse(readFileSync(`client/public/reads/${readsDir(b)}/index.json`, "utf8"));
    assert.equal(idx.chapters.length, b.chapters);
    for (let i = 1; i <= b.chapters; i++) {
      const html = readFileSync(`client/public/reads/${readsDir(b)}/${i}.html`, "utf8");
      assert.ok(html.length > 50, `${b.title} chapter ${i} is empty`);
      assert.ok(!/<script|on\w+=|javascript:/i.test(html), `${b.title} chapter ${i} has unsafe markup`);
      assert.ok(!/gutenberg/i.test(html), `${b.title} chapter ${i} has license boilerplate`);
      for (const m of html.matchAll(/src="([^"]+)"/g)) assert.ok(existsSync(`client/public${m[1]}`), `missing image ${m[1]}`);
    }
  }
});

import { syncReadsBooks, READS_BOOKS_KEY } from "../server/readsSyncCore";
import { READS_QUIZZES } from "../shared/readsQuizzes";

test("every new keyed book has a 10-question quiz with a real answer", () => {
  const keyed = READABLE_BOOKS.filter((b) => b.key);
  assert.ok(keyed.length >= 4);
  for (const b of keyed) {
    const q = READS_QUIZZES.find((x) => x.key === b.key);
    assert.ok(q, `${b.key} has a quiz`);
    assert.equal(q!.questions.length, 10);
    for (const x of q!.questions) { assert.equal(x.options.length, 4); assert.match(x.correct, /^[ABCD]$/); }
    assert.ok(existsSync(`client/public/covers/reads/${b.key}.svg`), `${b.key} has a cover`);
  }
});

test("the reads sync makes each quiz once, and fills an existing book that has no questions", async () => {
  const settings = new Map<string, string>();
  const books = [{ id: 345, title: "The Classic Tale of the Velveteen Rabbit", author: "Margery Williams Bianco" }];
  const added: number[] = [];
  let next = 900;
  const store = {
    getSetting: async (k: string) => settings.get(k) ?? "",
    upsertSetting: async (k: string, v: string) => { settings.set(k, v); },
    getAllBooks: async () => books,
    questionCount: async () => 0,
    addQuestions: async (id: number) => { added.push(id); },
    createBookWithQuestions: async (b: any, qs: any[]) => { assert.equal(qs.length, 10); const row = { id: next++, title: b.title, author: b.author }; books.push(row); return row; },
  };
  const first = await syncReadsBooks(store);
  assert.equal(first["velveteen-rabbit"], 345);
  assert.deepEqual(added, [345]);
  assert.equal(Object.keys(first).length, READS_QUIZZES.length);
  const again = await syncReadsBooks(store);
  assert.deepEqual(again, first);
  assert.equal(books.length, 1 + READS_QUIZZES.length - 1);
  assert.ok(settings.get(READS_BOOKS_KEY));
});
