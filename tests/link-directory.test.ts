import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanFamily, emptyFamily } from "../shared/familyHub";
import { LIFE_PARTS, cleanLifeLayout } from "../shared/lifeLayout";
import { groupLinks } from "../shared/linkDirectory";

const link = (title: string, group?: string) => ({ id: title, title, url: `https://${title.toLowerCase()}.com`, emoji: "🔗", ...(group ? { group } : {}) });

test("folders and the Directory look are saved; junk folders and styles are dropped", () => {
  const f = cleanFamily({ linkPage: { title: "Us", bio: "", style: "directory", links: [link("Canvas", "School"), link("Insta"), { ...link("Bad"), group: "\u0000" }] } });
  assert.equal(f.linkPage.style, "directory");
  assert.equal(f.linkPage.links[0].group, "School");
  assert.equal("group" in f.linkPage.links[1], false);
  assert.equal("group" in f.linkPage.links[2], false);
  assert.equal("style" in cleanFamily({ linkPage: { style: "weird", links: [] } }).linkPage, false);
  assert.equal(cleanFamily({ linkPage: { links: [{ ...link("Long"), group: "x".repeat(80) }] } }).linkPage.links[0].group?.length, 30);
});

test("a directory can hold up to 200 links", () => {
  const many = Array.from({ length: 250 }, (_, i) => link(`Site${i}`));
  assert.equal(cleanFamily({ linkPage: { links: many } }).linkPage.links.length, 200);
});

test("links are grouped by folder in the order folders first appear, unfiled links first", () => {
  const groups = groupLinks([link("A", "School"), link("B"), link("C", "Bills"), link("D", "school"), link("E")]);
  assert.deepEqual(groups.map((g) => g.group), ["", "School", "Bills"]);
  assert.deepEqual(groups[0].links.map((l) => l.title), ["B", "E"]);
  assert.deepEqual(groups[1].links.map((l) => l.title), ["A", "D"]);
});

test("My links is a Home part, and existing layouts pick it up without losing anything", () => {
  assert.ok(LIFE_PARTS.some((p) => p.id === "links"));
  const old = cleanLifeLayout({ home: ["greeting", "agenda", "notes"], homeHidden: ["widgets"] });
  assert.ok(old.home.includes("links"));
  assert.ok(!old.homeHidden.includes("links"));
  assert.ok(old.home.indexOf("links") > old.home.indexOf("notes"));
});

test("the shared page carries folders and the look; Home only shows My links when there are links", () => {
  const share = readFileSync(new URL("../shared/todoShare.ts", import.meta.url), "utf8");
  assert.match(share, /page\.style === "directory"/);
  assert.match(share, /l\.group \? \{ group: l\.group \}/);
  const home = readFileSync(new URL("../client/src/components/family-hub/FamilyHome.tsx", import.meta.url), "utf8");
  assert.match(home, /links: \(on\("links"\) && family\.linkPage\.links\.length > 0 && /);
  assert.equal(emptyFamily().linkPage.links.length, 0);
});
