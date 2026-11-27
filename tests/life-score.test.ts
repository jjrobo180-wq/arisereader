import { test } from "node:test";
import assert from "node:assert/strict";
import { METRICS, AREAS, cleanLifeScore, emptyLifeScore, lifeScore, lifeInputFrom, plusDays, screeningStatus, sleepScore, rhrScore, screenScore, alcoholScore, type LifeInput } from "../shared/lifeScore.ts";

const today = "2026-11-26";
const base = (): LifeInput => lifeInputFrom({ lifeScore: emptyLifeScore() }, []);

test("nothing logged: no score, nothing invented", () => {
  const r = lifeScore(base(), today);
  assert.equal(r.score, null);
  assert.equal(r.label, "No data yet");
  assert.ok(r.metrics.every((m) => m.score === null));
  assert.equal(r.focus, null);
});

test("the science-based curves", () => {
  assert.equal(sleepScore(8), 100); assert.equal(sleepScore(6), 75); assert.equal(sleepScore(5), 50); assert.equal(sleepScore(10.5), 70);
  assert.equal(rhrScore(52), 100); assert.equal(rhrScore(90), 20);
  assert.equal(screenScore(2, 30), 100); assert.equal(screenScore(undefined, undefined), null);
  assert.equal(alcoholScore(0), 100); assert.equal(alcoholScore(10), 35);
});

test("Apple Health and check-ins become scores, areas and a Life Score", () => {
  const input = base();
  for (let i = 0; i < 14; i++) {
    const d = plusDays(today, -i);
    input.data.health[d] = { steps: 8000, sleep: 7.5, bed: 270 + (i % 2) * 10, rhr: 58 };
    input.data.days[d] = { happy: i % 2 ? 9 : 5, stress: 3, exercise: 30, produce: 5, alcohol: 0, smoked: false, together: true, connect: 8, faith: true, screen: i % 2 ? 1 : 5, outdoors: 20 };
  }
  const r = lifeScore(input, today);
  const m = (id: string) => r.metrics.find((x) => x.id === id)!;
  assert.equal(m("steps").score, 100);
  assert.equal(m("sleep").score, 100);
  assert.equal(m("rhythm").score, 100);
  assert.equal(m("exercise").score, 100);
  assert.equal(m("calm").score, 70);
  assert.ok(m("heart").score! > 80);
  assert.equal(m("faith").score, 100);
  assert.ok(r.score! > 60 && r.score! <= 100);
  assert.equal(r.areas.length, AREAS.length);
  assert.equal(r.series.length, 30);
  assert.equal(r.streak, 14);
  assert.ok(r.focus && r.focus.score !== null);
  // Happier on the low-screen days: found as a pattern.
  assert.ok(r.patterns.some((p) => /screens/.test(p.text) && p.diff > 0), JSON.stringify(r.patterns));
});

test("other LifeHub apps feed it: Mood, Sleep log, Meditate, Gratitude, Goals, Budget", () => {
  const family = { lifeScore: emptyLifeScore(), moods: [{ memberId: "", date: today, mood: 5 }], sleep: [{ date: today, bed: "22:30", wake: "06:30" }],
    meditations: [{ date: today, minutes: 70 }], gratitude: [{ date: today, items: ["sunrise"] }], goals: [{ done: false, kind: "number", target: 10, current: 5, milestones: [] }],
    budget: [{ limit: 3000 }], expenses: [{ date: "2026-11-02", amount: 100 }] };
  const r = lifeScore(lifeInputFrom(family, [{ due: today, done: true }]), today);
  const m = (id: string) => r.metrics.find((x) => x.id === id)!.score;
  assert.equal(m("happy"), 100);
  assert.equal(m("sleep"), 100);
  assert.equal(m("mindful"), 100);
  assert.equal(m("goals"), 50);
  assert.equal(m("budget"), 100);
  assert.equal(m("checklist"), 100);
  assert.ok(m("gratitude")! > 0);
});

test("screenings by age and sex (USPSTF), and Prevention scores habits", () => {
  const s = { screenings: { colorectal: { date: "2020-01-01", years: 10 } }, off: [], birthYear: 1976, sex: "female" as const };
  const st = screeningStatus(s, today, "cancer");
  assert.deepEqual(st.map((x) => [x.id, x.due]), [["breast", true], ["cervical", true], ["colorectal", false]]);
  assert.deepEqual(screeningStatus({ screenings: {}, off: [], birthYear: 2000, sex: "male" }, today, "cancer"), []);
  // Checkups and vaccines: a woman of 50 gets these, not the men's or the 65+ ones.
  const more = screeningStatus(s, today).filter((x) => x.kind !== "cancer").map((x) => x.id);
  assert.deepEqual(more, ["physical", "bp", "cholesterol", "diabetes", "dental", "eyes", "skin", "flu", "covid", "tetanus", "shingles", "pneumonia"]);
  // "Once" vaccines stay done; a dental cleaning is due again after 6 months.
  const done = screeningStatus({ ...s, screenings: { shingles: { date: "2020-01-01", years: 10 }, dental: { date: "2026-03-01", years: 0.5 } } }, today);
  assert.equal(done.find((x) => x.id === "shingles")!.due, false);
  assert.equal(done.find((x) => x.id === "dental")!.due, true);
  assert.equal(done.find((x) => x.id === "dental")!.next, "2026-09-01");
});

