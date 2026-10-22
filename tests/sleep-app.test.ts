// LifeHub's Sleep app: the saved data and its cleaning, how nights are named, the morning
// check-in and "what works for you", the bedtime plan, the catalog of tools and scenarios, the
// scripts and Scripture it reads aloud, and how it's wired into LifeHub.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { cleanFamily, emptyFamily, isCurrentFamily } from "../shared/familyHub";
import { PLUGINS } from "../shared/pluginStore";
import {
  SLEEP_LIMITS, SOUND_IDS, TIMER_CHOICES, cleanSleepApp, emptySleepApp, hoursBetween, nightOf, partOfNight, pendingReview,
  planTimeline, recordUse, reviewNight, saveReview, toolsTried, whatWorks, type SleepApp,
} from "../shared/sleepApp";
import {
  ALPHABET, ALPHABET_CATEGORIES, BREATHS, DEFAULT_CHECKLIST, JOURNALS, JOURNAL_KINDS, LEARN_TOPICS, NAMES_OF_GOD, QUICK_START,
  SCENARIOS, SHUFFLE_WORDS, SLEEP_TABS, SOUNDS, SOUND_PRESETS, TIMER_CHOICES_LABELS, TOOLS, VERSES, WATCH_GROUPS,
  alphabetScript, blessingsScript, breathCycleSecs, caresScript, countdownScript, namesScript, scenarioSteps, shuffleRound,
  shuffleScript, toolById, youtubeUrl,
} from "../shared/sleepContent";
import { PASSAGES, SCRIPTS, displayRef, passageScript, scriptMinutes, speakableVerse, spokenCaps, type ScriptLine } from "../shared/sleepScripts";
import { MAX_CHARS, splitSentences, toSegments } from "../shared/sleepSpeech";

const counter = () => { let n = 0; return () => `id${++n}`; };
/** A moment in local time, so night naming doesn't depend on the machine's time zone. */
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
/** A repeatable stand-in for Math.random. */
const seeded = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const spoken = (lines: readonly ScriptLine[]) => lines.filter((l): l is string => typeof l === "string");
const TOOL_ID = /^[a-z]+:[a-z0-9-]{1,60}$/;

// ── Saved data ───────────────────────────────────────────────────────────────

test("the Sleep app's data is part of the family, and survives a save", () => {
  const f = emptyFamily();
  assert.deepEqual(f.sleepApp, emptySleepApp());
  assert.ok(isCurrentFamily(f));

  // A family saved before the Sleep app existed is cleaned, and gets the defaults.
  const old: Record<string, unknown> = { ...f };
  delete old.sleepApp;
  assert.equal(isCurrentFamily(old), false);
  assert.deepEqual(cleanFamily(old).sleepApp, emptySleepApp());

  const app: SleepApp = {
    ...emptySleepApp(),
    settings: { ...emptySleepApp().settings, faith: false, voice: "device", aiVoice: "deep", pace: "slowest", timer: 0, mix: { brown: 0.6, rain: 0.3 }, volume: 0.5 },
    plan: { bed: "23:00", wake: "07:00", checklist: [{ id: "a", text: "Phone across the room" }], checked: ["a"], checkedNight: "2026-10-19" },
    uses: [{ id: "u1", night: "2026-10-19", tool: "sound:brown", at: "22:40" }],
    reviews: [{ id: "r1", night: "2026-10-19", fell: "fast", helped: ["sound:brown"] }],
    journal: [{ id: "j1", night: "2026-10-19", kind: "dump", text: "Email Coach Davis", at: "2026-10-19T04:40:00.000Z" }],
    parked: [{ id: "p1", night: "2026-10-19", text: "Renew car registration", prayed: true, done: false }],
    favorites: ["script:night-train", "breathe:sigh"],
  };
  const saved = cleanFamily(JSON.parse(JSON.stringify({ ...f, sleepApp: app })));
  assert.deepEqual(saved.sleepApp, app);
  // The sleep log itself is unchanged and still lives in family.sleep.
  assert.deepEqual(cleanFamily({ ...f, sleep: [{ id: "s", date: "2026-10-19", bed: "23:00", wake: "07:00", quality: 4 }] }).sleep.length, 1);
});

