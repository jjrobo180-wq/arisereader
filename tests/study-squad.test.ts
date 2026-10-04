import { test } from "node:test";
import assert from "node:assert/strict";
import { StudyRoom, ROOM, STUDY_MODES, type StudyRoomView } from "../shared/study/game";
import { STARTER_SETS } from "../shared/study/starter";
import { blockedWord, normalizeSetDraft, parseStudyImport, typedAnswerMatches, StudySetError, SET_LIMITS, type StudySet, type StudyItem } from "../shared/study/sets";

// A small predictable random so every run plays out the same way.
function seeded(seed = 7) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const seat = (id: number) => ({ id, name: "Reader " + id, characterId: "robin-hood" });
const choiceSet: StudySet = {
  id: "t1", title: "Test set", subject: "Other", grade: "Any", description: "", ownerId: 1, ownerName: "T", ownerRole: "teacher", madeWith: "hand", shared: true, updatedAt: 0,
  items: Array.from({ length: 8 }, (_, i): StudyItem => ({ kind: "choice", prompt: "Q" + i, answer: "right" + i, wrong: ["w1-" + i, "w2-" + i, "w3-" + i] })),
};
function room(mode: any, ids = [10, 20], set: StudySet = choiceSet, patch: any = {}) {
  const r = new StudyRoom("ABC123", seat(ids[0]), { random: seeded(), now: 1000, table: 0, floor: "f" });
  for (const id of ids.slice(1)) r.add(seat(id), 1000);
  r.configure(ids[0], { mode, questions: 5, seconds: 20, ...patch }, 1000, set);
  return r;
}
/** The index of the right answer for the question a player is looking at (read from the set, like a reader who studied). */
function rightChoice(view: StudyRoomView, set: StudySet = choiceSet) {
  const item = set.items.find((i) => i.prompt === view.question!.prompt)!;
  return view.question!.options.indexOf(item.answer);
}
const wrongChoice = (view: StudyRoomView, set?: StudySet) => (rightChoice(view, set) + 1) % view.question!.options.length;

test("every starter set is valid and playable in every format", () => {
  assert.ok(STARTER_SETS.length >= 10);
  const kinds = new Set<string>();
  for (const set of STARTER_SETS) {
    const cleaned = normalizeSetDraft(set, { moderate: true });
    assert.deepEqual(cleaned.items, set.items, set.title + " changed when cleaned");
    set.items.forEach((i) => kinds.add(i.kind));
    assert.equal(new Set(set.items.map((i) => i.prompt)).size, set.items.length, set.title + " repeats a question");
  }
  assert.deepEqual([...kinds].sort(), ["card", "choice", "truefalse", "typed"]);
});

test("the right answer never reaches a player before the question closes", () => {
  const r = room("lightning");
  r.start(10, 1000); r.tick(1000 + ROOM.countdownMs);
  const before = r.snapshot(20, 5000);
  assert.equal(before.phase, "question");
  assert.equal(before.reveal, null);
  assert.ok(!JSON.stringify(before).includes('"correct":0') || before.players.every((p) => p.correct === 0));
  assert.equal((before.question as any).correct, undefined);
  assert.equal((before.question as any).answerText, undefined);
  r.answer(10, before.question!.id, { choice: rightChoice(before) }, 6000);
  const mid = r.snapshot(20, 6001);
  assert.equal(mid.players.find((p) => p.id === 10)!.answeredNow, true);
  assert.equal(mid.players.find((p) => p.id === 10)!.lastCorrect, null, "other players can't see if an answer was right yet");
  assert.equal(mid.players.find((p) => p.id === 10)!.score, 0, "points are held back until the question closes");
});

