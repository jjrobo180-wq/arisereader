import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SCENES, FLAT, TARGET_SECONDS, SITE, words, beatSeconds, totalSeconds, clock, firstBeatOf, flatten, spokenText } from "../shared/presentShow";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the show runs about five minutes by itself", () => {
  const total = totalSeconds();
  assert.ok(total >= TARGET_SECONDS - 20 && total <= TARGET_SECONDS + 10, `total ${total}s`);
  assert.equal(clock(total), `${Math.floor(Math.round(total) / 60)}:${String(Math.round(total) % 60).padStart(2, "0")}`);
});

test("it covers everything that was asked for, in the order a student meets it", () => {
  assert.deepEqual(SCENES.map((s) => s.id), ["welcome", "login", "library", "reads", "request", "quiz", "leaderboard", "prizes", "wrap"]);
  const said = SCENES.flatMap((s) => s.beats.map((b) => b.say)).join(" ").toLowerCase();
  const topics = ["student sign in", "student number", "new password", "ela teacher", "hundreds", "5-minute reads", "way more entertaining", "ways to read this book", "some books you can read right here", "request from teacher", "ask a parent", "public library", "create ai quiz", "reviews the quiz", "approves it", "appropriate", "proctor", "camera", "leave", "second time", "70 percent", "leaderboard", "november 20", "pizza party", "doordash", "airpods", "200 dollars", "raffle", "target", "roblox", "snacks", "dress-down", "c.g.m.s."];
  for (const topic of topics) assert.ok(said.includes(topic), `never mentions "${topic}"`);
  assert.ok(said.includes(SITE));
  assert.ok(!said.includes("create an account") && !said.includes("sign up"), "the accounts are already made, so nobody is told to create one");
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

test("it never says how many books there are, only that there are hundreds of choices", () => {
  const said = SCENES.filter((s) => s.id === "library" || s.id === "reads").flatMap((s) => s.beats.map((b) => b.say)).join(" ");
  assert.ok(/hundreds of (books|choices)/i.test(said));
  assert.ok(!/\b\d{2,}\s+(classic\s+)?(books|poems|articles|stories)/i.test(said), "no catalog counts are read out");
});

test("every scene shows its own beats and the player is wired in", () => {
  const scenes = { welcome: "scenesA", login: "scenesLogin", library: "scenesA", reads: "scenesB", request: "scenesRequest", quiz: "scenesB", leaderboard: "scenesC", prizes: "scenesC", wrap: "scenesC" } as const;
  const names: Record<string, string> = { welcome: "WelcomeScene", login: "LoginScene", library: "LibraryScene", reads: "ReadsScene", request: "RequestScene", quiz: "QuizScene", leaderboard: "LeaderboardScene", prizes: "PrizesScene", wrap: "WrapScene" };
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

test("the voice reads the words the way they are said, not the way they are written", () => {
  assert.equal(spokenText("A.R.I.S.E. Reader"), "Arise Reader");
  assert.equal(spokenText("Go to arisereader.com, click Student sign in"), "Go to arise reader dot com, click Student sign in");
  assert.match(spokenText("Welcome, C.G.M.S.! Who is your ELA teacher?"), /C G M S.*E L A teacher/);
  for (const b of FLAT) assert.ok(!/[A-Z]\.[A-Z]\./.test(spokenText(b.say)), `"${b.say.slice(0, 30)}" still has dotted letters`);
});

test("the request scene shows the site's real screens for a missing book and a missing quiz", () => {
  const req = read("client/src/pages/present/scenesRequest.tsx");
  for (const piece of ["Ways to read this book", "Request from Teacher", "Hoopla", "Create AI Quiz", "No books found", "Create a Quiz", "QuizGeneratingOverlay", "Libby"]) assert.ok(req.includes(piece), `missing ${piece}`);
  const real = read("client/src/components/BookAccessLinks.tsx") + read("client/src/pages/Library.tsx");
  for (const piece of ["Ways to read this book", "Request from Teacher", "Create AI Quiz", "No books found"]) assert.ok(real.includes(piece), `the site no longer says "${piece}"`);
  const lib = read("client/src/pages/present/scenesA.tsx");
  assert.ok(lib.includes("WaysButton") && lib.includes("QuickShelf"), "library cards carry the Ways button and the 5-Minute Reads shelf");
});