test("cleaning keeps what's good and drops the rest", () => {
  assert.deepEqual(cleanSleepApp(null), emptySleepApp());
  assert.deepEqual(cleanSleepApp("nope"), emptySleepApp());
  assert.deepEqual(cleanSleepApp([]), emptySleepApp());

  const c = cleanSleepApp({
    settings: { faith: "yes", voice: "robot", aiVoice: "deep", deviceVoice: "x".repeat(500), pace: "fast", showWords: false, timer: 37, breathCue: "voice",
      mix: { brown: 0.456, laser: 1, rain: 0, ocean: "loud", wind: 3, fire: -1 }, volume: 7 },
    plan: { bed: "25:00", wake: "6:30", checklist: [{ id: "a", text: "  Lamp low  " }, { id: "b", text: "   " }, "junk", { text: "No id here" }], checked: ["a", "a", 5], checkedNight: "2026-02-30" },
    uses: [
      { id: "u1", night: "2026-10-19", tool: "sound:brown", at: "22:40" },
      { id: "u1", night: "2026-10-19", tool: "sound:rain", at: "22:41" }, // same id twice
      { id: "u2", night: "2026-10-19", tool: "javascript:alert(1)", at: "22:42" },
      { id: "u3", night: "2026-10-19", tool: "Sound:Brown", at: "22:43" },
      { id: "u4", night: "2026-02-30", tool: "sound:fan", at: "22:44" },
      { id: "u5", night: "2026-10-19", tool: "breathe:sigh", at: "late" },
    ],
    reviews: [{ id: "r1", night: "2026-10-19", fell: "instantly", helped: ["sound:brown", "sound:brown", "<b>", 7] }, { id: "r2", night: "yesterday", fell: "fast", helped: [] }],
    journal: [{ id: "j1", night: "2026-10-19", kind: "diary", text: "Hello", at: "x" }, { id: "j2", night: "2026-10-19", kind: "dump", text: "   ", at: "x" }],
    parked: [{ id: "p1", night: "2026-10-19", text: " Call the dentist ", prayed: "no", done: true }, { id: "p2", night: "2026-10-19", text: "" }],
    favorites: ["script:night-train", "script:night-train", "nope", 3, "passage:ps4"],
  });
  assert.equal(c.settings.faith, true);
  assert.equal(c.settings.voice, "ai");
  assert.equal(c.settings.aiVoice, "deep");
  assert.equal(c.settings.deviceVoice.length, 200);
  assert.equal(c.settings.pace, "slower");
  assert.equal(c.settings.showWords, false);
  assert.equal(c.settings.timer, 45);
  assert.equal(c.settings.breathCue, "voice");
  assert.deepEqual(c.settings.mix, { brown: 0.46, wind: 1 });
  assert.equal(c.settings.volume, 1);
  assert.equal(cleanSleepApp({ settings: { timer: 0, volume: -2 } }).settings.timer, 0, "Off is a real timer choice");
  assert.equal(cleanSleepApp({ settings: { volume: -2 } }).settings.volume, 0);

  assert.equal(c.plan.bed, "22:30");
  assert.equal(c.plan.wake, "06:30");
  assert.deepEqual(c.plan.checklist, [{ id: "a", text: "Lamp low" }, { id: "No id here", text: "No id here" }]);
  assert.deepEqual([c.plan.checked, c.plan.checkedNight], [[], ""], "ticks without a real night are dropped");
  const ticked = cleanSleepApp({ plan: { checklist: null, checked: ["a", "a", "b"], checkedNight: "2026-10-19" } }).plan;
  assert.deepEqual([ticked.checklist, ticked.checked], [null, ["a", "b"]]);

  assert.deepEqual(c.uses.map((u) => [u.id, u.tool, u.at]), [["u1", "sound:brown", "22:40"], ["u5", "breathe:sigh", ""]]);
  assert.deepEqual(c.reviews.map((r) => [r.id, r.fell, r.helped]), [["r1", "ok", ["sound:brown"]]]);
  assert.deepEqual(c.journal.map((j) => [j.id, j.kind]), [["j1", "free"]]);
  assert.deepEqual(c.parked.map((p) => [p.id, p.text, p.prayed, p.done]), [["p1", "Call the dentist", false, true]]);
  assert.deepEqual(c.favorites, ["script:night-train", "passage:ps4"]);
});

