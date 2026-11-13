// TTS Buddy: a teacher snaps a worksheet on their phone, links a child's laptop with a 4-digit code, and the laptop
// reads each question aloud with the words lighting up. Run with: npx tsx --test tests/tts-buddy.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerTtsBuddyRoutes, type Spoken } from "../server/ttsBuddy";
import { createMemoryKv } from "../server/fitKv";
import { alignWords, classCode, cleanWorksheet, estimateTimes, pairCode, spokenFor, tokens, wordAt } from "../shared/ttsBuddy";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function fakeApp() {
  const routes: [string, string, any][] = [];
  const add = (m: string) => (path: string, h: any) => routes.push([m, path, h]);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), patch: add("PATCH"), delete: add("DELETE") };
  const call = async (m: string, path: string, headers: Record<string, string> = {}, body: any = {}, ip = "1.2.3.4") => {
    for (const [km, kp, h] of routes) {
      if (km !== m) continue;
      const names: string[] = []; const re = new RegExp("^" + kp.replace(/:([a-zA-Z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "$");
      const [bare, qs = ""] = path.split("?");
      const hit = bare.match(re); if (!hit) continue;
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, hit[i + 1]])), query: Object.fromEntries(new URLSearchParams(qs)), body, headers: { "x-forwarded-for": ip, ...headers }, ip };
      let status = 200, out: any;
      const res: any = { set() {}, type() { return res; }, send(b: any) { out = b; return res; }, status(s: number) { status = s; return res; }, json(b: any) { out = b; return res; } };
      await h(req, res);
      return { status, body: out };
    }
    throw new Error(`no route ${m} ${path}`);
  };
  return { app, call };
}

const PHOTO = "data:image/jpeg;base64,/9j/AAAA";
const AI_REPLY = JSON.stringify({
  title: "Fractions Practice",
  items: [
    { kind: "read", number: "", text: "Directions: Read each question. Circle the best answer.", say: "", choices: [] },
    { kind: "choice", number: "1.", text: "Which fraction is the same as one half?", say: "", choices: ["A. 2/4", "B) 1/3", "(c) 3/5"] },
    { kind: "short", number: "2", text: "3/4 + 1/4 = ____", say: "three fourths plus one fourth equals blank", choices: [] },
    { kind: "choice", number: "3", text: "A pizza cut in 8 slices has eighths.", say: "", choices: ["True"] },
    { kind: "long", number: "4", text: "Explain how you know.", say: "", choices: [] },
    { kind: "short", number: "5", text: "   ", choices: [] },
  ],
});
const setup = () => {
  let n = 0; const spoken: string[] = [];
  const { app, call } = fakeApp();
  const speak = async (text: string): Promise<Spoken> => { spoken.push(text); const ws = text.split(" "); return { audio: Buffer.from("mp3"), duration: ws.length * 0.4, words: ws.map((w, i) => ({ word: w.replace(/[.,]/g, ""), start: i * 0.4, end: i * 0.4 + 0.35 })) }; };
  const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.15, 0.25, 0.35];
  registerTtsBuddyRoutes(app, { askText: async () => "{}", kv: createMemoryKv(), readPhotos: async () => AI_REPLY, speak, aiConfigured: () => true, rand: () => seq[n++ % seq.length] });
  return { call, spoken };
};
const T = { "x-buddy-teacher": "teacher-key-0123456789abcdefghijklmnopqrstuv" };

test("worksheets are cleaned: letters come off choices, a one-choice question becomes short, empty items go", () => {
  const ws = cleanWorksheet(JSON.parse(AI_REPLY), "w1", "2026-11-12T00:00:00Z");
  assert.equal(ws.items.length, 5);
  assert.deepEqual(ws.items[1].choices, ["2/4", "1/3", "3/5"]);
  assert.equal(ws.items[1].number, "1");
  assert.equal(ws.items[3].kind, "short");
  assert.equal(spokenFor(ws.items[2], "q"), "three fourths plus one fourth equals blank");
  assert.equal(spokenFor(ws.items[1], "c1"), "B. 1/3");
  assert.equal(spokenFor(ws.items[1], "c9"), "");
});

test("codes are easy to read: 4 digits for laptops, 4 letters with no vowels for a class", () => {
  assert.match(pairCode(() => 0), /^\d{4}$/); assert.match(pairCode(() => 0.9999), /^\d{4}$/);
  const c = classCode(() => 0.5); assert.match(c, /^[BCDFGHJKMNPQRSTVWXZ]{4}$/);
});

