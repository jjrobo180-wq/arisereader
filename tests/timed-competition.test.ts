// A short competition with its own leaderboard: only points earned between its start and end count.
// Run with: npx tsx --test tests/timed-competition.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FALL_BREAK, awardCounts, competitionPhase, competitionStandings, competitionWindow, timedCompetition, whenText, zonedMs, type AwardRow, type EyeGazeRow, type QuizRow } from "../shared/timedCompetitions";
import { BOARD_FRESH_MS, competitionBoard, registerTimedCompetitionRoutes, type CompetitionStudent, type TimedCompetitionDeps } from "../server/timedCompetition";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
// Mountain Daylight Time is six hours behind UTC in October.
const START = Date.parse("2026-10-07T14:00:00Z"), END = Date.parse("2026-10-12T14:00:00Z");
const quiz = (userId: number, at: string, points: number, score = 8, total = 10, bookId = 5): QuizRow => ({ userId, at, points, score, total, bookId });

test("the Fall Break Competition runs from 10/7 at 8 AM to 10/12 at 8 AM, Mountain Time", () => {
  assert.deepEqual(competitionWindow(FALL_BREAK), { startMs: START, endMs: END });
  assert.equal(timedCompetition("fall-break"), FALL_BREAK);
  assert.equal(timedCompetition("spring"), null);
  assert.equal(timedCompetition(undefined), null);
  assert.deepEqual([whenText(FALL_BREAK.start), whenText(FALL_BREAK.end)], ["Wednesday, Oct 7 at 8:00 AM", "Monday, Oct 12 at 8:00 AM"]);
  assert.equal(whenText({ date: "2026-12-25", time: "15:30" }), "Friday, Dec 25 at 3:30 PM");
  assert.equal(whenText({ date: "2026-01-01", time: "00:05" }), "Thursday, Jan 1 at 12:05 AM");
  // The clock follows the school's time zone, summer and winter.
  assert.equal(zonedMs("2026-10-07", "08:00"), START);
  assert.equal(zonedMs("2026-12-07", "08:00"), Date.parse("2026-12-07T15:00:00Z"), "standard time is seven hours behind");
  assert.equal(zonedMs("2026-10-07", "08:00", "America/New_York"), Date.parse("2026-10-07T12:00:00Z"));
  assert.deepEqual([START - 1, START, END - 1, END].map((t) => competitionPhase(FALL_BREAK, t)), ["soon", "live", "live", "over"]);
});

test("only points earned inside the competition count", () => {
  const standings = competitionStandings(FALL_BREAK, {
    quizzes: [
      quiz(1, "2026-10-07T13:59:59Z", 50), // 7:59 AM on the first day: too early
      quiz(1, "2026-10-07T14:00:00Z", 10), // 8:00 AM on the dot: counts
      quiz(1, "2026-10-09T03:00:00Z", 15.5),
      quiz(1, "2026-10-12T13:59:59Z", 5), // 7:59 AM on the last day: counts
      quiz(1, "2026-10-12T14:00:00Z", 50), // 8:00 AM on the last day: too late
      quiz(2, "2026-10-08T18:00:00Z", 20),
      quiz(2, "2026-10-08T19:00:00Z", 0, 6, 10), // failed: a quiz taken, no points
      quiz(3, "2026-09-30T18:00:00Z", 500), // all of this reader's points are from before
      quiz(4, "2026-10-08T18:00:00Z", 0, 3, 10), // took a quiz, earned nothing: left off
      quiz(5, "not a date", 99),
      quiz(6, "2026-10-08T18:00:00Z", 99, 10, 10, 0), // not a book quiz
    ],
    eyeGaze: [], awards: [],
  });
  assert.deepEqual(standings.map((s) => [s.userId, s.points, s.quizzesPassed, s.quizzesTaken, s.rank, s.tied]), [[1, 30.5, 3, 3, 1, false], [2, 20, 1, 2, 2, false]]);
  assert.equal(standings[0].lastScoredAt, Date.parse("2026-10-12T13:59:59Z"));
  assert.deepEqual(competitionStandings(FALL_BREAK, { quizzes: [], eyeGaze: [], awards: [] }), []);
});

