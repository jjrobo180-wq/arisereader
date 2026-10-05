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
  // real towns: a curly apostrophe from a phone keyboard, and letters with accents
  assert.equal(cleanNewSchool({ name: "O\u2019Fallon Academy", city: "O\u2019Fallon", state: "IL" }).city, "O'Fallon");
  assert.equal(cleanNewSchool({ name: "Escuela Segunda Unidad", city: "Mayagüez", state: "PR" }).city, "Mayagüez");
  assert.equal(cleanNewSchool({ name: "Cañon Academy", city: "Cañon City", state: "CO" }).name, "Cañon Academy");
  bad({ name: "Oak Hill Academy", city: "12345", state: "CO" }, /town or city/);
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
  "170993000009\tLane Technical High School\tChicago\tIL\t9\t12",
  "170993000010\tO Fallon High School\tO Fallon\tIL\t9\t12",
  "290000000011\tEmge Elem.\tO'Fallon\tMO\tK\t5",
  "360000000012\tStuyvesant High School\tNew York\tNY\t9\t12",
  "060000000013\tMain Street Middle\tSoledad\tCA\t6\t8",
].join("\n");
const N = 13;
const names = (r: { schools: Array<{ name: string; city: string }> }) => r.schools.map((s) => `${s.name}, ${s.city}`);

test("the list is searched by name, town, or both, in any order", () => {
  const dir = createSchoolDirectory(ROWS);
  assert.equal(dir.size, N);
  assert.deepEqual(names(dir.search("lincoln elem")), ["Lincoln Elementary School, Denver", "Lincoln Elementary School, Springfield"]);
  assert.deepEqual(names(dir.search("springfield lincoln")), ["Lincoln Elementary School, Springfield"]);
  // names that start with what was typed come first, then names that contain it
  assert.deepEqual(names(dir.search("lincoln")).slice(-1), ["Abraham Lincoln High, San Jose"]);
  // a town on its own finds its schools, after schools named for it
  assert.deepEqual(names(dir.search("denver")), ["Denver School of the Arts, Denver", "CGMS Tigers Academy, Denver", "Lincoln Elementary School, Denver"]);
  assert.deepEqual(names(dir.search("LINCOLN", { state: "IL" })), ["Lincoln Elementary School, Springfield"]);
  assert.deepEqual(names(dir.search("lincoln", { state: "ZZ" })).length, 4, "an unknown state is ignored");
  // the state typed after the name works as if it had been picked
  assert.deepEqual(names(dir.search("lincoln elementary school springfield illinois")), ["Lincoln Elementary School, Springfield"]);
  assert.deepEqual(names(dir.search("stuyvesant high school new york ny")), ["Stuyvesant High School, New York"]);
  assert.deepEqual(names(dir.search("lincoln elementary co")), ["Lincoln Elementary School, Denver"]);
  // a state name inside a school's own name is still just part of the name
  assert.deepEqual(names(dir.search("abraham lincoln high")), ["Abraham Lincoln High, San Jose"]);
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
  // a short form is also matched as typed: "tech" finds Technical, "st" finds Street
  assert.deepEqual(names(dir.search("lane tech")), ["Lane Technical High School, Chicago"]);
  assert.deepEqual(names(dir.search("main st")), ["Main Street Middle, Soledad"]);
  // only short forms typed
  assert.deepEqual(names(dir.search("st hs")), ["Stuyvesant High School, New York"]);
});

