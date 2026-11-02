// Arise Talk: the talking boards (AAC). The words and colors, safe loading, word forms, the next-word
// guesses, backups, Premium and its AI helpers, and the iPhone app's setup.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KIND_INFO, KINDS, LIMITS, PREMIUM, VOICES, cleanTalk, fillIn, messageText, nextWords, starterData, wordForms } from "../shared/talk";
import { cleanPhotoAnswer, memoryTalkStore, registerTalkRoutes } from "../server/talk";

const read = (f: string) => readFileSync(f, "utf8");

test("the starter words: core words on every color, 19 boards, ready phrases, unique ids", () => {
  const d = starterData();
  assert.equal(d.boards[0].id, "core");
  assert.ok(d.boards.length >= 18, `${d.boards.length} boards`);
  const core = d.boards[0].buttons;
  assert.ok(core.length >= 40);
  for (const k of ["people", "action", "describe", "question", "social", "stop"] as const) assert.ok(core.some((b) => b.kind === k), `core has ${k} words`);
  const ids = d.boards.flatMap((b) => b.buttons.map((x) => x.id));
  assert.equal(new Set(ids).size, ids.length, "button ids are unique");
  assert.ok(d.boards.reduce((t, b) => t + b.buttons.length, 0) > 450);
  assert.deepEqual(d.settings.quick.map((id) => d.phrases.find((p) => p.id === id)?.text), ["Yes.", "No.", "Help, please.", "Wait.", "Stop.", "I don't know."]);
  for (const k of KINDS) assert.match(KIND_INFO[k].edge, /^#[0-9a-f]{6}$/);
  assert.equal(VOICES.filter((v) => v.free).length, 2, "two voices free, four with Premium");
});

test("loading is safe: bad data, bad photos and huge lists are cleaned, and a clean copy round-trips", () => {
  const d = starterData();
  assert.deepEqual(cleanTalk(JSON.parse(JSON.stringify(d))), d);
  assert.deepEqual(cleanTalk(null), d);
  assert.deepEqual(cleanTalk({ v: 2 }), d);
  const bad = cleanTalk({ v: 1, boards: [{ id: "x", name: "X", buttons: [{ label: "hi", kind: "evil", photo: "data:text/html;base64,AAAA", opens: "nowhere" }, { label: "" }] }], settings: { cols: 99, rate: 9, voice: "robot", lock: "12a4", hold: 123 }, phrases: Array.from({ length: 900 }, (_, i) => ({ text: `p${i}` })) });
  assert.equal(bad.boards[0].id, "core", "the core board is always there");
  const x = bad.boards.find((b) => b.id === "x")!;
  assert.equal(x.buttons.length, 1);
  assert.equal(x.buttons[0].kind, "little"); assert.equal(x.buttons[0].photo, undefined); assert.equal(x.buttons[0].opens, undefined);
  assert.deepEqual([bad.settings.cols, bad.settings.rate, bad.settings.voice, bad.settings.lock, bad.settings.hold], [0, 1.5, "hannah", "", 0]);
  assert.equal(bad.phrases.length, LIMITS.phrases);
});

test("saying: the message gets a capital and the right ending; About me fills in phrases", () => {
  assert.equal(messageText(["i", "want", "eat", "pizza"]), "I want eat pizza.");
  assert.equal(messageText(["where", "bathroom"]), "Where bathroom?");
  assert.equal(messageText(["I'm finished."]), "I'm finished.");
  assert.equal(messageText([]), "");
  const about = { name: "Ava", contact: "Mom", phone: "", allergies: "peanuts", notes: "" };
  assert.equal(fillIn("My name is {name}. I'm allergic to {allergies}. Please call {contact}.", about), "My name is Ava. I'm allergic to peanuts. Please call Mom.");
  assert.equal(fillIn("Please call {contact}.", { ...about, contact: "" }), "Please call my emergency contact.");
});

test("word forms and next-word guesses", () => {
  assert.deepEqual(wordForms("go"), ["goes", "going", "went", "gone"]);
  assert.deepEqual(wordForms("stop", "action"), ["stops", "stopping", "stopped"]);
  assert.deepEqual(wordForms("open", "action"), ["opens", "opening", "opened"]);
  assert.deepEqual(wordForms("big", "describe"), ["bigger", "biggest"]);
  assert.deepEqual(wordForms("happy", "describe"), ["happier", "happiest"]);
  assert.deepEqual(wordForms("dish", "thing"), ["dishes"]);
  assert.deepEqual(wordForms("I", "people"), ["me", "my", "mine", "myself"]);
  assert.ok(nextWords(["I"], []).includes("want"));
  assert.equal(nextWords(["want"], ["I want pizza."])[0], "pizza", "what they say often comes first");
  assert.ok(nextWords([], []).includes("I want"));
});

test("the AI photo answer is cleaned: short labels, one emoji, known colors, no repeats", () => {
  const out = cleanPhotoAnswer({ title: "Kitchen table", words: [{ label: "apple", emoji: "🍎🍎🍎🍎🍎🍎", kind: "thing" }, { label: "Apple", emoji: "x" }, { label: "eat", emoji: "🍽️", kind: "nope" }, { label: "" }], phrases: ["I want an apple.", "I want an apple.", 5] });
  assert.deepEqual(out.words.map((w) => [w.label, w.kind]), [["apple", "thing"], ["eat", "thing"]]);
  assert.ok(Array.from(out.words[0].emoji).length <= 4);
  assert.deepEqual(out.phrases, ["I want an apple."]);
});

function fakeApp() {
  const routes = new Map<string, any[]>();
  const add = (m: string) => (path: string, ...h: any[]) => routes.set(`${m} ${path}`, h);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT") };
  const call = async (m: string, path: string, user: number | null, body: any = {}, headers: Record<string, string> = {}) => {
    const h = routes.get(`${m} ${path}`); if (!h) throw new Error(`no route ${m} ${path}`);
    const req: any = { params: {}, body, query: {}, user: user ? { id: user } : null, headers };
    let status = 200, out: any;
    const res: any = { headersSent: false, setHeader() {}, status(s: number) { status = s; return res; }, json(b: any) { out = b; res.headersSent = true; return res; } };
    for (const fn of h) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; }
    return { status, body: out };
  };
  return { app, call };
}