test("words line up with what the voice said, and gaps (symbols, blanks) take time from their neighbors", () => {
  const shown = tokens("3/4 + 1/4 = ____ is it?").map((t) => t.w);
  const said = [{ word: "three", start: 0, end: 0.4 }, { word: "fourths", start: 0.4, end: 0.8 }, { word: "is", start: 3, end: 3.2 }, { word: "it", start: 3.2, end: 3.5 }];
  const t = alignWords(shown, said, 3.6);
  assert.equal(t.length, shown.length);
  assert.deepEqual(t[5], { s: 3, e: 3.2 }); assert.deepEqual(t[6], { s: 3.2, e: 3.5 });
  for (let i = 1; i < t.length; i++) assert.ok(t[i].s >= t[i - 1].s, "times only go forward");
  assert.ok(t[4].e <= 3 + 1e-9);
  const plain = alignWords(["Which", "fraction", "is"], [{ word: "Which", start: 0.1, end: 0.3 }, { word: "fraction", start: 0.3, end: 0.8 }, { word: "is", start: 0.8, end: 0.9 }], 1);
  assert.deepEqual(plain, [{ s: 0.1, e: 0.3 }, { s: 0.3, e: 0.8 }, { s: 0.8, e: 0.9 }]);
  const est = estimateTimes(["Hi", "there,", "friend."], 3);
  assert.equal(est[0].s, 0); assert.ok(Math.abs(est[2].e - 3) < 0.01);
  assert.equal(wordAt(plain, 0), -1); assert.equal(wordAt(plain, 0.35), 1); assert.equal(wordAt(plain, 5), 2);
});

test("the whole class flow: snap, link a laptop by its code, it reads aloud, answers come back to the teacher", async () => {
  const { call, spoken } = setup();
  assert.equal((await call("GET", "/api/buddy/teacher", {})).status, 401);
  const r = await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO, "not a photo"] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const ws = r.body.worksheet; assert.equal(ws.title, "Fractions Practice"); assert.equal(ws.items.length, 5); assert.equal(ws.pages, 1);

  // A laptop opens arisetodo.com/buddy and shows its code.
  const lap = await call("POST", "/api/buddy/laptop");
  assert.match(lap.body.code, /^\d{4}$/);
  const L = { "x-buddy-laptop": lap.body.key };
  assert.equal((await call("GET", `/api/buddy/laptop/${lap.body.id}`, L)).body.state, "waiting");
  assert.equal((await call("GET", `/api/buddy/laptop/${lap.body.id}`, { "x-buddy-laptop": "x".repeat(40) })).status, 404, "another key can't read it");

  // The teacher types the code.
  assert.equal((await call("POST", "/api/buddy/teacher/link", T, { code: "0000", worksheetId: ws.id })).status, 404);
  const linked = await call("POST", "/api/buddy/teacher/link", T, { code: ` ${lap.body.code.slice(0, 2)}-${lap.body.code.slice(2)} `, worksheetId: ws.id, name: "Seat 4" });
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  const ready = await call("GET", `/api/buddy/laptop/${lap.body.id}`, L);
  assert.equal(ready.body.state, "ready"); assert.equal(ready.body.name, "Seat 4"); assert.equal(ready.body.worksheet.id, ws.id);
  // The code can't be used again to grab the laptop.
  assert.equal((await call("POST", "/api/buddy/teacher/link", { "x-buddy-teacher": "someone-else-0123456789abcdefghijklmnop" }, { code: lap.body.code, worksheetId: ws.id })).status, 404);

  // Reading aloud: the laptop gets the voice and word times for the question and each choice.
  const q = await call("POST", "/api/buddy/speak", L, { laptopId: lap.body.id, worksheetId: ws.id, itemId: ws.items[2].id, part: "q" });
  assert.equal(q.status, 200); assert.match(q.body.audio, /^data:audio\/mpeg;base64,/);
  assert.equal(q.body.words.length, tokens(ws.items[2].text).length, "one time per word on screen");
  assert.equal(spoken.at(-1), "three fourths plus one fourth equals blank", "math is read in words");
  const c = await call("POST", "/api/buddy/speak", L, { laptopId: lap.body.id, worksheetId: ws.id, itemId: ws.items[1].id, part: "c0" });
  assert.equal(c.status, 200); assert.equal(spoken.at(-1), "A. 2/4");
  assert.equal((await call("POST", "/api/buddy/speak", {}, { laptopId: lap.body.id, worksheetId: ws.id, itemId: ws.items[1].id, part: "q" })).status, 403, "no key, no voice");
  assert.equal((await call("POST", "/api/buddy/speak", L, { laptopId: lap.body.id, worksheetId: ws.id, itemId: ws.items[1].id, part: "c7" })).status, 404);

  // The child answers; the teacher sees it.
  const p = await call("POST", `/api/buddy/laptop/${lap.body.id}/progress`, L, { worksheetId: ws.id, answers: { [ws.items[1].id]: "2/4", [ws.items[2].id]: "1", nope: "x" }, step: 3 });
  assert.equal(p.status, 200);
  const view = await call("GET", "/api/buddy/teacher", T);
  assert.equal(view.body.laptops.length, 1);
  assert.equal(view.body.laptops[0].answered, 2); assert.equal(view.body.laptops[0].questions, 4); assert.equal(view.body.laptops[0].step, 3);
  assert.deepEqual(Object.keys(view.body.laptops[0].answers).sort(), [ws.items[1].id, ws.items[2].id].sort());
  assert.match(view.body.classCode, /^[A-Z]{4}$/);

  // A second laptop joins with the class code instead.
  const lap2 = await call("POST", "/api/buddy/laptop");
  const L2 = { "x-buddy-laptop": lap2.body.key };
  assert.equal((await call("POST", `/api/buddy/laptop/${lap2.body.id}/join`, L2, { classCode: "ZZZZ" })).status, 404);
  const j = await call("POST", `/api/buddy/laptop/${lap2.body.id}/join`, L2, { classCode: view.body.classCode.toLowerCase(), name: "Ava" });
  assert.equal(j.status, 200, JSON.stringify(j.body));
  assert.equal((await call("GET", `/api/buddy/laptop/${lap2.body.id}`, L2)).body.worksheet.id, ws.id);

  // A new worksheet sent to the class replaces the old one on every laptop, with fresh answers.
  const r2 = await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO, PHOTO] });
  const sent = await call("POST", "/api/buddy/teacher/send", T, { worksheetId: r2.body.worksheet.id });
  assert.equal(sent.body.sent, 2);
  const after = await call("GET", `/api/buddy/laptop/${lap.body.id}`, L);
  assert.equal(after.body.worksheet.id, r2.body.worksheet.id); assert.deepEqual(after.body.answers, {});
  assert.equal((await call("POST", `/api/buddy/laptop/${lap.body.id}/progress`, L, { worksheetId: ws.id, answers: {} })).status, 409, "old worksheet's answers are refused");

  // Edits, rename, unlink, delete.
  const edited = await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}`, T, { title: "Fractions", items: ws.items.slice(1, 3) });
  assert.equal(edited.body.worksheet.items.length, 2);
  assert.equal((await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}`, { "x-buddy-teacher": "someone-else-0123456789abcdefghijklmnop" }, { items: ws.items })).status, 404, "only its teacher edits it");
  await call("PATCH", `/api/buddy/teacher/laptops/${lap.body.id}`, T, { name: "Marcus" });
  assert.equal((await call("GET", `/api/buddy/laptop/${lap.body.id}`, L)).body.name, "Marcus");
  await call("PATCH", `/api/buddy/teacher/laptops/${lap.body.id}`, T, { unlink: true });
  const back = await call("GET", `/api/buddy/laptop/${lap.body.id}`, L);
  assert.equal(back.body.state, "waiting"); assert.match(back.body.code, /^\d{4}$/);
  await call("DELETE", `/api/buddy/teacher/worksheets/${ws.id}`, T);
  assert.equal((await call("GET", `/api/buddy/teacher/worksheets/${ws.id}`, T)).status, 404);
});

