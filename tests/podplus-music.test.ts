// Pod+ Music (server/music.ts): real covers, artist names, sorting.
import test from "node:test";
import assert from "node:assert/strict";
import { artistName, imageOf, musicSearchUrl, portraitFromSummary, albumsFromSearch } from "../server/music";

test("Archive creator names read like people's names", () => {
  assert.equal(artistName("Beethoven, Ludwig van"), "Ludwig van Beethoven");
  assert.equal(artistName("Beethoven, Ludwig van, 1770-1827"), "Ludwig van Beethoven");
  assert.equal(artistName("Armstrong, Louis (1901-1971)"), "Louis Armstrong");
  assert.equal(artistName("Glenn Miller and His Orchestra"), "Glenn Miller and His Orchestra");
  assert.equal(artistName("Earl Hines, Orchestra"), "Earl Hines, Orchestra");
});

test("an album's own cover or label scan comes first; no picture means none", () => {
  assert.match(imageOf("abc", [{ name: "x.mp3" }, { name: "label scan.jpg", format: "JPEG" }, { name: "cover.png" }]), /\/download\/abc\/cover\.png$/);
  assert.match(imageOf("abc", [{ name: "__ia_thumb.jpg" }]), /services\/img\/abc$/);
  assert.equal(imageOf("abc", [{ name: "x.mp3" }, { name: "x_spectrogram.png" }]), "");
});

test("a Wikipedia portrait is used only for musicians", () => {
  const pic = { thumbnail: { source: "https://upload.wikimedia.org/x/Beethoven.jpg" } };
  assert.equal(portraitFromSummary({ type: "standard", description: "German composer and pianist", ...pic }), pic.thumbnail.source);
  assert.equal(portraitFromSummary({ type: "standard", description: "City in Germany", ...pic }), "");
  assert.equal(portraitFromSummary({ type: "disambiguation", description: "composer", ...pic }), "");
  assert.equal(portraitFromSummary({ type: "standard", description: "jazz trumpeter", thumbnail: { source: "https://evil.example/x.jpg" } }), "");
});

test("newest, oldest and by-artist searches ask the Archive the right way", () => {
  const nu = new URL(musicSearchUrl("all", "", 1, "new"));
  assert.deepEqual(nu.searchParams.getAll("sort[]"), ["addeddate desc"]);
  const old = new URL(musicSearchUrl("oldies", "", 1, "old"));
  assert.deepEqual(old.searchParams.getAll("sort[]"), ["date asc"]);
  assert.match(old.searchParams.get("q")!, /date:\[1890-01-01 TO 1955-12-31\]/);
  assert.match(new URL(musicSearchUrl("all", "", 1, "popular", "Louis Armstrong")).searchParams.get("q")!, /creator:\("louis armstrong"\)/);
});

test("albums keep their recording year", () => {
  const [a] = albumsFromSearch({ response: { docs: [{ identifier: "rec1", title: "St. Louis Blues", creator: "Smith, Bessie", downloads: 5, licenseurl: "http://creativecommons.org/publicdomain/mark/1.0/", date: "1925-01-14" }] } });
  assert.equal(a.year, 1925);
  assert.equal(a.artist, "Bessie Smith");
});

test("file-name uploads with no artist are left out", async () => {
  const { looksLikeJunk } = await import("../server/music");
  assert.equal(looksLikeJunk("geometry_dash_1.9", "Pashok11"), true);
  assert.equal(looksLikeJunk("hcpb", ""), true);
  assert.equal(looksLikeJunk("ccb", "Unknown artist"), true);
  assert.equal(looksLikeJunk("Moonlight Sonata", ""), false);
  assert.equal(looksLikeJunk("Bolero", "Maurice Ravel"), false);
  assert.equal(looksLikeJunk("1812", "Tchaikovsky"), false);
});