test("long histories keep only the newest rows", () => {
  const uses = Array.from({ length: SLEEP_LIMITS.uses + 50 }, (_, i) => ({ id: `u${i}`, night: "2026-10-19", tool: "sound:brown", at: "22:00" }));
  const c = cleanSleepApp({ uses, favorites: TOOLS.map((t) => t.id) });
  assert.equal(c.uses.length, SLEEP_LIMITS.uses);
  assert.equal(c.uses[0].id, "u50");
  assert.equal(c.uses.at(-1)?.id, `u${SLEEP_LIMITS.uses + 49}`);
  assert.equal(c.favorites.length, SLEEP_LIMITS.favorites);
});

// ── Nights ───────────────────────────────────────────────────────────────────

test("a night is named by the morning it ends on, like the sleep log's “woke up on”", () => {
  assert.equal(nightOf(at(2026, 10, 18, 21, 30)), "2026-10-19");
  assert.equal(nightOf(at(2026, 10, 18, 23, 59)), "2026-10-19");
  assert.equal(nightOf(at(2026, 10, 19, 2, 15)), "2026-10-19");
  assert.equal(nightOf(at(2026, 10, 19, 11, 59)), "2026-10-19");
  assert.equal(nightOf(at(2026, 10, 19, 12, 0)), "2026-10-20");
  assert.equal(nightOf(at(2026, 12, 31, 22, 0)), "2027-01-01");
  assert.equal(nightOf(at(2026, 2, 28, 23, 0)), "2026-03-01");

  assert.equal(reviewNight(at(2026, 10, 19, 7, 30)), "2026-10-19");
  assert.equal(reviewNight(at(2026, 10, 19, 17, 59)), "2026-10-19");
  assert.equal(reviewNight(at(2026, 10, 19, 3, 0)), null, "still the middle of the night");
  assert.equal(reviewNight(at(2026, 10, 19, 18, 0)), null, "evening: tonight is next");

  assert.deepEqual([9, 16, 17, 21, 22, 0, 1, 3, 4].map((h) => partOfNight(at(2026, 10, 19, h))),
    ["day", "day", "evening", "evening", "late", "late", "small-hours", "small-hours", "day"]);
});

test("each tool counts once a night, and the morning check-in asks about them", () => {
  const id = counter();
  let app = emptySleepApp();
  app = recordUse(app, "sound:brown", id, at(2026, 10, 18, 22, 30));
  const same = recordUse(app, "sound:brown", id, at(2026, 10, 18, 23, 10));
  assert.equal(same, app, "a second start the same night isn't recorded again");
  app = recordUse(app, "breathe:sigh", id, at(2026, 10, 19, 1, 5));
  app = recordUse(app, "sound:brown", id, at(2026, 10, 19, 22, 0)); // the next night
  assert.equal(recordUse(app, "not a tool", id, at(2026, 10, 19, 22, 0)), app);
  assert.deepEqual(toolsTried(app, "2026-10-19"), ["sound:brown", "breathe:sigh"]);
  assert.deepEqual(toolsTried(app, "2026-10-20"), ["sound:brown"]);
  assert.deepEqual(app.uses.map((u) => u.at), ["22:30", "01:05", "22:00"]);

  assert.equal(pendingReview(app, at(2026, 10, 19, 7, 0)), "2026-10-19");
  assert.equal(pendingReview(app, at(2026, 10, 19, 22, 0)), null, "not asked at night");
  assert.equal(pendingReview(emptySleepApp(), at(2026, 10, 19, 7, 0)), null, "nothing tried, nothing to ask");

  app = saveReview(app, "2026-10-19", "slow", ["breathe:sigh"], id);
  assert.equal(pendingReview(app, at(2026, 10, 19, 7, 0)), null);
  app = saveReview(app, "2026-10-19", "fast", ["sound:brown", "sound:brown", "bad id"], id);
  assert.deepEqual(app.reviews.map((r) => [r.night, r.fell, r.helped]), [["2026-10-19", "fast", ["sound:brown"]]], "a second check-in replaces the first");
});

