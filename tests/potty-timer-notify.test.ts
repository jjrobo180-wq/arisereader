import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPottyTimers } from "../server/pottyTimers";
import { cleanTimerSync, dueTimers, pruneTimers, readTimers, ringMessage, STALE_MS, REPEAT_EVERY_MS, MAX_REPEATS, KEEP_MS } from "../shared/pro/potty/timerPush";
import { minutesAfter, parseClock, resolveWhen, whenText, JUST_NOW } from "../shared/pro/potty/when";
import { cleanData, DEFAULT_DATA } from "../shared/pro/potty";

const at = (h: number, m: number, dayOffset = 0) => { const d = new Date(2026, 9, 17 + dayOffset, h, m, 0, 0); return d.getTime(); };

test("typed time: parses clock text", () => {
  assert.deepEqual(parseClock("14:05"), { h: 14, m: 5 });
  assert.deepEqual(parseClock(" 2:05 "), { h: 2, m: 5 });
  for (const bad of ["", "25:00", "12:60", "noon", "1405", "12"]) assert.equal(parseClock(bad), null, bad);
});

test("typed time: today, yesterday, future and too-old", () => {
  const now = at(15, 0);
  assert.deepEqual(resolveWhen(JUST_NOW, now), { ok: true, at: now });
  assert.deepEqual(resolveWhen({ mode: "ago", ago: 30 }, now), { ok: true, at: now - 30 * 60_000 });
  assert.deepEqual(resolveWhen({ mode: "time", time: "13:20", yesterday: false }, now), { ok: true, at: at(13, 20) });
  assert.deepEqual(resolveWhen({ mode: "time", time: "22:10", yesterday: true }, now), { ok: true, at: at(22, 10, -1) });
  const future = resolveWhen({ mode: "time", time: "16:00", yesterday: false }, now);
  assert.equal(future.ok, false);
  if (!future.ok) assert.match(future.error, /Yesterday/);
  assert.equal(resolveWhen({ mode: "time", time: "", yesterday: false }, now).ok, false);
  assert.deepEqual(resolveWhen({ mode: "time", time: "15:00", yesterday: false }, now), { ok: true, at: now }, "this very minute is fine");
});

test("typed time: text and the timer counted from the event", () => {
  const now = at(15, 0);
  assert.equal(whenText(at(13, 20), now), "1:20 PM");
  assert.equal(whenText(at(22, 10, -1), now), "10:10 PM yesterday");
  assert.equal(minutesAfter(60, now - 40 * 60_000, now), 20);
  assert.equal(minutesAfter(60, now, now), 60);
  assert.equal(minutesAfter(60, now - 90 * 60_000, now), 1, "overdue rings straight away");
});

test("notify is a saved setting that defaults off", () => {
  assert.equal(DEFAULT_DATA.notify, false);
  assert.equal(cleanData({ notify: true }).notify, true);
  assert.equal(cleanData({ notify: "yes" }).notify, false);
  assert.equal(cleanData(null).notify, false);
});

test("timer sync: validates what the page sends", () => {
  const now = 1_000_000_000_000;
  assert.deepEqual(cleanTimerSync({ clear: true }, now), { clear: true });
  assert.equal(cleanTimerSync({ kid: "a", endAt: now + 60_000, minutes: 5 }, now) !== null, true);
  assert.equal(cleanTimerSync({ kid: "", endAt: now + 60_000 }, now), null);
  assert.equal(cleanTimerSync({ kid: "a", endAt: "soon" }, now), null);
  assert.equal(cleanTimerSync({ kid: "a", endAt: now + 7 * 3600_000 }, now), null, "too far ahead");
  assert.equal(cleanTimerSync({ kid: "a", endAt: now - STALE_MS - 1 }, now), null, "long over");
  const e: any = cleanTimerSync({ kid: "a", kidName: "  Ari\n\u0007  ", endAt: now + 1000, minutes: 9999 }, now);
  assert.equal(e.entry.kidName, "Ari");
  assert.equal(e.entry.minutes, 240);
});

