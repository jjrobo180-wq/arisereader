// Pod+ Audiobooks (server/audiobooks.ts): LibriVox books from the Internet Archive.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relayPass, relayPassOk, baseTitle, bookFromMetadata, booksFromSearch, gutenbergIdOf, isBookAudio, lengthSecs, pieceRange, readerOf, registerAudiobookRoutes, searchUrl, sectionsOf, tidyChapter, versionsUrl } from "../server/audiobooks";

const read = (u: string) => decodeURIComponent(u.replace(/\+/g, " "));

test("the top list: one copy of each book, no LibriVox podcasts, bad ids dropped, who reads it", () => {
  const books = booksFromSearch({ response: { docs: [
    { identifier: "pride_prejudice_librivox", title: "Pride and Prejudice", creator: "Jane Austen", downloads: 900000, avg_rating: "4.5", num_reviews: 40, description: "<p>A <b>classic</b>. Read by Karen Savage.</p>", addeddate: "2006-05-01T00:00:00Z" },
    { identifier: "pride_prejudice_v3_librivox", title: "Pride and Prejudice (version 3)", creator: "Jane Austen", downloads: 100 },
    { identifier: "librivox_community_podcast", title: "LibriVox Community Podcast", downloads: 5 },
    { identifier: "bad id!", title: "Nope" },
  ] } });
  assert.deepEqual(books.map((b) => b.id), ["pride_prejudice_librivox"]);
  assert.equal(books[0].about, "A classic . Read by Karen Savage.");
  assert.deepEqual([books[0].reader, books[0].kind, books[0].added], ["Karen Savage", "solo", "2006-05-01"]);
  assert.equal(baseTitle("Dracula (Version 2)"), "Dracula");
  assert.equal(readerOf("Hamlet (dramatic reading)", "").kind, "dramatic");
  assert.equal(readerOf("Emma", "Read by LibriVox volunteers").kind, "group");
  assert.equal(readerOf("Emma", "Read by Ann, Bob and Cy").kind, "group");
});

test("chapter names are made uniform", () => {
  const t = (s: string) => tidyChapter(s, "A Tale of Two Cities");
  assert.deepEqual(t("c1"), { title: "Chapter 1", sub: "" });
  assert.deepEqual(t("01 - Chapter 01: The Period"), { title: "Chapter 1", sub: "The Period" });
  assert.deepEqual(t("A Tale of Two Cities Chap 2 - THE MAIL"), { title: "Chapter 2", sub: "The Mail" });
  assert.deepEqual(t("Chapter XIV. The Honest Tradesman"), { title: "Chapter 14", sub: "The Honest Tradesman" });
  assert.deepEqual(t("Book 2, Chapter 3"), { title: "Book 2", sub: "Chapter 3" });
  assert.deepEqual(t("07"), { title: "Chapter 7", sub: "" });
  assert.deepEqual(t("Preface"), { title: "Preface", sub: "" });
  assert.deepEqual(t("Chapter Civil War"), { title: "Chapter Civil War", sub: "" }, "a word isn't a Roman numeral");
});

test("a book's chapters: LibriVox only, 64 kbps copies, in track order, with tidy names and sizes", () => {
  assert.equal(bookFromMetadata("x", { metadata: { collection: ["opensource_audio"] }, files: [] }), null, "not LibriVox");
  const b = bookFromMetadata("dracula_librivox", {
    metadata: { collection: ["librivoxaudio"], title: "Dracula", creator: "Bram Stoker", description: "Read by Ann Smith. Online text: http://www.gutenberg.org/etext/345" },
    files: [
      { name: "dracula_02_stoker_64kb.mp3", format: "64Kbps MP3", track: "02", title: "c2", length: "20:00", size: "9600000" },
      { name: "dracula_01_stoker_64kb.mp3", format: "64Kbps MP3", track: "01/27", title: "01 - Chapter 01: Jonathan Harker's Journal", length: "1500.4" },
      { name: "dracula_01_stoker.mp3", format: "128Kbps MP3", track: "01", title: "Chapter 1" },
    ],
  })!;
  assert.deepEqual(b.chapters.map((c) => [c.title, c.sub]), [["Chapter 1", "Jonathan Harker's Journal"], ["Chapter 2", ""]]);
  assert.equal(b.secs, 1500 + 1200);
  assert.equal(b.chapters[1].bytes, 9600000);
  assert.equal(b.chapters[0].audio, "https://archive.org/download/dracula_librivox/dracula_01_stoker_64kb.mp3");
  assert.equal(b.gutenberg, 345);
  assert.equal(b.reader, "Ann Smith");
  assert.equal(lengthSecs("1:02:03"), 3723);
  assert.equal(gutenbergIdOf({ description: "nothing" }), 0);
});

