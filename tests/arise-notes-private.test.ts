// Arise Notes, Private and Strict modes (Notes iPhone app).
//   Private: the iPhone writes the recording down; only text reaches the server. It's saved and charged
//            like any piece, the audio is never stored, and a recording that started with minutes left
//            may finish. The safety cap still applies.
//   Strict:  nothing reaches the server. The transcript is summarized by the iPhone's own AI in parts
//            small enough for it, and the answers are merged.
// Run with: npx tsx --test tests/arise-notes-private.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import { DEFAULT_SETTINGS, PROVIDER_CENTS_PER_MIN, type Segment } from "../shared/ariseNotes";
import { registerAriseNotesRoutes } from "../server/ariseNotes";
import { createMemoryNotesStore } from "../server/ariseNotesStore";
import type { Hearer } from "../server/ariseNotesAi";
import { jsonOf, mergeStrict, strictParts, summarizeOnDevice } from "../client/src/lib/onDevice";

const NOW = Date.parse("2026-11-15T18:00:00Z");
const read = (p: string) => readFileSync(p, "utf8");

async function server(t: any) {
  const store = createMemoryNotesStore(() => NOW);
  const heardCalls = { n: 0 };
  const hear: Hearer = { hear: async () => { heardCalls.n++; return { lines: [], duration: 0, provider: "test", diarized: false }; }, available: () => true, speakersAvailable: () => true };
  const users: Record<number, any> = { 2: { id: 2, displayName: "Pat", role: "parent" }, 3: { id: 3, displayName: "Sam", role: "parent" } };
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { const u = users[Number(req.headers["x-user"])]; if (u) req.user = u; next(); });
  registerAriseNotesRoutes(app, (_req, _res, next) => next(), {
    store, hear, ask: async () => ({ json: {}, chars: 0 }), aiReady: () => true,
    planOf: async () => "plus", getUser: async (id) => users[id] ?? null, now: () => NOW,
  });
  const srv = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => srv.once("listening", () => r()));
  t.after(() => srv.close());
  const base = `http://127.0.0.1:${(srv.address() as any).port}`;
  const call = async (user: number, method: string, path: string, body?: any) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-user": String(user) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };
  const seed = (userId: number, a: Record<string, number>) => store.saveAccount({ userId, period: "2026-11-01", used: 0, own: 0, rollover: 0, warned: 0, settings: { ...DEFAULT_SETTINGS, audio: "keep" }, familyCode: null, ...a });
  return { store, call, seed, heardCalls };
}

test("Private mode: only text arrives, it's saved and charged like any piece, and no audio is ever kept", async (t) => {
  const { store, call, seed, heardCalls } = await server(t);
  await seed(2, {}); // this person keeps audio normally: Private mode must not
  const made = await call(2, "POST", "/api/notes", { title: "IEP meeting", privacy: "private", speakers: true });
  assert.equal(made.status, 201);
  const id = made.body.note.id;
  assert.equal(made.body.note.audioKeep, "delete", "Private mode never keeps audio");
  assert.equal(made.body.note.extras.privacy, "private");
  assert.equal(made.body.note.extras.speakers, false, "no speaker labels in Private mode");

  const piece = await call(2, "POST", `/api/notes/${id}/pieces/text`, { idx: 0, start: 0, secs: 125, lines: [{ start: 0, end: 4.2, text: "Let's start with reading goals." }, { start: 4.5, end: 9, text: "Services stay at 30 minutes a week." }] });
  assert.equal(piece.status, 200);
  assert.deepEqual([piece.body.minutes, piece.body.usage.used, piece.body.provider], [3, 3, "on-device"], "125 seconds is 3 minutes");
  assert.deepEqual(piece.body.segments.map((s: Segment) => [s.start, s.text, s.speaker]), [[0, "Let's start with reading goals.", null], [4.5, "Services stay at 30 minutes a week.", null]]);

  const second = await call(2, "POST", `/api/notes/${id}/pieces/text`, { idx: 1, start: 125, secs: 60, lines: [{ start: 1, end: 3, text: "Next meeting in March." }] });
  assert.equal(second.body.segments[0].start, 126, "times are from the start of the recording");
  const again = await call(2, "POST", `/api/notes/${id}/pieces/text`, { idx: 0, start: 0, secs: 125, lines: [{ start: 0, end: 1, text: "x" }] });
  assert.deepEqual([again.body.repeat, again.body.minutes], [true, 0], "a resent piece isn't charged twice");

  assert.equal(store._audio.size, 0, "no audio stored");
  assert.equal(heardCalls.n, 0, "the server's speech to text is never used");
  assert.equal(PROVIDER_CENTS_PER_MIN["on-device"], 0);
  assert.ok(store._usage.every((u) => u.provider === "on-device" && u.costCents === 0));
  const note = (await call(2, "GET", `/api/notes/${id}`)).body.note;
  assert.deepEqual([note.chargedMinutes, note.segments.length, note.audio], [4, 3, false]);
});

