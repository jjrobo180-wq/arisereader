// New reads and books reach the iPhone apps without an app update, and the apps' live updates stay
// small (shared/liveCatalog.ts, server/contentCatalog.ts, client/src/lib/liveCatalog.ts, prune_content.sh).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addToCatalog, catalogIndex, catalogItems, missingFrom } from "../shared/liveCatalog";
import { NEWS_ARTICLES } from "../shared/ariseNews";
import { READABLE_BOOKS } from "../shared/readsCatalog";
import { registerContentCatalog } from "../server/contentCatalog";

const read = (p: string) => readFileSync(p, "utf8");

test("an app copy asks only for the reads and books it doesn't have, and adds them", () => {
  const index = catalogIndex();
  assert.ok(index.reads.length >= 190 && index.books.length > 10 && index.classics.length > 10);
  // Up to date: nothing to fetch.
  assert.deepEqual(missingFrom(index), { reads: [], books: [], classics: [] });
  // The server has one more read and one more book than this copy.
  const sample = NEWS_ARTICLES[0];
  const newRead = { ...sample, slug: "a-brand-new-read", title: "A Brand New Read" };
  const newBook = { ...READABLE_BOOKS[0], bookId: 999999, key: "brand-new-book", title: "Brand New Book" };
  const want = missingFrom({ ...index, reads: [...index.reads, "a-brand-new-read", "../evil"], books: [...index.books, "brand-new-book"] });
  assert.deepEqual(want, { reads: ["a-brand-new-read"], books: ["brand-new-book"], classics: [] });
  const before = NEWS_ARTICLES.length;
  // Broken entries are skipped; good ones are added once.
  assert.equal(addToCatalog({ reads: [newRead, { slug: "no-body", title: "x" }, newRead], books: [newBook], classics: [{ slug: "bad" }] }), 2);
  assert.equal(NEWS_ARTICLES.length, before + 1);
  assert.ok(READABLE_BOOKS.some((b) => b.key === "brand-new-book"));
  assert.equal(addToCatalog({ reads: [newRead] }), 0);
  // The server sends full entries for the names asked for.
  const items = catalogItems({ reads: [sample.slug, "nope"], classics: [index.classics[0]] });
  assert.equal(items.reads.length, 1); assert.equal(items.reads[0].slug, sample.slug); assert.equal(items.classics.length, 1);
});

test("the server's catalog: a small index with an ETag, and the items asked for", async () => {
  const routes: Record<string, any> = {};
  registerContentCatalog({ get: (p: string, h: any) => { routes[p] = h; } } as any);
  const call = async (p: string, req: any) => { let body: any = null, code = 200; const headers: Record<string, string> = {}; const res: any = { set: (h: any) => { Object.assign(headers, h); return res; }, status: (c: number) => { code = c; return res; }, end: () => res, type: () => res, send: (b: any) => { body = JSON.parse(b); return res; }, json: (b: any) => { body = b; return res; } }; await routes[p](req, res); return { code, body, headers }; };
  const first = await call("/api/content/catalog", { headers: {} });
  assert.ok(first.body.reads.length >= 190);
  assert.equal((await call("/api/content/catalog", { headers: { "if-none-match": first.headers.ETag } })).code, 304);
  const items = await call("/api/content/catalog/items", { query: { reads: `${first.body.reads[0]},../x`, books: "", classics: "" } });
  assert.equal(items.body.reads.length, 1);
});

test("wired in: the lists are topped up before any screen, chapters and covers come from the server, updates stay small", () => {
  const main = read("client/src/main.tsx");
  assert.ok(main.indexOf('import "./lib/liveCatalog";') < main.indexOf('import App from "./App";'));
  assert.match(main, /const SERVER_FILES = \/\^\\\/\(reads\|classics\|covers\)/);
  assert.match(read("server/nativeAppCors.ts"), /\(reads\|classics\|covers\)/);
  assert.match(read("server/routes.ts"), /registerContentCatalog\(app\);/);
  assert.match(read("client/src/pages/reads/ReadHub.tsx"), /\[catalogTick\]/);
  const prune = read(".github/scripts/prune_content.sh");
  assert.match(prune, /rm -rf "\$OUT\/reads" "\$OUT\/classics" "\$OUT\/audio"/);
  assert.match(prune, /\[ "\$APP" = "eyegaze" \] \|\| rm -rf "\$OUT\/eyegaze\/wren"/);
  assert.match(read("client/src/pages/EyeGazeWren.tsx"), /isNativeApp\(\) && nativeFlavor\(\) !== "eyegaze"\n/);
});

test("reads kept on the phone are added to a list as it loads, without the first screen loading every read", async () => {
  const { addKept, okClassic } = await import("../shared/liveCatalogKept");
  (globalThis as any).__ariseLiveCatalog = { classics: [{ slug: "kept-classic", title: "Kept", author: "A", genre: "Classics", chapters: 3 }, { slug: "BAD" }] };
  const list = [{ slug: "already", title: "x", author: "y", genre: "Classics", chapters: 1 }] as any[];
  addKept(list, "classics", okClassic, (c: any) => c.slug);
  assert.deepEqual(list.map((c) => c.slug), ["already", "kept-classic"]);
  delete (globalThis as any).__ariseLiveCatalog;
  const boot = read("client/src/lib/liveCatalog.ts");
  assert.ok(!/^import .*@shared\/liveCatalog"/m.test(boot), "the startup file loads the lists only later, with import()");
  assert.match(read("shared/readsCatalog.ts"), /addKept\(READABLE_BOOKS, "books", okBook, bookName\);/);
  assert.match(read("script/build_reads.py"), /addKept\(READABLE_BOOKS/);
});
