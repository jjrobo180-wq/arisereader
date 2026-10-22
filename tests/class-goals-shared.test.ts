import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOp, applyAll, cleanClassGoals, cleanGoal, emptyClassGoals, totalsOf, progressOf, phaseOf, milestonesOf, leftLabel, daysLeft, paceOf, windowFor, newGoalInput,
  schoolDays, MAX_ENTRIES, MAX_GOALS, type ClassGoals, type Op,
} from "../shared/classGoals";

let n = 0;
const id = (p = "op") => `${p}${++n}x${Math.random().toString(36).slice(2, 6)}`;
const AT = "2026-10-14T16:00:00.000Z";
const add = (s: ClassGoals, gid: string, input: any = {}) => applyOp(s, { opId: id(), at: AT, type: "goal.add", id: gid, goal: { title: "Quiet halls", target: 20, reward: { name: "Pizza party", emoji: "🍕" }, ...input } });
const pts = (s: ClassGoals, gid: string, amount: number, categoryId = "c1", reason = "") => applyOp(s, { opId: id(), at: AT, type: "points.add", goalId: gid, entryId: id("e"), amount, categoryId, reason });

test("adding a goal cleans every field and makes it the board goal", () => {
  const s = add(emptyClassGoals(), "goal1", { title: "   Quiet   halls\n and homework  ", target: 99999999, reward: { name: "", emoji: "" } });
  const g = s.goals[0];
  assert.equal(g.title, "Quiet halls and homework");
  assert.equal(g.target, 10000);
  assert.equal(g.reward.name, "Class reward");
  assert.equal(g.reward.emoji, "🎉");
  assert.equal(g.categories.length, 2, "Behavior and Academics unless the teacher chooses");
  assert.equal(s.boardId, "goal1");
  assert.equal(s.rev, 1);
});

test("points add up by category, and the same operation counts once", () => {
  let s = add(emptyClassGoals(), "goal1");
  const op: Op = { opId: "same-op-1", at: AT, type: "points.add", goalId: "goal1", entryId: "entry1", amount: 5, categoryId: "c2", reason: "Quiz success" };
  s = applyOp(s, op);
  const again = applyOp(s, op);
  assert.equal(again, s, "a repeat changes nothing");
  s = pts(s, "goal1", 3, "c1");
  const t = totalsOf(s.goals[0]);
  assert.equal(t.points, 8);
  assert.deepEqual(t.byCategory.map((c) => [c.name, c.points]), [["Behavior", 3], ["Academics", 5]]);
  assert.equal(progressOf(s.goals[0]).pct, 40);
});

test("a repeat of the same entry id under a new operation id is also ignored", () => {
  let s = add(emptyClassGoals(), "goal1");
  s = applyOp(s, { opId: id(), at: AT, type: "points.add", goalId: "goal1", entryId: "dupe1", amount: 4, categoryId: "c1", reason: "" });
  const s2 = applyOp(s, { opId: id(), at: AT, type: "points.add", goalId: "goal1", entryId: "dupe1", amount: 4, categoryId: "c1", reason: "" });
  assert.equal(s2, s);
  assert.equal(totalsOf(s.goals[0]).points, 4);
});

test("undo removes exactly that entry; removing it twice does nothing", () => {
  let s = add(emptyClassGoals(), "goal1");
  s = applyOp(s, { opId: id(), at: AT, type: "points.add", goalId: "goal1", entryId: "keep1", amount: 2, categoryId: "c1", reason: "" });
  s = applyOp(s, { opId: id(), at: AT, type: "points.add", goalId: "goal1", entryId: "oops1", amount: 7, categoryId: "c1", reason: "" });
  s = applyOp(s, { opId: id(), at: AT, type: "points.remove", goalId: "goal1", entryId: "oops1" });
  assert.equal(totalsOf(s.goals[0]).points, 2);
  const again = applyOp(s, { opId: id(), at: AT, type: "points.remove", goalId: "goal1", entryId: "oops1" });
  assert.equal(again, s);
});

