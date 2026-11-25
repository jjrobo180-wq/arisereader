// Where the Forward button is in each big email app (shared/forwardSteps.ts), under both forwarding cards.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FORWARD_APPS } from "../shared/forwardSteps";

test("every major email app has steps that end with pasting the address and sending", () => {
  for (const n of ["Gmail app", "Gmail", "iPhone Mail", "Mac Mail", "Outlook app", "Outlook", "Yahoo Mail", "iCloud Mail", "AOL Mail", "Proton Mail"]) assert.ok(FORWARD_APPS.some((a) => a.name === n), n);
  for (const a of FORWARD_APPS) { assert.ok(a.steps.length >= 3, a.name); assert.match(a.steps.at(-1)!, /Paste your private address/); assert.ok(a.steps.some((s) => /Forward/.test(s)), a.name); }
  assert.equal(new Set(FORWARD_APPS.map((a) => a.id)).size, FORWARD_APPS.length);
});

test("LifeHub's and WorkHub's forwarding cards both show them", () => {
  assert.match(readFileSync("client/src/components/family-hub/EmailForward.tsx", "utf8"), /<ForwardHowTo \/>/);
  assert.match(readFileSync("client/src/components/teacher-hub/HubInbox.tsx", "utf8"), /\{view\.address && <ForwardHowTo \/>\}/);
});
