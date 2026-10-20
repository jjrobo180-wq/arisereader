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
  assert.match(app, /const readerFirst = \(user[^)]*\) => !!user && \(user\.isAdmin === true \|\| user\.role === "teacher" \|\| user\.role === "parent"\);/);
  assert.match(app, /onReaderDomain && readerFirst\(user\) \? <OpenReaderPage \/> : isHubAccount\(user\)/, "the home page too");
  assert.match(read("client/src/pages/AriseReader.tsx"), /return <TeacherReader tab=\{isParent \? "reader" : tab\} setTab=\{setTab\} workhubHref=\{back\.href\} \/>;/);
  const page = read("client/src/pages/TeacherReader.tsx");
  assert.match(page, /Your whole teaching day, in one place\./);
  assert.match(page, /Your family’s whole week, in one place\./, "parents get LifeHub");
  assert.match(page, /\{user\.isAdmin \? "Admin" : isParent \? "Parent" : "Teacher"\}/);
  assert.match(page, />Open your \{hub\.name\}<\/a>/);
  assert.doesNotMatch(page, /Not now/, "the WorkHub banner always shows");
  assert.match(page, /\{greeting\(\)\}, \{user\.displayName\}/);
  assert.match(page, /Needs you today/);
  assert.match(page, /See standings/);
  assert.deepEqual(["Overview", "Students", "Approvals", "Quizzes & grading", "Live quiz", "Parents", "Advisory & Lit", "Leaderboard"].map((l) => page.includes(`label: "${l}"`)), Array(8).fill(true));
  assert.match(page, /export const shortSchool = /);
});

