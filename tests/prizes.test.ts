// Prizes from parents, teachers and schools: the rules, then the real routes over HTTP.
// Run with: npx tsx --test tests/prizes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerPrizeRoutes } from "../server/prizes";
import { registerPlanRoutes } from "../server/plans";
import { clubDay } from "../shared/clubPlay";
import {
  PRIZE_LIMITS, PrizeError, addDays, normalizePrizeDraft, parsePrizeId, prizeId, prizeShown, quizzesToward, validDay, viewPrize, prettyDay,
  type Prize,
} from "../shared/prizes";

const NOW = Date.parse("2026-11-15T18:00:00Z");
const TODAY = "2026-11-15";
const DAY = 86_400_000;
const LATE = "2026-10-03T15:00:00Z";

// ─── The rules ───────────────────────────────────────────────────────────────

test("a prize needs a name and a way to win it", () => {
  const ok = normalizePrizeDraft({ title: "  Pizza   night ", how: "Finish your book", endsOn: "2026-11-30" }, "parent", TODAY);
  assert.deepEqual(ok, { scope: "family", title: "Pizza night", how: "Finish your book", quizGoal: 0, endsOn: "2026-11-30", studentIds: null });

  assert.throws(() => normalizePrizeDraft({ title: "", how: "x" }, "parent", TODAY), PrizeError);
  assert.throws(() => normalizePrizeDraft({ title: "Pizza night" }, "parent", TODAY), /how to win/i);
  // a number of quizzes is enough on its own
  assert.equal(normalizePrizeDraft({ title: "Pizza night", quizGoal: "5" }, "parent", TODAY).quizGoal, 5);
  for (const bad of [-1, 2.5, 201, "lots"]) {
    assert.throws(() => normalizePrizeDraft({ title: "Pizza night", quizGoal: bad }, "parent", TODAY), PrizeError, String(bad));
  }
  // long text is cut, not refused
  const long = normalizePrizeDraft({ title: "a".repeat(300), how: "b".repeat(900) }, "teacher", TODAY);
  assert.deepEqual([long.title.length, long.how.length], [PRIZE_LIMITS.title, PRIZE_LIMITS.how]);
});

test("children read the prize, so rude words are refused", () => {
  assert.throws(() => normalizePrizeDraft({ title: "Pizza night", how: "don't be a shit" }, "parent", TODAY), /different words/);
  assert.throws(() => normalizePrizeDraft({ title: "sh1t prize", how: "read" }, "teacher", TODAY), /different words/);
  // invisible characters can't be used to split a word up, and they are not kept in what children read
  assert.throws(() => normalizePrizeDraft({ title: "s\u200Bhit prize", how: "read" }, "teacher", TODAY), /different words/);
  assert.throws(() => normalizePrizeDraft({ title: "Prize", how: "s\u00ADh\uFEFFit" }, "parent", TODAY), /different words/);
  assert.equal(normalizePrizeDraft({ title: "Piz\u200Bza\u2060 night\n\tat home", how: "Read" }, "parent", TODAY).title, "Pizza night at home");
});

test("the last day has to be a real day, today or later, within about a year", () => {
  const draft = (endsOn: unknown) => normalizePrizeDraft({ title: "Pizza night", how: "Read", endsOn }, "parent", TODAY);
  assert.equal(draft(TODAY).endsOn, TODAY);
  assert.equal(draft("").endsOn, null);
  assert.throws(() => draft("2026-11-14"), /past/);
  assert.throws(() => draft("2026-02-31"), /calendar/);
  assert.throws(() => draft("next friday"), /calendar/);
  assert.throws(() => draft("2028-06-01"), /within the next year/);
  assert.equal(validDay("2026-02-28"), true);
  assert.equal(validDay("2026-02-30"), false);
  assert.equal(addDays("2026-12-25", 14), "2027-01-08");
  assert.equal(prettyDay("2026-10-31"), "Oct 31");
  assert.equal(prettyDay(null), "");
});

