import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { HELP, HELP_SECTIONS, boldParts, plain, searchHelp } from "../shared/readerHelp";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** Every .tsx file the teacher's Reader is built from. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const p = join(dir, name);
    if (statSync(join(root, p)).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !p.includes("ReaderHelp.tsx")) out.push(read(p));
  }
  return out;
}
const app = [...sources("client/src/pages"), ...sources("client/src/components")].join("\n");

/** Button names the app builds from a template, with the source that builds them. */
const BUILT: Record<string, RegExp> = {
  "Open your WorkHub": /Open your \{hub\.name\}[\s\S]*work: \{\s*name: "WorkHub"|work: \{\s*name: "WorkHub"[\s\S]*Open your \{hub\.name\}/,
};
const inApp = (label: string) => app.includes(label) || (BUILT[label]?.test(read("client/src/pages/TeacherReader.tsx")) ?? false);

test("every button name in bold is really in the app", () => {
  const missing: string[] = [];
  for (const e of HELP) {
    for (const text of [e.a, ...(e.steps || []), ...(e.notes || [])]) {
      for (const p of boldParts(text)) if (p.bold && !inApp(p.text)) missing.push(`${e.id}: "${p.text}"`);
    }
  }
  assert.deepEqual(missing, []);
});

test("every bold mark is closed", () => {
  for (const e of HELP) for (const text of [e.a, ...(e.steps || []), ...(e.notes || [])]) {
    assert.equal((text.match(/\*\*/g) || []).length % 2, 0, `${e.id}: ${text}`);
  }
});

test("every answer opens a real item in the teacher's Reader menu, and the menu has Help & FAQ", () => {
  const page = read("client/src/pages/TeacherReader.tsx");
  const menu = page.slice(page.indexOf("const MENU:"), page.indexOf("];", page.indexOf("const MENU:")));
  const ids = [...menu.matchAll(/id: "([A-Za-z]+)"/g)].map((m) => m[1]);
  for (const e of HELP) if (e.open) assert.ok(ids.includes(e.open), `${e.id} opens "${e.open}", which isn't in the menu`);
  assert.ok(ids.includes("help"));
  assert.match(page, /view === "help" && <Suspense/);
  assert.match(page, /view !== "help" && \(/, "Help isn't also drawn as a Reader tool screen");
});

test("ids are unique and every section has answers", () => {
  assert.equal(new Set(HELP.map((e) => e.id)).size, HELP.length);
  for (const s of HELP_SECTIONS) assert.ok(HELP.some((e) => e.section === s), s);
  for (const e of HELP) assert.ok(e.q.endsWith("?"), e.id);
});

test("the facts match the app's own rules", () => {
  const byId = (id: string) => { const e = HELP.find((x) => x.id === id)!; return plain([e.a, ...(e.steps || []), ...(e.notes || [])].join(" ")); };
  // Passing is 70% (server/storage.ts), writing is worth up to COMPREHENSION.bonusPoints, passwords need 4 characters.
  assert.match(read("server/storage.ts"), /Math\.ceil\(total \* 0\.70?\)/);
  assert.match(byId("passing"), /70%/);
  assert.match(read("shared/comprehension.ts"), /bonusPoints: 10,/);
  assert.match(byId("grade-writing"), /up to 10 extra points/);
  assert.match(read("client/src/components/teacher-hub/HubReaderTools.tsx"), /pw\.length < 4/);
  assert.match(byId("reset-password"), /at least 4 characters/);
  // Bulk add puts a teacher's students in their own class, with the student number as username and password.
  assert.match(read("server/routes.ts"), /let teacherId = isBulkAdmin[\s\S]{0,140}: req\.user\.id;/);
  assert.match(byId("add-students"), /username and starting password are both their student number/);
  assert.match(read("client/src/components/hub-pieces/HubCameraQuizzes.tsx"), /Pictures are kept for 30 days/);
});

test("search finds the right answer first", () => {
  const first = (q: string) => searchHelp(q)[0]?.id;
  assert.equal(first("reset password"), "reset-password");
  assert.equal(first("forgot pw"), "reset-password");
  assert.equal(first("How do I add my students?"), "add-students");
  assert.equal(first("csv"), "add-students");
  assert.equal(first("parent code"), "parent-letters");
  assert.equal(first("email parent"), "email-parent");
  assert.equal(first("grade writing"), "grade-writing");
  assert.equal(first("proctor"), "proctor-code");
  assert.equal(first("duplicate"), "duplicates");
  assert.equal(first("kahoot"), "live-quiz");
  assert.equal(first("ELL"), "english");
  assert.equal(first("lock games"), "game-time");
  assert.equal(first("homework pass"), "prizes");
  assert.equal(first("poster"), "advisory-challenge");
  assert.equal(first("Grade Changes"), "grade-changes");
  assert.equal(first("parás"), "para-team");
});

test("search: every word must match, empty shows everything, nonsense shows nothing", () => {
  assert.equal(searchHelp("").length, HELP.length);
  assert.equal(searchHelp("   ").length, HELP.length);
  assert.deepEqual(searchHelp("zzqx"), []);
  assert.deepEqual(searchHelp("password zzqx"), []);
  // Only little words: nothing to look for, so no answers rather than all of them.
  assert.deepEqual(searchHelp("how do i"), []);
  for (const e of searchHelp("parent")) assert.match(plain(JSON.stringify(e)).toLowerCase(), /parent|family|guardian/);
});

test("bold parts split cleanly", () => {
  assert.deepEqual(boldParts("Click **Add students** now"), [{ text: "Click ", bold: false }, { text: "Add students", bold: true }, { text: " now", bold: false }]);
  assert.equal(plain("**A** and **B**"), "A and B");
});
