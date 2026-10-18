import test from "node:test";
import assert from "node:assert/strict";
import { ANIMALS, answerChoices, isCorrectAnswer, namesOtherAnimal, normalizeSpeech } from "../shared/splash/animals";
import { readFileSync } from "node:fs";

const get = (id: string) => ANIMALS.find(a => a.id === id)!;

test("16 animals, each with a unique id, an emoji and a fact", () => {
  assert.equal(ANIMALS.length, 16);
  assert.equal(new Set(ANIMALS.map(a => a.id)).size, 16);
  for (const a of ANIMALS) { assert.ok(a.emoji && a.fact.length > 10); }
});

test("every animal has its own 3D model", () => {
  const src = readFileSync(new URL("../client/src/game/splash/creatures.ts", import.meta.url), "utf8");
  const build = src.slice(src.indexOf("const BUILD"), src.indexOf("};", src.indexOf("const BUILD")));
  for (const a of ANIMALS) assert.ok(build.includes(a.id.includes("-") ? `"${a.id}"` : ` ${a.id}`), a.id);
});

test("children can answer in their own words", () => {
  assert.ok(isCorrectAnswer("duck", get("duck")));
  assert.ok(isCorrectAnswer("It's a duck!", get("duck")));
  assert.ok(isCorrectAnswer("um I think that's an elephant", get("elephant")));
  assert.ok(isCorrectAnswer("ducks", get("duck")));
  assert.ok(isCorrectAnswer("hippopotamus", get("hippo")));
  assert.ok(isCorrectAnswer("Polar Bear", get("polar-bear")));
  assert.ok(isCorrectAnswer("a croc", get("crocodile")));
  assert.equal(normalizeSpeech("That's a DOLPHIN."), "dolphin");
});

test("near-misses inside other words don't count", () => {
  assert.ok(!isCorrectAnswer("seahorse", get("seal")));
  assert.ok(!isCorrectAnswer("ducky lion", get("whale")));
  assert.ok(!isCorrectAnswer("", get("frog")));
  assert.ok(!isCorrectAnswer("lionfish", get("lion")));
});

test("naming a different animal is a wrong answer; noise just asks again", () => {
  assert.ok(namesOtherAnimal("dolphin", get("shark")));
  assert.ok(!namesOtherAnimal("hmm what", get("shark")));
  assert.ok(!namesOtherAnimal("shark", get("shark")));
});

test("answer buttons include the right name once, with clearly different choices", () => {
  for (const a of ANIMALS) for (const n of [2, 3, 4]) {
    const c = answerChoices(a, n, 1234);
    assert.equal(c.length, n);
    assert.equal(c.filter(x => x === a.name).length, 1);
    assert.equal(new Set(c).size, n);
    for (const other of c) if (other !== a.name) assert.notEqual(other[0], a.name[0], `${other} sounds too close to ${a.name}`);
  }
});
