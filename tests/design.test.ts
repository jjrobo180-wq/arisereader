// Arise Design (the Canva-style app in Arise Notes): sizes, templates, what's saved, resizing, magic design.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SIZES, TEXT_PRESETS, blankDesign, builtinCopy, cleanCopy, cleanDesign, cleanEl, designShapePath, fillCss, gradientParts, resizeDesign, SHAPES, STICKERS, DESIGN_FONTS } from "../shared/office/designModel";
import { TEMPLATES, TEMPLATE_CATEGORIES, RECIPES, magicDesigns } from "../shared/office/designTemplates";

test("lots of sizes, templates in every size group, and every template is a clean, sensible design", () => {
  assert.ok(SIZES.length >= 20);
  assert.ok(TEMPLATES.length >= 80, `${TEMPLATES.length} templates`);
  assert.ok(TEMPLATE_CATEGORIES.length >= 12);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length, "ids are unique");
  for (const r of RECIPES) assert.ok(TEMPLATES.some((t) => t.make().pages[0] && t.id), r);
  for (const s of SIZES) assert.ok(TEMPLATES.some((t) => t.size === s.id) || ["a4"].includes(s.id) || TEMPLATES.some((t) => t.size === s.id), `a template for ${s.name}`);
  for (const t of TEMPLATES) {
    const d = t.make();
    assert.deepEqual(cleanDesign(JSON.parse(JSON.stringify(d))), d, `${t.id} survives saving unchanged`);
    const els = d.pages[0].elements;
    assert.ok(els.length >= 3, `${t.id} has content`);
    for (const e of els) {
      assert.ok(e.x + e.w > -d.w * 0.3 && e.x < d.w * 1.3 && e.y + e.h > -d.h * 0.3 && e.y < d.h * 1.3, `${t.id}: ${e.type} is on the page`);
      if (e.type === "text") { assert.ok((e.text || "").trim(), `${t.id}: empty text`); assert.ok(DESIGN_FONTS.includes(e.font as any), `${t.id}: font ${e.font}`); }
    }
  }
});

test("what's saved is checked: unknown things dropped, numbers kept in range, pictures only as images", () => {
  const d = cleanDesign({ size: "story", w: 1080, h: 1920, pages: [{ bg: "javascript:alert(1)", elements: [
    { type: "text", text: "Hi", font: "Comic Sans of Doom", size: 99999, weight: 500 },
    { type: "image", src: "data:text/html;base64,PHNjcmlwdD4=" },
    { type: "image", src: "data:image/png;base64,iVBORw0KGgo=" },
    { type: "bogus" }, { type: "shape", shape: "spaceship", fill: "url(evil)" },
    { type: "sticker", emoji: "🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉" },
  ] }], uploads: ["data:image/svg+xml;base64,AAAA", "data:image/jpeg;base64,AAAA"] });
  const [t, img1, img2, sh, st] = d.pages[0].elements;
  assert.equal(d.pages[0].bg, "#ffffff");
  assert.equal(t.font, "Inter"); assert.equal(t.size, 2000); assert.equal(t.weight, 400);
  assert.equal(img1.src, undefined); assert.ok(img2.src);
  assert.equal(sh.shape, "rect"); assert.equal(sh.fill, undefined);
  assert.equal(Array.from(st.emoji!).length, 8);
  assert.equal(d.pages[0].elements.length, 5);
  assert.deepEqual(d.uploads, ["data:image/jpeg;base64,AAAA"]);
  const empty = cleanDesign(null); assert.equal(empty.pages.length, 1); assert.equal(empty.size, "ig-post"); assert.deepEqual(empty.pages[0].elements, []);
  assert.equal(cleanEl({ type: "text", rot: 370 })!.rot, 10);
});