test("saved data is cleaned: bad values dropped, numbers kept in range", () => {
  const c = cleanLifeScore({ days: { [today]: { happy: 14, screen: "3", smoked: "yes", note: "  good day " }, "bad": { happy: 3 } }, health: { [today]: { steps: -5, rhr: 61 } }, settings: { off: ["steps", "nope"], sex: "x", cushion: 2 } })!;
  assert.deepEqual(c.days[today], { happy: 10, screen: 3, note: "good day" });
  assert.equal(c.days["bad"], undefined);
  assert.deepEqual(c.health[today], { steps: 0, rhr: 61 });
  assert.deepEqual(c.settings.off, ["steps"]);
  assert.equal(c.settings.sex, undefined);
  assert.equal(c.settings.cushion, 2);
  assert.equal(cleanLifeScore(null), undefined);
});

test("every score explains its science and how to improve, with no medical claims of risk", () => {
  for (const m of METRICS) {
    assert.ok(m.why.length > 80 && m.sources.length && m.improve.length >= 3 && m.todos.length, m.id);
  }
  assert.match(METRICS.find((m) => m.id === "prevention")!.measures, /not your personal risk/);
});

test("Life Score is a LifeHub plugin, saved with the hub, and Apple Health's permission sentence says what it reads", async () => {
  const { readFileSync } = await import("node:fs");
  const { FAMILY_SECTIONS, TOGGLEABLE, ADD_ON_SECTIONS, cleanFamily } = await import("../shared/familyHub.ts");
  const { pluginsFor } = await import("../shared/pluginStore.ts");
  assert.ok(FAMILY_SECTIONS.includes("lifescore" as any) && TOGGLEABLE.includes("lifescore" as any) && ADD_ON_SECTIONS.includes("lifescore" as any));
  assert.ok(pluginsFor("life", {} as any).some((p: any) => p.id === "life-lifescore"), "in LifeHub's store");
  const f = cleanFamily({ lifeScore: { days: { "2026-11-26": { happy: 8 } }, settings: {} } });
  assert.deepEqual((f as any).lifeScore.days["2026-11-26"], { happy: 8 });
  assert.equal((cleanFamily({}) as any).lifeScore, undefined);
  assert.match(readFileSync("client/src/components/family-hub/lifeApps.tsx", "utf8"), /lifescore: \(p\) => <LifeScoreApp \{\.\.\.p\} \/>/);
  const plist = readFileSync("arisetodo/ios-app/configure-ios.py", "utf8");
  for (const w of ["sleep", "resting heart rate", "heart rate variability", "mindful minutes", "Life Score"]) assert.ok(plist.includes(w), w);
  const reads = readFileSync("client/src/lib/lifeScoreHealth.ts", "utf8");
  assert.match(reads, /write: \[\]/, "read only");
});

test("checking off a Life Score to-do raises that measure for a week (Nov 26, 2026)", async () => {
  const { withTodos, todosDoneFor, TODO_POINTS, TODO_MAX } = await import("../shared/lifeScore");
  const spending = METRICS.find((m) => m.id === "budget")!;
  const todo = spending.todos[0];
  // No budget yet: the to-do alone gives Spending a score, and the Life Score with it.
  const input = { ...base(), doneTodos: [{ title: todo.toUpperCase() + " ", date: today }] };
  const r = lifeScore(input, today);
  const m = r.metrics.find((x) => x.id === "budget")!;
  assert.equal(m.score, 60);
  assert.deepEqual(m.todosDone, [todo]);
  assert.notEqual(r.score, null);
  // On a measure with numbers: +10 each, up to +20, and gone after 7 days.
  assert.equal(withTodos(50, 1), 50 + TODO_POINTS);
  assert.equal(withTodos(50, 5), 50 + TODO_MAX);
  assert.equal(withTodos(95, 2), 100);
  assert.equal(withTodos(null, 0), null);
  assert.deepEqual(todosDoneFor(spending, [{ title: todo, date: plusDays(today, -6) }], today), [todo]);
  assert.deepEqual(todosDoneFor(spending, [{ title: todo, date: plusDays(today, -7) }], today), []);
  // Someone else's to-do with another title does nothing; nothing done, nothing changes.
  assert.equal(lifeScore({ ...base(), doneTodos: [{ title: "Buy milk", date: today }] }, today).score, null);
});

test("the Life Score app: done to-dos feed the score, the to-do buttons show where each stands, and Check in is always in sight", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../client/src/components/family-hub/LifeScoreApp.tsx", import.meta.url), "utf8");
  assert.match(app, /fit: extra\.fit, doneTodos \}/);
  assert.match(app, /data-testid="life-score-checkin-top"/);
  assert.match(app, /data-testid="life-score-metric-checkin"/);
  assert.match(app, /data-testid="life-score-how"/);
  assert.match(app, /data-state=\{state\}/);
  const bridge = readFileSync(new URL("../client/src/lib/hubTasksBridge.ts", import.meta.url), "utf8");
  assert.match(bridge, /completedAt\?: string \}\[\];/, "every hub tells plugins when a to-do was checked off");
});
