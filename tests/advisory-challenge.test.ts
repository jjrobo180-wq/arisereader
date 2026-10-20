// The Advisory Challenge: its dates (school days in Denver), ranking, the standings route, and where
// it shows up (the pop-up that replaced Halloread and "your standing", the library banner, and the
// student leaderboard, which now opens on this month's race with the challenge under it).
// Run with: npx tsx --test tests/advisory-challenge.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CGMS_FALL_2026, challengeForSchool, challengePhase, challengeWindow, dayLabel, dayStartMs, daysLeft, nextDay, ordinal, rankAdvisories,
} from "../shared/advisoryChallenge";
import { advisoriesForSchool } from "../shared/advisories";
import { registerAdvisoryChallengeRoutes } from "../server/advisoryChallenge";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const CGMS = "Conservatory Green Middle School (Denver, CO)";

test("the challenge is Conservatory Green Middle School's, Oct 20 to Nov 19, pizza on Nov 20, with October's points counting", () => {
  assert.equal(challengeForSchool(CGMS), CGMS_FALL_2026);
  assert.equal(challengeForSchool("Some Other School"), null);
  assert.equal(challengeForSchool("Conservatory Green High School"), null);
  assert.deepEqual([CGMS_FALL_2026.countsFrom, CGMS_FALL_2026.starts, CGMS_FALL_2026.lastDay, CGMS_FALL_2026.prizeDay], ["2026-10-20", "2026-10-20", "2026-11-19", "2026-11-20"]);
  assert.equal(dayLabel("2026-10-20"), "Tuesday, October 20");
  assert.equal(dayLabel("2026-11-19"), "Thursday, November 19");
  assert.equal(dayLabel("2026-11-20"), "Friday, November 20");
  assert.equal(dayLabel("2026-10-01", true), "Oct 1");
});

test("days start at midnight in Denver, on both sides of the clocks changing", () => {
  assert.equal(new Date(dayStartMs("2026-10-01")).toISOString(), "2026-10-01T06:00:00.000Z"); // MDT
  assert.equal(new Date(dayStartMs("2026-11-20")).toISOString(), "2026-11-20T07:00:00.000Z"); // MST
  assert.equal(nextDay("2026-11-19"), "2026-11-20");
  assert.equal(nextDay("2026-12-31"), "2027-01-01");
  const w = challengeWindow(CGMS_FALL_2026);
  assert.equal(new Date(w.fromMs).toISOString(), "2026-10-20T06:00:00.000Z"); // everyone starts at 0 on Oct 20
  assert.equal(new Date(w.endMs).toISOString(), "2026-11-20T07:00:00.000Z"); // the end of Nov 19 in Denver
  assert.deepEqual([w.fromDay, w.endDayExclusive], ["2026-10-20", "2026-11-20"]);
});

test("the phases: coming up, running, over through pizza day, then done", () => {
  const at = (iso: string) => challengePhase(CGMS_FALL_2026, Date.parse(iso));
  assert.equal(at("2026-10-19T22:00:00Z"), "soon"); // Monday afternoon in Denver
  assert.equal(at("2026-10-20T06:00:00Z"), "live");
  assert.equal(at("2026-11-20T06:59:00Z"), "live"); // 11:59 pm Nov 19 in Denver
  assert.equal(at("2026-11-20T07:00:00Z"), "over");
  assert.equal(at("2026-11-21T06:59:00Z"), "over");
  assert.equal(at("2026-11-21T07:00:00Z"), "done");
  assert.equal(daysLeft(CGMS_FALL_2026, Date.parse("2026-11-19T18:00:00Z")), 0);
  assert.equal(daysLeft(CGMS_FALL_2026, Date.parse("2026-11-18T18:00:00Z")), 1);
});