test("“What works for you” ranks the tools that helped most, from checked-in nights only", () => {
  const id = counter();
  let app = emptySleepApp();
  const night = (d: number, tools: string[]) => { for (const t of tools) app = recordUse(app, t, id, at(2026, 10, d, 22, 30)); };
  night(10, ["sound:brown", "sound:rain", "mind:shuffle"]); // night of the 11th
  night(11, ["sound:brown", "sound:rain"]); //                  12th
  night(12, ["sound:brown"]); //                                13th
  night(13, ["sound:brown", "script:night-train"]); //          14th: never checked in
  app = saveReview(app, "2026-10-11", "fast", ["sound:brown", "mind:shuffle"], id);
  app = saveReview(app, "2026-10-12", "ok", ["sound:brown"], id);
  app = saveReview(app, "2026-10-13", "slow", ["passage:ps4"], id); // added by hand, not recorded
  assert.deepEqual(whatWorks(app), [
    { tool: "sound:brown", helped: 2, tried: 3 },
    { tool: "mind:shuffle", helped: 1, tried: 1 },
    { tool: "passage:ps4", helped: 1, tried: 1 },
  ]);
  assert.deepEqual(whatWorks(emptySleepApp()), []);
});

// ── The bedtime plan ─────────────────────────────────────────────────────────

test("the bedtime plan works backward from bedtime and forward from waking", () => {
  assert.equal(hoursBetween("22:30", "06:30"), 8);
  assert.equal(hoursBetween("23:15", "06:45"), 7.5);
  assert.equal(hoursBetween("01:00", "09:00"), 8);
  const times = (bed: string, wake: string) => Object.fromEntries(planTimeline(bed, wake).map((p) => [p.id, p.at]));
  assert.deepEqual(times("22:30", "06:30"), {
    caffeine: "13:30", dinner: "19:30", shower: "21:00", workout: "21:30", dim: "21:30", "wind-down": "21:45", write: "22:15", bed: "22:30", wake: "06:30", light: "07:00",
  });
  const late = times("00:30", "08:00");
  assert.deepEqual([late.caffeine, late.dinner, late.write, late.bed, late.light], ["15:30", "21:30", "00:15", "00:30", "08:30"]);
  for (const p of planTimeline("22:30", "06:30")) assert.ok(p.title && p.detail, p.id);
});

// ── The catalog ──────────────────────────────────────────────────────────────

