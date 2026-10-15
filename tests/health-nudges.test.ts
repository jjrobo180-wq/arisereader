import test from "node:test";
import assert from "node:assert/strict";
import { GOALS, GOAL_GROUPS } from "../shared/healthNudgesContent";
import { LEVELS, VOICE } from "../shared/healthNudgesVoice";
import { UNIVERSAL } from "../shared/healthNudgesUniversal";
import { DEFAULT_NUDGES, cleanNudgeData, composeNudge, dueNudges, maxPerDay, nudgesOn, type NudgeData } from "../shared/healthNudges";

const data = (over: Partial<NudgeData> = {}): NudgeData => cleanNudgeData({ ...DEFAULT_NUDGES, goals: ["lose-weight"], ...over });
const dateOf = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);

test("every goal has plenty of its own lines, in every kind, with no duplicates", () => {
  assert.ok(GOALS.length >= 24);
  for (const goal of GOALS) {
    assert.ok(GOAL_GROUPS.includes(goal.group), goal.id);
    for (const [kind, min] of [["core", 8], ["tip", 5], ["fact", 5], ["act", 4]] as const) {
      assert.ok(goal[kind].length >= min, `${goal.id} ${kind}`);
      assert.equal(new Set(goal[kind]).size, goal[kind].length, `${goal.id} ${kind} has a duplicate`);
    }
  }
  assert.equal(new Set(GOALS.map((g) => g.id)).size, GOALS.length);
  for (const level of LEVELS) for (const part of Object.values(VOICE[level.id])) assert.ok(part.length >= 10);
});

test("nothing in the library shames a body, praises starving, or tells someone to push through pain", () => {
  const all = [...GOALS.flatMap((g) => [...g.core, ...g.tip, ...g.fact, ...g.act]), ...Object.values(UNIVERSAL).flat(), ...Object.values(VOICE).flatMap((v) => Object.values(v).flat())].join("\n").toLowerCase();
  for (const bad of ["starve", "skip meals", "skip a meal", "no pain no gain", "fat pig", "disgusting", "lazy", "worthless", "ugly", "pathetic", "punish yourself", "purge", "burn off that", "earn your food", "cheat meal"]) assert.ok(!all.includes(bad), `found "${bad}"`);
});

test("a message is the same every time it is asked for, and different between levels", () => {
  const goal = GOALS[0];
  assert.deepEqual(composeNudge(goal, 3, 17), composeNudge(goal, 3, 17));
  const bodies = new Set(([1, 2, 3, 4, 5] as const).map((l) => composeNudge(goal, l, 4).body));
  assert.equal(bodies.size, 5);
  assert.match(composeNudge(goal, 5, 0).body, /[A-Z]{4,}/);
});

test("at six a day, one goal never repeats a whole message within half a year", () => {
  const d = data({ perDay: 6 });
  const lastDay = new Map<string, number>();
  for (let i = 0; i < 365; i++) for (const n of nudgesOn(d, dateOf(i))) {
    if (lastDay.has(n.body)) assert.ok(i - lastDay.get(n.body)! > 180, `"${n.body}" came back after ${i - lastDay.get(n.body)!} days`);
    lastDay.set(n.body, i);
  }
  assert.ok(lastDay.size > 2000);
});

test("the same main line is not used again within about a month, per goal", () => {
  const d = data({ perDay: 4 });
  const last = new Map<string, number>();
  let worst = Infinity, i = 0;
  const lines = new Map<string, string>();
  for (const goal of GOALS) for (const k of ["core", "tip", "fact", "act"] as const) for (const l of [...goal[k], ...UNIVERSAL[k]]) lines.set(l, l);
  for (let day = 0; day < 90; day++) for (const n of nudgesOn(d, dateOf(day))) {
    const line = [...lines.keys()].find((l) => n.body.includes(l))!;
    if (last.has(line)) worst = Math.min(worst, i - last.get(line)!);
    last.set(line, i++);
  }
  assert.ok(worst >= 4 * 12, `a line came back after only ${worst} messages`);
});

test("several goals take turns and every picked goal shows up each day", () => {
  const d = data({ goals: ["lose-weight", "sleep-better", "focus"], perDay: 6 });
  const today = nudgesOn(d, "2026-03-03");
  assert.equal(new Set(today.map((n) => n.goal)).size, 3);
  assert.ok(today.every((n) => d.goals.includes(n.goal)));
});

test("turning kinds off keeps them out", () => {
  const d = data({ perDay: 6, kinds: { core: false, tip: true, fact: false, act: false } });
  assert.ok(nudgesOn(d, "2026-03-03").every((n) => n.kind === "tip"));
  assert.equal(cleanNudgeData({ goals: ["focus"], kinds: { core: false, tip: false, fact: false, act: false } }).kinds.core, true);
});

test("the day's times stay inside the hours and apart", () => {
  const d = data({ perDay: 12, from: "09:00", until: "11:00" });
  assert.equal(d.perDay, maxPerDay("09:00", "11:00"));
  const times = nudgesOn(d, "2026-03-03").map((n) => n.time);
  assert.equal(times[0], "09:00");
  assert.equal(times[times.length - 1], "11:00");
  const mins = times.map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
  for (let i = 1; i < mins.length; i++) assert.ok(mins[i] - mins[i - 1] >= 30);
});

test("nothing goes out when paused, with no goals, or on a day that is off", () => {
  assert.equal(nudgesOn(data({ paused: true }), "2026-03-03").length, 0);
  assert.equal(nudgesOn(data({ goals: [] }), "2026-03-03").length, 0);
  assert.equal(nudgesOn(data({ days: [0, 6] }), "2026-03-03").length, 0); // a Tuesday
  assert.ok(nudgesOn(data({ days: [2] }), "2026-03-03").length > 0);
});

test("phones: a nudge is sent once, in its window, in the phone's own time zone", () => {
  const d = data({ push: true, perDay: 1, from: "09:00", until: "10:00" });
  const at = Date.UTC(2026, 2, 3, 14, 5); // 9:05 AM in New York
  const due = dueNudges(d, at, "America/New_York");
  assert.equal(due.length, 1);
  assert.equal(due[0].key, "nudge:2026-03-03:0");
  assert.equal(dueNudges(d, at, "America/New_York", { [due[0].key]: at }).length, 0);
  assert.equal(dueNudges(d, Date.UTC(2026, 2, 3, 14, 40), "America/New_York").length, 0); // window over
  assert.equal(dueNudges(d, Date.UTC(2026, 2, 3, 13, 55), "America/New_York").length, 0); // not yet
  assert.equal(dueNudges({ ...d, push: false }, at, "America/New_York").length, 0);
  assert.equal(due[0].body, nudgesOn(d, "2026-03-03")[0].body); // the phone says what the app shows
});

test("saved data is cleaned", () => {
  const d = cleanNudgeData({ goals: ["focus", "nope", "focus"], level: 9, perDay: 500, from: "25:00", until: "07:00", days: [1, 9, "x"], seed: -5 });
  assert.deepEqual(d.goals, ["focus"]);
  assert.equal(d.level, 2);
  assert.ok(d.perDay <= 12);
  assert.ok(d.from < d.until);
  assert.deepEqual(d.days, [1]);
  assert.ok(d.seed >= 0);
  assert.equal(cleanNudgeData(null).goals.length, 0);
});