test("advisories are ranked by their students' points, and ties share a place", () => {
  const advisories = advisoriesForSchool(CGMS);
  assert.equal(advisories.length, 15);
  const students = new Map<number, string>([[1, "Chase & Shuster"], [2, "Chase & Shuster"], [3, "Isaac & Ross"], [4, "King & Ruos"], [5, "Not An Advisory"]]);
  const points = new Map<number, number>([[1, 30], [2, 20], [3, 50], [4, 50], [5, 999]]);
  const rows = rankAdvisories(advisories, students, points);
  assert.equal(rows.length, 15);
  assert.deepEqual(rows.slice(0, 3).map((r) => [r.rank, r.name, r.points, r.students]), [[1, "Chase & Shuster", 50, 2], [1, "Isaac & Ross", 50, 1], [1, "King & Ruos", 50, 1]]);
  assert.equal(rows[3].rank, 4);
  assert.ok(rows.slice(3).every((r) => r.rank === 4 && r.points === 0));
  assert.deepEqual(rows.find((r) => r.name === "Chase & Shuster") && [rows[0].grade, rows[0].room], ["7", "212"]);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"]);
});

function fakeApp() {
  const routes: Record<string, Function> = {};
  const app: any = { get: (path: string, ...h: Function[]) => { routes[path] = h[h.length - 1]; } };
  const calls: any[] = [];
  registerAdvisoryChallengeRoutes(app, {
    auth: (_req, _res, next) => next(),
    getSchool: async (id) => (id === 4 ? { id: 4, name: CGMS } : id === 9 ? { id: 9, name: "Elsewhere Elementary" } : null),
    allSchools: async () => [{ id: 9, name: "Elsewhere Elementary" }, { id: 4, name: CGMS }],
    schoolStudentIds: async () => [100, 101, 102, 103],
    advisoryPicks: async () => [{ studentId: 100, advisory: "Chase & Shuster" }, { studentId: 101, advisory: "Isaac & Ross" }, { studentId: 102, advisory: "Isaac & Ross" }, { studentId: 999, advisory: "Isaac & Ross" }],
    pointsBetween: async (ids, from, to, fromDay, endDay) => { calls.push({ ids, from, to, fromDay, endDay }); return new Map([[100, 40], [101, 25], [102, 10], [999, 500], [103, 7]]); },
    now: () => Date.parse("2026-10-19T22:00:00Z"),
  });
  const get = async (user: any, query: any = {}) => {
    let out: any; let status = 200;
    const res: any = { json: (b: any) => { out = b; return res; }, status: (s: number) => { status = s; return res; } };
    await routes["/api/advisory-challenge"]({ user, query }, res);
    return { status, body: out };
  };
  return { get, calls };
}

test("a student sees every advisory's place and their own advisory's, counting from Oct 20", async () => {
  const { get, calls } = fakeApp();
  const { body } = await get({ id: 101, role: "student", school_id: 4 });
  assert.equal(body.challenge.phase, "soon");
  assert.equal(body.challenge.prize, "a pizza party");
  assert.deepEqual(body.standings.slice(0, 2).map((s: any) => [s.rank, s.name, s.points, s.students]), [[1, "Chase & Shuster", 40, 1], [2, "Isaac & Ross", 35, 2]]);
  assert.deepEqual(body.mine, { advisory: "Isaac & Ross", rank: 2, points: 25 });
  assert.equal(calls[0].fromDay, "2026-10-20");
  assert.equal(calls[0].endDay, "2026-11-20");
  assert.ok(!calls[0].ids.includes(999), "a student who left the school (archived) doesn't count");
});

test("a student with no advisory still sees the board; other schools and staff get what fits them", async () => {
  const { get } = fakeApp();
  const loose = await get({ id: 103, role: "student", school_id: 4 });
  assert.deepEqual(loose.body.mine, { advisory: null, rank: null, points: 7 });
  assert.equal(loose.body.standings.length, 15);
  assert.deepEqual((await get({ id: 5, role: "student", school_id: 9 })).body, { challenge: null, standings: [], mine: null });
  assert.deepEqual((await get({ id: 6, role: "student" })).body, { challenge: null, standings: [], mine: null });
  const teacher = await get({ id: 123, role: "teacher", school_id: 4 });
  assert.equal(teacher.body.mine, null);
  assert.equal(teacher.body.standings[0].name, "Chase & Shuster");
  const admin = await get({ id: 1, isAdmin: true });
  assert.equal(admin.body.challenge.id, "cgms-fall-2026", "an admin with no school sees the school running a challenge");
});