test("a photo that isn't a worksheet gets a clear message, and reading is limited per day", async () => {
  const { app, call } = fakeApp();
  registerTtsBuddyRoutes(app, { askText: async () => "{}", kv: createMemoryKv(), readPhotos: async () => '{"title":"","items":[]}', speak: async () => { throw new Error("x"); }, aiConfigured: () => true });
  const r = await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] });
  assert.equal(r.status, 422); assert.match(r.body.message, /clearer photo/);
  assert.equal((await call("POST", "/api/buddy/teacher/read", T, { images: [] })).status, 400);
  for (let i = 0; i < 39; i++) await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] });
  assert.equal((await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] })).status, 429);
});

test("the site: arisetodo.com/buddy opens it, the routes and server are wired, no account needed", () => {
  assert.match(read("client/src/main.tsx"), /path === "\/buddy"/);
  assert.match(read("client/src/App.tsx"), /<Route path="\/buddy">/);
  assert.match(read("server/routes.ts"), /registerTtsBuddyRoutes\(app, \{ kv: createSupabaseKv\(\), files: createSupabaseFiles\(\) \}\)/);
  assert.match(read("server/index.ts"), /"\/api\/buddy\/teacher\/read", express\.json\(\{ limit: "16mb" \}\)/);
});

// The bug this caught (Nov 12): photos were sent to OpenAI's chat, which this site quietly forwards to Groq's
// text-only model (server/aiProvider.ts), so every worksheet failed. Photos must go to Groq's vision model.
import { looseJson, readPage, readWorksheet, buddyAiReady } from "../server/ttsBuddy";
import { fitVisionTargets } from "../server/fit";
const reply = (status: number, body: any, headers: Record<string, string> = {}) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });

test("worksheet photos go to the same vision services as Arise Fit's photo scans (Grok, then Groq), never OpenAI's redirected chat", async () => {
  const env = { ...process.env };
  try {
    for (const k of Object.keys(process.env)) if (/grok|xai|groq|openai/i.test(k)) delete process.env[k];
    process.env.OPENAI_API_KEY = "routed-to-grok";
    assert.equal(buddyAiReady(), false, "OpenAI's placeholder key can't see photos");
    process.env.GROQ_KEY = "gsk_test123456789"; process.env.XAI_API_KEY = "xai-test123456789";
    assert.equal(buddyAiReady(), true);
    const targets = fitVisionTargets();
    assert.deepEqual(targets.map((t) => t.provider), ["xai", "groq"]);
    assert.ok(!targets.some((t) => t.url.includes("api.openai.com")));

    const calls: any[] = [];
    const page = await readPage(PHOTO, 1, 1, async (url, key, body) => { calls.push({ url, key, body }); return reply(200, { output_text: '{"title":"Spelling","items":[{"kind":"short","text":"Spell cat."}]}' }); }, targets);
    assert.equal(page.title, "Spelling"); assert.equal(page.items.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.x.ai/v1/responses"); assert.equal(calls[0].key, "xai-test123456789");
    const part = calls[0].body.input[0].content[1];
    assert.equal(part.type, "input_image"); assert.equal(part.image_url, PHOTO, "the photo itself is sent");
    assert.match(calls[0].body.instructions, /classroom worksheet/);

    // Grok refuses → Groq (chat format, the photo as image_url); JSON mode refused → asked again without it.
    const seen: string[] = [];
    const p2 = await readPage(PHOTO, 2, 3, async (url, _k, body) => {
      seen.push(`${url.includes("x.ai") ? "xai" : "groq"}|${body.response_format || body.text ? "json" : "plain"}`);
      if (url.includes("x.ai")) return reply(404, { error: { message: "model not found" } });
      assert.equal(body.messages[1].content[1].image_url.url, PHOTO);
      if (body.response_format) return reply(400, { error: { message: "response_format json_object not supported" } });
      return reply(200, { choices: [{ message: { content: 'Here you go:\n```json\n{"title":"","items":[{"kind":"read","text":"Page two."}]}\n```' } }] });
    }, targets);
    assert.deepEqual(seen, ["xai|json", "groq|json", "groq|plain"]);
    assert.equal(p2.items[0].text, "Page two.");

    // Nothing works → a plain message plus the reason, never a key.
    const err: any = await readPage(PHOTO, 1, 1, async () => reply(401, { error: { message: "Incorrect API key gsk_abcdefghijklmnop" } }), targets).catch((e) => e);
    assert.match(err.message, /Couldn't reach the worksheet reader/);
    assert.match(err.detail, /xai .*401/); assert.doesNotMatch(err.detail, /gsk_abcdef/);
  } finally { process.env = env; }
});

test("several pages are read separately (each fits Groq's size limit) and come back in order", async () => {
  const merged = JSON.parse(await readWorksheet(["a", "b"], async (img, page) => ({ title: page === 1 ? "" : "Page 2 title", items: [{ kind: "short", text: `from ${img}` }] })));
  assert.equal(merged.title, "Page 2 title");
  assert.deepEqual(merged.items.map((i: any) => i.text), ["from a", "from b"]);
  assert.deepEqual(looseJson('```json\n{"a":1}\n```'), { a: 1 }); assert.equal(looseJson("nope"), null);
});

test("the voice is the site's working voice (Groq/Deepgram), with Groq's Whisper for word times", () => {
  const src = read("server/ttsBuddy.ts");
  assert.match(src, /aiSpeech\(text, "autumn"\)/);
  assert.match(src, /audio\/transcriptions`, groqKey\(\), "whisper-large-v3-turbo"/);
  assert.doesNotMatch(src, /gpt-4o-mini-tts/, "OpenAI's voice is off on this site");
  assert.match(src, /data:\$\{spoken\.type \|\| "audio\/mpeg"\}/, "WAV from Groq plays as WAV");
  assert.match(read("client/src/pages/buddy/buddyApi.ts"), /url\.length <= 3_500_000/);
});


// ---------------- Pictures and accommodations (Nov 12) ----------------
import { createMemoryFiles } from "../server/ttsBuddy";
import { cleanAcc, cleanFigure, cleanSupports } from "../shared/ttsBuddy";

test("pictures: a box on the page (clamped, ordered, not tiny); accommodations cleaned and never empty", () => {
  assert.deepEqual(cleanFigure({ box: [900, 700, 100, 1200], alt: "number line", page: 2 }), { page: 2, box: [100, 700, 900, 1000], alt: "number line", img: "" });
  assert.equal(cleanFigure({ box: [10, 10, 15, 900] }), null, "too thin to be a picture");
  assert.equal(cleanFigure({ box: [1, 2, 3] }), null);
  const sp = cleanSupports({ simple: "What cuts trees?", steps: ["Look at the story.", "", "Find teeth."], keep: [1, 1, 3, 9], vocab: [{ word: "lodge", meaning: "a beaver home" }, { w: "x" }], bank: ["mud", "sand"] }, 4)!;
  assert.deepEqual(sp.steps, ["Look at the story.", "Find teeth."]);
  assert.deepEqual(sp.keep, [1, 3]); assert.deepEqual(sp.vocab, [{ w: "lodge", m: "a beaver home" }]);
  assert.equal(cleanSupports({ simple: "", steps: [] }, 0), null);
  assert.deepEqual(cleanSupports({ keep: [2] }, 4), null, "one kept choice isn't 'fewer choices'");
  // Helpers are all on unless the teacher turns one off; "big" (start in big text) is off unless turned on.
  assert.deepEqual(cleanAcc(undefined), { simple: true, steps: true, starter: true, bank: true, vocab: true, fewer: true, big: false, mic: true });
  assert.deepEqual(cleanAcc({ simple: false, mic: "yes", bogus: true }), { simple: false, steps: true, starter: true, bank: true, vocab: true, fewer: true, big: false, mic: true });
  const it: any = { id: "q1", kind: "choice", number: "1", text: "T", say: "", choices: ["a", "b"], figure: { page: 1, box: [0, 0, 500, 500], alt: "a double number line", img: "abc123" }, supports: sp };
  assert.equal(spokenFor(it, "s"), "What cuts trees?"); assert.equal(spokenFor(it, "h1"), "Find teeth."); assert.equal(spokenFor(it, "v0"), "lodge. a beaver home");
  assert.equal(spokenFor(it, "p"), "Picture: a double number line"); assert.equal(spokenFor(it, "h7"), "");
});

test("the reader is told to box pictures instead of describing them, and each page's pictures keep their page", async () => {
  const { READ_PROMPT } = await import("../shared/ttsBuddy");
  assert.match(READ_PROMPT, /do NOT describe it in "text"/); assert.match(READ_PROMPT, /"figure": \{"box"/);
  const merged = JSON.parse(await readWorksheet(["a", "b"], async (_img, page) => ({ title: "", items: [{ kind: "short", text: `q${page}`, figure: { box: [1, 2, 300, 400], alt: "graph" } }] })));
  assert.deepEqual(merged.items.map((i: any) => i.figure.page), [1, 2]);
});

test("pictures end to end: page photos kept, the phone's crop saved, shown to the right laptop only, kept through edits", async () => {
  const { app, call } = fakeApp();
  const files = createMemoryFiles();
  const reply = JSON.stringify({ title: "Ratios", items: [{ kind: "short", number: "1", text: "Use the double number line. What percent is 3?", figure: { box: [100, 200, 900, 400], alt: "double number line, 0 to 6 on top, 0% to 150% on the bottom" } }, { kind: "short", number: "2", text: "What is 50% of 6?" }] });
  registerTtsBuddyRoutes(app, { askText: async () => "{}", kv: createMemoryKv(), files, readPhotos: async () => reply, speak: async () => ({ audio: Buffer.from("x"), words: [], duration: 1 }), aiConfigured: () => true });
  const r = await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] });
  const ws = r.body.worksheet; const q1 = ws.items[0];
  assert.equal(q1.text, "Use the double number line. What percent is 3?", "no [picture of …] in the words");
  assert.deepEqual(q1.figure, { page: 1, box: [100, 200, 900, 400], alt: "double number line, 0 to 6 on top, 0% to 150% on the bottom", img: "" });
  assert.ok(await files.get(`page/${ws.id}/1`), "page photo kept");
  const page = await call("GET", `/api/buddy/teacher/worksheets/${ws.id}/pages/1`, T);
  assert.equal(page.status, 200); assert.ok(Buffer.isBuffer(page.body));
  assert.equal((await call("GET", `/api/buddy/teacher/worksheets/${ws.id}/pages/1`, { "x-buddy-teacher": "someone-else-0123456789abcdefghijklmnop" })).status, 404);

  // The phone crops it and saves it.
  const CROP = "data:image/jpeg;base64,/9j/CROP";
  const put = await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}/figures/${q1.id}`, T, { image: CROP, page: 1, box: [100, 200, 900, 400], alt: q1.figure.alt });
  assert.equal(put.status, 200); const img = put.body.worksheet.items[0].figure.img; assert.match(img, /^[a-z0-9]{12}$/);
  assert.equal((await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}/figures/${q1.id}`, T, { image: "data:text/html;base64,PHA+" })).status, 400);

  // A laptop it was sent to sees it; another laptop doesn't.
  const lap = await call("POST", "/api/buddy/laptop"); const L = { "x-buddy-laptop": lap.body.key };
  await call("POST", "/api/buddy/teacher/link", T, { code: lap.body.code, worksheetId: ws.id });
  const got = await call("GET", `/api/buddy/figure/${ws.id}/${q1.id}/${img}?lid=${lap.body.id}`, L);
  assert.equal(got.status, 200); assert.equal(got.body.toString("base64"), "/9j/CROP");
  const other = await call("POST", "/api/buddy/laptop");
  assert.equal((await call("GET", `/api/buddy/figure/${ws.id}/${q1.id}/${img}?lid=${other.body.id}`, { "x-buddy-laptop": other.body.key })).status, 403);
  assert.equal((await call("GET", `/api/buddy/figure/${ws.id}/${q1.id}/${img}`, {})).status, 403);

  // The teacher's edits keep the picture (and can't point it somewhere else); removing it removes it.
  const ready = await call("GET", `/api/buddy/laptop/${lap.body.id}`, L);
  const items = ready.body.worksheet.items.map((i: any) => ({ ...i, figure: i.figure ? { ...i.figure, img: "zzzzzzzzzzzz", box: [0, 0, 1000, 1000] } : null }));
  const edited = await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}`, T, { title: "Ratios", items: [{ ...items[0], text: "Use the number line. What percent is 3?" }, items[1]] });
  assert.equal(edited.body.worksheet.items[0].figure.img, img); assert.deepEqual(edited.body.worksheet.items[0].figure.box, [100, 200, 900, 400]);
  const gone = await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}/figures/${q1.id}`, T, { remove: true });
  assert.equal(gone.body.worksheet.items[0].figure, null);
});

test("accommodations: AI drafts them, the teacher sets them per student, the laptop gets them, the mic only when on", async () => {
  const { app, call } = fakeApp();
  const asked: string[] = [];
  const askText = async (_sys: string, user: string) => {
    asked.push(user); const items = JSON.parse(user).items;
    return JSON.stringify({ items: items.map((i: any) => ({ id: i.id, simple: `Easy: short words for ${i.id}`, steps: ["Think about it.", "Look again."], starter: i.kind === "long" ? "I think" : "", bank: i.kind === "short" ? ["mud", "sand", "rocks"] : [], vocab: [{ w: "lodge", m: "a beaver's home" }], keep: i.kind === "choice" ? [1, 3] : [] })) });
  };
  const heard: string[] = [];
  registerTtsBuddyRoutes(app, { kv: createMemoryKv(), files: createMemoryFiles(), readPhotos: async () => AI_REPLY, askText, hear: async (a, mime) => { heard.push(mime); return "they cut trees with teeth"; }, speak: async (t) => ({ audio: Buffer.from(t), words: [], duration: 1 }), aiConfigured: () => true });
  const ws = (await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] })).body.worksheet;
  const d = await call("POST", `/api/buddy/teacher/worksheets/${ws.id}/supports`, T, {});
  assert.equal(d.status, 200, JSON.stringify(d.body)); assert.equal(d.body.made, ws.items.length);
  const q1 = d.body.worksheet.items.find((i: any) => i.kind === "choice");
  assert.equal(q1.supports.simple, `Easy: short words for ${q1.id}`); assert.deepEqual(q1.supports.keep.length, q1.choices.length > 3 ? 2 : 0);
  assert.ok(asked.every((u) => JSON.parse(u).items.length <= 6), "drafted a few at a time");

  // Class default for new laptops, then one student changed on their own.
  await call("POST", "/api/buddy/teacher/acc", T, { acc: { simple: true, steps: true, mic: false } });
  const lap = await call("POST", "/api/buddy/laptop"); const L = { "x-buddy-laptop": lap.body.key };
  await call("POST", "/api/buddy/teacher/link", T, { code: lap.body.code, worksheetId: ws.id, name: "Ava" });
  let got = await call("GET", `/api/buddy/laptop/${lap.body.id}`, L);
  assert.equal(got.body.acc.simple, true); assert.equal(got.body.acc.mic, false); assert.equal(got.body.acc.bank, true, "not mentioned = still on");
  assert.equal(got.body.worksheet.items[0].supports.simple.startsWith("Easy:"), true);
  // The voice reads the simpler wording and the hints.
  const s1 = await call("POST", "/api/buddy/speak", L, { laptopId: lap.body.id, worksheetId: ws.id, itemId: ws.items[1].id, part: "s" });
  assert.equal(s1.status, 200); assert.match(Buffer.from(s1.body.audio.split(",")[1], "base64").toString(), /^Easy: /);
  assert.equal((await call("POST", "/api/buddy/speak", L, { laptopId: lap.body.id, worksheetId: ws.id, itemId: ws.items[1].id, part: "h1" })).status, 200);

  // Say the answer: refused until the teacher turns the microphone on for this student.
  const audio = "data:audio/webm;codecs=opus;base64,GkXfo0AgQoaBAULygQ==";
  assert.equal((await call("POST", `/api/buddy/laptop/${lap.body.id}/hear`, L, { audio })).status, 403);
  await call("PATCH", `/api/buddy/teacher/laptops/${lap.body.id}`, T, { acc: { ...got.body.acc, mic: true, big: true } });
  got = await call("GET", `/api/buddy/laptop/${lap.body.id}`, L);
  assert.equal(got.body.acc.mic, true); assert.equal(got.body.acc.big, true); assert.equal(got.body.acc.simple, true);
  const h = await call("POST", `/api/buddy/laptop/${lap.body.id}/hear`, L, { audio });
  assert.equal(h.status, 200); assert.equal(h.body.text, "they cut trees with teeth"); assert.deepEqual(heard, ["audio/webm"]);
  assert.equal((await call("POST", `/api/buddy/laptop/${lap.body.id}/hear`, L, { audio: "nope" })).status, 400);

  // "Everyone": the class default pushed to every linked laptop.
  const all = await call("POST", "/api/buddy/teacher/acc", T, { acc: { fewer: true }, everyone: true });
  assert.equal(all.body.changed, 1);
  assert.deepEqual((await call("GET", `/api/buddy/laptop/${lap.body.id}`, L)).body.acc.fewer, true);
  // The teacher's view shows each laptop's accommodations.
  const home = await call("GET", "/api/buddy/teacher", T);
  assert.equal(home.body.laptops[0].acc.fewer, true); assert.equal(home.body.acc.fewer, true);
});

test("accommodations failing (AI down) say so plainly; the pages use them", async () => {
  const { app, call } = fakeApp();
  registerTtsBuddyRoutes(app, { kv: createMemoryKv(), readPhotos: async () => AI_REPLY, askText: async () => { throw new Error("chat 503"); }, aiConfigured: () => true });
  const ws = (await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] })).body.worksheet;
  const d = await call("POST", `/api/buddy/teacher/worksheets/${ws.id}/supports`, T, {});
  assert.equal(d.status, 502); assert.match(d.body.message, /Couldn't write supports/); assert.match(d.body.detail, /chat 503/);
  const lap = read("client/src/pages/buddy/BuddyLaptop.tsx");
  for (const k of ["acc.simple", "acc.steps", "acc.bank", "acc.starter", "acc.vocab", "acc.fewer", "acc.big", "acc.mic", "<Figure "]) assert.ok(lap.includes(k), `laptop uses ${k}`);
  const teach = read("client/src/pages/buddy/BuddyTeacher.tsx");
  for (const k of ["snapBox(photo, it.figure!.box)", "CropFixer", "SupportsEditor", "AccSwitches", "/supports`"]) assert.ok(teach.includes(k), `teacher has ${k}`);
});

test("a shared picture (a number line several questions use) shows on each of them, until a new section", async () => {
  const { pictureFor } = await import("../shared/ttsBuddy");
  const mk = (id: string, kind: any, img = "") => ({ id, kind, number: "", text: id, say: "", choices: [], supports: null, figure: img ? { page: 1, box: [0, 0, 500, 500] as [number, number, number, number], alt: "", img } : null });
  const items = [mk("dir", "read", "aaaaaa111111"), mk("q1", "short"), mk("q2", "choice"), mk("part2", "read"), mk("q3", "short"), mk("q4", "short", "bbbbbb222222"), mk("q5", "long")];
  assert.deepEqual(items.map((_, i) => pictureFor(items as any, i)?.id ?? null), ["dir", "dir", "dir", null, null, "q4", "q4"]);
});

test("a sentence starter the app put in the box doesn't count as an answer", async () => {
  const { isAnswered } = await import("../shared/ttsBuddy");
  const it: any = { supports: { starter: "The number line helps me because" } };
  assert.equal(isAnswered(it, "The number line helps me because "), false);
  assert.equal(isAnswered(it, "The number line helps me because 50% is under 2."), true);
  assert.equal(isAnswered({ supports: null } as any, "  "), false); assert.equal(isAnswered({ supports: null } as any, "4"), true);
});

test("supports are written by themselves: right after reading (no button), and kept when the phone saves an older copy", async () => {
  const { app, call } = fakeApp();
  let release!: () => void; const gate = new Promise<void>((r) => { release = r; });
  const askText = async (_s: string, user: string) => { await gate; return JSON.stringify({ items: JSON.parse(user).items.map((i: any) => ({ id: i.id, simple: `Easy: short words for ${i.id}`, steps: ["Look.", "Think."] })) }); };
  registerTtsBuddyRoutes(app, { kv: createMemoryKv(), readPhotos: async () => AI_REPLY, askText, speak: async () => ({ audio: Buffer.from("x"), words: [], duration: 1 }), aiConfigured: () => true });
  const r = await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] });
  assert.equal(r.body.drafting, true);
  const ws = r.body.worksheet;
  assert.equal((await call("GET", `/api/buddy/teacher/worksheets/${ws.id}`, T)).body.drafting, true);
  // The teacher edits while they're being written; then they arrive.
  const mine = { ...ws, title: "Fractions!" };
  release(); await new Promise((x) => setTimeout(x, 20));
  const after = await call("GET", `/api/buddy/teacher/worksheets/${ws.id}`, T);
  assert.equal(after.body.drafting, false);
  assert.ok(after.body.worksheet.items.every((i: any) => i.supports?.simple?.startsWith("Easy:")));
  const saved = await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}`, T, mine);
  assert.equal(saved.body.worksheet.title, "Fractions!");
  assert.ok(saved.body.worksheet.items.every((i: any) => i.supports?.simple), "the older copy didn't wipe them");
  // Students get every helper without the teacher setting anything up.
  const lap = await call("POST", "/api/buddy/laptop"); const L = { "x-buddy-laptop": lap.body.key };
  await call("POST", "/api/buddy/teacher/link", T, { code: lap.body.code, worksheetId: ws.id });
  const got = await call("GET", `/api/buddy/laptop/${lap.body.id}`, L);
  assert.deepEqual(got.body.acc, { simple: true, steps: true, starter: true, bank: true, vocab: true, fewer: true, big: false, mic: true });
  assert.ok(got.body.worksheet.items[1].supports.steps.length);
});

test("older worksheets: a page photo can be added later, and a real picture replaces the '[picture of …]' text", async () => {
  const { app, call } = fakeApp();
  const files = createMemoryFiles();
  const old = JSON.stringify({ title: "Ratios", items: [{ kind: "read", text: "Do Now: What do you notice? [picture of a double number line. The top line is labeled 'cups' and has numbers 0, 5, 10.]", choices: [] }] });
  registerTtsBuddyRoutes(app, { askText: async () => "{}", kv: createMemoryKv(), files, readPhotos: async () => old, aiConfigured: () => true });
  const ws = (await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] })).body.worksheet;
  await files.del([`page/${ws.id}/1`]); // as if it was read before photos were kept
  assert.equal((await call("GET", `/api/buddy/teacher/worksheets/${ws.id}/pages/1`, T)).status, 404);
  assert.equal((await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}/pages/1`, T, { image: PHOTO })).status, 200);
  assert.equal((await call("GET", `/api/buddy/teacher/worksheets/${ws.id}/pages/1`, T)).status, 200);
  assert.equal((await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}/pages/3`, T, { image: PHOTO })).status, 404, "no skipping pages");
  const put = await call("PUT", `/api/buddy/teacher/worksheets/${ws.id}/figures/${ws.items[0].id}`, T, { image: "data:image/jpeg;base64,/9j/CROP", page: 1, box: [50, 300, 950, 500] });
  const it = put.body.worksheet.items[0];
  assert.equal(it.text, "Do Now: What do you notice?");
  assert.match(it.figure.alt, /^a double number line\. The top line is labeled 'cups'/);
});

test("supports quality guards: 'easier' copies are dropped, each step only hears about the picture it shows", async () => {
  const { sameWords, supportsInput } = await import("../shared/ttsBuddy");
  assert.equal(sameWords("20 cups is what percent of 5 cups?", "20 cups is what percent of 5 cups?"), true);
  assert.equal(sameWords("Explain how the double number line helped you solve problem 2.", "Explain how the double number line helped you solve problem 2"), true);
  assert.equal(sameWords("Find 20 on the top line. What percent is it?", "20 cups is what percent of 5 cups?"), false);
  const fig = (alt: string) => ({ page: 1, box: [0, 0, 500, 500], alt, img: "abcdef123456" });
  const ws: any = { id: "w", title: "T", pages: 1, createdAt: "", items: [
    { id: "a", kind: "read", number: "", text: "Do Now", say: "", choices: [], supports: null, figure: fig("chocolate milk line, 5 cups = 50%") },
    { id: "b", kind: "short", number: "", text: "What do you notice?", say: "", choices: [], supports: null, figure: null },
    { id: "c", kind: "read", number: "", text: "Activity 1", say: "", choices: [], supports: null, figure: null },
    { id: "d", kind: "short", number: "1", text: "300% of 5 cups?", say: "", choices: [], supports: null, figure: null } ] };
  const inp = JSON.parse(supportsInput(ws, ["b", "d"]));
  assert.equal(inp.items.find((i: any) => i.id === "b").picture, "chocolate milk line, 5 cups = 50%", "shares the Do Now picture");
  assert.equal(inp.items.find((i: any) => i.id === "d").picture, undefined, "a new section doesn't see it");
  assert.doesNotMatch(inp.context, /chocolate/);
  // A drafted 'easier' copy is dropped on the server.
  const { app, call } = fakeApp();
  registerTtsBuddyRoutes(app, { kv: createMemoryKv(), readPhotos: async () => AI_REPLY, askText: async (_s, u) => JSON.stringify({ items: JSON.parse(u).items.map((i: any) => ({ id: i.id, simple: i.text, steps: ["Look closely."] })) }), aiConfigured: () => true });
  const w = (await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] })).body.worksheet;
  await new Promise((x) => setTimeout(x, 20));
  const got = (await call("GET", `/api/buddy/teacher/worksheets/${w.id}`, T)).body.worksheet;
  assert.ok(got.items.every((i: any) => !i.supports || i.supports.simple === ""), "no copy kept as 'easier'");
  assert.ok(got.items.some((i: any) => i.supports?.steps.length), "the rest of the supports are kept");
});

test("weak supports get a second try; picture-label steps fold into the step above", async () => {
  const { weakSupports, foldLabelSteps } = await import("../shared/ttsBuddy");
  const it: any = { text: "20 cups is what percent of 5 cups?", supports: { simple: "", steps: ["x"], starter: "", bank: [], vocab: [], keep: [0, 2] } };
  assert.deepEqual(weakSupports(it).length, 2);
  assert.deepEqual(weakSupports({ ...it, supports: { ...it.supports, simple: "Find 20 cups on top.", vocab: [{ w: "percent", m: "part of 100" }] } }), []);
  const mk = (id: string, kind: any, text: string, fig = false): any => ({ id, kind, number: "", text, say: "", choices: [], supports: null, figure: fig ? { page: 1, box: [0, 0, 900, 300], alt: "number line", img: "" } : null });
  const folded = foldLabelSteps([mk("a", "read", "Do Now: What do you notice?"), mk("b", "read", "cups of milk 0 5 10 15 20 0% 50% 100% 150% 200%", true), mk("c", "short", "1. What is 50%?")]);
  assert.deepEqual(folded.map((i: any) => i.id), ["a", "c"]); assert.equal(folded[0].figure.alt, "number line");
  // The second try fills in only what was missing.
  const { app, call } = fakeApp(); let n = 0;
  registerTtsBuddyRoutes(app, { kv: createMemoryKv(), readPhotos: async () => AI_REPLY, aiConfigured: () => true, askText: async (sys, u) => {
    n++; const items = JSON.parse(u).items;
    return JSON.stringify({ items: items.map((i: any) => (n === 1 ? { id: i.id, simple: i.text, steps: ["Look."] } : { id: i.id, simple: `Do this: ${i.id} in short words`, vocab: /fraction/i.test(i.text) ? [{ w: "fraction", m: "a part of a whole" }] : [] })) });
  } });
  const w = (await call("POST", "/api/buddy/teacher/read", T, { images: [PHOTO] })).body.worksheet;
  await new Promise((x) => setTimeout(x, 30));
  const got = (await call("GET", `/api/buddy/teacher/worksheets/${w.id}`, T)).body.worksheet;
  const q = got.items.find((i: any) => /fraction/.test(i.text));
  assert.match(q.supports.simple, /^Do this:/); assert.deepEqual(q.supports.steps, ["Look."], "kept from the first try");
  assert.equal(q.supports.vocab[0].w, "fraction"); assert.ok(n >= 2);
});