test("lightning round: faster right answers score more, wrong answers score nothing, streaks add up", () => {
  const r = room("lightning");
  r.start(10, 1000);
  assert.throws(() => r.start(10, 1001), /already started/);
  let now = 1000 + ROOM.countdownMs; r.tick(now);
  for (let i = 0; i < 5; i++) {
    const v = r.snapshot(10, now);
    assert.equal(v.phase, "question"); assert.deepEqual(v.round, { index: i, total: 5 });
    r.answer(10, v.question!.id, { choice: rightChoice(v) }, now + 1000);
    assert.throws(() => r.answer(10, v.question!.id, { choice: 0 }, now + 1100), /already answered/);
    r.touch(20, now + 8000); // still at the table, just slower
    r.answer(20, v.question!.id, { choice: i === 0 ? rightChoice(v) : wrongChoice(v) }, now + 9000);
    const rev = r.snapshot(20, now + 9001);
    assert.equal(rev.phase, "reveal", "closes as soon as everyone has answered");
    assert.equal(rev.reveal!.answerText, choiceSet.items.find((x) => x.prompt === v.question!.prompt)!.answer);
    assert.equal(rev.reveal!.mine!.correct, i === 0);
    now = now + 9001 + ROOM.revealMs; r.tick(now);
  }
  const end = r.snapshot(10, now);
  assert.equal(end.phase, "finished");
  const [first, second] = end.results!.ranking;
  assert.equal(first.id, 10); assert.equal(first.place, 1); assert.equal(first.correct, 5); assert.equal(first.bestStreak, 5);
  assert.equal(second.id, 20); assert.equal(second.correct, 1);
  assert.ok(first.score > 5 * 900, "fast answers earn the speed bonus");
  assert.equal(r.snapshot(20, now).results!.missed.length, 4, "each reader gets their own list of misses to review");
  assert.deepEqual(r.outcome().map((o) => [o.id, o.won]), [[10, true], [20, false]]);
});

test("a question closes at its deadline and unanswered counts as missed", () => {
  const r = room("lightning");
  r.start(10, 1000); let now = 1000 + ROOM.countdownMs; r.tick(now);
  const v = r.snapshot(10, now);
  r.answer(10, v.question!.id, { choice: rightChoice(v) }, now + 500);
  r.touch(20, now + 19_000); r.tick(now + 19_999);
  assert.equal(r.snapshot(10, now + 19_999).phase, "question");
  r.tick(now + 20_000);
  const rev = r.snapshot(20, now + 20_000);
  assert.equal(rev.phase, "reveal"); assert.equal(rev.reveal!.mine!.correct, false);
  assert.throws(() => r.answer(20, v.question!.id, { choice: 0 }, now + 20_001), /over/);
});

test("last one standing: hearts, elimination, mercy when everyone misses", () => {
  const r = room("survival", [10, 20, 30], choiceSet, { questions: 20 });
  r.start(10, 1000); let now = 1000 + ROOM.countdownMs; r.tick(now);
  const play = (answers: Record<number, boolean>) => {
    const v = r.snapshot(10, now);
    for (const p of v.players) if (!p.out) r.answer(p.id, v.question!.id, { choice: answers[p.id] ? rightChoice(v) : wrongChoice(v) }, now + 100);
    const rev = r.snapshot(10, now + 101); now += 101 + ROOM.revealMs; r.tick(now); return rev;
  };
  const mercy = play({ 10: false, 20: false, 30: false });
  assert.match(mercy.reveal!.note, /hearts are safe/);
  assert.deepEqual(mercy.players.map((p) => p.hearts), [3, 3, 3]);
  play({ 10: true, 20: false, 30: false }); play({ 10: true, 20: false, 30: true }); 
  const third = play({ 10: true, 20: false, 30: true });
  assert.equal(third.players.find((p) => p.id === 20)!.out, true);
  assert.throws(() => r.answer(20, r.snapshot(20, now).question!.id, { choice: 0 }, now + 5), /out this game/);
  play({ 10: true, 30: false }); const last = play({ 10: true, 30: false });
  assert.equal(last.players.find((p) => p.id === 30)!.out, true);
  const end = r.snapshot(10, now);
  assert.equal(end.phase, "finished", "ends as soon as one reader is left");
  assert.deepEqual(end.results!.ranking.map((x) => [x.id, x.place]), [[10, 1], [30, 2], [20, 3]]);
});

test("tug of war: balanced teams, the better team pulls, a clean sweep pulls twice, first to the line wins", () => {
  const r = room("tug", [10, 20, 30, 40], choiceSet, { questions: 20 });
  r.start(10, 1000); let now = 1000 + ROOM.countdownMs; r.tick(now);
  const start = r.snapshot(10, now);
  assert.deepEqual(start.players.map((p) => p.team).sort(), [0, 0, 1, 1]);
  const team0 = new Set(start.players.filter((p) => p.team === 0).map((p) => p.id));
  const play = (right: (id: number) => boolean) => {
    const v = r.snapshot(10, now);
    for (const p of v.players) r.answer(p.id, v.question!.id, { choice: right(p.id) ? rightChoice(v) : wrongChoice(v) }, now + 100);
    const rev = r.snapshot(10, now + 101); now += 101 + ROOM.revealMs; r.tick(now); return rev;
  };
  assert.equal(play(() => true).tug!.rope, 0, "same accuracy and same speed: no pull");
  assert.equal(play((id) => team0.has(id)).tug!.rope, -2, "all right against all wrong pulls twice");
  const one = [...team0][0];
  assert.equal(play((id) => id === one).tug!.rope, -3);
  const win = play((id) => team0.has(id));
  assert.equal(win.tug!.rope, -4);
  const end = r.snapshot(10, now);
  assert.equal(end.phase, "finished"); assert.equal(end.results!.winnerTeam, 0);
  assert.deepEqual(r.outcome().filter((o) => o.won).map((o) => o.id).sort(), [...team0].sort());
});

