import { test } from "node:test";
import assert from "node:assert/strict";
import { realCards, discoverCards, introCard, inFilter, mindFor, foodToday, movedToday, mealAt, healthMe, chapterOf, ALL_VERSES, ALL_QUOTES, type FeedCtx } from "../shared/ariseFeed.ts";
import { WORKOUTS, FOOD_IDEAS, HOBBIES, IDEAS, TRIVIA, CHAPTERS, MORE_VERSES } from "../shared/feedLibrary.ts";
import { localDay } from "../shared/lifeScore.ts";
import { plusDays, emptyLifeScore } from "../shared/lifeScore.ts";

const T = "2026-11-27";
const ls = emptyLifeScore(); ls.health[T] = { steps: 6240, exMin: 20, sleep: 6.5, deep: 50 }; ls.days[plusDays(T, -1)] = { faith: true };
const family: any = {
  members: [{ id: "me", name: "Jermaine", kind: "adult" }],
  lifeScore: ls,
  events: [{ id: "e1", title: "IEP meeting", date: plusDays(T, 3), time: "08:15", endTime: "", calendarId: "", memberIds: [], location: "Room 204", notes: "", repeat: "none" }, { id: "e2", title: "Staff lunch", date: T, time: "12:00", endTime: "", calendarId: "", memberIds: [], location: "", notes: "", repeat: "none" }],
  chores: [{ id: "c1", title: "Take out recycling", memberId: "me", rotation: [], days: [], points: 5 }],
  choreDone: [],
  health: { days: [{ memberId: "me", date: T, water: 3 }], goals: { me: { water: 8 } }, profiles: { me: {} } },
  habits: [{ id: "h1", name: "Read 10 pages", emoji: "📖", color: "#000", days: [plusDays(T, -1), plusDays(T, -2)] }],
  bills: [{ id: "b1", name: "Car payment", amount: 420, dueDay: Number(plusDays(T, 3).slice(8)), autopay: false, paid: [], category: "" }],
  jars: [{ id: "j1", name: "Vacation", emoji: "", color: "#000", target: 3000, saved: 1250 }],
  pills: [{ id: "p1", memberId: "me", name: "Vitamin D", dose: "1 tablet", times: ["08:00"], days: [], start: "", end: "", active: true }], pillDoses: [],
  goals: [{ id: "g1", title: "Run a half", kind: "number", target: 13, current: 8, unit: "mi", milestones: [], done: false, memberId: "me", due: plusDays(T, 60) }],
  birthdays: [{ id: "bd", name: "Mom", month: 12, day: 9, year: 1962, kind: "birthday" }],
  journal: [{ id: "j", date: plusDays(T, -40), title: "First snow", body: "We built a snowman after school." }],
};
const ctx: FeedCtx = { today: T, family, name: "Jermaine",
  tasks: [{ id: "t1", title: "Send CMAS forms", due: plusDays(T, -2), done: false, hub: "WorkHub", mine: false }, { id: "t2", title: "Print Emmett Till test", due: T, time: "15:00", done: false, hub: "LifeHub", mine: true }, { id: "t3", title: "Grocery run", due: plusDays(T, 1), done: false, hub: "LifeHub", mine: true }],
  podcasts: [{ id: "ep1", title: "Episode one", show: "Show", audio: "https://x/a.mp3", art: "", secs: 1800 }] };

test("the real things come first, most urgent first, with the right actions", () => {
  const c = realCards(ctx), kinds = c.map((x) => x.kind);
  assert.equal(c[0].title, "Send CMAS forms");
  assert.equal(c[0].doneable, false, "WorkHub to-dos open in WorkHub");
  assert.equal(c[1].title, "Print Emmett Till test");
  assert.equal(c[1].doneable, true);
  for (const k of ["pill", "event", "chore", "water", "rings", "sleep", "habit", "bill", "checkin", "birthday", "goal", "jar", "podcast"]) assert.ok(kinds.includes(k as any), k);
  assert.ok(kinds.indexOf("pill") < kinds.indexOf("water"), "medicines before water");
  const ev = c.filter((x) => x.kind === "event").map((x) => x.title);
  assert.deepEqual(ev, ["Staff lunch", "IEP meeting"], "today's events, then the week's");
  assert.equal(c.find((x) => x.kind === "water")!.big, "3");
});