test("searches stay in the LibriVox collection, in the order picked", () => {
  assert.match(read(searchUrl("mystery", "", 1)), /collection:\(librivoxaudio\).*sherlock.*downloads desc/);
  assert.match(read(searchUrl("all", "", 1, "new")), /addeddate desc/);
  assert.match(read(searchUrl("all", "", 1, "rated")), /num_reviews:\[3 TO 100000\].*avg_rating desc/);
  assert.match(read(searchUrl("all", "", 1, "az")), /titleSorter asc/);
  assert.match(read(searchUrl("all", "", 1, "nonsense")), /downloads desc/);
  assert.match(read(searchUrl("all", "Twain\" OR *:*", 1)), /title:\(twain or\)/, "typed words can't change the query");
  assert.match(read(versionsUrl("Emma (version 2)", "Jane Austen")), /title:\(emma\) AND creator:\(austen\)/);
});

test("the book's text is cut into its chapters, without Gutenberg's header", () => {
  const txt = ["The Project Gutenberg eBook of X", "*** START OF THE PROJECT GUTENBERG EBOOK X ***", "", "Contents", "", "CHAPTER I.", "THE PERIOD", "", "It was the best", "of times.", "", "CHAPTER II.", "", "Second part.", "*** END OF THE PROJECT GUTENBERG EBOOK X ***", "License text"].join("\n");
  const s = sectionsOf(txt);
  assert.deepEqual(s.map((x) => x.heading), ["Beginning", "Chapter I. · The Period", "Chapter II."]);
  assert.equal(s[1].text, "It was the best of times.");
  assert.ok(!s.some((x) => /License|Project Gutenberg/.test(x.text)));
});

test("AI transcripts go 10 minutes at a time; only LibriVox MP3s go through the audio relay", () => {
  assert.deepEqual(pieceRange({ secs: 1500, bytes: 12_000_000 }, 1), { from: 4_800_000, to: 9_599_999, at: 600 });
  assert.equal(pieceRange({ secs: 1500, bytes: 12_000_000 }, 3), null);
  assert.ok(isBookAudio("https://archive.org/download/dracula_librivox/dracula_01_stoker_64kb.mp3"));
  assert.ok(!isBookAudio("https://evil.example/download/x/y.mp3"));
  assert.ok(!isBookAudio("https://archive.org/download/x/../../etc/passwd"));
});

