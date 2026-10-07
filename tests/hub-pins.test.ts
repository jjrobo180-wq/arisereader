import test from "node:test";
import assert from "node:assert/strict";
import { MAX_PINS, cleanColor, cleanPins, isPinned, resolvePins, textOn, togglePin } from "../shared/hubPins";
import { emptyWorkspace, normalizeWorkspace, replaceCalendarEvents } from "../shared/teacherHub";

let n = 0; const mk = () => `id${++n}`;
const base = () => {
  const w = emptyWorkspace();
  w.tasks = Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, dueDate: "2026-10-09", recurring: "", done: false }));
  w.events = [{ id: "e1", title: "Staff meeting", date: "2026-10-08", start: "15:00", end: "16:00", location: "Library", notes: "" }];
  w.meetings = [{ id: "m1", student: "Sam R.", type: "IEP", date: "2026-10-12", notes: "", done: false }];
  return w;
};

test("pin and unpin a task, event and meeting", () => {
  let w = base();
  for (const [k, id] of [["task", "t0"], ["event", "e1"], ["meeting", "m1"]] as const) {
    w = togglePin(w, k, id, mk).workspace; assert.ok(isPinned(w, k, id));
  }
  const r = resolvePins(w);
  assert.deepEqual(r.map((x) => x.title), ["Task 0", "Staff meeting", "Sam R. · IEP"]);
  assert.match(r[1].detail, /15:00–16:00 · Library/);
  w = togglePin(w, "task", "t0", mk).workspace;
  assert.equal(isPinned(w, "task", "t0"), false);
  assert.equal(w.pins.length, 2);
});

test("five at most, each starting with a different color", () => {
  let w = base();
  for (let i = 0; i < MAX_PINS; i++) w = togglePin(w, "task", `t${i}`, mk).workspace;
  assert.equal(new Set(w.pins.map((p) => p.color)).size, MAX_PINS);
  const r = togglePin(w, "task", "t6", mk);
  assert.equal(r.full, true); assert.equal(r.workspace.pins.length, MAX_PINS);
});

test("a deleted item stops showing and frees its spot", () => {
  let w = base();
  for (let i = 0; i < MAX_PINS; i++) w = togglePin(w, "task", `t${i}`, mk).workspace;
  w = { ...w, tasks: w.tasks.filter((t) => t.id !== "t0") };
  assert.equal(resolvePins(w).length, 4);
  const r = togglePin(w, "task", "t6", mk);
  assert.equal(r.full, false); assert.equal(r.workspace.pins.length, 5);
});

test("a pinned calendar event survives a sync that gives it a new id", () => {
  const cal = { id: "c1", name: "Work", url: "u", syncedAt: "" };
  const ev = { title: "Staff meeting", date: "2026-10-08", start: "15:00", end: "16:00", location: "Library", notes: "" };
  let w = replaceCalendarEvents(emptyWorkspace(), cal, [ev], () => "old");
  w = togglePin(w, "event", "old", mk).workspace;
  w = replaceCalendarEvents(w, cal, [ev], () => "new");
  assert.equal(w.events[0].id, "new");
  assert.equal(resolvePins(w).length, 1);
  w = replaceCalendarEvents(w, cal, [], () => "x");
  assert.equal(resolvePins(w).length, 0);
});

test("saved pins are cleaned: colors, kinds and the limit of five", () => {
  assert.equal(cleanColor("red"), "#0f766e"); assert.equal(cleanColor("#ABCDEF"), "#abcdef");
  const pins = cleanPins([...Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, kind: "task", refId: "t", color: "nope", label: "x".repeat(500) })), { kind: "bogus" }, null]);
  assert.equal(pins.length, MAX_PINS); assert.equal(pins[0].label.length, 120); assert.equal(pins[0].color, "#0f766e");
  assert.deepEqual(normalizeWorkspace({ pins: "bad" }).pins, []);
});

test("text color is readable on dark and light banners", () => {
  assert.equal(textOn("#0f172a"), "#ffffff"); assert.equal(textOn("#facc15"), "#0f172a"); assert.equal(textOn("#ffffff"), "#0f172a");
});
