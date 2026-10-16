import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NIGHT_SCENES, NIGHT_SCENE_ORDER, isNightHour, isNightScene, liveNightScene, photoUrl, photoWidth } from "../client/src/pages/atmosphere/nightScenery";
import { pluginsFor } from "../shared/pluginStore";

const app = readFileSync("client/src/pages/AmbientStandby.tsx", "utf8");
const css = readFileSync("client/src/pages/AmbientStandby.css", "utf8");
const photo = readFileSync("client/src/pages/atmosphere/NightPhoto.tsx", "utf8");

test("the app is named A.R.I.S.E. Standby everywhere people can see it", () => {
  for (const hub of ["work", "life"] as const) {
    const entry = pluginsFor(hub, { teacher: hub === "work" }).find((p) => p.id === `${hub}-atmosphere`);
    assert.ok(entry, "the store entry keeps its id so installed copies keep working");
    assert.equal(entry!.name, "A.R.I.S.E. Standby");
    assert.ok(!/atmosphere/i.test(entry!.name + entry!.tagline + entry!.description + entry!.features.join(" ")));
    assert.ok(/night/i.test(entry!.description));
  }
  assert.match(app, /<strong>STANDBY<\/strong>/);
  assert.match(app, /data-testid="arise-standby"/);
  for (const label of ["Standby menu", "Standby mode", "Standby settings"]) assert.ok(app.includes(label), label);
  assert.ok(!/ATMOSPHERE|Atmosphere (menu|mode|settings|is open)|open Atmosphere/.test(app), "no visible 'Atmosphere' text is left");
  assert.ok(app.includes('"arise-atmosphere-prefs:"'), "saved settings keep their storage key");
});

test("there are many real night scenes, each with a photo, a credit and a fallback colour", () => {
  assert.ok(NIGHT_SCENE_ORDER.length >= 16);
  assert.equal(new Set(NIGHT_SCENE_ORDER).size, NIGHT_SCENE_ORDER.length);
  assert.deepEqual([...NIGHT_SCENE_ORDER].sort(), Object.keys(NIGHT_SCENES).sort());
  const photos = new Set<string>();
  for (const id of NIGHT_SCENE_ORDER) {
    const s = NIGHT_SCENES[id];
    assert.equal(s.id, id);
    assert.match(s.photo, /^photo-\d{10,}-[0-9a-f]{12}$/, id);
    assert.ok(!photos.has(s.photo), "each scene has its own photograph");
    photos.add(s.photo);
    assert.ok(s.name && s.blurb && s.photographer, id);
    assert.match(s.focus, /^\d+% \d+%$/);
    assert.equal(s.tint.length, 2);
    for (const c of s.tint) assert.match(c, /^#[0-9a-f]{6}$/i);
    assert.ok(isNightScene(id));
  }
  assert.ok(!isNightScene("constructor") && !isNightScene("live") && !isNightScene("festival"));
});

test("photos are requested at the screen's real resolution, up to 4K", () => {
  assert.equal(photoWidth(1920, 1080, 2, "cinematic"), 3840);
  assert.equal(photoWidth(3840, 2160, 1, "cinematic"), 3840);
  assert.ok(photoWidth(390, 844, 3, "cinematic") <= 1280 * 2, "a phone is not sent a 4K file it cannot show");
  assert.ok(photoWidth(2560, 1440, 2, "balanced") <= 1920, "battery saver stays smaller");
  assert.ok(photoWidth(300, 300, 1, "cinematic") >= 640);
  const url = photoUrl(NIGHT_SCENES.milkyway.photo, 3840, 82);
  assert.equal(url, `https://images.unsplash.com/${NIGHT_SCENES.milkyway.photo}?auto=format&fit=max&w=3840&q=82`);
});

test("Live Weather turns to night scenery after dark and follows the sky", () => {
  assert.ok(isNightHour(22) && isNightHour(2) && !isNightHour(12) && !isNightHour(6));
  for (const w of ["clear", "clouds", "rain", "snow", "storm", "fog"] as const) assert.ok(isNightScene(liveNightScene(w)), w);
  assert.equal(liveNightScene("clear"), "milkyway");
  assert.match(app, /liveNightScene\(liveScene\)/);
});

test("the scene picker, menu and settings show the night scenery", () => {
  assert.match(app, /label: "Night scenery", ids: NIGHT_SCENE_ORDER/);
  assert.match(app, /SCENE_GROUPS\.map/);
  assert.ok((app.match(/SCENE_GROUPS\.map/g) ?? []).length >= 2, "both the quick menu and the settings list every group");
  assert.match(app, /Photo: \{nightScene\.name\} by \{nightScene\.photographer\} on/);
  assert.match(app, /<NightPhoto sceneId=\{nightId\}/);
  assert.match(app, /Gentle motion in night scenery/);
  assert.ok(app.includes("knownTheme"), "an old or unknown saved scene falls back instead of breaking");
});

test("the photo layer fades, sharpens, falls back and respects reduced motion", () => {
  assert.match(photo, /ambient-night-fallback/);
  assert.match(photo, /onerror/);
  assert.match(photo, /prefers-reduced-motion: reduce/);
  assert.match(photo, /photoWidth\(/);
  assert.match(css, /@keyframes ambient-drift/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.ambient-night-img \{ animation: none/);
});