test("a parent's prize is a family prize; a teacher picks class or school", () => {
  assert.equal(normalizePrizeDraft({ title: "Movie", how: "Read", scope: "school" }, "parent", TODAY).scope, "family");
  assert.equal(normalizePrizeDraft({ title: "Movie", how: "Read" }, "teacher", TODAY).scope, "class");
  assert.equal(normalizePrizeDraft({ title: "Movie", how: "Read", scope: "school" }, "teacher", TODAY).scope, "school");
  assert.equal(normalizePrizeDraft({ title: "Movie", how: "Read", scope: "galaxy" }, "teacher", TODAY).scope, "class");
  // children are only picked for a family prize
  assert.deepEqual(normalizePrizeDraft({ title: "Movie", how: "Read", studentIds: [10, "11", 10] }, "parent", TODAY).studentIds, [10, 11]);
  assert.equal(normalizePrizeDraft({ title: "Movie", how: "Read", studentIds: [10] }, "teacher", TODAY).studentIds, null);
  assert.throws(() => normalizePrizeDraft({ title: "Movie", how: "Read", studentIds: ["x", -4] }, "parent", TODAY), /which child/);
});

test("a prize id says which list it is in", () => {
  assert.deepEqual(parsePrizeId(prizeId("family", 80, "abc123xyz")), { scope: "family", ownerId: 80 });
  assert.deepEqual(parsePrizeId(prizeId("class", 50, "abc123xyz")), { scope: "class", ownerId: 50 });
  assert.deepEqual(parsePrizeId(prizeId("school", 3, "abc123xyz")), { scope: "school", ownerId: 3 });
  for (const bad of ["", "x80-abc123", "f0-abc123", "f80", "f80-../../x", "f80-ABC123", null]) assert.equal(parsePrizeId(bad), null, String(bad));
});

const prize = (over: Partial<Prize> = {}): Prize => ({
  id: "f80-abc123xyz", scope: "family", ownerId: 80, byId: 80, byName: "Dana", title: "Pizza night", how: "Read", quizGoal: 0,
  endsOn: null, studentIds: null, createdAt: new Date(NOW - 5 * DAY).toISOString(), won: null, ...over,
});

test("only quizzes passed after the prize was added, and by its last day, count", () => {
  const p = prize({ quizGoal: 3, endsOn: "2026-11-14" });
  const times = [NOW - 9 * DAY, NOW - 4 * DAY, NOW - 2 * DAY, NOW, NaN];
  // 9 days ago is before the prize; today is after its last day (Nov 14)
  assert.equal(quizzesToward(p, times, clubDay), 2);
  assert.equal(quizzesToward(prize({ quizGoal: 3 }), times, clubDay), 3, "no last day");
  assert.equal(quizzesToward(prize({ createdAt: "not a date" }), times, clubDay), 0);
});

test("what the reader sees: open, reached, ended, yours, or won by someone else", () => {
  const state = (over: Partial<Prize>, passed: number | null = null) => viewPrize(prize(over), 10, "Dana", passed, TODAY).state;
  assert.equal(state({}), "open");
  assert.equal(state({ quizGoal: 3 }, 2), "open");
  assert.equal(state({ quizGoal: 3 }, 3), "reached");
  assert.equal(state({ endsOn: "2026-11-14" }), "ended");
  assert.equal(state({ endsOn: "2026-11-14", quizGoal: 3 }, 5), "reached", "they made it in time: it stays reached until it is given");
  assert.equal(state({ won: { studentId: 10, name: "Ada", at: new Date(NOW).toISOString() } }), "yours");
  assert.equal(state({ won: { studentId: null, name: "The whole class", at: new Date(NOW).toISOString() } }), "yours");
  assert.equal(state({ won: { studentId: 11, name: "Ben", at: new Date(NOW).toISOString() } }), "won");
  const v = viewPrize(prize({ quizGoal: 3 }), 10, "Dana", 7, TODAY);
  assert.deepEqual([v.passed, v.from, v.winner], [7, "Dana", null]);
  assert.equal(viewPrize(prize(), 10, "Dana", 7, TODAY).passed, null, "no quiz goal, no count");
});

test("a finished prize drops off the reader's page after two weeks", () => {
  assert.equal(prizeShown(prize(), TODAY), true);
  assert.equal(prizeShown(prize({ endsOn: "2026-11-01" }), TODAY), true);
  assert.equal(prizeShown(prize({ endsOn: "2026-10-31" }), TODAY), false);
  assert.equal(prizeShown(prize({ won: { studentId: 10, name: "Ada", at: "2026-11-01T12:00:00Z" } }), TODAY), true);
  assert.equal(prizeShown(prize({ won: { studentId: 10, name: "Ada", at: "2026-10-20T12:00:00Z" } }), TODAY), false);
});

