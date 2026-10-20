// Run with: npx tsx --test tests/arise-english.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryEnglishStore, registerAriseEnglishRoutes, type EnglishPerson } from "../server/ariseEnglish";
import {
  LEVELS, MAX_LEVEL, POINTS, UNITS, WORDS, blanked, checkAnswer, checkSpeech, isCognate, makeLesson, makeReview, nextProgress, pointsFor, starsFor,
  streakOf, unitOpen, unlockedLevel, voiceTexts, wordById, type UnitProgress,
} from "../shared/ariseEnglish";

const seeded = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const people: Record<number, EnglishPerson & { isAdmin?: boolean }> = {
  1: { id: 1, role: "teacher", displayName: "Ms. Chen", username: "chen", teacherId: null, schoolId: 10, archived: false },
  2: { id: 2, role: "teacher", displayName: "Mr. Delgado", username: "delgado", teacherId: null, schoolId: 10, archived: false },
  3: { id: 3, role: "teacher", displayName: "Ms. Far", username: "far", teacherId: null, schoolId: 20, archived: false },
  9: { id: 9, role: "admin", displayName: "Admin", username: "admin", teacherId: null, schoolId: null, archived: false },
  11: { id: 11, role: "student", displayName: "Mateo Ramirez", username: "mateo", teacherId: 1, schoolId: 10, archived: false },
  12: { id: 12, role: "student", displayName: "Aria Lopez", username: "aria", teacherId: 1, schoolId: 10, archived: false },
  13: { id: 13, role: "student", displayName: "Kenji Lee", username: "kenji", teacherId: 2, schoolId: 10, archived: false },
  14: { id: 14, role: "student", displayName: "Other School", username: "other", teacherId: 3, schoolId: 20, archived: false },
  21: { id: 21, role: "parent", displayName: "Luis Ramirez", username: "luis", teacherId: null, schoolId: null, archived: false },
};

