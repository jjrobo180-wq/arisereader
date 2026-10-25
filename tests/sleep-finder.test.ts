// LifeHub's Sleep Finder: the picks it recommends from someone's answers, the links it builds, the
// playlists it keeps (and how saved data is cleaned), reading the AI's ideas, and how it's wired in.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ADD_ON_SECTIONS, FAMILY_SECTIONS, cleanFamily, emptyFamily, isCurrentFamily, isOn } from "../shared/familyHub";
import { PLUGINS, lifeInstalled, setLifePlugin } from "../shared/pluginStore";
import {
  CATALOG, KINDS, cleanSleepFinder, cleanUrl, defaultPrefs, emptySleepFinder, itemLink, picksFromAi, recommend, scorePick,
  searchCatalog, searchLink, tonightsMix, toItem, playlistText, cleanAskRequest, type SleepPrefs,
} from "../shared/sleepFinder";

const prefs = (p: Partial<SleepPrefs>): SleepPrefs => ({ ...defaultPrefs(), ...p });

test("the catalog is well-formed", () => {
  assert.equal(new Set(CATALOG.map((p) => p.id)).size, CATALOG.length, "ids are unique");
  for (const p of CATALOG) {
    assert.ok(KINDS.includes(p.kind), p.id);
    assert.ok(p.title && p.query && p.about && p.on.length, p.id);
    assert.ok(!/https?:/i.test(p.query), `${p.id} searches, never links`);
    assert.ok(p.query.length <= 140 && p.mins > 0, p.id);
  }
  for (const k of KINDS) assert.ok(CATALOG.some((p) => p.kind === k), `something for ${k}`);
});

test("recommendations follow the answers", () => {
  const rain = recommend(prefs({ kinds: ["rain"], voice: "none" }));
  assert.equal(rain[0].kind, "rain");
  assert.ok(rain.every((p) => p.voice === "none"), "no voices means no voices");
  assert.ok(rain.filter((p) => p.kind === "rain").length <= 3, "no more than three of one kind up top");

  const history = recommend(prefs({ kinds: ["podcast"], topics: ["history"], voice: "talk" }));
  assert.ok(history.slice(0, 3).some((p) => p.topics?.includes("history")), "interests count");

  const baby = recommend(prefs({ who: "baby", kinds: ["lullaby"] }));
  assert.ok(baby.length > 0);
  assert.ok(baby.every((p) => (p.who ?? ["me"]).includes("baby")), "babies only get baby picks");

  const kid = recommend(prefs({ who: "kid", kinds: ["story", "asmr"] }));
  assert.ok(kid.every((p) => p.kind !== "asmr"), "no ASMR for kids");
  assert.ok(kid.every((p) => p.voice === "none" || (p.who ?? []).includes("kid")), "talking picks for kids are made for kids");

  const noFaith = recommend(prefs({ kinds: ["piano"] }), [], [], 30);
  assert.ok(noFaith.slice(0, 8).every((p) => p.kind !== "faith"), "faith picks only when asked for");
  assert.ok(recommend(prefs({ kinds: ["faith"] }))[0].kind === "faith");
});

test("liking lifts a pick, hiding removes it", () => {
  const p = prefs({ kinds: ["music"] });
  const target = CATALOG.find((c) => c.id === "gibi")!;
  assert.ok(scorePick(target, p, ["gibi"]) > scorePick(target, p));
  assert.equal(scorePick(target, p, [], ["gibi"]), -1);
  assert.ok(!recommend(p, [], ["weightless"]).some((c) => c.id === "weightless"));
});

test("searching the picks by words", () => {
  assert.ok(searchCatalog("trains at night", null).some((p) => p.id === "train"));
  assert.ok(searchCatalog("Minecraft", null)[0].id === "minecraft");
  assert.deepEqual(searchCatalog("to the and", null), []);
  assert.ok(!searchCatalog("brown noise", null, ["brown"]).some((p) => p.id === "brown"));
});

test("tonight's mix winds down, drifts off and plays all night", () => {
  const mix = tonightsMix(prefs({ kinds: ["story", "piano", "rain"], voice: "talk", topics: ["cozy"] }));
  assert.equal(mix.length, 3);
  assert.equal(new Set(mix.map((p) => p.id)).size, 3);
  assert.equal(mix[2].length, "long");
  assert.equal(mix[2].voice, "none");
  const babyMix = tonightsMix(prefs({ who: "baby", kinds: ["lullaby"] }));
  assert.ok(babyMix.every((p) => (p.who ?? ["me"]).includes("baby")));
});

