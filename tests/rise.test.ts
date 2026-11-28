import test from "node:test";
import assert from "node:assert/strict";
import { cleanRise, counts, isMealReminder, mealCheckin, emptyRise, motivation, progressText, recordDay, riseReminders, riseStreak, weekRecap, weightGoal, type RiseData } from "../shared/rise";
import { cleanFamily, emptyFamily } from "../shared/familyHub";
import { dueDailyReminders } from "../shared/dailyCheckins";

const day = (date: string, done: number, total: number) => ({ date, done, total });
const withDays = (days: ReturnType<typeof day>[]): RiseData => ({ ...emptyRise(), days });

test("a day counts at half done, or three", () => {
  assert.equal(counts(day("2026-11-27", 2, 4)), true);
  assert.equal(counts(day("2026-11-27", 1, 4)), false);
  assert.equal(counts(day("2026-11-27", 3, 10)), true);
  assert.equal(counts(day("2026-11-27", 0, 0)), false);
});

test("the streak: today joins when it counts, rest days skip, one miss a week is forgiven", () => {
  const r = withDays([day("2026-11-20", 3, 4), day("2026-11-21", 3, 4), day("2026-11-22", 0, 4), day("2026-11-23", 4, 4), day("2026-11-24", 0, 0), day("2026-11-25", 2, 3), day("2026-11-26", 2, 2)]);
  const a = riseStreak(r, "2026-11-27");
  assert.equal(a.days, 5); // 26, 25, (24 rest), 23, (22 frozen), 21, 20 → 5 counted days
  assert.deepEqual(a.frozen, ["2026-11-22"]);
  assert.equal(a.today, false);
  const b = riseStreak(recordDay(r, "2026-11-27", 3, 3), "2026-11-27");
  assert.equal(b.days, 6);
  assert.equal(b.today, true);
  // Two misses in a row end it.
  const c = withDays([day("2026-11-23", 3, 3), day("2026-11-24", 0, 3), day("2026-11-25", 0, 3), day("2026-11-26", 3, 3)]);
  assert.equal(riseStreak(c, "2026-11-27").days, 1);
});

test("recordDay only changes when the numbers do", () => {
  const r = recordDay(emptyRise(), "2026-11-27", 1, 4);
  assert.equal(recordDay(r, "2026-11-27", 1, 4), r);
  assert.deepEqual(recordDay(r, "2026-11-27", 2, 4).days, [day("2026-11-27", 2, 4)]);
});

test("weight goal lines both ways", () => {
  assert.equal(weightGoal(90, 80, 95, "kg")!.text, "10 kg to go to 80 kg");
  assert.equal(Math.round(weightGoal(90, 80, 95, "kg")!.pct * 100), 33);
  assert.match(weightGoal(79, 80, 95, "kg")!.text, /Goal reached/);
  assert.match(weightGoal(60, 65, 55, "kg")!.text, /5 kg to go/);
  assert.equal(weightGoal(undefined, 80, 90, "lb"), null);
});

test("reminders say why, and the streak saver goes once today counts", () => {
  const r: RiseData = { ...withDays([day("2026-11-26", 3, 3)]), why: "To keep up with my kids", vision: [{ id: "v", emoji: "🏃", text: "Run a 5K" }], kg: { now: 90, goal: 80, units: "kg" } };
  const lines = new Set(Array.from({ length: 40 }, (_, i) => motivation(r, "2026-11-27", `x${i}`)));
  assert.ok([...lines].some((l) => l.includes("keep up with my kids")));
  assert.ok([...lines].some((l) => l.includes("Run a 5K")));
  assert.ok([...lines].some((l) => l.includes("to go to 80")));
  const before = riseReminders(r, "2026-11-27", { done: 0, total: 4 }, "u");
  assert.deepEqual(before.map((x) => x.id), ["rise:morning", "rise:evening"]);
  assert.match(before[1].title, /Keep your 1-day streak/);
  assert.deepEqual(riseReminders(r, "2026-11-27", { done: 3, total: 4 }, "u").map((x) => x.id), ["rise:morning"]);
  assert.deepEqual(riseReminders({ ...r, morning: "", evening: "" }, "2026-11-27", null, "u"), []);
  const sent = dueDailyReminders([{ id: "cooked:lunch", title: "Log your lunch", body: "b", time: "12:30", section: "tasks", url: "own" }], { date: "2026-11-27", minutes: 750, sent: {}, keyPrefix: "todo:daily:", url: "list", followUps: 0, every: 30, window: 10 });
  assert.equal(sent[0].url, "own");
  assert.equal(isMealReminder(sent[0].key), true);
  assert.equal(isMealReminder("todo:daily:habit:x:2026-11-27"), false);
  assert.equal(mealCheckin(sent[0].key), "cooked:lunch");
});

test("the week recap backs its insights with data", () => {
  const days = Array.from({ length: 21 }, (_, i) => { const d = new Date(Date.parse("2026-11-07T12:00:00Z") + i * 864e5).toISOString().slice(0, 10); return day(d, i % 2 ? 4 : 1, 4); });
  const foods = days.filter((_, i) => i % 2).map((d) => ({ date: d.date, meal: "breakfast", kcal: 400, servings: 1 }));
  const rc = weekRecap({ rise: withDays(days), today: "2026-11-27", foods, weights: [{ date: "2026-11-21", kg: 90 }, { date: "2026-11-27", kg: 89 }], units: "kg" });
  assert.equal(rc.from, "2026-11-21");
  assert.ok(rc.insights.some((x) => /log breakfast/.test(x)), rc.insights.join(" | "));
  assert.ok(rc.insights.some((x) => /Weight down 1 kg/.test(x)));
  assert.equal(weekRecap({ rise: emptyRise(), today: "2026-11-27" }).insights.length, 1);
});

test("rise is kept on the family and cleaned", () => {
  const f = cleanFamily({ ...emptyFamily(), rise: { why: "x", morning: "25:00", evening: "", vision: [{ id: "a", text: "Japan" }, { id: "", text: "bad" }], days: [{ date: "2026-11-27", done: 2, total: 3 }, { date: "nope" }], kg: { now: 90, goal: 80, units: "kg" } } });
  assert.equal(f.rise?.morning, "07:30");
  assert.equal(f.rise?.evening, "");
  assert.equal(f.rise?.vision.length, 1);
  assert.equal(f.rise?.days.length, 1);
  assert.deepEqual(f.rise?.kg, { now: 90, goal: 80, units: "kg" });
  assert.equal(cleanFamily(emptyFamily()).rise, undefined);
  assert.equal(cleanRise(null), undefined);
  assert.match(progressText({ ...emptyRise(), why: "kids" }, "2026-11-27", 3, 4), /3 of 4 today[\s\S]*kids/);
});
