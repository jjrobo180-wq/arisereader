// Link widgets in the Home widget popup, and a WorkHub link page that is separate from the LifeHub's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WIDGET_DEFS, WIDGET_GROUPS, cleanWidgets, newWidget } from "../shared/widgets";
import { cleanLinkPage, cleanFamily, emptyFamily } from "../shared/familyHub";
import { legacyLinks, workLinkPage } from "../shared/workLinks";
import { KIT_DEFS } from "../shared/pluginKit";
import { kitHub } from "../shared/kitIndex";
import { linksShown, SAMPLE_LINKS } from "../shared/linkWidgets";

const read = (p: string) => readFileSync(p, "utf8");
const LINK_WIDGETS = ["links-page", "links-list", "links-tiles", "links-icons"];

test("the widget popup has a Links group with the four link widgets", () => {
  assert.ok(WIDGET_GROUPS.includes("Links"));
  assert.deepEqual(WIDGET_DEFS.filter((d) => d.group === "Links").map((d) => d.id), LINK_WIDGETS);
  for (const id of LINK_WIDGETS) assert.ok(newWidget(id, `x-${id}`, "2026-11-15"), id);
  // They save and come back (cleanWidgets keeps known types), with a theme and size.
  const saved = cleanWidgets(LINK_WIDGETS.map((type) => ({ id: type, type, theme: "midnight", size: "large" })));
  assert.deepEqual(saved.map((w) => w.type), LINK_WIDGETS);
  assert.ok(saved.every((w) => w.theme === "midnight" && w.size === "large"));
});

test("a link widget shows as many links as fit its size, and has example links before any are added", () => {
  assert.equal(linksShown("links-list", "small"), 3);
  assert.equal(linksShown("links-tiles", "large"), 8);
  assert.equal(linksShown("links-icons", "wide"), 6);
  assert.ok(SAMPLE_LINKS.length >= 8 && SAMPLE_LINKS.every((l) => /^https:\/\//.test(l.url)));
});

test("a link page keeps its look (theme and list or grid) and drops unsafe links", () => {
  const page = cleanLinkPage({ title: "Ms. R", theme: "sand", style: "directory", links: [
    { id: "a", title: "Grades", url: "https://grades.example.org", emoji: "📚", group: "School" },
    { id: "b", title: "Bad", url: "javascript:alert(1)", emoji: "x" },
    { id: "c", title: "Email me", url: "mailto:a@b.co", emoji: "✉️" },
  ] });
  assert.equal(page.theme, "sand");
  assert.equal(page.style, "directory");
  assert.deepEqual(page.links.map((l) => l.id), ["a", "c"]);
  assert.deepEqual(cleanLinkPage(null), { title: "", bio: "", links: [] });
  // The LifeHub's cleaner and the shared one agree.
  assert.deepEqual(cleanFamily({ linkPage: page }).linkPage, page);
});

test("the WorkHub's link page is its own: it never reads or changes the LifeHub's", () => {
  const life = cleanLinkPage({ title: "Life", links: [{ id: "l1", title: "Instagram", url: "https://instagram.com/me", emoji: "📸" }] });
  const work = workLinkPage({ title: "Work", links: [{ id: "w1", title: "Grades", url: "https://grades.example.org", emoji: "📚" }] });
  assert.deepEqual(work.links.map((l) => l.id), ["w1"]);
  assert.equal(work.title, "Work");
  assert.ok(!work.links.some((l) => life.links.some((x) => x.id === l.id)));
  // A WorkHub with nothing saved has an empty page, not the family's.
  const family = { ...emptyFamily(), linkPage: life };
  assert.deepEqual(workLinkPage(undefined, []).links, []);
  assert.equal(family.linkPage.links.length, 1);
  // The two pages can have different looks.
  assert.notEqual(cleanLinkPage({ theme: "dark" }).theme, cleanLinkPage({ theme: "mist" }).theme);
});

test("links saved by the first WorkHub Link page (a plain list) still show, until the page is first changed", () => {
  const records = [
    { id: "r1", plugin: "link-page", date: "2026-11-01", data: { title: "Class site", url: "school.example.org", folder: "School" } },
    { id: "r2", plugin: "link-page", date: "2026-11-02", data: { title: "", url: "https://forms.example.org" } },
    { id: "r3", plugin: "link-page", date: "2026-11-03", data: { title: "No address", url: "" } },
    { id: "r4", plugin: "pantry", date: "2026-11-03", data: { item: "rice" } },
  ];
  const links = legacyLinks(records as any);
  assert.deepEqual(links.map((l) => [l.id, l.title, l.url, l.group]), [["r1", "Class site", "https://school.example.org", "School"], ["r2", "forms.example.org", "https://forms.example.org", undefined]]);
  assert.deepEqual(workLinkPage(undefined, records as any).links.map((l) => l.id), ["r1", "r2"]);
  // Once a page is saved, it wins (even an emptied one), so deleting every link doesn't bring the old list back.
  assert.deepEqual(workLinkPage({ title: "", bio: "", links: [] }, records as any).links, []);
});

test("the Work Link page is in the kit index and has its icon (the two kit tests that were failing)", () => {
  assert.equal(kitHub("link-page"), "work");
  assert.equal(KIT_DEFS.find((d) => d.id === "link-page")?.hub, "work");
  assert.match(read("client/src/components/plugin-kit/kitIcons.ts"), /\bLink2\b/);
});

test("both hubs give their own link page to the widgets, and use the same editor with the same looks", () => {
  const life = read("client/src/components/family-hub/FamilyHome.tsx");
  assert.match(life, /<WidgetLinksProvider page=\{family\.linkPage\} open=\{\(\) => go\("links"\)\}>/);
  assert.doesNotMatch(life, /workspace\.linkPage|workLinks/);
  const work = read("client/src/pages/TeacherHub.tsx");
  assert.match(work, /<WidgetLinksProvider page=\{workLinks\} open=\{\(\) => openKit\("link-page"\)\}>/);
  assert.match(work, /workLinkPage\(\(workspace as any\)\.linkPage, kitRecords\)/);
  assert.match(work, /<LinkPageEditor page=\{workLinks\} update=\{setWorkLinks\}[\s\S]{0,120}where="work" \/>/);
  assert.doesNotMatch(work, /family\.linkPage/);
  const editor = read("client/src/components/family-hub/LinkPage.tsx");
  assert.match(editor, /data-testid="link-theme"/);
  assert.match(editor, /data-testid="link-style"/);
  // Only the LifeHub's page has a public share link (the public page reads the LifeHub's links only).
  assert.match(editor, /\{where === "life" && <ShareButton /, "sharing is under Public page, in LifeHub");
  assert.match(read("client/src/components/widgets/WidgetFace.tsx"), /case "links-page": case "links-list": case "links-tiles": case "links-icons": return <LinksFace/);
});
