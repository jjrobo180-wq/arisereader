// The Apple TV and Apple Watch apps (November 2026).
// - arisetodo.com/tv, the sign-in page the Arise Duo TV app sends you to, opened the home page instead: the
//   app's pages live after the "#", and nothing sent the bare address there.
// - Arise Fit on Apple TV showed its title over an empty screen: native/fit-tv/sessions.json, the workouts it
//   plays, had been committed empty.
// - Arise Duo on Apple TV now has the phone's layout, so the TV's summary carries everything the phone's Home shows.
// Run with: npx tsx --test tests/tv-and-watch.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tvSummary } from "../server/tvLink";
import { tvCodeFromAddress } from "../client/src/lib/tvCode";
import { SESSIONS } from "../shared/fitSessions";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("arisetodo.com/tv opens the page for typing the TV's code, keeping a code in the address", () => {
  const main = read("client/src/main.tsx");
  assert.match(main, /\} else if \(path === "\/tv"\) \{/);
  assert.match(main, /const appPath = \/\^\(www\\\.\)\?arisetodo\\\.com\$\/i\.test\(window\.location\.hostname\) \? "\/app" : "\/";/);
  assert.match(main, /window\.history\.replaceState\(null, "", `\$\{appPath\}#\/tv\$\{code \? `\?code=\$\{encodeURIComponent\(code\)\}` : ""\}`\);/);
  // Signing in first goes to the app's sign-in page (after the "#"), not the bare /signin address.
  assert.match(read("client/src/pages/TvLink.tsx"), /href="#\/signin"/);
});

test("the code is read from after the # (where the QR code and signing in land) or before it", () => {
  assert.equal(tvCodeFromAddress({ search: "", hash: "#/tv?code=k7qx2m" }), "K7QX2M");
  assert.equal(tvCodeFromAddress({ search: "?code=B9C-DFG", hash: "#/tv" }), "B9CDFG");
  assert.equal(tvCodeFromAddress({ search: "", hash: "#/tv" }), "");
  assert.equal(tvCodeFromAddress({ search: "", hash: "#/tv?code=ABCDEFGH" }), "ABCDEF");
});

const workspace = {
  lists: [{ id: "l1", name: "Home" }],
  tasks: [
    { id: "t1", title: "Take out trash", due: "2026-11-07", listId: "l1", done: false, priority: "high" },
    { id: "t2", title: "Done already", due: "2026-11-07", done: true },
    { id: "t3", title: "Way later", due: "2026-12-30", done: false },
  ],
  family: {
    members: [{ id: "m1", name: "Ava", emoji: "🦄", color: "#f472b6", kind: "kid" }],
    chores: [{ id: "c1", title: "Feed dog", memberId: "m1", rotation: [], days: [0, 1, 2, 3, 4, 5, 6], points: 2 }],
    events: [{ id: "e1", title: "Soccer", date: "2026-11-07", time: "17:00", calendarId: "family", memberIds: ["m1"], repeat: "none" }],
    bills: [{ id: "b1", name: "Rent", amount: 1200, dueDay: 10, paid: [] }],
    notes: [{ id: "n1", title: "Wifi", body: "SmithHouse", pinned: true }, { id: "n2", title: "Locker code", body: "1234", pinned: true, locked: true }],
  },
};

test("the TV gets what the phone's Home shows, and never a note behind the passcode", () => {
  const s = tvSummary(workspace, "2026-11-07", "Jeremy");
  // What the first TV app read is still there, the same shape.
  assert.equal(s.name, "Jeremy");
  assert.deepEqual(s.tasks.map((t) => t.id), ["t1"]);
  assert.equal(s.tasks[0].list, "Home");
  assert.equal(s.tasks[0].priority, "high");
  assert.equal(s.events[0].title, "Soccer");
  assert.deepEqual(s.events[0].people, [{ name: "Ava", emoji: "🦄", color: "#f472b6" }]);
  assert.deepEqual(s.chores.map((c) => [c.title, c.who, c.done]), [["Feed dog", "Ava", false]]);
  // And the rest of Home.
  assert.deepEqual(s.lists, [{ id: "l1", name: "Home" }]);
  assert.equal(s.sections.calendar, true);
  assert.deepEqual(s.bills.map((b) => [b.name, b.due, b.late]), [["Rent", "2026-11-10", false]]);
  assert.deepEqual(s.billsPaid, { paid: 0, total: 1 });
  assert.deepEqual(s.notes.map((n) => n.title), ["Wifi"]);
  assert.equal(JSON.stringify(s).includes("1234"), false);
});

