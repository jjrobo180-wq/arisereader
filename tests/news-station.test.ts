// Pod+ Live News Radio as one station for everyone (server/newsStation.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { newsStation, planStation, stationView } from "../server/newsStation";

const NOW = Date.parse("2026-10-31T19:00:00Z");
const ep = (id: string, showId: string, minsAgo: number, secs = 300) => ({ id, showId, show: showId, author: "", title: id, about: "", audio: `https://a/${id}.mp3`, date: new Date(NOW - minsAgo * 60_000).toISOString(), secs, art: "", link: "", explicit: false });

test("the schedule runs back to back from now, newest first, and fills the next 40 minutes", () => {
  const plan = planStation([], [ep("npr", "npr", 5, 300), ep("cbs", "cbs", 20, 240), ep("abc", "abc", 50, 180)], NOW);
  assert.deepEqual(plan.slice(0, 3).map((s) => s.ep.id), ["npr", "cbs", "abc"]);
  assert.equal(plan[0].startsAt, NOW);
  for (let i = 1; i < plan.length; i++) assert.equal(plan[i].startsAt, plan[i - 1].startsAt + plan[i - 1].secs * 1000);
  assert.ok(plan[plan.length - 1].startsAt + plan[plan.length - 1].secs * 1000 >= NOW + 40 * 60_000);
  // Repeats are never back to back.
  for (let i = 1; i < plan.length; i++) assert.notEqual(plan[i].ep.id, plan[i - 1].ep.id);
});

test("what's on air stays put, and a bulletin that just came out goes on next", () => {
  const first = planStation([], [ep("npr1", "npr", 30), ep("cbs", "cbs", 40)], NOW);
  const later = NOW + 120_000; // npr1 is on air, 2 minutes in
  const plan = planStation(first, [ep("npr2", "npr", -1), ep("cbs", "cbs", 42)], later);
  assert.equal(plan[0].ep.id, "npr1");
  assert.equal(plan[0].startsAt, NOW);
  assert.equal(plan[1].ep.id, "npr2");
  assert.equal(plan[1].startsAt, NOW + 300_000);
});

test("every listener gets the same view: the bulletin on air and the next few", () => {
  const plan = planStation([], [ep("a", "a", 5, 100), ep("b", "b", 6, 100)], NOW);
  const v = stationView(plan, NOW + 150_000);
  assert.equal(v.slots[0].ep.id, "b");
  assert.equal(v.slots[0].startsAt, NOW + 100_000);
  assert.equal(v.now, NOW + 150_000);
});

test("bulletins with no known length or no https file are left out", () => {
  const plan = planStation([], [ep("nolen", "x", 1, 0), { ...ep("http", "y", 1), audio: "http://a/x.mp3" }, ep("ok", "z", 2)], NOW);
  assert.deepEqual(Array.from(new Set(plan.map((s) => s.ep.id))), ["ok"]);
});

test("the service keeps one schedule and carries it across a restart", async () => {
  let clock = NOW; const store = new Map<string, any>();
  const kv = { get: async (k: string) => (store.has(k) ? { value: store.get(k), at: 0 } : null), set: async (k: string, v: any) => { store.set(k, JSON.parse(JSON.stringify(v))); } };
  const eps = [ep("a", "a", 5, 300), ep("b", "b", 6, 300)];
  const one = newsStation({ episodes: () => eps, kv, now: () => clock });
  const v1 = await one.view();
  await new Promise((r) => setTimeout(r, 10));
  clock += 60_000;
  const two = newsStation({ episodes: () => eps, kv, now: () => clock });
  const v2 = await two.view();
  assert.equal(v2.slots[0].ep.id, v1.slots[0].ep.id);
  assert.equal(v2.slots[0].startsAt, v1.slots[0].startsAt);
});