test("server: backups, Premium gates the AI helpers, the owner can give Premium", async () => {
  const store = memoryTalkStore();
  const { app, call } = fakeApp();
  let now = Date.parse("2026-11-01T12:00:00Z");
  registerTalkRoutes(app, (_q: any, _s: any, next: any) => next(), {
    store, now: () => now, isAdmin: (req) => req.user?.id === 99,
    ai: {
      chat: async (system, user) => (system.includes("tapped") ? JSON.stringify({ options: ["I want to eat pizza.", "Can I have pizza?", "I want to eat pizza.", "Pizza, please."] }) : JSON.stringify({ replies: ["Yes, please.", "No, thanks.", "Give me a moment."], seen: user })),
      see: async () => JSON.stringify({ title: "Lunch", words: [{ label: "sandwich", emoji: "🥪", kind: "thing" }], phrases: ["I'm hungry."] }),
      hear: async () => "Do you want lunch now?",
    },
  });
  // Signed out: nothing.
  assert.equal((await call("GET", "/api/talk/me", null)).status, 401);
  // A backup comes back cleaned.
  const d = starterData(); d.about.name = "Ava";
  assert.equal((await call("PUT", "/api/talk/backup", 5, { data: { ...d, settings: { ...d.settings, cols: 77 } } })).status, 200);
  const back = (await call("GET", "/api/talk/backup", 5)).body;
  assert.equal(back.data.about.name, "Ava"); assert.equal(back.data.settings.cols, 0);
  assert.equal((await call("GET", "/api/talk/me", 5)).body.premium, false);
  assert.ok((await call("GET", "/api/talk/me", 5)).body.backupAt);
  // The AI helpers need Premium.
  assert.equal((await call("POST", "/api/talk/ai/sentence", 5, { words: "want eat pizza" })).status, 402);
  assert.equal((await call("POST", "/api/talk/admin/comp", 5, { userId: 5, days: 30 })).status, 403);
  await call("POST", "/api/talk/admin/comp", 99, { userId: 5, days: 30 });
  assert.equal((await call("GET", "/api/talk/me", 5)).body.premium, true);
  assert.deepEqual((await call("POST", "/api/talk/ai/sentence", 5, { words: "want eat pizza" })).body.options, ["I want to eat pizza.", "Can I have pizza?", "Pizza, please."]);
  assert.deepEqual((await call("POST", "/api/talk/ai/replies", 5, { heard: "Lunch?", name: "Ava" })).body.replies, ["Yes, please.", "No, thanks.", "Give me a moment."]);
  assert.equal((await call("POST", "/api/talk/ai/photo", 5, { image: "data:text/html;base64,AAAA" })).status, 400);
  assert.equal((await call("POST", "/api/talk/ai/photo", 5, { image: "data:image/jpeg;base64,AAAA" })).body.title, "Lunch");
  assert.equal((await call("POST", "/api/talk/listen", 5, Buffer.alloc(2000), { "content-type": "audio/mp4" })).body.text, "Do you want lunch now?");
  assert.equal((await call("POST", "/api/talk/listen", 5, Buffer.alloc(10), { "content-type": "audio/mp4" })).status, 400);
  // Premium runs out.
  now += 40 * 864e5;
  assert.equal((await call("GET", "/api/talk/me", 5)).body.premium, false);
  // The site owner always has it; payments say so plainly when Stripe isn't set up.
  assert.equal((await call("GET", "/api/talk/me", 99)).body.premium, true);
  assert.equal((await call("POST", "/api/talk/premium/checkout", 5, { plan: "year" })).status, 409);
  assert.equal(PREMIUM.trialDays, 7);
});