test("tug of war with one reader brings in a bot so there are two sides", () => {
  const r = room("tug", [10]);
  r.start(10, 1000);
  const v = r.snapshot(10, 1001);
  assert.equal(v.players.length, 2); assert.equal(v.players.filter((p) => p.bot).length, 1);
  assert.notEqual(v.players[0].team, v.players[1].team);
});

test("summit race: own pace, boosts on streaks, a miss freezes you, first to the top ends it", () => {
  const r = room("race", [10, 20], choiceSet, { questions: 5 });
  r.start(10, 1000); let now = 1000 + ROOM.countdownMs; r.tick(now);
  const a = r.snapshot(10, now), b = r.snapshot(20, now);
  assert.equal(a.phase, "racing"); assert.equal(a.race!.goal, 5); assert.equal(a.round, null);
  r.answer(20, b.question!.id, { choice: wrongChoice(b) }, now + 10);
  const frozen = r.snapshot(20, now + 11);
  assert.equal(frozen.race!.last!.correct, false); assert.ok(frozen.race!.frozenUntil > now);
  assert.throws(() => r.answer(20, frozen.question!.id, { choice: 0 }, now + 20), /Catch your breath/);
  let steps = 0, v = a;
  while (!v.players.find((p) => p.id === 10)!.finished) {
    r.answer(10, v.question!.id, { choice: rightChoice(v) }, (now += 50));
    v = r.snapshot(10, now); steps++;
    assert.ok(steps < 10);
  }
  assert.equal(steps, 4, "three in a row gives a two-step boost, so five steps take four answers");
  assert.equal(v.question, null);
  assert.throws(() => r.answer(10, 0, { choice: 0 }, now + 1), /summit/);
  assert.equal(r.snapshot(10, now).phase, "racing", "the others get a final sprint");
  r.touch(20, now + ROOM.raceSprintMs - 5); r.tick(now + ROOM.raceSprintMs - 1); assert.equal(r.phase, "racing");
  r.tick(now + ROOM.raceSprintMs);
  const end = r.snapshot(20, now + ROOM.raceSprintMs);
  assert.equal(end.phase, "finished");
  assert.deepEqual(end.results!.ranking.map((x) => x.id), [10, 20]);
});

test("typed and flashcard questions work in a game", () => {
  const set: StudySet = { ...choiceSet, items: [
    { kind: "typed", prompt: "Capital of France?", answer: "Paris", accept: [] },
    { kind: "card", prompt: "Infer", answer: "Use clues" }, { kind: "card", prompt: "Theme", answer: "The lesson" },
    { kind: "card", prompt: "Setting", answer: "Where and when" }, { kind: "truefalse", prompt: "Water is wet.", answer: "True" },
  ] };
  const r = room("lightning", [10], set, { questions: 5 });
  r.start(10, 1000); let now = 1000 + ROOM.countdownMs; r.tick(now);
  for (let i = 0; i < 5; i++) {
    const v = r.snapshot(10, now), item = set.items.find((x) => x.prompt === v.question!.prompt)!;
    if (item.kind === "typed") { assert.equal(v.question!.input, "type"); assert.throws(() => r.answer(10, v.question!.id, { text: "  " }, now + 5), /Type an answer/); r.answer(10, v.question!.id, { text: " paris. " }, now + 10); }
    else {
      assert.equal(v.question!.input, "pick");
      if (item.kind === "card") { assert.deepEqual(v.question!.options.slice().sort(), ["Paris", "The lesson", "Use clues", "Where and when"], "wrong answers are borrowed from the rest of the set"); }
      else assert.deepEqual(v.question!.options, ["True", "False"]);
      assert.throws(() => r.answer(10, v.question!.id, { choice: 9 }, now + 5), /Choose one/);
      r.answer(10, v.question!.id, { choice: v.question!.options.indexOf(item.answer) }, now + 10);
    }
    assert.equal(r.snapshot(10, now + 11).reveal!.mine!.correct, true, item.prompt);
    now += 11 + ROOM.revealMs; r.tick(now);
  }
  assert.equal(r.snapshot(10, now).results!.ranking[0].correct, 5);
});

