import test from "node:test";
import assert from "node:assert/strict";
import { MATCH_SETS, MatchGame, POP_LEVELS, popBubbles, SENTENCES, sentenceTiles, isNextWord } from "../shared/eyegaze/wordgames";

test("every match set has 6 distinct word/picture pairs", () => {
  assert.ok(MATCH_SETS.length >= 8);
  for (const s of MATCH_SETS) { assert.equal(s.pairs.length, 6); assert.equal(new Set(s.pairs.map(p => p.word)).size, 6); assert.equal(new Set(s.pairs.map(p => p.emoji)).size, 6); }
});

test("look mode: pick a word then its picture to match; a wrong pick just lets you try again", () => {
  const g = new MatchGame(MATCH_SETS[0], 3, "look", 1);
  assert.equal(g.cards.length, 6); assert.ok(g.cards.every(c => c.faceUp));
  const word = g.cards.find(c => c.kind === "word")!;
  const wrong = g.cards.find(c => c.kind === "picture" && c.pair !== word.pair)!;
  const right = g.cards.find(c => c.kind === "picture" && c.pair === word.pair)!;
  g.select(word.id); assert.deepEqual(g.select(wrong.id).map(e => e.t), ["nomatch"]);
  g.select(word.id); assert.deepEqual(g.select(right.id).map(e => e.t), ["match"]);
  assert.ok(word.matched && right.matched); assert.equal(g.misses, 1);
});

test("two words never match each other (it's word ↔ picture)", () => {
  const g = new MatchGame(MATCH_SETS[1], 4, "look", 2);
  const [a, b] = g.cards.filter(c => c.kind === "word");
  g.select(a.id); assert.deepEqual(g.select(b.id).map(e => e.t), ["nomatch"]);
});

test("memory mode: cards start face down, a mismatch locks until hidden again, and the board can be cleared", () => {
  const g = new MatchGame(MATCH_SETS[2], 4, "memory", 3);
  assert.ok(g.cards.every(c => !c.faceUp));
  const a = g.cards[0], b = g.cards.find(c => c.pair !== a.pair)!;
  assert.deepEqual(g.select(a.id).map(e => e.t), ["flip"]);
  assert.deepEqual(g.select(b.id).map(e => e.t), ["flip", "nomatch"]);
  assert.equal(g.locked, true); assert.deepEqual(g.select(g.cards[2].id), []);
  assert.equal(g.hideMismatch().length, 2); assert.ok(!a.faceUp && !b.faceUp);
  // a perfect clear
  const all: string[] = [];
  for (const pair of new Set(g.cards.map(c => c.pair))) { const [x, y] = g.cards.filter(c => c.pair === pair); for (const e of [...g.select(x.id), ...g.select(y.id)]) all.push(e.t); }
  assert.ok(g.done); assert.ok(all.includes("win"));
});

test("stars reward few mistakes", () => {
  const g = new MatchGame(MATCH_SETS[3], 4, "look", 4); g.misses = 0; assert.equal(g.stars(), 3); g.misses = 4; assert.equal(g.stars(), 2); g.misses = 9; assert.equal(g.stars(), 1);
});

test("word pop rounds have the target once plus three look-alike words", () => {
  for (const lvl of POP_LEVELS) for (const r of lvl.rounds) {
    assert.equal(r.choices.length, 4); assert.equal(new Set(r.choices).size, 4); assert.equal(r.choices[0], r.target);
    const b = popBubbles(r, 7); assert.deepEqual([...b].sort(), [...r.choices].sort());
  }
});

test("sentence tiles contain every word (even repeated ones) plus the extras, and order is checked word by word", () => {
  for (const s of SENTENCES) {
    const tiles = sentenceTiles(s, 9);
    assert.equal(tiles.length, s.words.length + s.extra.length); assert.equal(new Set(tiles.map(t => t.id)).size, tiles.length);
    for (const w of s.words) assert.ok(tiles.some(t => t.word === w));
    for (const e of s.extra) assert.ok(!s.words.includes(e), `${s.words.join(" ")}: extra word ${e} is also in the sentence`);
  }
  const s = SENTENCES.find(x => x.words.join(" ") === "THE BIRD IS IN THE TREE")!;
  assert.ok(isNextWord(s, 0, "THE")); assert.ok(!isNextWord(s, 0, "BIRD")); assert.ok(isNextWord(s, 4, "THE")); assert.ok(!isNextWord(s, 6, "TREE"));
});
