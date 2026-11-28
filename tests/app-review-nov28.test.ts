// App Review, Nov 28, 2026 (To Do 1.0 build 204): 5.2.5, 1.4.1, 3.1.1 and 2.5.1.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HEALTH_SOURCES } from "../shared/healthSources";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("5.2.5: no watch or TV app is named Duo", () => {
  for (const f of [".github/workflows/arisetodo-signed-release.yml", ".github/workflows/companions-sim.yml"]) {
    const names = [...read(f).matchAll(/--display "([^"]+)"/g)].map((m) => m[1]);
    for (const n of names) assert.ok(!/duo/i.test(n), `${f}: ${n}`);
  }
});

test("1.4.1: calorie recommendations show linked sources", () => {
  assert.ok(HEALTH_SOURCES.length >= 5);
  for (const s of HEALTH_SOURCES) assert.match(s.url, /^https:\/\//);
  assert.ok(HEALTH_SOURCES.some((s) => /Mifflin/.test(s.by)));
  for (const f of ["client/src/components/family-hub/Intake.tsx", "client/src/components/family-hub/Health.tsx", "client/src/pages/fit/FitOnboard.tsx", "client/src/pages/fit/FitFood.tsx", "client/src/pages/fit/FitApp.tsx"])
    assert.match(read(f), /<HealthSources\b/, f);
});

test("3.1.1: no codes unlock paid features in the iPhone apps", () => {
  const plus = read("client/src/pages/fit/FitPlus.tsx");
  const guest = plus.indexOf("<Title>Guest pass</Title>");
  assert.ok(guest > 0 && plus.lastIndexOf("{!native && <>", guest) > plus.lastIndexOf("</Sheet>", guest), "guest pass shown in the app");
  assert.match(read("client/src/pages/fit/FitApp.tsx"), /l\.pass && !isNativeApp\(\)/);
  const notes = read("client/src/components/arise-notes/SettingsScreen.tsx");
  assert.match(notes, /tab === "family" && !isNativeApp\(\)/);
  assert.match(notes, /!isNativeApp\(\) && <Row icon=\{<Users \/>\} label="Family"/);
});

test("2.5.1: Apple Health (HealthKit) is named in the menu and the iPhone setup", () => {
  assert.match(read("client/src/components/HubMoreMenu.tsx"), /label: "Apple Health"/);
  assert.match(read("client/src/components/AppWalkthrough.tsx"), /title: "Apple Health", text: "Arise To Do uses Apple Health \(HealthKit\)/);
});

test("1.4.1: other health information has sources too", async () => {
  const { ALL_HEALTH_TOPICS, sourcesFor } = await import("../shared/healthSources");
  for (const t of ALL_HEALTH_TOPICS) { const s = sourcesFor([t]); assert.ok(s.length > 0, t); for (const x of s) assert.match(x.url, /^https:\/\//); }
  for (const [f, topic] of [["client/src/components/family-hub/Cycle.tsx", "cycle"], ["client/src/components/family-hub/Pills.tsx", "medicine"], ["client/src/pages/fit/FitTrackers.tsx", "cycle"], ["client/src/components/family-hub/LifeHealthViews.tsx", "vitals"], ["client/src/components/family-hub/LifeHealthViews.tsx", "screenings"], ["client/src/components/pro/apps/health.tsx", "heart"], ["client/src/components/pro/apps/healthNudges.tsx", "mind"]])
    assert.ok(new RegExp(`<HealthSources[^>]*"${topic}"`).test(read(f)), `${f}: ${topic}`);
});

test("3.1.1: the iPhone purchase screens don't promise a guest pass", () => {
  assert.match(read("client/src/components/AllAccessOffer.tsx"), /isNativeApp\(\) \? \{ \.\.\.p, detail: p\.detail\.replace\(\/, with a guest pass for a friend\//);
  assert.match(read("client/src/pages/fit/FitPlus.tsx"), /!\(native && f\.id === "guest-pass"\)/);
});
