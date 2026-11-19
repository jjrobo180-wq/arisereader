// Arise Kids: the Arise AAC app's Home, Apps and Stickers (the prototype the owner chose, Nov 18, 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DECKS, QUESTIONS, SHELVES, STICKERS, cardStep, nextSticker, pickStep, streak, streakMarks, visibleShelves, winSticker, wordOfDay } from "../shared/ariseKids";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("stickers are won in order, once each, and the album fills up", () => {
  assert.equal(STICKERS.length, 12);
  assert.deepEqual(winSticker([]), { won: [0], sticker: 0 });
  assert.deepEqual(winSticker([0, 2]), { won: [0, 2, 1], sticker: 1 });
  const all = STICKERS.map((_, i) => i);
  assert.deepEqual(winSticker(all), { won: all, sticker: 11 }, "all won: no duplicates");
  assert.equal(nextSticker([0, 1, 2]), 3);
});

test("days in a row count back from today (or yesterday), and the marks start again every four days", () => {
  assert.equal(streak([], "2026-11-18"), 0);
  assert.equal(streak(["2026-11-16", "2026-11-17", "2026-11-18"], "2026-11-18"), 3);
  assert.equal(streak(["2026-11-16", "2026-11-17"], "2026-11-18"), 2, "the morning before playing still shows yesterday's run");
  assert.equal(streak(["2026-11-14", "2026-11-17", "2026-11-18"], "2026-11-18"), 2, "a missed day starts again");
  assert.equal(streak(["2026-10-31", "2026-11-01"], "2026-11-01"), 2, "across a month");
  assert.deepEqual([0, 1, 3, 4, 5, 6, 8].map(streakMarks), [0, 1, 3, 4, 1, 2, 4]);
});

test("Card Quest: I did it goes through the deck and the last card wins a sticker; Later never wins", () => {
  for (const id of Object.keys(DECKS) as (keyof typeof DECKS)[]) assert.equal(DECKS[id].cards.length, 3);
  assert.deepEqual(cardStep("letters", 0, true), { index: 1, win: false });
  assert.deepEqual(cardStep("letters", 2, true), { index: 0, win: true });
  assert.deepEqual(cardStep("letters", 2, false), { index: 0, win: false });
});

test("Pick It!: a tap picks the lit box, a right answer goes on, the third right answer wins, a wrong one tries again", () => {
  let s = { q: 0, on: 0, picked: null as number | null };
  let r = pickStep(s);
  assert.equal(r.picked, 0, "picks the lit box");
  r = pickStep({ q: 0, on: 0, picked: 0 });
  assert.deepEqual(r, { q: 1, on: 0, picked: null, win: false });
  r = pickStep({ q: 1, on: 0, picked: 0 });
  assert.deepEqual(r, { q: 1, on: 0, picked: null, win: false }, "wrong: same question again");
  r = pickStep({ q: 2, on: 0, picked: QUESTIONS[2].right });
  assert.deepEqual(r, { q: 0, on: 0, picked: null, win: true });
  s = { q: 0, on: 1, picked: null };
  assert.equal(pickStep(s).picked, 1);
});

test("everything Arise AAC had is on the Apps shelves, and a grown-up's choices still hide what's not allowed", () => {
  const paths = SHELVES.flatMap((s) => s.tiles).map((t) => t.path).filter(Boolean);
  for (const p of ["/eye-gaze-talker", "/eye-gaze-games", "/eye-gaze-lessons", "/eye-gaze-life-skills", "/my-world", "/eye-gaze-wren", "/eye-gaze-tv", "/eye-gaze-flashcards", "/eye-gaze-buddy", "/leaderboard", "/eye-gaze-fidgets", "/eye-gaze-farm", "/eye-gaze-potty", "/reading-level-up", "/profile"])
    assert.ok(paths.includes(p), p);
  // Every page the old home linked to is still reachable.
  const oldHome = read("client/src/pages/EyeGazeHome.tsx");
  for (const m of oldHome.matchAll(/path: "([^"]+)"/g)) assert.ok(paths.includes(m[1]), `old home link ${m[1]}`);
  const noTalk = visibleShelves((p) => p !== "/eye-gaze-talker");
  const names = noTalk.flatMap((s) => s.tiles).map((t) => t.name);
  assert.ok(!names.includes("My Talker") && !names.includes("Wren"), "Wren follows My Talker's permission");
  assert.ok(names.includes("Card Quest") && names.includes("Pick It!"), "the built-in games always show");
  const none = visibleShelves(() => false);
  assert.deepEqual(none.map((s) => s.name), ["Games", "Card decks"]);
});

test("the word of the day changes each day", () => {
  assert.notEqual(wordOfDay("2026-11-18"), wordOfDay("2026-11-19"));
  assert.equal(wordOfDay("2026-11-18"), wordOfDay("2026-11-18"));
});

test("Arise AAC opens on Arise Kids: Home, Apps and Stickers, edge to edge, with the same tab bar on every page", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /<Route path="\/eye-gaze-home">\s*<ProtectedRoute><KidsApp tab="home" \/>/);
  assert.match(app, /<Route path="\/eye-gaze-apps">\s*<ProtectedRoute><KidsApp tab="apps" \/>/);
  assert.match(app, /<Route path="\/eye-gaze-stickers">\s*<ProtectedRoute><KidsApp tab="stickers" \/>/);
  const shell = read("client/src/components/EyeGazeSiteShell.tsx");
  assert.match(shell, /const kidsScreen = location === "\/eye-gaze-home" \|\| location === "\/eye-gaze-apps" \|\| location === "\/eye-gaze-stickers"/);
  assert.match(shell, /<KidsTabBar tab=\{null\} \/>/);
  assert.match(read("client/index.html"), /family=Lexend:wght@400;600;800/);
  // Pixel for pixel: the prototype's style text, as written.
  const kids = read("client/src/pages/arise-kids/KidsApp.tsx");
  for (const s of [
    "grid-column: span 4; grid-row: span 2; border: 0; border-radius: 26px; background: #1f2bd6",
    "flex-shrink: 0; width: 132px; height: 116px; border: 0; border-radius: 18px",
    "min-height: 62px; border: 0; border-radius: 22px; background: #ffc531; box-shadow: 0 6px 0 #c99200",
    "flex-grow: 2; min-height: 70px; border-radius: 35px; border: 0; background: #ffd34d",
  ]) assert.ok(kids.includes(s), s);
});