test("eye-gaze quizzes earn 10 for a pass, and a teacher's awards count by the day they are for", () => {
  const eyeGaze: EyeGazeRow[] = [
    { userId: 7, at: "2026-10-08T16:00:00Z", score: 7, total: 10 }, // passed
    { userId: 7, at: "2026-10-08T17:00:00Z", score: 6, total: 10 }, // not passed
    { userId: 7, at: "2026-10-08T18:00:00Z", score: 0, total: 0 }, // never finished
    { userId: 7, at: "2026-10-06T18:00:00Z", score: 10, total: 10 }, // before it started
  ];
  const award = (earnedOn: string, at: string, points = 5, userId = 8): AwardRow => ({ userId, points, earnedOn, at });
  const awards = [
    award("2026-10-09", "2026-10-20T18:00:00Z"), // a day inside it, even when entered later
    award("2026-10-07", "2026-10-07T13:00:00Z", 100), // the first day, entered at 7 AM: before it started
    award("2026-10-07", "2026-10-07T15:00:00Z", 2), // the first day, entered at 9 AM
    award("2026-10-12", "2026-10-12T13:00:00Z", 1), // the last day, entered at 7 AM
    award("2026-10-12", "2026-10-12T15:00:00Z", 100), // the last day, entered at 9 AM: after it ended
    award("2026-10-06", "2026-10-08T15:00:00Z", 100), // for the day before, entered during it
    award("2026-10-13", "2026-10-11T15:00:00Z", 100),
    award("", "2026-10-09T15:00:00Z", 100),
    award("2026-10-09", "2026-10-09T15:00:00Z", -50, 9), // only points taken away: left off the list
    award("2026-10-09", "2026-10-09T15:00:00Z", -4, 7), // a teacher takes 4 back from a reader with 10
  ];
  assert.deepEqual(awards.map((a) => awardCounts(a, FALL_BREAK)), [true, false, true, true, false, false, false, false, true, true]);
  const standings = competitionStandings(FALL_BREAK, { quizzes: [], eyeGaze, awards });
  assert.deepEqual(standings.map((s) => [s.userId, s.points, s.quizzesPassed, s.quizzesTaken]), [[8, 8, 0, 0], [7, 6, 1, 2]], "points a teacher takes back come off");
});

test("readers with the same points share a rank, and whoever got there first is listed first", () => {
  const standings = competitionStandings(FALL_BREAK, {
    quizzes: [quiz(1, "2026-10-08T20:00:00Z", 20), quiz(2, "2026-10-08T18:00:00Z", 20), quiz(3, "2026-10-08T18:00:00Z", 30), quiz(4, "2026-10-09T18:00:00Z", 10), quiz(5, "2026-10-08T19:00:00Z", 10), quiz(5, "2026-10-08T19:30:00Z", 10)],
    eyeGaze: [], awards: [],
  });
  assert.deepEqual(standings.map((s) => [s.userId, s.points, s.rank, s.tied]), [[3, 30, 1, false], [2, 20, 2, true], [5, 20, 2, true], [1, 20, 2, true], [4, 10, 5, false]]);
});

function site(start: { now?: number; rows?: { quizzes?: QuizRow[]; eyeGaze?: EyeGazeRow[]; awards?: AwardRow[] }; students?: CompetitionStudent[] } = {}) {
  let clock = start.now ?? Date.parse("2026-10-08T20:00:00Z");
  const calls = { rows: 0, students: [] as number[][] };
  const deps: TimedCompetitionDeps = {
    now: () => clock,
    loadRows: async () => { calls.rows++; return { quizzes: start.rows?.quizzes || [], eyeGaze: start.rows?.eyeGaze || [], awards: start.rows?.awards || [] }; },
    loadStudents: async (ids) => { calls.students.push(ids); return (start.students || []).filter((s) => ids.includes(s.id)); },
  };
  return { deps, calls, later: (ms: number) => { clock += ms; } };
}

test("the leaderboard shows real students by name, and nothing that identifies an account", async () => {
  const s = site({
    rows: { quizzes: [quiz(1, "2026-10-08T15:00:00Z", 20), quiz(2, "2026-10-08T15:00:00Z", 95), quiz(3, "2026-10-08T15:00:00Z", 60), quiz(4, "2026-10-08T15:00:00Z", 70), quiz(5, "2026-10-08T15:00:00Z", 80), quiz(6, "2026-10-08T15:00:00Z", 90), quiz(7, "2026-10-08T15:00:00Z", 85), quiz(8, "2026-10-08T16:00:00Z", 20)], eyeGaze: [{ userId: 9, at: "2026-10-08T16:00:00Z", score: 9, total: 10 }] },
    students: [
      { id: 1, username: "jlee", displayName: "Jordan Lee", role: "student" },
      { id: 2, username: "mr-r", displayName: "Mr. Robinson", role: "admin", isAdmin: true },
      { id: 3, username: "ms-lee", displayName: "Ms. Lee", role: "teacher" },
      { id: 4, username: "amom", displayName: "A Mom", role: "parent" },
      { id: 5, username: "gone", displayName: "Left School", role: "student", archived: true },
      { id: 6, username: "sample2", displayName: "Sample Student", role: "student" },
      // 7 has no account any more
      { id: 8, username: "dflores", displayName: "Dennis Flores", role: null },
      { id: 9, username: "akim", displayName: "Ava Kim", role: "student", isEyeGazeUser: true },
    ],
  });
  const board = (await competitionBoard(s.deps, "fall-break"))!;
  assert.deepEqual(board.competition, { slug: "fall-break", title: "Fall Break Competition", prize: "$5 cash or gift card", startsAt: "2026-10-07T14:00:00.000Z", endsAt: "2026-10-12T14:00:00.000Z", startText: "Wednesday, Oct 7 at 8:00 AM", endText: "Monday, Oct 12 at 8:00 AM" });
  assert.equal(board.phase, "live");
  assert.deepEqual(board.entries, [
    { rank: 1, tied: true, displayName: "Jordan Lee", points: 20, quizzesPassed: 1, isEyeGazeUser: false },
    { rank: 1, tied: true, displayName: "Dennis Flores", points: 20, quizzesPassed: 1, isEyeGazeUser: false },
    { rank: 3, tied: false, displayName: "Ava Kim", points: 10, quizzesPassed: 1, isEyeGazeUser: true },
  ], "staff, parents, archived and sample accounts are left out, and ranks are counted among the students who are left");
  assert.ok(!/jlee|dflores|userId|"id"/.test(JSON.stringify(board)), "no sign-in names or ids");
  assert.equal(await competitionBoard(s.deps, "nope"), null);
  // Before it starts nothing is read and nothing is listed; after it ends the list is still shown.
  const early = site({ now: START - 60_000, rows: { quizzes: [quiz(1, "2026-10-08T15:00:00Z", 20)] }, students: [{ id: 1, displayName: "Jordan Lee" }] });
  assert.deepEqual([(await competitionBoard(early.deps, "fall-break"))!.phase, (await competitionBoard(early.deps, "fall-break"))!.entries, early.calls.rows], ["soon", [], 0]);
  const done = site({ now: END + 60_000, rows: { quizzes: [quiz(1, "2026-10-08T15:00:00Z", 20)] }, students: [{ id: 1, displayName: "Jordan Lee" }] });
  const final = (await competitionBoard(done.deps, "fall-break"))!;
  assert.deepEqual([final.phase, final.entries.map((e) => e.displayName)], ["over", ["Jordan Lee"]]);
});

