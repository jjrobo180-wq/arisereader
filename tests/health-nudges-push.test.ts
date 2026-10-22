import test from "node:test";
import assert from "node:assert/strict";
import { cleanNudgeData, DEFAULT_NUDGES, nudgesOn } from "../shared/healthNudges";

// The server pass is a thin loop over dueNudges; its behaviour is covered in health-nudges.test.ts.
// Here: the file the app saves is what the server reads ({ data }), and a stored copy survives a round trip.
test("settings saved by the app read back the same on the server", () => {
  const saved = cleanNudgeData({ ...DEFAULT_NUDGES, goals: ["focus", "sleep-better"], push: true, level: 4, perDay: 5, seed: 321 });
  const file = JSON.stringify({ data: saved, updatedAt: "2026-03-03T00:00:00.000Z" });
  const back = cleanNudgeData(JSON.parse(file).data);
  assert.deepEqual(back, saved);
  assert.deepEqual(nudgesOn(back, "2026-03-03"), nudgesOn(saved, "2026-03-03"));
});