test("routes: list, book, other readings, AI search (answers matched to real books)", async () => {
  const routes: Record<string, Function> = {};
  const app: any = { get: (p: string, ...h: any[]) => { routes[`GET ${p}`] = h[h.length - 1]; }, post: (p: string, ...h: any[]) => { routes[`POST ${p}`] = h[h.length - 1]; } };
  const meta = { metadata: { collection: ["librivoxaudio"], title: "Emma", creator: "Jane Austen" }, files: [{ name: "emma_01_64kb.mp3", format: "64Kbps MP3", track: "1", title: "Chapter 1", length: "600" }] };
  const docs = { response: { docs: [{ identifier: "emma_librivox", title: "Emma", creator: "Jane Austen", downloads: 50 }, { identifier: "emma_2_librivox", title: "Emma (version 2)", creator: "Jane Austen", downloads: 9, description: "Full cast dramatic reading" }] } };
  const seen: string[] = [];
  registerAudiobookRoutes(app, (_q: any, _s: any, n: any) => n(), {
    fetchJson: async (u) => { seen.push(u); return u.includes("/metadata/") ? meta : docs; },
    ask: async () => ({ books: [{ title: "Emma", author: "Jane Austen", why: "A witty matchmaker." }, { title: "Not A Real Book", author: "Nobody", why: "x" }] }),
  });
  const call = async (key: string, req: any) => { let out: any, status = 200; const res: any = { set: () => res, json: (b: any) => { out = b; return res; }, status: (s: number) => { status = s; return res; } }; await routes[key]({ user: { id: "dev1" }, query: {}, params: {}, body: {}, headers: {}, ...req }, res); return { status, out }; };
  const list = await call("GET /api/podscroll/books", { query: { sort: "new" } });
  assert.equal(list.out.books.length, 1);
  assert.ok(list.out.sorts.some((s: any) => s.id === "new"));
  const v = await call("GET /api/podscroll/books/:id/versions", { params: { id: "emma_librivox" } });
  assert.deepEqual(v.out.versions.map((b: any) => [b.id, b.kind]), [["emma_librivox", "group"], ["emma_2_librivox", "dramatic"]]);
  // The other route ids don't get caught by /books/:id.
  assert.ok(Object.keys(routes).indexOf("GET /api/podscroll/books/audio") < Object.keys(routes).indexOf("GET /api/podscroll/books/:id"));
  // Ask AI, AI transcripts and Voice boost are for Pod+ members (signed in: req.creator).
  const free = await call("POST /api/podscroll/books/ai", { body: { q: "a funny love story" } });
  assert.equal(free.status, 402);
  assert.equal(free.out.needSignIn, true);
  assert.equal((await call("GET /api/podscroll/books/:id/transcript", { params: { id: "emma_librivox" }, query: { ch: "0" } })).status, 402);
  assert.equal((await call("GET /api/podscroll/books/relay-pass", {})).status, 402);
  const member = { creator: { email: "a@b.c", id: 1 } };
  assert.match((await call("GET /api/podscroll/books/relay-pass", member)).out.pass, /^\d+\.[\w-]{32}$/);
  const ai = await call("POST /api/podscroll/books/ai", { ...member, body: { q: "a funny love story" } });
  assert.equal(ai.status, 200);
  assert.equal(ai.out.books[0].why, "A witty matchmaker.");
  assert.equal((await call("POST /api/podscroll/books/ai", { ...member, body: { q: "x" } })).status, 400);
  // The voice boost relay needs a member's pass.
  const relay = async (k: string) => { let status = 200; const res: any = { status: (x: number) => { status = x; return res; }, end: () => res }; await routes["GET /api/podscroll/books/audio"]({ query: { u: "https://archive.org/download/emma_librivox/emma_01_64kb.mp3", k }, headers: {}, socket: {}, on: () => {} }, res); return status; };
  assert.equal(await relay(""), 403);
  assert.equal(await relay("9999999999.forged-signature-forged-signature12"), 403);
});

test("relay passes: signed, and only good for 12 hours", () => {
  const key = Buffer.alloc(32, 7), t = Date.UTC(2026, 9, 28);
  const p = relayPass(key, t);
  assert.ok(relayPassOk(key, p, t + 3600_000));
  assert.ok(!relayPassOk(key, p, t + 13 * 3600_000), "expired");
  assert.ok(!relayPassOk(Buffer.alloc(32, 8), p, t), "another key");
  assert.ok(!relayPassOk(key, p.replace(/^\d+/, (n) => String(Number(n) + 99999)), t), "a longer time can't be written in");
});