test("it never runs out: every page has fresh cards, ids never collide", () => {
  const ids = new Set<string>();
  for (let p = 1; p <= 25; p++) {
    const page = discoverCards(ctx, p);
    assert.ok(page.length >= 10, `page ${p}: ${page.length}`);
    for (const c of page) { assert.ok(!ids.has(c.id), c.id); ids.add(c.id); }
  }
  const all = Array.from({ length: 10 }, (_, i) => discoverCards(ctx, i + 1)).flat();
  const kinds = new Set(all.map((c) => c.kind));
  for (const k of ["mind", "tip", "gratitude", "journal", "checkin", "memory"]) assert.ok(kinds.has(k as any), k);
  assert.deepEqual(discoverCards(ctx, 3).map((c) => c.id), discoverCards(ctx, 3).map((c) => c.id), "the same page twice is the same");
});

test("Mindset fills in without setup, with verses when check-ins show faith", () => {
  const m = mindFor(family);
  assert.ok(m.profile.bible);
  assert.ok(!mindFor({}).profile.bible);
});

test("intro and filters", () => {
  const i = introCard({ ...ctx, now: new Date("2026-11-27T15:00:00") }, 9);
  assert.match(i.title, /Good afternoon, Jermaine/);
  const c = realCards(ctx);
  assert.ok(c.filter((x) => inFilter(x, "money")).every((x) => x.cat === "money"));
});

