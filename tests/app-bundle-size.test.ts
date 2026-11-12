import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

test("apps that open straight into their own screens ship without Reader's and AAC's big folders", () => {
  const script = read(".github/scripts/prune_own_app_bundle.sh");
  for (const d of ["eyegaze", "classics", "reads", "avatar", "audio", "world", "pets"]) assert.ok(script.includes(` ${d}`) || script.includes(`${d} `), d);
  for (const [app, wf] of [["fit", "fit-ios"], ["trainer", "trainer-ios"], ["talk", "talk-ios"], ["undercover", "undercover-ios"]]) {
    assert.match(read(`.github/workflows/${wf}.yml`), new RegExp(`VITE_NATIVE_APP=${app} npx vite build\\n\\s+bash \\.github/scripts/prune_own_app_bundle\\.sh ${app} dist/public`), wf);
  }
  // Those apps are sent to their own screen before any route that could reach the removed files.
  const appTsx = read("client/src/App.tsx");
  const firstRoute = appTsx.indexOf("<PointsSideTab />");
  for (const check of ["if (isFitApp()) return", "if (isTalkApp()) return", "if (isTrainerApp()) return", "if (isUndercoverApp()) return", "if (isNotesApp()) return"]) {
    const at = appTsx.indexOf(check);
    assert.ok(at > 0 && at < firstRoute, `${check} comes before the shared screens`);
  }
});

test("Educator ships without the AAC talker engine, and says where the talker is", () => {
  assert.match(read(".github/workflows/educator-ios.yml"), /VITE_NATIVE_APP=educator npx vite build\n\s+bash \.github\/scripts\/prune_educator_bundle\.sh dist\/public/);
  assert.match(read(".github/scripts/prune_educator_bundle.sh"), /rm -rf "\$OUT\/eyegaze\/wren"/);
  assert.match(read("client/src/pages/EyeGazeWren.tsx"), /isNativeApp\(\) && nativeFlavor\(\) !== "eyegaze" && nativeFlavor\(\) !== "reader"/);
});

test("every live update has a size ceiling, and the small apps are stripped there too", () => {
  const ota = read(".github/workflows/ota-publish.yml");
  assert.match(ota, /fit\|trainer\|talk\)\n\s+VITE_NATIVE_APP=\$\{\{ matrix\.app \}\} npx vite build\n\s+bash \.github\/scripts\/prune_own_app_bundle\.sh/);
  assert.match(ota, /educator\)\n\s+VITE_NATIVE_APP=educator npx vite build\n\s+bash \.github\/scripts\/prune_educator_bundle\.sh/);
  assert.match(ota, /\*\) LIMIT=30 ;;/);
  assert.match(ota, /over its \$LIMIT MB limit/);
});
