// Arise Kids: the Arise AAC app's Home, Apps and Stickers (the prototype the owner chose, Nov 18, 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ANIMAL_SOUNDS, BREATHS, BREATH_MS, COLORS, DECKS, FIRSTS, HUNT_GOAL, PLAY_GAMES, QUESTIONS, SHELVES, STICKERS, THENS, breathAt, cardStep, clock, firstThenSentence, huntRound, huntStep, nextSticker, pickStep, streak, streakMarks, timerLeft, visibleShelves, winSticker, wordOfDay } from "../shared/ariseKids";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("stickers are won in order, once each, and the album fills up", () => {
  assert.equal(STICKERS.length, 12);
  assert.deepEqual(winSticker([]), { won: [0], sticker: 0 });
  assert.deepEqual(winSticker([0, 2]), { won: [0, 2, 1], sticker: 1 });
  const all = STICKERS.map((_, i) => i);
  assert.deepEqual(winSticker(all), { won: all, sticker: 11 }, "all won: no duplicates");
  assert.equal(nextSticker([0, 1, 2]), 3);
});

test("days in a row count back from today (or yesterday), and the marks start again every four days", () => {
  assert.equal(streak([], "2026-11-18"), 0);
  assert.equal(streak(["2026-11-16", "2026-11-17", "2026-11-18"], "2026-11-18"), 3);
  assert.equal(streak(["2026-11-16", "2026-11-17"], "2026-11-18"), 2, "the morning before playing still shows yesterday's run");
  assert.equal(streak(["2026-11-14", "2026-11-17", "2026-11-18"], "2026-11-18"), 2, "a missed day starts again");
  assert.equal(streak(["2026-10-31", "2026-11-01"], "2026-11-01"), 2, "across a month");
  assert.deepEqual([0, 1, 3, 4, 5, 6, 8].map(streakMarks), [0, 1, 3, 4, 1, 2, 4]);
});

test("Card Quest: I did it goes through the deck and the last card wins a sticker; Later never wins", () => {
  for (const id of Object.keys(DECKS) as (keyof typeof DECKS)[]) assert.equal(DECKS[id].cards.length, 3);
  assert.deepEqual(cardStep("letters", 0, true), { index: 1, win: false });
  assert.deepEqual(cardStep("letters", 2, true), { index: 0, win: true });
  assert.deepEqual(cardStep("letters", 2, false), { index: 0, win: false });
});

test("Pick It!: a tap picks the lit box, a right answer goes on, the third right answer wins, a wrong one tries again", () => {
  let s = { q: 0, on: 0, picked: null as number | null };
  let r = pickStep(s);
  assert.equal(r.picked, 0, "picks the lit box");
  r = pickStep({ q: 0, on: 0, picked: 0 });
  assert.deepEqual(r, { q: 1, on: 0, picked: null, win: false });
  r = pickStep({ q: 1, on: 0, picked: 0 });
  assert.deepEqual(r, { q: 1, on: 0, picked: null, win: false }, "wrong: same question again");
  r = pickStep({ q: 2, on: 0, picked: QUESTIONS[2].right });
  assert.deepEqual(r, { q: 0, on: 0, picked: null, win: true });
  s = { q: 0, on: 1, picked: null };
  assert.equal(pickStep(s).picked, 1);
});

