// The browser side of no-proctor quizzes: counting leaves, pictures, and what gets sent.
// Run: npx tsx --test tests/no-proctor-monitor.test.ts
import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NoProctorMonitor, PREVIEW_TOKEN } from "../client/src/lib/noProctorMonitor";

// A tiny browser: just the events, timers and network calls the monitor uses.
type Listener = (e?: any) => void;
const makeTarget = () => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener: (t: string, fn: Listener) => { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t)!.add(fn); },
    removeEventListener: (t: string, fn: Listener) => { listeners.get(t)?.delete(fn); },
    fire: (t: string, e: any = {}) => { for (const fn of [...(listeners.get(t) || [])]) fn(e); },
    count: (t: string) => listeners.get(t)?.size || 0,
  };
};
const doc: any = Object.assign(makeTarget(), { visibilityState: "visible", focused: true, hasFocus: () => doc.focused, createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,/9j/AAAA" }) });
const win: any = Object.assign(makeTarget(), { setTimeout, clearTimeout, setInterval, clearInterval, isSecureContext: true });
const beacons: { url: string; body: string }[] = [];
const fetches: { url: string; body: any; keepalive?: boolean }[] = [];
(globalThis as any).document = doc;
(globalThis as any).window = win;
Object.defineProperty(globalThis, "navigator", { value: { sendBeacon: (url: string, blob: any) => { beacons.push({ url, body: blob.__text }); return true; } }, configurable: true });
(globalThis as any).Blob = class { __text: string; size: number; type: string; constructor(parts: any[], o: any = {}) { this.__text = parts.map((p) => (typeof p === "string" ? p : "[bytes]")).join(""); this.size = this.__text.length; this.type = o.type || ""; } };
(globalThis as any).fetch = async (url: string, init: any) => { fetches.push({ url, body: init?.body, keepalive: init?.keepalive }); return { ok: true, status: 200 }; };



const fakeVideo = () => ({ videoWidth: 320, videoHeight: 240, srcObject: null as any, play: async () => {} });
const fakeStream = () => {
  const track = Object.assign(makeTarget(), { readyState: "live", stop() { track.readyState = "ended"; } });
  return { track, stream: { getVideoTracks: () => [track], getTracks: () => [track] } as any };
};

let leaves: number[] = [];
let returns: [number, number][] = [];
let camera: boolean[] = [];
let onLeaveHook: ((n: number) => void) | null = null;
function make(token = "a".repeat(48), extra: any = {}) {
  const m = new NoProctorMonitor({
    apiBase: "https://x.test", token, startedAt: Date.now(), leaves: 0, snapshotEveryMs: 30_000,
    onLeave: (n: number) => { leaves.push(n); onLeaveHook?.(n); },
    onReturn: (n: number, ms: number) => returns.push([n, ms]),
    onCamera: (on: boolean) => camera.push(on),
    ...extra,
  });
  const { stream, track } = fakeStream();
  m.setStream(stream);
  m.attachVideo(fakeVideo() as any);
  return { m, track };
}
const sentEvents = () => [
  ...beacons.flatMap((b) => JSON.parse(b.body).events),
  ...fetches.filter((f) => f.url.endsWith("/events")).flatMap((f) => JSON.parse(f.body).events),
].map((e: any) => e.type);

beforeEach(() => {
  mock.timers.reset();
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 1_700_000_000_000 });
  win.setTimeout = setTimeout; win.clearTimeout = clearTimeout; win.setInterval = setInterval; win.clearInterval = clearInterval;
  doc.visibilityState = "visible"; doc.focused = true;
  beacons.length = 0; fetches.length = 0; leaves = []; returns = []; camera = []; onLeaveHook = null;
});

