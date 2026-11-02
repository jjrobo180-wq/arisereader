// The iPhone apps' first-run tours act each step out on a small phone with the app's real screens
// (components/tour/TourScenes.tsx), instead of a single still icon.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const scenes = read("client/src/components/tour/TourScenes.tsx");

test("every tour page has an animated scene", () => {
  const ids = (src: string) => [...src.matchAll(/\{ id: "([a-z]+)"/g)].map((m) => m[1]);
  const walk = read("client/src/components/AppWalkthrough.tsx");
  for (const id of ids(walk.slice(0, walk.indexOf("function NativeTour")))) assert.match(scenes, new RegExp(`case "${id}": return <Todo`), `To Duo: ${id}`);
  for (const id of ids(read("client/src/components/ReaderFirstRun.tsx"))) assert.match(scenes, new RegExp(`case "${id}": return <(Reader|Educator)`), `Reader: ${id}`);
  const pod = read("podscroll/Welcome.tsx");
  for (const id of ids(pod)) assert.match(scenes, new RegExp(`case "${id}": return <Pod`), `Pod+: ${id}`);
  assert.match(walk, /<TodoScene id=\{step\.id\} \/>/);
  assert.match(read("client/src/components/ReaderFirstRun.tsx"), /<ReaderScene id=\{step\.id\} \/>/);
  assert.match(pod, /<PodScene id=\{step\.id\} \/>/);
});

test("the Pod+ tour shows Social, making a podcast, going live and earning", () => {
  const pod = read("podscroll/Welcome.tsx");
  for (const id of ["make", "social", "live", "earn"]) assert.match(pod, new RegExp(`id: "${id}"`));
  assert.match(pod, /Payouts are opening soon/, "honest about payouts");
});

test("scenes respect Reduce Motion and fit short screens", () => {
  assert.match(scenes, /prefers-reduced-motion:reduce/);
  assert.match(scenes, /export function SceneFit/);
  assert.doesNotMatch(scenes, /className="(?!ts-a")[^"]+"/, "inline styles only, so Pod+'s own build draws them too");
});