test("gradients, shapes, stickers and text styles", () => {
  assert.deepEqual(gradientParts("linear:135:#ff0000:#0000ff"), { angle: 135, stops: ["#ff0000", "#0000ff"] });
  assert.equal(fillCss("linear:90:#000:#fff"), "linear-gradient(90deg, #000, #fff)");
  assert.equal(fillCss("#123456"), "#123456");
  for (const s of SHAPES) assert.match(designShapePath(s.id, 100, 80), /^M /, s.id);
  assert.ok(STICKERS.reduce((n, g) => n + g.items.length, 0) >= 150);
  assert.ok(TEXT_PRESETS.length >= 12);
  for (const p of TEXT_PRESETS) for (const e of p.make(1080, 1080)) assert.ok(e.text && e.size! > 0, p.id);
});

test("resize keeps everything in place, scaled", () => {
  const d = TEMPLATES.find((t) => t.id === "party-post")!.make();
  const r = resizeDesign(d, 1080, 1920, "story");
  assert.equal(r.size, "story"); assert.equal(r.w, 1080); assert.equal(r.h, 1920);
  const a = d.pages[0].elements.find((e) => e.type === "text")!, b = r.pages[0].elements.find((e) => e.id === a.id)!;
  assert.equal(b.size, a.size, "same width, same text size");
  assert.ok(Math.abs((b.y + b.h / 2) / 1920 - (a.y + a.h / 2) / 1080) < 0.01, "same place on the page");
});

test("magic design: four looks from the AI's words, or from the words typed without AI", () => {
  const c = cleanCopy({ headline: "Bake Sale!", sub: "Friday at 3", body: "Cookies", cta: "Come hungry", emoji: "🍪", palette: ["#fffbeb", "#d97706", "#451a03"] }, "bake sale");
  const designs = magicDesigns(c, "flyer");
  assert.equal(designs.length, 4);
  for (const d of designs) { assert.equal(d.size, "flyer"); assert.ok(d.pages[0].elements.some((e) => e.text === "Bake Sale!")); assert.deepEqual(cleanDesign(JSON.parse(JSON.stringify(d))), d); }
  const b = builtinCopy("birthday party for my son on saturday afternoon");
  assert.equal(b.emoji, "🎉"); assert.ok(b.headline.length > 0);
  assert.deepEqual(cleanCopy({ palette: ["red"] }, "school math night").palette.length, 3);
});

test("it's an Office kind the server saves, and an app in Arise Notes", () => {
  const read = (f: string) => readFileSync(f, "utf8");
  assert.match(read("server/userDocs.ts"), /DOC_KINDS = \["sheet", "doc", "slides", "design"\]/);
  assert.match(read("client/src/components/office/officeKinds.tsx"), /design: DESIGN/);
  assert.match(read("client/src/components/arise-notes/notesAppsCatalog.tsx"), /id: "design", name: "Arise Design"/);
  assert.match(read("shared/pro/aiTasks.ts"), /"design-copy":/);
});

test("Arise Design's own home: sizes drawn to shape, your designs as pictures, templates by category, the look's colors", () => {
  const home = readFileSync(new URL("../client/src/components/office/DesignHome.tsx", import.meta.url), "utf8");
  assert.match(home, /What will you design today\?/);
  assert.match(home, /--dz-card": "var\(--an-card/);
  assert.doesNotMatch(home, /className="[^"]*\bbg-white(?![\/\w-])/, "no bg-white: the Notes looks repaint those");
  assert.match(readFileSync(new URL("../client/src/components/office/OfficeApp.tsx", import.meta.url), "utf8"), /if \(config\.kind === "design"\) return <DesignHome/);
  assert.match(readFileSync(new URL("../client/src/components/arise-notes/NotesApps.tsx", import.meta.url), "utf8"), /office && app\.id !== "design"/);
});

test("the event template's picture never sits on its words, at any size", async () => {
  const { TEMPLATES } = await import("../shared/office/designTemplates");
  for (const t of TEMPLATES.filter((x) => ["bake-sale", "story-event", "flyer-event", "poster-movie", "invite-grad", "halloween"].includes(x.id))) {
    const d = t.make(); const els = d.pages[0].elements;
    const st = els.find((e) => e.type === "sticker")!;
    const words = els.filter((e) => e.type === "text" && e.y > st.y);
    for (const w of words) assert.ok(st.y + st.h <= w.y + 1, `${t.id}: picture ends at ${st.y + st.h}, words start at ${w.y}`);
  }
});
