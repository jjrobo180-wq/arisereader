// Life Score's health log (shared/lifeHealthLog.ts): symptoms and vitals saved, cleaned and analysed; the standard
// categories readings fall in; and how they feed Life Score's measures (shared/lifeScore.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SYMPTOMS, bpCategory, cleanSymptoms, cleanVitals, symptomFindings, symptomList, symptomStats, vitalCategory, vitalStats, vitalsDay,
  type SymptomEntry, type VitalEntry,
} from "../shared/lifeHealthLog";
import { cleanLifeScore, emptyLifeScore, factsFor, lifeInputFrom, lifeScore, plusDays } from "../shared/lifeScore";

const today = "2026-11-26";
const at = (d: string, hm = "09:00") => `${d}T${hm}`;

test("symptoms and vitals are cleaned: bad ones dropped, numbers kept in range", () => {
  const s = cleanSymptoms([{ id: "a", at: at(today), symptom: "headache", severity: 14, triggers: ["Stress", "Stress", 5], note: "  ow " }, { at: "yesterday", symptom: "x", severity: 3 }, { at: at(today), symptom: "", severity: 3 }]);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0], { id: "a", at: at(today), symptom: "headache", severity: 10, triggers: ["Stress"], note: "ow" });
  const v = cleanVitals([{ id: "b", at: at(today), kind: "bp", value: 128, dia: 82, pulse: 70, context: "morning" }, { at: at(today), kind: "bp", value: "x" }, { at: at(today), kind: "sugar", value: 90 }, { id: "c", at: at(today), kind: "hr", value: 300, dia: 60 }]);
  assert.deepEqual(v, [{ id: "b", at: at(today), kind: "bp", value: 128, dia: 82, pulse: 70, context: "morning" }, { id: "c", at: at(today), kind: "hr", value: 250 }]);
  // Saved with Life Score.
  const c = cleanLifeScore({ ...emptyLifeScore(), symptoms: [{ id: "a", at: at(today), symptom: "headache", severity: 4 }], vitals: v })!;
  assert.equal(c.symptoms!.length, 1);
  assert.equal(c.vitals!.length, 2);
  assert.equal(cleanLifeScore(emptyLifeScore())!.symptoms, undefined);
});

test("blood pressure categories (AHA/ACC 2017) and other readings", () => {
  assert.equal(bpCategory(115, 75).label, "Normal");
  assert.equal(bpCategory(124, 78).label, "Elevated");
  assert.equal(bpCategory(132, 78).label, "High: stage 1");
  assert.equal(bpCategory(118, 84).label, "High: stage 1");
  assert.equal(bpCategory(145, 85).label, "High: stage 2");
  assert.equal(bpCategory(185, 100).level, "urgent");
  assert.equal(vitalCategory({ kind: "hr", value: 110 }).level, "watch");
  assert.equal(vitalCategory({ kind: "hr", value: 150, context: "after-exercise" }).level, "good");
  assert.equal(vitalCategory({ kind: "glucose", value: 110, context: "fasting" }).label, "Prediabetes range (fasting 100 to 125)");
  assert.equal(vitalCategory({ kind: "glucose", value: 130, context: "fasting" }).level, "high");
  assert.equal(vitalCategory({ kind: "glucose", value: 60 }).level, "urgent");
  assert.equal(vitalCategory({ kind: "temp", value: 101 }).label, "Fever");
  assert.equal(vitalCategory({ kind: "spo2", value: 88 }).level, "urgent");
});

test("warning-sign symptoms say to get care now, and 988 for thoughts of self-harm", () => {
  const urgent = SYMPTOMS.filter((s) => s.urgent);
  assert.ok(urgent.some((s) => s.id === "chest" && /911/.test(s.urgent!)));
  assert.ok(urgent.some((s) => s.id === "stroke"));
  assert.match(SYMPTOMS.find((s) => s.id === "self-harm")!.urgent!, /988/);
  assert.equal(new Set(SYMPTOMS.map((s) => s.id)).size, SYMPTOMS.length);
});

