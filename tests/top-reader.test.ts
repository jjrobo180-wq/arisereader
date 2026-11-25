// The Top Reader Challenge: Nov 23 to Nov 30, 2026, students one by one, the 2 with the most points
// each win a $5 gift card or snacks. Its dates, ranking, the board route, and where it shows up.
// Run with: npx tsx --test tests/top-reader.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CGMS_TOP_READER_NOV_2026 as C, isFirstDay, rankRacers, topReaderDates, topReaderDaysLeft, topReaderForSchool, topReaderPhase, topReaderText, topReaderWindow, topReaderWinners,
  type TopReaderView,
} from "../shared/topReader";
import { registerTopReaderRoutes, BOARD_SIZE } from "../server/topReader";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const CGMS = "Conservatory Green Middle School (Denver, CO)";
const at = (iso: string) => Date.parse(iso);

test("it's CGMS's, Monday Nov 23 to the end of Monday Nov 30, top 2 win a $5 gift card or snacks", () => {
  assert.equal(topReaderForSchool(CGMS), C);
  assert.equal(topReaderForSchool("Some Other School"), null);
  assert.deepEqual([C.starts, C.lastDay, C.prizeDay, C.winners], ["2026-11-23", "2026-11-30", "2026-12-01", 2]);
  assert.match(C.prize, /\$5 gift card or snacks \(chips, candy and a drink\)/);
  assert.equal(topReaderDates(C), "Nov 23 – Nov 30");
  const w = topReaderWindow(C);
  assert.equal(new Date(w.fromMs).toISOString(), "2026-11-23T07:00:00.000Z"); // midnight Nov 23 in Denver (MST)
  assert.equal(new Date(w.endMs).toISOString(), "2026-12-01T07:00:00.000Z"); // midnight after Nov 30
  assert.deepEqual([w.fromDay, w.endDayExclusive], ["2026-11-23", "2026-12-01"]);
});

test("the phases: today it's live and new, the last day counts, then winners through Dec 4", () => {
  const p = (iso: string) => topReaderPhase(C, at(iso));
  assert.equal(p("2026-11-23T06:59:00Z"), "soon"); // 11:59 pm Sunday in Denver
  assert.equal(p("2026-11-23T18:11:00Z"), "live"); // 11:11 am Monday, when it was asked for
  assert.equal(isFirstDay(C, at("2026-11-23T18:11:00Z")), true);
  assert.equal(isFirstDay(C, at("2026-11-24T18:00:00Z")), false);
  assert.equal(topReaderDaysLeft(C, at("2026-11-23T18:11:00Z")), 7);
  assert.equal(p("2026-12-01T06:59:00Z"), "live"); // 11:59 pm Nov 30
  assert.equal(topReaderDaysLeft(C, at("2026-12-01T06:00:00Z")), 0);
  assert.equal(p("2026-12-01T07:00:00Z"), "over");
  assert.equal(p("2026-12-05T06:59:00Z"), "over");
  assert.equal(p("2026-12-05T07:00:00Z"), "done");
});

test("students are ranked by points; ties share a place; no points, not on the board", () => {
  const rows = rankRacers([
    { id: 1, name: "Ava", grade: "7", points: 30, passed: 2 },
    { id: 2, name: "Ben", grade: "6", points: 55, passed: 3 },
    { id: 3, name: "Cy", grade: "8", points: 30, passed: 1 },
    { id: 4, name: "Dee", grade: "8", points: 0, passed: 0 },
    { id: 5, name: "Eli", grade: "6", points: 12.25, passed: 1 },
  ]);
  assert.deepEqual(rows.map((r) => [r.rank, r.name, r.points]), [[1, "Ben", 55], [2, "Ava", 30], [2, "Cy", 30], [4, "Eli", 12.3]]);
  // A tie for 2nd: both are winners.
  assert.deepEqual(topReaderWinners(rows, 2).map((r) => r.name), ["Ben", "Ava", "Cy"]);
  assert.deepEqual(topReaderWinners(rankRacers([{ id: 1, name: "A", grade: "", points: 9, passed: 1 }, { id: 2, name: "B", grade: "", points: 5, passed: 1 }, { id: 3, name: "C", grade: "", points: 1, passed: 1 }]), 2).map((r) => r.name), ["A", "B"]);
  assert.deepEqual(topReaderWinners([], 2), []);
});