test("Private mode: a recording that started with minutes left can finish; the safety cap still stops it", async (t) => {
  const { call, seed } = await server(t);
  const id = (await call(2, "POST", "/api/notes", { title: "Long one", privacy: "private" })).body.note.id;
  await seed(2, { used: 1500, own: 1500 }); // the month's minutes ran out mid-recording
  const over = await call(2, "POST", `/api/notes/${id}/pieces/text`, { idx: 0, start: 0, secs: 60, lines: [{ start: 0, end: 2, text: "Still going." }] });
  assert.equal(over.status, 200, "the transcript isn't cut off");
  assert.ok(over.body.usage.used > 1500);

  await seed(2, { used: 2999, own: 2999 });
  const capped = await call(2, "POST", `/api/notes/${id}/pieces/text`, { idx: 1, start: 60, secs: 300, lines: [{ start: 0, end: 2, text: "Too much." }] });
  assert.equal(capped.status, 402);
  assert.equal(capped.body.code, "cap");

  const other = await call(3, "POST", `/api/notes/${id}/pieces/text`, { idx: 2, start: 400, secs: 10, lines: [{ start: 0, end: 1, text: "Not mine" }] });
  assert.equal(other.status, 404, "nobody else can add to it");
  const bad = await call(2, "POST", `/api/notes/${id}/pieces/text`, { idx: 3, start: 0, secs: 0, lines: [] });
  assert.equal(bad.status, 400);
});

const seg = (i: number, start: number, text: string): Segment => ({ idx: i, start, end: start + 5, speaker: null, text });

test("Strict mode: the transcript is cut into parts the iPhone's AI can read", () => {
  const segs = Array.from({ length: 60 }, (_, i) => seg(i, i * 10, `Sentence number ${i} about the reading plan and the next steps for the class.`));
  const parts = strictParts(segs, 1000);
  assert.ok(parts.length > 3);
  assert.ok(parts.every((p) => p.text.length <= 1000));
  assert.equal(parts[0].start, 0);
  assert.equal(parts.map((p) => p.text).join("\n").split("\n").length, 60, "every line, once");
  assert.match(parts[1].text, /^\[\d+:\d{2}\] Sentence number/);
  assert.deepEqual(jsonOf('Sure! ```json\n{"summary":"ok"}\n```'), { summary: "ok" });
  assert.deepEqual(jsonOf('Here: {"a":1} done'), { a: 1 });
  assert.equal(jsonOf("not json"), null);
});