function setup(opts: { heard?: string } = {}) {
  const routes: Record<string, Function> = {};
  const add = (method: string) => (path: string, ...handlers: Function[]) => { routes[`${method} ${path}`] = handlers[handlers.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE"), use: () => {} };
  let clock = Date.parse("2026-10-20T16:00:00Z");
  const store = createMemoryEnglishStore(() => clock);
  const notes: number[] = [];
  let changed = 0;
  registerAriseEnglishRoutes(app, (_req: any, _res: any, next: any) => next(), {
    store, now: () => clock, random: seeded(42),
    directory: {
      user: async (id) => people[id] ?? null,
      students: async () => Object.values(people).filter((p) => p.role === "student"),
      gradeOf: async () => "4",
      notify: async (id) => { notes.push(id); },
      pointsChanged: () => { changed++; },
    },
    speech: { say: async (text) => Buffer.from(`mp3:${text}`), hear: async () => opts.heard ?? "" },
  });
  async function call(method: string, path: string, userId: number, body: any = {}, params: Record<string, string> = {}, query: Record<string, string> = {}) {
    const p = people[userId];
    const req: any = { user: { id: p.id, displayName: p.displayName, username: p.username, role: p.role === "admin" ? "teacher" : p.role, isAdmin: p.role === "admin", teacherId: p.teacherId, school_id: p.schoolId }, body, params, query, headers: { "content-type": "audio/webm" } };
    let status = 200, json: any = null, sent: any = null;
    const res: any = { set() { return res; }, type() { return res; }, status(c: number) { status = c; return res; }, json(v: any) { json = v; return res; }, send(v: any) { sent = v; return res; } };
    const handler = routes[`${method} ${path}`];
    assert.ok(handler, `no route ${method} ${path}`);
    await handler(req, res);
    return { status, json, sent };
  }
  return { call, store, notes, tick: (ms: number) => { clock += ms; }, changed: () => changed };
}

/** Plays a whole session: right answers except the indexes in `miss`. */
async function play(t: ReturnType<typeof setup>, userId: number, body: any, miss: number[] = []) {
  const start = await t.call("POST", "/api/english/sessions", userId, body);
  assert.equal(start.status, 200, JSON.stringify(start.json));
  const s = await t.store.getSession(start.json.id);
  for (const [i, it] of s!.items.entries()) {
    if (it.kind === "speak") { await t.call("POST", "/api/english/sessions/:id/skip/:index", userId, {}, { id: s!.id, index: String(i) }); continue; }
    const answer = miss.includes(i) ? "nope" : it.answer;
    const r = await t.call("POST", "/api/english/sessions/:id/answer", userId, { index: i, answer, ms: 1500 }, { id: s!.id });
    assert.equal(r.json.correct, !miss.includes(i));
  }
  t.tick(4 * 60_000);
  const done = await t.call("POST", "/api/english/sessions/:id/finish", userId, {}, { id: s!.id });
  assert.equal(done.status, 200, JSON.stringify(done.json));
  return { start: start.json, done: done.json, session: s! };
}

test("the curriculum is complete and consistent", () => {
  assert.equal(LEVELS.length, 6);
  assert.ok(UNITS.length >= 40 && WORDS.length >= 320);
  const ids = new Set(WORDS.map((w) => w.id));
  assert.equal(ids.size, WORDS.length, "word ids are unique");
  for (const u of UNITS) {
    assert.ok(u.words.length >= 8, u.id);
    assert.equal(new Set(u.words.map((w) => w.e)).size, u.words.length, `pictures differ within ${u.id}`);
  }
  for (const w of WORDS) {
    assert.ok(w.w && w.e && w.s && w.es, w.id);
    assert.ok(blanked(w), `the sentence for ${w.id} contains its word`);
    if (w.level >= 4) assert.ok(w.m, `${w.id} has a meaning`);
  }
  assert.ok(isCognate(wordById("science.planet")!));
  assert.ok(!isCognate(wordById("animals.dog")!));
});

test("lessons: every word twice, choices are distinct, answers check", () => {
  const rng = seeded(7);
  for (const u of UNITS) {
    const items = makeLesson(u, rng);
    const scored = items.filter((i) => i.kind !== "speak");
    assert.equal(scored.length, u.words.length * 2, u.id);
    for (const w of u.words) assert.equal(scored.filter((i) => i.wordId === w.id).length, 2, w.id);
    for (const it of items) {
      if (it.choices) {
        assert.ok(it.choices.length >= 3, `${u.id} ${it.kind}`);
        assert.equal(new Set(it.choices.map((c) => c.id)).size, it.choices.length);
        assert.ok(it.choices.some((c) => c.id === it.answer));
        assert.equal(new Set(it.choices.map((c) => c.e || c.text)).size, it.choices.length, `${u.id} ${it.kind} choices look different`);
      }
      assert.ok(checkAnswer(it, it.answer));
      if (it.tiles) assert.ok(checkAnswer(it, it.answer.toUpperCase()), "spelling ignores case");
    }
  }
  // Level 1 starts every word with listening (no reading needed first).
  const first = makeLesson(LEVELS[0].units[0], seeded(3));
  assert.ok(first.slice(0, 8).every((i) => i.kind === "listen"));
});

test("speech check is kind to accents but not to wrong words", () => {
  assert.equal(checkSpeech("apple", "Apple.").correct, true);
  assert.equal(checkSpeech("apple", "I said apple").correct, true);
  assert.equal(checkSpeech("elephant", "elefant").correct, true);
  assert.equal(checkSpeech("dog", "cat").correct, false);
  assert.equal(checkSpeech("I don't understand.", "I dont understand").correct, true);
  assert.equal(checkSpeech("one", "1").correct, true);
  assert.equal(checkSpeech("May I go to the bathroom?", "may I go bathroom").close, true);
});

test("stars, points, spaced repetition and streaks", () => {
  assert.equal(starsFor(16, 16), 3); assert.equal(starsFor(12, 16), 2); assert.equal(starsFor(10, 16), 1); assert.equal(starsFor(9, 16), 0);
  assert.equal(pointsFor({ kind: "lesson", score: 16, total: 16, spokenRight: 2, before: null }).points, POINTS.firstPass + 2 * POINTS.perNewStar + 2);
  assert.equal(pointsFor({ kind: "lesson", score: 16, total: 16, spokenRight: 0, before: { stars: 3 } as UnitProgress }).points, POINTS.replay);
  assert.equal(pointsFor({ kind: "lesson", score: 16, total: 16, spokenRight: 0, before: { stars: 1 } as UnitProgress }).points, 2 * POINTS.perNewStar);
  assert.equal(pointsFor({ kind: "lesson", score: 2, total: 16, spokenRight: 0, before: null }).points, 0);
  const now = Date.parse("2026-10-20T16:00:00Z");
  let p = nextProgress(null, true, 0, 2, now, "x");
  assert.equal(p.box, 2); assert.equal(Date.parse(p.due_at!) - now, 2 * 86400_000);
  p = nextProgress(p, true, 0, 1, now, "x"); assert.equal(p.box, 3);
  p = nextProgress(p, false, 1, 0, now, "x"); assert.equal(p.box, 1);
  assert.equal(streakOf(["2026-10-18", "2026-10-19", "2026-10-20"], now), 3);
  assert.equal(streakOf(["2026-10-18", "2026-10-19"], now), 2, "today not played yet still keeps the streak");
  assert.equal(streakOf(["2026-10-17"], now), 0);
  // Unlocking: one unit after another; a teacher's starting level opens the levels below.
  const none = new Map<string, UnitProgress>();
  assert.equal(unitOpen(LEVELS[0].units[0], 1, none), true);
  assert.equal(unitOpen(LEVELS[0].units[1], 1, none), false);
  assert.equal(unitOpen(LEVELS[2].units[0], 3, none), true);
  assert.equal(unitOpen(LEVELS[1].units[5], 3, none), true);
  assert.equal(unitOpen(LEVELS[3].units[0], 3, none), false);
  const all1 = new Map(LEVELS[0].units.map((u) => [u.id, { unit_id: u.id, stars: 1 } as UnitProgress]));
  assert.equal(unlockedLevel(1, all1), 2);
  assert.equal(unlockedLevel(9, none), MAX_LEVEL);
});

test("only students a teacher turned on can play; teachers manage their school", async () => {
  const t = setup();
  assert.deepEqual((await t.call("GET", "/api/english/me", 11)).json, { enabled: false, staff: false });
  assert.equal((await t.call("POST", "/api/english/sessions", 11, { unitId: "hello" })).status, 403);
  // Another school's teacher can't see or turn on this student; a teacher at the school can, even if it isn't their class.
  assert.equal((await t.call("POST", "/api/english/staff/learners/:id", 3, { enabled: true }, { id: "11" })).status, 404);
  assert.equal((await t.call("POST", "/api/english/staff/learners/:id", 2, { enabled: true, startLevel: 1, homeLanguage: "es" }, { id: "11" })).status, 200);
  assert.deepEqual(t.notes, [11]);
  assert.equal((await t.call("POST", "/api/english/staff/learners/:id", 9, { enabled: true, homeLanguage: "vi" }, { id: "14" })).status, 200, "the admin can turn it on for anyone");
  assert.equal((await t.call("POST", "/api/english/staff/learners/:id", 1, { enabled: true }, { id: "21" })).status, 404, "parents aren't students");
  const me = (await t.call("GET", "/api/english/me", 11)).json;
  assert.equal(me.enabled, true); assert.equal(me.help, true); assert.equal(me.level, 1); assert.deepEqual(me.open, ["hello"]);
  // Staff lists: Ms. Chen sees Mateo (her class); Mr. Delgado sees him too (same school); Ms. Far doesn't; the admin sees both learners.
  const chen = (await t.call("GET", "/api/english/staff/overview", 1)).json;
  assert.deepEqual(chen.learners.map((l: any) => l.id), [11]);
  assert.equal(chen.learners[0].mine, true);
  assert.deepEqual((await t.call("GET", "/api/english/staff/overview", 2)).json.learners.map((l: any) => l.id), [11]);
  assert.deepEqual((await t.call("GET", "/api/english/staff/overview", 3)).json.learners.map((l: any) => l.id), [14]);
  assert.deepEqual((await t.call("GET", "/api/english/staff/overview", 9)).json.learners.map((l: any) => l.id).sort(), [11, 14]);
  assert.equal((await t.call("GET", "/api/english/staff/overview", 11)).status, 403, "students can't see reports");
  const search = (await t.call("GET", "/api/english/staff/students", 1, {}, {}, { q: "" })).json.students;
  assert.deepEqual(search.map((s: any) => s.id).sort(), [11, 12, 13]);
  assert.equal(search.find((s: any) => s.id === 11).enabled, true);
});

test("a lesson: first tries count, points go to the leaderboard, words are scheduled", async () => {
  const t = setup();
  await t.call("POST", "/api/english/staff/learners/:id", 1, { enabled: true }, { id: "11" });
  const { start, done, session } = await play(t, 11, { unitId: "hello" }, [0]);
  assert.ok(start.items.every((i: any) => !("answer" in i)), "no answer key on the page");
  assert.equal(start.words.length, 8);
  assert.equal(done.total, 16); assert.equal(done.score, 15); assert.equal(done.stars, 3);
  assert.equal(done.points, POINTS.firstPass + 2 * POINTS.perNewStar);
  assert.deepEqual(t.store.awards.map((a) => [a.student_id, a.points, a.reason]), [[11, done.points, "English Explorer: Hello, Friends"]]);
  assert.equal(t.changed(), 1);
  assert.equal(done.learned.length, 8);
  assert.equal(done.missed.length, 1);
  assert.equal(done.next, "colors");
  const words = await t.store.words(11);
  const missedWord = session.items[0].wordId;
  assert.equal(words.find((w) => w.word_id === missedWord)!.box, 1);
  assert.ok(words.filter((w) => w.word_id !== missedWord).every((w) => w.box === 2));
  // A second answer to a question can't change the score; a finished lesson can't be finished again.
  assert.equal((await t.call("POST", "/api/english/sessions/:id/finish", 11, {}, { id: session.id })).status, 409);
  const me = (await t.call("GET", "/api/english/me", 11)).json;
  assert.equal(me.units.hello.stars, 3); assert.ok(me.open.includes("colors")); assert.equal(me.streak, 1); assert.equal(me.today.points, done.points);
  // Replaying earns a little; the daily cap holds.
  const again = await play(t, 11, { unitId: "hello" });
  assert.equal(again.done.points, POINTS.replay);
  let total = done.points + again.done.points;
  for (let i = 0; i < 20; i++) total += (await play(t, 11, { unitId: "hello" })).done.points;
  assert.equal(total, POINTS.dailyCap);
  // Locked lessons stay locked.
  assert.equal((await t.call("POST", "/api/english/sessions", 11, { unitId: "family" })).status, 403);
});

test("first try only: changing an answer after a miss doesn't help", async () => {
  const t = setup();
  await t.call("POST", "/api/english/staff/learners/:id", 1, { enabled: true }, { id: "11" });
  const start = await t.call("POST", "/api/english/sessions", 11, { unitId: "hello" });
  const s = (await t.store.getSession(start.json.id))!;
  const i = s.items.findIndex((x) => x.kind !== "speak");
  assert.equal((await t.call("POST", "/api/english/sessions/:id/answer", 11, { index: i, answer: "wrong" }, { id: s.id })).json.correct, false);
  const second = await t.call("POST", "/api/english/sessions/:id/answer", 11, { index: i, answer: s.items[i].answer }, { id: s.id });
  assert.equal(second.json.correct, true); assert.equal(second.json.firstTry, false);
  const done = (await t.call("POST", "/api/english/sessions/:id/finish", 11, {}, { id: s.id })).json;
  assert.equal(done.score, 0, "unanswered and second tries don't count");
  assert.equal(done.points, 0);
  assert.equal((await t.call("POST", "/api/english/sessions/:id/answer", 12, { index: i, answer: "x" }, { id: s.id })).status, 404, "someone else's lesson");
});

test("speaking, level up, review and the teacher's report", async () => {
  const t = setup({ heard: "Hello!" });
  await t.call("POST", "/api/english/staff/learners/:id", 1, { enabled: true, homeLanguage: "es" }, { id: "12" });
  // Say it: the recording is checked against the word.
  const start = await t.call("POST", "/api/english/sessions", 12, { unitId: "hello" });
  const s = (await t.store.getSession(start.json.id))!;
  const helloAt = s.items.findIndex((x) => x.kind === "speak");
  s.items[helloAt] = { ...s.items[helloAt], wordId: "hello.hello", answer: "hello", say: "hello", prompt: "hello" };
  await t.store.saveSession(s);
  const heard = await t.call("POST", "/api/english/sessions/:id/speak/:index", 12, Buffer.alloc(800), { id: s.id, index: String(helloAt) });
  assert.equal(heard.json.correct, true); assert.equal(heard.json.heard, "Hello!");
  for (const [i, it] of s.items.entries()) if (it.kind !== "speak") await t.call("POST", "/api/english/sessions/:id/answer", 12, { index: i, answer: it.answer }, { id: s.id });
  const done = (await t.call("POST", "/api/english/sessions/:id/finish", 12, {}, { id: s.id })).json;
  assert.equal(done.spoken.right, 1);
  assert.equal(done.points, POINTS.firstPass + 2 * POINTS.perNewStar + 1);
  // Finish the rest of level 1 (a new day each time, so the daily cap doesn't get in the way) → level 2 and the bonus.
  let last: any = null;
  for (const u of LEVELS[0].units.slice(1)) { t.tick(86400_000); last = (await play(t, 12, { unitId: u.id })).done; }
  assert.equal(last.levelUp, 2);
  assert.ok(t.store.awards.some((a) => a.student_id === 12 && a.reason === "English Explorer: reached level 2"));
  const me = (await t.call("GET", "/api/english/me", 12)).json;
  assert.equal(me.level, 2); assert.ok(me.open.includes("clothes"));
  // Review: words come back once they're due.
  t.tick(3 * 86400_000);
  assert.ok((await t.call("GET", "/api/english/me", 12)).json.due > 0);
  const review = await play(t, 12, { review: true });
  assert.equal(review.start.kind, "review");
  assert.ok(review.done.points >= POINTS.review);
  // The teacher's report.
  const detail = (await t.call("GET", "/api/english/staff/learners/:id", 2, {}, { id: "12" })).json;
  assert.equal(detail.summary.level, 2);
  assert.equal(detail.summary.unitsDoneAll, LEVELS[0].units.length);
  assert.ok(detail.summary.wordsMastered + detail.summary.wordsLearning >= 60);
  assert.equal(detail.skills.length, 4);
  assert.ok(detail.skills.find((x: any) => x.skill === "listening").total > 0);
  assert.equal(detail.speaking.right, 1);
  assert.ok(detail.sessions.length >= 9);
  assert.equal(detail.days.length, 14);
  assert.equal((await t.call("GET", "/api/english/staff/learners/:id", 3, {}, { id: "12" })).status, 404, "another school can't see it");
  const csv = (await t.call("GET", "/api/english/staff/export.csv", 1)).sent as string;
  assert.match(csv.split("\n")[1], /^Aria Lopez,aria,Ms\. Chen,4,yes,Spanish,2,/);
});

test("staff can try it without saving; the voice only says what's in the program", async () => {
  const t = setup();
  const me = (await t.call("GET", "/api/english/me", 1)).json;
  assert.equal(me.preview, true); assert.equal(me.level, MAX_LEVEL);
  const { done } = await play(t, 1, { unitId: "idioms" });
  assert.equal(done.preview, true); assert.equal(done.points, 0);
  assert.equal(t.store.awards.length, 0);
  assert.equal((await t.store.words(1)).length, 0);
  assert.equal((await t.call("POST", "/api/english/voice", 1, { text: "apple" })).status, 200);
  assert.equal((await t.call("POST", "/api/english/voice", 1, { text: "manzana", lang: "es" })).status, 200);
  assert.equal((await t.call("POST", "/api/english/voice", 1, { text: "Say something rude" })).status, 400);
  assert.equal((await t.call("POST", "/api/english/voice", 13, { text: "apple" })).status, 403, "a student who isn't turned on");
  assert.ok(voiceTexts().en.has("Listen. Tap the picture."));
  // Turning it off stops the student.
  await t.call("POST", "/api/english/staff/learners/:id", 1, { enabled: true }, { id: "11" });
  await t.call("POST", "/api/english/staff/learners/:id", 1, { enabled: false }, { id: "11" });
  assert.equal((await t.call("GET", "/api/english/me", 11)).json.enabled, false);
  assert.equal(makeReview([wordById("animals.dog")!], seeded(1)).length, 2);
});