test("the route answers anyone, reuses one answer for a short while, and says so when there is no such competition", async () => {
  const s = site({ rows: { quizzes: [quiz(1, "2026-10-08T15:00:00Z", 20)] }, students: [{ id: 1, displayName: "Jordan Lee" }] });
  const routes: Record<string, (req: any, res: any) => Promise<void>> = {};
  registerTimedCompetitionRoutes({ get: (path: string, ...handlers: any[]) => { assert.equal(handlers.length, 1, "no sign-in is asked for"); routes[path] = handlers[0]; } } as any, s.deps);
  const ask = async (slug: string) => { const out: any = { status: 200, headers: {} }; const res: any = { set: (k: string, v: string) => { out.headers[k] = v; return res; }, status: (n: number) => { out.status = n; return res; }, json: (b: unknown) => { out.body = b; return res; } }; await routes["/api/competitions/:slug"]({ params: { slug } }, res); return out; };
  const first = await ask("fall-break");
  assert.deepEqual([first.status, first.headers["Cache-Control"], first.body.entries.length], [200, "no-store", 1]);
  await ask("fall-break"); await ask("fall-break");
  assert.equal(s.calls.rows, 1, "a class refreshing together asks the database once");
  s.later(BOARD_FRESH_MS + 1);
  await ask("fall-break");
  assert.equal(s.calls.rows, 2, "then it is read again");
  assert.deepEqual([(await ask("spring")).status, (await ask("spring")).body], [404, { message: "There is no competition by that name." }]);
  const broken: TimedCompetitionDeps = { ...s.deps, now: () => END - 5, loadRows: async () => { throw new Error("database is down"); } };
  const routes2: Record<string, any> = {};
  registerTimedCompetitionRoutes({ get: (path: string, h: any) => { routes2[path] = h; } } as any, broken);
  const out: any = {}; const res: any = { set: () => res, status: (n: number) => { out.status = n; return res; }, json: (b: unknown) => { out.body = b; return res; } };
  const logged = console.error; console.error = () => {};
  try { await routes2["/api/competitions/:slug"]({ params: { slug: "fall-break" } }, res); } finally { console.error = logged; }
  assert.deepEqual(out, { status: 500, body: { message: "The leaderboard could not be loaded. Please try again." } });
});

test("the page is at /#/fall-break and the server reads the right rows", () => {
  const app = read("client/src/App.tsx"), page = read("client/src/pages/TimedCompetition.tsx"), routes = read("server/routes.ts");
  assert.ok(app.includes('<Route path="/fall-break">\n        <TimedCompetition slug="fall-break" />'));
  assert.ok(app.indexOf('<Route path="/fall-break">') < app.indexOf("<Route>") || !app.includes("<Route>"), "ahead of the not-found page");
  for (const part of ["/api/competitions/${encodeURIComponent(slug)}", 'data-testid="competition-list"', 'data-testid="competition-countdown"', "wins {c.prize}", "Ends in", "Final standings", "Only points earned from {c.startText} to {c.endText} count here", "REFRESH_MS"]) assert.ok(page.includes(part), part);
  for (const part of ["registerTimedCompetitionRoutes(app, {", '.from("attempts").select("user_id, book_id, points_earned, score, total, completed_at").gte("completed_at", from).lt("completed_at", to)', '.from("eye_gaze_attempts")', '.from("custom_eye_gaze_attempts")', '.eq("status", "completed")', '.from("manual_point_awards").select("student_id, points, earned_on, created_at").gte("earned_on", competition.start.date).lte("earned_on", competition.end.date)']) assert.ok(routes.includes(part), part);
});
