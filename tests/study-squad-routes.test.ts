import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerStudyRoutes, STUDY_REWARDS, AI_PER_DAY } from "../server/study";
import { ROOM } from "../shared/study/game";
import { STARTER_SETS } from "../shared/study/starter";

// Everyone in these tests: two classmates and their teacher at school 1, a reader at another school, and accounts that aren't allowed in.
const USERS: Record<number, any> = {
  10: { id: 10, displayName: "Ada", role: "student", teacherId: 50, school_id: 1 },
  20: { id: 20, displayName: "Ben", role: "student", teacherId: 50, school_id: 1 },
  30: { id: 30, displayName: "Cy", role: "student", teacherId: 60, school_id: 2 },
  50: { id: 50, displayName: "Ms. Lee", role: "teacher", school_id: 1 },
  60: { id: 60, displayName: "Mr. Oz", role: "teacher", school_id: 2 },
  70: { id: 70, displayName: "Parent", role: "parent" },
  80: { id: 80, displayName: "Gazer", role: "student", is_eye_gaze_user: true },
  90: { id: 90, displayName: "Admin", role: "student", isAdmin: true },
};

async function setup(t: any, opts: { aiKey?: string; fetch?: typeof fetch; premium?: (user: any) => Promise<boolean> } = {}) {
  const clock = { now: 1_700_000_000_000 };
  t.mock.method(Date, "now", () => clock.now);
  const settings = new Map<string, string>([["avatar_world_10", JSON.stringify({ selectedCharacter: "alice" })]]);
  const app = express();
  app.use(express.json());
  const study = registerStudyRoutes(app, (req: any, res: any, next: any) => {
    const user = USERS[Number(req.headers["x-test-user"])];
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    req.user = user; next();
  }, {
    getSetting: async (k) => settings.get(k) ?? "",
    upsertSetting: async (k, v) => { settings.set(k, v); },
    aiKey: async () => opts.aiKey ?? "",
    fetch: opts.fetch,
    premium: opts.premium,
    random: () => 0.42,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/study`;
  const call = async (user: number, method: string, path: string, body?: any) => {
    const r = await fetch(base + path, { method, headers: { "x-test-user": String(user), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: (await r.json()) as any };
  };
  t.after(() => { study.stop(); server.close(); (server as any).closeAllConnections?.(); });
  return { call, clock, settings, study };
}
const cards = (n = 4, bad = -1) => Array.from({ length: n }, (_, i) => ({ kind: "card", prompt: "term " + i, answer: i === bad ? "oh shit" : "meaning " + i }));

test("only student and teacher accounts get into the study hall", async (t) => {
  const { call } = await setup(t);
  assert.equal((await call(70, "GET", "/bootstrap")).status, 403);
  assert.equal((await call(80, "GET", "/bootstrap")).status, 403);
  assert.equal((await call(999, "GET", "/bootstrap")).status, 401);
  const boot = await call(10, "GET", "/bootstrap");
  assert.equal(boot.status, 200);
  assert.deepEqual(boot.data.me, { id: 10, name: "Ada", characterId: "alice", teacher: false, student: true });
  assert.equal(boot.data.sets.length, STARTER_SETS.length);
  assert.equal(boot.data.sets[0].items, undefined, "the set list doesn't carry every question");
  assert.equal(boot.data.lounge.floor, 1); assert.equal(boot.data.lounge.tables.length, 8);
  assert.equal(boot.data.ai.available, false);
});

test("study sets: students keep theirs private, teachers share with their class, and teachers can review and remove", async (t) => {
  const { call } = await setup(t);
  const rude = await call(10, "POST", "/sets", { title: "Vocab", items: cards(4, 2) });
  assert.equal(rude.status, 400); assert.match(rude.data.message, /school-friendly/);
  const made = await call(10, "POST", "/sets", { title: "My vocab", subject: "Vocabulary", grade: "6-8", items: cards(5), shared: true });
  assert.equal(made.status, 201); assert.equal(made.data.set.mine, true); assert.equal(made.data.set.shared, false); assert.equal(made.data.set.ownerRole, "student");
  const id = made.data.set.id;
  assert.equal((await call(20, "GET", "/sets/" + id)).status, 404, "a classmate can't open it");
  assert.equal((await call(60, "GET", "/sets/" + id)).status, 404, "another teacher can't open it");
  assert.equal((await call(50, "GET", "/sets/" + id)).status, 200, "their own teacher can");
  const edited = await call(10, "PUT", "/sets/" + id, { title: "My vocab v2", items: cards(6) });
  assert.equal(edited.data.set.count, 6); assert.equal(edited.data.set.id, id);
  assert.equal((await call(20, "PUT", "/sets/" + id, { title: "Hijack", items: cards(4) })).status, 404);

  const shared = await call(50, "POST", "/sets", { title: "Chapter 4 review", items: cards(8), shared: true });
  const hidden = await call(50, "POST", "/sets", { title: "Not ready yet", items: cards(4), shared: false });
  assert.equal(shared.data.set.ownerRole, "teacher");
  const adaSees = (await call(10, "GET", "/sets")).data.sets.map((s: any) => s.title);
  assert.ok(adaSees.includes("Chapter 4 review")); assert.ok(!adaSees.includes("Not ready yet")); assert.ok(adaSees.includes("My vocab v2"));
  const cySees = (await call(30, "GET", "/sets")).data.sets.map((s: any) => s.title);
  assert.ok(!cySees.includes("Chapter 4 review"), "another school's reader doesn't see the class set");
  assert.equal((await call(10, "GET", "/sets/" + hidden.data.set.id)).status, 404);

  const klass = await call(50, "GET", "/class");
  assert.deepEqual(klass.data.sets.map((s: any) => [s.title, s.ownerName]), [["My vocab v2", "Ada"]]);
  assert.equal((await call(10, "GET", "/class")).status, 403);
  assert.equal((await call(60, "DELETE", "/class/sets/" + id)).status, 404, "only the student's own teacher can remove it");
  assert.equal((await call(50, "DELETE", "/class/sets/" + id)).status, 200);
  assert.equal((await call(10, "GET", "/sets/" + id)).status, 404);

  await call(50, "PUT", "/class/rules", { studentSets: false, studentAi: true });
  const blocked = await call(10, "POST", "/sets", { title: "Again", items: cards(4) });
  assert.equal(blocked.status, 403); assert.match(blocked.data.message, /turned off/);
  assert.equal((await call(30, "POST", "/sets", { title: "Other class", items: cards(4) })).status, 201, "the rule is per class");
  assert.equal((await call(10, "GET", "/bootstrap")).data.rules.studentSets, false);

  const admin = await call(90, "POST", "/sets", { title: "For everyone", items: cards(4) });
  assert.equal(admin.status, 201);
  assert.ok((await call(30, "GET", "/sets")).data.sets.some((s: any) => s.title === "For everyone"), "admin sets reach every reader");
});

test("tables: sit to open one, friends join, private tables need the code, visitors go home after", async (t) => {
  const { call } = await setup(t);
  await call(10, "GET", "/bootstrap"); await call(20, "GET", "/bootstrap"); await call(30, "GET", "/bootstrap");
  const opened = await call(10, "POST", "/tables/sit", { table: 2 });
  assert.equal(opened.status, 200); assert.equal(opened.data.room.phase, "lobby"); assert.equal(opened.data.room.hostId, 10);
  assert.ok(opened.data.room.set, "a starter set is on the table so it can start right away");
  const code = opened.data.room.code; assert.match(code, /^[A-Z2-9]{6}$/);
  const seen = await call(20, "POST", "/sync", { x: 3, z: 4, facing: 1 });
  assert.equal(seen.data.room, null);
  assert.equal(seen.data.lounge.tables[2].code, code); assert.equal(seen.data.lounge.tables[2].hostName, "Ada");
  const ada = seen.data.lounge.people.find((p: any) => p.userId === 10);
  assert.deepEqual([ada.table, ada.seat], [2, 0]);
  const ben = seen.data.lounge.people.find((p: any) => p.userId === 20);
  assert.deepEqual([ben.x, ben.z, ben.table], [3, 4, -1]);
  assert.equal((await call(20, "POST", "/sync", { x: 999, z: -999 })).data.lounge.people.find((p: any) => p.userId === 20).x, 19.1, "readers stay inside the walls");
  assert.equal((await call(30, "POST", "/sync", {})).data.lounge.tables[2], null, "another school has its own hall");

  const joined = await call(20, "POST", "/tables/sit", { table: 2 });
  assert.deepEqual(joined.data.room.players.map((p: any) => [p.id, p.seat, p.host]), [[10, 0, true], [20, 1, false]]);
  assert.equal((await call(20, "POST", `/tables/${code}/action`, { type: "settings", mode: "race" })).status, 409);
  assert.equal((await call(30, "POST", `/tables/${code}/action`, { type: "say", phrase: "Hi!" })).status, 404, "not at this table");

  await call(10, "POST", `/tables/${code}/action`, { type: "settings", publicTable: false });
  await call(20, "POST", `/tables/${code}/leave`);
  const lockedOut = await call(20, "POST", "/tables/sit", { table: 2 });
  assert.equal(lockedOut.status, 403); assert.match(lockedOut.data.message, /private/);
  assert.equal((await call(20, "POST", "/sync", {})).data.lounge.tables[2].code, "", "the code of a private table isn't shown to the room");
  assert.equal((await call(20, "POST", "/tables/sit", { code: "ZZZZZZ" })).status, 404);
  const visit = await call(30, "POST", "/tables/sit", { code: code.toLowerCase() });
  assert.equal(visit.status, 200); assert.equal(visit.data.lounge.tables[2].code, code, "a visitor sits in their friend's hall");
  await call(30, "POST", `/tables/${code}/leave`);
  assert.equal((await call(30, "POST", "/sync", {})).data.lounge.tables[2], null, "and goes back to their own hall afterwards");

  // sitting somewhere new leaves the old table; an empty table closes
  const moved = await call(10, "POST", "/tables/sit", { table: 5 });
  assert.notEqual(moved.data.room.code, code);
  assert.equal(moved.data.lounge.tables[2], null); assert.equal(moved.data.lounge.tables[5].code, moved.data.room.code);
});

test("a whole game over the network: answers stay hidden, coins and the weekly board are paid once", async (t) => {
  const { call, clock, settings } = await setup(t);
  await call(10, "GET", "/bootstrap"); await call(20, "GET", "/bootstrap");
  const code = (await call(10, "POST", "/tables/sit", { table: 0 })).data.room.code;
  await call(20, "POST", "/tables/sit", { table: 0 });
  const setId = "starter-water-cycle";
  const cfg = await call(10, "POST", `/tables/${code}/action`, { type: "settings", setId, mode: "lightning", questions: 5, seconds: 20 });
  assert.equal(cfg.data.room.set.title, "The Water Cycle");
  assert.equal((await call(10, "POST", `/tables/${code}/action`, { type: "settings", setId: "u999-nope" })).status, 404);
  const answers = new Map<string, string>((await call(10, "GET", "/sets/" + setId)).data.set.items.map((i: any) => [i.prompt, i.answer]));
  assert.equal((await call(20, "POST", `/tables/${code}/action`, { type: "start" })).status, 409);
  await call(10, "POST", `/tables/${code}/action`, { type: "start" });
  clock.now += ROOM.countdownMs;
  for (let i = 0; i < 5; i++) {
    const a = (await call(10, "POST", "/sync", {})).data.room, b = (await call(20, "POST", "/sync", {})).data.room;
    assert.equal(a.phase, "question"); assert.deepEqual(a.question, b.question);
    assert.ok(!JSON.stringify(a).includes("answerText"), "no answer in what the client is sent");
    const right = answers.get(a.question.prompt)!;
    const pick = (ok: boolean) => a.question.input === "type" ? { text: ok ? right : "zzz" } : { choice: ok ? a.question.options.indexOf(right) : (a.question.options.indexOf(right) + 1) % a.question.options.length };
    clock.now += 2000;
    await call(10, "POST", `/tables/${code}/action`, { type: "answer", questionId: a.question.id, ...pick(true) });
    const closed = await call(20, "POST", `/tables/${code}/action`, { type: "answer", questionId: a.question.id, ...pick(i < 2) });
    assert.equal(closed.data.room.phase, "reveal"); assert.equal(closed.data.room.reveal.answerText, right); assert.equal(closed.data.room.reveal.mine.correct, i < 2);
    clock.now += ROOM.revealMs;
  }
  const end = (await call(10, "POST", "/sync", {})).data.room;
  assert.equal(end.phase, "finished");
  assert.deepEqual(end.results.ranking.map((r: any) => [r.id, r.place, r.correct]), [[10, 1, 5], [20, 2, 2]]);
  assert.deepEqual(end.earned, { coins: STUDY_REWARDS.finish + STUDY_REWARDS.sharp + STUDY_REWARDS.win, capped: false });
  const bens = (await call(20, "POST", "/sync", {})).data.room;
  assert.deepEqual(bens.earned, { coins: STUDY_REWARDS.finish, capped: false }); assert.equal(bens.results.missed.length, 3);
  await call(10, "POST", "/sync", {}); await call(10, "POST", "/sync", {});
  assert.equal(settings.get("avatar_world_bonus_10"), "25", "paid once, however often the client asks");
  assert.equal(settings.get("avatar_world_bonus_20"), "10");
  const boot = (await call(20, "GET", "/bootstrap")).data;
  assert.deepEqual(boot.board.map((r: any) => [r.name, r.points, r.me]), [["Ada", 70, false], ["Ben", 20, true]]);
  assert.deepEqual(boot.stats, { games: 1, wins: 0, correct: 2, answered: 5, coinsToday: 10 });
  assert.equal(boot.room, code, "a reader who reloads is sent back to their table");

  // rematch, then the daily coin cap
  assert.equal((await call(20, "POST", `/tables/${code}/action`, { type: "again" })).status, 409);
  assert.equal((await call(10, "POST", `/tables/${code}/action`, { type: "again" })).data.room.phase, "lobby");
  settings.set("study_stats_10", JSON.stringify({ ...JSON.parse(settings.get("study_stats_10")!), coinsToday: STUDY_REWARDS.dailyCap - 4 }));
  await call(10, "POST", `/tables/${code}/action`, { type: "settings", mode: "race", questions: 5 });
  await call(10, "POST", `/tables/${code}/action`, { type: "start" });
  clock.now += ROOM.countdownMs;
  for (let i = 0; i < 12; i++) {
    const v = (await call(10, "POST", "/sync", {})).data.room;
    if (v.phase !== "racing" || !v.question) break;
    const right = answers.get(v.question.prompt)!;
    clock.now += 500;
    await call(10, "POST", `/tables/${code}/action`, { type: "answer", questionId: v.question.id, ...(v.question.input === "type" ? { text: right } : { choice: v.question.options.indexOf(right) }) });
  }
  clock.now += ROOM.raceSprintMs; await call(20, "POST", "/sync", {});
  const capped = (await call(10, "POST", "/sync", {})).data.room;
  assert.equal(capped.phase, "finished"); assert.deepEqual(capped.earned, { coins: 4, capped: true });
});

test("AI study sets: cleaned up, limited per day, and off when the teacher says so", async (t) => {
  let calls = 0, fail = false, sent: any = null;
  const fakeFetch: any = async (_url: string, init: any) => {
    calls++; sent = JSON.parse(init.body);
    if (fail) return { ok: false, status: 500, json: async () => ({}) };
    const items = [
      { kind: "choice", prompt: "What do plants need to make food?", answer: "Sunlight", wrong: ["Darkness", "Sand", "Plastic"], explain: "Photosynthesis uses light." },
      { kind: "choice", prompt: "Broken: no wrong answers", answer: "x", wrong: [] },
      { kind: "truefalse", prompt: "Roots take in water.", answer: "true" },
      { kind: "typed", prompt: "What gas do plants give off?", answer: "Oxygen", accept: ["O2"] },
      { kind: "card", prompt: "Stem", answer: "Holds the plant up" },
      { kind: "card", prompt: "Rude", answer: "what the fuck" },
      { kind: "card", prompt: "Leaf", answer: "Makes food for the plant" },
      { kind: "truefalse", prompt: "Roots take in water.", answer: "true" },
    ];
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "Here you go:\n```json\n" + JSON.stringify({ title: "Plant Parts", subject: "Science", items }) + "\n```" } }] }) };
  };
  const { call, settings } = await setup(t, { aiKey: "test-key", fetch: fakeFetch });
  assert.equal((await call(10, "GET", "/bootstrap")).data.ai.left, AI_PER_DAY.student);
  assert.equal((await call(10, "POST", "/generate", { topic: "x" })).status, 400);
  assert.equal((await call(10, "POST", "/generate", { topic: "something shitty" })).status, 400);
  assert.equal(calls, 0, "nothing rude is sent to the AI");
  const made = await call(10, "POST", "/generate", { topic: "Parts of a plant", grade: "3-5", count: 8, format: "mixed" });
  assert.equal(made.status, 200);
  assert.deepEqual(made.data.draft.items.map((i: any) => i.prompt), ["What do plants need to make food?", "Roots take in water.", "What gas do plants give off?", "Stem", "Leaf"]);
  assert.equal(made.data.draft.title, "Plant Parts"); assert.equal(made.data.draft.subject, "Science"); assert.equal(made.data.draft.madeWith, "ai"); assert.equal(made.data.left, AI_PER_DAY.student - 1);
  assert.match(sent.messages[1].content, /Parts of a plant/); assert.match(sent.messages[1].content, /3-5/);
  assert.equal((await call(10, "GET", "/sets")).data.sets.length, STARTER_SETS.length, "a draft isn't saved until the reader checks it and saves");
  const saved = await call(10, "POST", "/sets", made.data.draft);
  assert.equal(saved.status, 201); assert.equal(saved.data.set.madeWith, "ai");

  fail = true;
  assert.equal((await call(10, "POST", "/generate", { topic: "Volcanoes" })).status, 502);
  assert.equal((await call(10, "GET", "/bootstrap")).data.ai.left, AI_PER_DAY.student - 1, "a failed try doesn't use one up");
  fail = false;
  for (let i = 1; i < AI_PER_DAY.student; i++) assert.equal((await call(10, "POST", "/generate", { notes: "Plants have roots, stems and leaves. Roots take in water from the soil." })).status, 200);
  const over = await call(10, "POST", "/generate", { topic: "One more" });
  assert.equal(over.status, 429); assert.match(over.data.message, /today/);
  assert.equal((await call(50, "POST", "/generate", { topic: "Teacher topic" })).status, 200, "teachers have their own, larger limit");

  await call(50, "PUT", "/class/rules", { studentSets: true, studentAi: false });
  settings.forEach((_, k) => { if (k.startsWith("study_ai_20")) settings.delete(k); });
  const off = await call(20, "POST", "/generate", { topic: "Plants" });
  assert.equal(off.status, 403); assert.match(off.data.message, /turned off AI/);
});

test("AI study sets say so plainly when no AI key is set up", async (t) => {
  const { call } = await setup(t);
  const r = await call(10, "POST", "/generate", { topic: "Plants" });
  assert.equal(r.status, 400); assert.match(r.data.message, /aren't set up yet/);
  assert.equal((await call(10, "GET", "/bootstrap")).data.ai.left, AI_PER_DAY.student);
});

test("the hall opens another floor when one fills up", async (t) => {
  const { call } = await setup(t);
  for (let id = 1000; id < 1031; id++) USERS[id] = { id, displayName: "R" + id, role: "student", school_id: 9 };
  for (let id = 1000; id < 1030; id++) assert.equal((await call(id, "GET", "/bootstrap")).data.lounge.floor, 1);
  const next = await call(1030, "GET", "/bootstrap");
  assert.equal(next.data.lounge.floor, 2); assert.deepEqual(next.data.lounge.floors.map((f: any) => f.people), [30, 1, 0]);
  assert.equal((await call(1030, "POST", "/sync", { floor: 1 })).data.lounge.floor, 2, "a full floor can't be squeezed into");
  assert.equal((await call(1000, "POST", "/sync", { floor: 3 })).data.lounge.floor, 3);
  for (let id = 1000; id < 1031; id++) delete USERS[id];
});

test("AI study sets are a Premium extra for students; teachers keep them", async (t) => {
  let asked = 0;
  const { call } = await setup(t, {
    aiKey: "pplx-test", premium: async (u) => u.id !== 10,
    fetch: (async () => { asked++; return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }); }) as typeof fetch,
  });
  const boot = (await call(10, "GET", "/bootstrap")).data;
  assert.deepEqual([boot.ai.available, boot.ai.locked], [false, true]);
  const refused = await call(10, "POST", "/generate", { topic: "The water cycle" });
  assert.equal(refused.status, 402);
  assert.match(refused.data.message, /Premium/);
  assert.equal(asked, 0, "the AI is never called for a Free student");
  // a student without the lock, and a teacher, are not marked locked
  assert.equal((await call(20, "GET", "/bootstrap")).data.ai.locked, false);
  assert.equal((await call(50, "GET", "/bootstrap")).data.ai.locked, false);
});