test("everything Arise AAC had is on the Apps shelves, and a grown-up's choices still hide what's not allowed", () => {
  const paths = SHELVES.flatMap((s) => s.tiles).map((t) => t.path).filter(Boolean);
  for (const p of ["/eye-gaze-talker", "/eye-gaze-lessons", "/eye-gaze-life-skills", "/my-world", "/eye-gaze-wren", "/eye-gaze-tv", "/eye-gaze-flashcards", "/eye-gaze-buddy", "/leaderboard", "/eye-gaze-fidgets", "/eye-gaze-farm", "/eye-gaze-potty", "/reading-level-up", "/profile"])
    assert.ok(paths.includes(p), p);
  // Every page the old home linked to is still reachable.
  const oldHome = read("client/src/pages/EyeGazeHome.tsx");
  // (The old Games page's games each have their own tile now, so it has none of its own.)
  for (const m of oldHome.matchAll(/path: "([^"]+)"/g)) if (m[1] !== "/eye-gaze-games") assert.ok(paths.includes(m[1]), `old home link ${m[1]}`);
  for (const id of ["animal-splash", "word-pop", "match-pairs", "sentence-train", "reading-runner", "reading-ninja"]) assert.ok(paths.includes(`/eye-gaze-play/${id}`), `every game from the old Games page: ${id}`);
  const noTalk = visibleShelves((p) => p !== "/eye-gaze-talker");
  const names = noTalk.flatMap((s) => s.tiles).map((t) => t.name);
  assert.ok(!names.includes("My Talker") && !names.includes("Wren"), "Wren follows My Talker's permission");
  assert.ok(names.includes("Card Quest") && names.includes("Pick It!"), "the built-in games always show");
  const none = visibleShelves(() => false);
  assert.deepEqual(none.map((s) => s.name), ["Games", "Calm & my day", "Card decks", "Me"]);
});

test("the word of the day changes each day", () => {
  assert.notEqual(wordOfDay("2026-11-18"), wordOfDay("2026-11-19"));
  assert.equal(wordOfDay("2026-11-18"), wordOfDay("2026-11-18"));
});

test("Arise AAC opens on Arise Kids: Home, Apps and Stickers, edge to edge, with the same tab bar on every page", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /<Route path="\/eye-gaze-home">\s*<ProtectedRoute><KidsApp tab="home" \/>/);
  assert.match(app, /<Route path="\/eye-gaze-apps">\s*<ProtectedRoute><KidsApp tab="apps" \/>/);
  assert.match(app, /<Route path="\/eye-gaze-stickers">\s*<ProtectedRoute><KidsApp tab="stickers" \/>/);
  const shell = read("client/src/components/EyeGazeSiteShell.tsx");
  assert.match(shell, /const kidsScreen = location === "\/eye-gaze-home" \|\| location === "\/eye-gaze-apps" \|\| location === "\/eye-gaze-stickers"/);
  assert.match(shell, /<KidsTabBar tab=\{null\} \/>/);
  assert.match(read("client/index.html"), /family=Lexend:wght@400;600;800/);
  // Pixel for pixel: the prototype's style text, as written.
  const kids = read("client/src/pages/arise-kids/KidsApp.tsx");
  for (const s of [
    "grid-column: span 4; grid-row: span 2; border: 0; border-radius: 26px; background: #1f2bd6",
    "flex-shrink: 0; width: 132px; height: 116px; border: 0; border-radius: 18px",
    "min-height: 62px; border: 0; border-radius: 22px; background: #ffc531; box-shadow: 0 6px 0 #c99200",
    "flex-grow: 2; min-height: 70px; border-radius: 35px; border: 0; background: #ffd34d",
  ]) assert.ok(kids.includes(s), s);
});

test("tracing the A: the whole letter counts, part of it or a scribble doesn't", async () => {
  const { traceScore } = await import("../shared/ariseKids");
  const line = (x1: number, y1: number, x2: number, y2: number, n = 12) => Array.from({ length: n + 1 }, (_, i) => ({ x: x1 + (x2 - x1) * i / n, y: y1 + (y2 - y1) * i / n }));
  const left = line(5, 21, 12, 3), right = line(12, 3, 19, 21), bar = line(8, 14, 16, 14, 6);
  assert.equal(traceScore([], "A").done, false);
  assert.equal(traceScore([...left, ...right], "A").done, false, "both sides but not the bar");
  assert.equal(traceScore([...left, ...right, ...bar], "A").done, true);
  // A wobbly hand (up to 1.5 squares off) still counts.
  const wobble = [...left, ...right, ...bar].map((p, i) => ({ x: p.x + (i % 2 ? 1.5 : -1.5), y: p.y }));
  assert.equal(traceScore(wobble, "A").done, true, "wobbly but on the letter");
  const scribble = Array.from({ length: 200 }, (_, i) => ({ x: (i * 7) % 24, y: (i * 11) % 24 }));
  assert.equal(traceScore(scribble, "A").done, false, "scribbling all over the pad doesn't count");
});

