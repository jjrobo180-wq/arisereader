// Red dots on plugins while something is waiting to be tracked, and more Health & Fitness check-ins (Nov 25, 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pendingDots } from "../shared/pluginDots";
import { buildCheckins, SESSION_CHECKINS } from "../shared/dailyCheckins";
import { emptyDaily } from "../shared/dailySettings";
import { emptyFit } from "../shared/fit";
import { PLUGINS } from "../shared/pluginStore";

const DAY = "2026-11-25";
const row = (x: Record<string, unknown>) => ({ id: "x", kind: "water", source: "cooked", title: "", detail: "", time: "", done: false, byHand: false, ...x }) as any;

test("a plugin has a dot while something is due and not done, and loses it when done", () => {
  const rows = [
    row({ id: "w", open: { section: "cooked", app: "water" } }),
    row({ id: "lunch", kind: "meal", time: "12:30", open: { section: "cooked", app: "food" } }),
    row({ id: "h", kind: "habit", source: "habits", time: "08:00", open: { section: "habits" } }),
    row({ id: "t", kind: "custom", source: "mine", open: { section: "tasks" } }),
  ];
  const morning = pendingDots(rows, 9 * 60);
  assert.deepEqual(morning, { cooked: 1, "fit:water": 1, habits: 1 }, "lunch isn't due yet; the task list has its own number");
  const afternoon = pendingDots(rows, 13 * 60);
  assert.equal(afternoon.cooked, 2); assert.equal(afternoon["fit:food"], 1);
  const done = pendingDots(rows.map((r) => ({ ...r, done: true })), 13 * 60);
  assert.deepEqual(done, {});
  assert.deepEqual(pendingDots([row({ hidden: true, open: { section: "cooked", app: "water" } })], 600), {});
});

test("yoga, breathing and stretching can be check-ins that tick themselves off", () => {
  assert.deepEqual(SESSION_CHECKINS.map((x) => x.id), ["cooked:yoga", "cooked:breathe", "cooked:stretch"]);
  const settings = { ...emptyDaily(), extra: ["cooked:yoga", "cooked:fast"] };
  const fit = emptyFit();
  const before = buildCheckins({ date: DAY, settings, fit, on: {} } as any);
  const yoga = before.find((c) => c.id === "cooked:yoga")!;
  assert.ok(yoga && !yoga.done && yoga.kind === "yoga");
  assert.ok(before.some((c) => c.id === "cooked:fast"), "fasting can be added even before a first fast");
  const after = buildCheckins({ date: DAY, settings, fit: { ...fit, workouts: [{ id: "1", date: `${DAY}T15:00:00`, name: "Morning flow", programId: "session-yoga", secs: 900, exercises: [] }] } as any, on: {} } as any);
  assert.ok(after.find((c) => c.id === "cooked:yoga")!.done);
});

test("the New Check-in pop-up offers Health & Fitness trackers, and the dots are drawn", () => {
  const ui = readFileSync("client/src/components/daily/DailyCheckins.tsx", "utf8");
  assert.match(ui, /data-testid="checkin-trackers"/);
  for (const t of ["yoga", "water", "sleep", "breathe", "stretch"]) assert.match(ui, new RegExp(`id: "cooked:${t}"`), t);
  assert.match(readFileSync("client/src/pages/AriseTodo.tsx", "utf8"), /data-testid=\{`life-dot-\$\{id\}`\}/);
  assert.match(readFileSync("client/src/pages/fit/FitGroupPage.tsx", "utf8"), /data-testid=\{`fit-dot-\$\{p\.id\}`\}/);
  assert.match(readFileSync("client/src/components/super-apps/SuperShell.tsx", "utf8"), /className="sx-dot"/);
});

test("Arise Math, History and Social are no longer in the plugin store", () => {
  for (const id of ["app-math", "app-history", "app-social"]) assert.ok(!PLUGINS.some((p) => p.id.endsWith(id)), id);
});