test("switching tabs counts one leave even when the page also closes", () => {
  const { m } = make();
  m.start();
  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  win.fire("pagehide");
  assert.deepEqual(leaves, [1]);
  assert.equal(m.leaves, 1);
  assert.deepEqual(sentEvents(), ["left"], "sent right away with a beacon");
  mock.timers.tick(7000);
  doc.visibilityState = "visible";
  doc.fire("visibilitychange");
  assert.equal(returns.length, 1);
  assert.equal(returns[0][0], 1);
  assert.equal(returns[0][1], 7000);
  m.stop();
});

test("focus leaving the window counts only after the 2 second grace", () => {
  const { m } = make();
  m.start();
  doc.focused = false;
  win.fire("blur");
  mock.timers.tick(1500);
  doc.focused = true;
  win.fire("focus");
  mock.timers.tick(3000);
  assert.deepEqual(leaves, [], "a quick blur is not leaving");
  doc.focused = false;
  win.fire("blur");
  mock.timers.tick(2100);
  assert.deepEqual(leaves, [1], "a side panel or another window is");
  doc.focused = true;
  win.fire("focus");
  assert.equal(returns.length, 1);
  m.stop();
});

test("the leave that turns the quiz in hands its events to the turn-in request", () => {
  const { m } = make();
  m.start();
  m.copyAttempt();
  m.copyAttempt(); // within a second: counted once
  let drained: any[] = [];
  onLeaveHook = (n) => { if (n >= 1) drained = m.drain(); };
  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  assert.deepEqual(drained.map((e) => e.type), ["copy", "left"]);
  assert.deepEqual(sentEvents(), [], "nothing left to send separately");
  m.stop();
});

test("pausing stops counting; stop removes every listener and turns the camera off", () => {
  const { m, track } = make();
  m.start();
  m.pause();
  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  assert.deepEqual(leaves, []);
  m.unpause();
  m.stop();
  assert.equal(track.readyState, "ended");
  for (const t of ["visibilitychange"]) assert.equal(doc.count(t), 0);
  for (const t of ["blur", "focus", "pagehide"]) assert.equal(win.count(t), 0);
});

test("pictures: one at the start, every 30 seconds, and at a leave", () => {
  const { m } = make();
  m.start();
  mock.timers.tick(1000);
  const shots = () => fetches.filter((f) => f.url.includes("/snapshot")).map((f) => new URL(f.url).searchParams.get("reason"));
  assert.deepEqual(shots(), ["start"]);
  mock.timers.tick(30_000);
  assert.deepEqual(shots(), ["start", "interval"]);
  mock.timers.tick(500);
  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  // Too close to the last one: the leave picture waits for the minimum gap, then goes.
  assert.deepEqual(shots(), ["start", "interval"]);
  mock.timers.tick(2000);
  assert.deepEqual(shots(), ["start", "interval", "left"]);
  m.stop();
});

test("leaving inside the app counts as a leave; stopping the quiz does not", () => {
  const a = make();
  a.m.start();
  assert.equal(a.m.leaveForGood("page"), 1);
  assert.deepEqual(sentEvents(), ["left"]);
  beacons.length = 0;
  const b = make();
  b.m.start();
  assert.equal(b.m.leaveForGood("stopped"), 0);
  assert.deepEqual(sentEvents(), ["stopped"]);
});

test("the camera going off is noticed and logged once; turning it back on is logged too", () => {
  const { m, track } = make();
  m.start();
  track.readyState = "ended";
  track.fire("ended");
  mock.timers.tick(4100);
  assert.deepEqual(camera, [true, false]);
  const { stream } = fakeStream();
  m.setStream(stream);
  assert.deepEqual(camera, [true, false, true]);
  mock.timers.tick(5000);
  assert.deepEqual(sentEvents(), ["camera_off", "camera_on"]);
  m.stop();
});

test("preview mode works on screen but sends nothing", () => {
  const { m } = make(PREVIEW_TOKEN);
  m.start();
  mock.timers.tick(31_000);
  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  mock.timers.tick(6000);
  assert.deepEqual(leaves, [1]);
  assert.equal(fetches.length + beacons.length, 0);
  m.stop();
});