test("links are searches on real services", () => {
  assert.equal(searchLink("youtube", "brown noise 10 hours"), "https://www.youtube.com/results?search_query=brown%20noise%2010%20hours");
  assert.equal(searchLink("youtube", "brown noise", true), "https://www.youtube.com/results?search_query=brown%20noise%20black%20screen");
  assert.equal(searchLink("spotify", "Max Richter Sleep"), "https://open.spotify.com/search/Max%20Richter%20Sleep");
  assert.equal(searchLink("apple", "Enya"), "https://music.apple.com/us/search?term=Enya");
  assert.equal(searchLink("podcasts", "Snoozecast"), "https://podcasts.apple.com/us/search?term=Snoozecast");
  const weightless = CATALOG.find((p) => p.id === "weightless")!;
  assert.ok(itemLink(weightless, prefs({ place: "spotify" })).startsWith("https://open.spotify.com/"));
  assert.ok(itemLink(toItem(weightless, "i1"), prefs({ place: "apple" })).startsWith("https://music.apple.com/"));
  assert.equal(itemLink({ ...toItem(weightless, "i2"), url: "https://youtu.be/abc" }, null), "https://youtu.be/abc", "their own link wins");
  assert.equal(cleanUrl("javascript:alert(1)"), "");
  assert.equal(cleanUrl("https://a.test/x y"), "");
  assert.equal(cleanUrl(" https://open.spotify.com/playlist/1 "), "https://open.spotify.com/playlist/1");
  const text = playlistText({ id: "p", name: "Rain", emoji: "🌧️", createdAt: "", items: [toItem(weightless, "i3")] }, null);
  assert.ok(text.startsWith("🌧️ Rain\n1. Weightless (Marconi Union)"));
});

test("saved Sleep Finder data is cleaned and kept", () => {
  const c = cleanSleepFinder({
    prefs: { kinds: ["rain", "rain", "bogus"], topics: ["space"], voice: "loud", place: "spotify", length: "long", who: "kid", dark: false },
    playlists: [
      { id: "p1", name: "  Rainy  ", emoji: "", items: [
        { id: "a", ref: "rain-tent", title: "Rain", kind: "rain", query: "rain on tent", mins: 600 },
        { id: "b", title: "Mine", url: "javascript:alert(1)" },
        { id: "c", title: "My link", url: "https://youtu.be/x", mins: 99999 },
        { id: "a", title: "dupe", query: "x" },
      ] },
      { id: "p1", name: "dupe" }, { id: "p2", name: "" }, "junk",
    ],
    liked: ["rain-tent", "rain-tent", "<x>"], hidden: [5, "brown"], searches: ["rain", "rain", "", "piano"],
  });
  assert.deepEqual(c.prefs, { kinds: ["rain"], topics: ["space"], voice: "soft", place: "spotify", length: "long", who: "kid", dark: false });
  assert.equal(c.playlists.length, 1);
  assert.equal(c.playlists[0].name, "Rainy");
  assert.equal(c.playlists[0].emoji, "🌙");
  assert.deepEqual(c.playlists[0].items.map((i) => i.id), ["a", "c"]);
  assert.equal(c.playlists[0].items[1].mins, 1440);
  assert.deepEqual(c.liked, ["rain-tent", "x"]);
  assert.deepEqual(c.hidden, ["brown"]);
  assert.deepEqual(c.searches, ["rain", "piano"]);
  assert.deepEqual(cleanSleepFinder(null), emptySleepFinder());

  const f = cleanFamily({ ...emptyFamily(), sleepFinder: { playlists: [{ id: "x", name: "Night", items: [] }] } });
  assert.equal(f.sleepFinder.playlists[0].name, "Night");
  assert.equal(f.sleepFinder.prefs, null);
  assert.ok(isCurrentFamily(f));
  const old: any = { ...emptyFamily() };
  delete old.sleepFinder;
  assert.equal(isCurrentFamily(old), false, "older saved data is cleaned first");
  assert.deepEqual(cleanFamily(old).sleepFinder, emptySleepFinder());
});

test("the AI's ideas are read safely", () => {
  const picks = picksFromAi('```json\n{"picks":[{"title":"Weightless","by":"Marconi Union","kind":"music","query":"Marconi Union Weightless","why":"Slow."},{"title":"Bad","kind":"noise","query":"https://evil.test"},{"title":"","query":"x"},{"title":"Odd kind","kind":"weird","query":"rain"}]}\n```');
  assert.deepEqual(picks.map((p) => p.title), ["Weightless", "Odd kind"]);
  assert.equal(picks[1].kind, "music");
  assert.deepEqual(picksFromAi("not json"), []);
  assert.deepEqual(picksFromAi('{"picks":"nope"}'), []);
  assert.deepEqual(cleanAskRequest({ text: "  rain  ", prefs: { voice: "none" } }).text, "rain");
  assert.equal(cleanAskRequest({ text: "x" }).prefs, null);
});

test("Sleep Finder is in the App Store and wired into LifeHub", () => {
  assert.ok(FAMILY_SECTIONS.includes("sleepfinder"));
  assert.ok(ADD_ON_SECTIONS.includes("sleepfinder"));
  const p = PLUGINS.find((q) => q.id === "life-sleepfinder")!;
  assert.ok(p && p.target.kind === "section" && p.target.section === "sleepfinder");
  const f = emptyFamily();
  assert.equal(isOn("sleepfinder", f), false, "off until added");
  assert.equal(lifeInstalled(p, setLifePlugin(f, p, true)), true);
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(read("client/src/components/family-hub/lifeApps.tsx"), /sleepfinder: \(p\) => <SleepFinder/);
  assert.match(read("client/src/components/family-hub/Members.tsx"), /sleepfinder: \{ label: "Sleep Finder"/);
  assert.match(read("server/routes.ts"), /"\/api\/sleep-finder\/ask"\], authMiddleware, plans\.aiMeter/);
  assert.match(read("server/routes.ts"), /registerSleepFinderRoutes\(app, authMiddleware\)/);
});