test("the words say how it works, and who won once it's over", () => {
  const live: TopReaderView = { challenge: { ...C, phase: "live", daysLeft: 7, firstDay: true, endMs: 0 }, standings: [], racers: 0, mine: null };
  assert.match(topReaderText(live), /^Starts today! Everyone is at 0 until Monday, November 30\. 7 days left\. Ends Monday, November 30 at midnight\. The 2 students with the most reading points each win a \$5 gift card/);
  const last = { ...live, challenge: { ...live.challenge!, daysLeft: 0, firstDay: false } };
  assert.match(topReaderText(last), /^Last day! It ends tonight at midnight\./);
  const done: TopReaderView = { ...live, challenge: { ...live.challenge!, phase: "over" }, standings: [{ rank: 1, name: "Ben", grade: "6", points: 55, passed: 3 }, { rank: 2, name: "Ava", grade: "7", points: 30, passed: 2 }, { rank: 3, name: "Cy", grade: "8", points: 10, passed: 1 }] };
  assert.equal(topReaderText(done, at("2026-12-01T16:00:00Z")), "The challenge is over. Ben and Ava won! Prizes: a $5 gift card or snacks (chips, candy and a drink), given out today.");
  assert.match(topReaderText({ ...done, standings: [] }), /No one scored/);
});

function fakeApp(now = "2026-11-23T18:11:00Z") {
  const routes: Record<string, Function> = {};
  const calls: any[] = [];
  const students = Array.from({ length: 14 }, (_, i) => ({ id: 100 + i, name: `Student ${String(i).padStart(2, "0")}` }));
  registerTopReaderRoutes({ get: (p: string, ...h: Function[]) => { routes[p] = h[h.length - 1]; } } as any, {
    auth: (_q, _s, n) => n(),
    getSchool: async (id) => (id === 4 ? { id: 4, name: CGMS } : id === 9 ? { id: 9, name: "Elsewhere Elementary" } : null),
    allSchools: async () => [{ id: 9, name: "Elsewhere Elementary" }, { id: 4, name: CGMS }],
    schoolStudents: async () => students,
    grades: async () => ({ "100": "6", "113": "8" }),
    // Student 100 has the most; 113 has the least of those who scored; 112 has none.
    statsBetween: async (ids, from, to, fromDay, endDay) => {
      calls.push({ ids, from, to, fromDay, endDay });
      return new Map(students.filter((s) => s.id !== 112).map((s, i) => [s.id, { points: s.id === 113 ? 1 : 200 - i * 10, quizzesPassed: 1 + (i % 3) }]));
    },
    parentChildren: async () => [{ id: 113, schoolId: 4 }],
    now: () => at(now),
  });
  const get = async (user: any) => {
    let body: any; let status = 200;
    const res: any = { json: (b: any) => { body = b; return res; }, status: (s: number) => { status = s; return res; } };
    await routes["/api/top-reader"]({ user, query: {} }, res);
    return { status, body };
  };
  return { get, calls };
}

test("a student sees the top 10, their own place, and no one else's id; points count from Nov 23", async () => {
  const { get, calls } = fakeApp();
  const { body } = await get({ id: 113, role: "student", school_id: 4 });
  assert.equal(body.challenge.phase, "live");
  assert.equal(body.challenge.firstDay, true);
  assert.equal(body.racers, 13);
  assert.equal(BOARD_SIZE, 10);
  assert.equal(body.standings.length, 11); // the top 10 and then their own row
  // Everyone but the viewer shows by initials (shared/prizeSchool.ts).
  assert.deepEqual(body.standings[0], { rank: 1, name: "S. 0.", grade: "6", points: 200, passed: 1 });
  assert.deepEqual(body.standings[10], { rank: 13, name: "Student 13", grade: "8", points: 1, passed: 1, id: 113 });
  assert.equal(body.standings.filter((s: any) => s.id != null).length, 1);
  assert.deepEqual(body.mine, { name: "Student 13", rank: 13, points: 1, passed: 1 });
  assert.deepEqual([calls[0].fromDay, calls[0].endDay], ["2026-11-23", "2026-12-01"]);
});

