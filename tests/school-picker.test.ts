// Picking a school at sign-up: the US school list, its search, and the rules for adding a school.
// Run with: npx tsx --test tests/school-picker.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createSchoolDirectory, usSchoolDirectory } from "../server/schoolDirectory";
import { registerSchoolPickerRoutes, SchoolPickError } from "../server/schoolPicker";
import { cleanNewSchool, foldSchoolText, gradeSpan, schoolDisplayName, SchoolNameError, US_STATES } from "../shared/schoolNames";
import { registerPlanRoutes } from "../server/plans";

// ─── Names ───────────────────────────────────────────────────────────────────

test("names are compared without case, accents or punctuation", () => {
  assert.equal(foldSchoolText("St. Mary's  Académie"), "st marys academie");
  assert.equal(foldSchoolText("O'Brien-Lincoln H.S."), "obrien lincoln hs");
  assert.equal(foldSchoolText(null), "");
  assert.equal(schoolDisplayName("Lincoln Elementary", "Springfield", "IL"), "Lincoln Elementary (Springfield, IL)");
  assert.equal(schoolDisplayName("Lincoln Elementary", "", "IL"), "Lincoln Elementary (IL)");
  assert.equal(gradeSpan("PK", "5"), "Pre-K to 5");
  assert.equal(gradeSpan("9", "12"), "9 to 12");
  assert.equal(gradeSpan("K", "K"), "K");
  assert.equal(gradeSpan("", ""), "");
  assert.equal(US_STATES.length, 56);
});