test("bad amounts and unknown goals are refused without changing anything", () => {
  let s = add(emptyClassGoals(), "goal1");
  for (const amount of [0, -3, NaN, Infinity]) assert.equal(pts(s, "goal1", amount), s);
  assert.equal(pts(s, "nope1", 3), s);
  assert.equal(totalsOf(pts(s, "goal1", 9999).goals[0]).points, 500, "one tap is capped at 500");
  s = pts(s, "goal1", 3, "no-such-category");
  assert.equal(s.goals[0].entries[0].categoryId, "c1", "an unknown category falls back to the first");
});

test("a removed category keeps its points and shows as Other", () => {
  let s = add(emptyClassGoals(), "goal1");
  s = pts(s, "goal1", 4, "c2");
  s = applyOp(s, { opId: id(), at: AT, type: "goal.update", id: "goal1", patch: { categories: [{ id: "c1", name: "Behavior", emoji: "🌟", color: "#FFC933" }] } });
  const t = totalsOf(s.goals[0]);
  assert.equal(t.points, 4);
  assert.equal(t.byCategory.at(-1)!.name, "Other");
});

test("updating keeps points, board and reached state; the target can be raised", () => {
  let s = add(emptyClassGoals(), "goal1", { target: 5 });
  s = pts(s, "goal1", 5);
  assert.equal(phaseOf(s.goals[0], "2026-10-14"), "reached");
  s = applyOp(s, { opId: id(), at: AT, type: "goal.update", id: "goal1", patch: { target: 50, reward: { name: "Extra recess", emoji: "🛝" } } });
  assert.equal(s.goals[0].entries.length, 1);
  assert.equal(s.goals[0].reward.name, "Extra recess");
  assert.equal(phaseOf(s.goals[0], "2026-10-14"), "active");
});

test("giving the reward and taking it back", () => {
  let s = add(emptyClassGoals(), "goal1", { target: 3 });
  s = pts(s, "goal1", 3);
  s = applyOp(s, { opId: id(), at: AT, type: "reward.given", goalId: "goal1", given: true });
  assert.equal(phaseOf(s.goals[0], "2026-10-14"), "given");
  s = applyOp(s, { opId: id(), at: AT, type: "reward.given", goalId: "goal1", given: false });
  assert.equal(phaseOf(s.goals[0], "2026-10-14"), "reached");
});

test("deleting the board goal moves the board to another goal, or to none", () => {
  let s = add(emptyClassGoals(), "goal1");
  s = add(s, "goal2");
  assert.equal(s.boardId, "goal1");
  s = applyOp(s, { opId: id(), at: AT, type: "board.set", goalId: "goal2" });
  assert.equal(s.boardId, "goal2");
  s = applyOp(s, { opId: id(), at: AT, type: "goal.delete", id: "goal2" });
  assert.equal(s.boardId, "goal1");
  s = applyOp(s, { opId: id(), at: AT, type: "goal.delete", id: "goal1" });
  assert.equal(s.boardId, "");
  assert.equal(s.goals.length, 0);
  assert.equal(applyOp(s, { opId: id(), at: AT, type: "board.set", goalId: "goal1" }), s);
});

test("a goal id can't be reused and the list is capped", () => {
  let s = add(emptyClassGoals(), "goal1");
  assert.equal(add(s, "goal1"), s);
  for (let i = 0; i < MAX_GOALS + 5; i++) s = add(s, `g${i}abc`);
  assert.equal(s.goals.length, MAX_GOALS);
});