test("Audiobooks stays inside its own pages: no row on the home page", () => {
  const home = readFileSync(new URL("../podscroll/Home.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(home, /BooksRow/);
});

import { joinWavs, linesOf, narrationParts, noticeEnd, sectionIndex, speechChunks } from "../server/audiobooks";

test("voice features: words in transcript lines, the LibriVox notice, narrator parts and sound", () => {
  const lines = linesOf({ segments: [{ start: 0, end: 2, text: " Hello there." }, { start: 2, end: 4, text: "Next line." }], words: [{ start: 0, end: 1, word: "Hello" }, { start: 1, end: 2, word: "there." }, { start: 2.1, end: 3, word: "Next" }] }, 600);
  assert.deepEqual(lines[0], { s: 600, e: 602, t: "Hello there.", w: [{ s: 600, t: "Hello" }, { s: 601, t: "there." }] });
  assert.deepEqual(lines[1].w, [{ s: 602.1, t: "Next" }]);
  assert.equal(noticeEnd([{ start: 0, end: 3, text: "Chapter one of Emma." }, { start: 3, end: 8, text: "This is a LibriVox recording." }, { start: 8, end: 14.2, text: "For more information, or to volunteer, please visit librivox.org." }, { start: 15, end: 20, text: "Emma Woodhouse, handsome, clever and rich" }]), 14.2);
  assert.equal(noticeEnd([{ start: 0, end: 5, text: "It was a dark night." }]), 0);
  const parts = narrationParts(["a".repeat(500), "b".repeat(500), "c".repeat(100)].join("\n\n"));
  assert.deepEqual(parts.map((p) => [p.from, p.to]), [[0, 0], [1, 2]]);
  const chunks = speechChunks(`${"Word ".repeat(30)}end. ${"More words here ".repeat(10)}`);
  assert.ok(chunks.every((c) => c.length <= 190) && chunks.length >= 2);
  const wav = (n: number) => { const b = Buffer.alloc(44 + n); b.write("RIFF", 0); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.write("data", 36); b.writeUInt32LE(n, 40); return b; };
  const joined = joinWavs([wav(100), wav(50)]);
  assert.equal(joined.readUInt32LE(40), 150);
  assert.equal(joined.length, 44 + 150);
  const sections = [{ heading: "Beginning", text: "" }, { heading: "Chapter I. · The Period", text: "" }, { heading: "Chapter II.", text: "" }];
  assert.equal(sectionIndex(sections, { chapters: [{ n: 1, title: "Chapter 2", sub: "", secs: 0, audio: "", bytes: 0 }] }, 0), 2);
});

test("chapter names from file names read the same as the rest", () => {
  assert.deepEqual(tidyChapter("wonderland ch 01", "Alice's Adventures in Wonderland"), { title: "Chapter 1", sub: "" });
  assert.deepEqual(tidyChapter("artofwar 03 sunzi", "The Art of War"), { title: "Chapter 3", sub: "" });
  assert.deepEqual(tidyChapter("Pride Prejudice Chap 3", "Pride and Prejudice"), { title: "Chapter 3", sub: "" });
  assert.deepEqual(tidyChapter("Book 2 Chapter 4", "War and Peace"), { title: "Book 2", sub: "Chapter 4" });
});

test("the book's text is found for well-known books even when the recording's name differs", async () => {
  const { registerAudiobookRoutes } = await import("../server/audiobooks");
  const routes = new Map<string, any>();
  const app: any = { get: (p: string, ...h: any[]) => routes.set(p, h[h.length - 1]), post: () => {} };
  const asked: string[] = [];
  registerAudiobookRoutes(app, ((_r: any, _s: any, n: any) => n()) as any, {
    fetchJson: async (u: string) => {
      asked.push(u);
      if (u.includes("/metadata/")) return { metadata: { collection: ["librivoxaudio"], title: "Alice's Adventures in Wonderland (version 7 Dramatic Reading)", creator: "Lewis Carroll" }, files: [{ name: "alice_01.mp3", format: "64Kbps MP3", title: "Chapter 1", length: "600" }] };
      throw new Error("gutendex down");
    },
    fetchText: async (u: string) => { asked.push(u); return "*** START OF THE PROJECT GUTENBERG EBOOK ***\n\nCHAPTER I.\nDown the Rabbit-Hole\n\nAlice was beginning to get very tired of sitting by her sister on the bank.\n\nCHAPTER II.\nThe Pool of Tears\n\nCuriouser and curiouser!\n\n*** END OF THE PROJECT GUTENBERG EBOOK ***"; },
  });
  let out: any = null, code = 200;
  await routes.get("/api/podscroll/books/:id/text")({ params: { id: "aliceinwonderland_drama_1310_librivox" } }, { status: (c: number) => { code = c; return { json: (b: any) => { out = b; } }; }, set: () => ({ json: (b: any) => { out = b; } }), json: (b: any) => { out = b; } });
  assert.equal(code, 200, JSON.stringify(out));
  assert.ok(asked.some((u) => u.includes("/epub/11/")), asked.join(" "));
});