// ─── The routes ──────────────────────────────────────────────────────────────

const USERS: Record<number, any> = {
  1: { id: 1, displayName: "Admin", role: "student", isAdmin: true, school_id: 3 },
  50: { id: 50, displayName: "Ms. Rivera", role: "teacher", school_id: 3, createdAt: LATE },
  51: { id: 51, displayName: "Mr. Okafor", role: "teacher", school_id: 3, createdAt: LATE },
  52: { id: 52, displayName: "Ms. Solo", role: "teacher", school_id: null, createdAt: LATE },
  53: { id: 53, displayName: "Mr. Waiting", role: "teacher", school_id: 3, accountApproved: false, createdAt: LATE },
  10: { id: 10, displayName: "Ada", role: "student", teacherId: 50, school_id: 3 },
  11: { id: 11, displayName: "Ben", role: "student", teacherId: 50, school_id: 3 },
  12: { id: 12, displayName: "Cy", role: "student", teacherId: 51, school_id: 3 },
  13: { id: 13, displayName: "Di", role: "student" },
  14: { id: 14, displayName: "Eli", role: "student", teacherId: 50, school_id: 3, approvedByTeacher: false },
  15: { id: 15, displayName: "Flo", role: "student", school_id: 3 },
  16: { id: 16, displayName: "Gio", role: "student", teacherId: 52, school_id: 3 },
  80: { id: 80, displayName: "Dana", role: "parent" },
  81: { id: 81, displayName: "Omar", role: "parent" },
  82: { id: 82, displayName: "Pat", role: "parent", accountApproved: false },
  83: { id: 83, displayName: "Quinn", role: "parent" },
  84: { id: 84, displayName: "Rae", role: "parent" },
  17: { id: 17, displayName: "Hal", role: "student" },
};
// Ben (11) has two parents; Rae also has Hal
const LINKS: Record<number, number[]> = { 80: [10, 13], 81: [11], 82: [12], 83: [], 84: [11, 17] };

