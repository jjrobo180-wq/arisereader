// Photo Talk on Arise AAC's Talk shelf: real photos of the child's own things, used four ways (swipe,
// right now, this or that, her phrases). Run with: npx tsx --test tests/photo-talk.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MAX_CARDS, cardSays, normalizePhotoTalk, rightNow, swipeTo, thisOrThat, timeOfDay } from "../shared/photoTalk";
import { SHELVES, visibleShelves } from "../shared/ariseKids";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

test("a board is tidied before it's saved, and every photo must be this child's own", () => {
  const out = normalizePhotoTalk({
    cards: [{ id: "Juice Box", label: "  juice ", phrase: "", photoPath: "7/1-photo-talk-a.jpg", times: ["morning", "nope", "bed"] }, { label: "swing", photoPath: null }],
    phrases: [{ say: "Ready, set, go!", means: "let's start" }],
  }, 7);
  assert.deepEqual(out.cards[0], { id: "juice-box", label: "juice", phrase: "", photoPath: "7/1-photo-talk-a.jpg", times: ["morning", "bed"] });
  assert.equal(out.cards[1].id, "card-2");
  assert.equal(out.phrases[0].say, "Ready, set, go!");
  assert.throws(() => normalizePhotoTalk({ cards: [{ label: "x", photoPath: "8/someone-else.jpg" }] }, 7), /does not belong/);
  assert.throws(() => normalizePhotoTalk({ cards: [{ label: "x", photoPath: "7/../8/a.jpg" }] }, 7), /does not belong/);
  assert.throws(() => normalizePhotoTalk({ cards: [{ label: "  " }] }, 7), /needs a word/);
  assert.throws(() => normalizePhotoTalk({ cards: Array.from({ length: MAX_CARDS + 1 }, () => ({ label: "a" })) }, 7), /up to/);
  assert.deepEqual(normalizePhotoTalk(null, 7), { cards: [], phrases: [] });
});

test("two cards with the same id keep both", () => {
  const out = normalizePhotoTalk({ cards: [{ id: "a", label: "x" }, { id: "a", label: "y" }] }, 1);
  assert.deepEqual(out.cards.map((c) => c.id), ["a", "a-2"]);
});

test("a photo with only a word says “I want …”", () => {
  assert.equal(cardSays({ label: "juice", phrase: "" }), "I want juice");
  assert.equal(cardSays({ label: "swing", phrase: "Push me on the swing" }), "Push me on the swing");
});

test("right now: the part of the day, then 3 photos for it, filled from the board when fewer are marked", () => {
  assert.equal(timeOfDay(7), "morning");
  assert.equal(timeOfDay(12), "lunch");
  assert.equal(timeOfDay(15), "afternoon");
  assert.equal(timeOfDay(18), "dinner");
  assert.equal(timeOfDay(21), "bed");
  const cards = [{ id: "a", times: [] }, { id: "b", times: ["bed"] }, { id: "c", times: [] }, { id: "d", times: ["bed"] }] as any;
  assert.deepEqual(rightNow(cards, "bed").map((c: any) => c.id), ["b", "d", "a"]);
  assert.deepEqual(rightNow(cards, "lunch").map((c: any) => c.id), ["a", "b", "c"]);
  assert.equal(rightNow(cards.slice(0, 2), "bed").length, 2);
});

test("this or that goes through every pair, never the same photo twice, sides swapping", () => {
  assert.equal(thisOrThat(["a"], 0), null);
  const cards = ["a", "b", "c", "d"];
  const seen = new Set<string>();
  for (let r = 0; r < 6; r++) {
    const [x, y] = thisOrThat(cards, r)!;
    assert.notEqual(x, y);
    seen.add([x, y].sort().join(""));
  }
  assert.equal(seen.size, 6, "all 6 pairs of 4 photos");
  assert.deepEqual(thisOrThat(cards, 6), thisOrThat(cards, 0), "then it starts again");
  assert.deepEqual(thisOrThat(cards, 1), ["c", "b"], "the second pair is swapped");
});

test("swipe goes round both ways", () => {
  assert.equal(swipeTo(0, 1, 3), 1);
  assert.equal(swipeTo(2, 1, 3), 0);
  assert.equal(swipeTo(0, -1, 3), 2);
  assert.equal(swipeTo(0, 1, 0), 0);
});

test("Photo Talk is on the Talk shelf, behind the same grown-up switch as My Talker", () => {
  const tile = SHELVES.find((s) => s.name === "Talk")!.tiles.find((t) => t.name === "Photo Talk")!;
  assert.equal(tile.path, "/eye-gaze-photo-talk");
  assert.equal(tile.allow, "/eye-gaze-talker");
  const hidden = visibleShelves((p) => p !== "/eye-gaze-talker").flatMap((s) => s.tiles).map((t) => t.name);
  assert.ok(!hidden.includes("Photo Talk"));
});

test("the page, its route and the server are wired up; photos stay private", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /const EyeGazePhotoTalk = lazyPage\(\(\) => import\("\.\/pages\/EyeGazePhotoTalk"\)\);/);
  assert.match(app, /<Route path="\/eye-gaze-photo-talk">[\s\S]{0,200}<EyeGazeAccessGate path="\/eye-gaze-talker"><EyeGazePhotoTalk \/>/);
  const shell = read("client/src/components/EyeGazeSiteShell.tsx");
  assert.match(shell, /location\.startsWith\("\/eye-gaze-photo-talk"\)/);
  const routes = read("server/routes.ts");
  assert.match(routes, /app\.get\('\/api\/eye-gaze\/photo-talk', authMiddleware/);
  assert.match(routes, /app\.post\('\/api\/eye-gaze\/photo-talk\/config', authMiddleware[\s\S]{0,400}validMyWorldGrownupPass\(req, child\.id\)[\s\S]{0,200}normalizePhotoTalk\(req\.body, child\.id\)/);
  assert.match(routes, /createSignedUrl\(path, 3600\)/);
  const page = read("client/src/pages/EyeGazePhotoTalk.tsx");
  assert.match(page, /\/api\/eye-gaze\/my-world\/upload/, "photos go to the private My World storage");
  assert.match(page, /accept="image\/\*"/);
  for (const m of ["Swipe", "Right now", "This or that", "My phrases"]) assert.ok(page.includes(`label: "${m}"`), m);
});