test("the Reader opens the hub in a new tab, signs out to arisereader.com, and has a phone rail with a Hide button", () => {
  const page = read("client/src/pages/TeacherReader.tsx");
  assert.match(page, /target="_blank" rel="noopener" onClick=\{openHub\} data-testid="reader-open-workhub"/);
  assert.match(page, /export const READER_SIGN_IN = `\$\{READER_APP\}#\/signin`;/);
  assert.match(page, /onClick=\{\(\) => \{ logout\(\); window\.location\.assign\(READER_SIGN_IN\); \}\}/);
  assert.match(page, /localStorage\.getItem\(RAIL_KEY\) !== "closed"/, "the phone rail starts open");
  assert.match(page, /onClick=\{\(\) => setRail\(false\)\}[^>]*>Hide<\/button>/);
  assert.match(page, /className="hidden max-w-\[260px\][^"]*lg:flex"/, "computers get the sidebar on the left");
  // The hubs' own default is the same: sidebar left on a computer, left rail with a Hide button on a phone.
  assert.match(read("shared/hubLayout.ts"), /DEFAULT_LAYOUT: HubLayout = \{ menuSide: "left", deskSide: "left", folders: \[\], menuClose: "button"/);
  assert.match(read("shared/lifeLayout.ts"), /\{ menuSide: "left", menuClose: "button", homeHidden: \["widgets"\] \}/);
});

test("the donation banner can't be closed and shows in both hubs and the Reader; Support is in every sidebar", () => {
  const support = read("client/src/components/SupportArise.tsx");
  const banner = support.slice(support.indexOf("export function SupportBanner"), support.indexOf("export function SupportMenuItem"));
  assert.doesNotMatch(banner, /support-banner-close|localStorage/, "no close button, nothing remembered");
  assert.match(read("client/src/pages/TeacherHub.tsx"), /\{tab === "overview" && \(\n\s*<>\n\s*<SupportBanner \/>/);
  assert.match(read("client/src/pages/TeacherHub.tsx"), /<SupportMenuItem isAdmin=\{!!user\?\.isAdmin\} testId="hub-support"/);
  const life = read("client/src/pages/AriseTodo.tsx");
  assert.match(life, /\{shown === "home" && <div className="mb-4"><SupportBanner \/><\/div>\}/, "every LifeHub account, not just parents");
  assert.match(life, /<SupportMenuItem isAdmin=\{user\.isAdmin\} testId="life-support"/);
  const reader = read("client/src/pages/TeacherReader.tsx");
  assert.match(reader, /<SupportBanner dark \/>/);
  assert.match(reader, /testId="reader-support"/);
  assert.match(reader, /testId="reader-rail-support"/);
  for (const href of ["/history/", "/math/", "/social/"]) assert.ok(reader.includes(`href: "${href}"`), href);
  assert.match(reader, /Also on your account:/);
});

test("a student's profile, messages and certificates open as pop-ups; the hub opens straight away", () => {
  const tools = read("client/src/components/teacher-hub/HubReaderTools.tsx");
  assert.match(tools, /onView=\{\(id\) => setPop\(\{ kind: "profile", id: Number\(id\) \}\)\} onMessage=\{\(id\) => setPop\(\{ kind: "messages", id: Number\(id\) \}\)\} onCertificates=\{\(id\) => setPop\(\{ kind: "certificates", id: Number\(id\) \}\)\}/);
  assert.match(tools, /\{pop && <StudentPopup pop=\{pop\} onClose=\{closePop\} \/>\}/);
  assert.match(tools, /if \(tab === "readerStudents"\) \{ void loadProfile\(\); void loadMessages\(\); void loadCertificates\(\); \}/, "loaded ahead of time");
  for (const [f, route] of [["StudentProfileView", "/student-profile/:id"], ["StudentMessages", "/messages/:id"], ["StudentCertificates", "/student-certificates/:id"]]) {
    const page = read(`client/src/pages/${f}.tsx`);
    assert.match(page, new RegExp(`export default function ${f}\\(\\{ studentId: givenId, onClose \\}`));
    assert.ok(page.includes(`const studentId = givenId ?? (match ? params.id : null);`), f);
    assert.ok(page.includes(`useRoute("${route}")`), f);
  }
  const reader = read("client/src/pages/TeacherReader.tsx");
  assert.match(reader, /\/api\/auth\/admin-handoff\/start/);
  assert.match(reader, /const url = `\$\{TODO_APP\}#\/admin-handoff\?code=\$\{d\.code\}`;/);
  assert.match(reader, /onClick=\{openHub\} data-testid="reader-open-workhub"/);
});

test("parents see the prizes, every leaderboard, and their child's school's challenge; banners are slim", () => {
  const reader = read("client/src/pages/TeacherReader.tsx");
  for (const prize of ["Pizza party", "DoorDash food", "AirPods"]) assert.ok(reader.includes(`title: "${prize}"`), prize);
  assert.match(reader, /\{isParent && view === "leaderboard" && <ParentLeaderboards token=\{token\} challenge=\{challenge\} \/>\}/);
  assert.match(reader, /\/api\/leaderboard\?month=\$\{ym\}/);
  assert.match(reader, /\{ id: "whatsnew", label: "What's new", icon: Megaphone \}/);
  assert.match(reader, /<WhatsNew embedded \/>/);
  assert.doesNotMatch(reader, /hub\.tiles/, "the hub banner is one slim row");
  assert.match(reader, /\{ id: "prizes", label: "Prizes to win", icon: Gift \}/, "prizes are a menu link for parents");
  assert.equal(reader.match(/<PrizesCard /g)?.length, 1, "only on the Prizes page, not the top of Overview");
});

test("a parent sees their child's school's Advisory Challenge, with the child's advisory marked", async () => {
  const routes: Record<string, Function> = {};
  registerAdvisoryChallengeRoutes({ get: (p: string, ...h: Function[]) => { routes[p] = h[h.length - 1]; } } as any, {
    auth: (_q, _s, n) => n(),
    getSchool: async (id) => (id === 4 ? { id: 4, name: CGMS } : null),
    allSchools: async () => [],
    schoolStudentIds: async () => [100, 101],
    advisoryPicks: async () => [{ studentId: 100, advisory: "Chase & Shuster" }, { studentId: 101, advisory: "Isaac & Ross" }],
    pointsBetween: async () => new Map([[100, 30], [101, 10]]),
    parentChildren: async () => [{ id: 101, schoolId: 4 }],
    now: () => Date.parse("2026-10-21T18:00:00Z"),
  });
  let body: any;
  await routes["/api/advisory-challenge"]({ user: { id: 9, role: "parent" }, query: {} }, { json: (b: any) => { body = b; }, status: () => ({ json: () => {} }) });
  assert.equal(body.challenge.phase, "live");
  assert.deepEqual(body.mine, { advisory: "Isaac & Ross", rank: 2, points: 10 });
});

test("the donation banner carries the mission: free talkers and eye-gaze tools for every child with a disability", () => {
  const support = read("client/src/components/SupportArise.tsx");
  assert.match(support, /Every child deserves to be heard\./);
  assert.match(support, /free talker and eye-gaze tools/);
});

test("a parent's Overview has the teacher format: greeting, four counts, a list and the challenge card; the child view is under My children", () => {
  const reader = read("client/src/pages/TeacherReader.tsx");
  assert.match(reader, /\{isParent && view === "reader" && <ParentOverview /);
  assert.match(reader, /\{ id: "children", label: "My children", icon: Users \}/);
  assert.match(reader, /\[\["Readers", kids\?\.length, "children"\], \["Total points"/);
  assert.match(reader, /data-testid="parent-challenge-card"/);
});


test("admins have the admin console in the Reader's menu, one item per section", () => {
  const reader = read("client/src/pages/TeacherReader.tsx");
  assert.match(reader, /const ADMIN_MENU: Array<\{ id: View; label: string; icon: LucideIcon \}> = ADMIN_SECTIONS\.map/);
  assert.match(reader, /\{user\.isAdmin && <>\n\s*<p [^>]*>Admin console<\/p>/);
  assert.match(reader, /<AdminConsole night section=\{adminSection\}/);
  assert.match(reader, /\.\.\.\(user\.isAdmin \? ADMIN_MENU : \[\]\)/, "on a phone too");
});