test("every tool has a unique, saveable id and says why it works", () => {
  const ids = TOOLS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "tool ids are unique");
  const tabs = new Set(SLEEP_TABS.map((t) => t.id));
  for (const t of TOOLS) {
    assert.match(t.id, TOOL_ID, t.id);
    assert.ok(t.name.trim() && t.blurb.trim() && t.why.trim(), t.id);
    assert.ok(tabs.has(t.tab), `${t.id} opens a real tab`);
  }
  // Favorites and the nightly record keep every one of them.
  assert.deepEqual(cleanSleepApp({ favorites: ids.slice(0, SLEEP_LIMITS.favorites) }).favorites, ids.slice(0, SLEEP_LIMITS.favorites));
  for (const s of SOUND_IDS) assert.ok(toolById(`sound:${s}`), s);
  for (const k of JOURNAL_KINDS) assert.ok(toolById(`journal:${k}`), k);
  for (const s of SCRIPTS) assert.ok(toolById(`script:${s.id}`), s.id);
  for (const p of PASSAGES) assert.ok(toolById(`passage:${p.id}`), p.id);
  for (const b of BREATHS) assert.ok(toolById(`breathe:${b.id}`), b.id);
  for (const q of QUICK_START) assert.ok(toolById(q), q);
  assert.equal(TOOLS.length > 90, true, "a big toolbox");
});

test("“What's keeping you up?” always leads to real tools, with or without Christian content", () => {
  assert.equal(new Set(SCENARIOS.map((s) => s.id)).size, SCENARIOS.length);
  for (const s of SCENARIOS) {
    assert.ok(s.label && s.note, s.id);
    assert.deepEqual(scenarioSteps(s, true), s.steps, `${s.id}: every step is a real tool`);
    const plain = scenarioSteps(s, false);
    assert.ok(plain.length >= 3, `${s.id} still has at least three steps without faith content`);
    assert.ok(plain.every((st) => !toolById(st.tool)?.faith), s.id);
    for (const st of s.steps) assert.ok(st.tip.trim(), `${s.id} ${st.tool}`);
  }
  const ids = SCENARIOS.map((s) => s.id);
  for (const want of ["racing", "picturing", "anxious", "restless", "awake", "woke", "heavy", "drift", "phone"]) assert.ok(ids.includes(want), want);
  // ADHD racing thoughts and a picture-making imagination both start with something to do.
  const racing = SCENARIOS.find((s) => s.id === "racing")!;
  assert.equal(racing.steps[0].tool, "mind:park");
  assert.match(SCENARIOS.find((s) => s.id === "heavy")!.help ?? "", /988/);
});

test("turning Christian content off hides it everywhere, and leaves plenty", () => {
  assert.ok(SLEEP_TABS.find((t) => t.id === "pray")?.faith);
  const plain = TOOLS.filter((t) => !t.faith);
  assert.ok(plain.length >= 40, `${plain.length} tools without faith content`);
  assert.ok(TOOLS.filter((t) => t.kind === "scripture" || t.kind === "prayer").every((t) => t.faith), "Scripture and prayer tools are all marked");
  assert.ok(JOURNALS.some((j) => j.faith) && JOURNALS.filter((j) => !j.faith).length >= 4);
  assert.ok(ALPHABET_CATEGORIES.some((c) => c.faith) && ALPHABET_CATEGORIES.filter((c) => !c.faith).length >= 8);
  assert.ok(WATCH_GROUPS.some((g) => g.faith || g.items.some((i) => i.faith)));
  assert.ok(LEARN_TOPICS.some((t) => t.faith) && DEFAULT_CHECKLIST.some((c) => c.faith));
});