async function setup(t: any, opts: { plans?: boolean } = {}) {
  const clock = { now: NOW };
  const settings = new Map<string, string>();
  const passed = new Map<number, number[]>();
  const told: Array<{ id: number; text: string }> = [];
  const reads: number[] = [];
  const db = { down: false };
  const app = express();
  app.use(express.json());
  const auth = (req: any, res: any, next: any) => {
    const user = USERS[Number(String(req.headers.authorization || "").replace("Bearer ", ""))];
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    req.user = user; next();
  };
  if (opts.plans) {
    // the real plan check, with plan rules on and nobody paying
    settings.set("plans_enforced", "1");
    registerPlanRoutes(app, auth, (_req: any, _res: any, next: any) => next(), {
      getSetting: async (k) => settings.get(k) ?? "", upsertSetting: async (k, v) => { settings.set(k, v); },
      userForToken: async (token) => USERS[Number(token)] ?? null, getUser: async (id) => USERS[id] ?? null,
      countTeacherStudents: async () => 30, countSchoolStudents: async () => 240, schoolName: async () => "Cedar Grove Middle",
      now: () => clock.now,
    });
  }
  const inClass = (teacherId: number) => Object.values(USERS).filter((u) => u.role === "student" && !u.isAdmin && u.teacherId === teacherId && u.approvedByTeacher !== false);
  registerPrizeRoutes(app, auth, {
    // like the site's own storage: a failed read comes back as ""
    getSetting: async (k) => (db.down ? "" : settings.get(k) ?? ""),
    upsertSetting: async (k, v) => { settings.set(k, v); },
    readSetting: async (k) => { if (db.down) throw new Error("database unreachable"); return settings.get(k) ?? ""; },
    parentStudentIds: async (id) => LINKS[id] ?? [],
    studentParentIds: async (id) => Object.entries(LINKS).filter(([, kids]) => kids.includes(id)).map(([p]) => Number(p)),
    getUser: async (id) => USERS[id] ?? null,
    teacherStudents: async (id) => inClass(id).map((u) => ({ id: u.id, name: u.displayName })),
    schoolStudents: async (id) => Object.values(USERS).filter((u) => u.role === "student" && !u.isAdmin && USERS[u.teacherId]?.school_id === id && u.approvedByTeacher !== false).map((u) => ({ id: u.id, name: u.displayName })),
    schoolName: async (id) => (id === 3 ? "Cedar Grove Middle" : ""),
    passedQuizTimes: async (id) => { reads.push(id); return passed.get(id) ?? []; },
    notify: async (id, text) => { told.push({ id, text }); },
    now: () => clock.now,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = async (user: number | null, method: string, path: string, body?: any) => {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };
  const add = async (user: number, body: any) => {
    const res = await call(user, "POST", "/api/prizes", body);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.prize as Prize;
  };
  const sees = async (user: number, query = "") => ((await call(user, "GET", `/api/prizes${query}`)).body.prizes as any[]).map((p) => p.title);
  return { call, add, sees, settings, passed, told, reads, clock, db };
}

test("a parent adds a prize and only their own child sees it", async (t) => {
  const { call, add, sees } = await setup(t);
  const p = await add(80, { title: "Pizza night", how: "Finish Hatchet and pass the quiz" });
  assert.deepEqual([p.scope, p.ownerId, p.byName, p.studentIds, p.won], ["family", 80, "Dana", null, null]);

  const ada = (await call(10, "GET", "/api/prizes")).body.prizes;
  assert.equal(ada.length, 1);
  assert.deepEqual([ada[0].title, ada[0].from, ada[0].state, ada[0].scope], ["Pizza night", "Dana", "open", "family"]);
  assert.equal(ada[0].ownerId, undefined, "the reader's view carries no ids of other people");
  assert.deepEqual(await sees(13), ["Pizza night"], "Dana's other child");
  assert.deepEqual(await sees(11), [], "someone else's child");

  const mine = (await call(80, "GET", "/api/prizes/mine")).body;
  assert.equal(mine.role, "parent");
  assert.deepEqual(mine.children, [{ id: 10, name: "Ada" }, { id: 13, name: "Di" }]);
  assert.deepEqual([mine.prizes[0].state, mine.prizes[0].forWho], ["open", "Ada and Di"]);
});

test("a family prize can be for one child, and never for someone else's", async (t) => {
  const { call, add, sees } = await setup(t);
  await add(80, { title: "Bike ride", how: "Read every night this week", studentIds: [13] });
  assert.deepEqual(await sees(13), ["Bike ride"]);
  assert.deepEqual(await sees(10), []);
  assert.equal((await call(80, "GET", "/api/prizes/mine")).body.prizes[0].forWho, "Di");

  const other = await call(80, "POST", "/api/prizes", { title: "Bike ride", how: "Read", studentIds: [11] });
  assert.deepEqual([other.status, other.body.message], [403, "That child isn't connected to your account."]);
  // every child picked is the same as "all my children"
  assert.equal((await add(80, { title: "Zoo trip", how: "Read", studentIds: [10, 13] })).studentIds, null);

  const none = await call(83, "POST", "/api/prizes", { title: "Zoo trip", how: "Read" });
  assert.equal(none.status, 409);
  assert.match(none.body.message, /Connect your child first/);
});

test("students can't add prizes, and a grown-up has to be approved first", async (t) => {
  const { call } = await setup(t);
  for (const who of [10, 82, 53]) {
    const res = await call(who, "POST", "/api/prizes", { title: "Candy", how: "Just because" });
    assert.equal(res.status, 403, String(who));
    assert.equal((await call(who, "GET", "/api/prizes/mine")).status, 403, String(who));
  }
  assert.equal((await call(null, "GET", "/api/prizes")).status, 401);
});

test("a teacher's class prize goes to the students they approved", async (t) => {
  const { call, add, sees } = await setup(t);
  const p = await add(50, { title: "Homework pass", how: "Top of the class board on Friday", endsOn: "2026-11-20" });
  assert.deepEqual([p.scope, p.ownerId, p.byName], ["class", 50, "Ms. Rivera"]);
  assert.deepEqual(await sees(10), ["Homework pass"]);
  assert.deepEqual(await sees(11), ["Homework pass"]);
  assert.deepEqual(await sees(12), [], "another teacher's class");
  assert.deepEqual(await sees(14), [], "still waiting for the teacher's approval");
  assert.deepEqual(await sees(13), [], "no class");
  const mine = (await call(50, "GET", "/api/prizes/mine")).body;
  assert.deepEqual([mine.role, mine.prizes[0].forWho, mine.school.name], ["teacher", "your class", "Cedar Grove Middle"]);
});

test("a school prize reaches every class in the school, and only that school's classes", async (t) => {
  const { call, add, sees } = await setup(t);
  const p = await add(50, { scope: "school", title: "Lunch with the principal", how: "Most quizzes passed in November" });
  assert.deepEqual([p.scope, p.ownerId, p.byId], ["school", 3, 50]);
  for (const student of [10, 11, 12]) assert.deepEqual(await sees(student), ["Lunch with the principal"], String(student));
  assert.deepEqual(await sees(15), [], "picked the school at sign-up but no teacher has approved them");
  assert.deepEqual(await sees(14), [], "waiting for approval");
  assert.deepEqual(await sees(16), [], "says they go to the school, but their teacher isn't at it");
  assert.deepEqual(await sees(13), []);
  assert.equal((await call(12, "GET", "/api/prizes")).body.prizes[0].from, "Ms. Rivera at Cedar Grove Middle");
  // the teacher can give it to a student in any class at the school, and to nobody outside it
  const people = (await call(50, "GET", `/api/prizes/${p.id}/people`)).body.people.map((x: any) => x.name);
  assert.deepEqual(people, ["Ada", "Ben", "Cy"]);
  assert.equal((await call(50, "POST", `/api/prizes/${p.id}/give`, { studentId: 16 })).status, 400);

  // a teacher with no school can only make class prizes
  const solo = await call(52, "POST", "/api/prizes", { scope: "school", title: "Stickers", how: "Read" });
  assert.equal(solo.status, 409);

  // another teacher at the school sees it is there but can't change it; the admin can
  assert.deepEqual((await call(51, "GET", "/api/prizes/mine")).body.prizes, []);
  assert.equal((await call(51, "DELETE", `/api/prizes/${p.id}`)).status, 404);
  assert.equal((await call(1, "DELETE", `/api/prizes/${p.id}`)).status, 200);
  assert.deepEqual(await sees(12), []);
});

test("a parent sees everything their child can win, and nothing about other children", async (t) => {
  const { call, add, sees } = await setup(t);
  await add(80, { title: "Pizza night", how: "Read" });
  await add(50, { title: "Homework pass", how: "Read" });
  assert.deepEqual((await sees(80, "?studentId=10")).sort(), ["Homework pass", "Pizza night"]);
  assert.deepEqual(await sees(80, "?studentId=13"), ["Pizza night"]);
  assert.deepEqual(await sees(80, "?studentId=11"), [], "not their child");
  assert.deepEqual(await sees(82, "?studentId=12"), [], "a parent who hasn't been approved yet");
  assert.deepEqual(await sees(80), []);
  assert.deepEqual((await call(50, "GET", "/api/prizes")).body.prizes, [], "a teacher's list is /mine");
});

test("a quiz goal counts the quizzes each child passes after the prize was added", async (t) => {
  const { call, add, passed, clock, reads } = await setup(t);
  await add(80, { title: "New book", quizGoal: 3 });
  passed.set(10, [NOW - 30 * DAY, NOW + 1 * DAY, NOW + 2 * DAY]);
  passed.set(13, [NOW + 1 * DAY, NOW + 2 * DAY, NOW + 2 * DAY + 5]);
  clock.now = NOW + 3 * DAY;

  const ada = (await call(10, "GET", "/api/prizes")).body.prizes[0];
  assert.deepEqual([ada.passed, ada.quizGoal, ada.state], [2, 3, "open"]);
  const di = (await call(13, "GET", "/api/prizes")).body.prizes[0];
  assert.deepEqual([di.passed, di.state], [3, "reached"]);

  const mine = (await call(80, "GET", "/api/prizes/mine")).body.prizes[0];
  assert.deepEqual(mine.progress, [{ id: 10, name: "Ada", passed: 2 }, { id: 13, name: "Di", passed: 3 }]);

  // a prize with no quiz goal never reads anyone's quiz history
  const quiet = await setup(t);
  await quiet.add(80, { title: "Pizza night", how: "Read" });
  await quiet.call(10, "GET", "/api/prizes");
  await quiet.call(80, "GET", "/api/prizes/mine");
  assert.deepEqual(quiet.reads, []);
  assert.ok(reads.length > 0);
});

test("the teacher sees who is closest, then gives the prize to one student", async (t) => {
  const { call, add, passed, told, clock } = await setup(t);
  const p = await add(50, { title: "Homework pass", quizGoal: 2 });
  passed.set(11, [NOW + DAY, NOW + 2 * DAY]);
  passed.set(10, [NOW + DAY]);
  clock.now = NOW + 3 * DAY;

  const people = (await call(50, "GET", `/api/prizes/${p.id}/people`)).body;
  assert.deepEqual(people.people, [{ id: 11, name: "Ben", passed: 2 }, { id: 10, name: "Ada", passed: 1 }]);
  assert.equal((await call(51, "GET", `/api/prizes/${p.id}/people`)).status, 404, "another teacher");
  assert.equal((await call(80, "GET", `/api/prizes/${p.id}/people`)).status, 404, "a parent");

  const wrong = await call(50, "POST", `/api/prizes/${p.id}/give`, { studentId: 12 });
  assert.deepEqual([wrong.status, wrong.body.message], [400, "Pick a student from your class."]);

  const given = await call(50, "POST", `/api/prizes/${p.id}/give`, { studentId: 11 });
  assert.equal(given.status, 200);
  assert.deepEqual([given.body.prizes[0].state, given.body.prizes[0].won.name], ["given", "Ben"]);
  assert.deepEqual(told.map((m) => m.id), [11]);
  assert.match(told[0].text, /You won a prize: “Homework pass”, from Ms\. Rivera/);

  const ben = (await call(11, "GET", "/api/prizes")).body.prizes[0];
  assert.deepEqual([ben.state, ben.winner], ["yours", "Ben"]);
  const ada = (await call(10, "GET", "/api/prizes")).body.prizes[0];
  assert.deepEqual([ada.state, ada.winner], ["won", "Ben"]);

  // taking it back puts it up again
  const undone = await call(50, "POST", `/api/prizes/${p.id}/give`, { undo: true });
  assert.deepEqual([undone.body.prizes[0].state, undone.body.prizes[0].won], ["open", null]);
  assert.equal((await call(10, "GET", "/api/prizes")).body.prizes[0].state, "open");
});

test("a prize can go to everyone it was for", async (t) => {
  const { call, add, told } = await setup(t);
  const klass = await add(50, { title: "Popcorn party", how: "The class reads 100 books" });
  await call(50, "POST", `/api/prizes/${klass.id}/give`, { everyone: true });
  for (const student of [10, 11]) {
    const v = (await call(student, "GET", "/api/prizes")).body.prizes[0];
    assert.deepEqual([v.state, v.winner], ["yours", "The whole class"]);
  }
  assert.equal(told.length, 0, "a whole class is told by the teacher, not by a message each");

  const family = await add(80, { title: "Zoo trip", how: "Read every night" });
  // each child is told when a parent puts up a prize for them...
  assert.deepEqual(told.map((m) => [m.id, m.text]), [10, 13].map((id) => [id, "Dana put up a prize for you: “Zoo trip”. See it on your rewards page."]));
  told.length = 0;
  // ...and again when they win it
  await call(80, "POST", `/api/prizes/${family.id}/give`, { everyone: true });
  assert.deepEqual(told.map((m) => m.id).sort(), [10, 13]);
  told.length = 0;
  assert.equal((await call(80, "GET", "/api/prizes/mine")).body.prizes[0].won.name, "Ada and Di");

  // a prize for one child tells only that child
  const one = await add(80, { title: "Bike ride", how: "Read", studentIds: [13] });
  assert.deepEqual(told.map((m) => m.id), [13]);
  // a parent can only give to their own child
  assert.equal((await call(80, "POST", `/api/prizes/${one.id}/give`, { studentId: 11 })).status, 400);
  assert.equal((await call(81, "POST", `/api/prizes/${one.id}/give`, { studentId: 11 })).status, 404, "another parent");
});

test("only the person who added a prize can remove it", async (t) => {
  const { call, add, sees } = await setup(t);
  const family = await add(80, { title: "Pizza night", how: "Read" });
  const klass = await add(50, { title: "Homework pass", how: "Read" });
  for (const [who, id] of [[81, family.id], [50, family.id], [10, family.id], [51, klass.id], [80, klass.id]] as const) {
    const res = await call(who, "DELETE", `/api/prizes/${id}`);
    assert.ok(res.status === 404 || res.status === 403, `${who} ${id} → ${res.status}`);
  }
  assert.equal((await call(80, "DELETE", "/api/prizes/f80-doesnotexist")).status, 404);
  assert.equal((await call(80, "DELETE", "/api/prizes/..%2F..%2Fsecrets")).status, 404);
  assert.deepEqual((await sees(10)).sort(), ["Homework pass", "Pizza night"]);

  const gone = await call(80, "DELETE", `/api/prizes/${family.id}`);
  assert.deepEqual([gone.status, gone.body.prizes], [200, []]);
  assert.deepEqual(await sees(10), ["Homework pass"]);
});

test("there is a cap on how many prizes are up at once", async (t) => {
  const { call, add, sees, clock } = await setup(t);
  for (let i = 0; i < PRIZE_LIMITS.perFamily; i++) await add(80, { title: `Prize ${i + 1}`, how: "Read" });
  const over = await call(80, "POST", "/api/prizes", { title: "One more", how: "Read" });
  assert.equal(over.status, 409);
  assert.match(over.body.message, /most prizes/);

  for (let i = 0; i < PRIZE_LIMITS.perTeacherAtSchool; i++) await add(50, { scope: "school", title: `School prize ${i + 1}`, how: "Read" });
  assert.equal((await call(50, "POST", "/api/prizes", { scope: "school", title: "One more", how: "Read" })).status, 409);
  // another teacher at the school still has room
  await add(51, { scope: "school", title: "From room 12", how: "Read" });

  // giving a prize out doesn't free its place: the reader still sees it for two weeks.
  // Otherwise one person could fill everyone's page by adding and giving in a loop.
  const first = (await call(80, "GET", "/api/prizes/mine")).body.prizes[0];
  await call(80, "POST", `/api/prizes/${first.id}/give`, { everyone: true });
  assert.equal((await call(80, "POST", "/api/prizes", { title: "One more", how: "Read" })).status, 409);
  assert.equal((await sees(13)).length, PRIZE_LIMITS.perFamily);
  // removing one does
  await call(80, "DELETE", `/api/prizes/${first.id}`);
  await add(80, { title: "One more", how: "Read" });
  // and so does time: two weeks after it was given, a prize is off the page and its place is free
  const second = (await call(80, "GET", "/api/prizes/mine")).body.prizes[1];
  await call(80, "POST", `/api/prizes/${second.id}/give`, { everyone: true });
  clock.now = NOW + 20 * DAY;
  await add(80, { title: "Later", how: "Read" });
  // now the page is full again, so that old prize can't be taken back and put up a thirteenth time
  const back = await call(80, "POST", `/api/prizes/${second.id}/give`, { undo: true });
  assert.equal(back.status, 409);
  assert.equal((await sees(13)).length, PRIZE_LIMITS.perFamily);
});

test("a database hiccup never wipes a list of prizes", async (t) => {
  const { call, add, settings, db } = await setup(t);
  for (const title of ["One", "Two", "Three"]) await add(50, { scope: "school", title, how: "Read" });
  const p = (await call(50, "GET", "/api/prizes/mine")).body.prizes[0];
  db.down = true;
  // nothing can be saved while the list can't be read...
  assert.equal((await call(51, "POST", "/api/prizes", { scope: "school", title: "Four", how: "Read" })).status, 500);
  assert.equal((await call(50, "POST", `/api/prizes/${p.id}/give`, { everyone: true })).status, 500);
  assert.equal((await call(50, "DELETE", `/api/prizes/${p.id}`)).status, 500);
  // ...readers just see nothing for a moment...
  assert.deepEqual((await call(10, "GET", "/api/prizes")).body, { prizes: [] });
  db.down = false;
  // ...and all three are still there afterwards
  assert.equal(JSON.parse(settings.get("prizes_school_3")!).length, 3);
  await add(51, { scope: "school", title: "Four", how: "Read" });
  assert.equal(JSON.parse(settings.get("prizes_school_3")!).length, 4);
});

test("taking a prize back never makes it disappear, however old it is", async (t) => {
  const { call, add, clock } = await setup(t);
  const p = await add(80, { title: "Pizza night", how: "Read", endsOn: "2026-11-20" });
  clock.now = Date.parse("2027-03-25T18:00:00Z");
  await call(80, "POST", `/api/prizes/${p.id}/give`, { studentId: 10 });
  const back = await call(80, "POST", `/api/prizes/${p.id}/give`, { undo: true });
  assert.deepEqual(back.body.prizes.map((x: any) => [x.title, x.state, x.won]), [["Pizza night", "ended", null]]);
});

test("the day a prize was given is the site's day, not the day in London", async (t) => {
  const { call, add, sees, settings, clock } = await setup(t);
  const p = await add(80, { title: "Pizza night", how: "Read" });
  // 9pm on Nov 20 in Denver is already Nov 21 in UTC
  clock.now = Date.parse("2026-11-21T04:00:00Z");
  await call(80, "POST", `/api/prizes/${p.id}/give`, { studentId: 10 });
  assert.equal(JSON.parse(settings.get("prizes_parent_80")!)[0].won.day, "2026-11-20");
  clock.now = Date.parse("2026-12-04T20:00:00Z"); // Dec 4: the fourteenth day after
  assert.deepEqual(await sees(10), ["Pizza night"]);
  clock.now = Date.parse("2026-12-05T20:00:00Z");
  assert.deepEqual(await sees(10), []);
});

test("a class prize can only go to a student, and each parent sees only their own family prizes", async (t) => {
  const { call, add, sees } = await setup(t);
  // a parent account carries its child's teacher, but the roster the routes are handed is students only
  const klass = await add(50, { title: "Homework pass", how: "Read" });
  const names = (await call(50, "GET", `/api/prizes/${klass.id}/people`)).body.people.map((x: any) => x.name);
  assert.deepEqual(names, ["Ada", "Ben"]);
  assert.equal((await call(50, "POST", `/api/prizes/${klass.id}/give`, { studentId: 81 })).status, 400);

  // Ben has two parents. Rae puts up a prize for both her children and gives it to Hal.
  const rae = await add(84, { title: "Arcade trip", how: "Read" });
  await call(84, "POST", `/api/prizes/${rae.id}/give`, { studentId: 17 });
  // Ben sees his own family's prize...
  assert.deepEqual((await sees(11)).sort(), ["Arcade trip", "Homework pass"]);
  // ...but Ben's other parent is shown the school side only, not Rae's prizes or her other child's name
  const omar = (await call(81, "GET", "/api/prizes?studentId=11")).body.prizes;
  assert.deepEqual(omar.map((x: any) => x.title), ["Homework pass"]);
  assert.ok(!JSON.stringify(omar).includes("Hal"));
});

test("prizes leave the reader's page two weeks after they end, and the list is cleaned up later", async (t) => {
  const { call, add, sees, settings, clock } = await setup(t);
  await add(80, { title: "Pizza night", how: "Read", endsOn: "2026-11-20" });
  clock.now = Date.parse("2026-11-25T18:00:00Z");
  assert.equal((await call(10, "GET", "/api/prizes")).body.prizes[0].state, "ended");
  assert.equal((await call(80, "GET", "/api/prizes/mine")).body.prizes[0].state, "ended");
  clock.now = Date.parse("2026-12-10T18:00:00Z");
  assert.deepEqual(await sees(10), []);
  assert.equal((await call(80, "GET", "/api/prizes/mine")).body.prizes.length, 1, "the parent still has it");
  // months later, the next save clears it out
  clock.now = Date.parse("2027-04-15T18:00:00Z");
  await add(80, { title: "Spring prize", how: "Read" });
  assert.deepEqual(JSON.parse(settings.get("prizes_parent_80")!).map((p: Prize) => p.title), ["Spring prize"]);
});

test("a damaged list is read as empty instead of breaking the page", async (t) => {
  const { call, settings } = await setup(t);
  settings.set("prizes_parent_80", "{not json");
  settings.set("prizes_teacher_50", JSON.stringify([{ nonsense: true }, null, "x"]));
  assert.deepEqual((await call(10, "GET", "/api/prizes")).body, { prizes: [] });
  assert.equal((await call(80, "GET", "/api/prizes/mine")).status, 200);
});

test("with plan rules on, class and school prizes are a Premium tool; a parent's prizes stay free", async (t) => {
  const { call, add, sees } = await setup(t, { plans: true });
  const teacher = await call(50, "POST", "/api/prizes", { title: "Homework pass", how: "Read" });
  assert.deepEqual([teacher.status, teacher.body.code], [402, "premium_required"]);
  assert.equal((await call(50, "GET", "/api/prizes/mine")).status, 402);
  await add(80, { title: "Pizza night", how: "Read" });
  assert.deepEqual(await sees(10), ["Pizza night"]);
});