test("a symptom's stats: how often, how bad, when, triggers, what helped, and how its days differ", () => {
  const entries: SymptomEntry[] = [];
  const sleep: Record<string, number> = {};
  for (let i = 0; i < 40; i++) {
    const d = plusDays(today, -i);
    sleep[d] = i % 4 === 0 ? 5 : 8;
    if (i % 4 === 0) entries.push({ id: `h${i}`, at: at(d, "16:30"), symptom: "headache", severity: 6, minutes: 90, triggers: ["Poor sleep"], relief: "Ibuprofen", helped: true, where: "Head" });
  }
  entries.push({ id: "n", at: at(plusDays(today, -50)), symptom: "headache", severity: 2 });
  const s = symptomStats(entries, "headache", today, (d) => ({ sleep: sleep[d] }));
  assert.equal(s.last30, 8);
  assert.equal(s.prev30, 3);
  assert.equal(s.avgSeverity, 5.6);
  assert.equal(s.worst, 6);
  assert.equal(s.avgMinutes, 90);
  assert.equal(s.byPart[2], 10); // afternoon
  assert.deepEqual(s.topTriggers[0], { name: "Poor sleep", times: 10 });
  assert.deepEqual(s.helped[0], { name: "Ibuprofen", times: 10 });
  assert.equal(s.whereMost, "Head");
  assert.equal(s.freeStreak, 0);
  assert.equal(s.days.length, 30);
  assert.match(s.differences.join(" "), /slept 3 hours less/);
  const f = symptomFindings(s).join(" ");
  assert.match(f, /8 times in the last 30 days, up from 3/);
  assert.match(f, /Mostly in the afternoon/);
  assert.match(f, /Top trigger you noted: poor sleep/);
  assert.deepEqual(symptomList(entries, today).map((x) => [x.symptom, x.last30]), [["headache", 8]]);
});

test("a vital's stats: averages, range, morning vs evening, and findings", () => {
  const v: VitalEntry[] = [];
  for (let i = 0; i < 10; i++) {
    const d = plusDays(today, -i);
    v.push({ id: `m${i}`, at: at(d, "07:00"), kind: "bp", value: 138, dia: 86, context: "morning" });
    v.push({ id: `e${i}`, at: at(d, "20:00"), kind: "bp", value: 124, dia: 78, context: "evening" });
  }
  const s = vitalStats(v, "bp", today);
  assert.equal(s.count30, 20);
  assert.equal(s.avg30, 131);
  assert.equal(s.dia30, 82);
  assert.equal(s.morning, 138);
  assert.equal(s.evening, 124);
  assert.equal(s.levels.high, 10);
  assert.equal(s.latestCategory!.label, "Elevated"); // the latest is the evening one
  assert.match(s.findings.join(" "), /30-day average 131\/82: high: stage 1/);
  assert.match(s.findings.join(" "), /Mornings average 138, evenings 124/);
  assert.deepEqual(vitalsDay(v, today), { sys: 131, dia: 82 });
});

test("vitals and symptoms feed Life Score: Blood pressure, Symptom-free and the heart rate", () => {
  const input = lifeInputFrom({ lifeScore: emptyLifeScore() }, []);
  input.data.vitals = [{ id: "a", at: at(today), kind: "bp", value: 132, dia: 84 }, { id: "b", at: at(today), kind: "hr", value: 62 }];
  input.data.symptoms = [{ id: "c", at: at(plusDays(today, -1)), symptom: "headache", severity: 5 }];
  const f = factsFor(input, today);
  assert.equal(f.sys, 132);
  assert.equal(f.rhr, 62);
  assert.equal(f.symptomWorst, 0);
  const r = lifeScore(input, today);
  assert.equal(r.metrics.find((m) => m.id === "bp")!.score, 65);
  assert.equal(r.metrics.find((m) => m.id === "symptoms")!.score, 75); // (50 + 100) / 2
  assert.match(r.metrics.find((m) => m.id === "bp")!.value, /^132\/84 average/);
});
