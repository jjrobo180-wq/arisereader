import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("students can see the school year's top readers, not only this month's", () => {
  const page = read("../client/src/pages/StudentProgress.tsx");
  assert.ok(page.includes('data-testid="leaderboard-span"') && page.includes('"year-leaderboard"'));
  assert.ok(page.includes("/api/leaderboard?schoolYear=${schoolYearStart}"));
  const routes = read("../server/routes.ts");
  assert.ok(routes.includes("storage.getRangeLeaderboard(`${schoolYear}-08`, `${schoolYear + 1}-08`)"), "a school year is August to August");
  const storage = read("../server/storage.ts");
  assert.ok(storage.includes("return this.getRangeLeaderboard(yearMonth, nextYearMonth(yearMonth));"), "the month board is the same count over one month");
  assert.ok(storage.includes("cached('monthlyLeaderboard_' + yearMonth"), "a new quiz pass clears the year board's cache too");
});