test("old log lines fold into totals so the saved copy stays small and the total never changes", () => {
  let s = add(emptyClassGoals(), "goal1", { target: 10000 });
  for (let i = 0; i < MAX_ENTRIES + 30; i++) s = applyOp(s, { opId: id(), at: AT, type: "points.add", goalId: "goal1", entryId: id("e"), amount: 2, categoryId: i % 2 ? "c1" : "c2", reason: "" });
  const g = s.goals[0];
  assert.ok(g.entries.length <= MAX_ENTRIES);
  assert.equal(totalsOf(g).points, (MAX_ENTRIES + 30) * 2);
  assert.equal(totalsOf(g).byCategory.reduce((a, c) => a + c.points, 0), (MAX_ENTRIES + 30) * 2);
});

test("the applied list stays short and an old op id still counts once while it is kept", () => {
  let s = add(emptyClassGoals(), "goal1");
  for (let i = 0; i < 200; i++) s = pts(s, "goal1", 1);
  assert.ok(s.applied.length <= 80);
});

test("applyAll lays pending changes over saved goals", () => {
  const base = add(emptyClassGoals(), "goal1");
  const ops: Op[] = [
    { opId: id(), at: AT, type: "points.add", goalId: "goal1", entryId: id("e"), amount: 3, categoryId: "c1", reason: "" },
    { opId: id(), at: AT, type: "points.add", goalId: "goal1", entryId: id("e"), amount: 4, categoryId: "c2", reason: "" },
  ];
  assert.equal(totalsOf(applyAll(base, ops).goals[0]).points, 7);
  assert.equal(totalsOf(applyAll(applyAll(base, ops), ops).goals[0]).points, 7, "laying the same changes twice counts once");
});

test("cleanClassGoals repairs damaged saves and drops junk", () => {
  assert.deepEqual(cleanClassGoals(null), emptyClassGoals());
  assert.deepEqual(cleanClassGoals("{not json"), emptyClassGoals());
  const s = cleanClassGoals({
    rev: -4, boardId: "ghost",
    goals: [
      { id: "ok1x", title: 42, target: "30", entries: [{ id: "e1xx", amount: 3, categoryId: "c1" }, { id: "e1xx", amount: 3 }, { id: "bad", amount: 3 }, { id: "e2xx", amount: -1 }], endsOn: "2026-02-30" },
      { id: "ok1x" }, { nope: true }, null,
    ],
  });
  assert.equal(s.goals.length, 1);
  assert.equal(s.goals[0].target, 30);
  assert.equal(s.goals[0].title, "");
  assert.equal(s.goals[0].endsOn, "", "an impossible date is dropped");
  assert.equal(s.goals[0].entries.length, 1, "duplicates, short ids and negatives are dropped");
  assert.equal(s.boardId, "");
  assert.equal(s.rev, 0);
  assert.deepEqual(cleanClassGoals(JSON.parse(JSON.stringify(add(emptyClassGoals(), "goal1")))).goals[0], add(emptyClassGoals(), "goal1").goals[0], "a good save round-trips");
});

test("dates: an end before the start is lifted to the start", () => {
  const g = cleanGoal("goal1", { startsOn: "2026-10-20", endsOn: "2026-10-10" }, AT);
  assert.equal(g.endsOn, "2026-10-20");
});

test("days left, labels and pace", () => {
  const g = cleanGoal("goal1", { target: 30, endsOn: "2026-10-16", startsOn: "2026-10-12" }, AT);
  assert.equal(daysLeft(g, "2026-10-14"), 2);
  assert.equal(leftLabel(g, "2026-10-14"), "2 days left");
  assert.equal(leftLabel(g, "2026-10-15"), "1 day left");
  assert.equal(leftLabel(g, "2026-10-16"), "Last day!");
  assert.equal(leftLabel(g, "2026-10-17"), "Time's up");
  assert.equal(leftLabel({ ...g, endsOn: "" }, "2026-10-17"), "");
  assert.deepEqual(paceOf(g, "2026-10-14"), { needPerDay: 10, haveEnough: false }, "30 points over today and 2 more days");
  assert.equal(paceOf(g, "2026-10-20"), null);
  assert.equal(daysLeft(cleanGoal("g2xx", { endsOn: "2027-01-02" }, AT), "2026-12-30"), 3, "across a year end");
});

