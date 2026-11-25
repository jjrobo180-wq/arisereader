// The admin's reading challenges and parent emails (Nov 25, 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CGMS_TOP_READER_NOV_2026, cleanChallenges, pickChallenge } from "../shared/topReader";
import { audienceOf, childWords, cleanDraft, fillParentEmail, renderParentEmail } from "../shared/parentMessages";

const at = (d: string) => Date.parse(`${d}T18:00:00Z`);

test("challenges are cleaned: real dates, winners 1 to 50, colours, schools", () => {
  const [c] = cleanChallenges([{ id: "Fall Race!", title: "  Fall   Race ", starts: "2026-12-01", lastDay: "2026-12-07", winners: 99, prize: "a book", schoolIds: [4, "4", -1], look: { accent: "nope", background: "#000000" } }]);
  assert.equal(c.id, "fall-race-"); assert.equal(c.title, "Fall Race"); assert.equal(c.winners, 50);
  assert.deepEqual(c.schoolIds, [4]); assert.equal(c.look!.accent, "#ffc93c"); assert.equal(c.look!.background, "#000000");
  assert.equal(c.prizeDay, "2026-12-08");
  assert.deepEqual(cleanChallenges([{ starts: "2026-12-07", lastDay: "2026-12-01" }]), [], "ends before it starts");
});

test("a school sees its running challenge first, then the next one; off ones and other schools' don't show", () => {
  const list = cleanChallenges([
    { id: "a", title: "A", starts: "2026-11-23", lastDay: "2026-11-30", winners: 2, prize: "x", schoolIds: [4] },
    { id: "b", title: "B", starts: "2026-12-05", lastDay: "2026-12-12", winners: 2, prize: "x", schoolIds: [4] },
    { id: "c", title: "C", starts: "2026-11-20", lastDay: "2026-12-20", winners: 2, prize: "x", schoolIds: [7] },
    { id: "d", title: "D", starts: "2026-11-20", lastDay: "2026-12-20", winners: 2, prize: "x", on: false },
  ]);
  assert.equal(pickChallenge(list, 4, at("2026-11-25"))?.id, "a");
  assert.equal(pickChallenge(list, 4, at("2026-12-10"))?.id, "b");
  assert.equal(pickChallenge(list, 9, at("2026-11-25")), null);
  assert.equal(CGMS_TOP_READER_NOV_2026.winners, 2);
});

test("parent emails: each parent's name and children filled in, plain and safe HTML", () => {
  assert.equal(childWords(["Maya Lopez", "Leo Lopez", "Ava"]), "Maya, Leo and Ava");
  assert.equal(childWords([]), "your child");
  const d = cleanDraft({ subject: "For {first_name}", body: "Hi {first_name},\n\n{child_names} is reading <b>great</b>. https://arisereader.com" })!;
  const f = fillParentEmail(d, { name: "Dana Smith", kids: ["Maya Lopez"] });
  assert.equal(f.subject, "For Dana");
  const html = renderParentEmail(f.body);
  assert.match(html, /Maya is reading &lt;b&gt;great&lt;\/b&gt;/);
  assert.match(html, /<a href="https:\/\/arisereader\.com"/);
  assert.equal(cleanDraft({ subject: "", body: "x" }), null);
  const all = [{ id: 1, name: "A", email: "a@x.com", schoolIds: [4], kids: [] }, { id: 2, name: "B", email: "b@x.com", schoolIds: [], kids: [] }];
  assert.deepEqual(audienceOf(all, { kind: "school", schoolId: 4 }).map((p) => p.id), [1]);
  assert.deepEqual(audienceOf(all, { kind: "some", ids: [2] }).map((p) => p.id), [2]);
});

test("the admin has both tools, the server runs saved challenges, and sends one email per parent", () => {
  const admin = readFileSync("client/src/pages/Admin.tsx", "utf8");
  assert.match(admin, /<AdminChallenges token=\{token\} \/>/);
  assert.match(admin, /<AdminParentMessages token=\{token\} \/>/);
  assert.match(readFileSync("server/topReader.ts", "utf8"), /stored \? pickChallenge\(stored, sc\.id, now\) : topReaderForSchool\(sc\.name\)/);
  const send = readFileSync("server/parentMessages.ts", "utf8");
  assert.match(send, /for \(const p of to\) \{/);
  assert.match(send, /deps\.sendEmail\(p\.email,/);
});
