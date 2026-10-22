// Arise Slides: decks, layouts, and PowerPoint (.pptx) files in and out.
// Run with: npx tsx --test tests/office-slides.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanDeck, deckFromOutline, makeSlide, readPptx, slideTitle, themeOf, writePptx } from "../shared/office/slidesModel";

test("old decks and AI outlines become real slides", () => {
  const d = cleanDeck({ slides: [{ title: "Fractions", bullets: ["Grade 4"], notes: "hi" }, { title: "Parts of a whole", bullets: ["Numerator", "Denominator"] }] });
  assert.equal(d.slides.length, 2);
  assert.equal(slideTitle(d.slides[0]), "Fractions");
  assert.match(d.slides[1].elements.find((e) => e.role === "body")!.html!, /<li>Numerator<\/li>/);
  assert.equal(d.slides[0].notes, "hi");
  const bad = cleanDeck({ theme: "nope", slides: [{ elements: [{ type: "image", src: "javascript:x", x: 1, y: 1, w: 1, h: 1 }, { type: "text", html: "<p onclick=x>a</p>", x: 0, y: 0, w: 10, h: 10 }] }] });
  assert.equal(bad.theme, "simple");
  assert.equal(bad.slides[0].elements.length, 1);
  assert.equal(bad.slides[0].elements[0].html, "<p>a</p>");
});

test("PowerPoint round trip keeps text, positions, shapes and notes", async () => {
  const deck = deckFromOutline("grape", "Water cycle", [{ title: "Water cycle", bullets: ["Science · Grade 5"], notes: "Welcome" }, { title: "Evaporation", bullets: ["Sun heats water", "Vapor rises"], notes: "Show the kettle" }]);
  deck.slides.push(makeSlide("number", themeOf("grape"), { title: "71%", sub: "of Earth is water" }));
  const back = await readPptx(writePptx(deck, "Water"));
  assert.equal(back.slides.length, 3);
  assert.equal(slideTitle(back.slides[1]).startsWith("Evaporation"), true);
  const body = back.slides[1].elements.find((e) => /Sun heats/.test(e.html || ""))!;
  assert.match(body.html!, /<ul><li>Sun heats water<\/li><li>Vapor rises<\/li><\/ul>/);
  assert.ok(Math.abs(body.x - 60) < 1 && Math.abs(body.w - 840) < 1);
  assert.equal(back.slides[1].notes, "Show the kettle");
  assert.equal(back.slides[0].bg, themeOf("grape").bg);
  assert.ok(back.slides[0].elements.some((e) => e.type === "shape" && e.fill === themeOf("grape").accent));
});
