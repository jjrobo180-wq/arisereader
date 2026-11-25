// Prizes only for Conservatory Green Middle School; leaderboards show only your school, others by initials (Nov 25, 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initials, isPrizeSchool, seesFullNames } from "../shared/prizeSchool";

test("only Conservatory Green Middle School wins prizes", () => {
  assert.ok(isPrizeSchool("Conservatory Green Middle School (Denver, CO)"));
  assert.ok(!isPrizeSchool("Conservatory Green High School (Denver, CO)"));
  assert.ok(!isPrizeSchool("Independent Reader- (Available to ALL Kids)  (Click here if your school is not listed)"));
  assert.ok(!isPrizeSchool("DSST: Elevate Northeast Middle School (Denver, CO)"));
  assert.ok(!isPrizeSchool(null));
});

test("names become initials", () => {
  assert.equal(initials("Kimberly Montoya-Mejia"), "K. M.");
  assert.equal(initials("josue quiroga"), "J. Q.");
  assert.equal(initials("Eva Vigil campos"), "E. C.");
  assert.equal(initials("Alan"), "A.");
  assert.equal(initials(""), "Reader");
  assert.ok(seesFullNames({ role: "teacher" }) && seesFullNames({ isAdmin: true }));
  assert.ok(!seesFullNames({ role: "student" }) && !seesFullNames({ role: "parent" }));
});

test("the leaderboard keeps to the viewer's school and hides other children's names", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(routes, /leaderboard = leaderboard\.filter\(\(entry: any\) => only\.has\(schoolOf\(userMap\.get\(entry\.userId \|\| entry\.id\)\)\)\);/);
  assert.match(routes, /const named = fullNames \|\| mineIds\.has\(Number\(uid\)\) \? \{\} : \{/);
  assert.match(routes, /app\.get\("\/api\/prizes\/eligible"/);
  assert.match(readFileSync("server/topReader.ts", "utf8"), /name: staff \|\| r\.id === me \|\| kids\.some\(\(k\) => k\.id === r\.id\) \? r\.name : initials\(r\.name\)/);
});

test("parents: prizes only for CGMS families, no Beginners, no Math/History/Connect offers", () => {
  const tr = readFileSync("client/src/pages/TeacherReader.tsx", "utf8");
  const menu = tr.slice(tr.indexOf("const PARENT_MENU"), tr.indexOf("];", tr.indexOf("const PARENT_MENU")));
  assert.doesNotMatch(menu, /beginners/);
  assert.match(tr, /const parentMenu = PARENT_MENU\.filter\(\(m\) => m\.id !== "prizes" \|\| prizes\);/);
  assert.match(tr, /\{isParent && prizes && view === "prizes" && <>/);
  assert.match(tr, /\{false && LEARNING\.map\(/);
  assert.match(tr, /top readers\{prizes \? " · prize: DoorDash food" : ""\}/);
  assert.doesNotMatch(readFileSync("client/src/components/family-hub/Reader.tsx", "utf8"), /<HubAddons/);
});
