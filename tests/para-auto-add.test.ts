import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Para Team is added once for people already on a para team, in both hubs", () => {
  const lib = readFileSync("client/src/lib/paraTeam.ts", "utf8");
  assert.match(lib, /export function useParaTeamAutoAdd/);
  assert.match(lib, /arise-para-auto:\$\{hub\}:\$\{userId\}/);
  assert.match(lib, /teams\.length > 0\) \{ add\(\); mark\(\); \}/);
  assert.match(readFileSync("client/src/pages/AriseTodo.tsx", "utf8"), /useParaTeamAutoAdd\([^\n]*"life"/);
  assert.match(readFileSync("client/src/pages/TeacherHub.tsx", "utf8"), /useParaTeamAutoAdd\([^\n]*"work"/);
});
