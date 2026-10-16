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
  assert.match(app, /Gentle motion and video in night scenery/);
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

import { VIDEO_SCENES, VIDEO_SCENE_LIST, VIDEO_SCENE_ORDER, isVideoScene, videoFile, videoSources } from "../client/src/pages/atmosphere/videoScenery";

test("live video scenes are real clips, each backed by a still photo", () => {
  assert.ok(VIDEO_SCENE_LIST.length >= 24);
  assert.equal(new Set(VIDEO_SCENE_ORDER).size, VIDEO_SCENE_ORDER.length, "no duplicate scene ids");
  assert.equal(new Set(VIDEO_SCENE_LIST.map((v) => v.file)).size, VIDEO_SCENE_LIST.length, "no clip used twice");
  for (const v of VIDEO_SCENE_LIST) {
    assert.match(v.id, /^v-[a-z-]+$/);
    assert.ok(!isNightScene(v.id) && !(v.id in NIGHT_SCENES), "video ids never clash with photo scenes");
    assert.ok(isNightScene(v.still), `${v.id} has a still photograph to show while loading or if the clip cannot play`);
    assert.match(v.file, /^\d{4}\/\d{2}\/\d{2}\/\d+(-\d+)?$/, v.id);
    assert.match(videoFile(v, "large"), /^https:\/\/cdn\.pixabay\.com\/video\/\d{4}\/\d{2}\/\d{2}\/[\d-]+_large\.mp4$/);
    assert.match(v.page, /^https:\/\/pixabay\.com\/videos\/[a-z0-9-]+-\d+\/$/);
    assert.ok(v.file.includes(v.page.match(/-(\d+)\/$/)![1]), `${v.id}: the clip file and its credit page are the same clip`);
    assert.ok(v.name && v.blurb);
  }
  assert.ok(isVideoScene("v-aurora-green") && !isVideoScene("milkyway") && !isVideoScene("constructor") && !isVideoScene("live"));
  assert.ok(VIDEO_SCENES["v-aurora-green"]);
});

test("4K video goes to big screens on Ultra; phones and Battery saver get 1080p", () => {
  const v = VIDEO_SCENES["v-aurora-green"];
  const tv = videoSources(v, { viewW: 2560, viewH: 1440, dpr: 1, quality: "cinematic" });
  assert.ok(tv[0].endsWith("_large.mp4") && tv[1].endsWith("_medium.mp4"), "4K first, 1080p as the backup");
  const laptop = videoSources(v, { viewW: 1440, viewH: 900, dpr: 2, quality: "cinematic" });
  assert.ok(laptop[0].endsWith("_large.mp4"));
  const phone = videoSources(v, { viewW: 390, viewH: 844, dpr: 3, quality: "cinematic" });
  assert.ok(phone[0].endsWith("_medium.mp4"), "a phone does not pull a 4K file");
  assert.ok(videoSources(v, { viewW: 2560, viewH: 1440, dpr: 1, quality: "balanced" })[0].endsWith("_medium.mp4"));
  assert.ok(videoSources(v, { viewW: 2560, viewH: 1440, dpr: 1, quality: "cinematic", saveData: true })[0].endsWith("_medium.mp4"), "Data Saver is respected");
});

test("the picker, layer and sleep wiring for video", () => {
  assert.match(app, /label: "Live video", ids: VIDEO_SCENE_ORDER/);
  assert.match(app, /video=\{pickedVideo && nightId === pickedVideo\.still/);
  assert.match(app, /Video: \{pickedVideo\.name\} on/);
  assert.match(photo, /VideoLayer/);
  assert.match(photo, /autoPlay muted loop playsInline/);
  assert.match(photo, /visibilitychange/, "video pauses when the screen is hidden");
  assert.match(photo, /setIndex\(\(i\) => i \+ 1\)/, "a failed file falls back to the next, then to the photo");
  assert.match(photo, /const clip = video && motion && !calm/, "no video with Gentle motion off or reduced motion");
  assert.match(css, /\.ambient-night-video\.ambient-video-on \{ opacity: 1; \}/);
});
