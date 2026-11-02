// Arise Fit drop 3: Apple Health and reminders on the iPhone.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFit, mergeWeights } from "../shared/fit";

test("the Fit iPhone build has Apple Health and notifications, with the permission text iOS needs", () => {
  const pkg = JSON.parse(readFileSync("fit/ios-app/package.json", "utf8"));
  assert.match(pkg.dependencies["@capgo/capacitor-health"], /\^8/);
  assert.equal(pkg.dependencies["@capacitor/local-notifications"], "8.0.0");
  assert.match(readFileSync(".github/workflows/fit-ios.yml", "utf8"), /apple_signing\.py com\.arisereader\.fit "\$RUNNER_TEMP\/profile\.mobileprovision" HEALTHKIT APPLE_ID_AUTH/);
  const plist = readFileSync(".github/scripts/configure_fit_app.py", "utf8");
  for (const k of ["NSHealthShareUsageDescription", "NSHealthUpdateUsageDescription", "NSLocationWhenInUseUsageDescription", "NSCameraUsageDescription"]) assert.match(plist, new RegExp(`"${k}": "Arise Fit`), k);
});

test("Health and reminders go through Capacitor's bridge and fail with a clear message", () => {
  const n = readFileSync("client/src/pages/fit/fitNative.ts", "utf8");
  assert.match(n, /nativeCall\(\/\^Health\$\|CapacitorHealth\/i, "Health"/);
  assert.match(n, /nativeCall\(\/LocalNotifications\/i, "LocalNotifications"/);
  assert.match(n, /needs the newest Arise Fit from TestFlight/);
  for (const f of ["FitApp.tsx", "FitTrain.tsx", "FitRun.tsx"]) assert.match(readFileSync(`client/src/pages/fit/${f}`, "utf8"), /saveToHealth\(/, `${f} saves to Health`);
  assert.match(readFileSync("client/src/pages/fit/FitFasting.tsx", "utf8"), /scheduleFastEnd\(/);
});

test("Apple Health weigh-ins fill in days the app doesn't have; the app's own entries win", () => {
  const d = { ...emptyFit(), weights: [{ date: "2026-10-30", kg: 80 }] };
  const m = mergeWeights(d, [{ date: "2026-10-30", kg: 82 }, { date: "2026-10-29", kg: 81 }, { date: "2026-10-31", kg: 79.5 }]);
  assert.deepEqual(m.weights, [{ date: "2026-10-29", kg: 81 }, { date: "2026-10-30", kg: 80 }, { date: "2026-10-31", kg: 79.5 }]);
  assert.equal(mergeWeights(d, []), d, "nothing new: unchanged");
});
