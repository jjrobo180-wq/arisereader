// Points added by hand can be taken back from the admin page.
// Run with: npx tsx --test tests/manual-points-remove.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("an admin can remove points that were added by hand, and only that student's", () => {
  const routes = read("server/routes.ts");
  const start = routes.indexOf('app.delete("/api/admin/students/:id/manual-points/:awardId", authMiddleware, adminMiddleware,');
  assert.ok(start > 0, "the route is there and is admin only");
  const route = routes.slice(start, routes.indexOf('app.get("/api/admin/students/:id/manual-points"', start));
  assert.ok(route.includes('.delete().eq("id", awardId).eq("student_id", studentId)'), "the award has to belong to the student on the page");
  assert.ok(route.includes("res.status(404)"), "points that are already gone are reported, not an error");
  for (const cache of ["allUsers", "leaderboard", "monthlyLeaderboard", "advisoryLeaderboard", "session_"]) assert.ok(route.includes(`clearCache("${cache}")`), cache);
});

test("the points box lists each hand-added award with a Remove button that asks first", () => {
  const page = read("client/src/pages/Admin.tsx");
  assert.ok(page.includes('data-testid="manual-points-remove"'));
  assert.ok(page.includes("/manual-points/${award.id}`"));
  assert.ok(page.includes("window.confirm(`Remove ${award.points} points from ${pointsStudent.displayName}"));
});
