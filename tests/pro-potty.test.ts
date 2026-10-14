import test from "node:test";
import assert from "node:assert/strict";
import { METHODS, READINESS, STORIES, accidentFreeDays, dayStats, dryNightsInARow, earnsSticker, hourPattern, readinessVerdict, suggestInterval, type PottyLog } from "../shared/pro/potty";
import { proApp } from "../shared/pro/apps";

const at = (day: string, hh: number, mm = 0) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d, hh, mm).getTime(); };
const L = (day: string, hh: number, mm: number, kind: PottyLog["kind"], kid = "k"): PottyLog => ({ id: `${day}${hh}${mm}${kind}`, kid, at: at(day, hh, mm), kind });

test("day stats count wins, accidents and the success rate for one child", () => {
  const logs = [L("2026-10-10", 8, 0, "pee"), L("2026-10-10", 10, 0, "acc-pee"), L("2026-10-10", 12, 0, "both"), L("2026-10-10", 13, 0, "try"), L("2026-10-10", 9, 0, "pee", "other")];
  const s = dayStats(logs, "k", "2026-10-10");
  assert.deepEqual([s.successes, s.accidents, s.tries], [2, 1, 1]);
  assert.equal(Math.round(s.rate! * 100), 67);
  assert.equal(dayStats(logs, "k", "2026-10-11").rate, null);
});

test("accident-free days and dry nights count back from today", () => {
  const logs = [L("2026-10-08", 9, 0, "acc-pee"), L("2026-10-09", 9, 0, "pee"), L("2026-10-10", 9, 0, "pee"), L("2026-10-11", 9, 0, "pee")];
  assert.equal(accidentFreeDays(logs, "k", at("2026-10-11", 20)), 3);
  assert.equal(accidentFreeDays(logs, "k", at("2026-10-12", 7)), 3, "today with nothing logged yet doesn't break the streak");
  const nights = [L("2026-10-08", 6, 0, "night-wet"), L("2026-10-09", 6, 0, "night-dry"), L("2026-10-10", 6, 0, "night-dry")];
  assert.equal(dryNightsInARow(nights, "k"), 2);
});

test("reminder suggestion comes from the child's own rhythm, 15 min early", () => {
  const day = "2026-10-12"; const now = at(day, 20);
  const logs = [8, 9.5, 11, 12.5, 14, 15.5].map((h) => L(day, Math.floor(h), (h % 1) * 60, "pee"));
  assert.equal(suggestInterval(logs, "k", now), 75); // every 90 min → remind every 75
  assert.equal(suggestInterval(logs.slice(0, 3), "k", now), null, "needs at least 4 gaps");
  assert.equal(hourPattern(logs, "k", now)[9], 1);
});

test("stickers, readiness and content are complete", () => {
  assert.ok(earnsSticker("pee") && earnsSticker("night-dry") && !earnsSticker("acc-pee") && !earnsSticker("try"));
  assert.equal(readinessVerdict(8).tone, "go"); assert.equal(readinessVerdict(5).tone, "soon"); assert.equal(readinessVerdict(1).tone, "wait");
  assert.equal(READINESS.length, 10);
  assert.ok(METHODS.length >= 4 && METHODS.every((m) => m.steps.length >= 5 && m.evidence));
  assert.ok(STORIES.length >= 6 && STORIES.every((s) => s.scenes.length >= 5 && s.scenes.every((sc) => sc.text && sc.actors.length)));
  assert.equal(proApp("potty")?.group, "health");
});