test("sounds, mixes, breathing and the timer are well formed", () => {
  assert.deepEqual(SOUNDS.map((s) => s.id), [...SOUND_IDS]);
  for (const p of SOUND_PRESETS) {
    const levels = Object.entries(p.mix);
    assert.ok(levels.length > 0, p.id);
    for (const [id, v] of levels) {
      assert.ok((SOUND_IDS as readonly string[]).includes(id), `${p.id}: ${id}`);
      assert.ok(typeof v === "number" && v > 0 && v <= 1, `${p.id}: ${id}`);
    }
    assert.deepEqual(cleanSleepApp({ settings: { mix: p.mix } }).settings.mix, p.mix, "a preset saves as is");
  }
  assert.deepEqual(TIMER_CHOICES_LABELS.map((t) => t.id), [...TIMER_CHOICES]);
  assert.equal(TIMER_CHOICES_LABELS.at(-1)?.label, "Off");

  const perMinute = (id: string) => 60 / breathCycleSecs(BREATHS.find((b) => b.id === id)!);
  assert.equal(perMinute("slow"), 6);
  assert.equal(breathCycleSecs(BREATHS.find((b) => b.id === "478")!), 19);
  for (const b of BREATHS) {
    assert.ok(b.steps.some((s) => s.kind === "out"), b.id);
    const out = b.steps.filter((s) => s.kind === "out").reduce((t, s) => t + s.secs, 0);
    const inn = b.steps.filter((s) => s.kind === "in" || s.kind === "in2").reduce((t, s) => t + s.secs, 0);
    assert.ok(out >= inn, `${b.id}: the breath out is never shorter than the breath in`);
    if (b.faith) assert.ok(b.prayer?.in && b.prayer.out && b.prayer.ref, b.id);
  }
});

test("journals, videos and Learn cite their sources and link safely", () => {
  assert.deepEqual(JOURNALS.map((j) => j.id).sort(), [...JOURNAL_KINDS].sort());
  for (const j of JOURNALS) assert.ok(j.prompt && j.why && j.placeholder !== undefined, j.id);
  assert.equal(youtubeUrl("rain sounds 10 hours & more"), "https://www.youtube.com/results?search_query=rain%20sounds%2010%20hours%20%26%20more");
  for (const g of WATCH_GROUPS) for (const v of g.items) {
    assert.ok(v.title && v.query && v.note, v.id);
    assert.ok(youtubeUrl(v.query).startsWith("https://www.youtube.com/results?search_query="));
  }
  const cards = LEARN_TOPICS.flatMap((t) => t.cards);
  assert.ok(cards.length >= 30, `${cards.length} research cards`);
  assert.ok(cards.filter((c) => c.source).length >= 20, "most cards name a source");
  assert.ok(LEARN_TOPICS.some((t) => t.id === "adhd") && LEARN_TOPICS.some((t) => t.id === "help"));
  assert.match(JSON.stringify(LEARN_TOPICS.find((t) => t.id === "help")), /988/);
  assert.equal(new Set(DEFAULT_CHECKLIST.map((c) => c.id)).size, DEFAULT_CHECKLIST.length);
});

// ── What gets read aloud ─────────────────────────────────────────────────────

test("every script is complete and paced for sleep", () => {
  assert.equal(new Set(SCRIPTS.map((s) => s.id)).size, SCRIPTS.length);
  for (const s of SCRIPTS) {
    assert.ok(s.title && s.blurb, s.id);
    assert.ok(s.lines.length >= 5, `${s.id} has substance`);
    for (const l of s.lines) {
      if (typeof l === "number") assert.ok(Number.isFinite(l) && l > 0 && l <= 120, `${s.id}: pause ${l}`);
      else assert.ok(l.trim() === l && l.length > 0, `${s.id}: "${l}"`);
    }
    assert.ok(scriptMinutes(s) >= 1, s.id);
    if (s.kind === "prayer") assert.ok(s.faith, `${s.id}: prayers are faith content`);
    assert.doesNotMatch(spoken(s.lines).join(" "), /\b(LORD|GOD|JESUS)\b/, `${s.id}: no capitals for the voice to spell out`);
  }
  const kinds = new Set(SCRIPTS.map((s) => s.kind));
  for (const k of ["story", "body", "mind", "prayer", "boring"]) assert.ok(kinds.has(k as never), k);
});

