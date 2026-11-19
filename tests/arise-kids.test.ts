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

test("tracing the A: the whole letter counts, part of it or a scribble doesn't", async () => {
  const { traceScore } = await import("../shared/ariseKids");
  const line = (x1: number, y1: number, x2: number, y2: number, n = 12) => Array.from({ length: n + 1 }, (_, i) => ({ x: x1 + (x2 - x1) * i / n, y: y1 + (y2 - y1) * i / n }));
  const left = line(5, 21, 12, 3), right = line(12, 3, 19, 21), bar = line(8, 14, 16, 14, 6);
  assert.equal(traceScore([], "A").done, false);
  assert.equal(traceScore([...left, ...right], "A").done, false, "both sides but not the bar");
  assert.equal(traceScore([...left, ...right, ...bar], "A").done, true);
  // A wobbly hand (up to 1.5 squares off) still counts.
  const wobble = [...left, ...right, ...bar].map((p, i) => ({ x: p.x + (i % 2 ? 1.5 : -1.5), y: p.y }));
  assert.equal(traceScore(wobble, "A").done, true, "wobbly but on the letter");
  const scribble = Array.from({ length: 200 }, (_, i) => ({ x: (i * 7) % 24, y: (i * 11) % 24 }));
  assert.equal(traceScore(scribble, "A").done, false, "scribbling all over the pad doesn't count");
});

test("Card Quest's tracing card waits for the tracing, and every card can be heard; Pick It! takes a tap anywhere or a switch", () => {
  const kids = read("client/src/pages/arise-kids/KidsApp.tsx");
  assert.match(kids, /const needsTrace = !!card\.trace && !traced/);
  assert.match(kids, /if \(needsTrace\) \{ showToast\("Trace the letter first, or tap Later\."\); return; \}/);
  assert.match(kids, /aria-label="Hear it"/);
  assert.match(kids, /e\.key === " " && e\.key !== "Enter"|e\.key !== " " && e\.key !== "Enter"/);
  assert.match(kids, /closest\("\[data-close\]"\)\) pick\(\)/);
  assert.match(read("client/src/pages/arise-kids/TracePad.tsx"), /touchAction: "none"/);
});

test("Shorts open for anyone signed in, and the site owner can use every Arise AAC page", () => {
  const routes = read("server/routes.ts");
  assert.match(routes, /if \(req\.user\.isAdmin\) return \{ id: req\.user\.id/);
  const shorts = routes.slice(routes.indexOf("app.get('/api/eye-gaze/youtube-shorts'"), routes.indexOf("app.get('/api/eye-gaze/youtube-shorts'") + 900);
  assert.ok(!shorts.includes("A linked Arise AAC account is required"), "Shorts no longer refuse a grown-up");
  assert.match(shorts, /const raw = child \? await storage\.getSetting/);
});
