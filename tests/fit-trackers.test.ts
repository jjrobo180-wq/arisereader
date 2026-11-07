// Arise Fit gets a Medicine tracker and a Period tracker plugin (November 2026).
// Run with: npx tsx --test tests/fit-trackers.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanFit, emptyFit } from "../shared/fit";
import { FIT_APP_BY_ID, cleanApps } from "../shared/fitApps";
import { adherence, cleanMeds, daysLeft, dosesOn, markDose, needsRefill, type Meds } from "../shared/fitMeds";
import { cleanCycle, entryOn, setEntry, summaryOf } from "../shared/fitCycle";

const med = (o: object = {}) => ({ id: "m1", name: "Vitamin D", dose: "1 tablet", times: ["20:00", "08:00"], days: [0, 1, 2, 3, 4, 5, 6], note: "", supply: 14, refillDays: 3, remind: true, color: "#60a5fa", ...o });

test("both are plugins people can add, and can sit on the tab bar", () => {
  for (const id of ["meds", "period"] as const) { assert.ok(FIT_APP_BY_ID.get(id), id); assert.equal(FIT_APP_BY_ID.get(id)!.tab, true); }
  assert.deepEqual(cleanApps({ added: ["meds", "period", "nope"], tabs: ["period"] })?.added, ["meds", "period"]);
});

test("medicine: doses by day, ticked off and counted down", () => {
  let m: Meds | undefined = cleanMeds({ list: [med()], log: {} });
  const day = "2026-11-07";
  assert.deepEqual(dosesOn(m, day).map((d) => d.time), ["08:00", "20:00"]);
  m = markDose(m, "m1", day, "08:00", "taken");
  assert.equal(m.list[0].supply, 13);
  assert.equal(dosesOn(m, day)[0].status, "taken");
  m = markDose(m, "m1", day, "20:00", "skipped");
  assert.equal(m.list[0].supply, 13, "skipping doesn't use a pill");
  m = markDose(m, "m1", day, "08:00", null);
  assert.equal(m.list[0].supply, 14, "undo gives it back");
  assert.deepEqual(adherence(m, day, 1), { taken: 0, due: 2, pct: 0 });
});

test("medicine: a day it isn't taken has no doses, and a low supply asks for a refill", () => {
  const m = cleanMeds({ list: [med({ days: [1], times: ["09:00"], supply: 2, refillDays: 14 })], log: {} })!;
  assert.equal(dosesOn(m, "2026-11-07").length, 0); // a Saturday
  assert.equal(dosesOn(m, "2026-11-09").length, 1); // a Monday
  assert.equal(daysLeft(m.list[0]), 14);
  assert.equal(needsRefill(m.list[0]), true);
});

test("medicine: bad saved data is made safe", () => {
  assert.equal(cleanMeds(null), undefined);
  const m = cleanMeds({ list: [{ id: "a", name: "  ", times: ["99:99"] }, med({ times: ["25:00"], days: [9] })], log: { "2026-11-07": { "m1@08:00": "taken", "x": "taken" }, bad: {} } })!;
  assert.equal(m.list.length, 1);
  assert.deepEqual(m.list[0].times, ["08:00"]);
  assert.equal(m.list[0].days.length, 7);
  assert.deepEqual(m.log, { "2026-11-07": { "m1@08:00": "taken" } });
  assert.ok(cleanFit({ ...emptyFit(), meds: { list: [med()], log: {} } }).meds);
});

test("period: logging days gives the cycle day, the next period and the fertile window", () => {
  let c = setEntry(undefined, { date: "2026-09-10", flow: "medium", symptoms: ["Cramps"], note: "" });
  for (const d of ["2026-09-11", "2026-09-12"]) c = setEntry(c, { date: d, flow: "light", symptoms: [], note: "" });
  for (const d of ["2026-10-08", "2026-10-09", "2026-10-10"]) c = setEntry(c, { date: d, flow: "medium", symptoms: [], note: "" });
  const s = summaryOf(c, "2026-11-01");
  assert.equal(s.cycleLength, 28);
  assert.equal(s.lastStart, "2026-10-08");
  assert.equal(s.dayOfCycle, 25);
  assert.equal(s.nextStart, "2026-11-05");
  assert.equal(s.daysUntil, 4);
  assert.ok(s.fertileStart && s.fertileEnd);
});

test("period: an empty day is removed, and saved data is cleaned", () => {
  let c = setEntry(undefined, { date: "2026-11-01", flow: "light", symptoms: [], note: "" });
  c = setEntry(c, { date: "2026-11-01", flow: "none", symptoms: [], note: "" });
  assert.equal(c.entries.length, 0);
  assert.equal(entryOn(c, "2026-11-01").flow, "none");
  const clean = cleanCycle({ entries: [{ date: "2026-11-02", flow: "bogus", symptoms: ["Cramps", "x"], note: " hi " }, { date: "nope", flow: "heavy" }] })!;
  assert.deepEqual(clean.entries, [{ date: "2026-11-02", flow: "none", symptoms: ["Cramps"], note: "hi" }]);
  assert.equal(cleanCycle(undefined), undefined);
});

test("the screens are wired into Arise Fit", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const app = read("client/src/pages/fit/FitApp.tsx");
  assert.match(app, /case "meds": return <MedsApp/);
  assert.match(app, /case "period": return <PeriodApp/);
  assert.match(read("client/src/pages/fit/FitApps.tsx"), /CalendarHeart, Pill,/);
});

test("Arise Fit and Arise Reader use their phone's own clock space; the apps iOS already insets are left alone", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const main = read("client/src/main.tsx");
  assert.match(main, /applyDeviceTopInset\(scale\);/);
  assert.match(main, /nativeFlavor\(\) === "reader"\) applyDeviceTopInset\(\);/);
  assert.match(read("client/src/index.css"), /html\.fit-app \{ --sat: max\(env\(safe-area-inset-top, 0px\), var\(--sat-device, 0px\)\); \}/);
  assert.match(read("client/src/reader-app.css"), /--sat: max\(env\(safe-area-inset-top, 0px\), var\(--sat-device, 0px\)\);/);
  // No raw top inset is left in Fit: all of it goes through --sat.
  const { readdirSync } = await import("node:fs");
  for (const f of readdirSync(new URL("../client/src/pages/fit/", import.meta.url)).filter((x) => /\.tsx?$/.test(x))) {
    const src = read(`client/src/pages/fit/${f}`).replace(/var\(--sat,env\(safe-area-inset-top,0px\)\)/g, "");
    assert.deepEqual(src.match(/env\(safe-area-inset-top[^)]*\)/g) ?? [], [], `${f} uses the raw safe area at the top`);
  }
  // The page is laid out at 0.9, so the clock's points are divided by it.
  const { deviceTopInset } = await import("../client/src/lib/deviceInsets");
  assert.equal(Math.round((deviceTopInset(402, 874)! / 0.9) * 10) / 10, 68.9);
});

test("Pod+ clears its phone's own clock space too", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.match(read("podscroll/main.tsx"), /classList\.add\("pod-native"\); applyDeviceTopInset\(\);/);
  assert.match(read("podscroll/styles.css"), /html\.pod-native \{ --sat: max\(env\(safe-area-inset-top, 0px\), var\(--sat-device, 0px\)\); \}/);
  for (const f of ["Home", "Welcome", "Account", "Auth", "main"]) {
    const src = read(`podscroll/${f}.tsx`).replace(/var\(--sat,env\(safe-area-inset-top,0px\)\)/g, "");
    assert.deepEqual(src.match(/env\(safe-area-inset-top[^)]*\)/g) ?? [], [], f);
  }
});
