// Pod+ in the car: what the phone hands CarPlay, how the car's resume spots come back, the build step
// that puts the car's scene in the iPhone app, and the native files it relies on.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyEarshot } from "../shared/earshot";
import { carPlayLibrary, mergeCarSpots, type CarSpot } from "../podscroll/carplay";

const spot = (t: number, at: number, extra: Partial<CarSpot> = {}): CarSpot => ({ t, secs: 3600, title: "Ep", show: "Show", showId: "1", art: "", at, ...extra });

test("the car gets the library: follows, saved, liked, Pod Modes with episodes, newest spots", () => {
  const es = emptyEarshot();
  es.genres = ["news", "comedy"];
  es.follows = [{ id: "10", name: "The Daily", author: "NYT", art: "a.jpg", genre: "news", at: "" }];
  es.saved = [{ id: "100", showId: "10", title: "Later ep", show: "The Daily", art: "", secs: 1200, at: "", audio: "https://x/a.mp3" }];
  es.modes = es.modes.map((m, i) => (i === 0 ? { ...m, episodes: [{ id: "200", showId: "10", title: "Mode ep", show: "S", art: "", secs: 60, at: "" }] } : m));
  const spots: Record<string, CarSpot> = { a: spot(100, 5), b: spot(0, 9), c: spot(50, 7) };
  const lib = carPlayLibrary(es, { api: "https://arisereader.onrender.com", device: "dev1234567890abcd", session: "", spots, now: 42 });
  assert.equal(lib.device, "dev1234567890abcd");
  assert.equal(lib.follows[0].name, "The Daily");
  assert.equal(lib.later[0].audio, "https://x/a.mp3");
  assert.equal(lib.modes.length, 1, "only Pod Modes with episodes go to the car");
  assert.deepEqual(Object.keys(lib.spots), ["c", "a"], "newest first, finished ones left out");
  assert.equal(lib.skipIntro, true);
  assert.equal(lib.at, 42);
});

test("spots from the car: the newer one wins, a finished one clears the phone's", () => {
  const mine = { a: spot(100, 10), b: spot(300, 10), c: spot(50, 30) };
  const car = { a: spot(400, 20, { c: 1 }), b: spot(0, 20), c: spot(10, 5), d: spot(70, 25) };
  const { spots, changed } = mergeCarSpots(mine, car);
  assert.equal(changed, true);
  assert.equal(spots.a.t, 400); assert.equal(spots.a.c, 1, "a spot in the ad-free copy keeps saying so");
  assert.equal(spots.b, undefined, "finished in the car");
  assert.equal(spots.c.t, 50, "the phone's newer spot stays");
  assert.equal(spots.d.t, 70);
  assert.equal(mergeCarSpots(mine, {}).changed, false);
});

test("the build step adds the car's scene to the iPhone app, once", () => {
  const dir = mkdtempSync(join(tmpdir(), "carplay-"));
  const plist = join(dir, "Info.plist");
  writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>UIMainStoryboardFile</key><string>Main</string></dict></plist>`);
  writeFileSync(join(dir, "AppDelegate.swift"), "import UIKit\nimport Capacitor\n\n@UIApplicationMain\nclass AppDelegate: UIResponder, UIApplicationDelegate {\n    var window: UIWindow?\n    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {\n        return true\n    }\n}\n");
  execFileSync("python3", [".github/scripts/adopt_uiscene.py", plist]);
  const ent = join(dir, "App.entitlements");
  execFileSync("python3", ["podscroll/ios-app/configure-carplay.py", plist, "--entitlements", ent]);
  execFileSync("python3", ["podscroll/ios-app/configure-carplay.py", plist]);
  const info = readFileSync(plist, "utf8");
  assert.match(info, /CPTemplateApplicationSceneSessionRoleApplication/);
  assert.match(info, /PodCarPlaySceneDelegate/);
  const delegate = readFileSync(join(dir, "AppDelegate.swift"), "utf8");
  assert.equal(delegate.split("NSClassFromString(\"PodCarPlaySceneDelegate\")").length - 1, 1, "added once, before the phone's window");
  assert.ok(delegate.indexOf("CPTemplateApplicationSceneSessionRoleApplication") < delegate.indexOf("Default Configuration"));
  assert.match(readFileSync(ent, "utf8"), /com\.apple\.developer\.carplay-audio/);
});

test("the native side: the scene's class name, the plugin, and the app depends on it", () => {
  const src = (f: string) => readFileSync(join("native/arise-carplay/ios/Sources/AriseCarPlayPlugin", f), "utf8");
  assert.match(src("PodCarPlayScene.swift"), /@objc\(PodCarPlaySceneDelegate\)/);
  assert.match(src("AriseCarPlayPlugin.swift"), /jsName = "AriseCarPlay"/);
  for (const m of ["setLibrary", "takeSpots", "stop", "status"]) assert.match(src("AriseCarPlayPlugin.swift"), new RegExp(`name: "${m}"`));
  // Ad-free like the phone: the clean copy first, then a copy through the server with its ads.
  assert.match(src("PodCore.swift"), /\/api\/podscroll\/clean\//);
  assert.match(src("PodCore.swift"), /\/api\/podscroll\/play\/\\\(sid\)\/ads/);
  const pkg = JSON.parse(readFileSync("podscroll/ios-app/package.json", "utf8"));
  assert.equal(pkg.dependencies["arise-carplay"], "file:../../native/arise-carplay");
  assert.ok(existsSync("native/arise-carplay/Package.swift"));
});
