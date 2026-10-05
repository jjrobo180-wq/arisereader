import test from "node:test";
import assert from "node:assert/strict";
import { createSchoolDirectory } from "../server/schoolDirectory";
import { schoolInitials, mayBeInitials } from "../shared/schoolNames";
import { isFreeSchoolName } from "../shared/plans";

const ROWS = [
  "080336006730\tDSST: Conservatory Green High School\tDenver\tCO\t9\t12",
  "080336006618\tDSST: Conservatory Green Middle School\tDenver\tCO\t6\t8",
  "080336000001\tThomas Jefferson High School\tDenver\tCO\t9\t12",
  "080336000002\tGreen Valley Elementary\tDenver\tCO\tK\t5",
  "080336000003\tCentral Middle School\tGrand Junction\tCO\t6\t8",
  "170000000001\tSchool of the Arts\tChicago\tIL\t9\t12",
].join("\n");

test("a school's initials leave out the town and any leading words", () => {
  const got = schoolInitials("DSST: Conservatory Green Middle School (Denver, CO)");
  assert.ok(got.includes("dcgms"));
  assert.ok(got.includes("cgms"));
  assert.ok(!got.some((t) => t.includes("d") && t.endsWith("c") && t.length > 5), "the town is not part of the initials");
  assert.deepEqual(schoolInitials("Mile High Academy"), ["mha"]);
  assert.deepEqual(schoolInitials("Two Words"), []);
  assert.ok(schoolInitials("School of the Arts").includes("sota"));
  assert.ok(schoolInitials("School of the Arts").includes("sa") === false, "initials are at least three letters");
});

test("typing a school's initials finds it", () => {
  const dir = createSchoolDirectory(ROWS);
  const cgms = dir.search("cgms").schools.map((s) => s.name);
  assert.equal(cgms[0], "DSST: Conservatory Green Middle School");
  assert.ok(!cgms.includes("DSST: Conservatory Green High School"));
  assert.equal(dir.search("CGMS").schools[0]?.key, "080336006618", "capitals work too");
  assert.equal(dir.search("tjhs").schools[0]?.name, "Thomas Jefferson High School");
  assert.equal(dir.search("sota").schools[0]?.name, "School of the Arts");
  assert.equal(dir.search("cgms denver").schools[0]?.name, "DSST: Conservatory Green Middle School", "initials and a town");
  assert.equal(dir.search("cgms", { state: "IL" }).schools.length, 0, "the state filter still applies");
});

test("names still come before initials, and plain searches work as before", () => {
  const dir = createSchoolDirectory(ROWS);
  const green = dir.search("green").schools.map((s) => s.name);
  assert.equal(green[0], "Green Valley Elementary");
  assert.ok(green.includes("DSST: Conservatory Green Middle School"));
  assert.equal(dir.search("conservatory green middle").schools[0]?.name, "DSST: Conservatory Green Middle School");
  assert.equal(dir.search("central ms").schools[0]?.name, "Central Middle School");
  assert.equal(dir.search("zzzz").schools.length, 0);
});

test("only words that could be initials are tried as initials", () => {
  assert.equal(mayBeInitials("cgms"), true);
  assert.equal(mayBeInitials("ms"), false);
  assert.equal(mayBeInitials("123"), false);
  assert.equal(mayBeInitials("conservatory"), false);
});

test("CGMS stays a free school under its full name", () => {
  assert.equal(isFreeSchoolName("Conservatory Green Middle School (Denver, CO)"), true);
  assert.equal(isFreeSchoolName("Conservatory Green Middle School"), true);
  assert.equal(isFreeSchoolName("CGMS Hornets"), true);
  assert.equal(isFreeSchoolName("Mile High Academy (Denver, CO)"), false);
});