test("phases", () => {
  const g = cleanGoal("goal1", { target: 10, startsOn: "2026-10-14", endsOn: "2026-10-16" }, AT);
  assert.equal(phaseOf(g, "2026-10-13"), "upcoming");
  assert.equal(phaseOf(g, "2026-10-14"), "active");
  assert.equal(phaseOf(g, "2026-10-16"), "active");
  assert.equal(phaseOf(g, "2026-10-17"), "ended");
});

test("milestones follow the target, rounding up", () => {
  let s = add(emptyClassGoals(), "goal1", { target: 10 });
  s = pts(s, "goal1", 5);
  assert.deepEqual(milestonesOf(s.goals[0]).map((m) => [m.pct, m.at, m.reached]), [[25, 3, true], [50, 5, true], [75, 8, false], [100, 10, false]]);
});

test("quick date choices", () => {
  assert.deepEqual(windowFor("week", "2026-10-14"), { startsOn: "2026-10-14", endsOn: "2026-10-16" }, "Wednesday → that Friday");
  assert.deepEqual(windowFor("week", "2026-10-16"), { startsOn: "2026-10-16", endsOn: "2026-10-16" }, "Friday → today");
  assert.deepEqual(windowFor("week", "2026-10-17"), { startsOn: "2026-10-17", endsOn: "2026-10-23" }, "Saturday → next Friday");
  assert.deepEqual(windowFor("week", "2026-10-18"), { startsOn: "2026-10-18", endsOn: "2026-10-23" }, "Sunday → next Friday");
  assert.deepEqual(windowFor("two-weeks", "2026-10-14"), { startsOn: "2026-10-14", endsOn: "2026-10-27" });
  assert.deepEqual(windowFor("month", "2026-10-14"), { startsOn: "2026-10-14", endsOn: "2026-10-31" });
  assert.deepEqual(windowFor("month", "2026-02-10"), { startsOn: "2026-02-10", endsOn: "2026-02-28" });
  assert.deepEqual(windowFor("none", "2026-10-14"), { startsOn: "2026-10-14", endsOn: "" });
  assert.equal(newGoalInput("2026-10-14").categories!.length, 2);
});

test("school days count Monday to Friday, both ends", () => {
  assert.equal(schoolDays("2026-10-12", "2026-10-16"), 5);
  assert.equal(schoolDays("2026-10-14", "2026-10-14"), 1);
  assert.equal(schoolDays("2026-10-17", "2026-10-18"), 0, "a weekend");
  assert.equal(schoolDays("2026-10-14", "2026-10-27"), 10);
  assert.equal(schoolDays("2026-10-16", "2026-10-14"), 0);
  assert.equal(schoolDays("", "2026-10-14"), 0);
});

test("points keep their category through saving and reading back", () => {
  let s = add(emptyClassGoals(), "goal1");
  s = pts(s, "goal1", 4, "c1", "Quiet");
  s = pts(s, "goal1", 6, "c2");
  const back = cleanClassGoals(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(totalsOf(back.goals[0]).byCategory.map((c) => [c.id, c.points]), [["c1", 4], ["c2", 6]]);
  assert.deepEqual(back, s, "nothing changes on the way through");
});

test("a category added later (with a long id) works the same", () => {
  let s = add(emptyClassGoals(), "goal1");
  s = applyOp(s, { opId: id(), at: AT, type: "goal.update", id: "goal1", patch: { categories: [{ id: "c1", name: "Behavior" }, { id: "cabc123xyz", name: "Teamwork", emoji: "🤝" }] } });
  s = pts(s, "goal1", 3, "cabc123xyz");
  assert.deepEqual(totalsOf(cleanClassGoals(JSON.parse(JSON.stringify(s))).goals[0]).byCategory.map((c) => [c.name, c.points]), [["Behavior", 0], ["Teamwork", 3]]);
});
