import { test } from "node:test";
import assert from "node:assert/strict";
import { realCards, discoverCards, introCard, inFilter, mindFor, type FeedCtx } from "../shared/ariseFeed.ts";
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
  for (const k of ["onNearEnd={nearEnd}", "setDay(f.health", "pillDoses", "choreDone", "gratitude", "journal", "/api/podscroll/feed"]) assert.ok(app.includes(k), k);
});