test("Card Quest's tracing card waits for the tracing, and every card can be heard; Pick It! takes a tap anywhere or a switch", () => {
  const kids = read("client/src/pages/arise-kids/KidsApp.tsx");
  assert.match(kids, /const needsTrace = !!card\.trace && !traced/);
  assert.match(kids, /if \(needsTrace\) \{ showToast\("Trace the letter first, or tap Later\."\); return; \}/);
  assert.match(kids, /aria-label="Hear it"/);
  assert.match(kids, /e\.key === " " && e\.key !== "Enter"|e\.key !== " " && e\.key !== "Enter"/);
  assert.match(kids, /closest\("\[data-close\]"\)\) pick\(\)/);
  assert.match(read("client/src/pages/arise-kids/TracePad.tsx"), /touchAction: "none"/);
});

test("Shorts open for anyone signed in, and the site owner can use every Arise AAC page", () => {
  const routes = read("server/routes.ts");
  assert.match(routes, /if \(choice\.kind === 'self'\) return \{ id: req\.user\.id/);
  const shorts = routes.slice(routes.indexOf("app.get('/api/eye-gaze/youtube-shorts'"), routes.indexOf("app.get('/api/eye-gaze/youtube-shorts'") + 900);
  assert.ok(!shorts.includes("A linked Arise AAC account is required"), "Shorts no longer refuse a grown-up");
  assert.match(shorts, /const raw = child \? await storage\.getSetting/);
});

test("no dead ends: every page in the Arise AAC app has the tab bar back to Home/Apps, for any account", () => {
  const shell = read("client/src/components/EyeGazeSiteShell.tsx");
  assert.match(shell, /const inAacApp = isEyeGazerApp\(\);/);
  assert.match(shell, /if \(\(!isEyeGazer && !inAacApp\) \|\| !user/);
  assert.match(read("client/src/pages/ReadingLevelUp.tsx"), /navigate\(isEyeGazerApp\(\) \? "\/eye-gaze-apps" : "\/library"\)/);
  // Each game inside Eye-gaze games has its own way back.
  for (const f of ["client/src/pages/AnimalSplashGame.tsx", "client/src/pages/ReadingRunnerPro.tsx", "client/src/pages/ReadingNinja.tsx", "client/src/pages/eye-gaze/MatchPairsGame.tsx", "client/src/pages/eye-gaze/WordPopGame.tsx", "client/src/pages/eye-gaze/SentenceTrainGame.tsx"])
    assert.match(read(f), /onClick=\{onBack\}|onBack\(\)/, f);
});

test("the server build fits Render's 2 GB build machine (no gzip size report holding every file in memory)", () => {
  assert.match(read("vite.config.ts"), /reportCompressedSize: false/);
  assert.ok(!/addTask=\{[^}]*\}\} addTask=/.test(read("client/src/pages/TeacherHub.tsx")), "no duplicate addTask prop");
});

test("Apps → Me has Update app, which gets the newest version now and says what happened", () => {
  const me = SHELVES.find((s) => s.name === "Me")!;
  assert.ok(me.tiles.some((t) => t.name === "Update app" && t.game === "update"));
  assert.ok(visibleShelves(() => false).some((s) => s.tiles.some((t) => t.game === "update")), "always shown");
  assert.match(read("client/src/pages/arise-kids/KidsApp.tsx"), /m\.checkForUpdateNow\(\)/);
});

