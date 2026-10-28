// A parent's say-so for book quizzes: camera quizzes need a yes by email, and a one-time proctor code works once.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addCode, cleanRecord, decideCamera, emptyRecord, makeOneTimeCode, maskEmail, normalizeCode, requestCamera, useCode,
  ONE_TIME_CODE_MS, MAX_CODES,
} from "../shared/quizPermission";
import { cameraPermissionEmail, oneTimeCodeEmail } from "../server/parentQuizPermission";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const T = "a".repeat(48), T2 = "b".repeat(48);

test("camera quizzes: pending until the parent answers from the link, and a new request replaces the old link", () => {
  let rec = requestCamera(emptyRecord(), "mom@example.com", T, 1);
  assert.equal(rec.camera.status, "pending");
  rec = requestCamera(rec, "dad@example.com", T2, 2);
  assert.equal(decideCamera(rec, T, true, 3), null, "the first link no longer works");
  const yes = decideCamera(rec, T2, true, 3)!;
  assert.equal(yes.camera.status, "approved");
  assert.equal(requestCamera(yes, "x@example.com", T, 4).camera.status, "approved", "asking again doesn't undo a yes");
  assert.equal(decideCamera(rec, T2, false, 3)!.camera.status, "declined");
});

test("one-time codes: readable, work once, expire, and only a few wait at a time", () => {
  let n = 0;
  const code = makeOneTimeCode(() => n++);
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.doesNotMatch(code, /[01OIL]/);
  assert.equal(normalizeCode(" k7qm-2xdp "), "K7QM2XDP");
  let rec = addCode(emptyRecord(), "h1", "mom@example.com", 1000);
  const used = useCode(rec, "h1", 2000)!;
  assert.equal(used.codes.length, 0);
  assert.equal(useCode(used, "h1", 2000), null, "a second use fails");
  assert.equal(useCode(rec, "h1", 1000 + ONE_TIME_CODE_MS + 1), null, "an old code fails");
  assert.equal(cleanRecord(rec, 1000 + ONE_TIME_CODE_MS + 1).codes.length, 0);
  for (let i = 0; i < 6; i++) rec = addCode(rec, `h${i + 2}`, "m@example.com", 1000);
  assert.equal(rec.codes.length, MAX_CODES);
  assert.equal(maskEmail("jordan@gmail.com"), "jo••••@gmail.com");
});

test("the emails carry the approve link, the code and the parent sign-up link", () => {
  const cam = cameraPermissionEmail("Ava", "https://x/#/quiz-permission?token=" + T, "https://x/#/parent-signup?code=AB");
  assert.ok(cam.includes("quiz-permission?token=") && cam.includes("parent-signup?code=AB"));
  const one = oneTimeCodeEmail("Ava", "K7QM-2XDP", "https://x/#/parent-signup?code=AB");
  assert.ok(one.includes("K7QM-2XDP") && one.includes("parent-signup?code=AB") && /once/.test(one));
});

test("wired in: the server checks one-time codes and blocks camera quizzes without a yes; the quiz screen asks for an email", () => {
  const routes = read("server/routes.ts");
  assert.match(routes, /quizPermission\.redeemCode\(req\.user\.id, password\)/);
  assert.match(routes, /cameraAllowed: \(studentId\) => quizPermission\.cameraAllowed\(studentId\)/);
  assert.match(read("server/quizIntegrity.ts"), /needsParentPermission: true/);
  const gate = read("client/src/components/NoProctorGate.tsx");
  for (const s of ["/api/student/quiz-permission", 'emailParent("camera")', 'emailParent("code")', 'view === "askCamera"']) assert.ok(gate.includes(s), s);
  assert.match(read("client/src/App.tsx"), /<Route path="\/quiz-permission">\s*<QuizPermission \/>/);
});