test("Arise Feed is a LifeHub plugin, and AriseTodo gives it the to-dos to check off and move", async () => {
  const { readFileSync } = await import("node:fs");
  const { FAMILY_SECTIONS, TOGGLEABLE, ADD_ON_SECTIONS } = await import("../shared/familyHub.ts");
  const { pluginsFor } = await import("../shared/pluginStore.ts");
  assert.ok(FAMILY_SECTIONS.includes("feed" as any) && TOGGLEABLE.includes("feed" as any) && ADD_ON_SECTIONS.includes("feed" as any));
  assert.ok(pluginsFor("life", {} as any).some((p: any) => p.id === "life-feed"));
  const todo = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.match(todo, /shown === "feed" \? <AriseFeed/);
  assert.match(todo, /onToggleTask=\{\(id\) => \{ const task = data\.tasks\.find/);
  const app = readFileSync("client/src/components/family-hub/AriseFeed.tsx", "utf8");
  for (const k of ["onNearEnd={nearEnd}", "setDay(f.health", "pillDoses", "choreDone", "gratitude", "journal", "/api/earshot/feed", "/api/fit/data", "/api/lifehub/bible", "savedVerses", "savedWords", "collections", "earshot", "meditations"]) assert.ok(app.includes(k), k);
});

test("faith, food and fitness come up front: verse of the day, today's reading, food so far, the meal to log, a workout", () => {
  const c = realCards({ ...ctx, now: new Date(`${T}T12:30:00`) }), kinds = c.map((x) => x.kind);
  for (const k of ["verse", "chapter", "foodday", "foodlog", "workout"]) assert.ok(kinds.includes(k as any), k);
  assert.equal(c.find((x) => x.kind === "foodlog")!.meal, "lunch");
  assert.ok(c.find((x) => x.kind === "chapter")!.passage, "the chapter can be read in place");
  const v = c.find((x) => x.kind === "verse")!;
  assert.ok(v.verse && v.passage === chapterOf(v.verse.ref));
  // With a Cooked program, today's workout is its next day; once they've moved, it's a stat instead.
  const fit = { foods: [], program: { id: "ppl", started: T, done: [] }, workouts: [], runs: [] };
  const withProgram = realCards({ ...ctx, fit });
  assert.ok(withProgram.some((x) => x.kind === "program") || !withProgram.some((x) => x.kind === "workout"));
  const moved = realCards({ ...ctx, fit: { foods: [], workouts: [{ id: "w", date: `${T}T15:00:00`, name: "Legs", secs: 1800, exercises: [] }] } });
  assert.ok(moved.some((x) => x.id === `moved:${T}`) && !moved.some((x) => x.kind === "workout" || x.kind === "program"));
});

test("food today adds up Cooked, the LifeHub diary and Apple Health, against the goal", () => {
  const fam = { ...family, health: { ...family.health, food: [{ id: "a", memberId: "me", date: T, meal: "breakfast", name: "Eggs", servings: 2, calories: 72, protein: 6, carbs: 0, fat: 5 }] } };
  const fit = { profile: { kcalGoal: 2200, macroSplit: { p: 30, c: 40, f: 30 } }, foods: [{ id: "f", date: T, meal: "lunch", name: "Wrap", kcal: 420, p: 28, c: 36, f: 18, servings: 1 }, { id: "y", date: plusDays(T, -1), meal: "lunch", name: "Old", kcal: 999, p: 0, c: 0, f: 0, servings: 1 }] };
  const f = foodToday(fam, fit, T);
  assert.equal(f.kcal, 144 + 420);
  assert.equal(f.p, 12 + 28);
  assert.equal(f.goal, 2200);
  assert.equal(f.goals.p, Math.round((2200 * 0.3) / 4));
  assert.deepEqual([...f.meals].sort(), ["breakfast", "lunch"]);
  const apple = foodToday({ lifeScore: { health: { [T]: { eaten: 1500 } } } }, null, T);
  assert.equal(apple.kcal, 1500); assert.ok(apple.fromApple);
  assert.equal(mealAt(8), "breakfast"); assert.equal(mealAt(12), "lunch"); assert.equal(mealAt(16), "snack"); assert.equal(mealAt(19), "dinner"); assert.equal(mealAt(23), "snack");
});

test("exercise today counts Cooked workouts by the local day (they're saved with a UTC timestamp)", () => {
  const late = new Date(`${T}T20:00:00`).toISOString(); // the next day in UTC for anyone west of London
  assert.equal(localDay(late), T);
  assert.equal(localDay(T), T);
  assert.equal(movedToday({}, { workouts: [{ date: late, secs: 1500 }, { date: late, secs: 600, programId: "session-mind" }] }, T), 25, "meditation sessions don't count");
  assert.equal(healthMe({ members: [] }), "me", "no members: the signed-in person's own diary");
});

test("the libraries are real and full: verses with KJV text, quotes, workouts from Cooked's moves, food with nutrition", async () => {
  const { CATALOG_BY_ID } = await import("../shared/fit.ts");
  assert.ok(ALL_VERSES.length >= 250, `verses ${ALL_VERSES.length}`);
  assert.equal(new Set(ALL_VERSES.map((v) => v.ref.replace(/\s+/g, "").toLowerCase())).size, ALL_VERSES.length, "each verse once");
  for (const v of MORE_VERSES) { assert.match(v.ref, /^[1-3]? ?[A-Z][a-z]+(?: of [A-Z][a-z]+)? \d+:\d+(-\d+)?$/, v.ref); assert.ok(v.text.length > 15, v.ref); }
  assert.ok(ALL_QUOTES.length >= 250, `quotes ${ALL_QUOTES.length}`);
  assert.ok(CHAPTERS.length > 230 && CHAPTERS.some((c) => c.ref === "Psalm 23") && CHAPTERS.some((c) => c.ref === "John 21"));
  for (const w of WORKOUTS) {
    assert.ok(w.moves.length && w.moves.every((m) => (m.secs ?? 0) > 0 || (m.reps ?? 0) > 0), w.id);
    const total = (w.moves.reduce((a, m) => a + (m.secs ?? (m.reps ?? 0) * 3), 0) * w.rounds) / 60;
    assert.ok(total <= w.mins * 1.6 + 2, `${w.id}: ${Math.round(total)} min of moves for a ${w.mins}-minute workout`);
  }
  assert.ok(WORKOUTS.flatMap((w) => w.moves).filter((m) => CATALOG_BY_ID.has(m.exId)).length > 40, "most moves are Cooked's own exercises");
  for (const f of FOOD_IDEAS) { const est = f.p * 4 + f.c * 4 + f.f * 9; assert.ok(Math.abs(est - f.kcal) / f.kcal < 0.25, `${f.name}: ${f.kcal} vs ${est} from macros`); }
  assert.ok(HOBBIES.length >= 45 && IDEAS.length >= 60 && TRIVIA.length >= 30);
  for (const t of TRIVIA) assert.ok(t.answer >= 0 && t.answer < t.options.length, t.q);
});

test("the endless part mixes everything and doesn't repeat a library until it's all been seen", () => {
  const pages = Array.from({ length: 12 }, (_, i) => discoverCards({ ...ctx, podcasts: [...ctx.podcasts!, { id: "d", title: "New", show: "Fresh", showId: "s", audio: "x", art: "", secs: 60, discover: true }] }, i + 1));
  const kinds = new Set(pages.flat().map((c) => c.kind));
  for (const k of ["verse", "chapter", "quote", "show", "workout", "activity", "breath", "food", "hobby", "idea", "kind", "book", "lesson", "fact", "trivia", "word", "mind"]) assert.ok(kinds.has(k as any), k);
  assert.ok(pages[0].length >= 25, `page 1 has ${pages[0].length}`);
  for (const p of pages) for (let i = 1; i < p.length; i++) if (p[i].kind === p[i - 1].kind) assert.fail(`two ${p[i].kind} cards in a row`);
  const verses = pages.flat().filter((c) => c.kind === "verse").map((c) => c.verse!.ref);
  assert.equal(new Set(verses).size, verses.length, "no verse twice in 12 pages");
  const hobbies = pages.flat().filter((c) => c.kind === "hobby").map((c) => c.title);
  assert.equal(new Set(hobbies).size, hobbies.length);
});
