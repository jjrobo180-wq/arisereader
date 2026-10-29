// A.R.I.S.E. Beginners (inside Reader): the curriculum is sound, every story is decodable with only what has been
// taught by then, the word work follows the rules, the Reading Coach scores readings like a running record, and
// stars and points follow the rules the server uses.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ARI, HEARTS, LESSONS, NAMES, POINTS, UNITS, WORDS, blastCards, canDecode, chainChange, dotsOf, knowledgeAt, lessonById, lessonPoints,
  nextLesson, passed, starsFor, tilesFor, undecodable, unitOpen, voiceTexts, isBeginnerGrade,
} from "../shared/beginners";
import { soundsByPart, soundsOf, visemeOf, keyFor } from "../shared/beginners/phonics";
import { checkWord, scoreReading, sentencesOf } from "../shared/beginners/reading";
import { SAYIT_CATEGORIES, sayItWord } from "../shared/beginners/sayit";

test("18 units, each with at least three lessons, in order, with unique ids", () => {
  assert.equal(UNITS.length, 18);
  UNITS.forEach((u, i) => {
    assert.equal(u.n, i + 1);
    assert.ok(u.lessons.length >= 3, `unit ${u.n}`);
    assert.ok(u.title && u.kid && u.skill && u.grade && /^#[0-9a-f]{6}$/i.test(u.color), `unit ${u.n}`);
  });
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
  LESSONS.forEach((l, i) => assert.equal(l.order, i));
});

test("every story uses only spellings and heart words taught by then", () => {
  for (const l of LESSONS) assert.deepEqual(undecodable(l.id), [], `${l.id} "${l.title}"`);
});

test("the decoder knows the rules: untaught spellings and endings are refused", () => {
  const k1 = knowledgeAt("u1l1");
  assert.ok(canDecode("Sam", k1) && canDecode("mat", k1) && canDecode("I", k1));
  assert.ok(!canDecode("map", k1), "p is taught in lesson 2");
  assert.ok(!canDecode("mats", k1), "-s comes in unit 2");
  assert.ok(canDecode("naps", knowledgeAt("u2l1")));
  assert.ok(!canDecode("cake", knowledgeAt("u10l3")), "magic e is unit 11");
  assert.ok(canDecode("cake", knowledgeAt("u11l1")));
  assert.ok(!canDecode("jumped", knowledgeAt("u16l3")) && canDecode("rested", knowledgeAt("u17l1")) && canDecode("dripping", knowledgeAt("u17l1")));
});

test("word work: chains change one spelling at a time, every word is decodable, tiles hold every part", () => {
  for (const l of LESSONS) {
    const k = knowledgeAt(l.id);
    assert.equal(l.chain.length, 3, l.id);
    assert.equal(l.spell.length, 3, l.id);
    if (!l.syll) for (let i = 1; i < 3; i++) assert.ok(chainChange(l.chain[i - 1], l.chain[i]), `${l.id}: ${l.chain[i - 1].show} → ${l.chain[i].show}`);
    for (const e of [...l.chain, ...l.spell]) assert.ok(canDecode(e.w, k), `${l.id}: ${e.show}`);
    for (const w of [...l.sort.leftWords, ...l.sort.rightWords]) assert.ok(canDecode(w, k), `${l.id} sort: ${w}`);
    assert.ok(l.sort.leftWords.length >= 2 && l.sort.rightWords.length >= 2, l.id);
    for (const words of [l.chain, l.spell]) {
      const tiles = tilesFor(words, l.id);
      for (const e of words) for (const p of e.parts) assert.ok(tiles.includes(p), `${l.id}: tile ${p}`);
      assert.ok(tiles.length > new Set(words.flatMap((e) => e.parts)).size, `${l.id} has extra tiles to choose from`);
    }
  }
});

test("questions: three per story, the right answer is never also a wrong one", () => {
  for (const l of LESSONS) {
    assert.equal(l.questions.length, 3, l.id);
    for (const q of l.questions) {
      assert.ok(q.q.endsWith("?"), `${l.id}: ${q.q}`);
      assert.equal(new Set([q.right, ...q.wrong].map((s) => s.toLowerCase())).size, 3, `${l.id}: ${q.q}`);
    }
  }
});

test("Sound Blast cards have key words and two look-alike choices", () => {
  for (const l of LESSONS) {
    const cards = blastCards(l);
    assert.ok(cards.length >= 2, l.id);
    for (const c of cards) {
      assert.ok(c.word && c.wrong.length === 2 && !c.wrong.includes(c.g), `${l.id} ${c.g}`);
      assert.ok(["start", "vowel", "end"].includes(c.at));
    }
  }
  assert.equal(keyFor("ow", 14)?.word, "snow");
  assert.equal(keyFor("ow", 16)?.word, "cow");
});

test("sounds: silent e, x, digraphs and vowel teams", () => {
  const w = (s: string) => WORDS.get(s)!;
  assert.deepEqual(soundsByPart(w("cake")), [["k"], ["ā"], ["k"], []]);
  assert.deepEqual(soundsOf(w("box")), ["b", "ŏ", "k", "s"]);
  assert.deepEqual(soundsOf(w("ship")), ["sh", "ĭ", "p"]);
  assert.deepEqual(soundsOf(w("rain")), ["r", "ā", "n"]);
  assert.deepEqual(dotsOf(w("cake")), [1, 1, 1, 0]);
  assert.equal(visemeOf("m"), "mbp");
  assert.equal(visemeOf("ō"), "o");
});

test("the Reading Coach scores like a running record", () => {
  const text = "Sam sat at a mat. Pam sat at the map.";
  const perfect = scoreReading(text, "Sam sat at a mat Pam sat at the map", 20, NAMES);
  assert.equal(perfect.accuracy, 100);
  assert.equal(perfect.correct, 10);
  assert.equal(perfect.wcpm, 30);
  // A misread word and a skipped word are misses; what was heard is kept.
  const missed = scoreReading(text, "Sam sit at a mat Pam sat the map", 20, NAMES);
  assert.equal(missed.correct, 8);
  assert.equal(missed.accuracy, 80);
  assert.deepEqual(missed.practice.sort(), ["at", "sat"].sort());
  assert.equal(missed.heard[1], "sit");
  // Sounding out and repeats are not errors.
  const repeats = scoreReading(text, "Sam s sat sat at a mat um Pam sat at the the map", 25, NAMES);
  assert.equal(repeats.accuracy, 100);
  // Stopping early: the rest is "not read", not wrong.
  const early = scoreReading(text, "Sam sat at a mat", 8, NAMES);
  assert.equal(early.accuracy, 100);
  assert.equal(early.attempted, 5);
  assert.equal(early.marks.filter((m) => m === "unread").length, 5);
  // Silence or another text scores nothing.
  assert.equal(scoreReading(text, "", 5).attempted, 0);
  assert.equal(scoreReading(text, "hello there how are you today", 5).correct, 0);
  // Words that sound the same count.
  assert.equal(scoreReading("I see two bees.", "eye sea to bees", 5).accuracy, 100);
  assert.equal(sentencesOf(text).length, 2);
});

test("saying one word: right, close, phrases", () => {
  assert.equal(checkWord("cat", "cat").correct, true);
  assert.equal(checkWord("cat", "um the cat").correct, true);
  assert.equal(checkWord("ship", "chip").correct, false);
  assert.equal(checkWord("ship", "shop").close, true);
  assert.equal(checkWord("beep beep", "beep beep").correct, true);
  assert.equal(checkWord("two", "2").correct, true);
});

test("stars and points", () => {
  assert.equal(passed(2, 3), true);
  assert.equal(passed(1, 3), false);
  assert.equal(starsFor({ right: 1, total: 3, readAccuracy: 100 }), 0);
  assert.equal(starsFor({ right: 2, total: 3, readAccuracy: null }), 1);
  assert.equal(starsFor({ right: 3, total: 3, readAccuracy: null }), 2);
  assert.equal(starsFor({ right: 3, total: 3, readAccuracy: 92 }), 3);
  assert.equal(lessonPoints(1), 5);
  assert.equal(lessonPoints(12), 10);
  assert.ok(POINTS.dailyCap >= 20 && POINTS.dailyCap <= 60, "about the same as English Explorer's daily cap");
  for (const l of LESSONS) assert.equal(l.points, lessonPoints(l.unit));
});

test("units open in order, and from a start unit down", () => {
  const none = new Set<string>();
  assert.equal(unitOpen(1, none), true);
  assert.equal(unitOpen(2, none), false);
  assert.equal(unitOpen(5, none, 5), true);
  const unit1 = new Set(UNITS[0].lessons.map((l) => l.id));
  assert.equal(unitOpen(2, unit1), true);
  assert.equal(nextLesson(none)?.id, "u1l1");
  assert.equal(nextLesson(unit1)?.id, UNITS[1].lessons[0].id);
  assert.equal(nextLesson(none, 11)?.unit, 11);
});

test("the AI voice may say the program and nothing else", () => {
  const ok = voiceTexts();
  for (const l of LESSONS) {
    for (const s of sentencesOf(l.text)) assert.ok(ok.has(s.toLowerCase()), `${l.id}: ${s}`);
    for (const q of l.questions) assert.ok(ok.has(q.q.toLowerCase()) && ok.has(q.right.toLowerCase()), `${l.id}: ${q.q}`);
    for (const c of blastCards(l)) assert.ok(ok.has(c.word.toLowerCase()), `${l.id}: ${c.word}`);
    for (const e of [...l.chain, ...l.spell]) assert.ok(ok.has(e.show.toLowerCase()), `${l.id}: ${e.show}`);
  }
  for (const h of HEARTS) assert.ok(ok.has(h.show.toLowerCase()));
  for (const line of Object.values(ARI)) assert.ok(ok.has(line.toLowerCase()));
  for (const c of SAYIT_CATEGORIES) for (const w of c.words) assert.ok(ok.has(w.w.toLowerCase()) && ok.has(w.line.toLowerCase()), w.w);
  assert.ok(!ok.has("say something rude"));
  for (const t of ok) assert.ok(t.length <= 400);
});

test("Say It Studio sets are well-formed", () => {
  assert.equal(new Set(SAYIT_CATEGORIES.map((c) => c.id)).size, SAYIT_CATEGORIES.length);
  for (const c of SAYIT_CATEGORIES) {
    assert.ok(c.words.length >= 8, c.id);
    assert.equal(new Set(c.words.map((w) => w.w)).size, c.words.length, c.id);
    assert.ok(c.tip.length > 40 && c.starter.length > 10, c.id);
    for (const w of c.words) assert.ok(w.e && w.line, `${c.id}: ${w.w}`);
  }
  assert.ok(SAYIT_CATEGORIES.some((c) => c.kind === "mouth"));
  assert.equal(sayItWord("animals", "cat")?.e, "🐱");
  assert.equal(sayItWord("animals", "unicorn"), null);
});

test("heart words mark a real tricky part and belong to a lesson", () => {
  for (const h of HEARTS) {
    assert.ok(h.tricky.length >= 1, h.w);
    assert.ok(lessonById(h.lesson), h.w);
  }
});

test("Beginners is meant for K–3", () => {
  for (const g of ["K", "k", "Kindergarten", "1", "2nd", "3rd grade", "TK", "Pre-K"]) assert.ok(isBeginnerGrade(g), g);
  for (const g of ["4", "5th", "8", "", null, "12"]) assert.ok(!isBeginnerGrade(g), String(g));
});