test("a student who hasn't scored is told how to get on; a teacher sees everyone; a parent sees their child", async () => {
  const { get } = fakeApp();
  const none = (await get({ id: 112, role: "student", school_id: 4 })).body;
  assert.deepEqual(none.mine, { name: "Student 12", rank: null, points: 0, passed: 0 });
  assert.equal(none.standings.length, 10);
  const teacher = (await get({ id: 7, role: "teacher", school_id: 4 })).body;
  assert.equal(teacher.standings.length, 13);
  assert.ok(teacher.standings.every((s: any) => s.id != null));
  assert.equal(teacher.mine, null);
  const admin = (await get({ id: 1, isAdmin: true })).body; // no school: the first school running it
  assert.equal(admin.challenge.id, C.id);
  const parent = (await get({ id: 9, role: "parent" })).body;
  assert.equal(parent.mine.name, "Student 13");
  assert.equal(parent.mine.rank, 13);
});

test("other schools get nothing, and nothing shows once the winners have been up a week", async () => {
  assert.equal((await fakeApp().get({ id: 5, role: "student", school_id: 9 })).body.challenge, null);
  assert.equal((await fakeApp("2026-12-05T08:00:00Z").get({ id: 113, role: "student", school_id: 4 })).body.challenge, null);
  const over = (await fakeApp("2026-12-01T16:00:00Z").get({ id: 113, role: "student", school_id: 4 })).body;
  assert.equal(over.challenge.phase, "over");
  assert.deepEqual(topReaderWinners(over.standings, 2).map((s: any) => s.name), ["S. 0.", "S. 0."]);
});

test("students see it at sign-in, in the library and on the leaderboards; teachers and parents in the Reader", () => {
  const popup = read("client/src/components/AdvisoryChallenge.tsx");
  assert.match(popup, /<TopReaderPopup onNavigate=\{onNavigate\} fallback=\{<LeaderboardPopup/);
  const ui = read("client/src/components/TopReader.tsx");
  // Plain: no emoji, no gradients; the facts once (prize, winners, end), the headline says what you can win.
  assert.match(ui, /New challenge · Starts today/);
  assert.match(ui, /`Read the most, win \$\{prizeShort\(v\)\}\.`/);
  assert.match(ui, /\["Prize", /);
  assert.doesNotMatch(ui, /gradient|[\u{1F300}-\u{1FAFF}]/u);
  assert.match(read("client/src/pages/Library.tsx"), /<TopReaderBanner onOpen=\{\(\) => navigate\("\/leaderboard"\)\} \/>/);
  assert.match(read("client/src/pages/LeaderboardPage.tsx"), /topReader\?\.challenge && <div className="mb-6"><TopReaderCard view=\{topReader\} \/>/);
  assert.match(read("client/src/pages/StudentProgress.tsx"), /tab === "leaderboard" && topReader\?\.challenge && <TopReaderCard view=\{topReader\} \/>/);
  const reader = read("client/src/pages/TeacherReader.tsx");
  assert.match(reader, /data-testid="reader-top-reader-card"/);
  assert.match(reader, /view === "leaderboard" && <>\s*<h1[^>]*>Leaderboard<\/h1>\s*\{topReader\?\.challenge && <TopReaderCard view=\{topReader\} \/>\}/);
  assert.match(reader, /<TopReaderCard view=\{topReader\} child=\{topReader\.mine\?\.name\} \/>/);
  assert.match(read("server/routes.ts"), /registerTopReaderRoutes\(app, \{/);
});
