import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanPage, defaultPage, pageInk, cardInk, bgCss, safeUrl, PRESETS } from "../shared/earshotPage";

test("a saved page keeps only safe, known things", () => {
  const p = cleanPage({
    bg: { kind: "image", image: "javascript:alert(1)" },
    banner: { kind: "image", image: "https://example.com/b.jpg" },
    accent: "red; background:url(x)", font: "comic", card: "glass", radius: 999,
    widgets: [
      { id: "a", type: "about", col: "main" }, { id: "b", type: "about", col: "side" },
      { id: "c", type: "script", col: "main" },
      { id: "d", type: "links", col: "side", links: [{ label: "Me", url: "https://ok.example" }, { label: "Bad", url: "javascript:void(0)" }, { label: "Data", url: "data:text/html,hi" }] },
      { id: "e", type: "top8", col: "main", shows: Array.from({ length: 12 }, (_, i) => ({ id: String(100 + i), name: `S${i}`, art: "https://x/a.jpg" })) },
      { id: "f", type: "friends", col: "main", handles: ["Good_One", "x", "good_one", "a b c"] },
    ],
    song: { id: "1", showId: "2", title: "T", show: "S", art: "https://x/a.jpg", audio: "http://insecure/a.mp3", secs: 10 },
  });
  assert.equal(p.bg.kind, "gradient", "a bad photo link falls back to the default background");
  assert.equal(p.banner.kind, "image");
  assert.equal(p.accent, defaultPage().accent);
  assert.equal(p.font, defaultPage().font);
  assert.equal(p.radius, 28);
  assert.deepEqual(p.widgets.map((w) => w.type), ["about", "links", "top8", "friends"], "unknown widgets go, and one-of-a-kind widgets appear once");
  assert.deepEqual(p.widgets[1].links, [{ label: "Me", url: "https://ok.example/" }]);
  assert.equal(p.widgets[2].shows!.length, 8);
  assert.deepEqual(p.widgets[3].handles, ["good_one"]);
  assert.equal(p.song, null, "a profile song must play over https");
});

test("text stays readable on any background", () => {
  const light = cleanPage({ ...defaultPage(), bg: { kind: "color", color: "#fafafa" }, text: "auto", card: "none" });
  const dark = cleanPage({ ...defaultPage(), bg: { kind: "color", color: "#101010" }, text: "auto", card: "solid", cardColor: "#ffffff" });
  assert.equal(pageInk(light), "#111111");
  assert.equal(pageInk(dark), "#ffffff");
  assert.equal(cardInk(dark), "#111111");
  for (const t of PRESETS) assert.ok(bgCss(cleanPage({ ...defaultPage(), ...t.look }).bg).backgroundColor, t.id);
  assert.equal(safeUrl("https://a.b/c d"), "");
});

test("pages, guestbook and the Social tab are wired up", () => {
  const server = readFileSync(new URL("../server/podcastSocial.ts", import.meta.url), "utf8");
  assert.match(server, /app\.post\(`\$\{P\}\/me\/page`/);
  assert.match(server, /app\.post\(`\$\{P\}\/u\/:handle\/guestbook`/);
  assert.match(server, /app\.delete\(`\$\{P\}\/u\/:handle\/guestbook\/:id`/);
  assert.match(server, /const page = cleanPage\(req\.body\?\.page\)/);
  const x = readFileSync(new URL("../client/src/components/family-hub/earshot/EarshotSocialX.tsx", import.meta.url), "utf8");
  assert.match(x, /<PersonSpace /);
  assert.match(x, /<PagesStrip /);
});