test("study bots answer on their own and a whole game finishes without stalling", () => {
  for (const mode of STUDY_MODES.map((m) => m.id)) {
    const r = room(mode, [10], choiceSet, { bots: 3, questions: 5 });
    assert.equal(r.snapshot(10, 1000).players.length, 4);
    r.start(10, 1000);
    let now = 1000;
    for (let i = 0; i < 4000 && r.phase !== "finished"; i++) {
      now += 250; r.touch(10, now); r.tick(now);
      const v = r.snapshot(10, now), me = v.players.find((p) => p.id === 10)!;
      // in the race the reader takes their time, so the bots get to climb too
      if (v.question && !v.myAnswer && !me.out && !me.finished && (v.phase === "question" || (v.phase === "racing" && i % 24 === 0 && now >= v.race!.frozenUntil))) r.answer(10, v.question.id, { choice: rightChoice(v) }, now);
    }
    assert.equal(r.phase, "finished", mode + " finished");
    const view = r.snapshot(10, now);
    assert.equal(view.results!.ranking.length, 4);
    assert.ok(view.results!.ranking.filter((x) => x.bot).some((x) => x.answered > 0), mode + ": bots played");
    assert.equal(r.outcome().length, 1, "bots earn nothing");
  }
});

test("lobby rules: host-only settings, full tables, bots give up seats, host hand-off, rematch", () => {
  const r = room("lightning", [10, 20]);
  assert.throws(() => r.configure(20, { mode: "race" }, 1000), /Only the table host/);
  assert.throws(() => r.start(20, 1000), /Only the table host/);
  r.configure(10, { bots: 3 }, 1000);
  for (const id of [30, 40]) r.add(seat(id), 1000);
  assert.equal(r.players.length, 6);
  r.add(seat(50), 1000);
  assert.equal(r.players.length, 6); assert.equal(r.players.filter((p) => p.bot).length, 1, "a bot stands up for a reader");
  r.add(seat(60), 1000);
  assert.throws(() => r.add(seat(70), 1000), /full/);
  assert.equal(new Set(r.players.map((p) => p.seat)).size, 6, "everyone has their own chair");
  r.leave(10, 1000); assert.equal(r.hostId, 20);
  r.say(20, "Good luck!", 2000); assert.equal(r.snapshot(30, 2500).players.find((p) => p.id === 20)!.phrase, "Good luck!");
  assert.equal(r.snapshot(30, 2000 + ROOM.phraseMs + 1).players.find((p) => p.id === 20)!.phrase, null);
  assert.throws(() => r.say(20, "anything I type", 9000), /not available/);
  r.start(20, 9000);
  assert.throws(() => r.add(seat(80), 9001), /middle of a game/);
  assert.throws(() => r.again(20, 9002), /Finish this game/);
});

test("readers who walk away are not waited for, and empty lobbies clear out", () => {
  const r = room("lightning", [10, 20]);
  r.start(10, 1000); let now = 1000 + ROOM.countdownMs; r.tick(now);
  const v = r.snapshot(10, now);
  now += ROOM.awayMs + 1; r.touch(10, now);
  r.answer(10, v.question!.id, { choice: rightChoice(v) }, now);
  assert.equal(r.snapshot(10, now).phase, "reveal", "the away reader doesn't hold up the table");
  r.prune(now + ROOM.gameDropMs); assert.equal(r.member(20), false);
  const lobby = room("lightning", [10, 20]);
  lobby.touch(10, 1000 + ROOM.lobbyDropMs); lobby.prune(1001 + ROOM.lobbyDropMs);
  assert.deepEqual(lobby.humans.map((p) => p.id), [10]);
});

test("the word check blocks rude words and their disguises but leaves schoolwork alone", () => {
  for (const bad of ["this is shit", "F U C K", "sh1t happens", "fuuuck", "you b!tch", "a$$"]) assert.ok(blockedWord(bad), bad);
  for (const fine of ["Classic class assessment passage", "Nazi Germany invaded Poland in 1939", "The Negro Speaks of Rivers", "sex cells are called gametes", "Dickens and Dickinson", "a peacock in the cockpit", "U S A", "Scunthorpe, Essex", "3 + 4 = 7", "Moby Dick".replace("Dick", "Duck")]) assert.equal(blockedWord(fine), null, fine);
  const draft = { title: "My set", items: [1, 2, 3, 4].map((n) => ({ kind: "card", prompt: "term " + n, answer: n === 3 ? "what the fuck" : "meaning " + n })) };
  assert.throws(() => normalizeSetDraft(draft, { moderate: true }), /school-friendly. Check question 3/);
  assert.equal(normalizeSetDraft(draft, { moderate: false }).items.length, 4);
});