test("timer rules: due, repeats, stale and pruning", () => {
  const now = 1_000_000_000_000;
  const base = { kid: "a", kidName: "Ari", minutes: 30, updatedAt: 0 };
  assert.deepEqual(dueTimers({ "1": { ...base, endAt: now + 1000 } }, now), []);
  assert.deepEqual(dueTimers({ "1": { ...base, endAt: now - 1000 } }, now), ["1"]);
  assert.deepEqual(dueTimers({ "1": { ...base, endAt: now - STALE_MS - 1 } }, now), []);
  assert.deepEqual(dueTimers({ "1": { ...base, endAt: now - 5000, sends: 1, lastSentAt: now - 5000 } }, now), [], "repeat not yet due");
  assert.deepEqual(dueTimers({ "1": { ...base, endAt: now - REPEAT_EVERY_MS - 5, sends: 1, lastSentAt: now - REPEAT_EVERY_MS } }, now), ["1"]);
  assert.deepEqual(dueTimers({ "1": { ...base, endAt: now - 1, sends: MAX_REPEATS + 1, lastSentAt: now - REPEAT_EVERY_MS * 2 } }, now), [], "no more than the cap");
  assert.deepEqual(Object.keys(pruneTimers({ "1": { ...base, endAt: now - KEEP_MS - 1 }, "2": { ...base, endAt: now } }, now)), ["2"]);
  assert.deepEqual(readTimers("not json"), {});
  assert.deepEqual(readTimers('{"abc":{"kid":"a","endAt":1}}'), {});
  assert.equal(ringMessage({ kidName: "Ari" }).title, "🚽 Potty time");
  assert.equal(ringMessage({ kidName: "Ari", sends: 1 }).title, "🚽 Potty time, still waiting");
  assert.deepEqual(ringMessage({ kidName: "Ari" }).closeTags, ["potty-live"]);
});

function rig(start = 1_000_000_000_000) {
  const clock = { t: start };
  const sent: { user: number; title: string }[] = [];
  const waits: { fn: () => void; ms: number; dead: boolean }[] = [];
  let stored: string | null = null;
  const timers = createPottyTimers({
    load: async () => stored, save: async (v) => { stored = v; },
    notify: async (user, m) => { sent.push({ user, title: m.title }); return 1; },
    registerDevice: async () => ({ ok: true }), now: () => clock.t,
    schedule: (fn, ms) => { const w = { fn, ms, dead: false }; waits.push(w); return w; }, unschedule: (h) => { h.dead = true; },
  });
  return { clock, sent, waits, timers, store: () => stored, reload: () => createPottyTimers({ load: async () => stored, save: async (v) => { stored = v; }, notify: async (user, m) => { sent.push({ user, title: m.title }); return 1; }, registerDevice: async () => ({ ok: true }), now: () => clock.t, schedule: (fn, ms) => ({ fn, ms, dead: false }), unschedule: () => {} }) };
}

test("server: rings once at the end time, then repeats twice, then stops", async () => {
  const r = rig();
  assert.equal(await r.timers.sync(7, { kid: "a", kidName: "Ari", endAt: r.clock.t + 600_000, minutes: 10 }), true);
  assert.equal(await r.timers.fire(), 0, "not yet");
  r.clock.t += 600_000;
  assert.equal(await r.timers.fire(), 1);
  assert.equal(await r.timers.fire(), 0, "no double send");
  r.clock.t += REPEAT_EVERY_MS; assert.equal(await r.timers.fire(), 1);
  r.clock.t += REPEAT_EVERY_MS; assert.equal(await r.timers.fire(), 1);
  r.clock.t += REPEAT_EVERY_MS; assert.equal(await r.timers.fire(), 0, "stops after the repeats");
  assert.deepEqual(r.sent.map((s) => s.title), ["🚽 Potty time", "🚽 Potty time, still waiting", "🚽 Potty time, still waiting"]);
});