test("Scripture passages are in order, and read the way they should sound", () => {
  assert.equal(new Set(PASSAGES.map((p) => p.id)).size, PASSAGES.length);
  for (const p of PASSAGES) {
    assert.ok(p.title && p.note && p.verses.length > 0, p.id);
    for (let i = 1; i < p.verses.length; i++) assert.ok(p.verses[i][0] > p.verses[i - 1][0], `${p.id}: verses in order`);
    for (const [, text] of p.verses) assert.ok(text.trim().length > 3, p.id);
    const script = passageScript(p.verses);
    assert.doesNotMatch(spoken(script).join(" "), /\b(LORD|GOD|JEHOVAH|Selah)\b/, p.id);
    assert.equal(script.at(-1), 8);
  }
  const ps4 = PASSAGES.find((p) => p.id === "ps4")!;
  assert.match(ps4.verses.at(-1)![1], /I will both lay me down in peace, and sleep/);
  assert.deepEqual(speakableVerse("Hear me, O LORD. Selah. Thou wilt shew me the path."), ["Hear me, O Lord.", 4, "Thou wilt show me the path."]);
  assert.equal(spokenCaps("KING OF KINGS, AND LORD OF LORDS."), "King of kings, and Lord of lords.");
  assert.equal(spokenCaps("And God said unto Moses, I AM THAT I AM."), "And God said unto Moses, I am that I am.");
  assert.equal(spokenCaps("I AM"), "I am");
  assert.equal(displayRef("Psalm 139:1-12,17-18"), "Psalm 139:1–12, 17–18");
  assert.equal(displayRef("Psalm 4"), "Psalm 4");
  assert.equal(toolById("passage:ps94")?.name, "Psalm 94:18–19: In the multitude of my thoughts");
  for (const v of VERSES) assert.ok(v.text && v.ref, v.ref);
});

