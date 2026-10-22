import test from "node:test";
import assert from "node:assert/strict";
import { emptyFamily } from "../shared/familyHub";
import { arrangeLive, liveFaces, nextEvent } from "../shared/liveTiles";
import { startSize } from "../shared/startScreen";

const TODAY = "2026-10-14";
const NOW = new Date(2026, 9, 14, 9, 55).getTime();
const ev = (id: string, title: string, date: string, time: string) => ({ id, title, date, time, endTime: "", calendarId: "", memberIds: [], location: "", notes: "", repeat: "none" as const });

test("tasks tile counts what is due and names the next one", () => {
  const f = emptyFamily();
  const tasks = [{ title: "Pay rent", due: TODAY, time: "17:00", done: false }, { title: "Old", due: "2026-10-01", time: "", done: false }, { title: "Done", due: TODAY, time: "", done: true }, { title: "Later", due: "2026-10-20", time: "", done: false }];
  const faces = liveFaces(f, tasks, TODAY, NOW).tasks;
  assert.equal(faces[0].big, "2"); assert.match(faces[0].text, /tasks due/);
  assert.equal(faces[1].text, "Old");
  assert.equal(liveFaces(f, [], TODAY, NOW).tasks[0].big, "✓");
});

test("calendar tile shows the next event from now, skipping ones already past", () => {
  const f = emptyFamily();
  f.events = [ev("a", "Standup", TODAY, "08:00"), ev("b", "Dentist", TODAY, "15:30"), ev("c", "Soccer", "2026-10-15", "09:00")];
  const n = nextEvent(f, TODAY, NOW)!;
  assert.equal(n.title, "Dentist"); assert.match(n.when, /Today · 3:30 PM/);
  const faces = liveFaces(f, [], TODAY, NOW).calendar;
  assert.equal(faces[0].big, "3:30 PM"); assert.match(faces[0].text, /Dentist/);
  assert.match(faces[1].text, /event/);
  const late = nextEvent(f, TODAY, new Date(2026, 9, 14, 20, 0).getTime())!;
  assert.equal(late.title, "Soccer"); assert.match(late.when, /^Tomorrow/);
  assert.equal(liveFaces(emptyFamily(), [], TODAY, NOW).calendar[0].big, "Free");
});

test("countdown, groceries and notes speak only when they have something", () => {
  const f = emptyFamily();
  f.sections = { countdowns: true, grocery: true };
  assert.equal(liveFaces(f, [], TODAY, NOW).countdowns, undefined);
  assert.equal(liveFaces(emptyFamily(), [], TODAY, NOW).grocery, undefined, "a section that is off says nothing");
  f.countdowns = [{ id: "1", title: "Trip", date: "2026-10-24", emoji: "✈️", color: "" }];
  f.groceries = [{ id: "g", name: "Milk", qty: "", aisle: "", checked: false }, { id: "h", name: "Eggs", qty: "", aisle: "", checked: true }];
  f.notes = [{ id: "n", title: "Ideas", body: "", color: "", pinned: true, updatedAt: "2026-10-01" }];
  const l = liveFaces(f, [], TODAY, NOW);
  assert.equal(l.countdowns[0].big, "10"); assert.match(l.countdowns[0].text, /days to Trip/);
  assert.equal(l.grocery[0].big, "1"); assert.match(l.grocery[0].text, /item to buy/);
  assert.equal(l.notes[0].text, "Ideas");
});

test("tiles with something to say take the bigger squares of the start screen", () => {
  const tiles = [{ n: "a" }, { n: "b" }, { n: "c", live: true }, { n: "d" }, { n: "e", live: true }, { n: "f" }, { n: "g" }, { n: "h" }, { n: "i" }, { n: "j" }];
  const out = arrangeLive(tiles, (i) => startSize(i));
  assert.equal(out.length, tiles.length);
  assert.deepEqual(out.map((t) => t.n).sort(), tiles.map((t) => t.n).sort());
  const bigSlots = out.map((_, i) => i).filter((i) => startSize(i) !== "small");
  assert.ok(out[bigSlots[0]].live && out[bigSlots[1]].live, JSON.stringify(out));
  // order of the plain ones is kept
  assert.deepEqual(out.filter((t) => !t.live).map((t) => t.n), ["a", "b", "d", "f", "g", "h", "i", "j"]);
});
