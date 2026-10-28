// Pod+ Audiobooks (server/audiobooks.ts): LibriVox books from the Internet Archive.
import { test } from "node:test";
import assert from "node:assert/strict";
import { baseTitle, bookFromMetadata, booksFromSearch, lengthSecs, searchUrl } from "../server/audiobooks";

test("the top list: one copy of each book, no LibriVox podcasts, bad ids dropped", () => {
  const books = booksFromSearch({ response: { docs: [
    { identifier: "pride_prejudice_librivox", title: "Pride and Prejudice", creator: "Jane Austen", downloads: 900000, avg_rating: "4.5", num_reviews: 40, description: "<p>A <b>classic</b></p>" },
    { identifier: "pride_prejudice_v3_librivox", title: "Pride and Prejudice (version 3)", creator: "Jane Austen", downloads: 100 },
    { identifier: "librivox_community_podcast", title: "LibriVox Community Podcast", downloads: 5 },
    { identifier: "bad id!", title: "Nope" },
  ] } });
  assert.deepEqual(books.map((b) => b.id), ["pride_prejudice_librivox"]);
  assert.equal(books[0].about, "A classic");
  assert.equal(books[0].rating, 4.5);
  assert.match(books[0].cover, /services\/img\/pride_prejudice_librivox$/);
  assert.equal(baseTitle("Dracula (Version 2)"), "Dracula");
});

test("a book's chapters: LibriVox only, 64 kbps copies, in track order, with lengths", () => {
  assert.equal(bookFromMetadata("x", { metadata: { collection: ["opensource_audio"] }, files: [] }), null, "not LibriVox");
  const b = bookFromMetadata("dracula_librivox", {
    metadata: { collection: ["librivoxaudio", "audio_bookspoetry"], title: "Dracula", creator: "Bram Stoker" },
    files: [
      { name: "dracula_02_stoker_64kb.mp3", format: "64Kbps MP3", track: "02", title: "Chapter 2", length: "20:00" },
      { name: "dracula_01_stoker_64kb.mp3", format: "64Kbps MP3", track: "01/27", title: "Chapter 1", length: "1500.4" },
      { name: "dracula_01_stoker.mp3", format: "128Kbps MP3", track: "01", title: "Chapter 1" },
      { name: "dracula.jpg", format: "JPEG" },
    ],
  })!;
  assert.deepEqual(b.chapters.map((c) => c.title), ["Chapter 1", "Chapter 2"]);
  assert.equal(b.secs, 1500 + 1200);
  assert.equal(b.chapters[0].audio, "https://archive.org/download/dracula_librivox/dracula_01_stoker_64kb.mp3");
  assert.equal(lengthSecs("1:02:03"), 3723);
});

test("searches stay inside the LibriVox collection, most listened-to first", () => {
  const read = (u: string) => decodeURIComponent(u.replace(/\+/g, " "));
  const u = read(searchUrl("mystery", "", 1));
  assert.match(u, /collection:\(librivoxaudio\)/);
  assert.match(u, /sherlock/);
  assert.match(u, /downloads desc/);
  assert.match(read(searchUrl("top", "Twain\" OR *:*", 1)), /title:\(twain or\)/, "typed words can't change the query");
});