test("a school a teacher types has to look like a school", () => {
  assert.deepEqual(cleanNewSchool({ name: "  Oak   Hill Academy ", city: "denver", state: "co" }), { name: "Oak Hill Academy", city: "denver", state: "CO" });
  const bad = (input: any, why: RegExp) => assert.throws(() => cleanNewSchool(input), (e: any) => e instanceof SchoolNameError && why.test(e.message), JSON.stringify(input));
  bad({ name: "AB", city: "Denver", state: "CO" }, /full name/);
  bad({ name: "12345", city: "Denver", state: "CO" }, /full name/);
  bad({ name: "Oak Hill Academy", city: "", state: "CO" }, /town or city/);
  bad({ name: "Oak Hill Academy", city: "Denver", state: "ZZ" }, /state/);
  bad({ name: "Oak Hill Academy", city: "Denver" }, /state/);
  bad({ name: "Visit www.example.com", city: "Denver", state: "CO" }, /just the school/);
  bad({ name: "<b>Oak</b> Hill", city: "Denver", state: "CO" }, /just the school/);
  bad({ name: "Shit School", city: "Denver", state: "CO" }, /doesn't look like/);
  bad({ name: "S​hit School", city: "Denver", state: "CO" }, /doesn't look like/);
  bad(null, /full name/);
  // long names are cut, not refused
  assert.equal(cleanNewSchool({ name: "A".repeat(300), city: "Denver", state: "CO" }).name.length, 80);
});

// ─── The list and its search ─────────────────────────────────────────────────

const ROWS = [
  "080336000001\tLincoln Elementary School\tDenver\tCO\tPK\t5",
  "080336000002\tLincoln Middle School\tFort Collins\tCO\t6\t8",
  "170993000003\tLincoln Elementary School\tSpringfield\tIL\tK\t5",
  "483882000004\tSan Diego H S\tSan Diego\tTX\t9\t12",
  "A0900641\tSt Mary's Academy\tEnglewood\tCO\tPK\t12",
  "080336000006\tDenver School of the Arts\tDenver\tCO\t6\t12",
  "060000000007\tAbraham Lincoln High\tSan Jose\tCA\t9\t12",
  "080336000008\tCGMS Tigers Academy\tDenver\tCO\t6\t8",
].join("\n");
const names = (r: { schools: Array<{ name: string; city: string }> }) => r.schools.map((s) => `${s.name}, ${s.city}`);

test("the list is searched by name, town, or both, in any order", () => {
  const dir = createSchoolDirectory(ROWS);
  assert.equal(dir.size, 8);
  assert.deepEqual(names(dir.search("lincoln elem")), ["Lincoln Elementary School, Denver", "Lincoln Elementary School, Springfield"]);
  assert.deepEqual(names(dir.search("springfield lincoln")), ["Lincoln Elementary School, Springfield"]);
  // names that start with what was typed come first, then names that contain it
  assert.deepEqual(names(dir.search("lincoln")).slice(-1), ["Abraham Lincoln High, San Jose"]);
  // a town on its own finds its schools, after schools named for it
  assert.deepEqual(names(dir.search("denver")), ["Denver School of the Arts, Denver", "CGMS Tigers Academy, Denver", "Lincoln Elementary School, Denver"]);
  assert.deepEqual(names(dir.search("LINCOLN", { state: "IL" })), ["Lincoln Elementary School, Springfield"]);
  assert.deepEqual(names(dir.search("lincoln", { state: "ZZ" })).length, 4, "an unknown state is ignored");
  assert.deepEqual(names(dir.search("zzzz")), []);
});

test("short forms and full words find each other", () => {
  const dir = createSchoolDirectory(ROWS);
  assert.deepEqual(names(dir.search("san diego high school")), ["San Diego H S, San Diego"]);
  assert.deepEqual(names(dir.search("san diego hs")), ["San Diego H S, San Diego"]);
  assert.deepEqual(names(dir.search("saint marys")), ["St Mary's Academy, Englewood"]);
  assert.deepEqual(names(dir.search("st. mary's")), ["St Mary's Academy, Englewood"]);
  assert.deepEqual(names(dir.search("lincoln ms")), ["Lincoln Middle School, Fort Collins"]);
  assert.deepEqual(names(dir.search("ft collins")), ["Lincoln Middle School, Fort Collins"]);
});

test("one letter is not a search, and results are capped", () => {
  const dir = createSchoolDirectory(ROWS);
  assert.deepEqual(dir.search("l"), { schools: [], more: false });
  assert.deepEqual(dir.search("   "), { schools: [], more: false });
  assert.deepEqual(dir.search(null), { schools: [], more: false });
  const few = dir.search("lincoln", { limit: 2 });
  assert.deepEqual([few.schools.length, few.more], [2, true]);
});

test("a school is looked up by its id, and found by its exact name and town", () => {
  const dir = createSchoolDirectory(ROWS);
  assert.deepEqual(dir.get("A0900641"), { key: "A0900641", name: "St Mary's Academy", city: "Englewood", state: "CO", grades: "Pre-K to 12", private: true });
  assert.equal(dir.get("080336000001")!.private, false);
  for (const bad of ["", "nope", "../../etc", 5, null, "080336000001; drop"]) assert.equal(dir.get(bad), null, String(bad));
  assert.equal(dir.find("st. marys academy", "ENGLEWOOD", "CO")!.key, "A0900641");
  assert.equal(dir.find("St Mary's Academy", "Englewood", "TX"), null);
  assert.equal(dir.find("St Mary's", "Englewood", "CO"), null, "part of a name is not a match");
  assert.equal(createSchoolDirectory("").search("lincoln").schools.length, 0, "an empty list still works");
});

test("the real list holds the country's schools and answers quickly", () => {
  const dir = usSchoolDirectory();
  assert.ok(dir.size > 120_000, `only ${dir.size} schools`);
  const first = dir.search("lincoln elementary", { state: "CO" });
  assert.ok(first.schools.length > 0 && first.schools.every((s) => s.state === "CO" && /lincoln/i.test(s.name)));
  // every state has schools
  for (const [code] of US_STATES) assert.ok(dir.search("school", { state: code, limit: 1 }).schools.length === 1, code);
  // names came out in ordinary capitals, not shouting
  const sample = dir.search("high school", { state: "NY", limit: 50 }).schools;
  assert.ok(sample.filter((s) => s.name === s.name.toUpperCase()).length < 3, "names should be re-cased");
  // a private school
  assert.ok(dir.search("academy", { limit: 50 }).schools.length === 50);
  const started = Date.now();
  for (const q of ["washington", "st mary", "jefferson middle", "a b", "the school of", "zz top"]) dir.search(q);
  assert.ok(Date.now() - started < 1500, `six searches took ${Date.now() - started}ms`);
});

// ─── Sign-up rules, over the real route ──────────────────────────────────────

const USERS: Record<number, any> = {
  50: { id: 50, role: "teacher", accountApproved: true },
  51: { id: 51, role: "teacher", accountApproved: false },
  52: { id: 52, role: "teacher", accountApproved: false },
};

async function setup(t: any) {
  const clock = { now: Date.parse("2026-10-05T18:00:00Z") };
  const settings = new Map<string, string>();
  const schools: Array<{ id: number; name: string }> = [{ id: 1, name: "CGMS" }, { id: 2, name: "Independent Reader" }, { id: 3, name: "Riverside Charter" }];
  let nextId = 10;
  const app = express();
  app.use(express.json());
  const picker = registerSchoolPickerRoutes(app, {
    directory: createSchoolDirectory(ROWS),
    allSchools: async () => schools.map((s) => ({ ...s })),
    createSchool: async (name) => { const made = { id: nextId++, name }; schools.push(made); return made; },
    getUser: async (id) => USERS[id] ?? null,
    getSetting: async (k) => settings.get(k) ?? "",
    upsertSetting: async (k, v) => { settings.set(k, v); },
    now: () => clock.now,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const search = async (q: string, state = "") => (await (await fetch(`${base}/api/schools/search?q=${encodeURIComponent(q)}${state ? `&state=${state}` : ""}`)).json()) as any;
  return { picker, schools, settings, search, clock };
}

test("picking a school from the US list adds it to the site once, with its town in the name", async (t) => {
  const { picker, schools } = await setup(t);
  const first = await picker.pick({ directorySchool: "080336000001" }, "student");
  assert.deepEqual(first, { schoolId: 10, schoolName: "Lincoln Elementary School (Denver, CO)", added: "directory" });
  // a second person picking it gets the same school
  const again = await picker.pick({ directorySchool: "080336000001" }, "teacher");
  assert.equal(again.schoolId, 10);
  // two people at the same moment
  const [a, b] = await Promise.all([picker.pick({ directorySchool: "170993000003" }, "student"), picker.pick({ directorySchool: "170993000003" }, "student")]);
  assert.equal(a.schoolId, b.schoolId);
  assert.deepEqual(schools.map((s) => s.name).slice(3), ["Lincoln Elementary School (Denver, CO)", "Lincoln Elementary School (Springfield, IL)"]);
  await assert.rejects(() => picker.pick({ directorySchool: "999999999999" }, "student"), SchoolPickError);
});

test("a school already on the site is picked by its id; an unknown id is refused", async (t) => {
  const { picker } = await setup(t);
  assert.deepEqual(await picker.pick({ schoolId: 1 }, "student"), { schoolId: 1, schoolName: "CGMS", added: null });
  assert.deepEqual(await picker.pick({ schoolId: "3" }, "teacher"), { schoolId: 3, schoolName: "Riverside Charter", added: null });
  await assert.rejects(() => picker.pick({ schoolId: 999 }, "student"), SchoolPickError);
  await assert.rejects(() => picker.pick({ schoolId: 2 }, "student"), SchoolPickError, "the old Independent Reader entry is not a school");
  assert.deepEqual(await picker.pick({}, "student"), { schoolId: null, schoolName: "", added: null });
});

test("a teacher can type a school that is missing; a student cannot", async (t) => {
  const { picker, schools } = await setup(t);
  const typed = { name: "Oak Hill Academy", city: "Denver", state: "CO" };
  const made = await picker.pick({ newSchool: typed }, "teacher");
  assert.deepEqual(made, { schoolId: 10, schoolName: "Oak Hill Academy (Denver, CO)", added: "teacher" });
  // a student sending the same thing gets no school at all
  const before = schools.length;
  assert.deepEqual(await picker.pick({ newSchool: { ...typed, name: "Kids Made This" } }, "student"), { schoolId: null, schoolName: "", added: null });
  assert.equal(schools.length, before);
  await assert.rejects(() => picker.pick({ newSchool: { name: "x", city: "Denver", state: "CO" } }, "teacher"), /full name/);
  await assert.rejects(() => picker.pick({ newSchool: { name: "Independent", city: "Denver", state: "CO" } }, "teacher"), /full name/);
});

test("a typed school that is really in the US list, or already on the site, is not added twice", async (t) => {
  const { picker, schools } = await setup(t);
  // typed a little differently from the list
  const listed = await picker.pick({ newSchool: { name: "st. marys academy", city: "englewood", state: "CO" } }, "teacher");
  assert.deepEqual(listed, { schoolId: 10, schoolName: "St Mary's Academy (Englewood, CO)", added: "directory" });
  // typed the name of a school the site already has
  const onSite = await picker.pick({ newSchool: { name: "riverside charter", city: "Denver", state: "CO" } }, "teacher");
  assert.deepEqual(onSite, { schoolId: 3, schoolName: "Riverside Charter", added: null });
  const cgms = await picker.pick({ newSchool: { name: "CGMS", city: "Denver", state: "CO" } }, "teacher");
  assert.equal(cgms.schoolId, 1);
  assert.equal(schools.length, 4);
});

test("a typed school is hidden from everyone else until its teacher is approved", async (t) => {
  const { picker, search } = await setup(t);
  const made = await picker.pick({ newSchool: { name: "Oak Hill Academy", city: "Denver", state: "CO" } }, "teacher");
  await picker.setAddedBy(made.schoolId!, 51); // teacher 51 is still waiting for approval
  assert.deepEqual((await search("oak hill")).onSite, []);
  assert.ok(!(await picker.visibleSchools()).some((s) => s.id === made.schoolId));
  await assert.rejects(() => picker.pick({ schoolId: made.schoolId }, "student"), SchoolPickError, "can't be joined by id either");

  // a second teacher from the same school types it too, and joins the same entry
  const second = await picker.pick({ newSchool: { name: "oak hill academy", city: "DENVER", state: "CO" } }, "teacher");
  assert.deepEqual([second.schoolId, second.added], [made.schoolId, "teacher"]);
  await picker.setAddedBy(second.schoolId!, 52);

  // the admin approves one of them
  USERS[52].accountApproved = true;
  t.after(() => { USERS[52].accountApproved = false; });
  assert.deepEqual((await search("oak hill")).onSite, [{ id: made.schoolId, name: "Oak Hill Academy (Denver, CO)" }]);
  assert.equal((await picker.pick({ schoolId: made.schoolId }, "student")).schoolId, made.schoolId);
});

test("the search shows the site's own schools first, then the US list", async (t) => {
  const { picker, search } = await setup(t);
  const empty = await search("c");
  assert.deepEqual([empty.onSite, empty.directory, empty.total], [[], [], 8]);

  const cgms = await search("cgms");
  assert.deepEqual(cgms.onSite, [{ id: 1, name: "CGMS" }]);
  assert.deepEqual(cgms.directory.map((s: any) => s.name), ["CGMS Tigers Academy"]);

  // the old Independent Reader entry is never offered
  assert.deepEqual((await search("independent")).onSite, []);

  // once picked, a US-list school shows once, as the site's school
  await picker.pick({ directorySchool: "080336000001" }, "student");
  const lincoln = await search("lincoln elementary");
  assert.deepEqual(lincoln.onSite, [{ id: 10, name: "Lincoln Elementary School (Denver, CO)" }]);
  assert.deepEqual(lincoln.directory.map((s: any) => `${s.name}, ${s.city}`), ["Lincoln Elementary School, Springfield"]);
  // the state filter keeps the site's older entries that don't name a state
  assert.deepEqual((await search("riverside", "TX")).onSite, [{ id: 3, name: "Riverside Charter" }]);
  assert.deepEqual((await search("lincoln elementary", "IL")).onSite, []);
});

test("there is a ceiling on new schools per hour, and sign-up still goes through", async (t) => {
  const { picker, schools, clock } = await setup(t);
  for (let i = 0; i < 40; i++) {
    const made = await picker.pick({ newSchool: { name: `Test Academy Number ${"abcdefghijklmnopqrstuvwxyzabcdefghijklmnop"[i]}${i < 26 ? "" : "x"}`, city: "Denver", state: "CO" } }, "teacher");
    assert.equal(made.added, "teacher", String(i));
  }
  const count = schools.length;
  const over = await picker.pick({ newSchool: { name: "One Too Many Academy", city: "Denver", state: "CO" } }, "teacher");
  assert.deepEqual(over, { schoolId: null, schoolName: "One Too Many Academy (Denver, CO)", added: null });
  assert.equal(schools.length, count);
  // an hour later there is room again
  clock.now += 61 * 60_000;
  assert.equal((await picker.pick({ newSchool: { name: "One Too Many Academy", city: "Denver", state: "CO" } }, "teacher")).added, "teacher");
});

test("a school added at sign-up is never free just because of its name", async (t) => {
  const { picker, schools, settings } = await setup(t);
  // "CGMS Tigers Academy" is in the US list; picking it must not hand out free Premium
  const picked = await picker.pick({ directorySchool: "080336000008" }, "teacher");
  assert.equal(await picker.addedAtSignup(picked.schoolId!), true);
  assert.equal(await picker.addedAtSignup(1), false, "the site's own CGMS");

  settings.set("plans_enforced", "1");
  const app = express();
  app.use(express.json());
  const teachers: Record<number, any> = {
    60: { id: 60, role: "teacher", createdAt: "2026-10-03T15:00:00Z", school_id: 1 },
    61: { id: 61, role: "teacher", createdAt: "2026-10-03T15:00:00Z", school_id: picked.schoolId },
  };
  const plans = registerPlanRoutes(app, (_q: any, _s: any, n: any) => n(), (_q: any, _s: any, n: any) => n(), {
    getSetting: async (k) => settings.get(k) ?? "", upsertSetting: async (k, v) => { settings.set(k, v); },
    userForToken: async () => null, getUser: async (id) => teachers[id] ?? null,
    countTeacherStudents: async () => 10, countSchoolStudents: async () => 10,
    schoolName: async (id) => schools.find((s) => s.id === id)?.name ?? "",
    freeByNameAllowed: async (id) => !(await picker.addedAtSignup(id)),
  });
  assert.equal((await plans.entitlement(teachers[60])).premium, true, "a CGMS teacher");
  assert.equal((await plans.entitlement(teachers[61])).premium, false, "a teacher at a school that only has CGMS in its name");
});
