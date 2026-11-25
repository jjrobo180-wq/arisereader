// Open a chosen hub by time or place when Arise To Duo opens (Nov 25, 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanHubOpen, distance, inWindow, pickHub, ruleWords, type HubOpenRule } from "../shared/hubAutoOpen";
import { cleanFamily, emptyFamily } from "../shared/familyHub";

const at = (iso: string) => new Date(iso); // local time of the test machine; days below use getDay()
const morning: HubOpenRule = { id: "m", hub: "life", on: true, kind: "time", from: "06:00", to: "11:00", days: [0, 1, 2, 3, 4, 5, 6] };
const school: HubOpenRule = { id: "s", hub: "work", on: true, kind: "time", from: "11:00", to: "16:00", days: [1, 2, 3, 4, 5] };
const work: HubOpenRule = { id: "w", hub: "work", on: true, kind: "place", from: "06:00", to: "11:00", days: [0, 1, 2, 3, 4, 5, 6], place: { name: "Work", lat: 39.78, lng: -104.77, radius: 150 } };

test("a time rule picks its hub inside its window, and nothing outside", () => {
  const wed = (h: number) => { const d = at("2026-11-25T00:00:00"); d.setHours(h, 0, 0, 0); return d; };
  assert.equal(pickHub([morning, school], wed(7))?.hub, "life");
  assert.equal(pickHub([morning, school], wed(13))?.hub, "work");
  assert.equal(pickHub([morning, school], wed(20)), null);
  assert.equal(pickHub([{ ...morning, on: false }], wed(7)), null);
  // A window past midnight.
  const night = { from: "22:00", to: "06:00", days: [3] };
  assert.ok(inWindow(night, 3, 23 * 60) && inWindow(night, 4, 60) && !inWindow(night, 4, 23 * 60));
});

test("a place rule wins when you're there", () => {
  const d = at("2026-11-25T08:00:00");
  assert.equal(pickHub([morning, work], d, { lat: 39.7801, lng: -104.7701 })?.hub, "work");
  assert.equal(pickHub([morning, work], d, { lat: 39.9, lng: -104.9 })?.hub, "life");
  assert.ok(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 }) > 100);
});

test("rules are cleaned and saved with LifeHub", () => {
  assert.deepEqual(cleanHubOpen([{ hub: "nope" }, { hub: "work", kind: "place" }]), []);
  const [r] = cleanHubOpen([{ id: "a", hub: "family", from: "25:00", days: [9, 1] }])!;
  assert.equal(r.from, "06:00"); assert.deepEqual(r.days, [1]); assert.equal(r.kind, "time");
  const f = cleanFamily({ ...emptyFamily(), hubOpen: [morning, work] } as any);
  assert.equal(f.hubOpen?.length, 2);
  assert.equal(ruleWords(school), "Weekdays 11:00 AM – 4:00 PM");
  assert.equal(ruleWords(work), "At Work");
});

test("To Duo switches only a hub page, when it opens or comes back", () => {
  const lib = readFileSync("client/src/lib/hubAutoOpen.ts", "utf8");
  assert.match(lib, /const HUB_HASH = \/\^#\\\/\(lifehub\|workhub\|familyhub\)\\\/\?\$\//);
  assert.match(lib, /Date\.now\(\) - hiddenAt >= REOPEN_AFTER_MS/);
  assert.match(readFileSync("client/src/App.tsx", "utf8"), /useHubAutoOpen\(user\?\.id, !!user && !isLoading\);/);
  assert.match(readFileSync("client/src/pages/AriseTodo.tsx", "utf8"), /!familySpace && <HubAutoOpenSettings family=\{family\}/);
});
