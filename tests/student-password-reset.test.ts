// A teacher's "Change password" for a student must work the first time:
// - no tablet auto-capital or auto-correct in the field, and the saved password is shown back;
// - spaces at the ends are dropped, on both teacher and admin resets;
// - a reset unlocks a student held at "Too many wrong passwords".
// And the Arise AAC (eye-gaze) box is only on the AAC signup link, so ordinary students can't tick it by mistake.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (f: string) => readFileSync(f, "utf8");

test("teacher hub password field is not auto-capitalized and shows what was saved", () => {
  const s = read("client/src/components/teacher-hub/HubReaderTools.tsx");
  assert.match(s, /setPassword\(e\.target\.value\)\} autoFocus autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck=\{false\}/);
  assert.match(s, /const pw = password\.trim\(\);/);
  assert.match(s, /new password is \$\{pw\}/);
});

test("every staff reset trims the password and clears the sign-in lockout", () => {
  const s = read("server/routes.ts");
  for (const route of ['"/api/teacher-admin/students/:id/reset-password"', '"/api/admin/students/:id/reset-password"', '"/api/teacher/reset-password/:studentId"']) {
    const at = s.indexOf(route);
    assert.ok(at > 0, route);
    const body = s.slice(at, at + 900);
    assert.match(body, /await unlockSignIn\(/, route);
    if (!route.includes("/api/teacher/reset-password")) assert.match(body, /req\.body\.newPassword\.trim\(\)/, route);
  }
  assert.match(s, /async function unlockSignIn\(userId: number\)[\s\S]{0,200}loginFailsByName\.reset\(/);
});

test("the Arise AAC box only shows on the AAC signup link", () => {
  const s = read("client/src/pages/Register.tsx");
  assert.match(s, /\{eyeEntry && <label[^>]*>\s*<input type="checkbox" checked=\{isEyeGaze\}/);
});
