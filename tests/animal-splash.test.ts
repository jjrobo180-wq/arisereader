import test from "node:test";
import assert from "node:assert/strict";
import { ANIMALS, answerChoices, isCorrectAnswer, namesOtherAnimal, normalizeSpeech, photoUrls } from "../shared/splash/animals";
import { createHash } from "node:crypto";

const get = (id: string) => ANIMALS.find(a => a.id === id)!;

test("16 animals, each with a unique id, an emoji, a fact and a photo credit", () => {
  assert.equal(ANIMALS.length, 16);
  assert.equal(new Set(ANIMALS.map(a => a.id)).size, 16);
  for (const a of ANIMALS) { assert.ok(a.emoji && a.fact.length > 10 && a.credit && a.file); }
});

test("photo URLs use Wikimedia's real upload path (md5 of the file name)", () => {
  for (const a of ANIMALS) {
    const h = createHash("md5").update(a.file.replace(/ /g, "_")).digest("hex");
    assert.equal(a.hash, `${h[0]}/${h.slice(0, 2)}`, a.file);
    const [direct, redirect] = photoUrls(a, 500);
    assert.ok(direct.startsWith(`https://upload.wikimedia.org/wikipedia/commons/thumb/${a.hash}/`));
    assert.ok(direct.includes("/500px-"));
    assert.ok(redirect.startsWith("https://commons.wikimedia.org/wiki/Special:Redirect/file/"));
  }
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