test("the Advisory Challenge pop-up replaces the Halloread welcome and the 'your standing' pop-up", () => {
  const app = read("client/src/App.tsx");
  assert.doesNotMatch(app, /<HalloreadWelcome \/>/);
  assert.doesNotMatch(app, /<LeaderboardPopup /);
  assert.match(app, /<AdvisoryChallengePopup onNavigate=/);
  const popup = read("client/src/components/AdvisoryChallenge.tsx");
  assert.match(popup, /if \(raw === null \|\| !raw\.challenge\) return <LeaderboardPopup onNavigate=\{onNavigate\} \/>;/, "schools without a challenge keep the standing pop-up");
  assert.match(popup, /onNavigate\("\/leaderboard"\)/);
  assert.match(popup, /const early = c\.countsFrom < c\.starts \?/, "points from before the start only count if the challenge says so");
  assert.match(popup, /Every advisory starts at 0 points\./);
  assert.match(popup, /wins \$\{c\.prize\} on \$\{dayLabel\(c\.prizeDay\)\}/);
});

test("the library banner shows the student's advisory place and the top of the board, and opens the leaderboard", () => {
  const lib = read("client/src/pages/Library.tsx");
  assert.match(lib, /<AdvisoryChallengeBanner onOpen=\{\(\) => navigate\("\/leaderboard"\)\} \/>/);
  const comp = read("client/src/components/AdvisoryChallenge.tsx");
  assert.match(comp, /<AdvisoryStandings view=\{v\} mineName=\{mine\?\.advisory\} limit=\{3\} dense \/>/);
});

test("the student leaderboard opens on this month's race, with the Advisory Challenge on its own tab", () => {
  const page = read("client/src/pages/StudentProgress.tsx");
  assert.match(page, /useState<"badges" \| "rewards" \| "leaderboard">\("leaderboard"\)/);
  assert.match(page, /\/api\/leaderboard\?month=\$\{encodeURIComponent\(schoolYearMonth\(\)\)\}/);
  assert.match(page, /monthly winner/);
  assert.match(page, /useState<"students" \| "advisories">\("advisories"\)/, "the Advisory board first");
  assert.match(page, /tab === "leaderboard" && \(board === "students" \|\| !challenge\?\.challenge\) &&/);
  assert.match(page, /tab === "leaderboard" && board === "advisories" && challenge && challenge\.challenge &&/);
  assert.match(read("server/routes.ts"), /registerAdvisoryChallengeRoutes\(app, \{/);
});

test("a teacher who signs in on arisereader.com lands in the teacher Reader, with a banner that opens WorkHub", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /if \(onReaderDomain && readerFirst\(user\)\) return <OpenReaderPage \/>;\n    if \(onReaderDomain\) return <ReaderToHubHandoff \/>;/);
  assert.match(app, /const readerFirst = \(user[^)]*\) => !!user && user\.role === "teacher" && !user\.isAdmin;/);
  assert.match(app, /onReaderDomain && readerFirst\(user\) \? <OpenReaderPage \/> : isHubAccount\(user\)/, "the home page too");
  const page = read("client/src/pages/AriseReader.tsx");
  assert.match(page, /\{user\.role === "teacher" && <WorkHubBanner href=\{back\.href\} \/>\}/);
  assert.match(page, /Your whole teaching day, in one place\./);
  assert.match(page, />Open your WorkHub<\/a>/);
  assert.match(page, /localStorage\.getItem\("arise-hub-night"\) !== "0"/, "dark unless day mode was picked");
});