test("a part switched off on the phone stays off on the TV", () => {
  const off = { ...workspace, family: { ...workspace.family, sections: { calendar: false, chores: false, money: false, notes: false } } };
  const s = tvSummary(off, "2026-11-07");
  assert.deepEqual([s.events.length, s.chores.length, s.bills.length, s.notes.length], [0, 0, 0, 0]);
  assert.equal(s.billsPaid, null);
});

test("Arise Fit's TV and watch apps have every guided session to play", () => {
  const file = JSON.parse(read("native/fit-tv/sessions.json"));
  assert.ok(file.length > 0, "sessions.json isn't empty");
  assert.deepEqual(file, JSON.parse(JSON.stringify(SESSIONS)), "sessions.json matches shared/fitSessions.ts (npx tsx script/exportFitSessions.ts)");
  // Bundled into the TV app and the watch app, in the signed builds and the simulator check.
  for (const wf of [".github/workflows/fit-ios.yml", ".github/workflows/companions-sim.yml"]) {
    const y = read(wf);
    assert.match(y, /--name FitTV [^\n]*--resources native\/fit-tv\/sessions\.json/, `${wf}: TV`);
    assert.match(y, /--name FitWatch [^\n]*--resources native\/fit-tv\/sessions\.json/, `${wf}: watch`);
  }
  // A session the app can't read is skipped, never the whole list.
  assert.match(read("native/fit-tv/FitTVApp.swift"), /decode\(\[FitLenient\]\.self/);
  assert.match(read("native/fit-watch/FitWatchApp.swift"), /decode\(\[GuidedLenient\]\.self/);
});

test("the Duo watch gets today's events and chores, and a chore checked off there is saved", () => {
  // Moved into shared/watchDuo.ts (tests/watch-duo.test.ts covers the payload and every action).
  const app = read("client/src/pages/AriseTodo.tsx");
  assert.match(app, /publishWatchPart\("life", lifeWatchPart\(family, data\.tasks, data\.lists, currentDay\)/);
  assert.match(app, /setFamily\(\(f\) => applyLifeWatch\(f, rest, today\(\), makeId\)\)/);
  const shared = read("shared/watchDuo.ts");
  assert.match(shared, /a\.type === "chore" && id/);
  assert.match(shared, /if \(c && choreDueOn\(c, today\)\) next = toggleChore\(next, c, today, makeId\);/);
  assert.match(read("native/duo-watch/DuoWatchApp.swift"), /h\.flip\("chores", id: c\.id, type: "chore"\)/);
});

test("the Duo TV app reads the new summary fields as optional, so an older server still works", () => {
  const tv = read("native/duo-tv/DuoTVApp.swift");
  for (const f of ["members", "lists", "sections", "bills", "billsPaid", "stars", "polls", "trip", "goals", "notes"]) {
    assert.match(tv, new RegExp(`let ${f}: [^\\n]*\\?\\n`), f);
  }
  // The QR code opens the sign-in page with the TV's code filled in.
  assert.match(tv, /DuoQR\.image\("https:\/\/arisetodo\.com\/tv\?code=\\\(code\)"\)/);
});

// ——— November 2026, round two: Arise Fit's TV app gets the phone's features and a coach's voice; Arise
// Duo's gets the Work/Life switch and the LifeHub apps.
import { tvWorkSummary } from "../server/tvLink";
import { fitTvSummary, strengthSession } from "../server/fitTv";
import { TIMER_PRESETS, timerSession } from "../shared/fitTimers";
import { PROGRAMS } from "../shared/fit";

test("the TV's Work side is the teacher's WorkHub: to-dos, the calendar with repeats, meetings, today's schedule and what's due", () => {
  const w = tvWorkSummary({
    profile: { school: "Lincoln MS" },
    students: [{ id: "s1", name: "Ava Smith", iepDate: "2026-11-20", reevalDate: "2027-05-01" }, { id: "s2", name: "Leo Park", iepDate: "2026-11-01", reevalDate: "" }],
    tasks: [{ id: "t1", title: "Grade quizzes", dueDate: "2026-11-07", done: false, priority: "high" }, { id: "t2", title: "Done", dueDate: "2026-11-07", done: true }],
    events: [{ id: "e1", title: "Staff meeting", date: "2026-11-02", start: "15:30", end: "16:30", location: "Library", repeat: "Weekly" }],
    meetings: [{ id: "m1", student: "s1", type: "Annual IEP", date: "2026-11-10", time: "08:00", done: false }],
    schedules: [{ id: "x", student: "s1", day: "Saturday", start: "09:00", end: "09:30", label: "Reading" }],
    notes: [{ id: "n", student: "s1", body: "private note", date: "2026-11-07" }],
  }, "2026-11-07", "Jeremy");
  assert.deepEqual(w.tasks.map((t) => [t.title, t.priority]), [["Grade quizzes", "high"]]);
  assert.deepEqual(w.events.map((e) => `${e.date} ${e.title}`), ["2026-11-09 Staff meeting", "2026-11-10 Annual IEP: Ava Smith"]);
  assert.deepEqual(w.meetings.map((m) => m.student), ["Ava Smith"]);
  assert.deepEqual(w.schedule.map((x) => x.student), ["Ava Smith"]); // Nov 7, 2026 is a Saturday
  assert.deepEqual(w.dueSoon.map((d) => [d.student, d.days]), [["Leo Park", -6], ["Ava Smith", 13]]);
  assert.equal(JSON.stringify(w).includes("private note"), false, "notes never go to the TV");
});

test("the TV's LifeHub apps: grocery, meals, countdowns, birthdays, habits and routines, each only when it's on", () => {
  const family = { sections: { grocery: true, countdowns: true, birthdays: true }, groceries: [{ id: "g", name: "Milk", qty: "1", aisle: "Dairy", checked: false }, { id: "h", name: "Got it", qty: "", aisle: "", checked: true }],
    countdowns: [{ id: "c", title: "Trip", date: "2026-11-19", emoji: "🏜️", color: "#ea580c" }], birthdays: [{ id: "b", name: "Grandma", month: 11, day: 12, year: 1948, kind: "birthday" }] };
  const s = tvSummary({ family }, "2026-11-07");
  assert.deepEqual(s.apps.grocery, [{ name: "Milk", qty: "1", aisle: "Dairy" }]);
  assert.deepEqual(s.apps.countdowns?.map((c) => c.days), [12]);
  assert.deepEqual(s.apps.birthdays?.map((b) => [b.name, b.days, b.turns]), [["Grandma", 5, 78]]);
  assert.equal(s.apps.habits, null, "Habits is off, so the TV has no page for it");
});

test("Arise Fit on the TV: today's numbers, the program day played set by set, routines, timers and history", () => {
  const prog = PROGRAMS[0];
  const s = fitTvSummary({ v: 1, profile: { units: "lb", goal: "lose", activity: 1.4, waterGoalMl: 2400, stepsGoal: 8000 }, workouts: [{ id: "w", date: "2026-11-06T10:00:00Z", name: "Push day", secs: 2400, exercises: [] }],
    routines: [{ id: "r", name: "Leg day", exercises: [{ exId: "squat", name: "Squat", sets: 3, reps: "8", rest: 90 }] }], program: { id: prog.id, started: "2026-11-01", done: [] },
    foods: [], recentFoods: [], water: { "2026-11-07": 750 }, weights: [] }, "2026-11-07", "Jeremy", Date.parse("2026-11-07T20:00:00"));
  assert.deepEqual(s.slots.map((x) => x.id), ["fit.calories", "fit.water", "fit.workouts", "fit.protein", "fit.streak", "fit.weight"]);
  assert.equal(s.program?.dayName, prog.days[0].name);
  assert.ok(s.program!.session.phases.some((p) => p.kind === "rest" && p.cue?.startsWith("Next:")), "rest between sets says what's next");
  assert.equal(s.routines[0].name, "Leg day");
  assert.equal(s.timers.length, TIMER_PRESETS.length);
  assert.deepEqual(s.history.map((h) => [h.name, h.mins]), [["Push day", 40]]);
  assert.equal(s.week.at(-2)?.mins, 40);
  // A set of "8" reps is timed, a "45s" plank is 45 seconds.
  const one = strengthSession("x", "x", "", [{ exId: "plank", name: "Plank", sets: 1, reps: "45s", rest: 30 }]);
  assert.equal(one.phases.find((p) => p.name === "Plank")?.secs, 45);
});

test("the Fit TV app has the built-in timers before anyone signs in, a coach's voice, and a counter you can read", () => {
  assert.deepEqual(JSON.parse(read("native/fit-tv/timers.json")), JSON.parse(JSON.stringify(TIMER_PRESETS.map(timerSession))));
  for (const wf of [".github/workflows/fit-ios.yml", ".github/workflows/companions-sim.yml"]) assert.match(read(wf), /--name FitTV [^\n]*native\/fit-tv\/timers\.json/, wf);
  const tv = read("native/fit-tv/FitTVApp.swift");
  assert.match(tv, /final class FitVoice/);
  assert.match(tv, /AVSpeechSynthesizer\(\)/);
  assert.match(tv, /FitVoice\.shared\.say\("\\\(left\)", interrupt: true\)/, "counts down the last three seconds out loud");
  assert.match(tv, /Text\(clock\(left\)\)\.font\(\.system\(size: 210, weight: \.heavy/);
  assert.match(tv, /JSONSerialization\.data\(withJSONObject: \["app": "fit"\]\)/, "signs in with a TV code");
  assert.match(tv, /"\/api\/fit\/tv\/workout"/);
});

test("Arise Duo on the TV switches between Life and Work, and has the Apps tab", () => {
  const tv = read("native/duo-tv/DuoTVApp.swift");
  assert.match(tv, /hubButton\(\.life, "Life", "heart\.fill"\)/);
  assert.match(tv, /hubButton\(\.work, "Work", "briefcase\.fill"\)/);
  assert.match(tv, /duoAPI\.appending\(path: "\/api\/tv\/work"\)/);
  assert.match(tv, /case weather, grocery, meals, countdowns, birthdays, habits, routines, bills, goals, stars, polls, notes/);
  assert.match(read("server/routes.ts"), /readWorkWorkspace: \(id\) => createSupabaseWorkspaceStore\(\)\.get\(id\)/);
});

test("no number in the watch apps overflows a 32-bit Apple Watch (Series 8 and older)", () => {
  const files = ["native/arise-carplay/ios/Sources/AriseCarPlayPlugin/PodEngine.swift", "native/arise-carplay/ios/Sources/AriseCarPlayPlugin/PodCore.swift", "native/watch-app/PodWatchApp.swift",
    "native/duo-watch/DuoWatchApp.swift", "native/fit-watch/FitWatchApp.swift", "native/notes-watch/NotesWatchApp.swift", "native/watch-kit/AriseWatchLink.swift"];
  for (const f of files) {
    // Nanoseconds made from plain Ints (the multiply happens before UInt64 sees it): crashes on a 32-bit watch.
    assert.doesNotMatch(read(f), /UInt64\(\([^)]*\)\s*\*\s*1_000_000_000\)/, f);
  }
});
