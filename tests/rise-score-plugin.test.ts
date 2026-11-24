import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ADD_ON_SECTIONS, FAMILY_SECTIONS, TOGGLEABLE } from "../shared/familyHub.ts";

test("Rise Score is one plugin page, not a card on every page", () => {
  assert.ok(FAMILY_SECTIONS.includes("risescore" as any) && TOGGLEABLE.includes("risescore" as any) && !ADD_ON_SECTIONS.includes("risescore" as any), "Rise Score is on for everyone (it can still be turned off)");
  assert.match(readFileSync("shared/pluginStore.ts", "utf8"), /id: "life-risescore".*target: section\("risescore"\)/);
  const todo = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.doesNotMatch(todo, /<RiseScoreCard /);
  assert.doesNotMatch(todo, /scoreCard=\{/);
  assert.match(todo, /shown === "risescore" \? <RiseScorePlugin /);
  const card = readFileSync("client/src/components/RiseScoreCard.tsx", "utf8");
  assert.match(card, /data-testid="rise-hubs"/);
  assert.match(card, /Count FamilyHub/);
  assert.match(card, /Count WorkHub/);
});

test("the Plugin Gallery switches between Work, Life and Family", () => {
  const s = readFileSync("client/src/components/plugin-store/PluginStore.tsx", "utf8");
  assert.match(s, /\(\["work", "life", "family"\] as const\)\.map/);
  assert.match(s, /"#\/familyhub"/);
  assert.match(readFileSync("client/src/pages/AriseTodo.tsx", "utf8"), /hub="life"\n\s+familySpace=\{familySpace\}/);
});

test("Rise Score shows in the menu without adding it first", async () => {
  const { isOn, emptyFamily } = await import("../shared/familyHub.ts");
  assert.equal(isOn("risescore" as any, emptyFamily() as any), true);
});