test("wiring: the website route, the iPhone and iPad app, sign in with Apple, live updates", () => {
  assert.match(read("client/src/App.tsx"), /<Route path="\/talk"><TalkApp \/><\/Route>/);
  assert.match(read("client/src/App.tsx"), /if \(isTalkApp\(\)\) return/);
  assert.match(read("client/src/lib/nativeApp.ts"), /talk: \{ name: "Arise Talk", bundle: "com\.arisereader\.talk"/);
  assert.match(read("server/appleSignIn.ts"), /TALK_APP = "com\.arisereader\.talk"/);
  assert.match(read("server/routes.ts"), /registerTalkRoutes\(app, authMiddleware/);
  assert.match(read("server/ota.ts"), /"talk"\] as const/);
  const wf = read(".github/workflows/talk-ios.yml");
  assert.match(wf, /branches: \[feat\/talk-testflight\]/);
  assert.match(wf, /VITE_NATIVE_APP=talk npx vite build/);
  assert.match(wf, /configure_fit_app\.py ios\/App\/App\/Info\.plist talk/);
  assert.equal(JSON.parse(read("talk/ios-app/capacitor.config.json")).appId, "com.arisereader.talk");
  assert.match(read(".github/scripts/configure_fit_app.py"), /"NSMicrophoneUsageDescription": "Arise Talk uses the microphone only when you tap Listen/);
  assert.match(read("migrations/talk.sql"), /create table if not exists public\.talk_users/);
  // Every spoken word is an AI voice: no built-in speech synthesis anywhere in the app.
  for (const f of ["TalkApp.tsx", "TalkSheets.tsx", "TalkEdit.tsx", "talkStore.ts"]) assert.doesNotMatch(read(`client/src/pages/talk/${f}`), /speechSynthesis|SpeechSynthesisUtterance/, f);
  assert.match(read("client/src/pages/talk/talkStore.ts"), /\/api\/voice\/say/);
});
