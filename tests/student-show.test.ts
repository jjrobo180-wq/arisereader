import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCENES, FLAT, TARGET_SECONDS, SITE, words, beatSeconds, totalSeconds, clock, firstBeatOf, flatten, readMinutes, EXAMPLE_SHORT_READ } from "../shared/presentShow";
import { READABLE_BOOKS } from "../shared/readsCatalog";
import { POEMS } from "../shared/poems";
import { NEWS_ARTICLES } from "../shared/ariseNews";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the show runs about five minutes by itself", () => {
  const total = totalSeconds();
  assert.ok(total >= TARGET_SECONDS - 20 && total <= TARGET_SECONDS + 10, `total ${total}s`);
  assert.equal(clock(total), `${Math.floor(Math.round(total) / 60)}:${String(Math.round(total) % 60).padStart(2, "0")}`);
});

test("it covers everything that was asked for, in the order a student meets it", () => {
  assert.deepEqual(SCENES.map((s) => s.id), ["welcome", "login", "library", "reads", "quiz", "leaderboard", "competition", "wrap"]);
  const said = SCENES.flatMap((s) => s.beats.map((b) => b.say)).join(" ").toLowerCase();
  for (const topic of ["log in", "quiz", "leaderboard", "short reads", "competition", "70 percent", "points", "prizes"]) assert.ok(said.includes(topic), `never mentions "${topic}"`);
  assert.ok(said.includes(SITE));
});

test("every line can be read aloud at an easy pace and fits the caption bar", () => {
  for (const b of FLAT) {
    const pace = words(b.say) / (b.seconds - 1.6);
    assert.ok(pace <= 2.8, `"${b.say.slice(0, 30)}" is too fast (${pace.toFixed(2)} words a second)`);
    assert.ok(b.say.length <= 170, `"${b.say.slice(0, 30)}" is too long for three lines (${b.say.length})`);
    assert.ok(b.seconds >= 3, "a line stays up at least three seconds");
  }
});

test("the flattened beats line up with the scenes", () => {
  assert.equal(FLAT.length, SCENES.reduce((n, s) => n + s.beats.length, 0));
  FLAT.forEach((b, i) => { const want = i === 0 ? 0 : FLAT[i - 1].start + FLAT[i - 1].seconds; assert.ok(Math.abs(b.start - want) < 1e-6, `beat ${i} starts when the one before ends`); });
  SCENES.forEach((s, i) => { assert.equal(FLAT[firstBeatOf(i)].id, s.id); assert.equal(FLAT[firstBeatOf(i)].beat, 0); });
  assert.equal(flatten([]).length, 0);
  assert.equal(totalSeconds([]), 0);
  assert.equal(beatSeconds({ say: "one two three four five six seven eight nine ten" }) > beatSeconds({ say: "one" }), true);
});

test("the numbers it says come from the real catalogs", () => {
  const said = SCENES.find((s) => s.id === "reads")!.beats.map((b) => b.say).join(" ");
  assert.ok(said.includes(`${READABLE_BOOKS.length} classic books`) || said.includes(`${READABLE_BOOKS.length} `), "book count");
  assert.ok(said.includes(String(POEMS.length)), "poem count");
  assert.ok(said.includes(String(NEWS_ARTICLES.length)), "article count");
  assert.ok(said.includes(`${readMinutes(EXAMPLE_SHORT_READ.words)} minutes`), "example reading time");
});

test("every scene shows its own beats and the player is wired in", () => {
  const scenes = { welcome: "scenesA", login: "scenesA", library: "scenesA", reads: "scenesB", quiz: "scenesB", leaderboard: "scenesC", competition: "scenesC", wrap: "scenesC" } as const;
  const names: Record<string, string> = { welcome: "WelcomeScene", login: "LoginScene", library: "LibraryScene", reads: "ReadsScene", quiz: "QuizScene", leaderboard: "LeaderboardScene", competition: "CompetitionScene", wrap: "WrapScene" };
  const player = read("client/src/pages/present/StudentShow.tsx");
  for (const s of SCENES) {
    assert.ok(read(`client/src/pages/present/${scenes[s.id]}.tsx`).includes(`export function ${names[s.id]}`), `${s.id} scene exists`);
    assert.ok(player.includes(names[s.id]), `${s.id} is used by the player`);
  }
  for (const key of ["ArrowRight", "PageDown", "ArrowLeft", "PageUp", '" "', "Home", "End", "Escape"]) assert.ok(player.includes(key), `key ${key}`);
  assert.ok(player.includes("speechSynthesis") && player.includes("requestFullscreen"));
  assert.ok(player.includes("show-start-auto") && player.includes("show-start-clicker") && player.includes("show-caption"));
});

test("the show has its own address, hides the site popups, and is offered from the tutorials page", () => {
  const app = read("client/src/App.tsx");
  assert.ok(app.includes('path="/present"') && app.includes('path="/tutorial/present"'));
  const fs = app.match(/const FULLSCREEN_GAME_ROUTES = \[([^\]]*)\]/)![1];
  assert.ok(fs.includes('"/present"') && fs.includes('"/tutorial/present"'));
  assert.ok(app.indexOf('path="/tutorial/present"') < app.indexOf('path="/tutorial/student"'), "the show's route comes before the student tutorial's");
  const tut = read("client/src/pages/Tutorial.tsx");
  assert.ok(tut.includes('data-testid="tutorial-present-card"') && tut.includes('navigate("/tutorial/present")'));
});

test("the screens are labelled as demo copies with sample people", () => {
  assert.ok(read("client/src/pages/present/StudentShow.tsx").includes("Demo screens"));
  const kit = read("client/src/pages/present/kit.tsx");
  assert.ok(kit.includes("SAMPLE_READERS") && kit.includes("Made up"));
});