test("scripts made on the spot: shuffle, counting, alphabet, blessings, names of God, cares", () => {
  const a = shuffleScript(seeded(7)), b = shuffleScript(seeded(7));
  assert.deepEqual(a, b, "the same luck gives the same words");
  assert.ok(a.every((l) => (typeof l === "number" ? l > 0 : l.trim().length > 0)));
  const round = shuffleRound("pillow", 5, seeded(3));
  assert.deepEqual(round.map((r) => r.letter), ["p", "i", "l", "o", "w"], "each letter once");
  for (const r of round) {
    assert.equal(new Set(r.words).size, r.words.length);
    assert.ok(r.words.every((w) => SHUFFLE_WORDS[r.letter].includes(w)));
  }

  const count = spoken(countdownScript());
  assert.equal(count[1], "300.");
  assert.equal(count.filter((l) => /^\d+\.$/.test(l)).length, 100);
  assert.equal(count.at(-2), "3.");

  const animals = spoken(alphabetScript("Animals"));
  assert.match(animals[0], /^Tonight's category: animals\./);
  assert.match(spoken(alphabetScript("People in the Bible"))[0], /people in the Bible/);
  assert.deepEqual(animals.slice(1, -1), ALPHABET.map((l) => `${l.toUpperCase()}.`));
  assert.ok(!animals.includes("Q.") && !animals.includes("X."));
  assert.equal(spoken(blessingsScript()).filter((l) => /^[A-Z]\.$/.test(l)).length, ALPHABET.length);

  const names = spoken(namesScript());
  assert.equal(NAMES_OF_GOD.length, 26);
  assert.deepEqual(NAMES_OF_GOD.map((n) => n.letter).join(""), "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  assert.ok(names.includes("I. I am."), "the divine name is said as words");
  assert.ok(names.includes("King of kings, and Lord of lords."));
  assert.ok(names.includes("Psalm 46, verse 10."));
  assert.doesNotMatch(names.join(" "), /\b[A-Z]{2,}\b/, "no capitals for the voice to spell out");

  const cares = spoken(caresScript(["Dad's health!", "   ", " money this month "]));
  assert.ok(cares.includes("Dad's health.") && cares.includes("money this month."));
  assert.equal(cares.filter((l) => l === "I give this one to you.").length, 2);
  assert.equal(cares.at(-1), "Amen.");
});

test("the narrator reads one sentence at a time, with calm pauses", () => {
  assert.deepEqual(splitSentences("Hello there.  How are you?\nFine!"), ["Hello there.", "How are you?", "Fine!"]);
  assert.deepEqual(splitSentences("He said, “Peace, be still.” And the wind ceased."), ["He said, “Peace, be still.”", "And the wind ceased."]);
  assert.deepEqual(splitSentences("Wait… then go."), ["Wait… then go."]);
  assert.deepEqual(splitSentences("Wait... Then go."), ["Wait...", "Then go."]);
  assert.deepEqual(splitSentences("   "), []);
  const long = Array.from({ length: 60 }, (_, i) => `the soft wind number ${i}`).join(", ") + ".";
  const parts = splitSentences(long);
  assert.ok(parts.length > 1 && parts.every((p) => p.length <= MAX_CHARS), "long sentences are broken up for the voice");
  assert.equal(parts.join(" "), long);

  assert.deepEqual(toSegments(["One. Two.", 3, "Three."], "slower"), [
    { text: "One.", pauseMs: 1300 }, { text: "Two.", pauseMs: 4300 }, { text: "Three.", pauseMs: 1300 },
  ]);
  assert.deepEqual(toSegments([5, "Hi."], "slow"), [{ text: "", pauseMs: 3750 }, { text: "Hi.", pauseMs: 700 }]);
  assert.equal(toSegments(["A.", 2], "slowest")[0].pauseMs, 2000 + 2700);
  // Every bundled script turns into segments with text and sane pauses.
  for (const s of SCRIPTS) for (const seg of toSegments(s.lines, "slower")) assert.ok(seg.pauseMs >= 0 && seg.text.length <= MAX_CHARS, s.id);
});

// ── Wiring ───────────────────────────────────────────────────────────────────

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const SLEEP_DIR = "client/src/components/family-hub/sleep";

test("LifeHub's Sleep section opens the Sleep app, and the store lists it", () => {
  const page = read("client/src/pages/AriseTodo.tsx");
  assert.match(page, /import SleepApp from "@\/components\/family-hub\/sleep\/SleepApp";/);
  assert.match(page, /shown === "sleep" \? <SleepApp \{\.\.\.common\} \/>/);
  assert.doesNotMatch(page, /SleepLog/);
  assert.equal(existsSync(new URL("../client/src/components/family-hub/SleepLog.tsx", import.meta.url)), false);
  assert.match(read("client/src/components/family-hub/Members.tsx"), /sleep: \{ label: "Sleep", detail: "Fall asleep tonight, plus a sleep log"/);

  const plugin = PLUGINS.find((p) => p.id === "life-sleep")!;
  assert.equal(plugin.name, "Sleep");
  assert.deepEqual(plugin.target, { kind: "section", section: "sleep" });
  assert.match(plugin.tagline, /Fall asleep tonight/);
});

test("the calm reading voice comes from the existing voice service", () => {
  const routes = read("server/routes.ts");
  assert.match(routes, /style: "buddy" \| "announcer" \| "sleep" = "buddy"/);
  assert.match(routes, /style === "sleep" && sleepVoice === "deep" \? "cedar" : "marin"/);
  assert.match(routes, /calm bedtime narrator/);
  const narrator = read(`${SLEEP_DIR}/narrator.ts`);
  assert.match(narrator, /\/api\/eye-gaze\/tts/);
  assert.match(narrator, /style: "sleep"/);
});

test("the Sleep app's code parses on older iPhones (no regular-expression lookbehind)", () => {
  const files = [
    ...readdirSync(new URL(`../${SLEEP_DIR}`, import.meta.url)).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => `${SLEEP_DIR}/${f}`),
    "shared/sleepApp.ts", "shared/sleepContent.ts", "shared/sleepScripts.ts", "shared/sleepSpeech.ts",
  ];
  assert.ok(files.length >= 15, `${files.length} files`);
  for (const f of files) assert.doesNotMatch(read(f), /\(\?<[=!]/, f);
});