test("names like O'Fallon are found however the apostrophe is typed", () => {
  const dir = createSchoolDirectory(ROWS);
  for (const q of ["o'fallon", "o\u2019fallon", "o fallon", "ofallon"]) {
    assert.deepEqual(names(dir.search(q)).sort(), ["Emge Elem., O'Fallon", "O Fallon High School, O Fallon"], q);
  }
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

// teachers the admin has approved
const APPROVED = new Set<number>([50]);

async function setup(t: any) {
  const clock = { now: Date.parse("2026-10-05T18:00:00Z") };
  const settings = new Map<string, string>();
  const db = { down: false, schoolsDown: false };
  const schools: Array<{ id: number; name: string }> = [{ id: 1, name: "CGMS" }, { id: 2, name: "Independent Reader" }, { id: 3, name: "Riverside Charter" }];
  let nextId = 10;
  const app = express();
  app.use(express.json());
  const picker = registerSchoolPickerRoutes(app, {
    directory: createSchoolDirectory(ROWS),
    allSchools: async () => { if (db.schoolsDown) throw new Error("The list of schools could not be read."); return schools.map((s) => ({ ...s })); },
    createSchool: async (name) => { const made = { id: nextId++, name }; schools.push(made); return made; },
    approvedTeacherIds: async () => new Set(APPROVED),
    // like the site's storage: a failed read comes back as ""
    getSetting: async (k) => (db.down ? "" : settings.get(k) ?? ""),
    upsertSetting: async (k, v) => { settings.set(k, v); },
    readSetting: async (k) => { if (db.down) throw new Error("database unreachable"); return settings.get(k) ?? ""; },
    now: () => clock.now,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const get = async (q: string, state = "", extra = "") => fetch(`${base}/api/schools/search?q=${encodeURIComponent(q)}${state ? `&state=${state}` : ""}${extra}`);
  const search = async (q: string, state = "", extra = "") => (await (await get(q, state, extra)).json()) as any;
  return { picker, schools, settings, search, get, clock, db };
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

test("a typed school that is really in the US list is not added twice", async (t) => {
  const { picker, schools } = await setup(t);
  // typed a little differently from the list
  const listed = await picker.pick({ newSchool: { name: "st. marys academy", city: "englewood", state: "CO" } }, "teacher");
  assert.deepEqual(listed, { schoolId: 10, schoolName: "St Mary's Academy (Englewood, CO)", added: "directory" });
  // the same name typed again in the same town is the same school
  const first = await picker.pick({ newSchool: { name: "Oak Hill Academy", city: "Denver", state: "CO" } }, "teacher");
  const second = await picker.pick({ newSchool: { name: "OAK HILL  academy", city: "denver", state: "CO" } }, "teacher");
  assert.equal(first.schoolId, second.schoolId);
  assert.equal(schools.length, 5);
});

test("a typed name never attaches a teacher to a different school that happens to share it", async (t) => {
  const { picker, schools } = await setup(t);
  // "Riverside Charter" is on the site with no town. A teacher in Portland types the same name: that is another school.
  const other = await picker.pick({ newSchool: { name: "Riverside Charter", city: "Portland", state: "OR" } }, "teacher");
  assert.deepEqual(other, { schoolId: 10, schoolName: "Riverside Charter (Portland, OR)", added: "teacher" });
  // typing "CGMS" does not join the site's CGMS, and is not free by its name (it came from sign-up)
  const cgms = await picker.pick({ newSchool: { name: "CGMS", city: "Dallas", state: "TX" } }, "teacher");
  assert.notEqual(cgms.schoolId, 1);
  assert.equal(await picker.addedAtSignup(cgms.schoolId!), true);
  assert.equal(schools.length, 5);
});

test("a typed name can't be shaped to take over a real school's entry", async (t) => {
  const { picker } = await setup(t);
  // "X High School New" in the town of "York" reads the same as "X High School" in "New York" once punctuation is dropped
  const fake = await picker.pick({ newSchool: { name: "Stuyvesant High School New", city: "York", state: "NY" } }, "teacher");
  assert.equal(fake.added, "teacher");
  const real = await picker.pick({ directorySchool: "360000000012" }, "student");
  assert.notEqual(real.schoolId, fake.schoolId);
  assert.deepEqual([real.schoolName, real.added], ["Stuyvesant High School (New York, NY)", "directory"]);
  assert.ok((await picker.visibleSchools()).some((sc) => sc.id === real.schoolId));
  assert.ok(!(await picker.visibleSchools()).some((sc) => sc.id === fake.schoolId));
});

test("a typed school is hidden from everyone else until its teacher is approved", async (t) => {
  const { picker, search, settings } = await setup(t);
  t.after(() => { APPROVED.delete(52); });
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
  APPROVED.add(52);
  assert.deepEqual((await search("oak hill")).onSite, [{ id: made.schoolId, name: "Oak Hill Academy (Denver, CO)" }]);
  assert.equal((await picker.pick({ schoolId: made.schoolId }, "student")).schoolId, made.schoolId);

  // that teacher's account is removed later: the school, which has students by now, stays up
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(JSON.parse(settings.get("schools_from_signup")!)[String(made.schoolId)].shown, true);
  APPROVED.delete(52);
  assert.ok((await picker.visibleSchools()).some((s) => s.id === made.schoolId));
  // and a teacher who types it now just joins it
  assert.deepEqual(await picker.pick({ newSchool: { name: "Oak Hill Academy", city: "Denver", state: "CO" } }, "teacher"), { schoolId: made.schoolId, schoolName: "Oak Hill Academy (Denver, CO)", added: null });
});

test("a database hiccup never un-hides a school or wipes the records", async (t) => {
  const { picker, get, settings, db, schools } = await setup(t);
  const hiddenOne = await picker.pick({ newSchool: { name: "Oak Hill Academy", city: "Denver", state: "CO" } }, "teacher");
  await picker.pick({ directorySchool: "080336000001" }, "student");
  const before = [settings.get("schools_from_signup"), settings.get("school_directory_links")];

  db.down = true;
  // wait out the few seconds a read is remembered for
  const later = await setup(t);
  later.settings.set("schools_from_signup", before[0]!);
  later.db.down = true;
  await assert.rejects(() => later.picker.visibleSchools(), /database unreachable/);
  await assert.rejects(() => later.picker.addedAtSignup(hiddenOne.schoolId!), /database unreachable/);
  await assert.rejects(() => later.picker.pick({ directorySchool: "170993000003" }, "student"), /database unreachable/);
  assert.equal((await later.get("oak hill")).status, 500, "the search says it isn't working instead of showing hidden schools");
  assert.equal(later.settings.get("schools_from_signup"), before[0], "nothing was rewritten");

  // the school list itself failing to load stops a pick too, instead of making a duplicate
  db.down = false; db.schoolsDown = true;
  const count = schools.length;
  await assert.rejects(() => picker.pick({ directorySchool: "080336000001" }, "student"), /could not be read/);
  assert.equal(schools.length, count);
  assert.equal((await get("lincoln")).status, 500);
});

test("the admin can match one of the site's schools to its entry in the US list", async (t) => {
  const { picker, search, schools } = await setup(t);
  // before: someone who searches the full name and picks it would start a second school
  assert.deepEqual((await search("denver school of the arts")).onSite, []);
  const entry = await picker.link(1, "080336000006");
  assert.equal(entry!.name, "Denver School of the Arts");
  assert.deepEqual(await picker.linkedEntries(), { 1: entry });

  // now the full name leads to the site's school, shown once under the site's own name
  const found = await search("denver school of the arts");
  assert.deepEqual([found.onSite, found.directory], [[{ id: 1, name: "CGMS" }], []]);
  assert.deepEqual(await picker.pick({ directorySchool: "080336000006" }, "teacher"), { schoolId: 1, schoolName: "CGMS", added: "directory" });
  assert.equal(schools.length, 3, "no second school");
  assert.equal(await picker.addedAtSignup(1), false, "and it is still the admin's own school");
  // the admin's tool sees the US list as it is
  assert.deepEqual((await search("denver school of the arts", "", "&only=us")).directory.map((x: any) => [x.name, x.schoolId]), [["Denver School of the Arts", 1]]);

  // one US-list school can't be matched to two of the site's schools
  await assert.rejects(() => picker.link(3, "080336000006"), /already linked to “CGMS”/);
  await assert.rejects(() => picker.link(999, "080336000006"), SchoolPickError);
  await assert.rejects(() => picker.link(1, "999999999999"), SchoolPickError);
  // changing the match drops the old one; removing it clears it
  await picker.link(1, "080336000001");
  assert.deepEqual(Object.values(await picker.linkedEntries()).map((e) => e.key), ["080336000001"]);
  await picker.link(1, null);
  assert.deepEqual(await picker.linkedEntries(), {});
});

test("the search shows the site's own schools first, then the US list", async (t) => {
  const { picker, search } = await setup(t);
  const empty = await search("c");
  assert.deepEqual([empty.onSite, empty.directory, empty.total], [[], [], N]);

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