test("set rules: sizes, formats and tidy-up", () => {
  const item = { kind: "choice", prompt: "  What  is 2+2? ", answer: "4", wrong: ["3", "4", "5", "5", "", "6", "7"] };
  const ok = normalizeSetDraft({ title: " Math ", subject: "Math", grade: "3-5", items: [item, item, item, { kind: "truefalse", prompt: "Sky is blue", answer: "yes" }] }, { moderate: true });
  assert.deepEqual(ok.items[0], { kind: "choice", prompt: "What is 2+2?", answer: "4", wrong: ["3", "5", "6"] });
  assert.deepEqual(ok.items[3], { kind: "truefalse", prompt: "Sky is blue", answer: "True" });
  assert.equal(ok.subject, "Math"); assert.equal(ok.title, "Math");
  assert.throws(() => normalizeSetDraft({ title: "Hi", items: [] }, { moderate: true }), StudySetError);
  assert.throws(() => normalizeSetDraft({ title: "Three", items: [item, item, item] }, { moderate: true }), /at least 4/);
  assert.throws(() => normalizeSetDraft({ title: "Big", items: Array(SET_LIMITS.maxItems + 1).fill(item) }, { moderate: true }), /up to 40/);
  assert.throws(() => normalizeSetDraft({ title: "No wrong", items: [item, item, item, { kind: "choice", prompt: "Q", answer: "A", wrong: ["a"] }] }, { moderate: true }), /Question 4 needs at least one wrong answer/);
  assert.throws(() => normalizeSetDraft({ title: "Cards", items: Array(4).fill({ kind: "card", prompt: "a", answer: "same" }) }, { moderate: true }), /two different answers/);
});

test("importing: vocabulary lists, spreadsheets, CSV, and Q/A notes", () => {
  const vocab = parseStudyImport("Term\tDefinition\nInfer\tUse clues to figure it out\nTheme - The lesson of a story\nSetting: where and when\n1. Plot = what happens\n\njust a stray line");
  assert.deepEqual(vocab.items.map((i) => [i.kind, i.prompt]), [["card", "Infer"], ["card", "Theme"], ["card", "Setting"], ["card", "Plot"]]);
  assert.equal(vocab.skipped, 1);
  const csv = parseStudyImport('question,answer,wrong1,wrong2\n"What is 2+2?",4,3,5\n"Largest planet, by far",Jupiter,Mars\nThe sun is a star,TRUE');
  assert.deepEqual(csv.items, [
    { kind: "choice", prompt: "What is 2+2?", answer: "4", wrong: ["3", "5"] },
    { kind: "choice", prompt: "Largest planet, by far", answer: "Jupiter", wrong: ["Mars"] },
    { kind: "truefalse", prompt: "The sun is a star", answer: "True" },
  ]);
  const qa = parseStudyImport("Q: What gas do plants take in?\nA: Carbon dioxide\nQ: Plants make their own food.\nA: true\nQuestion: orphan");
  assert.deepEqual(qa.items.map((i) => i.kind), ["typed", "truefalse"]); assert.equal(qa.skipped, 1);
  assert.equal(parseStudyImport(Array.from({ length: 60 }, (_, i) => `t${i} | d${i}`).join("\n")).items.length, SET_LIMITS.maxItems);
});

test("typed answers forgive capitals, punctuation, 'the' and small spelling slips, but not numbers", () => {
  assert.ok(typedAnswerMatches("  PARIS! ", ["Paris"]));
  assert.ok(typedAnswerMatches("the nile", ["Nile"]));
  assert.ok(typedAnswerMatches("photosynthsis", ["Photosynthesis"]));
  assert.ok(typedAnswerMatches("mitocondria", ["Mitochondria"]));
  assert.ok(typedAnswerMatches("three", ["3"])); assert.ok(typedAnswerMatches("1,000", ["1000"])); assert.ok(typedAnswerMatches("50%", ["50%"]));
  assert.ok(!typedAnswerMatches("43", ["42"])); assert.ok(!typedAnswerMatches("cat", ["car"])); assert.ok(!typedAnswerMatches("", ["x"]));
  assert.ok(!typedAnswerMatches("mars", ["Paris"]));
  assert.ok(typedAnswerMatches("four", ["4", "Four"]));
});