test("every game has its own app on the Apps page, and Quizzes and Books do too", () => {
  const tiles = SHELVES.flatMap((s) => s.tiles);
  const names = new Set<string>();
  for (const t of tiles) { assert.ok(!names.has(t.name), `one tile per app: ${t.name}`); names.add(t.name); }
  for (const id of PLAY_GAMES) assert.ok(tiles.some((t) => t.path === `/eye-gaze-play/${id}`), id);
  for (const p of ["/eye-gaze-fidgets", "/eye-gaze-farm", "/eye-gaze-quizzes", "/eye-gaze-books"]) assert.ok(tiles.some((t) => t.path === p), p);
  const app = read("client/src/App.tsx");
  assert.match(app, /<Route path="\/eye-gaze-play\/:game">\s*\{\(params\) => <ProtectedRoute><EyeGazeAccessGate path="\/eye-gaze-games"><KidsPlay game=\{params\.game\} \/>/);
  assert.match(app, /<KidsLibrary mode="quizzes" \/>/);
  assert.match(app, /<KidsLibrary mode="books" \/>/);
  const play = read("client/src/pages/arise-kids/KidsPlay.tsx");
  assert.match(play, /onBack=\{\(\) => navigate\(KIDS_TAB_PATHS\.apps\)\}/, "Back from a game goes to Apps");
  for (const f of ["client/src/pages/EyeGazeFidgetLab.tsx", "client/src/pages/EyeGazeFarmWorld.tsx"]) assert.match(read(f), /isEyeGazerApp\(\) \? "\/eye-gaze-apps"/, f);
  assert.match(read("client/src/pages/EyeGazeQuiz.tsx"), /isEyeGazerApp\(\) \? "\/eye-gaze-quizzes"/);
});

test("the games' Back button and name can be read on a phone, in Arise Kids' look", () => {
  const shell = read("client/src/components/eye-gaze/StageShell.tsx");
  assert.ok(!shell.includes('hidden sm:inline">Games'), "Back's word shows on phones");
  assert.ok(!shell.includes('hidden truncate text-lg font-black sm:block">{title}'), "the game's name shows on phones");
  assert.match(shell, /bg-\[#ffd34d\][^"]*text-\[#14102a\][^"]*" label="Back"><ArrowLeft[^>]*\/><span>Back<\/span>/);
  assert.match(shell, /font-family:Lexend/);
  for (const f of ["client/src/pages/AnimalSplashGame.tsx", "client/src/pages/ReadingRunnerPro.tsx", "client/src/pages/ReadingNinja.tsx"]) assert.match(read(f), /bg-\[#ffd34d\][^"]*" label="Back">/, f);
  // Words that were hidden on phones now show.
  assert.ok(!read("client/src/pages/AnimalSplashGame.tsx").includes('<div className="hidden min-w-0 sm:block">'), "Animal Splash's name");
  const farm = read("client/src/pages/eye-gaze/FarmWorldGame.tsx");
  assert.ok(farm.includes("📍<span>Places</span>") && farm.includes("🥕<span>Feed</span>"), "Farm World's Places and Feed");
  assert.ok(!read("client/src/pages/eye-gaze/FidgetLabGame.tsx").includes("hidden text-sm font-bold leading-tight text-slate-500 sm:block"), "Fidget Lab's hints");
});

test("Color Hunt: four different colors with the one to find among them; five right answers win; a wrong one stays", () => {
  for (let n = 0; n < 50; n++) {
    const r = huntRound(n);
    assert.equal(new Set(r.options.map((o) => o.color)).size, 4);
    assert.ok(r.options.some((o) => o.color === r.target));
  }
  assert.deepEqual(huntRound(7), huntRound(7), "the same round each time");
  let st = { round: 0, score: 0 };
  const wrong = huntRound(0).options.find((o) => o.color !== huntRound(0).target)!.color;
  assert.deepEqual(huntStep(st, wrong), { round: 0, score: 0, right: false, win: false });
  let wins = 0;
  for (let i = 0; i < HUNT_GOAL; i++) { const r = huntStep(st, huntRound(st.round).target); st = { round: r.round, score: r.score }; if (r.win) wins++; }
  assert.equal(wins, 1); assert.equal(st.score, 0);
  assert.equal(COLORS.length, 6);
});

test("First / Then, the timer, breathing and animal sounds", () => {
  assert.equal(firstThenSentence("Brush teeth", "Fidget Lab"), "First brush teeth, then fidget lab.");
  assert.ok(FIRSTS.length >= 6 && THENS.length >= 6);
  for (const t of THENS) if (t.path) assert.ok(SHELVES.flatMap((s) => s.tiles).some((x) => x.path === t.path), `Then opens a real app: ${t.path}`);
  assert.deepEqual(timerLeft(1000, 60_000, 31_000), { left: 0.5, ms: 30_000, done: false });
  assert.equal(timerLeft(0, 60_000, 90_000).done, true);
  assert.equal(clock(65_000), "1:05"); assert.equal(clock(59_001), "1:00");
  assert.deepEqual(breathAt(0), { phase: "in", breath: 1, size: 0, done: false });
  assert.equal(breathAt(BREATH_MS).phase, "out");
  assert.equal(breathAt(BREATH_MS * 2 + 10).breath, 2);
  assert.equal(breathAt(BREATH_MS * 2 * BREATHS).done, true);
  assert.equal(ANIMAL_SOUNDS.length, 8);
  for (const a of ANIMAL_SOUNDS) assert.ok(a.d && a.bg && a.sound, a.name);
  const kids = read("client/src/pages/arise-kids/KidsApp.tsx");
  assert.match(kids, /const EXTRAS: Record<Extra, ComponentType<ExtraProps>> = \{ hunt: ColorHunt, firstthen: FirstThen, timer: KidsTimer, breathe: Breathe, sounds: AnimalSounds \}/);
  assert.match(kids, /const goHome = \(\) => \{ setScreen\(\{ kind: "tab" \}\); \};/, "closing a game goes back where it was opened");
});

test("Update app: one shared download per version (taps don't start it over), an earlier download is reused, and the percent shows", () => {
  const n = read("client/src/lib/nativeApp.ts");
  assert.match(n, /if \(inflight && inflight\.version === version\) return inflight\.promise;/);
  assert.equal((n.match(/await downloadOnce\(u, latest\)/g) || []).length, 2, "the automatic check and Update app both use it");
  assert.equal((n.match(/u\.download\(/g) || []).length, 1, "only one place downloads");
  assert.match(n, /String\(b\?\.status\) === "success"/);
  assert.match(n, /u\.addListener\("download"/);
  const kids = read("client/src/pages/arise-kids/KidsApp.tsx");
  assert.match(kids, /if \(updating\.current\) return;/);
  assert.match(kids, /Downloading the update… \$\{p\}%/);
});

test("Wren Talker frame names its file (iPhone app answers a folder address with the app's front page = blank screen)", () => {
  const w = read("client/src/pages/EyeGazeWren.tsx");
  assert.match(w, /<iframe src="\/eyegaze\/wren\/index\.html"/);
  assert.doesNotMatch(w, /<iframe src="\/eyegaze\/wren\/"/);
});

test("Shorts in the iPhone app play through an https page (YouTube refuses capacitor://localhost: error 153)", () => {
  const tv = read("client/src/pages/EyeGazeTV.tsx");
  assert.match(tv, /const viaBridge = isNativeApp\(\);/);
  assert.match(tv, /createBridgePlayer\(host, o\)/);
  assert.match(tv, /if \(viaBridge \|\| window\.YT\?\.Player\) createPlayer\(\);/);
  const b = read("client/src/lib/ytBridge.ts");
  assert.match(b, /https:\/\/arisetodo\.com\/yt-bridge\.html/);
  for (const fn of ["mute", "unMute", "playVideo", "pauseVideo", "loadVideoById", "destroy", "getVideoData", "getIframe"]) assert.match(b, new RegExp(fn + ":"), fn);
  const page = read("client/public/yt-bridge.html");
  assert.match(page, /vars\.origin = window\.location\.origin/);
  assert.match(page, /e\.source !== window\.parent/);
});