test("Strict mode: each part is read on the iPhone, then merged into one summary", async () => {
  // Three long stretches of talk: too much for one request, so three parts and then an overview.
  const long = (w: string) => `${w} `.repeat(500).trim();
  const segs = [seg(0, 0, long("moving")), seg(1, 400, long("reading")), seg(2, 800, long("review"))];
  const asked: string[] = [];
  const answers = [
    JSON.stringify({ summary: "The meeting moved.", keyPoints: ["Meeting moved"], decisions: ["Move the meeting"], actions: [], questions: [], dates: [] }),
    'Here you go: {"summary":"Reading log due.","keyPoints":["Meeting moved","Reading log"],"actions":[{"what":"Email the reading log","who":"Pat","due":"2026-11-20"}],"dates":[]}',
    JSON.stringify({ summary: "IEP review set.", dates: [{ title: "IEP review", date: "2026-12-02", time: "08:15" }] }),
    JSON.stringify({ title: "Reading plan check-in", summary: "The meeting moved and Pat owes the reading log." }),
  ];
  const steps: string[] = [];
  const summary = await summarizeOnDevice({ segments: segs, template: "general", highlights: [400], today: "2026-11-15", onStep: (t) => steps.push(t), generate: async (instructions, prompt) => { asked.push(instructions + "\n" + prompt); return answers[asked.length - 1]; } });
  assert.equal(asked.length, 4, "three parts, then the overview");
  assert.ok(asked.every((a) => a.length < 8000), "every request fits the on-device model");
  assert.match(asked[0], /Today is 2026-11-15/);
  assert.deepEqual(steps.slice(0, 2), ["Reading part 1 of 3 on this iPhone…", "Reading part 2 of 3 on this iPhone…"]);
  assert.equal(summary.title, "Reading plan check-in");
  assert.equal(summary.summary, "The meeting moved and Pat owes the reading log.");
  assert.deepEqual(summary.keyPoints.map((k) => k.text), ["Meeting moved", "Reading log"]);
  assert.deepEqual(summary.actions.map((a) => [a.what, a.who, a.due, a.t]), [["Email the reading log", "Pat", "2026-11-20", 400]]);
  assert.deepEqual(summary.dates, [{ title: "IEP review", date: "2026-12-02", time: "08:15" }]);
  assert.equal(summary.highlights[0].t, 400);

  const merged = mergeStrict([
    { start: 0, json: { summary: "A", keyPoints: ["Meeting moved"], decisions: ["Move it"] }, text: "" },
    { start: 400, json: { summary: "B", keyPoints: ["meeting moved!", "Reading log"], actions: [{ what: "Email the reading log", who: "Pat", due: "2026-11-20" }], dates: [{ title: "IEP review", date: "2026-12-02", time: "08:15" }] }, text: "" },
  ], { title: "Check-in", summary: "Overview." }, "general", [], 900);
  assert.equal(merged.title, "Check-in");
  assert.equal(merged.summary, "Overview.");
  assert.deepEqual(merged.keyPoints.map((k) => [k.text, k.t]), [["Meeting moved", 0], ["Reading log", 400]], "repeats dropped, each at its part's time");
  assert.deepEqual(merged.actions.map((a) => [a.what, a.who, a.due]), [["Email the reading log", "Pat", "2026-11-20"]]);
  assert.deepEqual(merged.dates, [{ title: "IEP review", date: "2026-12-02", time: "08:15" }]);
  const fallback = mergeStrict([{ start: 0, json: null, text: "The model answered in plain words." }], null, "general", [], 100);
  assert.equal(fallback.summary, "The model answered in plain words.", "a reply that isn't JSON still becomes the summary");
});

test("the iPhone app: the on-device plugin, its permission, and the modes explained", () => {
  const swift = read("notes/ios-app/plugins/arise-on-device/ios/Sources/AriseOnDevicePlugin/AriseOnDevicePlugin.swift");
  assert.match(swift, /public let jsName = "AriseOnDevice"/);
  assert.match(swift, /request\.requiresOnDeviceRecognition = true/, "speech never leaves the iPhone");
  assert.match(swift, /#if canImport\(FoundationModels\)/);
  assert.match(swift, /if #available\(iOS 26\.0, \*\)/, "older iPhones still build and run");
  assert.match(swift, /LanguageModelSession\(instructions: instructions\)/);
  for (const m of ["status", "requestSpeech", "transcribe", "generate"]) assert.match(swift, new RegExp(`CAPPluginMethod\\(name: "${m}"`));
  assert.match(read("notes/ios-app/plugins/arise-on-device/Package.swift"), /capacitor-swift-pm\.git", from: "8\.0\.0"/);
  assert.equal(JSON.parse(read("notes/ios-app/package.json")).dependencies["arise-on-device"], "file:./plugins/arise-on-device");
  assert.match(read(".github/scripts/configure_fit_app.py"), /"NSSpeechRecognitionUsageDescription": "In Private and Strict modes/);

  const modes = read("client/src/components/arise-notes/privacyMode.tsx");
  for (const words of ["The audio never leaves your phone", "Nothing leaves this iPhone", "The transcript text is still sent to Arise", "No speaker labels", "Needs iOS 26 and Apple Intelligence", "Doesn't use any of your minutes"]) assert.ok(modes.includes(words), words);
  assert.match(modes, /if \(v !== "standard" && get\(`\$\{SEEN\}-\$\{v\}`\) !== "1"\) \{ setExplain\(v\); return; \}/, "the trade-offs show before a private mode is first used");
  assert.match(read("client/src/components/arise-notes/RecordScreen.tsx"), /privacy: privacy === "private" \? "private" : undefined/);
  assert.match(read("client/src/components/arise-notes/UploadScreen.tsx"), /createPhoneSender\(/);
  assert.match(read("client/src/components/arise-notes/SettingsScreen.tsx"), /await removeAllLocalNotes\(\)/, "Delete everything clears Strict notes too");
});