test("server: stopping or replacing the timer cancels the push", async () => {
  const r = rig();
  await r.timers.sync(7, { kid: "a", kidName: "Ari", endAt: r.clock.t + 60_000, minutes: 1 });
  await r.timers.sync(7, { clear: true });
  r.clock.t += 120_000;
  assert.equal(await r.timers.fire(), 0);
  await r.timers.sync(7, { kid: "a", kidName: "Ari", endAt: r.clock.t + 60_000, minutes: 1 });
  await r.timers.sync(7, { kid: "a", kidName: "Ari", endAt: r.clock.t + 300_000, minutes: 5 });
  r.clock.t += 120_000;
  assert.equal(await r.timers.fire(), 0, "the first end time was replaced");
  r.clock.t += 200_000;
  assert.equal(await r.timers.fire(), 1);
});

test("server: the same timer sent again (page reopened) does not ring twice; people are separate", async () => {
  const r = rig();
  const end = r.clock.t + 1000;
  await r.timers.sync(1, { kid: "a", kidName: "Ari", endAt: end, minutes: 1 });
  await r.timers.sync(2, { kid: "b", kidName: "Bo", endAt: end, minutes: 1 });
  r.clock.t += 2000;
  assert.equal(await r.timers.fire(), 2);
  await r.timers.sync(1, { kid: "a", kidName: "Ari", endAt: end, minutes: 1 });
  assert.equal(await r.timers.fire(), 0);
  assert.deepEqual(r.sent.map((s) => s.user).sort(), [1, 2]);
});

test("server: exact wake-up is scheduled and survives a restart", async () => {
  const r = rig();
  await r.timers.sync(7, { kid: "a", kidName: "Ari", endAt: r.clock.t + 90_000, minutes: 2 });
  const w = r.waits.at(-1)!;
  assert.ok(w.ms >= 90_000 && w.ms <= 91_000, `wake in ~90s, got ${w.ms}`);
  r.clock.t += 90_000;
  w.fn(); await new Promise((x) => setTimeout(x, 10));
  assert.equal(r.sent.length, 1, "the wake-up sends");
  const again = r.reload();
  await again.ready();
  assert.equal(Object.keys(again.snapshot()).length, 1);
  r.clock.t += 5_000;
  assert.equal(await again.fire(), 0, "a restart does not repeat what was already sent");
});

test("server: a timer that ended long ago while the server was down is not announced", async () => {
  const r = rig();
  await r.timers.sync(7, { kid: "a", kidName: "Ari", endAt: r.clock.t + 1000, minutes: 1 });
  r.clock.t += STALE_MS + 5000;
  assert.equal(await r.timers.fire(), 0);
});

test("wiring: service worker, routes, and the Simple/PottyApp screens", () => {
  const sw = readFileSync("client/public/sw.js", "utf8");
  assert.match(sw, /closeTags/); assert.match(sw, /requireInteraction/);
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(routes, /registerPottyTimerRoutes\(/);
  const timers = readFileSync("server/pottyTimers.ts", "utf8");
  for (const p of ["/api/pro/potty/timer", "/api/pro/potty/push/subscribe", "/api/pro/potty/push/test"]) assert.ok(timers.includes(p), p);
  const simple = readFileSync("client/src/components/pro/potty/Simple.tsx", "utf8");
  assert.match(simple, /Type a time/); assert.match(simple, /PhoneNotify/); assert.match(simple, /minutesAfter/);
  const app = readFileSync("client/src/components/pro/potty/PottyApp.tsx", "utf8");
  assert.match(app, /syncPottyTimer/); assert.match(app, /showRunningTimer/);
  const push = readFileSync("server/pushNotifications.ts", "utf8");
  assert.match(push, /registerProDevice/);
});
