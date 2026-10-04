import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { READABLE_BOOKS } from "../shared/readsCatalog";

test("every readable book has its contents and chapters on disk", () => {
  assert.ok(READABLE_BOOKS.length >= 30);
  for (const b of READABLE_BOOKS) {
    const idx = JSON.parse(readFileSync(`client/public/reads/${b.bookId}/index.json`, "utf8"));
    assert.equal(idx.chapters.length, b.chapters);
    for (let i = 1; i <= b.chapters; i++) {
      const html = readFileSync(`client/public/reads/${b.bookId}/${i}.html`, "utf8");
      assert.ok(html.length > 50, `${b.title} chapter ${i} is empty`);
      assert.ok(!/<script|on\w+=|javascript:/i.test(html), `${b.title} chapter ${i} has unsafe markup`);
      assert.ok(!/gutenberg/i.test(html), `${b.title} chapter ${i} has license boilerplate`);
      for (const m of html.matchAll(/src="([^"]+)"/g)) assert.ok(existsSync(`client/public${m[1]}`), `missing image ${m[1]}`);
    }
  }
});
