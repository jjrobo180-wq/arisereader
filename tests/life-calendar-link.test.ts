import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanFamily } from "../shared/familyHub";

test("LifeHub keeps a linked calendar's link and when it was read; anything else is dropped", () => {
  const f = cleanFamily({ calendars: [
    { id: "a", name: "School", color: "#123456", show: true, url: "https://school.example/cal.ics", syncedAt: "2026-10-30T12:00:00.000Z" },
    { id: "b", name: "Bad", color: "#123456", show: true, url: "javascript:alert(1)", syncedAt: "x" },
    { id: "c", name: "Family", color: "#123456", show: true },
  ] });
  assert.equal(f.calendars[0].url, "https://school.example/cal.ics");
  assert.equal(f.calendars[0].syncedAt, "2026-10-30T12:00:00.000Z");
  assert.equal(f.calendars[1].url, undefined);
  assert.equal(f.calendars[2].url, undefined);
});

test("LifeHub calendar: link form, refresh, and the server route behind the LifeHub gate", () => {
  const ui = readFileSync("client/src/components/family-hub/FamilyCalendar.tsx", "utf8");
  assert.match(ui, /data-testid="life-calendar-link"/);
  assert.match(ui, /\/api\/arise-todo\/calendar-link/);
  const server = readFileSync("server/teacherHubImport.ts", "utf8");
  assert.match(server, /app\.post\("\/api\/arise-todo\/calendar-link", authMiddleware, readLink\)/);
});
