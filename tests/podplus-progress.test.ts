// Pod+: a show's page shows the episode that's playing and the ones you've played, and Continue
// listening keeps the show you just left (EarshotExtras ShowPage, EarshotPlayer saveSpot, Home).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the show page marks the episode playing and the ones played", () => {
  const extras = read("../client/src/components/family-hub/earshot/EarshotExtras.tsx");
  assert.match(extras, /data-testid=\{isNow \? "show-episode-now" : played \? "show-episode-played" : undefined\}/);
  assert.match(extras, /nowPlaying \? "Episode playing" : "Episode paused"/);
  assert.match(extras, /played \? "Played"/);
  const player = read("../client/src/components/family-hub/earshot/EarshotPlayer.tsx");
  assert.match(player, /nowId=\{activeEp\?\.id\} nowPlaying=\{playing\} heard=\{es\.heard\}/);
});

test("switching shows keeps your spot at once, and Continue listening redraws when a spot is saved", () => {
  const player = read("../client/src/components/family-hub/earshot/EarshotPlayer.tsx");
  assert.match(player, /window\.dispatchEvent\(new Event\(SPOTS_EVENT\)\)/);
  assert.match(player, /export const SPOTS_EVENT = "earshot-spots"/);
  assert.match(player, /if \(!list\.length\) return;\n    keepSpot\(\);/);
  assert.match(player, /setPlaying\(false\); keepSpotRef\.current\(\);/);
  const home = read("../podscroll/Home.tsx");
  assert.match(home, /window\.addEventListener\("earshot-spots", again\)/);
});
